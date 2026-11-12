import zlib from "node:zlib";
import { sanitizeText } from "./security";

/**
 * Zero-external-dependency document parser for uploaded business files:
 * - `.txt`, `.md`, `.csv`, `.tsv`, `.json`, `.xml`, `.html`
 * - `.pdf` (extracts text streams, decompresses FlateDecode streams via Node `zlib`, and decodes Tj/TJ operators)
 * - `.docx` & `.xlsx` (parses ZIP local file headers, decompresses DEFLATE entries via `zlib.inflateRawSync`,
 *   and extracts `word/document.xml` or `xl/sharedStrings.xml` + worksheet XML)
 */

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB

export type ParsedFileResult =
  | {
      ok: true;
      filename: string;
      detectedFormat: "pdf" | "docx" | "xlsx" | "csv" | "json" | "html" | "text";
      extractedText: string;
    }
  | { ok: false; status: number; error: string };

function decodePdfLiteralString(raw: string): string {
  return raw
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\([0-7]{1,3})/g, (_, oct) =>
      String.fromCharCode(parseInt(oct, 8)),
    );
}

function extractTextOperatorsFromPdfChunk(chunkText: string): string[] {
  const pieces: string[] = [];

  // Extract (literal) Tj
  const tjRegex = /\((?:\\.|[^\\()])*\)\s*Tj/g;
  let match: RegExpExecArray | null;
  while ((match = tjRegex.exec(chunkText)) !== null) {
    const inner = match[0].replace(/\)\s*Tj$/, "").slice(1);
    const decoded = decodePdfLiteralString(inner).trim();
    if (decoded) pieces.push(decoded);
  }

  // Extract [(literal) -120 (literal)] TJ arrays
  const tjArrayRegex = /\[((?:[\s\S]*?))\]\s*TJ/g;
  while ((match = tjArrayRegex.exec(chunkText)) !== null) {
    const arrayBody = match[1];
    const parts: string[] = [];
    const strRegex = /\((?:\\.|[^\\()])*\)/g;
    let strMatch: RegExpExecArray | null;
    while ((strMatch = strRegex.exec(arrayBody)) !== null) {
      const inner = strMatch[0].slice(1, -1);
      parts.push(decodePdfLiteralString(inner));
    }
    const joined = parts.join("").trim();
    if (joined) pieces.push(joined);
  }

  return pieces;
}

export function extractTextFromPdfBuffer(buf: Buffer): string {
  const rawLatin1 = buf.toString("latin1");
  const extractedSegments: string[] = [];

  // 1. Inspect each stream...endstream block, decompressing FlateDecode where possible
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(rawLatin1)) !== null) {
    const streamBytes = Buffer.from(match[1], "latin1");
    let decodedStream = "";
    try {
      decodedStream = zlib.inflateSync(streamBytes).toString("latin1");
    } catch {
      try {
        decodedStream = zlib.inflateRawSync(streamBytes).toString("latin1");
      } catch {
        decodedStream = match[1];
      }
    }
    const ops = extractTextOperatorsFromPdfChunk(decodedStream);
    if (ops.length > 0) {
      extractedSegments.push(ops.join(" "));
    }
  }

  // 2. Also scan top-level uncompressed PDF content
  if (extractedSegments.length === 0) {
    const topOps = extractTextOperatorsFromPdfChunk(rawLatin1);
    if (topOps.length > 0) {
      extractedSegments.push(topOps.join(" "));
    }
  }

  return sanitizeText(extractedSegments.join("\n"), 12000);
}

/**
 * Minimal ZIP reader using Node's built-in `zlib.inflateRawSync` to extract XML
 * entries from `.docx` (`word/document.xml`) and `.xlsx` (`xl/sharedStrings.xml`, `xl/worksheets/sheet1.xml`).
 */
export function extractEntriesFromZipBuffer(
  buf: Buffer,
  targetNames: Set<string>,
): Map<string, string> {
  const results = new Map<string, string>();
  let offset = 0;

  while (offset + 30 <= buf.length) {
    const signature = buf.readUInt32LE(offset);
    if (signature !== 0x04034b50) {
      break; // Reached central directory or end of local headers
    }

    const flags = buf.readUInt16LE(offset + 6);
    const compressionMethod = buf.readUInt16LE(offset + 8);
    const compressedSize = buf.readUInt32LE(offset + 18);
    const fileNameLength = buf.readUInt16LE(offset + 26);
    const extraFieldLength = buf.readUInt16LE(offset + 28);

    const nameStart = offset + 30;
    const nameEnd = nameStart + fileNameLength;
    if (nameEnd > buf.length) break;

    const entryName = buf.subarray(nameStart, nameEnd).toString("utf8");
    const dataStart = nameEnd + extraFieldLength;

    // If bit 3 of general purpose flags is set, sizes are in data descriptor; stop if unknown
    if ((flags & 0x08) !== 0 && compressedSize === 0) {
      break;
    }

    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buf.length) break;

    if (targetNames.has(entryName)) {
      const rawEntry = buf.subarray(dataStart, dataEnd);
      try {
        if (compressionMethod === 0) {
          results.set(entryName, rawEntry.toString("utf8"));
        } else if (compressionMethod === 8) {
          const inflated = zlib.inflateRawSync(rawEntry);
          results.set(entryName, inflated.toString("utf8"));
        }
      } catch {
        /* skip corrupt entry */
      }
    }

    offset = dataEnd;
  }

  return results;
}

function stripXmlTags(xml: string): string {
  return xml
    .replace(/<\/w:p>/gi, "\n")
    .replace(/<\/row>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

export function parseUploadedDocument(
  filename: string,
  buffer: Buffer,
): ParsedFileResult {
  if (!buffer || buffer.length === 0) {
    return { ok: false, status: 400, error: "Uploaded file is empty." };
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      status: 413,
      error: "Uploaded file exceeds the 4 MB size limit.",
    };
  }

  const lowerName = (filename || "document.txt").toLowerCase().trim();

  // 1. PDF (%PDF- magic header or .pdf extension)
  if (
    lowerName.endsWith(".pdf") ||
    buffer.subarray(0, 5).toString("ascii") === "%PDF-"
  ) {
    const text = extractTextFromPdfBuffer(buffer);
    if (!text) {
      return {
        ok: false,
        status: 422,
        error:
          "Could not extract text streams from this PDF. Scanned image-only PDFs (OCR) are not supported in v1; please upload a text-based PDF or paste the text.",
      };
    }
    return {
      ok: true,
      filename,
      detectedFormat: "pdf",
      extractedText: text,
    };
  }

  // 2. DOCX / XLSX (PK\x03\x04 ZIP header)
  const isZip =
    buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50;
  if (isZip || lowerName.endsWith(".docx") || lowerName.endsWith(".xlsx")) {
    const entries = extractEntriesFromZipBuffer(
      buffer,
      new Set([
        "word/document.xml",
        "xl/sharedStrings.xml",
        "xl/worksheets/sheet1.xml",
      ]),
    );

    if (entries.has("word/document.xml")) {
      const text = sanitizeText(
        stripXmlTags(entries.get("word/document.xml")!),
        12000,
      );
      if (!text) {
        return {
          ok: false,
          status: 422,
          error: "The uploaded DOCX document contains no extractable text.",
        };
      }
      return {
        ok: true,
        filename,
        detectedFormat: "docx",
        extractedText: text,
      };
    }

    if (
      entries.has("xl/sharedStrings.xml") ||
      entries.has("xl/worksheets/sheet1.xml")
    ) {
      const combinedXml = [
        entries.get("xl/sharedStrings.xml") ?? "",
        entries.get("xl/worksheets/sheet1.xml") ?? "",
      ].join("\n");
      const text = sanitizeText(stripXmlTags(combinedXml), 12000);
      if (!text) {
        return {
          ok: false,
          status: 422,
          error: "The uploaded XLSX workbook contains no extractable text.",
        };
      }
      return {
        ok: true,
        filename,
        detectedFormat: "xlsx",
        extractedText: text,
      };
    }

    return {
      ok: false,
      status: 415,
      error:
        "Unsupported archive format. Upload a standard .docx, .xlsx, .pdf, .csv, or .txt document.",
    };
  }

  // 3. Plain-text formats (.csv, .tsv, .json, .html, .xml, .md, .txt)
  const allowedTextExts = [
    ".txt",
    ".md",
    ".csv",
    ".tsv",
    ".json",
    ".xml",
    ".html",
    ".htm",
  ];
  const hasAllowedExt = allowedTextExts.some((ext) => lowerName.endsWith(ext));
  if (!hasAllowedExt) {
    return {
      ok: false,
      status: 415,
      error:
        "Unsupported file format. Supported formats: .pdf (text-based), .docx, .xlsx, .csv, .json, .html, .md, .txt.",
    };
  }

  const rawText = buffer.toString("utf8");
  let detectedFormat: ParsedFileResult & { ok: true }["detectedFormat"] = "text";
  let cleaned = rawText;

  if (lowerName.endsWith(".csv") || lowerName.endsWith(".tsv")) {
    detectedFormat = "csv";
  } else if (lowerName.endsWith(".json")) {
    detectedFormat = "json";
  } else if (
    lowerName.endsWith(".html") ||
    lowerName.endsWith(".htm") ||
    lowerName.endsWith(".xml")
  ) {
    detectedFormat = "html";
    cleaned = stripXmlTags(rawText);
  }

  const finalText = sanitizeText(cleaned, 12000);
  if (!finalText) {
    return {
      ok: false,
      status: 422,
      error: "The uploaded file contains no readable text.",
    };
  }

  return {
    ok: true,
    filename,
    detectedFormat,
    extractedText: finalText,
  };
}

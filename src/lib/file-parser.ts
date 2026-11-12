import zlib from "node:zlib";
import { sanitizeText } from "./security";

/**
 * Hardened zero-external-dependency document parser for uploaded business files:
 * - `.txt`, `.md`, `.csv`, `.tsv`, `.json`, `.xml`, `.html`
 * - `.pdf` (decompresses FlateDecode streams via Node `zlib` with strict `maxOutputLength`,
 *   ratio, and cumulative byte caps, then decodes Tj/TJ operators)
 * - `.docx` & `.xlsx` (parses ZIP local file headers, blocks path traversal and encrypted
 *   entries, and decompresses DEFLATE entries via `zlib.inflateRawSync` with strict zip-bomb caps)
 */

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB raw upload cap
export const MAX_SINGLE_ENTRY_UNCOMPRESSED_BYTES = 2 * 1024 * 1024; // 2 MB per stream/entry
export const MAX_TOTAL_UNCOMPRESSED_BYTES = 4 * 1024 * 1024; // 4 MB cumulative across archive/PDF
export const MAX_COMPRESSION_RATIO = 50; // Reject > 50:1 compression ratio (zip/PDF bomb defense)
export const MAX_ARCHIVE_ENTRIES = 64; // Max ZIP local file headers inspected
export const MAX_PDF_STREAMS = 64; // Max PDF stream objects decompressed

export class DecompressionLimitError extends Error {
  status: number;
  constructor(message: string, status = 413) {
    super(message);
    this.name = "DecompressionLimitError";
    this.status = status;
  }
}

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

function inflateBounded(
  compressed: Buffer,
  mode: "zlib" | "raw",
  maxBytes: number,
): Buffer {
  try {
    const out =
      mode === "zlib"
        ? zlib.inflateSync(compressed, { maxOutputLength: maxBytes })
        : zlib.inflateRawSync(compressed, { maxOutputLength: maxBytes });

    const ratio = out.byteLength / Math.max(1, compressed.byteLength);
    if (ratio > MAX_COMPRESSION_RATIO) {
      throw new DecompressionLimitError(
        `Decompression ratio (${Math.round(ratio)}:1) exceeds safety limit (${MAX_COMPRESSION_RATIO}:1).`,
        413,
      );
    }
    return out;
  } catch (err) {
    if (err instanceof DecompressionLimitError) throw err;
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: unknown }).code)
        : "";
    const msg = err instanceof Error ? err.message : "";
    if (
      code === "ERR_BUFFER_TOO_LARGE" ||
      msg.includes("Cannot create a Buffer larger than") ||
      msg.includes("maxOutputLength")
    ) {
      throw new DecompressionLimitError(
        `Decompressed stream exceeds maximum allowed size (${Math.round(maxBytes / (1024 * 1024))} MB).`,
        413,
      );
    }
    throw err;
  }
}

export function extractTextFromPdfBuffer(buf: Buffer): string {
  const rawLatin1 = buf.toString("latin1");
  const extractedSegments: string[] = [];

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  let streamCount = 0;
  let totalDecompressedBytes = 0;

  while ((match = streamRegex.exec(rawLatin1)) !== null) {
    streamCount += 1;
    if (streamCount > MAX_PDF_STREAMS) {
      throw new DecompressionLimitError(
        `PDF contains too many compressed streams (max ${MAX_PDF_STREAMS}).`,
        413,
      );
    }

    const streamBytes = Buffer.from(match[1], "latin1");
    if (streamBytes.byteLength === 0) continue;

    let decodedStream = "";
    const remainingBudget =
      MAX_TOTAL_UNCOMPRESSED_BYTES - totalDecompressedBytes;
    if (remainingBudget <= 0) {
      throw new DecompressionLimitError(
        "PDF cumulative decompressed output exceeds 4 MB safety limit.",
        413,
      );
    }
    const streamCap = Math.min(
      MAX_SINGLE_ENTRY_UNCOMPRESSED_BYTES,
      remainingBudget,
    );

    try {
      const inflated = inflateBounded(streamBytes, "zlib", streamCap);
      totalDecompressedBytes += inflated.byteLength;
      decodedStream = inflated.toString("latin1");
    } catch (err) {
      if (err instanceof DecompressionLimitError) throw err;
      try {
        const inflatedRaw = inflateBounded(streamBytes, "raw", streamCap);
        totalDecompressedBytes += inflatedRaw.byteLength;
        decodedStream = inflatedRaw.toString("latin1");
      } catch (rawErr) {
        if (rawErr instanceof DecompressionLimitError) throw rawErr;
        totalDecompressedBytes += streamBytes.byteLength;
        if (totalDecompressedBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
          throw new DecompressionLimitError(
            "PDF cumulative stream size exceeds 4 MB safety limit.",
            413,
          );
        }
        decodedStream = match[1];
      }
    }

    const ops = extractTextOperatorsFromPdfChunk(decodedStream);
    if (ops.length > 0) {
      extractedSegments.push(ops.join(" "));
    }
  }

  // Scan top-level uncompressed PDF content when no stream operators matched
  if (extractedSegments.length === 0) {
    const topOps = extractTextOperatorsFromPdfChunk(rawLatin1);
    if (topOps.length > 0) {
      extractedSegments.push(topOps.join(" "));
    }
  }

  return sanitizeText(extractedSegments.join("\n"), 12000);
}

export function isUnsafeZipEntryName(entryName: string): boolean {
  if (!entryName || entryName.length > 256) return true;
  if (entryName.includes("\0")) return true;
  if (entryName.startsWith("/") || entryName.startsWith("\\")) return true;
  if (/^[a-zA-Z]:/.test(entryName)) return true;
  const normalized = entryName.replace(/\\/g, "/");
  const segments = normalized.split("/");
  return segments.some((seg) => seg === "..");
}

/**
 * Hardened ZIP reader using Node's built-in `zlib.inflateRawSync` with:
 * - Path traversal detection (`..`, absolute paths, drive letters, null bytes)
 * - Encrypted entry rejection
 * - Entry count cap (`MAX_ARCHIVE_ENTRIES`)
 * - Per-entry `maxOutputLength` (`2 MB`), cumulative cap (`4 MB`), and compression ratio cap (`50:1`)
 */
export function extractEntriesFromZipBuffer(
  buf: Buffer,
  targetNames: Set<string>,
): Map<string, string> {
  const results = new Map<string, string>();
  let offset = 0;
  let entryCount = 0;
  let totalUncompressedBytes = 0;

  while (offset + 30 <= buf.length) {
    const signature = buf.readUInt32LE(offset);
    if (signature !== 0x04034b50) {
      break; // Reached central directory or end of local headers
    }

    entryCount += 1;
    if (entryCount > MAX_ARCHIVE_ENTRIES) {
      throw new DecompressionLimitError(
        `Archive contains more than ${MAX_ARCHIVE_ENTRIES} entries.`,
        413,
      );
    }

    const flags = buf.readUInt16LE(offset + 6);
    const compressionMethod = buf.readUInt16LE(offset + 8);
    const compressedSize = buf.readUInt32LE(offset + 18);
    const uncompressedSizeHeader = buf.readUInt32LE(offset + 22);
    const fileNameLength = buf.readUInt16LE(offset + 26);
    const extraFieldLength = buf.readUInt16LE(offset + 28);

    // Bit 0 indicates encrypted archive entry
    if ((flags & 0x01) !== 0) {
      throw new DecompressionLimitError(
        "Encrypted or password-protected archives are not supported.",
        422,
      );
    }

    const nameStart = offset + 30;
    const nameEnd = nameStart + fileNameLength;
    if (nameEnd > buf.length) {
      throw new DecompressionLimitError(
        "Malformed ZIP header: truncated entry filename.",
        422,
      );
    }

    const entryName = buf.subarray(nameStart, nameEnd).toString("utf8");
    if (isUnsafeZipEntryName(entryName)) {
      throw new DecompressionLimitError(
        "Archive contains an unsafe or path-traversal entry name.",
        400,
      );
    }

    const dataStart = nameEnd + extraFieldLength;

    // Reject streaming data descriptors with unknown size
    if ((flags & 0x08) !== 0 && compressedSize === 0) {
      throw new DecompressionLimitError(
        "Streaming ZIP entries without declared compressed size are not supported.",
        422,
      );
    }

    if (
      compressedSize === 0xffffffff ||
      uncompressedSizeHeader === 0xffffffff
    ) {
      throw new DecompressionLimitError(
        "ZIP64 archives are not supported.",
        413,
      );
    }

    if (uncompressedSizeHeader > MAX_SINGLE_ENTRY_UNCOMPRESSED_BYTES) {
      throw new DecompressionLimitError(
        `Archive entry exceeds maximum uncompressed size (${Math.round(MAX_SINGLE_ENTRY_UNCOMPRESSED_BYTES / (1024 * 1024))} MB).`,
        413,
      );
    }

    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buf.length || dataEnd < dataStart) {
      throw new DecompressionLimitError(
        "Malformed ZIP archive: entry data extends beyond file boundary.",
        422,
      );
    }

    if (targetNames.has(entryName)) {
      const rawEntry = buf.subarray(dataStart, dataEnd);
      const remainingBudget =
        MAX_TOTAL_UNCOMPRESSED_BYTES - totalUncompressedBytes;
      if (remainingBudget <= 0) {
        throw new DecompressionLimitError(
          "Archive cumulative uncompressed output exceeds 4 MB safety limit.",
          413,
        );
      }
      const entryCap = Math.min(
        MAX_SINGLE_ENTRY_UNCOMPRESSED_BYTES,
        remainingBudget,
      );

      if (compressionMethod === 0) {
        if (rawEntry.byteLength > entryCap) {
          throw new DecompressionLimitError(
            "Uncompressed archive entry exceeds size limit.",
            413,
          );
        }
        totalUncompressedBytes += rawEntry.byteLength;
        results.set(entryName, rawEntry.toString("utf8"));
      } else if (compressionMethod === 8) {
        try {
          const inflated = inflateBounded(rawEntry, "raw", entryCap);
          totalUncompressedBytes += inflated.byteLength;
          results.set(entryName, inflated.toString("utf8"));
        } catch (err) {
          if (err instanceof DecompressionLimitError) throw err;
          throw new DecompressionLimitError(
            "Corrupt DEFLATE stream inside archive entry.",
            422,
          );
        }
      } else {
        throw new DecompressionLimitError(
          `Unsupported ZIP compression method (${compressionMethod}).`,
          422,
        );
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
    try {
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
    } catch (err) {
      if (err instanceof DecompressionLimitError) {
        return { ok: false, status: err.status, error: err.message };
      }
      return {
        ok: false,
        status: 422,
        error: "Unable to parse malformed PDF stream data.",
      };
    }
  }

  // 2. DOCX / XLSX (PK\x03\x04 ZIP header)
  const isZip =
    buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50;
  if (isZip || lowerName.endsWith(".docx") || lowerName.endsWith(".xlsx")) {
    if (!isZip) {
      return {
        ok: false,
        status: 422,
        error: "Uploaded Office document is not a valid ZIP container.",
      };
    }
    let entries: Map<string, string>;
    try {
      entries = extractEntriesFromZipBuffer(
        buffer,
        new Set([
          "word/document.xml",
          "xl/sharedStrings.xml",
          "xl/worksheets/sheet1.xml",
        ]),
      );
    } catch (err) {
      if (err instanceof DecompressionLimitError) {
        return { ok: false, status: err.status, error: err.message };
      }
      return {
        ok: false,
        status: 422,
        error: "Malformed or unreadable Office archive.",
      };
    }

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
        "Unsupported archive structure. Upload a standard .docx, .xlsx, .pdf, .csv, or .txt document.",
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
  let detectedFormat: Extract<ParsedFileResult, { ok: true }>["detectedFormat"] =
    "text";
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

  const normalized = sanitizeText(cleaned, 12000);
  if (!normalized) {
    return {
      ok: false,
      status: 422,
      error: "Uploaded file contains no readable text content.",
    };
  }

  return {
    ok: true,
    filename,
    detectedFormat,
    extractedText: normalized,
  };
}

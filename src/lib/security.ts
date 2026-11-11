import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";

/**
 * Application security utilities:
 * - Strict URL parsing & SSRF prevention (IPv4, IPv6, IPv4-mapped IPv6, octal/hex/integer encodings)
 * - DNS resolution validation + TOCTOU-eliminating IP-pinned HTTP/HTTPS socket connection
 *   (passes a pinned `lookup` callback to `http.request`/`https.request` with `servername` SNI
 *   so the underlying socket connects to the exact validated IP without a second DNS lookup)
 * - Manual redirect validation (max 3 hops), Content-Type allowlisting, and 512 KB stream cap
 * - Input sanitization & prompt-injection boundary protection
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "0.0.0.0",
  "127.0.0.1",
  "::1",
  "[::1]",
  "::",
  "[::]",
  "169.254.169.254",
  "169.254.170.2",
  "metadata.google.internal",
  "metadata",
  "instance-data",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

const ALLOWED_PORTS = new Set(["", "80", "443"]);

const ALLOWED_CONTENT_TYPES = [
  "text/html",
  "text/plain",
  "application/xhtml+xml",
  "application/xml",
  "text/xml",
  "text/markdown",
];

function isSuspiciousNumericHost(host: string): boolean {
  const clean = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (/^(0x[0-9a-f]+|\d+)$/i.test(clean)) {
    return true;
  }
  const parts = clean.split(".");
  if (parts.every((p) => /^(0x[0-9a-f]+|\d+)$/i.test(p))) {
    if (parts.length !== 4) return true;
    for (const part of parts) {
      if (part.startsWith("0x")) return true;
      if (part.length > 1 && part.startsWith("0")) return true;
    }
  }
  return false;
}

export function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return true;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;

  const [a, b, c] = nums;

  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0 && c === 0) return true;
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 192 && b === 88 && c === 99) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true;

  return false;
}

export function isPrivateOrReservedIpv6(rawIp: string): boolean {
  const clean = rawIp.replace(/^\[|\]$/g, "").toLowerCase();
  if (clean.includes("%")) return true;

  if (
    clean === "::1" ||
    clean === "::" ||
    clean === "0:0:0:0:0:0:0:1" ||
    clean === "0:0:0:0:0:0:0:0"
  ) {
    return true;
  }

  const lastColon = clean.lastIndexOf(":");
  if (lastColon !== -1) {
    const tail = clean.slice(lastColon + 1);
    if (tail.includes(".")) {
      return isPrivateOrReservedIpv4(tail);
    }
  }

  const doubleColonParts = clean.split("::");
  if (doubleColonParts.length > 2) return true;

  let groups: string[] = [];
  if (doubleColonParts.length === 2) {
    const left = doubleColonParts[0] ? doubleColonParts[0].split(":") : [];
    const right = doubleColonParts[1] ? doubleColonParts[1].split(":") : [];
    const missing = 8 - (left.length + right.length);
    if (missing < 1) return true;
    groups = [...left, ...Array(missing).fill("0"), ...right];
  } else {
    groups = clean.split(":");
  }

  if (groups.length !== 8) return true;
  const nums = groups.map((g) => parseInt(g || "0", 16));
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 0xffff)) return true;

  const allZeroPrefix = nums.slice(0, 7).every((n) => n === 0);
  if (allZeroPrefix && (nums[7] === 0 || nums[7] === 1)) return true;

  const isIpv4Mapped =
    nums[0] === 0 &&
    nums[1] === 0 &&
    nums[2] === 0 &&
    nums[3] === 0 &&
    nums[4] === 0 &&
    (nums[5] === 0xffff || nums[5] === 0);
  if (isIpv4Mapped) {
    const hi = nums[6];
    const lo = nums[7];
    const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    return isPrivateOrReservedIpv4(ipv4);
  }

  const first = nums[0];
  if ((first & 0xfe00) === 0xfc00) return true;
  if ((first & 0xffc0) === 0xfe80) return true;
  if ((first & 0xff00) === 0xff00) return true;
  if (first === 0x2001 && nums[1] === 0x0db8) return true;
  if (first === 0x2001 && nums[1] === 0x0000) return true;
  if (first === 0x2002) return true;

  return false;
}

export function isReservedOrPrivateIp(ip: string): boolean {
  const clean = ip.replace(/^\[|\]$/g, "").trim();
  const version = net.isIP(clean);
  if (version === 4) {
    if (isSuspiciousNumericHost(clean)) return true;
    return isPrivateOrReservedIpv4(clean);
  }
  if (version === 6) {
    return isPrivateOrReservedIpv6(clean);
  }
  return true;
}

export type UrlValidationResult =
  | { ok: true; url: string; hostname: string }
  | { ok: false; error: string };

export function validateExternalUrl(raw: string): UrlValidationResult {
  if (typeof raw !== "string") {
    return { ok: false, error: "Provide a valid URL." };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Provide a valid URL." };
  }
  if (trimmed.length > 2048) {
    return { ok: false, error: "URL exceeds maximum length (2048 characters)." };
  }
  if (/[\r\n\0\t]/.test(trimmed)) {
    return { ok: false, error: "URL contains invalid control characters." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      ok: false,
      error: "Invalid URL format. Include http:// or https://.",
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      ok: false,
      error: "Only http:// and https:// URLs are supported.",
    };
  }

  if (parsed.username || parsed.password) {
    return {
      ok: false,
      error: "URLs with embedded credentials are not allowed.",
    };
  }

  if (!ALLOWED_PORTS.has(parsed.port)) {
    return {
      ok: false,
      error: "Only standard HTTP (80) and HTTPS (443) ports are allowed.",
    };
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) {
    return { ok: false, error: "URL is missing a valid hostname." };
  }

  if (
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost") ||
    host.endsWith(".lan") ||
    host.endsWith(".home") ||
    host.endsWith(".corp")
  ) {
    return {
      ok: false,
      error: "URLs pointing to private or local networks are not allowed.",
    };
  }

  if (isSuspiciousNumericHost(host)) {
    const cleanHost = host.replace(/^\[|\]$/g, "");
    if (net.isIPv4(cleanHost)) {
      if (isPrivateOrReservedIpv4(cleanHost)) {
        return {
          ok: false,
          error: "URLs pointing to private or reserved IP addresses are not allowed.",
        };
      }
    } else {
      return {
        ok: false,
        error: "Non-standard numeric IP encodings are not allowed.",
      };
    }
  }

  const cleanIpCandidate = host.replace(/^\[|\]$/g, "");
  if (net.isIP(cleanIpCandidate)) {
    if (isReservedOrPrivateIp(cleanIpCandidate)) {
      return {
        ok: false,
        error: "URLs pointing to private or reserved IP addresses are not allowed.",
      };
    }
  } else if (!host.includes(".")) {
    return {
      ok: false,
      error: "Single-label internal hostnames are not allowed.",
    };
  }

  return { ok: true, url: parsed.toString(), hostname: cleanIpCandidate };
}

export type DnsRecord = { address: string; family: number };
export type DnsLookupFn = (hostname: string) => Promise<DnsRecord[]>;

const defaultDnsLookup: DnsLookupFn = async (hostname: string) => {
  return dns.lookup(hostname, { all: true, verbatim: true });
};

/**
 * Resolves all DNS records for a hostname and verifies that every returned IP
 * is a public unicast address. Returns the verified records so the caller can
 * pin the outbound socket connection directly to `records[0]`.
 */
export async function resolveAndValidateHost(
  hostname: string,
  lookupFn: DnsLookupFn = defaultDnsLookup,
): Promise<
  | { ok: true; addresses: string[]; records: DnsRecord[] }
  | { ok: false; error: string }
> {
  const clean = hostname.replace(/^\[|\]$/g, "");
  const ipVersion = net.isIP(clean);
  if (ipVersion) {
    if (isReservedOrPrivateIp(clean)) {
      return {
        ok: false,
        error: "Resolved address is in a private or reserved IP range.",
      };
    }
    return {
      ok: true,
      addresses: [clean],
      records: [{ address: clean, family: ipVersion }],
    };
  }

  let records: DnsRecord[];
  try {
    records = await lookupFn(clean);
  } catch {
    return {
      ok: false,
      error: "Could not resolve the domain name.",
    };
  }

  if (!Array.isArray(records) || records.length === 0) {
    return {
      ok: false,
      error: "Domain did not resolve to any IP address.",
    };
  }

  const validatedRecords: DnsRecord[] = [];
  for (const rec of records) {
    const family = rec?.family === 6 || net.isIP(rec?.address ?? "") === 6 ? 6 : 4;
    if (!rec?.address || isReservedOrPrivateIp(rec.address)) {
      return {
        ok: false,
        error: "Domain resolves to a private or reserved network address.",
      };
    }
    validatedRecords.push({ address: rec.address, family });
  }

  return {
    ok: true,
    addresses: validatedRecords.map((r) => r.address),
    records: validatedRecords,
  };
}

export type PinnedTransportResponse = {
  status: number;
  headers: Headers;
  bodyBytes: Uint8Array;
};

export type PinnedTransportFn = (opts: {
  parsedUrl: URL;
  pinnedAddress: string;
  pinnedFamily: number;
  timeoutMs: number;
  maxBytes: number;
}) => Promise<PinnedTransportResponse>;

/**
 * Executes an HTTP/HTTPS GET request pinned to `pinnedAddress` via a custom
 * socket `lookup` function so Node never performs a second unvalidated DNS lookup
 * (eliminating the DNS-rebinding TOCTOU window), while preserving TLS SNI and
 * certificate hostname verification via `servername: parsedUrl.hostname`.
 */
export const defaultPinnedTransport: PinnedTransportFn = ({
  parsedUrl,
  pinnedAddress,
  pinnedFamily,
  timeoutMs,
  maxBytes,
}) => {
  return new Promise<PinnedTransportResponse>((resolve, reject) => {
    const isHttps = parsedUrl.protocol === "https:";
    const requestFn = isHttps ? https.request : http.request;
    const defaultPort = isHttps ? 443 : 80;
    const port = parsedUrl.port ? Number(parsedUrl.port) : defaultPort;

    const req = requestFn(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: "GET",
        servername: parsedUrl.hostname,
        headers: {
          Host: parsedUrl.host,
          "User-Agent": "Cadence-Operations-Analyst/1.0",
          Accept:
            "text/html,text/plain,application/xhtml+xml,application/xml;q=0.9",
          "Accept-Encoding": "identity",
          Connection: "close",
        },
        lookup: (_hostname, _options, callback) => {
          callback(null, pinnedAddress, pinnedFamily);
        },
      },
      (res) => {
        const status = res.statusCode ?? 502;
        const headers = new Headers();
        for (const [k, v] of Object.entries(res.headers)) {
          if (Array.isArray(v)) {
            headers.set(k, v.join(", "));
          } else if (typeof v === "string") {
            headers.set(k, v);
          }
        }

        // Do not stream body on redirects
        if (status >= 300 && status < 400) {
          res.resume();
          resolve({ status, headers, bodyBytes: new Uint8Array(0) });
          return;
        }

        const contentLength = Number(headers.get("content-length") ?? "0");
        if (contentLength > maxBytes) {
          res.destroy();
          const err = new Error("MAX_BYTES_EXCEEDED");
          reject(err);
          return;
        }

        const chunks: Buffer[] = [];
        let totalBytes = 0;

        res.on("data", (chunk: Buffer) => {
          totalBytes += chunk.byteLength;
          if (totalBytes > maxBytes) {
            res.destroy();
            reject(new Error("MAX_BYTES_EXCEEDED"));
            return;
          }
          chunks.push(chunk);
        });

        res.on("end", () => {
          const combined = Buffer.concat(chunks, totalBytes);
          resolve({
            status,
            headers,
            bodyBytes: new Uint8Array(
              combined.buffer,
              combined.byteOffset,
              combined.byteLength,
            ),
          });
        });

        res.on("error", (err) => reject(err));
      },
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("REQUEST_TIMEOUT"));
    });

    req.on("error", (err) => reject(err));
    req.end();
  });
};

export type SafeFetchResult =
  | {
      ok: true;
      finalUrl: string;
      pinnedAddress: string;
      title: string | null;
      contentType: string;
      body: string;
    }
  | { ok: false; status: number; error: string };

/**
 * Controlled outbound HTTP fetcher that enforces:
 * 1. URL structural validation (HTTP/HTTPS, standard ports 80/443, no credentials)
 * 2. DNS resolution validation across all A/AAAA records
 * 3. IP-pinned socket transport (`pinnedTransport`) so the socket connects to the
 *    exact validated IP address, eliminating DNS-rebinding TOCTOU attacks
 * 4. Manual redirect handling (max 3 hops) with full URL + DNS re-validation on every hop
 * 5. Strict response timeout (8s), streaming byte cap (512 KB), and Content-Type allowlist
 */
export async function safeFetchExternalUrl(
  initialUrl: string,
  opts: {
    maxRedirects?: number;
    maxBytes?: number;
    timeoutMs?: number;
    lookupFn?: DnsLookupFn;
    pinnedTransport?: PinnedTransportFn;
    fetchFn?: typeof fetch;
  } = {},
): Promise<SafeFetchResult> {
  const maxRedirects = opts.maxRedirects ?? 3;
  const maxBytes = opts.maxBytes ?? 512 * 1024;
  const timeoutMs = opts.timeoutMs ?? 8000;
  const lookupFn = opts.lookupFn ?? defaultDnsLookup;

  let currentUrl = initialUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const urlCheck = validateExternalUrl(currentUrl);
    if (!urlCheck.ok) {
      return { ok: false, status: 400, error: urlCheck.error };
    }

    const dnsCheck = await resolveAndValidateHost(urlCheck.hostname, lookupFn);
    if (!dnsCheck.ok) {
      return { ok: false, status: 400, error: dnsCheck.error };
    }

    const primaryRecord = dnsCheck.records[0];
    const parsedUrl = new URL(urlCheck.url);

    // If a custom fetchFn is injected for legacy unit tests, wrap it into PinnedTransportResponse
    const transport: PinnedTransportFn =
      opts.pinnedTransport ??
      (opts.fetchFn
        ? async ({ parsedUrl: u, timeoutMs: t, maxBytes: mb }) => {
            const resp = await opts.fetchFn!(u.toString(), {
              method: "GET",
              redirect: "manual",
              signal: AbortSignal.timeout(t),
            });
            if (resp.status >= 300 && resp.status < 400) {
              return {
                status: resp.status,
                headers: resp.headers,
                bodyBytes: new Uint8Array(0),
              };
            }
            const cl = Number(resp.headers.get("content-length") ?? "0");
            if (cl > mb) throw new Error("MAX_BYTES_EXCEEDED");
            const buf = new Uint8Array(await resp.arrayBuffer());
            if (buf.byteLength > mb) throw new Error("MAX_BYTES_EXCEEDED");
            return {
              status: resp.status,
              headers: resp.headers,
              bodyBytes: buf,
            };
          }
        : defaultPinnedTransport);

    let transportRes: PinnedTransportResponse;
    try {
      transportRes = await transport({
        parsedUrl,
        pinnedAddress: primaryRecord.address,
        pinnedFamily: primaryRecord.family,
        timeoutMs,
        maxBytes,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "MAX_BYTES_EXCEEDED") {
        return {
          ok: false,
          status: 413,
          error: `Remote document exceeds the maximum supported size (${Math.round(maxBytes / 1024)} KB).`,
        };
      }
      return {
        ok: false,
        status: 502,
        error: "Unable to connect to the target URL within the timeout window.",
      };
    }

    if (transportRes.status >= 300 && transportRes.status < 400) {
      const location = transportRes.headers.get("location");
      if (!location) {
        return {
          ok: false,
          status: 502,
          error: "Remote server returned a redirect without a Location header.",
        };
      }
      if (hop === maxRedirects) {
        return {
          ok: false,
          status: 400,
          error: `URL exceeded maximum redirect limit (${maxRedirects}).`,
        };
      }
      try {
        currentUrl = new URL(location, urlCheck.url).toString();
      } catch {
        return {
          ok: false,
          status: 400,
          error: "Remote server redirected to an invalid URL.",
        };
      }
      continue;
    }

    if (transportRes.status < 200 || transportRes.status >= 300) {
      return {
        ok: false,
        status: 502,
        error: `Remote server returned HTTP ${transportRes.status}.`,
      };
    }

    const contentType = (
      transportRes.headers.get("content-type") ?? "text/plain"
    ).toLowerCase();
    const isAllowedType = ALLOWED_CONTENT_TYPES.some((t) =>
      contentType.includes(t),
    );
    if (!isAllowedType) {
      return {
        ok: false,
        status: 415,
        error:
          "Unsupported content type. Only HTML, XML, or plain-text documents can be analyzed via URL.",
      };
    }

    const bodyText = new TextDecoder("utf-8", { fatal: false }).decode(
      transportRes.bodyBytes,
    );
    const titleMatch = bodyText.match(/<title[^>]*>([^<]+)<\/title>/i);

    return {
      ok: true,
      finalUrl: urlCheck.url,
      pinnedAddress: primaryRecord.address,
      title: titleMatch?.[1]?.trim() ?? null,
      contentType,
      body: bodyText,
    };
  }

  return {
    ok: false,
    status: 400,
    error: "Too many redirects.",
  };
}

export function sanitizeText(input: unknown, maxLength = 8000): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/\0/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeUntrustedDocument(
  input: string,
  maxLength = 8000,
): string {
  const clean = sanitizeText(input, maxLength);
  return clean
    .replace(
      /<\/?(?:untrusted_document|system_instructions|system|assistant|user)>/gi,
      "[tag_removed]",
    )
    .replace(
      /<\|(?:im_start|im_end|system|user|assistant|endoftext)\|>/gi,
      "[token_removed]",
    );
}

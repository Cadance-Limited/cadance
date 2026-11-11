import dns from "node:dns/promises";
import net from "node:net";
/**
 * Application security utilities:
 * - Strict URL parsing & SSRF prevention (IPv4, IPv6, IPv4-mapped IPv6, octal/hex/integer encodings, DNS resolution verification, manual redirect validation, response size & Content-Type enforcement)
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
/**
 * Detects non-standard numeric IP representations such as:
 * - Pure integers (e.g. 2130706433)
 * - Hexadecimal octets (e.g. 0x7f.0.0.1 or 0x7f000001)
 * - Octal octets (e.g. 0177.0.0.1)
 * - Shortened IPv4 forms (e.g. 127.1 or 127.0.1)
 */
function isSuspiciousNumericHost(host) {
    const clean = host.replace(/^\[|\]$/g, "").toLowerCase();
    if (/^(0x[0-9a-f]+|\d+)$/i.test(clean)) {
        return true;
    }
    const parts = clean.split(".");
    if (parts.every((p) => /^(0x[0-9a-f]+|\d+)$/i.test(p))) {
        if (parts.length !== 4)
            return true;
        for (const part of parts) {
            if (part.startsWith("0x"))
                return true;
            if (part.length > 1 && part.startsWith("0"))
                return true; // Octal notation
        }
    }
    return false;
}
/**
 * Checks whether a canonical IPv4 address string falls within any private,
 * loopback, link-local, carrier-grade NAT, multicast, documentation, or reserved CIDR.
 */
export function isPrivateOrReservedIpv4(ip) {
    const parts = ip.split(".");
    if (parts.length !== 4)
        return true;
    const nums = parts.map((p) => Number(p));
    if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255))
        return true;
    const [a, b, c] = nums;
    // 0.0.0.0/8 (Current network)
    if (a === 0)
        return true;
    // 10.0.0.0/8 (Private network)
    if (a === 10)
        return true;
    // 100.64.0.0/10 (Shared Address Space / Carrier-grade NAT)
    if (a === 100 && b >= 64 && b <= 127)
        return true;
    // 127.0.0.0/8 (Loopback)
    if (a === 127)
        return true;
    // 169.254.0.0/16 (Link-local / Cloud instance metadata)
    if (a === 169 && b === 254)
        return true;
    // 172.16.0.0/12 (Private network)
    if (a === 172 && b >= 16 && b <= 31)
        return true;
    // 192.0.0.0/24 (IETF Protocol Assignments)
    if (a === 192 && b === 0 && c === 0)
        return true;
    // 192.0.2.0/24 (TEST-NET-1)
    if (a === 192 && b === 0 && c === 2)
        return true;
    // 192.88.99.0/24 (6to4 Relay Anycast)
    if (a === 192 && b === 88 && c === 99)
        return true;
    // 192.168.0.0/16 (Private network)
    if (a === 192 && b === 168)
        return true;
    // 198.18.0.0/15 (Benchmarking)
    if (a === 198 && (b === 18 || b === 19))
        return true;
    // 198.51.100.0/24 (TEST-NET-2)
    if (a === 198 && b === 51 && c === 100)
        return true;
    // 203.0.113.0/24 (TEST-NET-3)
    if (a === 203 && b === 0 && c === 113)
        return true;
    // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved / Broadcast)
    if (a >= 224)
        return true;
    return false;
}
/**
 * Checks whether an IPv6 address (including IPv4-mapped IPv6 addresses like
 * ::ffff:127.0.0.1 or ::ffff:7f00:0001) is private, loopback, link-local, or reserved.
 */
export function isPrivateOrReservedIpv6(rawIp) {
    const clean = rawIp.replace(/^\[|\]$/g, "").toLowerCase();
    if (clean.includes("%"))
        return true; // Zone index not permitted
    if (clean === "::1" || clean === "::" || clean === "0:0:0:0:0:0:0:1" || clean === "0:0:0:0:0:0:0:0") {
        return true;
    }
    // Dotted-quad IPv4-mapped or IPv4-compatible IPv6 (e.g. ::ffff:127.0.0.1 or ::127.0.0.1)
    const lastColon = clean.lastIndexOf(":");
    if (lastColon !== -1) {
        const tail = clean.slice(lastColon + 1);
        if (tail.includes(".")) {
            return isPrivateOrReservedIpv4(tail);
        }
    }
    // Expand :: into full 8-hextet representation to inspect prefixes and hex-mapped IPv4
    const doubleColonParts = clean.split("::");
    if (doubleColonParts.length > 2)
        return true;
    let groups = [];
    if (doubleColonParts.length === 2) {
        const left = doubleColonParts[0] ? doubleColonParts[0].split(":") : [];
        const right = doubleColonParts[1] ? doubleColonParts[1].split(":") : [];
        const missing = 8 - (left.length + right.length);
        if (missing < 1)
            return true;
        groups = [...left, ...Array(missing).fill("0"), ...right];
    }
    else {
        groups = clean.split(":");
    }
    if (groups.length !== 8)
        return true;
    const nums = groups.map((g) => parseInt(g || "0", 16));
    if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 0xffff))
        return true;
    // Check all-zeros or loopback in expanded form
    const allZeroPrefix = nums.slice(0, 7).every((n) => n === 0);
    if (allZeroPrefix && (nums[7] === 0 || nums[7] === 1))
        return true;
    // Check IPv4-mapped (::ffff:w.x.y.z) or IPv4-compatible (::w.x.y.z) in hex form
    const isIpv4Mapped = nums[0] === 0 &&
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
    // Unique Local fc00::/7 (fc00..fdff)
    if ((first & 0xfe00) === 0xfc00)
        return true;
    // Link-Local fe80::/10 (fe80..febf)
    if ((first & 0xffc0) === 0xfe80)
        return true;
    // Multicast ff00::/8
    if ((first & 0xff00) === 0xff00)
        return true;
    // 2001:db8::/32 (Documentation)
    if (first === 0x2001 && nums[1] === 0x0db8)
        return true;
    // 2001::/32 (Teredo)
    if (first === 0x2001 && nums[1] === 0x0000)
        return true;
    // 2002::/16 (6to4)
    if (first === 0x2002)
        return true;
    return false;
}
export function isReservedOrPrivateIp(ip) {
    const clean = ip.replace(/^\[|\]$/g, "").trim();
    const version = net.isIP(clean);
    if (version === 4) {
        if (isSuspiciousNumericHost(clean))
            return true;
        return isPrivateOrReservedIpv4(clean);
    }
    if (version === 6) {
        return isPrivateOrReservedIpv6(clean);
    }
    return true;
}
/**
 * Synchronous structural validation of a user-supplied URL.
 * Rejects non-HTTP(S) schemes, embedded credentials, non-standard ports,
 * suspicious numeric IP encodings, and private/reserved IP literals or internal hostnames.
 */
export function validateExternalUrl(raw) {
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
    let parsed;
    try {
        parsed = new URL(trimmed);
    }
    catch {
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
    if (BLOCKED_HOSTNAMES.has(host) ||
        host.endsWith(".local") ||
        host.endsWith(".internal") ||
        host.endsWith(".localhost") ||
        host.endsWith(".lan") ||
        host.endsWith(".home") ||
        host.endsWith(".corp")) {
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
        }
        else {
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
    }
    else if (!host.includes(".")) {
        return {
            ok: false,
            error: "Single-label internal hostnames are not allowed.",
        };
    }
    return { ok: true, url: parsed.toString(), hostname: cleanIpCandidate };
}
const defaultDnsLookup = async (hostname) => {
    return dns.lookup(hostname, { all: true, verbatim: true });
};
/**
 * Resolves DNS records for a hostname and verifies that every returned address
 * is a public, routable unicast IP. Prevents DNS-based SSRF to internal networks.
 */
export async function resolveAndValidateHost(hostname, lookupFn = defaultDnsLookup) {
    const clean = hostname.replace(/^\[|\]$/g, "");
    if (net.isIP(clean)) {
        if (isReservedOrPrivateIp(clean)) {
            return {
                ok: false,
                error: "Resolved address is in a private or reserved IP range.",
            };
        }
        return { ok: true, addresses: [clean] };
    }
    let records;
    try {
        records = await lookupFn(clean);
    }
    catch {
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
    const addresses = [];
    for (const rec of records) {
        if (!rec?.address || isReservedOrPrivateIp(rec.address)) {
            return {
                ok: false,
                error: "Domain resolves to a private or reserved network address.",
            };
        }
        addresses.push(rec.address);
    }
    return { ok: true, addresses };
}
/**
 * Controlled outbound HTTP fetcher that enforces:
 * 1. URL structural validation (HTTP/HTTPS, standard ports, no credentials)
 * 2. DNS resolution validation across all A/AAAA records
 * 3. Manual redirect handling (max 3 hops) with full URL + DNS re-validation on every hop
 * 4. Strict response timeout (8s) and streaming response byte limit (512 KB)
 * 5. Content-Type allowlist verification
 */
export async function safeFetchExternalUrl(initialUrl, opts = {}) {
    const maxRedirects = opts.maxRedirects ?? 3;
    const maxBytes = opts.maxBytes ?? 512 * 1024;
    const timeoutMs = opts.timeoutMs ?? 8000;
    const lookupFn = opts.lookupFn ?? defaultDnsLookup;
    const fetchFn = opts.fetchFn ?? fetch;
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
        let response;
        try {
            response = await fetchFn(urlCheck.url, {
                method: "GET",
                redirect: "manual",
                headers: {
                    "User-Agent": "Cadence-Operations-Analyst/1.0",
                    Accept: "text/html,text/plain,application/xhtml+xml,application/xml;q=0.9",
                },
                signal: AbortSignal.timeout(timeoutMs),
            });
        }
        catch {
            return {
                ok: false,
                status: 502,
                error: "Unable to connect to the target URL within the timeout window.",
            };
        }
        // Handle 3xx redirects manually so every redirect target is validated against SSRF rules
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location");
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
            }
            catch {
                return {
                    ok: false,
                    status: 400,
                    error: "Remote server redirected to an invalid URL.",
                };
            }
            continue;
        }
        if (!response.ok) {
            return {
                ok: false,
                status: 502,
                error: `Remote server returned HTTP ${response.status}.`,
            };
        }
        const contentType = (response.headers.get("content-type") ?? "text/plain").toLowerCase();
        const isAllowedType = ALLOWED_CONTENT_TYPES.some((t) => contentType.includes(t));
        if (!isAllowedType) {
            return {
                ok: false,
                status: 415,
                error: "Unsupported content type. Only HTML, XML, or plain-text documents can be analyzed via URL.",
            };
        }
        const contentLength = Number(response.headers.get("content-length") ?? "0");
        if (contentLength > maxBytes) {
            return {
                ok: false,
                status: 413,
                error: `Remote document exceeds the maximum supported size (${Math.round(maxBytes / 1024)} KB).`,
            };
        }
        // Stream body with strict byte cap
        const reader = response.body?.getReader();
        if (!reader) {
            const text = (await response.text()).slice(0, maxBytes);
            const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
            return {
                ok: true,
                finalUrl: urlCheck.url,
                title: titleMatch?.[1]?.trim() ?? null,
                contentType,
                body: text,
            };
        }
        const chunks = [];
        let totalBytes = 0;
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                if (value) {
                    totalBytes += value.byteLength;
                    if (totalBytes > maxBytes) {
                        await reader.cancel();
                        return {
                            ok: false,
                            status: 413,
                            error: `Remote document exceeds the maximum supported size (${Math.round(maxBytes / 1024)} KB).`,
                        };
                    }
                    chunks.push(value);
                }
            }
        }
        finally {
            reader.releaseLock();
        }
        const combined = new Uint8Array(totalBytes);
        let offset = 0;
        for (const chunk of chunks) {
            combined.set(chunk, offset);
            offset += chunk.byteLength;
        }
        const bodyText = new TextDecoder("utf-8", { fatal: false }).decode(combined);
        const titleMatch = bodyText.match(/<title[^>]*>([^<]+)<\/title>/i);
        return {
            ok: true,
            finalUrl: urlCheck.url,
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
/**
 * Sanitizes untrusted user text and neutralizes common prompt-injection boundary markers.
 */
export function sanitizeText(input, maxLength = 8000) {
    if (typeof input !== "string")
        return "";
    return input
        .replace(/\0/g, "")
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
        .trim()
        .slice(0, maxLength);
}
/**
 * Neutralizes prompt-injection control sequences embedded inside untrusted documents
 * before they are wrapped in XML data delimiters for the model.
 */
export function sanitizeUntrustedDocument(input, maxLength = 8000) {
    const clean = sanitizeText(input, maxLength);
    return clean
        .replace(/<\/?(?:untrusted_document|system_instructions|system|assistant|user)>/gi, "[tag_removed]")
        .replace(/<\|(?:im_start|im_end|system|user|assistant|endoftext)\|>/gi, "[token_removed]");
}

import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

const LOCAL_HOST_SUFFIXES = [".local", ".localhost", ".internal", ".home.arpa"];

function bareHostname(value) {
  return String(value || "").toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
}

function normalisedDomain(value) {
  return bareHostname(value).replace(/^www\./, "");
}

function ipv4Octets(address) {
  const octets = String(address).split(".").map(Number);
  return octets.length === 4 && octets.every((item) => Number.isInteger(item) && item >= 0 && item <= 255)
    ? octets
    : null;
}

export function isPublicIpAddress(address) {
  const value = bareHostname(address).split("%")[0];
  const family = isIP(value);
  if (family === 4) {
    const [a, b, c] = ipv4Octets(value);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
    if (a === 192 && b === 88 && c === 99) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    if (a === 198 && b === 51 && c === 100) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    return true;
  }
  if (family === 6) {
    const lower = value.toLowerCase();
    if (lower === "::" || lower === "::1") return false;
    if (/^(?:fc|fd)/.test(lower)) return false;
    if (/^fe[89ab]/.test(lower)) return false;
    if (/^ff/.test(lower)) return false;
    if (/^2001:db8(?::|$)/.test(lower)) return false;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPublicIpAddress(mapped[1]) : true;
  }
  return false;
}

export function publicHttpsUrl(value) {
  try {
    const url = new URL(value);
    const hostname = bareHostname(url.hostname);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (!hostname || hostname === "localhost" || !hostname.includes(".")) return null;
    if (LOCAL_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) return null;
    // Official websites are expected to use DNS names. Rejecting all literal
    // addresses also closes alternate numeric spellings of loopback targets.
    if (isIP(hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

export function hostnameWithinBoundary(candidate, allowed) {
  const candidateHost = normalisedDomain(candidate);
  const allowedHost = normalisedDomain(allowed);
  if (!candidateHost || !allowedHost) return false;
  return candidateHost === allowedHost
    || candidateHost.endsWith(`.${allowedHost}`);
}

export async function assertPublicHttpsUrl(value, options = {}) {
  const url = publicHttpsUrl(value);
  if (!url) throw new Error("network target must be a public HTTPS URL on the default port");

  const allowedRoots = (options.allowedRootUrls || [])
    .map(publicHttpsUrl)
    .filter(Boolean);
  if (allowedRoots.length && !allowedRoots.some((root) => hostnameWithinBoundary(url.hostname, root.hostname))) {
    throw new Error("network target left the verified hostname boundary");
  }

  const lookup = options.lookup || dnsLookup;
  const resolved = await lookup(url.hostname, { all: true, verbatim: true });
  const addresses = (Array.isArray(resolved) ? resolved : [resolved])
    .map((item) => typeof item === "string" ? item : item?.address)
    .filter(Boolean);
  if (!addresses.length || addresses.some((address) => !isPublicIpAddress(address))) {
    throw new Error("network target resolved to a non-public address");
  }
  return url;
}

export async function fetchPublicHttps(value, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const allowedRootUrls = options.allowedRootUrls?.length ? options.allowedRootUrls : [value];
  const maxRedirects = Math.max(0, Number(options.maxRedirects ?? 3));
  const signal = options.signal || AbortSignal.timeout(Number(options.timeoutMs || 10_000));
  let current = await assertPublicHttpsUrl(value, { ...options, allowedRootUrls });

  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    const response = await fetchImpl(current.href, {
      ...(options.requestInit || {}),
      redirect: "manual",
      signal,
    });
    const location = response.headers?.get?.("location");
    if (response.status >= 300 && response.status < 400) {
      if (!location || redirects === maxRedirects) throw new Error("unsafe or excessive redirect chain");
      const next = new URL(location, current);
      current = await assertPublicHttpsUrl(next.href, { ...options, allowedRootUrls });
      continue;
    }
    return { response, url: current.href };
  }
  throw new Error("excessive redirect chain");
}

export async function readBoundedResponse(response, maximumBytes) {
  const limit = Math.max(1, Number(maximumBytes) || 1);
  const declaredLength = Number(response.headers?.get?.("content-length") || 0);
  if (declaredLength > limit) throw new Error("response is too large");
  if (!response.body?.getReader) throw new Error("response body is unavailable");

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  let finished = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        finished = true;
        break;
      }
      total += value.byteLength;
      if (total > limit) throw new Error("response is too large");
      chunks.push(value);
    }
  } finally {
    if (!finished) {
      try {
        await reader.cancel();
      } catch {}
    }
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

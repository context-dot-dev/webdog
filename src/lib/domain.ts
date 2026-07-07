export function parseDomain(input: string): string {
  try {
    return new URL(input).hostname;
  } catch {
    // Caller may have already passed a bare domain like "example.com".
    return input.replace(/^https?:\/\//, "").split("/")[0];
  }
}

export function normalizeDomain(input: string): string | null {
  const raw = parseDomain(input)
    .trim()
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
  if (!raw || !raw.includes(".")) return null;
  if (!/^[a-z0-9.-]+$/.test(raw)) return null;
  return raw;
}

/**
 * True when `url`'s host is `domain` or a subdomain of it (www-insensitive).
 * Used to keep a website's monitors scoped to that website's own domain.
 */
export function isUrlWithinDomain(url: string, domain: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return false;
  }
  const base = domain.trim().toLowerCase().replace(/^www\./, "");
  if (!base) return false;
  return host === base || host.endsWith(`.${base}`);
}

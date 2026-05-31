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

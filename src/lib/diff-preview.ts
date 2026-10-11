/**
 * Lines of `from` not matched by a line in `against`. Counts occurrences, so a
 * second copy of an existing line still shows up as a change.
 */
function unmatchedLines(from: string[], against: string[]): string[] {
  const remaining = new Map<string, number>();
  for (const l of against) remaining.set(l, (remaining.get(l) ?? 0) + 1);
  return from.filter((l) => {
    const n = remaining.get(l) ?? 0;
    if (n === 0) return true;
    remaining.set(l, n - 1);
    return false;
  });
}

/** Line-multiset diff preview for markdown snapshots. */
export function diffPreview(
  before: string,
  after: string,
  ctxLines = 3,
): { preview: string; totalAdded: number; totalRemoved: number } {
  const a = before.split("\n");
  const b = after.split("\n");
  const added = unmatchedLines(b, a);
  const removed = unmatchedLines(a, b);
  const limit = (arr: string[]) =>
    arr.slice(0, ctxLines).map((l) => (l.length > 160 ? l.slice(0, 157) + "…" : l));
  const parts: string[] = [];
  if (added.length) parts.push(`+ ${limit(added).join("\n+ ")}`);
  if (removed.length) parts.push(`- ${limit(removed).join("\n- ")}`);
  return { preview: parts.join("\n"), totalAdded: added.length, totalRemoved: removed.length };
}

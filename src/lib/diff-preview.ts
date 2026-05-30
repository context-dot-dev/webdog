/** Line-set diff preview for markdown snapshots. */
export function diffPreview(
  before: string,
  after: string,
  ctxLines = 3,
): { preview: string; totalAdded: number; totalRemoved: number } {
  const a = before.split("\n");
  const b = after.split("\n");
  const setA = new Set(a);
  const setB = new Set(b);
  const added = b.filter((l) => !setA.has(l));
  const removed = a.filter((l) => !setB.has(l));
  const limit = (arr: string[]) =>
    arr.slice(0, ctxLines).map((l) => (l.length > 160 ? l.slice(0, 157) + "…" : l));
  const parts: string[] = [];
  if (added.length) parts.push(`+ ${limit(added).join("\n+ ")}`);
  if (removed.length) parts.push(`- ${limit(removed).join("\n- ")}`);
  return { preview: parts.join("\n"), totalAdded: added.length, totalRemoved: removed.length };
}

/**
 * Shared diff parsing, pairing, and token-level highlighting for UI and HTML email.
 */

export type DiffLine =
  | { kind: "add"; text: string }
  | { kind: "del"; text: string }
  | { kind: "ctx"; text: string };

export type TokenDiffSeg = { text: string; change: boolean };

export type PreviewRow =
  | { type: "pair"; old: string; new: string }
  | { type: "single"; line: DiffLine };

export function parseDiff(raw: string): DiffLine[] {
  return raw.split("\n").map((line) => {
    if (line.startsWith("+ ") || line === "+") return { kind: "add", text: line.slice(2) };
    if (line.startsWith("- ") || line === "-") return { kind: "del", text: line.slice(2) };
    return { kind: "ctx", text: line };
  });
}

/** Splits a line into words and whitespace (preserves rendering). */
function tokenizeForDiff(s: string): string[] {
  if (!s) return [];
  return s.match(/\S+|\s+/g) ?? [];
}

/**
 * Pairs the k-th add line with the k-th remove line (backend emits all + lines, then all − lines)
 * and marks tokens that differ on each side.
 */
export function buildTokenDiffs(oldText: string, newText: string): { del: TokenDiffSeg[]; add: TokenDiffSeg[] } {
  const a = tokenizeForDiff(oldText);
  const b = tokenizeForDiff(newText);
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  type Step = { kind: "eq" | "del" | "ins"; i: number; j: number };
  const steps: Step[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      steps.push({ kind: "eq", i: i - 1, j: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      steps.push({ kind: "ins", i: -1, j: j - 1 });
      j--;
    } else {
      steps.push({ kind: "del", i: i - 1, j: -1 });
      i--;
    }
  }
  steps.reverse();

  const del: TokenDiffSeg[] = [];
  const add: TokenDiffSeg[] = [];
  for (const s of steps) {
    if (s.kind === "eq") {
      const t = a[s.i];
      del.push({ text: t, change: false });
      add.push({ text: t, change: false });
    } else if (s.kind === "del") {
      del.push({ text: a[s.i], change: true });
    } else {
      add.push({ text: b[s.j], change: true });
    }
  }
  return { del, add };
}

/** Packs adjacent segments with the same change flag to reduce DOM noise. */
export function packSegs(segs: TokenDiffSeg[]): TokenDiffSeg[] {
  const out: TokenDiffSeg[] = [];
  for (const s of segs) {
    const last = out[out.length - 1];
    if (last && last.change === s.change) last.text += s.text;
    else out.push({ text: s.text, change: s.change });
  }
  return out;
}

export function buildPreviewRows(lines: DiffLine[]): PreviewRow[] {
  const adds = lines.filter((l): l is Extract<DiffLine, { kind: "add" }> => l.kind === "add");
  const dels = lines.filter((l): l is Extract<DiffLine, { kind: "del" }> => l.kind === "del");
  const ctx = lines.filter((l) => l.kind === "ctx");
  const k = Math.min(adds.length, dels.length);
  const rows: PreviewRow[] = [];
  for (const l of ctx) rows.push({ type: "single", line: l });
  for (let i = 0; i < k; i++) rows.push({ type: "pair", old: dels[i].text, new: adds[i].text });
  for (let i = k; i < adds.length; i++) rows.push({ type: "single", line: { kind: "add", text: adds[i].text } });
  for (let i = k; i < dels.length; i++) rows.push({ type: "single", line: { kind: "del", text: dels[i].text } });
  return rows;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type TokenDiffHtmlStyles = {
  textStyle: string;
  highlightStyle: string;
};

/** Renders token segments as inline HTML (escaped). */
export function renderTokenDiffHtml(segs: TokenDiffSeg[], styles: TokenDiffHtmlStyles): string {
  const { textStyle, highlightStyle } = styles;
  return segs
    .map((s) => {
      const escaped = escapeHtml(s.text);
      if (!s.change) return `<span style="${textStyle}">${escaped}</span>`;
      return `<span style="${highlightStyle}">${escaped}</span>`;
    })
    .join("");
}

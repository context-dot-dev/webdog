import type { Snapshot, Target } from "./db/schema";
import { parseProductSnapshotPayload, type ProductSnapshotData } from "./product-price-history";
import { diffPreview } from "./diff-preview";

export type { ProductSnapshotData } from "./product-price-history";

export type TargetChangeDetail =
  | { kind: "markdown"; diffPreview: string }
  | { kind: "sitemap"; added: string[]; removed: string[] }
  | { kind: "product"; before: ProductSnapshotData; after: ProductSnapshotData };

export type TargetFetchEntry = {
  id: string;
  /** ms since epoch (serializes cleanly across RSC → client) */
  createdAt: number;
  hashPrefix: string;
  /** Compared to the previous older fetch; null = oldest row in the loaded window (no prior snapshot to compare). */
  changedFromPrevious: boolean | null;
  /** Populated when this row differs from the previous snapshot in time; use for the Show panel. */
  changeDetail: TargetChangeDetail | null;
  /** Set for product-price targets: parsed price for this stored fetch. */
  productRow: { price: number | null; currency: string | null; isProductPage: boolean } | null;
};

function buildChangeDetail(kind: "SITEMAP" | "MARKDOWN" | "PRODUCT", prev: Snapshot, curr: Snapshot): TargetChangeDetail {
  if (kind === "MARKDOWN") {
    return { kind: "markdown", diffPreview: diffPreview(prev.payload, curr.payload).preview };
  }
  if (kind === "SITEMAP") {
    const a = JSON.parse(prev.payload) as string[];
    const b = JSON.parse(curr.payload) as string[];
    const prevSet = new Set(a);
    const currSet = new Set(b);
    return {
      kind: "sitemap",
      added: b.filter((u) => !prevSet.has(u)),
      removed: a.filter((u) => !currSet.has(u)),
    };
  }
  const b = parseProductSnapshotPayload(prev.payload) ?? (JSON.parse(prev.payload) as ProductSnapshotData);
  const a = parseProductSnapshotPayload(curr.payload) ?? (JSON.parse(curr.payload) as ProductSnapshotData);
  return { kind: "product", before: b, after: a };
}

/** The most recently captured content for a target, for the "current version" view. */
export type TargetCurrentContent =
  | { kind: "markdown"; capturedAt: number; markdown: string }
  | { kind: "sitemap"; capturedAt: number; urls: string[] }
  | { kind: "product"; capturedAt: number; product: ProductSnapshotData };

function snapshotsForTarget(target: Target, snapshots: Snapshot[]): Snapshot[] {
  if (target.kind === "SITEMAP_LINKS") {
    return snapshots.filter((s) => s.kind === "SITEMAP" && s.targetUrl == null);
  }
  const url = target.pageUrl;
  if (!url) return [];
  if (target.kind === "PAGE_CONTENT") {
    return snapshots.filter((s) => s.kind === "MARKDOWN" && s.targetUrl === url);
  }
  if (target.kind === "PRODUCT_PRICE") {
    return snapshots.filter((s) => s.kind === "PRODUCT" && s.targetUrl === url);
  }
  return [];
}

/**
 * Newest first. `changedFromPrevious` is from the point of view of time going forward
 * (this fetch vs the one immediately before it); shown for every row except the
 * oldest in the current window, which is the baseline.
 */
/**
 * The latest stored snapshot for a target, decoded into a shape the UI can render
 * directly ("current version"). Returns null when nothing has been captured yet.
 */
export function latestContentForTarget(
  target: Target,
  snapshots: Snapshot[],
): TargetCurrentContent | null {
  const filtered = snapshotsForTarget(target, snapshots);
  if (filtered.length === 0) return null;
  const latest = filtered.reduce((a, b) => (Number(b.createdAt) > Number(a.createdAt) ? b : a));
  const capturedAt = Number(latest.createdAt);

  if (latest.kind === "MARKDOWN") {
    return { kind: "markdown", capturedAt, markdown: latest.payload };
  }
  if (latest.kind === "SITEMAP") {
    let urls: string[] = [];
    try {
      urls = JSON.parse(latest.payload) as string[];
    } catch {
      urls = [];
    }
    return { kind: "sitemap", capturedAt, urls };
  }
  const product =
    parseProductSnapshotPayload(latest.payload) ??
    (JSON.parse(latest.payload) as ProductSnapshotData);
  return { kind: "product", capturedAt, product };
}

export function buildFetchHistoryForTarget(target: Target, snapshots: Snapshot[]): TargetFetchEntry[] {
  const filtered = snapshotsForTarget(target, snapshots);
  if (filtered.length === 0) return [];
  const asc = [...filtered].sort((a, b) => Number(a.createdAt) - Number(b.createdAt));
  const forward: TargetFetchEntry[] = asc.map((s, i) => {
    const prev = i > 0 ? asc[i - 1]! : null;
    const changed = prev ? s.hash !== prev.hash : null;
    const changeDetail =
      prev && changed
        ? buildChangeDetail(s.kind, prev, s)
        : null;
    const p =
      target.kind === "PRODUCT_PRICE" && s.kind === "PRODUCT"
        ? parseProductSnapshotPayload(s.payload)
        : null;
    const productRow = p
      ? { price: p.price, currency: p.currency, isProductPage: p.is_product_page }
      : null;
    return {
      id: s.id,
      createdAt: Number(s.createdAt),
      hashPrefix: s.hash.slice(0, 8),
      changedFromPrevious: changed,
      changeDetail,
      productRow,
    };
  });
  return forward.reverse();
}

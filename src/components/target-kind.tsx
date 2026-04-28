import type { AlertKind, TargetKind } from "@/lib/db/schema";

/** Display badges for monitored targets */
export const TARGET_KIND_LABEL: Record<TargetKind, string> = {
  SITEMAP_LINKS: "Site links",
  PAGE_CONTENT: "Page content changes",
  PRODUCT_PRICE: "Product price changes",
};

export const TARGET_KIND_DESCRIPTION: Record<TargetKind, string> = {
  SITEMAP_LINKS:
    "Alert when URLs are added or removed in the site sitemap (posts, products, removals). Scope is configurable under target details.",
  PAGE_CONTENT: "Alert when a specific page's content changes.",
  PRODUCT_PRICE:
    "Alert when a product page's price or currency changes (uses context.dev). Checks once per 24h by default.",
};

/** Targets and stored alerts overlap on PAGE_* kinds; alerts also use NEW_/REMOVED_LINK for link diffs. */
const BADGE_LABEL: Record<TargetKind | AlertKind, string> = {
  SITEMAP_LINKS: "Site links",
  NEW_LINK: "New links",
  REMOVED_LINK: "Removed links",
  PAGE_CONTENT: "Page content changes",
  PRODUCT_PRICE: "Product price changes",
};

/** Narrow labels for dense inline rows (e.g. alerts list). */
const BADGE_LABEL_COMPACT: Record<TargetKind | AlertKind, string> = {
  SITEMAP_LINKS: "Links",
  NEW_LINK: "New",
  REMOVED_LINK: "Removed",
  PAGE_CONTENT: "Page",
  PRODUCT_PRICE: "Price",
};

const BADGE_TONE: Record<TargetKind | AlertKind, { bg: string; text: string; ring: string }> = {
  SITEMAP_LINKS: { bg: "bg-sky-50", text: "text-sky-800", ring: "ring-sky-600/20" },
  NEW_LINK: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-600/20" },
  REMOVED_LINK: { bg: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-600/20" },
  PAGE_CONTENT: { bg: "bg-violet-50", text: "text-violet-700", ring: "ring-violet-600/20" },
  PRODUCT_PRICE: { bg: "bg-amber-50", text: "text-amber-800", ring: "ring-amber-600/20" },
};

export function KindBadge({
  kind,
  compact,
}: {
  kind: TargetKind | AlertKind;
  /** Shorter label and tighter pill for single-line layouts. */
  compact?: boolean;
}) {
  const tone = BADGE_TONE[kind];
  const label = compact ? BADGE_LABEL_COMPACT[kind] : BADGE_LABEL[kind];
  return (
    <span
      className={`inline-flex max-w-[9rem] shrink-0 truncate rounded-full py-px font-medium ring-1 ring-inset ${compact ? "px-1.5 text-[0.6875rem] leading-tight" : "px-2 py-0.5 text-xs"} ${tone.bg} ${tone.text} ${tone.ring}`}
    >
      {label}
    </span>
  );
}

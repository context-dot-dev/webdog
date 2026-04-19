import type { TargetKind } from "@/lib/db/schema";

export const TARGET_KIND_LABEL: Record<TargetKind, string> = {
  NEW_LINK: "New links",
  REMOVED_LINK: "Removed links",
  PAGE_CONTENT: "Page content changes",
};

export const TARGET_KIND_DESCRIPTION: Record<TargetKind, string> = {
  NEW_LINK: "Alert when the sitemap grows (new posts, new products, etc).",
  REMOVED_LINK: "Alert when a URL disappears from the sitemap.",
  PAGE_CONTENT: "Alert when a specific page's content changes.",
};

const KIND_TONE: Record<TargetKind, { bg: string; text: string; ring: string }> = {
  NEW_LINK: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-600/20" },
  REMOVED_LINK: { bg: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-600/20" },
  PAGE_CONTENT: { bg: "bg-violet-50", text: "text-violet-700", ring: "ring-violet-600/20" },
};

export function KindBadge({ kind }: { kind: TargetKind }) {
  const tone = KIND_TONE[kind];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tone.bg} ${tone.text} ${tone.ring}`}
    >
      {TARGET_KIND_LABEL[kind]}
    </span>
  );
}

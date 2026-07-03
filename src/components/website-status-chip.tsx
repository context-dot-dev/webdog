import { RelativeTime } from "./relative-time";

/** Site-level status summary shown in the website header. */
export function WebsiteStatusChip({
  lastRunAt,
  unreadCount,
}: {
  lastRunAt: number | null;
  unreadCount: number;
}) {
  if (!lastRunAt) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 font-medium text-neutral-600">
        <span className="size-1.5 rounded-full bg-neutral-400" aria-hidden />
        No checks yet
      </span>
    );
  }
  const clean = unreadCount === 0;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ring-1 ring-inset ${
        clean
          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
          : "bg-amber-50 text-amber-800 ring-amber-600/20"
      }`}
    >
      <span className={`size-1.5 rounded-full ${clean ? "bg-emerald-500" : "bg-amber-500"}`} aria-hidden />
      {clean ? "All clear" : `${unreadCount} unread change${unreadCount === 1 ? "" : "s"}`}
      <span className="font-normal opacity-70">
        · checked <RelativeTime date={new Date(lastRunAt)} />
      </span>
    </span>
  );
}

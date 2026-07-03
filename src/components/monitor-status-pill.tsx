import { RelativeTime } from "./relative-time";

/** Live status for a single monitor: waiting / changed / up to date. */
export function MonitorStatusPill({
  hasRun,
  latestChangeAt,
}: {
  hasRun: boolean;
  latestChangeAt: number | null;
}) {
  if (!hasRun) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">
        <span className="size-1.5 rounded-full bg-neutral-400" aria-hidden />
        Waiting for first check
      </span>
    );
  }
  if (latestChangeAt) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-600/20 ring-inset">
        <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
        Changed <RelativeTime date={new Date(latestChangeAt)} />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20 ring-inset">
      <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
      Up to date
    </span>
  );
}

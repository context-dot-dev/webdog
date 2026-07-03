"use client";

import { useState } from "react";
import type { TargetKind } from "@/lib/db/schema";
import type { TargetCurrentContent as TargetCurrentContentData } from "@/lib/target-fetch-history";
import { RelativeTime } from "./relative-time";
import { KindBadge } from "./target-kind";
import { TargetCurrentContent } from "./target-current-content";
import { ChevronIcon } from "./chevron-icon";

export type LastCheckItem = {
  id: string;
  kind: TargetKind;
  title: string;
  content: TargetCurrentContentData | null;
};

export function LastCheckPanel({
  lastRunAt,
  targetsInLastRun,
  enabledTargetCount,
  alertsInLastRun,
  items,
}: {
  lastRunAt: number | null;
  targetsInLastRun: number;
  enabledTargetCount: number;
  alertsInLastRun: number;
  items: LastCheckItem[];
}) {
  const [open, setOpen] = useState(false);
  const hasContent = items.some((i) => i.content !== null);

  if (!lastRunAt) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 ring-1 ring-neutral-950/5">
        <span className="inline-flex size-2 rounded-full bg-neutral-300" aria-hidden />
        <div className="text-sm text-neutral-600">
          No checks have run yet.{" "}
          {enabledTargetCount === 0
            ? "Add a target to start watching."
            : "The worker will run shortly, or use Run now."}
        </div>
      </div>
    );
  }

  const clean = alertsInLastRun === 0;
  const dotClass = clean ? "bg-emerald-500" : "bg-amber-500";
  const resultLabel = clean
    ? "All clear — no changes detected"
    : `${alertsInLastRun} change${alertsInLastRun === 1 ? "" : "s"} detected`;
  const resultClass = clean ? "text-emerald-700" : "text-amber-700";

  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-950/5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className={`inline-flex size-2 rounded-full ${dotClass}`} aria-hidden />
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Last check
            </div>
            <div className="mt-0.5 text-sm text-neutral-900">
              <RelativeTime date={new Date(lastRunAt)} />
              <span className="ml-2 text-neutral-500">
                · {targetsInLastRun} of {enabledTargetCount} target
                {enabledTargetCount === 1 ? "" : "s"} checked
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`text-sm font-medium ${resultClass}`}>{resultLabel}</div>
          {hasContent && (
            <button
              type="button"
              className="btn-ghost inline-flex items-center gap-1.5 px-2 py-1.5 text-xs"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open ? "true" : "false"}
            >
              {open ? "Hide content" : "View content"}
              <ChevronIcon open={open} />
            </button>
          )}
        </div>
      </div>

      {open && hasContent && (
        <div className="space-y-4 border-t border-neutral-950/5 bg-neutral-50/50 px-5 py-4 sm:px-6">
          <p className="text-xs text-neutral-500">
            The latest content context.dev captured for each target — this is what future checks are compared against.
          </p>
          {items.map((item) => (
            <div key={item.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <KindBadge kind={item.kind} compact />
                <span className="min-w-0 truncate font-mono text-xs text-neutral-600" title={item.title}>
                  {item.title}
                </span>
              </div>
              <TargetCurrentContent content={item.content} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

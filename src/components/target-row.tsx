"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Target } from "@/lib/db/schema";
import { KindBadge } from "./target-kind";
import { RelativeTime } from "./relative-time";

export function TargetRow({ target }: { target: Target }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(target.enabled);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const next = !enabled;
    const res = await fetch(`/api/targets/${target.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    setBusy(false);
    if (res.ok) setEnabled(next);
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this target?")) return;
    setBusy(true);
    const res = await fetch(`/api/targets/${target.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <li className="flex items-center gap-4 px-5 py-4">
      <KindBadge kind={target.kind} />
      <div className="min-w-0 flex-1">
        {target.pageUrl ? (
          <div className="truncate font-mono text-xs text-neutral-600">{target.pageUrl}</div>
        ) : (
          <div className="text-xs text-neutral-500">across the entire site</div>
        )}
        <div className="mt-0.5 text-xs text-neutral-500">
          {target.lastCheckedAt ? (
            <>Last checked <RelativeTime date={new Date(Number(target.lastCheckedAt))} /></>
          ) : (
            <>Waiting for first check</>
          )}
        </div>
      </div>
      <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-neutral-600">
        <span className="sr-only">Enabled</span>
        <span
          className={`group relative inline-flex w-9 shrink-0 rounded-full p-0.5 ring-1 ring-inset transition-colors ${
            enabled ? "bg-brand-500 ring-brand-500" : "bg-neutral-200 ring-neutral-950/5"
          } ${busy ? "opacity-60" : ""}`}
        >
          <span
            className={`aspect-square w-1/2 rounded-full bg-white shadow-xs ring-1 ring-neutral-950/5 transition-transform ${
              enabled ? "translate-x-full" : ""
            }`}
          />
          <input
            type="checkbox"
            className="absolute inset-0 size-full appearance-none focus:outline-none"
            checked={enabled}
            disabled={busy}
            onChange={toggle}
            aria-label={enabled ? "Disable target" : "Enable target"}
          />
        </span>
        <span>{enabled ? "On" : "Off"}</span>
      </label>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="btn-ghost text-xs px-2 py-1"
        aria-label="Delete target"
      >
        Delete
      </button>
    </li>
  );
}

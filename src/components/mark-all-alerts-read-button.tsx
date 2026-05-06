"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MarkAllAlertsReadButton({
  websiteId,
  unreadCount,
}: {
  /** When set, only alerts for this website are marked read. */
  websiteId?: string;
  unreadCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (unreadCount <= 0) return null;

  async function markAll() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/alerts/mark-all-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(websiteId ? { websiteId } : {}),
    });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not update alerts");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      {error && <span className="max-w-[16rem] text-right text-xs text-red-600">{error}</span>}
      <button
        type="button"
        onClick={markAll}
        disabled={busy}
        className="btn-secondary whitespace-nowrap px-3 py-1.5 text-xs sm:text-sm"
      >
        {busy ? "Updating…" : "Mark all as read"}
      </button>
    </div>
  );
}

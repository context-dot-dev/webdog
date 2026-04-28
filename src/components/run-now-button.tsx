"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunNowButton({ websiteId, targetId }: { websiteId: string; targetId?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/cron/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(targetId ? { websiteId, targetId } : { websiteId }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Run failed");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-xs text-brand-700">{error}</span>}
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="btn-secondary text-xs px-2 py-1.5"
        aria-label={targetId ? "Check this target now" : "Check all enabled targets now"}
      >
        {busy ? (
          <>
            <Spinner className="size-3" /> Checking…
          </>
        ) : (
          <>
            <RefreshIcon className="size-3" /> Check now
          </>
        )}
      </button>
    </div>
  );
}

function RefreshIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M13.5 4.5A6 6 0 1 0 14 9.5" strokeLinecap="round" />
      <path d="M14 2.5v3h-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`animate-spin ${className}`} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="8" cy="8" r="6" strokeOpacity="0.25" />
      <path d="M14 8a6 6 0 0 0-6-6" strokeLinecap="round" />
    </svg>
  );
}

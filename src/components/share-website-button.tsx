"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function ShareWebsiteButton({
  websiteId,
  initialShareToken,
}: {
  websiteId: string;
  initialShareToken: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(initialShareToken);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const shareUrl = token ? `${origin}/share/${token}` : "";
  const isPublic = Boolean(token);

  async function enable() {
    setBusy(true);
    const res = await fetch(`/api/websites/${websiteId}/share`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as { publicShareToken?: string };
    setBusy(false);
    if (res.ok && data.publicShareToken) {
      setToken(data.publicShareToken);
      router.refresh();
    }
  }

  async function disable() {
    if (!confirm("Disable the public link? Anyone with the current link will lose access.")) return;
    setBusy(true);
    const res = await fetch(`/api/websites/${websiteId}/share`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      setToken(null);
      router.refresh();
    }
  }

  function copy() {
    if (!shareUrl) return;
    void navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="relative" ref={popRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`btn-ghost inline-flex items-center gap-1.5 px-2 py-1.5 text-xs ${
          isPublic ? "text-brand-700" : ""
        }`}
        aria-expanded={open ? "true" : "false"}
      >
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <circle cx="12" cy="3.5" r="1.75" />
          <circle cx="4" cy="8" r="1.75" />
          <circle cx="12" cy="12.5" r="1.75" />
          <path d="M5.5 7L10.5 4.3M5.5 9L10.5 11.7" strokeLinecap="round" />
        </svg>
        {isPublic ? "Shared" : "Share"}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl bg-white p-4 shadow-lg ring-1 ring-neutral-950/10">
          <div className="text-sm font-medium text-neutral-900">Public share link</div>
          <p className="mt-1 text-xs text-neutral-500">
            Anyone with this link can view this site&rsquo;s monitors, changes, and captured content — read only. No
            account needed. Settings and controls stay private to you.
          </p>

          {isPublic ? (
            <>
              <div className="mt-3 flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-lg border border-neutral-950/10 bg-neutral-50 px-2.5 py-1.5 font-mono text-xs text-neutral-700"
                />
                <button type="button" onClick={copy} className="btn-secondary box-border h-8 shrink-0 !px-2.5 !py-0 text-xs">
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-xs text-brand-700 hover:underline"
                >
                  Open link ↗
                </a>
                <button
                  type="button"
                  onClick={() => void disable()}
                  disabled={busy}
                  className="btn-ghost px-2 py-1 text-xs text-rose-700 hover:text-rose-800"
                >
                  {busy ? "…" : "Disable link"}
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void enable()}
              disabled={busy}
              className="btn-primary mt-3 box-border h-9 w-full !py-0 text-xs"
            >
              {busy ? "Creating…" : "Create public link"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

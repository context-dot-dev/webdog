"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

export function ContextDevSettings({
  initialContextDevApiKey,
}: {
  initialContextDevApiKey: string | null;
}) {
  const router = useRouter();
  const id = useId();
  const [key, setKey] = useState(() => initialContextDevApiKey ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  async function onSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/user/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contextDevApiKey: key.trim() === "" ? null : key.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      setSavedFlash(true);
      router.refresh();
      window.setTimeout(() => setSavedFlash(false), 3000);
    } catch {
      setError("Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6">
      <h2 className="text-sm font-medium text-neutral-900">context.dev</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Used to scrape sitemaps, page content, and brand data.{" "}
        <a
          href="https://context.dev"
          target="_blank"
          rel="noreferrer noopener"
          className="text-brand-700 underline decoration-brand-500/30 underline-offset-2 hover:decoration-brand-500"
        >
          Get an API key
        </a>{" "}
        — or set <code className="kbd">CONTEXT_DEV_API_KEY</code> on the server to apply to all users without storing a key here.
      </p>
      <div className="mt-3 overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-950/5">
        <div className="p-5">
          <div className="space-y-2">
            <label htmlFor={id} className="text-sm font-medium text-neutral-900">
              API key
            </label>
            <p className="text-xs text-neutral-500">Bearer token. Stored in your database (self‑hosted only).</p>
            <div className="flex min-w-0 items-stretch gap-2">
              <input
                id={id}
                name="contextDevApiKey"
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                autoComplete="off"
                placeholder="brand_…"
                className="input box-border h-9 min-h-0 min-w-0 flex-1 !py-0 font-mono text-xs leading-9"
              />
              <div className="flex h-9 min-h-9 shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => void onSave()}
                  disabled={saving}
                  className="btn-primary box-border h-9 min-h-9 !max-h-9 !min-h-9 !px-3 !py-0 whitespace-nowrap"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                {savedFlash && (
                  <span className="text-xs text-brand-700" role="status">
                    Saved
                  </span>
                )}
              </div>
            </div>
            {error && (
              <p className="text-xs text-red-600" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

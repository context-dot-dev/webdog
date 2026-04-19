"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TargetKind } from "@/lib/db/schema";
import { TARGET_KIND_DESCRIPTION, TARGET_KIND_LABEL } from "./target-kind";

const kinds: TargetKind[] = ["NEW_LINK", "REMOVED_LINK", "PAGE_CONTENT"];

export function AddTargetDialog({ websiteId }: { websiteId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<TargetKind>("NEW_LINK");
  const [pageUrl, setPageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/websites/${websiteId}/targets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, pageUrl: kind === "PAGE_CONTENT" ? pageUrl : undefined }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong");
      return;
    }
    setOpen(false);
    setKind("NEW_LINK");
    setPageUrl("");
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-accent">
        <PlusIcon className="size-4" /> Add target
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Add target" className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-neutral-950/40"
          />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <form
              onSubmit={onSubmit}
              className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl ring-1 ring-neutral-950/5"
            >
              <h2 className="text-base font-semibold text-neutral-900">Add a target</h2>
              <p className="mt-1 text-sm text-neutral-600">Pick what you want this website watched for.</p>

              <fieldset className="mt-6 space-y-2">
                <legend className="sr-only">Target type</legend>
                {kinds.map((k) => (
                  <label
                    key={k}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl p-4 ring-1 transition ${
                      kind === k ? "bg-brand-50 ring-brand-500/30" : "bg-white ring-neutral-950/10 hover:bg-neutral-50"
                    }`}
                  >
                    <span className="flex h-lh items-center">
                      <span className="group inline-grid size-4 grid-cols-1">
                        <input
                          type="radio"
                          name="kind"
                          value={k}
                          checked={kind === k}
                          onChange={() => setKind(k)}
                          className="checked:border-brand-500 checked:bg-brand-500 focus-visible:outline-brand-500 col-start-1 row-start-1 appearance-none rounded-full border border-neutral-300 bg-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:border-neutral-300 disabled:bg-neutral-100 disabled:checked:bg-neutral-100 forced-colors:appearance-auto"
                        />
                        <span className="pointer-events-none col-start-1 row-start-1 size-[round(down,40%,1px)] self-center justify-self-center rounded-full bg-white group-not-has-checked:opacity-0" />
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-neutral-900">{TARGET_KIND_LABEL[k]}</span>
                      <span className="mt-0.5 block text-sm text-neutral-600">{TARGET_KIND_DESCRIPTION[k]}</span>
                    </span>
                  </label>
                ))}
              </fieldset>

              {kind === "PAGE_CONTENT" && (
                <div className="mt-5">
                  <label htmlFor="page-url" className="block text-sm font-medium text-neutral-900">
                    Page URL
                  </label>
                  <input
                    id="page-url"
                    name="pageUrl"
                    type="url"
                    className="input mt-1.5 font-mono"
                    placeholder="https://example.com/pricing"
                    required
                    value={pageUrl}
                    onChange={(e) => setPageUrl(e.target.value)}
                  />
                </div>
              )}

              {error && (
                <p className="mt-4 text-sm text-brand-700" role="alert">
                  {error}
                </p>
              )}

              <div className="mt-6 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn-accent">
                  {loading ? "Adding…" : "Add target"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M8 3v10M3 8h10" strokeLinecap="round" />
    </svg>
  );
}

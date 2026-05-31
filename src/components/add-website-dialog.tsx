"use client";

import { useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { normalizeDomain } from "@/lib/domain";
import {
  buildInitialPageUrl,
  parseWebsiteUrlInput,
} from "@/lib/website-url-input";

export function AddWebsiteDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [domain, setDomain] = useState("");
  const [pagePath, setPagePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyParsedInput(raw: string) {
    const { domainHost, pagePath: path } = parseWebsiteUrlInput(raw);
    setDomain(domainHost);
    setPagePath(domainHost ? path : null);
  }

  function reset() {
    setDomain("");
    setPagePath(null);
    setError(null);
    setLoading(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const normalized = normalizeDomain(domain);
    if (!normalized) {
      setError("Enter a valid domain like example.com");
      return;
    }

    setLoading(true);
    const body: { domain: string; initialPagePath?: string } = { domain: normalized };
    if (pagePath) body.initialPagePath = pagePath;

    const res = await fetch("/api/websites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!res.ok) {
      const bodyJson = await res.json().catch(() => ({}));
      setError(bodyJson.error ?? "Something went wrong");
      return;
    }
    const { website } = await res.json();
    setOpen(false);
    reset();
    router.push(`/dashboard/websites/${website.id}`);
    router.refresh();
  }

  const pagePreview =
    pagePath && domain.trim()
      ? (() => {
          try {
            const norm = normalizeDomain(domain);
            if (!norm) return null;
            return buildInitialPageUrl(norm, pagePath);
          } catch {
            return null;
          }
        })()
      : null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-accent h-8 !py-0">
        <PlusIcon className="size-4" /> Add website
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Add website" className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close"
            onClick={() => {
              setOpen(false);
              reset();
            }}
            className="absolute inset-0 bg-neutral-950/40"
          />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <form
              onSubmit={onSubmit}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-neutral-950/5"
            >
              <h2 className="text-base font-semibold text-neutral-900">Add a website to watch</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Enter a domain and we&apos;ll pull in its brand, logo, and description automatically.
              </p>
              <div className="mt-6">
                <label htmlFor="w-domain" className="block text-sm font-medium text-neutral-900">
                  Domain or page URL
                </label>
                <div className="relative mt-1.5">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-xs text-neutral-400"
                  >
                    https://
                  </span>
                  <input
                    id="w-domain"
                    name="domain"
                    className="input pl-[4.25rem] font-mono"
                    placeholder="anthropic.com"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    value={domain}
                    onChange={(e) => applyParsedInput(e.target.value)}
                    onPaste={(e) => {
                      const raw = e.clipboardData.getData("text/plain");
                      const parsed = parseWebsiteUrlInput(raw);
                      if (parsed.domainHost === raw.trim() && !parsed.pagePath) return;
                      e.preventDefault();
                      const el = e.currentTarget;
                      const start = el.selectionStart ?? 0;
                      const end = el.selectionEnd ?? start;
                      const merged = `${domain.slice(0, start)}${raw}${domain.slice(end)}`;
                      applyParsedInput(merged);
                      requestAnimationFrame(() => {
                        const pos = parsed.domainHost.length;
                        el.setSelectionRange(pos, pos);
                      });
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-neutral-500">
                  Paste a domain or a full page link. Domains use the sitemap for link changes; page links also get a
                  content monitor for that URL.
                </p>
                {pagePreview && (
                  <p className="mt-2 text-xs text-neutral-700">
                    We&apos;ll also watch{" "}
                    <span className="font-mono text-neutral-900">{pagePreview}</span> for content changes.
                  </p>
                )}
              </div>
              {error && (
                <p className="mt-4 text-sm text-brand-700" role="alert">
                  {error}
                </p>
              )}
              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    reset();
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" disabled={loading || !domain.trim()} className="btn-accent">
                  {loading ? "Fetching brand…" : "Add website"}
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

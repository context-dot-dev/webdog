"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeDomain } from "@/lib/domain";
import { parseWebsiteUrlInput } from "@/lib/website-url-input";
import type { StarterTemplateWithLogo } from "@/lib/starter-templates";

export function StarterTemplates({ templates }: { templates: StarterTemplateWithLogo[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function add(t: StarterTemplateWithLogo) {
    if (pending) return;
    setError(null);
    setPending(t.url);

    const { domainHost, pagePath } = parseWebsiteUrlInput(t.url);
    const domain = normalizeDomain(domainHost);
    if (!domain) {
      setPending(null);
      setError("Could not parse that template. Try adding it manually.");
      return;
    }

    const body: { domain: string; initialPagePath?: string } = { domain };
    if (pagePath) body.initialPagePath = pagePath;

    const res = await fetch("/api/websites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setPending(null);
      setError(json.error ?? "Something went wrong. Try again.");
      return;
    }
    const { website } = await res.json();
    router.push(`/dashboard/websites/${website.id}`);
    router.refresh();
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-neutral-950/5" />
        <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-neutral-400">
          Popular sites to watch
        </span>
        <div className="h-px flex-1 bg-neutral-950/5" />
      </div>

      <ul role="list" className="mt-4 grid grid-cols-1 gap-2 text-left sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => {
          const isPending = pending === t.url;
          return (
            <li key={t.url}>
              <button
                type="button"
                onClick={() => void add(t)}
                disabled={Boolean(pending)}
                title={t.blurb}
                className="group flex w-full items-center gap-3 rounded-xl bg-white p-2.5 text-left ring-1 ring-neutral-950/5 transition hover:bg-cream-50 hover:ring-neutral-950/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <TemplateLogo logoUrl={t.logoUrl} name={t.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">{t.name}</p>
                  <p className="truncate font-mono text-xs text-neutral-500">{t.domain}</p>
                </div>
                <span className="shrink-0 text-neutral-300 transition group-hover:text-brand-600" aria-hidden>
                  {isPending ? <Spinner className="size-4 text-brand-600" /> : <PlusIcon className="size-4" />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="mt-3 text-center text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function TemplateLogo({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-xs ring-1 ring-neutral-900/10">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="size-6 object-contain" loading="lazy" />
      ) : (
        <span className="font-mono text-sm font-semibold text-brand-700">{name[0]}</span>
      )}
    </span>
  );
}

function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M8 3v10M3 8h10" strokeLinecap="round" />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`animate-spin ${className ?? ""}`} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

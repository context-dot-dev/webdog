"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StarterTemplateWithLogo } from "@/lib/starter-templates";

export function WatchInput({ templates }: { templates: StarterTemplateWithLogo[] }) {
  const [value, setValue] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    router.push(`/sign-up${trimmed ? `?from=${encodeURIComponent(trimmed)}` : ""}`);
  }

  return (
    <div className="mt-8 w-full">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 rounded-2xl bg-white p-1.5 shadow-[0_2px_20px_rgba(10,10,18,0.09)] ring-1 ring-neutral-900/8"
      >
        <span className="pl-2 text-neutral-400">
          <GlobeIcon className="size-5" />
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste a URL to start watching..."
          className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
        />
        <button
          type="submit"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 active:scale-[0.98]"
        >
          <EyeIcon className="size-4" />
          Watch it
        </button>
      </form>

      {/* Text pill shortcuts — left-aligned to match the rest of the column */}
      {templates.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-neutral-400">Try watching:</span>
          {templates.slice(0, 4).map((t) => (
            <button
              key={t.url}
              type="button"
              onClick={() => setValue(t.url)}
              className="rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-neutral-600 ring-1 ring-neutral-900/10 transition hover:bg-neutral-50 hover:text-neutral-900"
            >
              {t.domain}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GlobeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="10" cy="10" r="7.5" />
      <path
        d="M10 2.5c0 0-2.5 2.5-2.5 7.5s2.5 7.5 2.5 7.5M10 2.5c0 0 2.5 2.5 2.5 7.5s-2.5 7.5-2.5 7.5M2.5 10h15"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EyeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

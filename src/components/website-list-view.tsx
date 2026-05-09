"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AddWebsiteDialog } from "@/components/add-website-dialog";
import { RelativeTime } from "@/components/relative-time";
import { APP_NAME } from "@/lib/product-info";

type Website = {
  id: string;
  name: string;
  url: string;
  domain: string;
  title: string | null;
  description: string | null;
  logoUrl: string | null;
  heroScreenshotUrl: string | null;
  backdropUrl: string | null;
  createdAt: Date;
  targetCount: number;
  unreadAlerts: number;
  lastCheckedAt: number | null;
};

type ViewMode = "grid" | "list";

const VIEW_PREF_KEY = `${APP_NAME}:dashboard-view`;

function WebsiteLogoAvatar({
  logoUrl,
  fallbackLetter,
  className = "",
  compact = false,
}: {
  logoUrl: string | null;
  fallbackLetter: string;
  className?: string;
  /** List rows: original 36×36 footprint with the same card styling as grid. */
  compact?: boolean;
}) {
  const frame = compact
    ? "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-xs ring-1 ring-neutral-900/10"
    : "flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-xs ring-1 ring-neutral-900/10";

  return (
    <div className={`${frame} ${className}`}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className={
            compact
              ? "size-7 rounded-[calc(theme(borderRadius.xl)-(theme(spacing.9)-theme(spacing.7))/2)] object-contain"
              : "size-11 rounded-[calc(theme(borderRadius.xl)-(theme(spacing.14)-theme(spacing.11))/2)] object-contain"
          }
          loading="lazy"
        />
      ) : (
        <span
          className={`font-mono font-semibold text-brand-700 ${compact ? "text-sm" : "text-lg"}`}
        >
          {fallbackLetter}
        </span>
      )}
    </div>
  );
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden>
      <rect x="1" y="1" width="6" height="6" rx="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={className} aria-hidden>
      <path d="M5 4h8M5 8h8M5 12h8" />
      <circle cx="2" cy="4" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="2" cy="8" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="2" cy="12" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function WebsiteListView({ websites }: { websites: Website[] }) {
  const [view, setView] = useState<ViewMode>("grid");

  useEffect(() => {
    const saved = localStorage.getItem(VIEW_PREF_KEY) as ViewMode | null;
    if (saved === "list" || saved === "grid") setView(saved);
  }, []);

  function switchView(v: ViewMode) {
    setView(v);
    localStorage.setItem(VIEW_PREF_KEY, v);
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Websites</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Every site you&apos;re watching. Add a new one to start tracking changes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div
            role="group"
            aria-label="View mode"
            className="flex rounded-full ring-1 ring-neutral-900/10 overflow-hidden bg-white p-0.5"
          >
            <button
              type="button"
              onClick={() => switchView("grid")}
              aria-pressed={view === "grid"}
              aria-label="Grid view"
              className={`flex h-8 min-w-8 items-center justify-center rounded-full px-3 text-sm transition ${
                view === "grid"
                  ? "bg-neutral-900 text-cream-100"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              <GridIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => switchView("list")}
              aria-pressed={view === "list"}
              aria-label="List view"
              className={`flex h-8 min-w-8 items-center justify-center rounded-full px-3 text-sm transition ${
                view === "list"
                  ? "bg-neutral-900 text-cream-100"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              <ListIcon className="size-4" />
            </button>
          </div>

          <AddWebsiteDialog />
        </div>
      </header>

      <section className="mt-8">
        {websites.length === 0 ? (
          <EmptyState />
        ) : view === "grid" ? (
          <GridView websites={websites} />
        ) : (
          <ListView websites={websites} />
        )}
      </section>
    </>
  );
}

function GridView({ websites }: { websites: Website[] }) {
  return (
    <ul role="list" className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {websites.map((w) => (
        <li key={w.id}>
          <Link
            href={`/dashboard/websites/${w.id}`}
            className="group flex h-full flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-neutral-900/5 transition hover:-translate-y-0.5 hover:shadow-soft hover:ring-neutral-900/10"
          >
            <div className="relative z-0 h-28 overflow-hidden bg-neutral-100">
              {w.heroScreenshotUrl || w.backdropUrl ? (
                <div className="absolute inset-0 z-0">
                  <div className="size-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={w.heroScreenshotUrl ?? w.backdropUrl ?? ""}
                      alt=""
                      className="block size-full object-cover object-top transition duration-500 group-hover:scale-[1.02]"
                      loading="lazy"
                    />
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 z-0 bg-gradient-to-br from-brand-100 via-brand-50 to-white" />
              )}
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[42%] bg-[linear-gradient(to_top,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.88)_12%,rgba(255,255,255,0.55)_38%,rgba(255,255,255,0.22)_68%,transparent_100%)]"
                aria-hidden
              />
              {Number(w.unreadAlerts) > 0 && (
                <span className="absolute right-3 top-3 z-20 inline-flex items-center rounded-full bg-brand-500 px-2 py-0.5 text-xs font-medium text-white shadow-xs ring-1 ring-brand-600/20">
                  {Number(w.unreadAlerts)} new
                </span>
              )}
            </div>

            <div className="relative z-10 flex flex-1 flex-col px-5 pb-5">
              <WebsiteLogoAvatar
                logoUrl={w.logoUrl}
                fallbackLetter={w.domain[0]?.toUpperCase() ?? "W"}
                className="-mt-7"
              />

              <div className="mt-3 min-w-0">
                <h2 className="truncate text-sm font-semibold text-neutral-900">
                  {w.title ?? w.name}
                </h2>
                <div className="mt-0.5 truncate font-mono text-xs text-neutral-500">
                  {w.domain}
                </div>
              </div>

              <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm text-neutral-600">
                {w.description ?? "No description available yet."}
              </p>

              <dl className="mt-4 flex items-center justify-between border-t border-neutral-950/5 pt-3">
                <Stat label="Targets" value={String(w.targetCount ?? 0)} />
                <Stat
                  align="right"
                  label="Last check"
                  value={
                    w.lastCheckedAt ? (
                      <RelativeTime date={new Date(Number(w.lastCheckedAt))} />
                    ) : (
                      "never"
                    )
                  }
                />
              </dl>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ListView({ websites }: { websites: Website[] }) {
  return (
    <ul
      role="list"
      className="divide-y divide-neutral-900/5 overflow-hidden rounded-3xl bg-white ring-1 ring-neutral-900/5"
    >
      {websites.map((w) => (
        <li key={w.id}>
          <Link
            href={`/dashboard/websites/${w.id}`}
            className="group flex items-center gap-4 px-5 py-3.5 transition hover:bg-cream-50"
          >
            <WebsiteLogoAvatar
              logoUrl={w.logoUrl}
              fallbackLetter={w.domain[0]?.toUpperCase() ?? "W"}
              compact
            />

            {/* Name + domain */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-900">
                {w.title ?? w.name}
              </p>
              <p className="truncate font-mono text-xs text-neutral-500">{w.domain}</p>
            </div>

            {/* Stats */}
            <dl className="hidden items-center gap-8 sm:flex">
              <div className="flex flex-col text-right">
                <dt className="text-xs text-neutral-500">Targets</dt>
                <dd className="tabular-nums text-sm font-medium text-neutral-900">
                  {w.targetCount ?? 0}
                </dd>
              </div>
              <div className="w-24 flex-col text-right hidden md:flex">
                <dt className="text-xs text-neutral-500">Last check</dt>
                <dd className="tabular-nums text-sm font-medium text-neutral-900">
                  {w.lastCheckedAt ? (
                    <RelativeTime date={new Date(Number(w.lastCheckedAt))} />
                  ) : (
                    "never"
                  )}
                </dd>
              </div>
            </dl>

            {/* Unread badge */}
            <div className="flex w-16 justify-end">
              {Number(w.unreadAlerts) > 0 ? (
                <span className="inline-flex items-center rounded-full bg-peach px-2.5 py-0.5 text-xs font-semibold text-neutral-900 ring-1 ring-neutral-900/5">
                  {Number(w.unreadAlerts)} new
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-mint/60 px-2.5 py-0.5 text-xs font-medium text-neutral-700 ring-1 ring-neutral-900/5">
                  all clear
                </span>
              )}
            </div>

            {/* Chevron */}
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4 shrink-0 text-neutral-400 transition group-hover:text-neutral-600"
              aria-hidden
            >
              <path d="M6 3l5 5-5 5" />
            </svg>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Stat({
  label,
  value,
  align = "left",
}: {
  label: string;
  value: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <div className={`flex flex-col ${align === "right" ? "text-right" : "text-left"}`}>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="tabular-nums text-sm font-medium text-neutral-900">{value}</dd>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl bg-white px-6 py-20 text-center ring-1 ring-neutral-900/5">
      <div className="grid size-16 place-items-center rounded-3xl bg-peach text-3xl ring-1 ring-neutral-900/5">
        🌱
      </div>
      <h2 className="mt-5 text-lg font-semibold text-neutral-900">No websites yet</h2>
      <p className="mt-2 max-w-[40ch] text-pretty text-sm text-neutral-600">
        Add a website to start watching for new links, removed links, or content changes.
      </p>
      <div className="mt-6">
        <AddWebsiteDialog />
      </div>
    </div>
  );
}

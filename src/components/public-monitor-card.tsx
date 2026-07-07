"use client";

import { useState } from "react";
import type { Target } from "@/lib/db/schema";
import type { TargetCurrentContent as TargetCurrentContentData } from "@/lib/target-fetch-history";
import type { ProductPricePoint } from "@/lib/product-price-history";
import { KindBadge } from "./target-kind";
import { MonitorStatusPill } from "./monitor-status-pill";
import { ChevronIcon } from "./chevron-icon";
import { AlertItem } from "./alert-item";
import { TargetCurrentContent } from "./target-current-content";
import { ProductPriceHistoryPanel } from "./product-price-history-panel";
import type { MonitorAlert } from "./monitor-card";

function targetUrlPresentation(
  websiteUrl: string,
  pageUrl: string | null,
): { href: string; label: string } {
  const href = (pageUrl?.trim() || websiteUrl).trim();
  try {
    const u = new URL(href);
    const base = new URL(websiteUrl);
    if (u.origin === base.origin) {
      const path = `${u.pathname}${u.search}${u.hash}`;
      const isRoot = u.pathname === "/" && u.search === "" && u.hash === "";
      return { href, label: isRoot ? href : path || "/" };
    }
  } catch {
    /* ignore */
  }
  return { href, label: href };
}

/** Read-only monitor card for the public share view: shows changes + current content, no controls. */
export function PublicMonitorCard({
  target,
  websiteUrl,
  changes,
  currentContent,
  productPriceHistory,
  attribution,
}: {
  target: Target;
  websiteUrl: string;
  changes: MonitorAlert[];
  currentContent: TargetCurrentContentData | null;
  productPriceHistory: ProductPricePoint[];
  attribution: string | null;
}) {
  const [contentOpen, setContentOpen] = useState(false);
  const { href, label } = targetUrlPresentation(websiteUrl, target.pageUrl);
  const latestChangeAt = changes[0] ? Number(changes[0].alert.createdAt) : null;

  return (
    <li className="overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-950/5">
      <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <KindBadge kind={target.kind} />
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            title={href}
            className="min-w-0 flex-1 truncate font-mono text-xs text-brand-800 hover:underline"
          >
            {label}
          </a>
        </div>
        <MonitorStatusPill hasRun={Boolean(target.lastCheckedAt)} latestChangeAt={latestChangeAt} />
      </div>

      {changes.length > 0 ? (
        <ul role="list" className="divide-y divide-neutral-950/5 border-t border-neutral-950/5">
          {changes.slice(0, 8).map(({ alert, titleLabel }) => (
            <AlertItem key={alert.id} alert={alert} titleLabel={titleLabel} attribution={attribution} readOnly />
          ))}
        </ul>
      ) : (
        <div className="border-t border-neutral-950/5 px-4 py-3 text-xs text-neutral-500 sm:px-5">
          No changes detected yet.
        </div>
      )}

      <div className="flex items-center border-t border-neutral-950/5 bg-neutral-50/50 px-3 py-2 sm:px-4">
        <button
          type="button"
          className="btn-ghost inline-flex items-center gap-1.5 px-2 py-1 text-xs"
          onClick={() => setContentOpen((o) => !o)}
          aria-expanded={contentOpen ? "true" : "false"}
        >
          Current content
          <ChevronIcon open={contentOpen} />
        </button>
      </div>

      {contentOpen && (
        <div className="space-y-4 border-t border-neutral-950/5 bg-neutral-50/50 px-4 py-4 sm:px-5">
          {target.lastScreenshotUrl && (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="group block overflow-hidden rounded-xl ring-1 ring-neutral-950/10 transition hover:ring-brand-500/40"
              title="Open the live page"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={target.lastScreenshotUrl}
                alt="Screenshot of the monitored page"
                loading="lazy"
                className="max-h-80 w-full object-cover object-top transition group-hover:opacity-95"
              />
            </a>
          )}
          <TargetCurrentContent content={currentContent} />
          {target.kind === "PRODUCT_PRICE" && (
            <ProductPriceHistoryPanel points={productPriceHistory} pageUrl={target.pageUrl} />
          )}
        </div>
      )}
    </li>
  );
}

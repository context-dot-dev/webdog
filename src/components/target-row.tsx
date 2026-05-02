"use client";

import { Fragment, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import type { LinkScope, NotificationChannel, Target } from "@/lib/db/schema";
import type { TargetChangeDetail, TargetFetchEntry } from "@/lib/target-fetch-history";
import { KindBadge } from "./target-kind";
import { RelativeTime } from "./relative-time";
import type { WebsiteDestOption } from "./website-notification-destinations";
import {
  TARGET_FORM_DASHBOARD_ONLY,
  TARGET_FORM_WEBSITE_DEFAULT,
} from "@/lib/website-notification-destinations";
import { DiffPreview, LinksBlock, PriceChangeDetails } from "./alert-item";
import { ProductPriceHistoryPanel } from "./product-price-history-panel";
import { RunNowButton } from "./run-now-button";
import type { ProductPricePoint } from "@/lib/product-price-history";
import { formatProductPrice } from "@/lib/product-price-history";

const FREQUENCY_PRESETS_HOURS = [1, 6, 12, 24, 48, 168] as const;

/** Full URL for the link; label is path+query+hash when same host as the website, else the full URL. */
function targetUrlPresentation(websiteUrl: string, pageUrl: string | null): { href: string; label: string } {
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

function channelLabel(c: NotificationChannel): string {
  if (c === "SLACK") return "Slack";
  if (c === "EMAIL") return "Email";
  return "Webhook";
}

function frequencyLabel(hours: number): string {
  if (hours === 168) return "1 week";
  if (hours === 1) return "Every hour";
  return `Every ${hours} hours`;
}

const LINK_SCOPE_OPTIONS: { value: LinkScope; label: string }[] = [
  { value: "NEW", label: "New links only" },
  { value: "REMOVED", label: "Removed links only" },
  { value: "BOTH", label: "New and removed links" },
];

function coerceLinkScope(v: string | null | undefined): LinkScope {
  if (v === "NEW" || v === "REMOVED" || v === "BOTH") return v;
  return "BOTH";
}

function deriveOutboundRouting(target: Target): string {
  if (!(target.externalNotify ?? true)) return TARGET_FORM_DASHBOARD_ONLY;
  return target.notificationDestinationId ?? TARGET_FORM_WEBSITE_DEFAULT;
}

function FetchChangeDetailView({ detail }: { detail: TargetChangeDetail }) {
  if (detail.kind === "markdown") {
    return detail.diffPreview ? (
      <DiffPreview raw={detail.diffPreview} />
    ) : (
      <p className="text-xs text-neutral-500">No line-level diff.</p>
    );
  }
  if (detail.kind === "sitemap") {
    return (
      <div className="space-y-3">
        {detail.added.length > 0 && <LinksBlock title="Added" tone="emerald" urls={detail.added} />}
        {detail.removed.length > 0 && <LinksBlock title="Removed" tone="rose" urls={detail.removed} />}
        {detail.added.length === 0 && detail.removed.length === 0 && (
          <p className="text-xs text-neutral-500">Sitemap hash changed without URL set diff (e.g. ordering).</p>
        )}
      </div>
    );
  }
  const { before, after } = detail;
  if (before.is_product_page && after.is_product_page) {
    return (
      <PriceChangeDetails
        productName={after.productName ?? before.productName ?? undefined}
        previousPrice={before.price}
        previousCurrency={before.currency}
        newPrice={after.price}
        newCurrency={after.currency}
      />
    );
  }
  return (
    <div className="space-y-2 text-xs">
      <p className="text-neutral-600">Product snapshot changed (extraction or page type differs).</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <pre className="max-h-48 overflow-auto rounded-lg bg-neutral-100 p-2 font-mono text-[0.7rem] leading-relaxed">
          {JSON.stringify(before, null, 2)}
        </pre>
        <pre className="max-h-48 overflow-auto rounded-lg bg-neutral-100 p-2 font-mono text-[0.7rem] leading-relaxed">
          {JSON.stringify(after, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`size-4 shrink-0 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 6.5L8 10.5L12 6.5" />
    </svg>
  );
}

export function TargetRow({
  target,
  websiteId,
  destinations,
  websiteUrl,
  fetchHistory,
  productPriceHistory,
}: {
  target: Target;
  websiteId: string;
  destinations: WebsiteDestOption[];
  websiteUrl: string;
  fetchHistory: TargetFetchEntry[];
  productPriceHistory: ProductPricePoint[];
}) {
  const router = useRouter();
  const detailsId = useId();
  const [enabled, setEnabled] = useState(target.enabled);
  const [checkIntervalHours, setCheckIntervalHours] = useState(target.checkIntervalHours ?? 1);
  const [outboundRouting, setOutboundRouting] = useState(() => deriveOutboundRouting(target));
  const [linkScope, setLinkScope] = useState<LinkScope>(() => coerceLinkScope(target.linkScope));
  const [busy, setBusy] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [expandedFetchId, setExpandedFetchId] = useState<string | null>(null);
  const showPriceCol = target.kind === "PRODUCT_PRICE";
  const { href: targetHref, label: targetLabel } = targetUrlPresentation(websiteUrl, target.pageUrl);

  const hourOptions = (() => {
    const set = new Set<number>([...FREQUENCY_PRESETS_HOURS, checkIntervalHours]);
    return Array.from(set).sort((a, b) => a - b);
  })();

  useEffect(() => {
    setEnabled(target.enabled);
    setCheckIntervalHours(target.checkIntervalHours ?? 1);
    setOutboundRouting(deriveOutboundRouting(target));
    setLinkScope(coerceLinkScope(target.linkScope));
  }, [
    target.enabled,
    target.checkIntervalHours,
    target.notificationDestinationId,
    target.externalNotify,
    target.linkScope,
  ]);

  async function toggle() {
    setBusy(true);
    const next = !enabled;
    const res = await fetch(`/api/targets/${target.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    setBusy(false);
    if (res.ok) setEnabled(next);
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this target?")) return;
    setBusy(true);
    const res = await fetch(`/api/targets/${target.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  async function setFrequency(nextHours: number) {
    if (nextHours === checkIntervalHours) return;
    setBusy(true);
    const res = await fetch(`/api/targets/${target.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkIntervalHours: nextHours }),
    });
    setBusy(false);
    if (res.ok) {
      setCheckIntervalHours(nextHours);
      router.refresh();
    }
  }

  async function setLinkScopePreference(nextScope: LinkScope) {
    if (nextScope === linkScope) return;
    setBusy(true);
    const res = await fetch(`/api/targets/${target.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkScope: nextScope }),
    });
    setBusy(false);
    if (res.ok) {
      setLinkScope(nextScope);
      router.refresh();
    }
  }

  async function setOutboundRoutingPreference(nextSel: string) {
    setBusy(true);
    const body =
      nextSel === TARGET_FORM_DASHBOARD_ONLY
        ? { externalNotify: false, notificationDestinationId: null }
        : nextSel === TARGET_FORM_WEBSITE_DEFAULT
          ? { externalNotify: true, notificationDestinationId: null }
          : { externalNotify: true, notificationDestinationId: nextSel };
    const res = await fetch(`/api/targets/${target.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.ok) {
      setOutboundRouting(nextSel);
      router.refresh();
    }
  }

  return (
    <li className="flex flex-col">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <KindBadge kind={target.kind} />
          <a
            href={targetHref}
            target="_blank"
            rel="noreferrer noopener"
            title={targetHref}
            className="min-w-0 truncate font-mono text-xs text-brand-800 hover:underline"
          >
            {targetLabel}
          </a>
          <div className="shrink-0 text-xs text-neutral-500 sm:ml-0">
            {target.lastCheckedAt ? (
              <>
                Last checked <RelativeTime date={new Date(Number(target.lastCheckedAt))} />
              </>
            ) : (
              <>Waiting for first check</>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-neutral-600">
            <span className="sr-only">Enabled</span>
            <span
              className={`group relative inline-flex w-9 shrink-0 rounded-full p-0.5 ring-1 ring-inset transition-colors ${
                enabled ? "bg-brand-500 ring-brand-500" : "bg-neutral-200 ring-neutral-950/5"
              } ${busy ? "opacity-60" : ""}`}
            >
              <span
                className={`aspect-square w-1/2 rounded-full bg-white shadow-xs ring-1 ring-neutral-950/5 transition-transform ${
                  enabled ? "translate-x-full" : ""
                }`}
              />
              <input
                type="checkbox"
                className="absolute inset-0 size-full appearance-none focus:outline-none"
                checked={enabled}
                disabled={busy}
                onChange={toggle}
                aria-label={enabled ? "Disable target" : "Enable target"}
              />
            </span>
            <span className="w-6 tabular-nums">{enabled ? "On" : "Off"}</span>
          </label>

          <button
            type="button"
            className="btn-ghost inline-flex items-center gap-1.5 px-2 py-1.5 text-xs"
            onClick={() => setDetailsOpen((o) => !o)}
            aria-expanded={detailsOpen ? "true" : "false"}
            aria-controls={detailsId}
          >
            Details
            <ChevronIcon open={detailsOpen} />
          </button>
        </div>
      </div>

      {detailsOpen && (
        <div
          id={detailsId}
          className="space-y-5 border-t border-neutral-950/5 bg-neutral-50/50 px-5 py-4"
        >
          {target.pageUrl && (
            <p className="text-xs text-neutral-600">
              <span className="font-medium text-neutral-800">Watched page</span>{" "}
              <span className="font-mono text-neutral-600">{target.pageUrl}</span>
            </p>
          )}
          {target.kind === "SITEMAP_LINKS" && (
            <>
              <p className="text-xs text-neutral-600">
                <span className="font-medium text-neutral-800">Monitors</span> the site sitemap URL list; one scrape
                per check covers additions and removals.
              </p>
              <label className="flex max-w-md flex-col gap-0.5 text-xs text-neutral-600">
                <span className="font-medium text-neutral-800">Notify when</span>
                <select
                  className="w-full rounded-lg border border-neutral-950/10 bg-white px-2 py-1.5 text-xs text-neutral-800 shadow-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60"
                  value={linkScope}
                  disabled={busy}
                  onChange={(e) => void setLinkScopePreference(e.target.value as LinkScope)}
                  aria-label="Which sitemap changes trigger alerts"
                >
                  {LINK_SCOPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {target.kind === "PRODUCT_PRICE" && (
            <div className="mt-1">
              <ProductPriceHistoryPanel points={productPriceHistory} pageUrl={target.pageUrl} />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-0.5 text-xs text-neutral-600">
              <span>Alert routing</span>
              <select
                className="w-full max-w-md rounded-lg border border-neutral-950/10 bg-white px-2 py-1.5 text-xs text-neutral-800 shadow-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60"
                value={outboundRouting}
                disabled={busy}
                onChange={(e) => void setOutboundRoutingPreference(e.target.value)}
                aria-label="Where alerts go for this target"
              >
                <option value={TARGET_FORM_DASHBOARD_ONLY}>None (dashboard only)</option>
                <option value={TARGET_FORM_WEBSITE_DEFAULT}>Website default routing</option>
                {destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({channelLabel(d.channel)})
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-0.5 text-xs text-neutral-600">
              <span>Check frequency</span>
              <select
                className="w-full max-w-md rounded-lg border border-neutral-950/10 bg-white px-2 py-1.5 text-xs text-neutral-800 shadow-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60"
                value={checkIntervalHours}
                disabled={busy}
                onChange={(e) => void setFrequency(Number(e.target.value))}
                aria-label="Check frequency in hours"
              >
                {hourOptions.map((h) => (
                  <option key={h} value={h}>
                    {frequencyLabel(h)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <h3 className="text-xs font-medium text-neutral-800">Fetch history</h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Stored results for this target (newest first). “vs previous” compares each fetch to the one before it in
              time.
            </p>
            {fetchHistory.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-600">No fetches stored for this target yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-xl ring-1 ring-neutral-950/10">
                <table
                  className={`w-full border-collapse text-left text-sm ${showPriceCol ? "min-w-[24rem]" : "min-w-[20rem]"}`}
                >
                  <thead>
                    <tr className="border-b border-neutral-950/5 bg-white/80 text-xs font-medium text-neutral-600">
                      <th className="whitespace-nowrap px-3 py-2" scope="col">
                        Time
                      </th>
                      {showPriceCol && (
                        <th className="whitespace-nowrap px-2 py-2" scope="col">
                          Price
                        </th>
                      )}
                      <th className="whitespace-nowrap px-2 py-2 font-mono text-xs" scope="col">
                        Hash
                      </th>
                      <th className="px-2 py-2" scope="col">
                        vs previous
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {fetchHistory.map((r) => {
                      const t = r.createdAt;
                      const d = new Date(t);
                      return (
                        <Fragment key={r.id}>
                          <tr className="border-b border-neutral-950/5 bg-white/60 last:border-b-0">
                            <td className="whitespace-nowrap px-3 py-2 align-top text-xs text-neutral-600">
                              <time dateTime={d.toISOString()}>
                                <RelativeTime date={d} />
                              </time>
                            </td>
                            {showPriceCol && (
                              <td className="whitespace-nowrap px-2 py-2 align-top text-xs text-neutral-900">
                                {r.productRow?.isProductPage ? (
                                  <span className="tabular-nums font-medium">
                                    {formatProductPrice(r.productRow.price, r.productRow.currency)}
                                  </span>
                                ) : (
                                  <span className="text-neutral-400">—</span>
                                )}
                              </td>
                            )}
                            <td className="px-2 py-2 align-top font-mono text-xs text-neutral-700">
                              {r.hashPrefix}…
                            </td>
                            <td className="px-2 py-2 align-top text-xs">
                              {r.changedFromPrevious === null ? (
                                <span className="text-neutral-400">First in list</span>
                              ) : r.changedFromPrevious ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-amber-800">Changed</span>
                                  {r.changeDetail && (
                                    <button
                                      type="button"
                                      className="btn-ghost px-2 py-1 text-xs"
                                      onClick={() =>
                                        setExpandedFetchId((id) => (id === r.id ? null : r.id))
                                      }
                                      aria-expanded={expandedFetchId === r.id ? "true" : "false"}
                                    >
                                      {expandedFetchId === r.id ? "Hide" : "Show"}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-neutral-600">No change</span>
                              )}
                            </td>
                          </tr>
                          {expandedFetchId === r.id && r.changeDetail && (
                            <tr className="border-b border-neutral-950/5 bg-neutral-50/80 last:border-b-0">
                              <td colSpan={showPriceCol ? 4 : 3} className="px-3 py-3">
                                <FetchChangeDetailView detail={r.changeDetail} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-start gap-3 pt-1">
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="btn-ghost px-2 py-1.5 text-xs text-rose-700 hover:text-rose-800"
              aria-label="Delete target"
            >
              Delete target
            </button>
            <RunNowButton websiteId={websiteId} targetId={target.id} />
          </div>
        </div>
      )}
    </li>
  );
}

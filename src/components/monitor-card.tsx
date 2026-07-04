"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Alert, LinkScope, Target } from "@/lib/db/schema";
import type { TargetCurrentContent as TargetCurrentContentData } from "@/lib/target-fetch-history";
import { TargetCurrentContent } from "./target-current-content";
import { KindBadge } from "./target-kind";
import { MonitorStatusPill } from "./monitor-status-pill";
import { ChevronIcon } from "./chevron-icon";
import { AlertItem } from "./alert-item";
import { parseTimestamp } from "@/lib/parse-timestamp";
import { RelativeTime } from "./relative-time";
import type { WebsiteDestOption } from "./website-notification-destinations";
import { TARGET_FORM_DASHBOARD_ONLY } from "@/lib/website-notification-destinations";
import { ProductPriceHistoryPanel } from "./product-price-history-panel";
import { AlertRoutingField } from "./alert-routing-field";
import { RunNowButton } from "./run-now-button";
import type { ProductPricePoint } from "@/lib/product-price-history";
import { CHECK_FREQUENCY_PRESET_HOURS, checkFrequencyLabel } from "@/lib/check-frequency-presets";

export type MonitorAlert = { alert: Alert; titleLabel: string };

const SELECT_CLASS =
  "w-full rounded-lg border border-neutral-950/10 bg-white px-2.5 py-1.5 text-xs text-neutral-800 shadow-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60";

const MAX_INLINE_CHANGES = 4;

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
  return target.notificationDestinationId ?? TARGET_FORM_DASHBOARD_ONLY;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export function MonitorCard({
  target,
  websiteId,
  websiteUrl,
  destinations,
  changes,
  currentContent,
  productPriceHistory,
  aiSummaryConfigured,
  attribution,
  resendApiKeyManaged,
  resendSendFromEmailManaged,
  highlightEdit,
}: {
  target: Target;
  websiteId: string;
  websiteUrl: string;
  destinations: WebsiteDestOption[];
  /** This target's alerts, newest first. */
  changes: MonitorAlert[];
  currentContent: TargetCurrentContentData | null;
  productPriceHistory: ProductPricePoint[];
  aiSummaryConfigured: boolean;
  attribution: string | null;
  resendApiKeyManaged: boolean;
  resendSendFromEmailManaged: boolean;
  highlightEdit?: boolean;
}) {
  const router = useRouter();
  const settingsId = useId();
  const cardRef = useRef<HTMLLIElement>(null);
  const [enabled, setEnabled] = useState(target.enabled);
  const [checkIntervalHours, setCheckIntervalHours] = useState(target.checkIntervalHours ?? 1);
  const [linkScope, setLinkScope] = useState<LinkScope>(() => coerceLinkScope(target.linkScope));
  const [aiSummaryEnabled, setAiSummaryEnabled] = useState(target.aiChangeSummaryEnabled ?? false);
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(highlightEdit ?? false);
  const [contentOpen, setContentOpen] = useState(false);

  const { href: targetHref, label: targetLabel } = targetUrlPresentation(websiteUrl, target.pageUrl);
  const latestChangeAt = changes[0] ? Number(changes[0].alert.createdAt) : null;
  const visibleChanges = changes.slice(0, MAX_INLINE_CHANGES);

  const hourOptions = (() => {
    const set = new Set<number>([...CHECK_FREQUENCY_PRESET_HOURS, checkIntervalHours]);
    return Array.from(set).sort((a, b) => a - b);
  })();

  useEffect(() => {
    setEnabled(target.enabled);
    setCheckIntervalHours(target.checkIntervalHours ?? 1);
    setLinkScope(coerceLinkScope(target.linkScope));
    setAiSummaryEnabled(target.aiChangeSummaryEnabled ?? false);
  }, [target]);

  useEffect(() => {
    if (!highlightEdit) return;
    setSettingsOpen(true);
    const id = window.setTimeout(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
    return () => clearTimeout(id);
  }, [highlightEdit]);

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    const res = await fetch(`/api/targets/${target.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    return res.ok;
  }

  async function toggle() {
    const next = !enabled;
    if (await patch({ enabled: next })) setEnabled(next);
  }

  async function remove() {
    if (!confirm("Delete this monitor?")) return;
    setBusy(true);
    const res = await fetch(`/api/targets/${target.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  async function setFrequency(nextHours: number) {
    if (nextHours === checkIntervalHours) return;
    if (await patch({ checkIntervalHours: nextHours })) setCheckIntervalHours(nextHours);
  }

  async function setLinkScopePreference(nextScope: LinkScope) {
    if (nextScope === linkScope) return;
    if (await patch({ linkScope: nextScope })) setLinkScope(nextScope);
  }

  async function setAiSummaryPreference(next: boolean) {
    if (!aiSummaryConfigured && next) return;
    if (await patch({ aiChangeSummaryEnabled: next })) setAiSummaryEnabled(next);
  }

  return (
    <li
      ref={cardRef}
      id={`target-${target.id}`}
      className={`overflow-hidden rounded-2xl bg-white ring-1 transition-shadow ${
        highlightEdit ? "ring-brand-500/40" : "ring-neutral-950/5"
      } ${enabled ? "" : "opacity-70"}`}
    >
      {/* Identity + status */}
      <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <KindBadge kind={target.kind} />
          <div className="min-w-0 flex-1">
            {target.watchNote ? (
              <>
                <p className="truncate text-sm font-medium text-neutral-900" title={target.watchNote}>
                  {target.watchNote}
                </p>
                <a
                  href={targetHref}
                  target="_blank"
                  rel="noreferrer noopener"
                  title={targetHref}
                  className="block truncate font-mono text-xs text-neutral-500 hover:text-brand-700"
                >
                  {targetLabel}
                </a>
              </>
            ) : (
              <a
                href={targetHref}
                target="_blank"
                rel="noreferrer noopener"
                title={targetHref}
                className="block truncate font-mono text-xs text-brand-800 hover:underline"
              >
                {targetLabel}
              </a>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <MonitorStatusPill
            hasRun={Boolean(target.lastCheckedAt)}
            latestChangeAt={latestChangeAt}
            errored={Boolean(target.lastError)}
          />
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
                aria-label={enabled ? "Disable monitor" : "Enable monitor"}
              />
            </span>
          </label>
        </div>
      </div>

      {/* Last check failed */}
      {target.lastError && (
        <div className="flex items-start gap-2.5 border-t border-rose-500/15 bg-rose-50/60 px-4 py-3 sm:px-5">
          <WarningIcon className="mt-0.5 size-4 shrink-0 text-rose-500" />
          <div className="min-w-0 text-xs">
            <p className="font-medium text-rose-800">Last check failed</p>
            <p className="mt-0.5 text-rose-700">{target.lastError}</p>
            {target.lastErrorAt && (
              <p className="mt-0.5 text-rose-600/70">
                <RelativeTime date={parseTimestamp(target.lastErrorAt)} />
                {" · we'll keep retrying on schedule."}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Changes for this monitor */}
      {changes.length > 0 ? (
        <div className="border-t border-neutral-950/5">
          <ul role="list" className="divide-y divide-neutral-950/5">
            {visibleChanges.map(({ alert, titleLabel }) => (
              <AlertItem key={alert.id} alert={alert} titleLabel={titleLabel} attribution={attribution} />
            ))}
          </ul>
          {changes.length > visibleChanges.length && (
            <Link
              href="/dashboard/alerts"
              className="block border-t border-neutral-950/5 px-4 py-2 text-xs text-neutral-500 hover:text-brand-700 sm:px-5"
            >
              +{changes.length - visibleChanges.length} older change
              {changes.length - visibleChanges.length === 1 ? "" : "s"} — view all
            </Link>
          )}
        </div>
      ) : (
        <div className="border-t border-neutral-950/5 px-4 py-3 sm:px-5">
          <p className="text-xs text-neutral-500">
            {target.lastCheckedAt ? (
              <>
                No changes yet · last checked{" "}
                <RelativeTime date={parseTimestamp(target.lastCheckedAt)} />
              </>
            ) : (
              "Waiting for the first check to establish a baseline."
            )}
          </p>
          {currentContent && (
            <SnapshotPreview content={currentContent} onExpand={() => setContentOpen(true)} />
          )}
        </div>
      )}

      {/* Footer actions */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-neutral-950/5 bg-neutral-50/50 px-3 py-2 sm:px-4">
        <button
          type="button"
          className="btn-ghost inline-flex items-center gap-1.5 px-2 py-1 text-xs"
          onClick={() => setContentOpen((o) => !o)}
          aria-expanded={contentOpen ? "true" : "false"}
        >
          Current content
          <ChevronIcon open={contentOpen} />
        </button>
        <button
          type="button"
          className="btn-ghost inline-flex items-center gap-1.5 px-2 py-1 text-xs"
          onClick={() => setSettingsOpen((o) => !o)}
          aria-expanded={settingsOpen ? "true" : "false"}
          aria-controls={settingsId}
        >
          Settings
          <ChevronIcon open={settingsOpen} />
        </button>
        <div className="ml-auto">
          <RunNowButton websiteId={websiteId} targetId={target.id} />
        </div>
      </div>

      {/* Current content */}
      {contentOpen && (
        <div className="space-y-4 border-t border-neutral-950/5 bg-neutral-50/50 px-4 py-4 sm:px-5">
          {target.lastScreenshotUrl && (
            <PageScreenshot
              url={target.lastScreenshotUrl}
              capturedAt={target.lastScreenshotAt}
              pageHref={targetHref}
            />
          )}
          <TargetCurrentContent content={currentContent} />
          {target.kind === "PRODUCT_PRICE" && (
            <ProductPriceHistoryPanel points={productPriceHistory} pageUrl={target.pageUrl} />
          )}
        </div>
      )}

      {/* Settings */}
      {settingsOpen && (
        <div
          id={settingsId}
          className="border-t border-neutral-950/5 bg-neutral-50/50 px-4 py-4 sm:px-5"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Check frequency">
              <select
                className={SELECT_CLASS}
                value={checkIntervalHours}
                disabled={busy}
                onChange={(e) => void setFrequency(Number(e.target.value))}
                aria-label="How often to check this monitor"
              >
                {hourOptions.map((h) => (
                  <option key={h} value={h}>
                    {checkFrequencyLabel(h)}
                  </option>
                ))}
              </select>
            </Field>

            {target.kind === "SITEMAP_LINKS" && (
              <Field label="Notify on">
                <select
                  className={SELECT_CLASS}
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
              </Field>
            )}
          </div>

          <div className="mt-3">
            <AlertRoutingField
              targetId={target.id}
              initialDestinations={destinations}
              initialValue={deriveOutboundRouting(target)}
              resendApiKeyManaged={resendApiKeyManaged}
              resendSendFromEmailManaged={resendSendFromEmailManaged}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-neutral-700">
              <span
                className={`group relative inline-flex w-9 shrink-0 rounded-full p-0.5 ring-1 ring-inset transition-colors ${
                  aiSummaryEnabled ? "bg-brand-500 ring-brand-500" : "bg-neutral-200 ring-neutral-950/5"
                } ${busy || !aiSummaryConfigured ? "opacity-60" : ""}`}
              >
                <span
                  className={`aspect-square w-1/2 rounded-full bg-white shadow-xs ring-1 ring-neutral-950/5 transition-transform ${
                    aiSummaryEnabled ? "translate-x-full" : ""
                  }`}
                />
                <input
                  type="checkbox"
                  className="absolute inset-0 size-full appearance-none focus:outline-none"
                  checked={aiSummaryEnabled}
                  disabled={busy || !aiSummaryConfigured}
                  onChange={() => void setAiSummaryPreference(!aiSummaryEnabled)}
                  aria-label="AI change summary"
                />
              </span>
              <span className="font-medium text-neutral-800">AI change summary</span>
            </label>
            {!aiSummaryConfigured && (
              <Link href="/dashboard/settings" className="text-xs text-brand-700 hover:underline">
                Set up
              </Link>
            )}
          </div>

          <div className="mt-4 border-t border-neutral-950/5 pt-3">
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="btn-ghost px-2 py-1 text-xs text-rose-700 hover:text-rose-800"
              aria-label="Delete monitor"
            >
              Delete monitor
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function markdownSnippet(md: string, max = 260): string {
  const cleaned = md.replace(/[#>*_`]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.length > max ? `${cleaned.slice(0, max).trimEnd()}…` : cleaned;
}

/** Live screenshot of the watched page captured on the last check. */
function PageScreenshot({
  url,
  capturedAt,
  pageHref,
}: {
  url: string;
  capturedAt: Target["lastScreenshotAt"];
  pageHref: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-neutral-500">
          Page screenshot
        </span>
        {capturedAt && (
          <span className="text-[0.6875rem] text-neutral-400">
            Captured <RelativeTime date={parseTimestamp(capturedAt)} />
          </span>
        )}
      </div>
      <a
        href={pageHref}
        target="_blank"
        rel="noreferrer noopener"
        className="group block overflow-hidden rounded-xl ring-1 ring-neutral-950/10 transition hover:ring-brand-500/40"
        title="Open the live page"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Screenshot of the monitored page"
          loading="lazy"
          className="max-h-80 w-full object-cover object-top transition group-hover:opacity-95"
        />
      </a>
    </div>
  );
}

/** Compact peek at what the monitor is currently watching, shown before any change lands. */
function SnapshotPreview({
  content,
  onExpand,
}: {
  content: TargetCurrentContentData;
  onExpand: () => void;
}) {
  if (content.kind === "markdown") {
    const snippet = markdownSnippet(content.markdown);
    if (!snippet) return null;
    return (
      <div className="mt-2 rounded-lg bg-neutral-50 p-2.5 ring-1 ring-neutral-950/5">
        <p className="line-clamp-3 text-xs leading-relaxed text-neutral-600">{snippet}</p>
        <button
          type="button"
          onClick={onExpand}
          className="mt-1.5 text-xs font-medium text-brand-700 hover:underline"
        >
          View current content
        </button>
      </div>
    );
  }

  if (content.kind === "sitemap") {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg bg-neutral-50 p-2.5 text-xs text-neutral-600 ring-1 ring-neutral-950/5">
        <span>
          Tracking <span className="font-medium text-neutral-900">{content.urls.length}</span> URL
          {content.urls.length === 1 ? "" : "s"} in the sitemap.
        </span>
        <button type="button" onClick={onExpand} className="ml-auto font-medium text-brand-700 hover:underline">
          View
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg bg-neutral-50 p-2.5 text-xs text-neutral-600 ring-1 ring-neutral-950/5">
      <span className="truncate">
        {content.product.is_product_page
          ? `Current: ${content.product.productName ?? "product"}`
          : "Not detected as a product page yet."}
      </span>
      <button type="button" onClick={onExpand} className="ml-auto shrink-0 font-medium text-brand-700 hover:underline">
        View
      </button>
    </div>
  );
}

function WarningIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden {...props}>
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

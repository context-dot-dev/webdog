"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Alert, LinkScope, NotificationChannel, Target } from "@/lib/db/schema";
import type { TargetCurrentContent as TargetCurrentContentData } from "@/lib/target-fetch-history";
import { TargetCurrentContent } from "./target-current-content";
import { KindBadge } from "./target-kind";
import { ChevronIcon } from "./chevron-icon";
import { AlertItem } from "./alert-item";
import { parseTimestamp } from "@/lib/parse-timestamp";
import { RelativeTime } from "./relative-time";
import type { WebsiteDestOption } from "./website-notification-destinations";
import { TARGET_FORM_DASHBOARD_ONLY } from "@/lib/website-notification-destinations";
import { ProductPriceHistoryPanel } from "./product-price-history-panel";
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

function channelLabel(c: NotificationChannel): string {
  if (c === "SLACK") return "Slack";
  if (c === "EMAIL") return "Email";
  return "Webhook";
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

function StatusPill({
  hasRun,
  latestChangeAt,
}: {
  hasRun: boolean;
  latestChangeAt: number | null;
}) {
  if (!hasRun) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">
        <span className="size-1.5 rounded-full bg-neutral-400" aria-hidden />
        Waiting for first check
      </span>
    );
  }
  if (latestChangeAt) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-600/20 ring-inset">
        <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
        Changed <RelativeTime date={new Date(latestChangeAt)} />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20 ring-inset">
      <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
      Up to date
    </span>
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
  highlightEdit?: boolean;
}) {
  const router = useRouter();
  const settingsId = useId();
  const cardRef = useRef<HTMLLIElement>(null);
  const [enabled, setEnabled] = useState(target.enabled);
  const [checkIntervalHours, setCheckIntervalHours] = useState(target.checkIntervalHours ?? 1);
  const [outboundRouting, setOutboundRouting] = useState(() => deriveOutboundRouting(target));
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
    setOutboundRouting(deriveOutboundRouting(target));
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

  async function setOutboundRoutingPreference(nextSel: string) {
    const body =
      nextSel === TARGET_FORM_DASHBOARD_ONLY
        ? { externalNotify: false, notificationDestinationId: null }
        : { externalNotify: true, notificationDestinationId: nextSel };
    if (await patch(body)) setOutboundRouting(nextSel);
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
          <a
            href={targetHref}
            target="_blank"
            rel="noreferrer noopener"
            title={targetHref}
            className="min-w-0 flex-1 truncate font-mono text-xs text-brand-800 hover:underline"
          >
            {targetLabel}
          </a>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <StatusPill hasRun={Boolean(target.lastCheckedAt)} latestChangeAt={latestChangeAt} />
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
        <div className="border-t border-neutral-950/5 px-4 py-3 text-xs text-neutral-500 sm:px-5">
          {target.lastCheckedAt ? (
            <>
              No changes detected yet · last checked{" "}
              <RelativeTime date={parseTimestamp(target.lastCheckedAt)} />
            </>
          ) : (
            "Waiting for the first check to establish a baseline."
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

            <Field label="Alert routing">
              <select
                className={SELECT_CLASS}
                value={outboundRouting}
                disabled={busy}
                onChange={(e) => void setOutboundRoutingPreference(e.target.value)}
                aria-label="Where alerts go for this monitor"
              >
                <option value={TARGET_FORM_DASHBOARD_ONLY}>None (dashboard only)</option>
                {destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({channelLabel(d.channel)})
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

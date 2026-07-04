"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { NotificationDestination } from "@/lib/db/schema";
import type { WebsiteDestOption } from "./website-notification-destinations";
import { TARGET_FORM_DASHBOARD_ONLY } from "@/lib/website-notification-destinations";
import { CHECK_FREQUENCY_PRESET_HOURS, checkFrequencyLabel } from "@/lib/check-frequency-presets";
import { isUrlWithinDomain } from "@/lib/domain";
import { NotificationDestinationField } from "./notification-destination-field";

type MonitorScope = "page" | "site";
type PageMode = "content" | "price";
type MonitorCategory = "LINK" | "PAGE_CONTENT" | "PRODUCT_PRICE";

function canonicalSiteHttpsOrigin(domainOrHost: string): string {
  const raw = domainOrHost.trim() || "example.com";
  if (/^https?:\/\//i.test(raw)) {
    try {
      return new URL(raw).origin;
    } catch {
      /* fall through to host fallback */
    }
  }
  const hostOnly = raw.split("/")[0]?.replace(/^\/+/, "").trim();
  return `https://${hostOnly || "example.com"}`;
}

type BuildPageUrlResult =
  | { ok: true; url: string }
  | { ok: false; code: "empty" | "invalid" | "domain" };

/**
 * Compose the full page URL from the site origin + user input. Accepts a path
 * ("pricing", "/blog/x") or a same-domain absolute URL; rejects any URL that
 * resolves to a different domain so a site's monitors stay on that site.
 */
function buildPageUrl(siteOrigin: string, siteDomain: string, input: string): BuildPageUrlResult {
  const t = input.trim();
  if (!t) return { ok: false, code: "empty" };
  let composed: string;
  try {
    composed = /^[a-z][a-z0-9+.-]*:\/\//i.test(t)
      ? new URL(t).href
      : new URL(t.replace(/^\/+/u, ""), `${siteOrigin}/`).href;
  } catch {
    return { ok: false, code: "invalid" };
  }
  if (!isUrlWithinDomain(composed, siteDomain)) return { ok: false, code: "domain" };
  return { ok: true, url: composed };
}

function pageUrlErrorMessage(code: "empty" | "invalid" | "domain", siteDomain: string): string {
  if (code === "domain") return `Monitors can only watch pages on ${siteDomain}.`;
  if (code === "invalid") return "Enter a valid page path for this website.";
  return "Enter the page path you want to watch.";
}

function rowsToDestOptions(rows: NotificationDestination[]): WebsiteDestOption[] {
  return [...rows]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ id, channel, name }) => ({ id, channel, name }));
}

function deriveCategory(scope: MonitorScope, pageMode: PageMode): MonitorCategory {
  if (scope === "site") return "LINK";
  return pageMode === "price" ? "PRODUCT_PRICE" : "PAGE_CONTENT";
}

export function AddTargetDialog({
  websiteId,
  websiteDomain,
  destinations,
  resendApiKeyManaged,
  resendSendFromEmailManaged,
}: {
  websiteId: string;
  websiteDomain: string;
  destinations: WebsiteDestOption[];
  resendApiKeyManaged: boolean;
  resendSendFromEmailManaged: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [destinationOptions, setDestinationOptions] = useState<WebsiteDestOption[]>(destinations);
  const [opening, setOpening] = useState(false);
  const [scope, setScope] = useState<MonitorScope>("page");
  const [pageMode, setPageMode] = useState<PageMode>("content");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pagePath, setPagePath] = useState("");
  const [watchNote, setWatchNote] = useState("");
  const [notifyRouting, setNotifyRouting] = useState(TARGET_FORM_DASHBOARD_ONLY);
  const [checkIntervalHours, setCheckIntervalHours] = useState(24);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDestinationOptions(destinations);
  }, [destinations]);

  const resetForm = useCallback((opts: WebsiteDestOption[]) => {
    setScope("page");
    setPageMode("content");
    setShowAdvanced(false);
    setPagePath("");
    setWatchNote("");
    // Default to the first real destination so alerts go somewhere; fall back to
    // dashboard-only only when the user has no destinations yet.
    setNotifyRouting(opts[0]?.id ?? TARGET_FORM_DASHBOARD_ONLY);
    setCheckIntervalHours(24);
    setError(null);
  }, []);

  const siteOrigin = useMemo(() => canonicalSiteHttpsOrigin(websiteDomain), [websiteDomain]);
  const siteHost = useMemo(() => {
    try {
      return new URL(siteOrigin).host;
    } catch {
      return websiteDomain;
    }
  }, [siteOrigin, websiteDomain]);

  const category = deriveCategory(scope, pageMode);
  const isPageScope = scope === "page";
  const pageBuild = isPageScope ? buildPageUrl(siteOrigin, websiteDomain, pagePath) : null;
  const pageUrlPreview = pageBuild?.ok ? pageBuild.url : `${siteOrigin}/`;
  // Only flag an off-domain paste; don't nag while the field is still empty.
  const offDomain = pageBuild != null && !pageBuild.ok && pageBuild.code === "domain";

  async function handleOpen() {
    setOpening(true);
    let opts = destinationOptions;
    try {
      const res = await fetch("/api/user/notification-destinations");
      if (res.ok) {
        const data = (await res.json()) as { destinations: NotificationDestination[] };
        opts = rowsToDestOptions(data.destinations ?? []);
        setDestinationOptions(opts);
      }
    } finally {
      setOpening(false);
    }
    resetForm(opts);
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    resetForm(destinationOptions);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    let pageUrlFull = "";
    if (isPageScope) {
      const build = buildPageUrl(siteOrigin, websiteDomain, pagePath);
      if (!build.ok) {
        setError(pageUrlErrorMessage(build.code, websiteDomain));
        return;
      }
      pageUrlFull = build.url;
    }

    const dashboardOnly = notifyRouting === TARGET_FORM_DASHBOARD_ONLY;

    setError(null);
    setLoading(true);

    const freq = { checkIntervalHours };
    const routing = dashboardOnly
      ? { externalNotify: false as const }
      : { notificationDestinationId: notifyRouting };
    const pageFields = isPageScope ? { pageUrl: pageUrlFull } : {};
    const note = watchNote.trim() ? { watchNote: watchNote.trim() } : {};

    const outboundBody = { category, ...pageFields, ...note, ...routing, ...freq };

    const res = await fetch(`/api/websites/${websiteId}/targets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(outboundBody),
    });
    setLoading(false);
    if (!res.ok) {
      const bodyJson = await res.json().catch(() => ({}));
      setError(bodyJson.error ?? "Something went wrong");
      return;
    }
    handleClose();
    router.refresh();
  }

  const pageIncomplete = isPageScope && (offDomain || !pagePath.trim());

  const frequencyOptions = (() => {
    const set = new Set<number>([...CHECK_FREQUENCY_PRESET_HOURS, checkIntervalHours]);
    return Array.from(set).sort((a, b) => a - b);
  })();

  const heading = isPageScope
    ? pageMode === "price"
      ? "Which product page's price should we watch?"
      : "Which page do you want to watch?"
    : "Watch the whole site";

  return (
    <>
      <button type="button" onClick={() => void handleOpen()} disabled={opening} className="btn-accent">
        <PlusIcon className="size-4" /> Add monitor
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Add a monitor" className="fixed inset-0 z-50">
          <button type="button" aria-label="Close" onClick={handleClose} className="absolute inset-0 bg-neutral-950/40" />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <form
              onSubmit={onSubmit}
              className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-neutral-950/5"
            >
              <div className="border-b border-neutral-950/5 px-6 pb-5 pt-6">
                <h2 className="text-base font-semibold text-neutral-900">Add a monitor</h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Paste any page on{" "}
                  <span className="font-mono font-medium text-neutral-900">{siteHost}</span> and we&apos;ll alert
                  you the moment it changes.
                </p>
              </div>

              <div className="space-y-5 px-6 py-5">
                {/* Primary: the page to watch (or whole-site note) */}
                {isPageScope ? (
                  <div>
                    <label htmlFor="page-url" className="block text-sm font-medium text-neutral-900">
                      {heading}
                    </label>
                    <div
                      className={`mt-1.5 flex w-full items-center rounded-lg border bg-white px-3 shadow-xs transition focus-within:ring-1 ${
                        offDomain
                          ? "border-rose-400 focus-within:border-rose-500 focus-within:ring-rose-500"
                          : "border-neutral-950/10 focus-within:border-brand-500 focus-within:ring-brand-500"
                      }`}
                    >
                      <span className="shrink-0 select-none font-mono text-sm text-neutral-400">{siteHost}/</span>
                      <input
                        id="page-url"
                        name="pagePathTail"
                        type="text"
                        className="min-w-0 flex-1 border-0 bg-transparent py-2.5 pl-0.5 font-mono text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-0"
                        placeholder={pageMode === "price" ? "products/pro-plan" : "pricing"}
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        autoFocus
                        value={pagePath}
                        aria-describedby="page-url-desc"
                        onChange={(e) => setPagePath(e.target.value)}
                      />
                    </div>
                    <p
                      id="page-url-desc"
                      className={`mt-1.5 text-xs ${offDomain ? "text-rose-600" : "text-neutral-500"}`}
                    >
                      {offDomain ? (
                        <>Monitors can only watch pages on {websiteDomain} — paste a link on this site.</>
                      ) : pagePath.trim() ? (
                        <>
                          Watches <span className="break-all font-mono text-neutral-700">{pageUrlPreview}</span>
                          {pageMode === "price" ? " for price changes" : " for any content change"}
                        </>
                      ) : pageMode === "price" ? (
                        "We'll track the price and currency on this product page (powered by context.dev)."
                      ) : (
                        "Any full URL on this site works — paste it or type the path."
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-xl bg-cream-50 p-4 ring-1 ring-neutral-950/5">
                    <GlobeIcon className="mt-0.5 size-5 shrink-0 text-brand-600" />
                    <p className="text-sm text-neutral-700">
                      We&apos;ll watch {websiteDomain}&apos;s sitemap and alert you when pages are added or removed.
                    </p>
                  </div>
                )}

                {/* What to watch for (optional intent) */}
                <div>
                  <label htmlFor="watch-note" className="block text-sm font-medium text-neutral-900">
                    What should we watch for?{" "}
                    <span className="font-normal text-neutral-400">(optional)</span>
                  </label>
                  <input
                    id="watch-note"
                    type="text"
                    className="input mt-1.5"
                    placeholder={
                      pageMode === "price"
                        ? "e.g. when the price drops below $20"
                        : "e.g. when pricing changes, or a new post is published"
                    }
                    maxLength={300}
                    value={watchNote}
                    onChange={(e) => setWatchNote(e.target.value)}
                  />
                  <p className="mt-1.5 text-xs text-neutral-500">
                    Labels this monitor and helps AI summaries focus on what you care about.
                  </p>
                </div>

                {/* Notify + frequency */}
                <div className="grid min-w-0 grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
                  <div className="min-w-0">
                    <label className="block text-sm font-medium text-neutral-900">Notify me via</label>
                    <div className="mt-1.5">
                      <NotificationDestinationField
                        value={notifyRouting}
                        onChange={setNotifyRouting}
                        destinations={destinationOptions}
                        onDestinationsChange={setDestinationOptions}
                        resendApiKeyManaged={resendApiKeyManaged}
                        resendSendFromEmailManaged={resendSendFromEmailManaged}
                      />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <label htmlFor="check-interval" className="block text-sm font-medium text-neutral-900">
                      Check every
                    </label>
                    <select
                      id="check-interval"
                      name="checkIntervalHours"
                      className="input mt-1.5"
                      value={checkIntervalHours}
                      onChange={(e) => setCheckIntervalHours(Number(e.target.value))}
                      aria-label="How often to check this monitor"
                    >
                      {frequencyOptions.map((h) => (
                        <option key={h} value={h}>
                          {checkFrequencyLabel(h)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Advanced: scope + what to detect (tucked away — the common case is one page's content) */}
                <div className="border-t border-neutral-950/5 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-800"
                    aria-expanded={showAdvanced}
                  >
                    <ChevronRight className={`size-3.5 transition-transform ${showAdvanced ? "rotate-90" : ""}`} />
                    Advanced options
                  </button>

                  {showAdvanced && (
                    <div className="mt-3 space-y-3">
                      <RadioRow
                        label="Watch the whole site instead"
                        description={`Track ${websiteDomain}'s sitemap for added or removed pages.`}
                        checked={scope === "site"}
                        onChange={() => {
                          setScope("site");
                          setError(null);
                        }}
                      />
                      <RadioRow
                        label="Watch a single page"
                        description="Point at one URL and watch it for changes."
                        checked={scope === "page"}
                        onChange={() => {
                          setScope("page");
                          setError(null);
                        }}
                      />
                      {scope === "page" && (
                        <div className="ml-6 border-l border-neutral-950/5 pl-3">
                          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
                            <input
                              type="checkbox"
                              className="size-4 rounded border-neutral-300 text-brand-500 focus:ring-brand-500"
                              checked={pageMode === "price"}
                              onChange={(e) => setPageMode(e.target.checked ? "price" : "content")}
                            />
                            This is a product page — track its price specifically
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {error && (
                  <p className="text-sm text-rose-600" role="alert">
                    {error}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-neutral-950/5 bg-neutral-50/60 px-6 py-4">
                <button type="button" onClick={handleClose} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={loading || pageIncomplete} className="btn-accent">
                  {loading ? "Adding…" : "Add monitor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function RadioRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 size-4 border-neutral-300 text-brand-500 focus:ring-brand-500"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-neutral-900">{label}</span>
        <span className="block text-xs text-neutral-500">{description}</span>
      </span>
    </label>
  );
}

function ChevronRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}

function GlobeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.7-3.8-9s1.3-6.5 3.8-9Z" />
    </svg>
  );
}

function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M8 3v10M3 8h10" strokeLinecap="round" />
    </svg>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { NotificationChannel, NotificationDestination } from "@/lib/db/schema";
import type { WebsiteDestOption } from "./website-notification-destinations";
import { TARGET_FORM_DASHBOARD_ONLY } from "@/lib/website-notification-destinations";
import { CHECK_FREQUENCY_PRESET_HOURS, checkFrequencyLabel } from "@/lib/check-frequency-presets";
import { isUrlWithinDomain } from "@/lib/domain";

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

function channelLabel(c: NotificationChannel): string {
  if (c === "SLACK") return "Slack";
  if (c === "EMAIL") return "Email";
  return "Webhook";
}

function rowsToDestOptions(rows: NotificationDestination[]): WebsiteDestOption[] {
  return [...rows]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ id, channel, name }) => ({ id, channel, name }));
}

const CATEGORY_META: Record<
  MonitorCategory,
  { label: string; tagline: string; watch: (domain: string) => string }
> = {
  PAGE_CONTENT: {
    label: "Page content",
    tagline: "Tell me when this page changes",
    watch: () => "We'll alert you whenever the content on this page changes.",
  },
  PRODUCT_PRICE: {
    label: "Price",
    tagline: "Tell me when the price changes",
    watch: () => "We'll track the price and currency on this product page (powered by context.dev).",
  },
  LINK: {
    label: "Whole site",
    tagline: "Tell me when pages are added or removed",
    watch: (domain) => `We'll watch ${domain}'s sitemap and alert you when pages appear or disappear.`,
  },
};

export function AddTargetDialog({
  websiteId,
  websiteDomain,
  destinations,
}: {
  websiteId: string;
  websiteDomain: string;
  destinations: WebsiteDestOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [destinationOptions, setDestinationOptions] = useState<WebsiteDestOption[]>(destinations);
  const [opening, setOpening] = useState(false);
  const [category, setCategory] = useState<MonitorCategory>("PAGE_CONTENT");
  const [pagePath, setPagePath] = useState("");
  const [notifyRouting, setNotifyRouting] = useState("");
  const [checkIntervalHours, setCheckIntervalHours] = useState(24);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDestinationOptions(destinations);
  }, [destinations]);

  const resetForm = useCallback((opts: WebsiteDestOption[]) => {
    setCategory("PAGE_CONTENT");
    setPagePath("");
    if (opts.length === 0) setNotifyRouting(TARGET_FORM_DASHBOARD_ONLY);
    else if (opts.length === 1) setNotifyRouting(opts[0].id);
    else setNotifyRouting("");
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

  const isPageCategory = category === "PAGE_CONTENT" || category === "PRODUCT_PRICE";
  const pageBuild = isPageCategory ? buildPageUrl(siteOrigin, websiteDomain, pagePath) : null;
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
    if (isPageCategory) {
      const build = buildPageUrl(siteOrigin, websiteDomain, pagePath);
      if (!build.ok) {
        setError(pageUrlErrorMessage(build.code, websiteDomain));
        return;
      }
      pageUrlFull = build.url;
    }

    const dashboardOnly = notifyRouting === TARGET_FORM_DASHBOARD_ONLY;
    if (!dashboardOnly && destinationOptions.length > 1 && notifyRouting === "") return;

    setError(null);
    setLoading(true);

    const freq = { checkIntervalHours };

    const outboundBody =
      category === "LINK"
        ? dashboardOnly
          ? { category: "LINK" as const, externalNotify: false as const, ...freq }
          : {
              category: "LINK" as const,
              ...(notifyRouting ? { notificationDestinationId: notifyRouting } : {}),
              ...freq,
            }
        : category === "PAGE_CONTENT"
          ? dashboardOnly
            ? { category: "PAGE_CONTENT" as const, pageUrl: pageUrlFull, externalNotify: false as const, ...freq }
            : {
                category: "PAGE_CONTENT" as const,
                pageUrl: pageUrlFull,
                ...(notifyRouting ? { notificationDestinationId: notifyRouting } : {}),
                ...freq,
              }
          : dashboardOnly
            ? { category: "PRODUCT_PRICE" as const, pageUrl: pageUrlFull, externalNotify: false as const, ...freq }
            : {
                category: "PRODUCT_PRICE" as const,
                pageUrl: pageUrlFull,
                ...(notifyRouting ? { notificationDestinationId: notifyRouting } : {}),
                ...freq,
              };

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

  const routingPickIncomplete =
    destinationOptions.length > 1 &&
    notifyRouting !== TARGET_FORM_DASHBOARD_ONLY &&
    notifyRouting === "";
  const pageIncomplete = isPageCategory && (offDomain || !pagePath.trim());

  const frequencyOptions = (() => {
    const set = new Set<number>([...CHECK_FREQUENCY_PRESET_HOURS, checkIntervalHours]);
    return Array.from(set).sort((a, b) => a - b);
  })();

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
                  Watch a page on{" "}
                  <span className="font-mono font-medium text-neutral-900">{siteHost}</span> and get alerted the
                  moment it changes.
                </p>
              </div>

              <div className="space-y-5 px-6 py-5">
                {/* What to watch */}
                <div>
                  <span className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
                    What to watch
                  </span>
                  <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-xl bg-neutral-100 p-1">
                    {(Object.keys(CATEGORY_META) as MonitorCategory[]).map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setCategory(id);
                          setError(null);
                        }}
                        aria-pressed={category === id}
                        className={`rounded-lg px-2 py-1.5 text-sm font-medium transition ${
                          category === id
                            ? "bg-white text-neutral-900 shadow-xs ring-1 ring-neutral-950/5"
                            : "text-neutral-500 hover:text-neutral-800"
                        }`}
                      >
                        {CATEGORY_META[id].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Page URL (page + price) or whole-site note */}
                {isPageCategory ? (
                  <div>
                    <label htmlFor="page-url" className="block text-sm font-medium text-neutral-900">
                      {CATEGORY_META[category].tagline}
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
                        placeholder={category === "PRODUCT_PRICE" ? "products/pro-plan" : "pricing"}
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
                        </>
                      ) : (
                        CATEGORY_META[category].watch(websiteDomain)
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-xl bg-cream-50 p-4 ring-1 ring-neutral-950/5">
                    <GlobeIcon className="mt-0.5 size-5 shrink-0 text-brand-600" />
                    <p className="text-sm text-neutral-700">{CATEGORY_META.LINK.watch(websiteDomain)}</p>
                  </div>
                )}

                {/* Notify + frequency */}
                <div className="grid min-w-0 grid-cols-2 gap-x-5 gap-y-5 max-[420px]:grid-cols-1">
                  <div className="min-w-0">
                    <label htmlFor="notify-dest" className="block text-sm font-medium text-neutral-900">
                      Notify
                    </label>
                    <select
                      id="notify-dest"
                      className="input mt-1.5"
                      value={notifyRouting}
                      onChange={(e) => setNotifyRouting(e.target.value)}
                    >
                      {destinationOptions.length > 1 && <option value="">Choose…</option>}
                      <option value={TARGET_FORM_DASHBOARD_ONLY}>Dashboard only</option>
                      {destinationOptions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({channelLabel(d.channel)})
                        </option>
                      ))}
                    </select>
                    {destinationOptions.length === 0 ? (
                      <p className="mt-1.5 text-xs text-neutral-500">
                        Add Slack, email, or a webhook in{" "}
                        <Link href="/dashboard/settings" className="font-medium text-brand-700 hover:underline">
                          Settings
                        </Link>
                        .
                      </p>
                    ) : null}
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
                <button
                  type="submit"
                  disabled={loading || routingPickIncomplete || pageIncomplete}
                  className="btn-accent"
                >
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

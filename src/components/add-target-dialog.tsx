"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { NotificationChannel, NotificationDestination } from "@/lib/db/schema";
import { TARGET_KIND_DESCRIPTION } from "./target-kind";
import type { WebsiteDestOption } from "./website-notification-destinations";
import { TARGET_FORM_DASHBOARD_ONLY } from "@/lib/website-notification-destinations";

type MonitorCategory = "LINK" | "PAGE_CONTENT" | "PRODUCT_PRICE";

const FREQUENCY_PRESETS_HOURS = [1, 6, 12, 24, 48, 168] as const;

function frequencyLabel(hours: number): string {
  if (hours === 168) return "1 week";
  if (hours === 1) return "Every hour";
  return `Every ${hours} hours`;
}

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

function joinOriginAndRelativePath(siteOrigin: string, pathTail: string): string {
  const stripped = pathTail.trim().replace(/^\/+/u, "");
  if (!stripped) throw new Error("empty path");
  return new URL(stripped, `${siteOrigin}/`).href;
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
  const [step, setStep] = useState<1 | 2>(1);
  const [category, setCategory] = useState<MonitorCategory | null>(null);
  const [pagePath, setPagePath] = useState("");
  const [notifyRouting, setNotifyRouting] = useState("");
  const [checkIntervalHours, setCheckIntervalHours] = useState(24);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDestinationOptions(destinations);
  }, [destinations]);

  const resetForm = useCallback((opts: WebsiteDestOption[]) => {
    setStep(1);
    setCategory(null);
    setPagePath("");
    if (opts.length === 0) setNotifyRouting(TARGET_FORM_DASHBOARD_ONLY);
    else if (opts.length === 1) setNotifyRouting(opts[0].id);
    else setNotifyRouting("");
    setCheckIntervalHours(24);
    setError(null);
  }, []);

  const siteOrigin = useMemo(() => canonicalSiteHttpsOrigin(websiteDomain), [websiteDomain]);
  const pageUrlInputPlaceholder = `${siteOrigin}/...`;
  const pageUrlPreview =
    category === "PAGE_CONTENT" || category === "PRODUCT_PRICE"
      ? (() => {
          try {
            return joinOriginAndRelativePath(siteOrigin, pagePath);
          } catch {
            return `${siteOrigin}/`;
          }
        })()
      : "";

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
    if (!category) return;

    let pageUrlFull = "";
    if (category === "PAGE_CONTENT" || category === "PRODUCT_PRICE") {
      try {
        pageUrlFull = joinOriginAndRelativePath(siteOrigin, pagePath);
        new URL(pageUrlFull);
      } catch {
        setError("Enter a valid page path for this website.");
        return;
      }
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

  const canContinueStep1 = category !== null;
  const routingPickIncomplete =
    destinationOptions.length > 1 &&
    notifyRouting !== TARGET_FORM_DASHBOARD_ONLY &&
    notifyRouting === "";

  const frequencyOptions = (() => {
    const set = new Set<number>([...FREQUENCY_PRESETS_HOURS, checkIntervalHours]);
    return Array.from(set).sort((a, b) => a - b);
  })();

  return (
    <>
      <button type="button" onClick={() => void handleOpen()} disabled={opening} className="btn-accent">
        <PlusIcon className="size-4" /> Add target
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Add target" className="fixed inset-0 z-50">
          <button type="button" aria-label="Close" onClick={handleClose} className="absolute inset-0 bg-neutral-950/40" />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <form
              onSubmit={onSubmit}
              className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl ring-1 ring-neutral-950/5"
            >
              <h2 className="text-base font-semibold text-neutral-900">Add a target</h2>
              <p className="mt-1 text-sm text-neutral-600">
                {step === 1 ? "Choose what to monitor for this website." : "Configure the monitor and where alerts go."}
              </p>

              {step === 1 && (
                <fieldset className="mt-6 space-y-2">
                  <legend className="sr-only">Monitor type</legend>
                  {(
                    [
                      {
                        id: "LINK" as const,
                        title: "Site links (sitemap)",
                        description: TARGET_KIND_DESCRIPTION.SITEMAP_LINKS,
                      },
                      {
                        id: "PAGE_CONTENT" as const,
                        title: "Page content changes",
                        description: TARGET_KIND_DESCRIPTION.PAGE_CONTENT,
                      },
                      {
                        id: "PRODUCT_PRICE" as const,
                        title: "Product price changes",
                        description: TARGET_KIND_DESCRIPTION.PRODUCT_PRICE,
                      },
                    ] as const
                  ).map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl p-4 ring-1 transition ${
                        category === opt.id
                          ? "bg-brand-50 ring-brand-500/30"
                          : "bg-white ring-neutral-950/10 hover:bg-neutral-50"
                      }`}
                    >
                      <span className="flex h-lh items-center">
                        <span className="group inline-grid size-4 grid-cols-1">
                          <input
                            type="radio"
                            name="monitorCategory"
                            value={opt.id}
                            checked={category === opt.id}
                            onChange={() => setCategory(opt.id)}
                            className="checked:border-brand-500 checked:bg-brand-500 focus-visible:outline-brand-500 col-start-1 row-start-1 appearance-none rounded-full border border-neutral-300 bg-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:border-neutral-300 disabled:bg-neutral-100 disabled:checked:bg-neutral-100 forced-colors:appearance-auto"
                          />
                          <span className="pointer-events-none col-start-1 row-start-1 size-[round(down,40%,1px)] self-center justify-self-center rounded-full bg-white group-not-has-checked:opacity-0" />
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-neutral-900">{opt.title}</span>
                        <span className="mt-0.5 block text-sm text-neutral-600">{opt.description}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}

              {step === 2 && category && (
                <div className="mt-6 space-y-5">
                  {(category === "PAGE_CONTENT" || category === "PRODUCT_PRICE") && (
                    <div>
                      <label htmlFor="page-url" className="block text-sm font-medium text-neutral-900">
                        {category === "PRODUCT_PRICE" ? "Product page URL" : "Page URL"}
                      </label>
                      <p id="page-url-desc" className="sr-only">
                        Paths share your site hostname. Fully composed URL:&nbsp;{pageUrlPreview}
                      </p>
                      <input
                        id="page-url"
                        name="pagePathTail"
                        type="text"
                        className="input mt-1.5 w-full font-mono"
                        placeholder={pageUrlInputPlaceholder}
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        required
                        value={pagePath}
                        aria-describedby="page-url-desc"
                        title={pageUrlPreview}
                        onChange={(e) => setPagePath(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="grid min-w-0 grid-cols-2 gap-x-6 gap-y-5 max-[360px]:grid-cols-1">
                    <div className="min-w-0">
                      <label htmlFor="notify-dest" className="block text-sm font-medium text-neutral-900">
                        Notification destination
                      </label>
                      <select
                        id="notify-dest"
                        className="input mt-1.5"
                        value={notifyRouting}
                        onChange={(e) => setNotifyRouting(e.target.value)}
                      >
                        {destinationOptions.length > 1 && <option value="">Choose…</option>}
                        <option value={TARGET_FORM_DASHBOARD_ONLY}>None (dashboard only)</option>
                        {destinationOptions.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({channelLabel(d.channel)})
                          </option>
                        ))}
                      </select>
                      {destinationOptions.length === 0 ? (
                        <p className="mt-2 text-sm text-neutral-600">
                          Add integrations in{" "}
                          <Link href="/dashboard/settings" className="font-medium text-brand-700 hover:underline">
                            Settings
                          </Link>{" "}
                          to notify Slack, email, or a webhook. Without them, alerts stay in the dashboard.
                        </p>
                      ) : null}
                    </div>

                    <div className="min-w-0">
                      <label htmlFor="check-interval" className="block text-sm font-medium text-neutral-900">
                        Check frequency
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
                            {frequencyLabel(h)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <p className="mt-4 text-sm text-brand-700" role="alert">
                  {error}
                </p>
              )}

              <div className="mt-6 flex items-center justify-between gap-2">
                {step === 2 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setError(null);
                    }}
                    className="btn-secondary"
                  >
                    Back
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2">
                  <button type="button" onClick={handleClose} className="btn-secondary">
                    Cancel
                  </button>
                  {step === 1 ? (
                    <button
                      type="button"
                      disabled={!canContinueStep1}
                      onClick={() => {
                        setStep(2);
                        setError(null);
                      }}
                      className="btn-accent"
                    >
                      Continue
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={loading || routingPickIncomplete}
                      className="btn-accent"
                    >
                      {loading ? "Adding…" : "Add target"}
                    </button>
                  )}
                </div>
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

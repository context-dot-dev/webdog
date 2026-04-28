"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { NotificationChannel } from "@/lib/db/schema";
import { TARGET_KIND_DESCRIPTION } from "./target-kind";
import type { WebsiteDestOption } from "./website-notification-destinations";

type MonitorCategory = "LINK" | "PAGE_CONTENT" | "PRODUCT_PRICE";

function pageUrlPlaceholder(websiteDomain: string, kind: "PAGE_CONTENT" | "PRODUCT_PRICE"): string {
  const host = websiteDomain.trim() || "example.com";
  const base = `https://${host}/`;
  return kind === "PRODUCT_PRICE" ? `${base}product/…` : `${base}pricing`;
}

function channelLabel(c: NotificationChannel): string {
  if (c === "SLACK") return "Slack";
  if (c === "EMAIL") return "Email";
  return "Webhook";
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
  const [step, setStep] = useState<1 | 2>(1);
  const [category, setCategory] = useState<MonitorCategory | null>(null);
  const [pageUrl, setPageUrl] = useState("");
  const [notificationDestinationId, setNotificationDestinationId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setStep(1);
    setCategory(null);
    setPageUrl("");
    setNotificationDestinationId(destinations.length === 1 ? destinations[0].id : "");
    setError(null);
  }, [destinations]);

  function handleOpen() {
    resetForm();
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    resetForm();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category || destinations.length === 0) return;
    setError(null);
    setLoading(true);

    const body =
      category === "LINK"
        ? {
            category: "LINK" as const,
            ...(notificationDestinationId ? { notificationDestinationId } : {}),
          }
        : category === "PAGE_CONTENT"
          ? {
              category: "PAGE_CONTENT" as const,
              pageUrl,
              ...(notificationDestinationId ? { notificationDestinationId } : {}),
            }
          : {
              category: "PRODUCT_PRICE" as const,
              pageUrl,
              ...(notificationDestinationId ? { notificationDestinationId } : {}),
            };

    const res = await fetch(`/api/websites/${websiteId}/targets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
  const noDestinations = destinations.length === 0;

  return (
    <>
      <button type="button" onClick={handleOpen} className="btn-accent">
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
                      <input
                        id="page-url"
                        name="pageUrl"
                        type="url"
                        className="input mt-1.5 font-mono"
                        placeholder={pageUrlPlaceholder(websiteDomain, category)}
                        required
                        value={pageUrl}
                        onChange={(e) => setPageUrl(e.target.value)}
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="notify-dest" className="block text-sm font-medium text-neutral-900">
                      Notification destination
                    </label>
                    <select
                      id="notify-dest"
                      className="input mt-1.5"
                      required
                      value={notificationDestinationId}
                      onChange={(e) => setNotificationDestinationId(e.target.value)}
                      disabled={noDestinations}
                    >
                      {destinations.length > 1 && <option value="">Select…</option>}
                      {destinations.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({channelLabel(d.channel)})
                        </option>
                      ))}
                    </select>
                    {noDestinations && (
                      <p className="mt-2 text-sm text-neutral-600">
                        Add a destination in{" "}
                        <Link href="/dashboard/settings" className="font-medium text-brand-700 hover:underline">
                          Settings
                        </Link>{" "}
                        first.
                      </p>
                    )}
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
                    <button type="submit" disabled={loading || noDestinations || !notificationDestinationId} className="btn-accent">
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

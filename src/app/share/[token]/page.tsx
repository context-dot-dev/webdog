import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { PublicMonitorCard } from "@/components/public-monitor-card";
import { WebsiteStatusChip } from "@/components/website-status-chip";
import { ExpandableText } from "@/components/expandable-text";
import { buildProductPriceSeries } from "@/lib/product-price-history";
import { latestContentForTarget } from "@/lib/target-fetch-history";
import { alertAttributionText, alertTitleForDisplay } from "@/lib/alert-display";
import type { MonitorAlert } from "@/components/monitor-card";
import { APP_NAME } from "@/lib/product-info";

export const dynamic = "force-dynamic";

async function loadShared(token: string) {
  const [website] = await db
    .select()
    .from(schema.website)
    .where(eq(schema.website.publicShareToken, token))
    .limit(1);
  return website ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const website = await loadShared(token);
  if (!website) return { title: `${APP_NAME}` };
  const name = website.title ?? website.name;
  return {
    title: `${name} — change monitor`,
    description: `A live, read-only view of what changed on ${website.domain}, powered by ${APP_NAME}.`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const website = await loadShared(token);
  if (!website) notFound();

  const [targets, alerts, recentSnapshots] = await Promise.all([
    db.select().from(schema.target).where(eq(schema.target.websiteId, website.id)).orderBy(desc(schema.target.createdAt)),
    db.select().from(schema.alert).where(eq(schema.alert.websiteId, website.id)).orderBy(desc(schema.alert.createdAt)).limit(100),
    db
      .select()
      .from(schema.snapshot)
      .where(eq(schema.snapshot.websiteId, website.id))
      .orderBy(desc(schema.snapshot.createdAt))
      .limit(200),
  ]);

  const attribution = alertAttributionText();

  const changesByTarget = new Map<string, MonitorAlert[]>();
  for (const a of alerts) {
    const list = changesByTarget.get(a.targetId) ?? [];
    list.push({ alert: a, titleLabel: alertTitleForDisplay(a.title) });
    changesByTarget.set(a.targetId, list);
  }

  const enabledTargets = targets.filter((t) => t.enabled);
  const checkedTimestamps = targets
    .map((t) => (t.lastCheckedAt ? Number(t.lastCheckedAt) : null))
    .filter((v): v is number => v !== null);
  const lastRunAt = checkedTimestamps.length ? Math.max(...checkedTimestamps) : null;
  const unreadCount = alerts.filter((a) => !a.read).length;

  return (
    <div className="min-h-dvh bg-brand-50/40">
      <div className="border-b border-neutral-950/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <div className="flex items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">
              <span className="size-1.5 rounded-full bg-neutral-400" aria-hidden />
              Read-only shared view
            </span>
          </div>
          <Link
            href="/"
            className="btn-primary box-border inline-flex h-8 items-center !px-3 !py-0 text-xs"
          >
            Monitor your own site
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
        <header className="overflow-hidden rounded-2xl bg-white shadow-xs ring-1 ring-neutral-950/5">
          <div className="relative h-40 bg-neutral-100 sm:h-48">
            {website.heroScreenshotUrl || website.backdropUrl ? (
              <img
                src={website.heroScreenshotUrl ?? website.backdropUrl ?? ""}
                alt=""
                className="absolute inset-0 size-full object-cover object-top"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-brand-100 via-brand-50 to-white" />
            )}
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white/90 via-white/40 to-transparent" />
          </div>

          <div className="relative px-5 pb-5 sm:px-8 sm:pb-8">
            <div className="-mt-10 flex size-20 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-xs ring-1 ring-neutral-950/10">
              {website.logoUrl ? (
                <img src={website.logoUrl} alt="" className="size-14 object-contain" />
              ) : (
                <span className="font-mono text-2xl font-semibold text-brand-700">
                  {website.domain[0]?.toUpperCase() ?? "W"}
                </span>
              )}
            </div>

            <div className="mt-4 min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-neutral-900">
                {website.title ?? website.name}
              </h1>
              <a
                href={website.url}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-1 inline-block truncate font-mono text-xs text-neutral-500 hover:text-brand-700"
              >
                {website.url}
              </a>
              {website.description && (
                <ExpandableText text={website.description} className="mt-3 max-w-2xl" />
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <WebsiteStatusChip lastRunAt={lastRunAt} unreadCount={unreadCount} />
                <span className="text-neutral-500">
                  {enabledTargets.length} of {targets.length} monitor
                  {targets.length === 1 ? "" : "s"} active
                </span>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-8">
          <h2 className="text-base font-semibold text-neutral-900">Monitors</h2>
          <p className="mt-1 text-sm text-neutral-600">What&rsquo;s being watched and everything that has changed.</p>

          {targets.length === 0 ? (
            <div className="mt-4 rounded-2xl bg-white p-10 text-center ring-1 ring-neutral-950/5">
              <p className="text-sm text-neutral-600">No monitors on this site yet.</p>
            </div>
          ) : (
            <ul role="list" className="mt-4 space-y-4">
              {targets.map((t) => (
                <PublicMonitorCard
                  key={t.id}
                  target={t}
                  websiteUrl={website.url}
                  changes={changesByTarget.get(t.id) ?? []}
                  currentContent={latestContentForTarget(t, recentSnapshots)}
                  productPriceHistory={buildProductPriceSeries(t, recentSnapshots)}
                  attribution={attribution}
                />
              ))}
            </ul>
          )}
        </section>

        <footer className="mt-12 border-t border-neutral-950/5 pt-6 text-center text-xs text-neutral-500">
          Powered by{" "}
          <Link href="/" className="text-brand-700 hover:underline">
            {APP_NAME}
          </Link>{" "}
          · website change monitoring with Context.dev
        </footer>
      </div>
    </div>
  );
}

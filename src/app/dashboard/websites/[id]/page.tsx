import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requireUser } from "@/lib/session";
import { AddTargetDialog } from "@/components/add-target-dialog";
import { websiteOwnerAccessible } from "@/lib/account-access";
import { MonitorCard, type MonitorAlert } from "@/components/monitor-card";
import { RunNowButton } from "@/components/run-now-button";
import { DeleteWebsiteButton } from "@/components/delete-website-button";
import { ExpandableText } from "@/components/expandable-text";
import { WebsiteStatusChip } from "@/components/website-status-chip";
import { ShareWebsiteButton } from "@/components/share-website-button";
import { buildProductPriceSeries } from "@/lib/product-price-history";
import { latestContentForTarget } from "@/lib/target-fetch-history";
import { resolveAiSummaryConfig } from "@/lib/ai-change-summary";
import { alertAttributionText, alertTitleForDisplay } from "@/lib/alert-display";
import { isResendApiKeyManagedByEnv, isResendSendFromEmailManagedByEnv } from "@/lib/server-managed-config";

export default async function WebsiteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ target?: string; edit?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { target: highlightedTargetId, edit: editParam } = await searchParams;
  const wantTargetEdit = editParam === "1" || editParam === "true";

  const [website] = await db
    .select()
    .from(schema.website)
    .where(and(eq(schema.website.id, id), websiteOwnerAccessible(user.id)))
    .limit(1);
  if (!website) notFound();

  const [targets, alerts, recentSnapshots, notificationDestChoices, aiSettings] = await Promise.all([
    db.select().from(schema.target).where(eq(schema.target.websiteId, id)).orderBy(desc(schema.target.createdAt)),
    db.select().from(schema.alert).where(eq(schema.alert.websiteId, id)).orderBy(desc(schema.alert.createdAt)).limit(100),
    db
      .select()
      .from(schema.snapshot)
      .where(eq(schema.snapshot.websiteId, id))
      .orderBy(desc(schema.snapshot.createdAt))
      .limit(200),
    db
      .select({
        id: schema.notificationDestination.id,
        channel: schema.notificationDestination.channel,
        name: schema.notificationDestination.name,
      })
      .from(schema.notificationDestination)
      .where(eq(schema.notificationDestination.userId, website.userId))
      .orderBy(asc(schema.notificationDestination.name)),
    db
      .select({
        aiProvider: schema.userNotificationSettings.aiProvider,
        openaiApiKey: schema.userNotificationSettings.openaiApiKey,
        vercelAiGatewayApiKey: schema.userNotificationSettings.vercelAiGatewayApiKey,
        aiModel: schema.userNotificationSettings.aiModel,
      })
      .from(schema.userNotificationSettings)
      .where(eq(schema.userNotificationSettings.userId, website.userId))
      .limit(1),
  ]);

  const aiSummaryConfigured = Boolean(
    aiSettings[0] &&
      resolveAiSummaryConfig({
        aiProvider: aiSettings[0].aiProvider,
        openaiApiKey: aiSettings[0].openaiApiKey,
        vercelAiGatewayApiKey: aiSettings[0].vercelAiGatewayApiKey,
        aiModel: aiSettings[0].aiModel,
      }),
  );

  const attribution = alertAttributionText();
  const resendApiKeyManaged = isResendApiKeyManagedByEnv();
  const resendSendFromEmailManaged = isResendSendFromEmailManagedByEnv();

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
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <nav className="mb-6 text-sm" aria-label="Breadcrumb">
        <Link href="/dashboard" className="text-neutral-500 hover:text-neutral-900">
          Websites
        </Link>
        <span className="mx-2 text-neutral-300">/</span>
        <span className="text-neutral-900">{website.name}</span>
      </nav>

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
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-4">
            <div className="flex size-20 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-xs ring-1 ring-neutral-950/10">
              {website.logoUrl ? (
                <img src={website.logoUrl} alt="" className="size-14 object-contain" />
              ) : (
                <span className="font-mono text-2xl font-semibold text-brand-700">
                  {website.domain[0]?.toUpperCase() ?? "W"}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ShareWebsiteButton websiteId={website.id} initialShareToken={website.publicShareToken} />
              <RunNowButton websiteId={website.id} />
              <DeleteWebsiteButton websiteId={website.id} />
            </div>
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
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Your WebDogs</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Each watcher watches something specific and shows its changes here.
            </p>
          </div>
          <AddTargetDialog
            websiteId={website.id}
            websiteDomain={website.domain}
            destinations={notificationDestChoices}
            resendApiKeyManaged={resendApiKeyManaged}
            resendSendFromEmailManaged={resendSendFromEmailManaged}
          />
        </div>

        {targets.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-white p-10 text-center ring-1 ring-neutral-950/5">
            <p className="text-sm text-neutral-600">No monitors yet. Add one to start watching.</p>
          </div>
        ) : (
          <ul role="list" className="mt-4 space-y-4">
            {targets.map((t) => (
              <MonitorCard
                key={t.id}
                target={t}
                websiteId={website.id}
                websiteUrl={website.url}
                destinations={notificationDestChoices}
                changes={changesByTarget.get(t.id) ?? []}
                currentContent={latestContentForTarget(t, recentSnapshots)}
                productPriceHistory={buildProductPriceSeries(t, recentSnapshots)}
                aiSummaryConfigured={aiSummaryConfigured}
                attribution={attribution}
                resendApiKeyManaged={resendApiKeyManaged}
                resendSendFromEmailManaged={resendSendFromEmailManaged}
                highlightEdit={wantTargetEdit && t.id === highlightedTargetId}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}


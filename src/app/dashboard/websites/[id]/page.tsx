import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requireUser } from "@/lib/session";
import { AddTargetDialog } from "@/components/add-target-dialog";
import { TargetRow } from "@/components/target-row";
import { AlertItem } from "@/components/alert-item";
import { RunNowButton } from "@/components/run-now-button";
import { DeleteWebsiteButton } from "@/components/delete-website-button";
import { RelativeTime } from "@/components/relative-time";
import { ExpandableText } from "@/components/expandable-text";

export default async function WebsiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const [website] = await db
    .select()
    .from(schema.website)
    .where(and(eq(schema.website.id, id), eq(schema.website.userId, user.id)))
    .limit(1);
  if (!website) notFound();

  const [targets, alerts] = await Promise.all([
    db.select().from(schema.target).where(eq(schema.target.websiteId, id)).orderBy(desc(schema.target.createdAt)),
    db.select().from(schema.alert).where(eq(schema.alert.websiteId, id)).orderBy(desc(schema.alert.createdAt)).limit(50),
  ]);

  // Derive last-run status. All targets touched in a single runWebsiteChecks()
  // batch get their lastCheckedAt set together, so the max is the run timestamp.
  // Anything within RUN_WINDOW_MS of that timestamp is part of the same run.
  const RUN_WINDOW_MS = 5 * 60 * 1000;
  const enabledTargets = targets.filter((t) => t.enabled);
  const checkedTimestamps = targets
    .map((t) => (t.lastCheckedAt ? Number(t.lastCheckedAt) : null))
    .filter((v): v is number => v !== null);
  const lastRunAt = checkedTimestamps.length ? Math.max(...checkedTimestamps) : null;
  const targetsInLastRun = lastRunAt
    ? targets.filter(
        (t) => t.lastCheckedAt && lastRunAt - Number(t.lastCheckedAt) <= RUN_WINDOW_MS,
      ).length
    : 0;
  const alertsInLastRun = lastRunAt
    ? alerts.filter((a) => Math.abs(Number(a.createdAt) - lastRunAt) <= RUN_WINDOW_MS).length
    : 0;

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
          {website.backdropUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={website.backdropUrl}
              alt=""
              className="absolute inset-0 size-full object-cover"
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
                // eslint-disable-next-line @next/next/no-img-element
                <img src={website.logoUrl} alt="" className="size-14 object-contain" />
              ) : (
                <span className="font-mono text-2xl font-semibold text-brand-700">
                  {website.domain[0]?.toUpperCase() ?? "W"}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
          </div>
        </div>
      </header>

      <section className="mt-8">
        <h2 className="sr-only">Last check</h2>
        <LastCheckPanel
          lastRunAt={lastRunAt}
          targetsInLastRun={targetsInLastRun}
          enabledTargetCount={enabledTargets.length}
          alertsInLastRun={alertsInLastRun}
        />
      </section>

      <section className="mt-10">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Targets</h2>
            <p className="mt-1 text-sm text-neutral-600">What should trigger an alert for this site.</p>
          </div>
          <AddTargetDialog websiteId={website.id} />
        </div>

        {targets.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-white p-10 text-center ring-1 ring-neutral-950/5">
            <p className="text-sm text-neutral-600">No targets yet. Add one to start watching.</p>
          </div>
        ) : (
          <ul role="list" className="mt-4 divide-y divide-neutral-950/5 overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-950/5">
            {targets.map((t) => (
              <TargetRow key={t.id} target={t} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Activity</h2>
            <p className="mt-1 text-sm text-neutral-600">
              The most recent alerts for this website.{" "}
              {alerts[0] && (
                <>
                  Last change <RelativeTime date={new Date(Number(alerts[0].createdAt))} />.
                </>
              )}
            </p>
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-white p-10 text-center ring-1 ring-neutral-950/5">
            <p className="text-sm text-neutral-600">
              No changes detected yet. Alerts appear here once the worker completes its first comparison.
            </p>
          </div>
        ) : (
          <ul role="list" className="mt-4 divide-y divide-neutral-950/5 overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-950/5">
            {alerts.map((a) => (
              <AlertItem key={a.id} alert={a} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function LastCheckPanel({
  lastRunAt,
  targetsInLastRun,
  enabledTargetCount,
  alertsInLastRun,
}: {
  lastRunAt: number | null;
  targetsInLastRun: number;
  enabledTargetCount: number;
  alertsInLastRun: number;
}) {
  if (!lastRunAt) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 ring-1 ring-neutral-950/5">
        <span className="inline-flex size-2 rounded-full bg-neutral-300" aria-hidden />
        <div className="text-sm text-neutral-600">
          No checks have run yet.{" "}
          {enabledTargetCount === 0
            ? "Add a target to start watching."
            : "The worker will run shortly, or use Run now."}
        </div>
      </div>
    );
  }

  const clean = alertsInLastRun === 0;
  const dotClass = clean ? "bg-emerald-500" : "bg-amber-500";
  const resultLabel = clean
    ? "All clear — no changes detected"
    : `${alertsInLastRun} change${alertsInLastRun === 1 ? "" : "s"} detected`;
  const resultClass = clean ? "text-emerald-700" : "text-amber-700";

  return (
    <div className="rounded-2xl bg-white px-5 py-4 ring-1 ring-neutral-950/5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex items-center gap-3">
          <span className={`inline-flex size-2 rounded-full ${dotClass}`} aria-hidden />
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Last check
            </div>
            <div className="mt-0.5 text-sm text-neutral-900">
              <RelativeTime date={new Date(lastRunAt)} />
              <span className="ml-2 text-neutral-500">
                · {targetsInLastRun} of {enabledTargetCount} target
                {enabledTargetCount === 1 ? "" : "s"} checked
              </span>
            </div>
          </div>
        </div>
        <div className={`text-sm font-medium ${resultClass}`}>{resultLabel}</div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requireUser } from "@/lib/session";
import { AddWebsiteDialog } from "@/components/add-website-dialog";
import { RelativeTime } from "@/components/relative-time";

export default async function DashboardPage() {
  const user = await requireUser();

  // Correlated subqueries via Drizzle's `sql` template drop table qualifiers,
  // so outer-table column refs silently bind to the inner table. Use grouped
  // subqueries with LEFT JOINs instead.
  const targetStats = db
    .select({
      websiteId: schema.target.websiteId,
      targetCount: sql<number>`COUNT(*)`.as("targetCount"),
      lastCheckedAt: sql<number | null>`MAX(${schema.target.lastCheckedAt})`.as("lastCheckedAt"),
    })
    .from(schema.target)
    .groupBy(schema.target.websiteId)
    .as("target_stats");

  const alertStats = db
    .select({
      websiteId: schema.alert.websiteId,
      unreadAlerts: sql<number>`SUM(CASE WHEN ${schema.alert.read} = 0 THEN 1 ELSE 0 END)`.as("unreadAlerts"),
    })
    .from(schema.alert)
    .groupBy(schema.alert.websiteId)
    .as("alert_stats");

  const websites = await db
    .select({
      id: schema.website.id,
      name: schema.website.name,
      url: schema.website.url,
      domain: schema.website.domain,
      title: schema.website.title,
      description: schema.website.description,
      logoUrl: schema.website.logoUrl,
      backdropUrl: schema.website.backdropUrl,
      createdAt: schema.website.createdAt,
      targetCount: sql<number>`COALESCE(${targetStats.targetCount}, 0)`,
      unreadAlerts: sql<number>`COALESCE(${alertStats.unreadAlerts}, 0)`,
      lastCheckedAt: targetStats.lastCheckedAt,
    })
    .from(schema.website)
    .leftJoin(targetStats, eq(targetStats.websiteId, schema.website.id))
    .leftJoin(alertStats, eq(alertStats.websiteId, schema.website.id))
    .where(eq(schema.website.userId, user.id))
    .orderBy(desc(schema.website.createdAt));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Websites</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Every site you&apos;re watching. Add a new one to start tracking changes.
          </p>
        </div>
        <AddWebsiteDialog />
      </header>

      <section className="mt-8">
        {websites.length === 0 ? (
          <EmptyState />
        ) : (
          <ul
            role="list"
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
          >
            {websites.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/dashboard/websites/${w.id}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-xs ring-1 ring-neutral-950/5 transition hover:shadow-card hover:ring-neutral-950/10"
                >
                  <div className="relative h-28 bg-neutral-100">
                    {w.backdropUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={w.backdropUrl}
                        alt=""
                        className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-brand-100 via-brand-50 to-white" />
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/90 via-white/40 to-transparent" />
                    {Number(w.unreadAlerts) > 0 && (
                      <span className="absolute right-3 top-3 inline-flex items-center rounded-full bg-brand-500 px-2 py-0.5 text-xs font-medium text-white shadow-xs ring-1 ring-brand-600/20">
                        {Number(w.unreadAlerts)} new
                      </span>
                    )}
                  </div>

                  <div className="relative flex flex-1 flex-col px-5 pb-5">
                    <div className="-mt-7 flex size-14 items-center justify-center overflow-hidden rounded-xl bg-white shadow-xs ring-1 ring-neutral-950/10">
                      {w.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={w.logoUrl}
                          alt=""
                          className="size-10 object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <span className="font-mono text-lg font-semibold text-brand-700">
                          {w.domain[0]?.toUpperCase() ?? "W"}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 min-w-0">
                      <h2 className="truncate text-sm font-semibold text-neutral-900">
                        {w.title ?? w.name}
                      </h2>
                      <div className="mt-0.5 truncate font-mono text-xs text-neutral-500">
                        {w.domain}
                      </div>
                    </div>

                    <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm text-neutral-600">
                      {w.description ?? "No description available yet."}
                    </p>

                    <dl className="mt-4 flex items-center justify-between border-t border-neutral-950/5 pt-3">
                      <Stat label="Targets" value={String(w.targetCount ?? 0)} />
                      <Stat
                        align="right"
                        label="Last check"
                        value={
                          w.lastCheckedAt ? (
                            <RelativeTime date={new Date(Number(w.lastCheckedAt))} />
                          ) : (
                            "never"
                          )
                        }
                      />
                    </dl>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  align = "left",
}: {
  label: string;
  value: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <div className={`flex flex-col ${align === "right" ? "text-right" : "text-left"}`}>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="tabular-nums text-sm font-medium text-neutral-900">{value}</dd>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-16 text-center ring-1 ring-neutral-950/5">
      <div className="flex size-12 items-center justify-center rounded-full bg-brand-50 ring-1 ring-brand-500/20">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-5 text-brand-600">
          <circle cx="8" cy="8" r="6" />
          <path d="M2 8h12M8 2a9 9 0 0 1 0 12M8 2a9 9 0 0 0 0 12" />
        </svg>
      </div>
      <h2 className="mt-4 text-base font-medium text-neutral-900">No websites yet</h2>
      <p className="mt-1 max-w-[40ch] text-pretty text-sm text-neutral-600">
        Add a website to start watching for new links, removed links, or content changes.
      </p>
      <div className="mt-6">
        <AddWebsiteDialog />
      </div>
    </div>
  );
}

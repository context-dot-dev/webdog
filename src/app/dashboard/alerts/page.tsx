import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requireUser } from "@/lib/session";
import { AlertItem } from "@/components/alert-item";
import { websiteOwnerAccessible } from "@/lib/account-access";
import { MarkAllAlertsReadButton } from "@/components/mark-all-alerts-read-button";

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ alert?: string; diff?: string }>;
}) {
  const user = await requireUser();
  const { alert: alertParam, diff: diffParam } = await searchParams;
  const wantDiffScroll = diffParam === "1" || diffParam === "true";

  const [rows, unreadRow] = await Promise.all([
    db
      .select({
        alert: schema.alert,
        websiteId: schema.website.id,
        websiteName: schema.website.name,
        websiteDomain: schema.website.domain,
      })
      .from(schema.alert)
      .innerJoin(schema.website, eq(schema.website.id, schema.alert.websiteId))
      .where(websiteOwnerAccessible(user.id))
      .orderBy(desc(schema.alert.createdAt))
      .limit(100),
    db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(schema.alert)
      .innerJoin(schema.website, eq(schema.website.id, schema.alert.websiteId))
      .where(and(websiteOwnerAccessible(user.id), eq(schema.alert.read, false))),
  ]);

  const unreadAlertsCount = unreadRow[0]?.n ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Alerts</h1>
          <p className="mt-2 text-sm text-neutral-600">Every change detected across your websites.</p>
        </div>
        <MarkAllAlertsReadButton unreadCount={unreadAlertsCount} />
      </header>

      <section className="mt-8">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl bg-white p-12 text-center ring-1 ring-neutral-900/5">
            <div className="grid size-14 place-items-center rounded-3xl bg-mint text-3xl ring-1 ring-neutral-900/5">
              ✨
            </div>
            <p className="mt-4 text-base font-semibold text-neutral-900">All quiet on the web.</p>
            <p className="mt-1 max-w-[40ch] text-pretty text-sm text-neutral-600">
              Nothing here yet — alerts appear the moment changes are detected.
            </p>
          </div>
        ) : (
          <ul
            role="list"
            className="divide-y divide-neutral-900/10 overflow-hidden rounded-3xl bg-white ring-1 ring-neutral-900/5"
          >
            {rows.map(({ alert, websiteId, websiteName, websiteDomain }) => (
              <AlertItem
                key={alert.id}
                alert={alert}
                highlighted={alertParam !== undefined && alert.id === alertParam}
                scrollToDiff={wantDiffScroll && alertParam === alert.id}
                website={{
                  id: websiteId,
                  name: websiteName,
                  domain: websiteDomain,
                }}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

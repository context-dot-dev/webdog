import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requireUser } from "@/lib/session";
import { AlertItem } from "@/components/alert-item";

export default async function AlertsPage() {
  const user = await requireUser();

  const rows = await db
    .select({
      alert: schema.alert,
      websiteId: schema.website.id,
      websiteName: schema.website.name,
      websiteDomain: schema.website.domain,
    })
    .from(schema.alert)
    .innerJoin(schema.website, eq(schema.website.id, schema.alert.websiteId))
    .where(eq(schema.website.userId, user.id))
    .orderBy(desc(schema.alert.createdAt))
    .limit(100);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Alerts</h1>
        <p className="mt-1 text-sm text-neutral-600">Every change detected across your websites.</p>
      </header>

      <section className="mt-8">
        {rows.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center ring-1 ring-neutral-950/5">
            <p className="text-sm text-neutral-600">
              Nothing here yet. Alerts appear once changes are detected.
            </p>
          </div>
        ) : (
          <ul
            role="list"
            className="divide-y divide-neutral-950/10 overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-950/5"
          >
            {rows.map(({ alert, websiteId, websiteName, websiteDomain }) => (
              <AlertItem
                key={alert.id}
                alert={alert}
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

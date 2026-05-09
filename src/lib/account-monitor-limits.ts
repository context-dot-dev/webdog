import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "./db";
import * as schema from "./db/schema";
import { maxAlertsPerAccount } from "./server-managed-config";

async function countEnabledMonitors(
  ownerUserId: string,
  excludingTargetId?: string,
): Promise<number> {
  const where = excludingTargetId
    ? and(
        eq(schema.website.userId, ownerUserId),
        eq(schema.target.enabled, true),
        ne(schema.target.id, excludingTargetId),
      )
    : and(
        eq(schema.website.userId, ownerUserId),
        eq(schema.target.enabled, true),
      );

  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(schema.target)
    .innerJoin(schema.website, eq(schema.website.id, schema.target.websiteId))
    .where(where);
  return row?.n ?? 0;
}

export async function monitorLimitError(
  ownerUserId: string,
  options?: { adding?: number; excludingTargetId?: string },
): Promise<string | null> {
  const limit = maxAlertsPerAccount();
  if (limit === null) return null;

  const current = await countEnabledMonitors(
    ownerUserId,
    options?.excludingTargetId,
  );
  const adding = options?.adding ?? 1;
  if (current + adding <= limit) return null;
  return `This account can have up to ${limit} active monitor${limit === 1 ? "" : "s"}.`;
}

import { and, eq, exists, or, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "./db";
import * as schema from "./db/schema";

/**
 * `website.userId` is the account owner. The row is visible if the viewer is that user
 * or a member of that account.
 */
export function websiteOwnerAccessible(viewerUserId: string) {
  return or(
    eq(schema.website.userId, viewerUserId),
    exists(
      db
        .select({ _: sql`1` })
        .from(schema.accountMembership)
        .where(
          and(
            eq(schema.accountMembership.ownerUserId, schema.website.userId),
            eq(schema.accountMembership.memberUserId, viewerUserId),
          ),
        ),
    ),
  );
}

/**
 * Tables keyed by owning user id (destinations, notification settings) use the same rule.
 */
export function accountOwnerColumnAccessible(ownerUserIdColumn: AnyPgColumn, viewerUserId: string) {
  return or(
    eq(ownerUserIdColumn, viewerUserId),
    exists(
      db
        .select({ _: sql`1` })
        .from(schema.accountMembership)
        .where(
          and(
            eq(schema.accountMembership.ownerUserId, ownerUserIdColumn),
            eq(schema.accountMembership.memberUserId, viewerUserId),
          ),
        ),
    ),
  );
}

export async function userCanAccessAccountOwner(viewerUserId: string, ownerUserId: string) {
  if (viewerUserId === ownerUserId) return true;
  const [row] = await db
    .select({ one: sql`1` })
    .from(schema.accountMembership)
    .where(
      and(
        eq(schema.accountMembership.ownerUserId, ownerUserId),
        eq(schema.accountMembership.memberUserId, viewerUserId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

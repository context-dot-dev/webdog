import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

/**
 * Best-effort snapshot for invite UX — from onboarding data already in PostgreSQL (website brand copy or profile name).
 * Does not call Context.dev live.
 */
export async function resolveOrganizationLabelForInvite(ownerUserId: string): Promise<string | null> {
  const [site] = await db
    .select({
      title: schema.website.title,
      name: schema.website.name,
    })
    .from(schema.website)
    .where(eq(schema.website.userId, ownerUserId))
    .orderBy(desc(schema.website.createdAt))
    .limit(1);

  const fromSite = site?.title?.trim() ?? site?.name?.trim();
  if (fromSite) return fromSite;

  const [u] = await db
    .select({ name: schema.user.name })
    .from(schema.user)
    .where(eq(schema.user.id, ownerUserId))
    .limit(1);
  const n = u?.name?.trim();
  return n?.length ? n : null;
}

import { NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { badRequest, getApiUser, notFound, parseJson, requireApiUserWithWriteOwner } from "@/lib/api";
import { websiteOwnerAccessible } from "@/lib/account-access";
import { stringifyWebsiteNotificationDestinationIds } from "@/lib/website-notification-destinations";

const patchSchema = z.object({
  notificationDestinationIds: z.array(z.string().min(1)).nullable(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await getApiUser();
  if (!user) return response;
  const { id } = await params;

  const [website] = await db
    .select()
    .from(schema.website)
    .where(and(eq(schema.website.id, id), websiteOwnerAccessible(user.id)))
    .limit(1);
  if (!website) return notFound("Website not found");

  const [targets, alerts] = await Promise.all([
    db.select().from(schema.target).where(eq(schema.target.websiteId, id)).orderBy(desc(schema.target.createdAt)),
    db
      .select()
      .from(schema.alert)
      .where(eq(schema.alert.websiteId, id))
      .orderBy(desc(schema.alert.createdAt))
      .limit(50),
  ]);

  return NextResponse.json({ website, targets, alerts });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, ownerId, response } = await requireApiUserWithWriteOwner();
  if (!user || !ownerId) return response!;
  const { id } = await params;

  const [website] = await db
    .select()
    .from(schema.website)
    .where(and(eq(schema.website.id, id), eq(schema.website.userId, ownerId), websiteOwnerAccessible(user.id)))
    .limit(1);
  if (!website) return notFound("Website not found");

  const parsed = await parseJson(req, patchSchema);
  if (parsed.response) return parsed.response;

  const ids = parsed.data.notificationDestinationIds;
  if (ids !== null && ids.length > 0) {
    const found = await db
      .select({ id: schema.notificationDestination.id })
      .from(schema.notificationDestination)
      .where(
        and(
          eq(schema.notificationDestination.userId, ownerId),
          inArray(schema.notificationDestination.id, ids),
        ),
      );
    if (found.length !== ids.length) {
      return badRequest("One or more notification destinations are invalid");
    }
  }

  const stored =
    ids === null ? null : stringifyWebsiteNotificationDestinationIds(ids);

  await db
    .update(schema.website)
    .set({ notificationDestinationIds: stored })
    .where(eq(schema.website.id, id));

  const [updated] = await db
    .select()
    .from(schema.website)
    .where(eq(schema.website.id, id))
    .limit(1);

  return NextResponse.json({ website: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, ownerId, response } = await requireApiUserWithWriteOwner();
  if (!user || !ownerId) return response!;
  const { id } = await params;

  const result = await db
    .delete(schema.website)
    .where(
      and(eq(schema.website.id, id), eq(schema.website.userId, ownerId), websiteOwnerAccessible(user.id)),
    )
    .returning({ id: schema.website.id });
  if (result.length === 0) return notFound("Website not found");
  return NextResponse.json({ ok: true });
}

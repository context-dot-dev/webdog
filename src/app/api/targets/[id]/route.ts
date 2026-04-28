import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import type { LinkScope } from "@/lib/db/schema";
import * as schema from "@/lib/db/schema";
import { badRequest, getApiUser, notFound, parseJson } from "@/lib/api";

async function loadOwned(userId: string, targetId: string) {
  const rows = await db
    .select({ target: schema.target, website: schema.website })
    .from(schema.target)
    .innerJoin(schema.website, eq(schema.website.id, schema.target.websiteId))
    .where(and(eq(schema.target.id, targetId), eq(schema.website.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await getApiUser();
  if (!user) return response;
  const { id } = await params;

  const owned = await loadOwned(user.id, id);
  if (!owned) return notFound("Target not found");

  await db.delete(schema.target).where(eq(schema.target.id, id));
  return NextResponse.json({ ok: true });
}

const patchSchema = z
  .object({
    enabled: z.boolean().optional(),
    checkIntervalHours: z.number().int().min(1).max(8760).optional(),
    notificationDestinationId: z.union([z.string().min(1), z.null()]).optional(),
    linkScope: z.enum(["NEW", "REMOVED", "BOTH"]).optional(),
  })
  .refine(
    (d) =>
      d.enabled !== undefined ||
      d.checkIntervalHours !== undefined ||
      d.notificationDestinationId !== undefined ||
      d.linkScope !== undefined,
    {
      message: "At least one field to update is required",
    },
  );

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await getApiUser();
  if (!user) return response;
  const { id } = await params;

  const owned = await loadOwned(user.id, id);
  if (!owned) return notFound("Target not found");

  const parsed = await parseJson(req, patchSchema);
  if (parsed.response) return parsed.response;

  if (parsed.data.notificationDestinationId !== undefined && parsed.data.notificationDestinationId !== null) {
    const [dest] = await db
      .select({ id: schema.notificationDestination.id })
      .from(schema.notificationDestination)
      .where(
        and(
          eq(schema.notificationDestination.id, parsed.data.notificationDestinationId),
          eq(schema.notificationDestination.userId, user.id),
        ),
      )
      .limit(1);
    if (!dest) return badRequest("Unknown notification destination");
  }

  if (parsed.data.linkScope !== undefined && owned.target.kind !== "SITEMAP_LINKS") {
    return badRequest("linkScope applies only to site links targets");
  }

  const updates: {
    enabled?: boolean;
    checkIntervalHours?: number;
    notificationDestinationId?: string | null;
    linkScope?: LinkScope;
  } = {};
  if (parsed.data.enabled !== undefined) updates.enabled = parsed.data.enabled;
  if (parsed.data.checkIntervalHours !== undefined) updates.checkIntervalHours = parsed.data.checkIntervalHours;
  if (parsed.data.notificationDestinationId !== undefined) {
    updates.notificationDestinationId = parsed.data.notificationDestinationId;
  }
  if (parsed.data.linkScope !== undefined) updates.linkScope = parsed.data.linkScope;

  await db.update(schema.target).set(updates).where(eq(schema.target.id, id));
  const [updated] = await db.select().from(schema.target).where(eq(schema.target.id, id)).limit(1);
  return NextResponse.json({ target: updated });
}

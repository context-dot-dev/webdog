import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import type { LinkScope } from "@/lib/db/schema";
import * as schema from "@/lib/db/schema";
import { badRequest, notFound, parseJson, requireApiUserWithWriteOwner } from "@/lib/api";
import { websiteOwnerAccessible } from "@/lib/account-access";
import { computeNextCheckDueAfterSuccess } from "@/lib/scraper";
import { monitorLimitError } from "@/lib/account-monitor-limits";

async function loadForWrite(sessionUserId: string, ownerId: string, targetId: string) {
  const rows = await db
    .select({ target: schema.target, website: schema.website })
    .from(schema.target)
    .innerJoin(schema.website, eq(schema.website.id, schema.target.websiteId))
    .where(
      and(
        eq(schema.target.id, targetId),
        eq(schema.website.userId, ownerId),
        websiteOwnerAccessible(sessionUserId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, ownerId, response } = await requireApiUserWithWriteOwner();
  if (!user || !ownerId) return response!;
  const { id } = await params;

  const owned = await loadForWrite(user.id, ownerId, id);
  if (!owned) return notFound("Target not found");

  await db.delete(schema.target).where(eq(schema.target.id, id));
  return NextResponse.json({ ok: true });
}

const patchSchema = z
  .object({
    enabled: z.boolean().optional(),
    checkIntervalHours: z.number().min(0.25).max(8760).optional(),
    notificationDestinationId: z.union([z.string().min(1), z.null()]).optional(),
    linkScope: z.enum(["NEW", "REMOVED", "BOTH"]).optional(),
    externalNotify: z.boolean().optional(),
    aiChangeSummaryEnabled: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.enabled !== undefined ||
      d.checkIntervalHours !== undefined ||
      d.notificationDestinationId !== undefined ||
      d.linkScope !== undefined ||
      d.externalNotify !== undefined ||
      d.aiChangeSummaryEnabled !== undefined,
    {
      message: "At least one field to update is required",
    },
  );

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, ownerId, response } = await requireApiUserWithWriteOwner();
  if (!user || !ownerId) return response!;
  const { id } = await params;

  const owned = await loadForWrite(user.id, ownerId, id);
  if (!owned) return notFound("Target not found");

  const parsed = await parseJson(req, patchSchema);
  if (parsed.response) return parsed.response;

  const extPart = parsed.data.externalNotify;
  const nidPart = parsed.data.notificationDestinationId;

  if (extPart === false && typeof nidPart === "string") {
    return badRequest("Cannot attach a destination to a dashboard-only target.");
  }

  if (typeof nidPart === "string") {
    const [dest] = await db
      .select({ id: schema.notificationDestination.id })
      .from(schema.notificationDestination)
      .where(
        and(
          eq(schema.notificationDestination.id, nidPart),
          eq(schema.notificationDestination.userId, ownerId),
        ),
      )
      .limit(1);
    if (!dest) return badRequest("Unknown notification destination");
  }

  if (parsed.data.linkScope !== undefined && owned.target.kind !== "SITEMAP_LINKS") {
    return badRequest("linkScope applies only to site links targets");
  }

  if (parsed.data.enabled === true && !owned.target.enabled) {
    const limitError = await monitorLimitError(ownerId, { excludingTargetId: id });
    if (limitError) return badRequest(limitError);
  }

  const updates: {
    enabled?: boolean;
    checkIntervalHours?: number;
    nextCheckDueAt?: Date | null;
    notificationDestinationId?: string | null;
    linkScope?: LinkScope;
    externalNotify?: boolean;
    aiChangeSummaryEnabled?: boolean;
  } = {};
  if (parsed.data.enabled !== undefined) updates.enabled = parsed.data.enabled;
  if (parsed.data.checkIntervalHours !== undefined) {
    updates.checkIntervalHours = parsed.data.checkIntervalHours;
    const last = owned.target.lastCheckedAt;
    updates.nextCheckDueAt =
      last != null
        ? computeNextCheckDueAfterSuccess(last, parsed.data.checkIntervalHours, Date.now())
        : null;
  }
  if (extPart !== undefined || nidPart !== undefined) {
    if (extPart === false) {
      updates.externalNotify = false;
      updates.notificationDestinationId = null;
    } else if (nidPart !== undefined) {
      if (nidPart !== null) {
        updates.notificationDestinationId = nidPart;
        updates.externalNotify = true;
      } else {
        updates.notificationDestinationId = null;
        updates.externalNotify = false;
      }
    } else if (extPart === true) {
      if (!owned.target.notificationDestinationId) {
        return badRequest("Select a notification destination before enabling external alerts.");
      }
      updates.externalNotify = true;
    }
  }
  if (parsed.data.linkScope !== undefined) updates.linkScope = parsed.data.linkScope;
  if (parsed.data.aiChangeSummaryEnabled !== undefined) {
    updates.aiChangeSummaryEnabled = parsed.data.aiChangeSummaryEnabled;
  }

  await db.update(schema.target).set(updates).where(eq(schema.target.id, id));
  const [updated] = await db.select().from(schema.target).where(eq(schema.target.id, id)).limit(1);
  return NextResponse.json({ target: updated });
}

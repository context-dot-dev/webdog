import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { notFound, parseJson, badRequest, requireApiUserWithWriteOwner } from "@/lib/api";
import { websiteOwnerAccessible } from "@/lib/account-access";
import { newId } from "@/lib/ids";
import { monitorLimitError } from "@/lib/account-monitor-limits";
import { isUrlWithinDomain } from "@/lib/domain";

const watchNoteSchema = z.string().trim().max(300).optional();

const createSchema = z.discriminatedUnion("category", [
  z.object({
    category: z.literal("LINK"),
    notificationDestinationId: z.string().optional(),
    externalNotify: z.boolean().optional(),
    checkIntervalHours: z.number().min(0.25).max(8760).optional(),
    aiChangeSummaryEnabled: z.boolean().optional(),
    watchNote: watchNoteSchema,
  }),
  z.object({
    category: z.literal("PAGE_CONTENT"),
    pageUrl: z.string().url(),
    notificationDestinationId: z.string().optional(),
    externalNotify: z.boolean().optional(),
    checkIntervalHours: z.number().min(0.25).max(8760).optional(),
    aiChangeSummaryEnabled: z.boolean().optional(),
    watchNote: watchNoteSchema,
  }),
  z.object({
    category: z.literal("PRODUCT_PRICE"),
    pageUrl: z.string().url(),
    notificationDestinationId: z.string().optional(),
    externalNotify: z.boolean().optional(),
    checkIntervalHours: z.number().min(0.25).max(8760).optional(),
    aiChangeSummaryEnabled: z.boolean().optional(),
    watchNote: watchNoteSchema,
  }),
]);

async function resolveNotificationDestinationId(
  ownerUserId: string,
  provided: string | undefined,
): Promise<string | null> {
  const t = provided?.trim();
  if (t) {
    const [row] = await db
      .select({ id: schema.notificationDestination.id })
      .from(schema.notificationDestination)
      .where(
        and(
          eq(schema.notificationDestination.id, t),
          eq(schema.notificationDestination.userId, ownerUserId),
        ),
      )
      .limit(1);
    if (!row) return null;
    return row.id;
  }
  const rows = await db
    .select({ id: schema.notificationDestination.id })
    .from(schema.notificationDestination)
    .where(eq(schema.notificationDestination.userId, ownerUserId));
  if (rows.length === 1) return rows[0].id;
  return null;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, ownerId, response } = await requireApiUserWithWriteOwner();
  if (!user || !ownerId) return response!;
  const { id } = await params;

  const [website] = await db
    .select()
    .from(schema.website)
    .where(and(eq(schema.website.id, id), eq(schema.website.userId, ownerId), websiteOwnerAccessible(user.id)))
    .limit(1);
  if (!website) return notFound("Website not found");

  const parsed = await parseJson(req, createSchema);
  if (parsed.response) return parsed.response;

  const limitError = await monitorLimitError(ownerId);
  if (limitError) return badRequest(limitError);

  const wantOutbound = parsed.data.externalNotify !== false;
  const providedDest = parsed.data.notificationDestinationId?.trim();
  if (!wantOutbound && providedDest)
    return badRequest("Dashboard-only targets cannot include a notification destination");

  let destId: string | null = null;
  if (wantOutbound) {
    destId = await resolveNotificationDestinationId(ownerId, parsed.data.notificationDestinationId);
    if (!destId) {
      return badRequest("Select a notification destination, or choose dashboard-only alerts.");
    }
  }

  const checkIntervalHours = parsed.data.checkIntervalHours ?? 24;
  const aiChangeSummaryEnabled = parsed.data.aiChangeSummaryEnabled ?? false;
  const watchNote = parsed.data.watchNote?.trim() || null;

  const created: (typeof schema.target.$inferSelect)[] = [];

  if (parsed.data.category === "LINK") {
    const existingLink = await db
      .select({ id: schema.target.id })
      .from(schema.target)
      .where(
        and(
          eq(schema.target.websiteId, id),
          eq(schema.target.kind, "SITEMAP_LINKS"),
          isNull(schema.target.pageUrl),
        ),
      )
      .limit(1);
    if (existingLink.length > 0) {
      return badRequest("A site links target already exists for this website.");
    }

    const targetId = newId("tgt");
    await db.insert(schema.target).values({
      id: targetId,
      websiteId: id,
      kind: "SITEMAP_LINKS",
      linkScope: "BOTH",
      pageUrl: null,
      watchNote,
      notificationDestinationId: destId,
      externalNotify: wantOutbound,
      enabled: true,
      checkIntervalHours,
      aiChangeSummaryEnabled,
      createdAt: new Date(),
    });
    const [row] = await db.select().from(schema.target).where(eq(schema.target.id, targetId)).limit(1);
    if (row) created.push(row);

    return NextResponse.json({ targets: created }, { status: 201 });
  }

  const kind =
    parsed.data.category === "PAGE_CONTENT" ? ("PAGE_CONTENT" as const) : ("PRODUCT_PRICE" as const);
  const pageUrl = parsed.data.pageUrl;

  // A monitor must watch a page on the website it belongs to.
  if (!isUrlWithinDomain(pageUrl, website.domain)) {
    return badRequest(`This monitor must be a page on ${website.domain}.`);
  }

  const existing = await db
    .select({ id: schema.target.id })
    .from(schema.target)
    .where(
      and(eq(schema.target.websiteId, id), eq(schema.target.kind, kind), eq(schema.target.pageUrl, pageUrl)),
    )
    .limit(1);
  if (existing.length > 0) return badRequest("That target already exists for this website.");

  const targetId = newId("tgt");
  await db.insert(schema.target).values({
    id: targetId,
    websiteId: id,
    kind,
    pageUrl,
    watchNote,
    notificationDestinationId: destId,
    externalNotify: wantOutbound,
    enabled: true,
    checkIntervalHours,
    aiChangeSummaryEnabled,
    createdAt: new Date(),
  });

  const [row] = await db.select().from(schema.target).where(eq(schema.target.id, targetId)).limit(1);
  return NextResponse.json({ targets: row ? [row] : [] }, { status: 201 });
}

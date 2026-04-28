import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getApiUser, notFound, parseJson, badRequest } from "@/lib/api";
import { newId } from "@/lib/ids";

const createSchema = z.discriminatedUnion("category", [
  z.object({
    category: z.literal("LINK"),
    notificationDestinationId: z.string().optional(),
  }),
  z.object({
    category: z.literal("PAGE_CONTENT"),
    pageUrl: z.string().url(),
    notificationDestinationId: z.string().optional(),
  }),
  z.object({
    category: z.literal("PRODUCT_PRICE"),
    pageUrl: z.string().url(),
    notificationDestinationId: z.string().optional(),
  }),
]);

async function resolveNotificationDestinationId(
  userId: string,
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
          eq(schema.notificationDestination.userId, userId),
        ),
      )
      .limit(1);
    if (!row) return null;
    return row.id;
  }
  const rows = await db
    .select({ id: schema.notificationDestination.id })
    .from(schema.notificationDestination)
    .where(eq(schema.notificationDestination.userId, userId));
  if (rows.length === 1) return rows[0].id;
  return null;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await getApiUser();
  if (!user) return response;
  const { id } = await params;

  const [website] = await db
    .select()
    .from(schema.website)
    .where(and(eq(schema.website.id, id), eq(schema.website.userId, user.id)))
    .limit(1);
  if (!website) return notFound("Website not found");

  const parsed = await parseJson(req, createSchema);
  if (parsed.response) return parsed.response;

  const destId = await resolveNotificationDestinationId(
    user.id,
    parsed.data.notificationDestinationId,
  );
  if (!destId) {
    return badRequest(
      "Select a notification destination, or add exactly one in Settings to use it by default.",
    );
  }

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
      notificationDestinationId: destId,
      enabled: true,
      checkIntervalHours: 1,
      createdAt: new Date(),
    });
    const [row] = await db.select().from(schema.target).where(eq(schema.target.id, targetId)).limit(1);
    if (row) created.push(row);

    return NextResponse.json({ targets: created }, { status: 201 });
  }

  const kind =
    parsed.data.category === "PAGE_CONTENT" ? ("PAGE_CONTENT" as const) : ("PRODUCT_PRICE" as const);
  const pageUrl = parsed.data.pageUrl;
  const checkIntervalHours = kind === "PRODUCT_PRICE" ? 24 : 1;

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
    notificationDestinationId: destId,
    enabled: true,
    checkIntervalHours,
    createdAt: new Date(),
  });

  const [row] = await db.select().from(schema.target).where(eq(schema.target.id, targetId)).limit(1);
  return NextResponse.json({ targets: row ? [row] : [] }, { status: 201 });
}

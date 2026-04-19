import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getApiUser, notFound, parseJson, badRequest } from "@/lib/api";
import { newId } from "@/lib/ids";

const kinds = ["NEW_LINK", "REMOVED_LINK", "PAGE_CONTENT"] as const;
const createSchema = z
  .object({
    kind: z.enum(kinds),
    pageUrl: z.string().url().optional(),
  })
  .refine((v) => v.kind !== "PAGE_CONTENT" || !!v.pageUrl, {
    message: "pageUrl is required for PAGE_CONTENT targets",
    path: ["pageUrl"],
  });

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

  // No duplicate targets of the same kind+url.
  const existing = await db
    .select({ id: schema.target.id })
    .from(schema.target)
    .where(
      and(
        eq(schema.target.websiteId, id),
        eq(schema.target.kind, parsed.data.kind),
        parsed.data.pageUrl ? eq(schema.target.pageUrl, parsed.data.pageUrl) : eq(schema.target.pageUrl, ""),
      ),
    )
    .limit(1);
  if (existing.length > 0) return badRequest("That target already exists for this website.");

  const targetId = newId("tgt");
  await db.insert(schema.target).values({
    id: targetId,
    websiteId: id,
    kind: parsed.data.kind,
    pageUrl: parsed.data.pageUrl ?? null,
    enabled: true,
    createdAt: new Date(),
  });

  const [created] = await db.select().from(schema.target).where(eq(schema.target.id, targetId)).limit(1);
  return NextResponse.json({ target: created }, { status: 201 });
}

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getApiUser, notFound, parseJson } from "@/lib/api";

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

const patchSchema = z.object({ enabled: z.boolean() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await getApiUser();
  if (!user) return response;
  const { id } = await params;

  const owned = await loadOwned(user.id, id);
  if (!owned) return notFound("Target not found");

  const parsed = await parseJson(req, patchSchema);
  if (parsed.response) return parsed.response;

  await db.update(schema.target).set({ enabled: parsed.data.enabled }).where(eq(schema.target.id, id));
  const [updated] = await db.select().from(schema.target).where(eq(schema.target.id, id)).limit(1);
  return NextResponse.json({ target: updated });
}

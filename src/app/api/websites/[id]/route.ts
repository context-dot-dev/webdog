import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getApiUser, notFound } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await getApiUser();
  if (!user) return response;
  const { id } = await params;

  const [website] = await db
    .select()
    .from(schema.website)
    .where(and(eq(schema.website.id, id), eq(schema.website.userId, user.id)))
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

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await getApiUser();
  if (!user) return response;
  const { id } = await params;

  const result = await db
    .delete(schema.website)
    .where(and(eq(schema.website.id, id), eq(schema.website.userId, user.id)));
  if (result.changes === 0) return notFound("Website not found");
  return NextResponse.json({ ok: true });
}

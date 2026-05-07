import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getApiUser, notFound, parseJson } from "@/lib/api";
import { websiteOwnerAccessible } from "@/lib/account-access";

async function canAccessAlert(sessionUserId: string, alertId: string) {
  const rows = await db
    .select({ id: schema.alert.id })
    .from(schema.alert)
    .innerJoin(schema.website, eq(schema.website.id, schema.alert.websiteId))
    .where(and(eq(schema.alert.id, alertId), websiteOwnerAccessible(sessionUserId)))
    .limit(1);
  return rows.length > 0;
}

const patchSchema = z.object({ read: z.boolean() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await getApiUser();
  if (!user) return response;
  const { id } = await params;

  if (!(await canAccessAlert(user.id, id))) return notFound("Alert not found");

  const parsed = await parseJson(req, patchSchema);
  if (parsed.response) return parsed.response;

  await db.update(schema.alert).set({ read: parsed.data.read }).where(eq(schema.alert.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await getApiUser();
  if (!user) return response;
  const { id } = await params;

  if (!(await canAccessAlert(user.id, id))) return notFound("Alert not found");
  await db.delete(schema.alert).where(eq(schema.alert.id, id));
  return NextResponse.json({ ok: true });
}

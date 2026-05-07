import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getApiUser, notFound, parseJson } from "@/lib/api";
import { websiteOwnerAccessible } from "@/lib/account-access";

const bodySchema = z.object({ websiteId: z.string().optional() });

export async function POST(req: Request) {
  const { user, response } = await getApiUser();
  if (!user) return response;

  const parsed = await parseJson(req, bodySchema);
  if (parsed.response) return parsed.response;
  const { websiteId } = parsed.data;

  if (websiteId) {
    const [owned] = await db
      .select({ id: schema.website.id })
      .from(schema.website)
      .where(and(eq(schema.website.id, websiteId), websiteOwnerAccessible(user.id)))
      .limit(1);
    if (!owned) return notFound("Website not found");

    await db
      .update(schema.alert)
      .set({ read: true })
      .where(and(eq(schema.alert.websiteId, websiteId), eq(schema.alert.read, false)));
  } else {
    const sites = await db
      .select({ id: schema.website.id })
      .from(schema.website)
      .where(websiteOwnerAccessible(user.id));
    const ids = sites.map((s) => s.id);
    if (ids.length > 0) {
      await db
        .update(schema.alert)
        .set({ read: true })
        .where(and(inArray(schema.alert.websiteId, ids), eq(schema.alert.read, false)));
    }
  }

  return NextResponse.json({ ok: true });
}

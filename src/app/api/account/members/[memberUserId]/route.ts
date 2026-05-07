import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getApiUser, notFound } from "@/lib/api";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

type RouteParams = { params: Promise<{ memberUserId: string }> };

export async function DELETE(_req: Request, ctx: RouteParams) {
  const { user, response } = await getApiUser();
  if (!user) return response;

  const { memberUserId } = await ctx.params;
  if (!memberUserId || memberUserId === user.id) {
    return notFound("Member not found.");
  }

  const result = await db
    .delete(schema.accountMembership)
    .where(
      and(
        eq(schema.accountMembership.ownerUserId, user.id),
        eq(schema.accountMembership.memberUserId, memberUserId),
      ),
    )
    .returning({ memberUserId: schema.accountMembership.memberUserId });

  if (result.length === 0) {
    return notFound("Member not found.");
  }

  return NextResponse.json({ ok: true });
}

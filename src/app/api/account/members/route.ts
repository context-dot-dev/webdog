import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getApiUser } from "@/lib/api";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export async function GET() {
  const { user, response } = await getApiUser();
  if (!user) return response;

  const rows = await db
    .select({
      userId: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      joinedAt: schema.accountMembership.createdAt,
    })
    .from(schema.accountMembership)
    .innerJoin(schema.user, eq(schema.user.id, schema.accountMembership.memberUserId))
    .where(eq(schema.accountMembership.ownerUserId, user.id))
    .orderBy(asc(schema.user.name), asc(schema.user.email));

  return NextResponse.json({ members: rows });
}

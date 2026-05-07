import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getApiUser } from "@/lib/api";
import { websiteOwnerAccessible } from "@/lib/account-access";

export async function GET() {
  const { user, response } = await getApiUser();
  if (!user) return response;

  const rows = await db
    .select({
      alert: schema.alert,
      websiteName: schema.website.name,
      websiteDomain: schema.website.domain,
    })
    .from(schema.alert)
    .innerJoin(schema.website, eq(schema.website.id, schema.alert.websiteId))
    .where(websiteOwnerAccessible(user.id))
    .orderBy(desc(schema.alert.createdAt))
    .limit(100);

  return NextResponse.json({ alerts: rows });
}

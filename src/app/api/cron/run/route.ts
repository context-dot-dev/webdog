import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getApiUser, notFound, parseJson } from "@/lib/api";
import { websiteOwnerAccessible } from "@/lib/account-access";
import { runWebsiteChecks } from "@/lib/scraper";

const bodySchema = z.object({
  websiteId: z.string().min(1),
  targetId: z.string().min(1).optional(),
});

/** Manual-trigger endpoint. Lets the UI say "check now" without waiting for cron. */
export async function POST(req: Request) {
  const { user, response } = await getApiUser();
  if (!user) return response;

  const parsed = await parseJson(req, bodySchema);
  if (parsed.response) return parsed.response;

  const [website] = await db
    .select({ id: schema.website.id })
    .from(schema.website)
    .where(and(eq(schema.website.id, parsed.data.websiteId), websiteOwnerAccessible(user.id)))
    .limit(1);
  if (!website) return notFound("Website not found");

  if (parsed.data.targetId) {
    const [target] = await db
      .select({ id: schema.target.id })
      .from(schema.target)
      .where(and(eq(schema.target.id, parsed.data.targetId), eq(schema.target.websiteId, website.id)))
      .limit(1);
    if (!target) return notFound("Target not found");
  }

  const result = await runWebsiteChecks(website.id, {
    force: true,
    ...(parsed.data.targetId ? { targetId: parsed.data.targetId } : {}),
  });
  return NextResponse.json(result);
}

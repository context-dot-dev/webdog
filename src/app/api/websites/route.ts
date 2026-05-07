import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { badRequest, getApiUser, parseJson, requireApiUserWithWriteOwner } from "@/lib/api";
import { websiteOwnerAccessible } from "@/lib/account-access";
import { newId } from "@/lib/ids";
import {
  ContextDevError,
  normalizeDomain,
  pickBrandAssets,
  retrieveBrand,
  scrapeScreenshot,
} from "@/lib/context-client";

export async function GET() {
  const { user, response } = await getApiUser();
  if (!user) return response;

  const rows = await db
    .select({
      id: schema.website.id,
      name: schema.website.name,
      url: schema.website.url,
      domain: schema.website.domain,
      title: schema.website.title,
      description: schema.website.description,
      logoUrl: schema.website.logoUrl,
      heroScreenshotUrl: schema.website.heroScreenshotUrl,
      backdropUrl: schema.website.backdropUrl,
      createdAt: schema.website.createdAt,
      targetCount: sql<number>`(SELECT COUNT(*) FROM ${schema.target} WHERE ${schema.target.websiteId} = ${schema.website.id})`,
      alertCount: sql<number>`(SELECT COUNT(*) FROM ${schema.alert} WHERE ${schema.alert.websiteId} = ${schema.website.id} AND ${schema.alert.read} = 0)`,
    })
    .from(schema.website)
    .where(websiteOwnerAccessible(user.id))
    .orderBy(desc(schema.website.createdAt));

  return NextResponse.json({ websites: rows });
}

const createSchema = z.object({
  domain: z.string().trim().min(1).max(253),
});

export async function POST(req: Request) {
  const { user, ownerId, response } = await requireApiUserWithWriteOwner();
  if (!user || !ownerId) return response!;

  const parsed = await parseJson(req, createSchema);
  if (parsed.response) return parsed.response;

  const domain = normalizeDomain(parsed.data.domain);
  if (!domain) return badRequest("Enter a valid domain like example.com");

  const [settings] = await db
    .select({ contextDevApiKey: schema.userNotificationSettings.contextDevApiKey })
    .from(schema.userNotificationSettings)
    .where(eq(schema.userNotificationSettings.userId, ownerId))
    .limit(1);
  const contextKey = settings?.contextDevApiKey?.trim() || null;

  const hasContextKey = Boolean(
    (contextKey?.trim() || process.env.CONTEXT_DEV_API_KEY?.trim() || undefined),
  );

  let assets = pickBrandAssets(null);
  let heroScreenshotUrl: string | null = null;

  await Promise.all([
    (async () => {
      if (!hasContextKey) return;
      try {
        const brand = await retrieveBrand(domain, { apiKey: contextKey });
        assets = pickBrandAssets(brand);
      } catch (err) {
        if (err instanceof ContextDevError && err.status !== 404) {
          console.warn(`retrieveBrand(${domain}) failed:`, err.message);
        }
      }
    })(),
    (async () => {
      if (!hasContextKey) return;
      try {
        const shot = await scrapeScreenshot({ domain, apiKey: contextKey, prioritize: "quality" });
        if (shot.screenshot) heroScreenshotUrl = shot.screenshot;
      } catch (err) {
        if (err instanceof ContextDevError) {
          console.warn(`scrapeScreenshot(${domain}) failed:`, err.message);
        } else {
          throw err;
        }
      }
    })(),
  ]);

  const id = newId("web");
  await db.insert(schema.website).values({
    id,
    userId: ownerId,
    name: assets.title ?? domain,
    url: `https://${domain}`,
    domain,
    title: assets.title,
    description: assets.description,
    logoUrl: assets.logoUrl,
    heroScreenshotUrl,
    backdropUrl: assets.backdropUrl,
    createdAt: new Date(),
  });

  const [created] = await db
    .select()
    .from(schema.website)
    .where(and(eq(schema.website.id, id), eq(schema.website.userId, ownerId), websiteOwnerAccessible(user.id)))
    .limit(1);

  return NextResponse.json({ website: created }, { status: 201 });
}

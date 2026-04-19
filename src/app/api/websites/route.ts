import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { badRequest, getApiUser, parseJson } from "@/lib/api";
import { newId } from "@/lib/ids";
import {
  ContextDevError,
  normalizeDomain,
  pickBrandAssets,
  retrieveBrand,
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
      backdropUrl: schema.website.backdropUrl,
      createdAt: schema.website.createdAt,
      targetCount: sql<number>`(SELECT COUNT(*) FROM ${schema.target} WHERE ${schema.target.websiteId} = ${schema.website.id})`,
      alertCount: sql<number>`(SELECT COUNT(*) FROM ${schema.alert} WHERE ${schema.alert.websiteId} = ${schema.website.id} AND ${schema.alert.read} = 0)`,
    })
    .from(schema.website)
    .where(eq(schema.website.userId, user.id))
    .orderBy(desc(schema.website.createdAt));

  return NextResponse.json({ websites: rows });
}

const createSchema = z.object({
  domain: z.string().trim().min(1).max(253),
});

export async function POST(req: Request) {
  const { user, response } = await getApiUser();
  if (!user) return response;

  const parsed = await parseJson(req, createSchema);
  if (parsed.response) return parsed.response;

  const domain = normalizeDomain(parsed.data.domain);
  if (!domain) return badRequest("Enter a valid domain like example.com");

  let assets = pickBrandAssets(null);
  try {
    const brand = await retrieveBrand(domain);
    assets = pickBrandAssets(brand);
  } catch (err) {
    if (err instanceof ContextDevError && err.status !== 404) {
      console.warn(`retrieveBrand(${domain}) failed:`, err.message);
    }
  }

  const id = newId("web");
  await db.insert(schema.website).values({
    id,
    userId: user.id,
    name: assets.title ?? domain,
    url: `https://${domain}`,
    domain,
    title: assets.title,
    description: assets.description,
    logoUrl: assets.logoUrl,
    backdropUrl: assets.backdropUrl,
    createdAt: new Date(),
  });

  const [created] = await db
    .select()
    .from(schema.website)
    .where(and(eq(schema.website.id, id), eq(schema.website.userId, user.id)))
    .limit(1);

  return NextResponse.json({ website: created }, { status: 201 });
}

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { notFound, requireApiUserWithWriteOwner } from "@/lib/api";
import { websiteOwnerAccessible } from "@/lib/account-access";

function newShareToken(): string {
  return randomBytes(18).toString("base64url");
}

async function ownedWebsite(id: string, ownerId: string, userId: string) {
  const [row] = await db
    .select()
    .from(schema.website)
    .where(and(eq(schema.website.id, id), eq(schema.website.userId, ownerId), websiteOwnerAccessible(userId)))
    .limit(1);
  return row ?? null;
}

/** Enable a read-only public share link (idempotent — keeps existing token). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, ownerId, response } = await requireApiUserWithWriteOwner();
  if (!user || !ownerId) return response!;
  const { id } = await params;

  const website = await ownedWebsite(id, ownerId, user.id);
  if (!website) return notFound("Website not found");

  let token = website.publicShareToken;
  if (!token) {
    token = newShareToken();
    await db.update(schema.website).set({ publicShareToken: token }).where(eq(schema.website.id, id));
  }

  return NextResponse.json({ publicShareToken: token });
}

/** Disable the public share link. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, ownerId, response } = await requireApiUserWithWriteOwner();
  if (!user || !ownerId) return response!;
  const { id } = await params;

  const website = await ownedWebsite(id, ownerId, user.id);
  if (!website) return notFound("Website not found");

  await db.update(schema.website).set({ publicShareToken: null }).where(eq(schema.website.id, id));
  return NextResponse.json({ ok: true });
}

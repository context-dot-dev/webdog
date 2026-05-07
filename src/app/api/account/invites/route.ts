import { NextResponse } from "next/server";
import { and, desc, eq, gt, lt } from "drizzle-orm";
import { resolveOrganizationLabelForInvite } from "@/lib/account-invite-organization-label";
import { authPublicBaseUrl } from "@/lib/auth";
import { requireApiUserWithWriteOwner } from "@/lib/api";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { canManageTeamInvites } from "@/lib/effective-account";
import { INVITE_EXPIRY_MS, INVITE_MAX_USES } from "@/lib/invite-constants";
import { generateInviteRawToken, hashInviteToken } from "@/lib/invite-token";
import { newId } from "@/lib/ids";

function inviteUrl(rawToken: string) {
  const base = authPublicBaseUrl.replace(/\/+$/, "");
  return `${base}/invite/${encodeURIComponent(rawToken)}`;
}

export async function GET() {
  const { user, ownerId, response } = await requireApiUserWithWriteOwner();
  if (!user || !ownerId) return response!;
  if (!canManageTeamInvites(user.id, ownerId)) {
    return NextResponse.json(
      { error: "Only the account owner can manage team invites." },
      { status: 403 },
    );
  }

  const now = new Date();
  const rows = await db
    .select({
      id: schema.accountInvite.id,
      expiresAt: schema.accountInvite.expiresAt,
      createdAt: schema.accountInvite.createdAt,
      useCount: schema.accountInvite.useCount,
      maxUses: schema.accountInvite.maxUses,
    })
    .from(schema.accountInvite)
    .where(
      and(
        eq(schema.accountInvite.ownerUserId, ownerId),
        lt(schema.accountInvite.useCount, schema.accountInvite.maxUses),
        gt(schema.accountInvite.expiresAt, now),
      ),
    )
    .orderBy(desc(schema.accountInvite.createdAt));

  return NextResponse.json({ invites: rows });
}

export async function POST() {
  const { user, ownerId, response } = await requireApiUserWithWriteOwner();
  if (!user || !ownerId) return response!;
  if (!canManageTeamInvites(user.id, ownerId)) {
    return NextResponse.json(
      { error: "Only the account owner can manage team invites." },
      { status: 403 },
    );
  }

  const rawToken = generateInviteRawToken();
  const tokenHash = hashInviteToken(rawToken);
  const id = newId("inv");
  const now = Date.now();
  const organizationLabel = await resolveOrganizationLabelForInvite(ownerId);

  await db.insert(schema.accountInvite).values({
    id,
    ownerUserId: ownerId,
    tokenHash,
    expiresAt: new Date(now + INVITE_EXPIRY_MS),
    createdAt: new Date(now),
    createdByUserId: user.id,
    organizationLabel: organizationLabel ?? null,
    maxUses: INVITE_MAX_USES,
    useCount: 0,
  });

  return NextResponse.json({
    id,
    inviteUrl: inviteUrl(rawToken),
    expiresAt: new Date(now + INVITE_EXPIRY_MS),
  });
}

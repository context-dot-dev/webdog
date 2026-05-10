import { NextResponse } from "next/server";
import { and, count, eq, lt, sql } from "drizzle-orm";
import { getApiUser, badRequest, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { hashInviteToken } from "@/lib/invite-token";
import { z } from "zod";

const bodySchema = z.object({
  token: z.string().min(8, "Invalid invite"),
});

export async function POST(req: Request) {
  const { user, response } = await getApiUser();
  if (!user) return response;

  const parsed = await parseJson(req, bodySchema);
  if (parsed.response) return parsed.response;

  const raw = parsed.data.token.trim();
  const tokenHash = hashInviteToken(raw);
  const now = new Date();

  type InviteRedeemOutcome =
    | "ok_new"
    | "ok_existing"
    | "not_found"
    | "used"
    | "expired"
    | "self";

  const {
    outcome,
    ownerUserIdForClient,
    skippedIntroSideEffects,
  } = await db.transaction(async (tx): Promise<{
    outcome: InviteRedeemOutcome;
    ownerUserIdForClient: string | null;
    skippedIntroSideEffects: boolean;
  }> => {
    const [inv] = await tx
      .select()
      .from(schema.accountInvite)
      .where(eq(schema.accountInvite.tokenHash, tokenHash))
      .limit(1);

    if (!inv) {
      return {
        outcome: "not_found" as const,
        ownerUserIdForClient: null,
        skippedIntroSideEffects: false,
      };
    }

    const ownerUserIdForClient = inv.ownerUserId;

    if (inv.expiresAt.getTime() <= now.getTime()) {
      return {
        outcome: "expired" as const,
        ownerUserIdForClient,
        skippedIntroSideEffects: false,
      };
    }

    if (inv.ownerUserId === user.id) {
      return {
        outcome: "self" as const,
        ownerUserIdForClient,
        skippedIntroSideEffects: false,
      };
    }

    const [existingMember] = await tx
      .select({ _: schema.accountMembership.memberUserId })
      .from(schema.accountMembership)
      .where(
        and(
          eq(schema.accountMembership.ownerUserId, inv.ownerUserId),
          eq(schema.accountMembership.memberUserId, user.id),
        ),
      )
      .limit(1);

    if (existingMember) {
      return {
        outcome: "ok_existing" as const,
        ownerUserIdForClient,
        skippedIntroSideEffects: true,
      };
    }

    if (inv.useCount >= inv.maxUses) {
      return {
        outcome: "used" as const,
        ownerUserIdForClient,
        skippedIntroSideEffects: false,
      };
    }

    const inserted = await tx
      .insert(schema.accountMembership)
      .values({
        ownerUserId: inv.ownerUserId,
        memberUserId: user.id,
        createdAt: now,
      })
      .onConflictDoNothing({
        target: [
          schema.accountMembership.ownerUserId,
          schema.accountMembership.memberUserId,
        ],
      })
      .returning({ memberUserId: schema.accountMembership.memberUserId });

    if (inserted.length === 0) {
      return {
        outcome: "ok_existing" as const,
        ownerUserIdForClient,
        skippedIntroSideEffects: true,
      };
    }

    const bumped = await tx
      .update(schema.accountInvite)
      .set({
        useCount: sql`${schema.accountInvite.useCount} + 1`,
        redeemedAt: now,
        redeemedByUserId: user.id,
      })
      .where(
        and(
          eq(schema.accountInvite.id, inv.id),
          lt(schema.accountInvite.useCount, schema.accountInvite.maxUses),
        ),
      )
      .returning({ id: schema.accountInvite.id });

    if (bumped.length === 0) {
      // Optimistic membership insert then compensating delete: between those
      // statements the row exists only inside this transaction; other
      // connections cannot observe it until commit.
      await tx
        .delete(schema.accountMembership)
        .where(
          and(
            eq(schema.accountMembership.ownerUserId, inv.ownerUserId),
            eq(schema.accountMembership.memberUserId, user.id),
          ),
        );
      return {
        outcome: "used" as const,
        ownerUserIdForClient,
        skippedIntroSideEffects: false,
      };
    }

    return {
      outcome: "ok_new" as const,
      ownerUserIdForClient,
      skippedIntroSideEffects: false,
    };
  });

  if (outcome === "not_found") {
    return badRequest("This invite link is not valid.");
  }
  if (outcome === "used") {
    return badRequest("This invite has reached its member limit. Ask for a new link.");
  }
  if (outcome === "expired") {
    return badRequest("This invite has expired. Ask for a new link.");
  }
  if (outcome === "self") {
    return badRequest("You cannot accept an invite to your own account.");
  }

  if (!skippedIntroSideEffects) {
    const [ownedRow] = await db
      .select({ c: count() })
      .from(schema.website)
      .where(eq(schema.website.userId, user.id));

    const [urow] = await db
      .select({ intro: schema.user.contextIntroDismissedAt })
      .from(schema.user)
      .where(eq(schema.user.id, user.id))
      .limit(1);

    const siteCount = Number(ownedRow?.c ?? 0);
    if (siteCount === 0 && urow?.intro == null) {
      await db
        .update(schema.user)
        .set({ contextIntroDismissedAt: now, updatedAt: now })
        .where(eq(schema.user.id, user.id));
    }
  }

  return NextResponse.json({
    ok: true,
    ownerUserId: ownerUserIdForClient ?? undefined,
  });
}

import { NextResponse } from "next/server";
import { and, eq, lt } from "drizzle-orm";
import { notFound, requireApiUserWithWriteOwner } from "@/lib/api";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { canManageTeamInvites } from "@/lib/effective-account";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: RouteParams) {
  const { user, ownerId, response } = await requireApiUserWithWriteOwner();
  if (!user || !ownerId) return response!;
  if (!canManageTeamInvites(user.id, ownerId)) {
    return NextResponse.json(
      { error: "Only the account owner can manage team invites." },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;

  const result = await db
    .delete(schema.accountInvite)
    .where(
      and(
        eq(schema.accountInvite.id, id),
        eq(schema.accountInvite.ownerUserId, ownerId),
        lt(schema.accountInvite.useCount, schema.accountInvite.maxUses),
      ),
    )
    .returning({ id: schema.accountInvite.id });

  if (result.length > 0) {
    return NextResponse.json({ ok: true });
  }

  const [existing] = await db
    .select({ useCount: schema.accountInvite.useCount, maxUses: schema.accountInvite.maxUses })
    .from(schema.accountInvite)
    .where(
      and(eq(schema.accountInvite.id, id), eq(schema.accountInvite.ownerUserId, ownerId)),
    )
    .limit(1);

  if (!existing) {
    return notFound("Invite not found.");
  }

  if (existing.useCount >= existing.maxUses) {
    return NextResponse.json(
      {
        error:
          "This invite has been fully used. The link no longer works; revoke only applies to invites that can still be redeemed.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ error: "Could not revoke this invite. Try again." }, { status: 409 });
}

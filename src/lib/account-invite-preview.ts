import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { hashInviteToken } from "@/lib/invite-token";

export type InvitePreview = {
  valid: boolean;
  organizationLabel: string | null;
};

/** Public-facing preview from raw token (no auth). Does not expose invite id or owner id. */
export async function previewInviteFromRawToken(rawToken: string): Promise<InvitePreview> {
  const t = rawToken.trim();
  if (t.length < 8) {
    return { valid: false, organizationLabel: null };
  }

  const tokenHash = hashInviteToken(t);
  const now = new Date();

  const [inv] = await db
    .select({
      organizationLabel: schema.accountInvite.organizationLabel,
      expiresAt: schema.accountInvite.expiresAt,
      useCount: schema.accountInvite.useCount,
      maxUses: schema.accountInvite.maxUses,
    })
    .from(schema.accountInvite)
    .where(eq(schema.accountInvite.tokenHash, tokenHash))
    .limit(1);

  if (!inv) {
    return { valid: false, organizationLabel: null };
  }

  const exhausted = inv.useCount >= inv.maxUses;
  const expired = inv.expiresAt.getTime() <= now.getTime();

  return {
    valid: !expired && !exhausted,
    organizationLabel: inv.organizationLabel?.trim() ?? null,
  };
}

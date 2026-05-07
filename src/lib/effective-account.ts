import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "./db";
import * as schema from "./db/schema";

export const WD_ACCOUNT_COOKIE = "wd_account";
/** Persist active account preference for the browser session (~1 year). */
export const WD_ACCOUNT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type AccountChoice = {
  ownerId: string;
  label: string;
  kind: "self" | "shared";
};

export async function memberOwnerIds(memberUserId: string): Promise<string[]> {
  const rows = await db
    .select({ ownerUserId: schema.accountMembership.ownerUserId })
    .from(schema.accountMembership)
    .where(eq(schema.accountMembership.memberUserId, memberUserId))
    .orderBy(asc(schema.accountMembership.ownerUserId));
  return rows.map((r) => r.ownerUserId);
}

async function ownsAnyWebsite(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ _: sql`1` })
    .from(schema.website)
    .where(eq(schema.website.userId, userId))
    .limit(1);
  return Boolean(row);
}

/** Accounts the user may select (personal workspace + invited accounts). */
export async function loadAccountChoices(sessionUserId: string): Promise<AccountChoice[]> {
  const hasPersonalSites = await ownsAnyWebsite(sessionUserId);
  const ownerIdsFromMembership = await memberOwnerIds(sessionUserId);

  const choices: AccountChoice[] = [];

  if (hasPersonalSites) {
    choices.push({
      ownerId: sessionUserId,
      label: "Personal",
      kind: "self",
    });
  }

  if (ownerIdsFromMembership.length === 0) {
    return choices;
  }

  const owners = await db
    .select({ id: schema.user.id, name: schema.user.name, email: schema.user.email })
    .from(schema.user)
    .where(inArray(schema.user.id, ownerIdsFromMembership));

  const byId = new Map(owners.map((u) => [u.id, u]));
  for (const oid of ownerIdsFromMembership) {
    const u = byId.get(oid);
    const label =
      u?.name?.trim()?.length ?? 0 ? (u!.name ?? "") : (u?.email ?? `Team ${oid.slice(0, 8)}…`);
    choices.push({ ownerId: oid, label, kind: "shared" });
  }

  return choices;
}

async function inferDefaultOwnerId(sessionUserId: string): Promise<string | null> {
  const hasPersonal = await ownsAnyWebsite(sessionUserId);
  if (hasPersonal) return sessionUserId;
  const members = await memberOwnerIds(sessionUserId);
  if (members.length === 1) return members[0] ?? null;
  return null;
}

/**
 * Validates `wd_account` cookie, else infers single-choice default.
 * Returns `needsSelection` when multiple shared accounts exist and no valid cookie.
 */
export async function getEffectiveAccountOwnerForWrites(sessionUserId: string): Promise<
  | { ok: true; ownerId: string }
  | { ok: false; needsSelection: true; message: string }
> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(WD_ACCOUNT_COOKIE)?.value;

  async function validated(ownerId: string | undefined | null): Promise<string | null> {
    if (!ownerId) return null;
    if (ownerId === sessionUserId) return ownerId;
    const [mem] = await db
      .select({ _: sql`1` })
      .from(schema.accountMembership)
      .where(
        and(
          eq(schema.accountMembership.ownerUserId, ownerId),
          eq(schema.accountMembership.memberUserId, sessionUserId),
        ),
      )
      .limit(1);
    return mem ? ownerId : null;
  }

  const fromCookie = await validated(raw);
  if (fromCookie) return { ok: true, ownerId: fromCookie };

  const inferred = await inferDefaultOwnerId(sessionUserId);
  if (inferred) return { ok: true, ownerId: inferred };

  const owners = await memberOwnerIds(sessionUserId);
  if (owners.length > 1) {
    return {
      ok: false,
      needsSelection: true,
      message: "Choose which account you are working in.",
    };
  }

  /** No owned sites and no memberships: first-time user before any site. */
  return { ok: true, ownerId: sessionUserId };
}

/**
 * Whether invite and member management UI/API apply. Only the account owner may manage
 * team invites; members on a shared account can use the dashboard but cannot issue invites.
 */
export function canManageTeamInvites(sessionUserId: string, effectiveOwnerId: string): boolean {
  return sessionUserId === effectiveOwnerId;
}

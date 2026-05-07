import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { badRequest, getApiUser, parseJson, requireApiUserWithWriteOwner } from "@/lib/api";
import { accountOwnerColumnAccessible } from "@/lib/account-access";
import { getEffectiveAccountOwnerForWrites } from "@/lib/effective-account";
import { ContextDevError, resolveAccountBrandLogoUrl } from "@/lib/context-client";

const patchSchema = z.object({
  contextDevApiKey: z.union([z.string(), z.null()]).optional(),
  resendApiKey: z.union([z.string(), z.null()]).optional(),
});

function normalizeContextKey(input: string | null | undefined): string | null {
  if (input === undefined || input === null) return null;
  const t = input.trim();
  return t === "" ? null : t;
}

function normalizeResendApiKey(input: string | null): string | null {
  if (input === null) return null;
  const t = input.trim();
  return t === "" ? null : t;
}

export async function GET() {
  const { user, response } = await getApiUser();
  if (!user) return response;

  const rows = await db
    .select({
      ownerUserId: schema.userNotificationSettings.userId,
      contextDevApiKey: schema.userNotificationSettings.contextDevApiKey,
      resendApiKey: schema.userNotificationSettings.resendApiKey,
    })
    .from(schema.userNotificationSettings)
    .where(accountOwnerColumnAccessible(schema.userNotificationSettings.userId, user.id));

  let contextDevApiKey: string | null = null;
  let resendApiKey: string | null = null;
  if (rows.length === 1) {
    contextDevApiKey = rows[0]!.contextDevApiKey ?? null;
    resendApiKey = rows[0]!.resendApiKey ?? null;
  } else if (rows.length > 1) {
    const scope = await getEffectiveAccountOwnerForWrites(user.id);
    if (scope.ok) {
      const row = rows.find((r) => r.ownerUserId === scope.ownerId);
      contextDevApiKey = row?.contextDevApiKey ?? null;
      resendApiKey = row?.resendApiKey ?? null;
    }
  }

  return NextResponse.json({
    contextDevApiKey,
    resendApiKey,
  });
}

export async function PATCH(req: Request) {
  const { user, ownerId, response } = await requireApiUserWithWriteOwner();
  if (!user || !ownerId) return response!;

  const parsed = await parseJson(req, patchSchema);
  if (parsed.response) return parsed.response;

  const { contextDevApiKey: keyIn, resendApiKey: resendIn } = parsed.data;
  if (keyIn === undefined && resendIn === undefined) {
    return badRequest("Provide contextDevApiKey and/or resendApiKey");
  }

  const [existing] = await db
    .select({
      contextDevApiKey: schema.userNotificationSettings.contextDevApiKey,
      resendApiKey: schema.userNotificationSettings.resendApiKey,
    })
    .from(schema.userNotificationSettings)
    .where(eq(schema.userNotificationSettings.userId, ownerId))
    .limit(1);

  let contextKey = existing?.contextDevApiKey ?? null;
  let resendKey = existing?.resendApiKey ?? null;

  if (keyIn !== undefined) {
    contextKey = normalizeContextKey(keyIn);
  }
  if (resendIn !== undefined) {
    resendKey = normalizeResendApiKey(resendIn);
  }

  let refreshedBrandLogoUrl: string | null | undefined;
  if (keyIn !== undefined) {
    if (!contextKey) {
      refreshedBrandLogoUrl = null;
    } else {
      const [ownerProfile] = await db
        .select({ email: schema.user.email })
        .from(schema.user)
        .where(eq(schema.user.id, ownerId))
        .limit(1);
      const ownerEmail = ownerProfile?.email?.trim() ?? "";
      if (!ownerEmail) {
        return badRequest("Account owner must have an email before saving a Context.dev key");
      }
      try {
        refreshedBrandLogoUrl = await resolveAccountBrandLogoUrl(ownerEmail, contextKey);
      } catch (e) {
        if (e instanceof ContextDevError) {
          const status = e.status === 401 || e.status === 403 ? e.status : 400;
          return NextResponse.json({ error: e.message }, { status });
        }
        throw e;
      }
    }
  }

  const now = new Date();

  await db
    .insert(schema.userNotificationSettings)
    .values({
      userId: ownerId,
      contextDevApiKey: contextKey,
      resendApiKey: resendKey,
      updatedAt: now,
      ...(refreshedBrandLogoUrl !== undefined ? { accountBrandLogoUrl: refreshedBrandLogoUrl } : {}),
    })
    .onConflictDoUpdate({
      target: schema.userNotificationSettings.userId,
      set: {
        contextDevApiKey: contextKey,
        resendApiKey: resendKey,
        updatedAt: now,
        ...(refreshedBrandLogoUrl !== undefined ? { accountBrandLogoUrl: refreshedBrandLogoUrl } : {}),
      },
    });

  return NextResponse.json({
    ok: true,
    contextDevApiKey: contextKey,
    resendApiKey: resendKey,
    ...(refreshedBrandLogoUrl !== undefined ? { accountBrandLogoUrl: refreshedBrandLogoUrl } : {}),
  });
}

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getApiUser, badRequest, parseJson } from "@/lib/api";
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

  const [row] = await db
    .select({
      contextDevApiKey: schema.userNotificationSettings.contextDevApiKey,
      resendApiKey: schema.userNotificationSettings.resendApiKey,
    })
    .from(schema.userNotificationSettings)
    .where(eq(schema.userNotificationSettings.userId, user.id))
    .limit(1);

  return NextResponse.json({
    contextDevApiKey: row?.contextDevApiKey ?? null,
    resendApiKey: row?.resendApiKey ?? null,
  });
}

export async function PATCH(req: Request) {
  const { user, response } = await getApiUser();
  if (!user) return response;

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
    .where(eq(schema.userNotificationSettings.userId, user.id))
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
    } else if (!user.email) {
      return badRequest("Add an email to your account before saving a Context.dev key");
    } else {
      try {
        refreshedBrandLogoUrl = await resolveAccountBrandLogoUrl(user.email, contextKey);
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
      userId: user.id,
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

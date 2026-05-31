import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import type { AiProvider } from "@/lib/db/schema";
import { badRequest, getApiUser, parseJson, requireApiUserWithWriteOwner } from "@/lib/api";
import { accountOwnerColumnAccessible } from "@/lib/account-access";
import { getEffectiveAccountOwnerForWrites } from "@/lib/effective-account";
import { ContextDevError, resolveAccountBrandLogoUrl } from "@/lib/context-client";
import { resolveAiSummaryConfig } from "@/lib/ai-change-summary";
import {
  resolveAiModelForProvider,
  resolveEffectiveAiProvider,
} from "@/lib/ai-models";
import {
  effectiveOpenAiApiKey,
  effectiveVercelAiGatewayApiKey,
  isAiModelManagedByEnv,
  isContextDevApiKeyManagedByEnv,
  isOpenAiApiKeyManagedByEnv,
  isResendApiKeyManagedByEnv,
  isResendSendFromEmailManagedByEnv,
  isVercelAiGatewayApiKeyManagedByEnv,
} from "@/lib/server-managed-config";

const patchSchema = z.object({
  contextDevApiKey: z.union([z.string(), z.null()]).optional(),
  resendApiKey: z.union([z.string(), z.null()]).optional(),
  aiProvider: z.union([z.enum(["openai", "vercel_gateway"]), z.null()]).optional(),
  openaiApiKey: z.union([z.string(), z.null()]).optional(),
  vercelAiGatewayApiKey: z.union([z.string(), z.null()]).optional(),
  aiModel: z.union([z.string(), z.null()]).optional(),
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

function normalizeSecretKey(input: string | null | undefined): string | null {
  if (input === undefined || input === null) return null;
  const t = input.trim();
  return t === "" ? null : t;
}

function normalizeAiModel(input: string | null | undefined): string | null {
  if (input === undefined || input === null) return null;
  const t = input.trim();
  return t === "" ? null : t;
}

type SettingsRow = {
  ownerUserId: string;
  contextDevApiKey: string | null;
  resendApiKey: string | null;
  aiProvider: AiProvider | null;
  openaiApiKey: string | null;
  vercelAiGatewayApiKey: string | null;
  aiModel: string | null;
};

function pickSettingsRow(rows: SettingsRow[], ownerId: string | null): SettingsRow | null {
  if (rows.length === 1) return rows[0]!;
  if (rows.length > 1 && ownerId) {
    return rows.find((r) => r.ownerUserId === ownerId) ?? null;
  }
  return null;
}

function aiSettingsResponse(row: SettingsRow | null) {
  const openaiApiKeyManaged = isOpenAiApiKeyManagedByEnv();
  const vercelAiGatewayApiKeyManaged = isVercelAiGatewayApiKeyManagedByEnv();
  const aiModelManaged = isAiModelManagedByEnv();

  return {
    aiProvider: row?.aiProvider ?? null,
    openaiApiKey: openaiApiKeyManaged ? null : (row?.openaiApiKey ?? null),
    vercelAiGatewayApiKey: vercelAiGatewayApiKeyManaged ? null : (row?.vercelAiGatewayApiKey ?? null),
    aiModel: aiModelManaged ? null : (row?.aiModel ?? null),
    openaiApiKeyManaged,
    vercelAiGatewayApiKeyManaged,
    aiModelManaged,
    aiConfigured: Boolean(
      row &&
        resolveAiSummaryConfig({
          aiProvider: row.aiProvider,
          openaiApiKey: row.openaiApiKey,
          vercelAiGatewayApiKey: row.vercelAiGatewayApiKey,
          aiModel: row.aiModel,
        }),
    ),
  };
}

export async function GET() {
  const { user, response } = await getApiUser();
  if (!user) return response;
  const contextDevApiKeyManaged = isContextDevApiKeyManagedByEnv();
  const resendApiKeyManaged = isResendApiKeyManagedByEnv();

  const rows = await db
    .select({
      ownerUserId: schema.userNotificationSettings.userId,
      contextDevApiKey: schema.userNotificationSettings.contextDevApiKey,
      resendApiKey: schema.userNotificationSettings.resendApiKey,
      aiProvider: schema.userNotificationSettings.aiProvider,
      openaiApiKey: schema.userNotificationSettings.openaiApiKey,
      vercelAiGatewayApiKey: schema.userNotificationSettings.vercelAiGatewayApiKey,
      aiModel: schema.userNotificationSettings.aiModel,
    })
    .from(schema.userNotificationSettings)
    .where(accountOwnerColumnAccessible(schema.userNotificationSettings.userId, user.id));

  let contextDevApiKey: string | null = null;
  let resendApiKey: string | null = null;
  let settingsRow: SettingsRow | null = null;

  if (rows.length === 1) {
    settingsRow = rows[0]!;
    contextDevApiKey = settingsRow.contextDevApiKey ?? null;
    resendApiKey = settingsRow.resendApiKey ?? null;
  } else if (rows.length > 1) {
    const scope = await getEffectiveAccountOwnerForWrites(user.id);
    if (scope.ok) {
      settingsRow = pickSettingsRow(rows, scope.ownerId);
      contextDevApiKey = settingsRow?.contextDevApiKey ?? null;
      resendApiKey = settingsRow?.resendApiKey ?? null;
    }
  }

  return NextResponse.json({
    contextDevApiKey: contextDevApiKeyManaged ? null : contextDevApiKey,
    resendApiKey: resendApiKeyManaged ? null : resendApiKey,
    contextDevApiKeyManaged,
    resendApiKeyManaged,
    resendSendFromEmailManaged: isResendSendFromEmailManagedByEnv(),
    ...aiSettingsResponse(settingsRow),
  });
}

export async function PATCH(req: Request) {
  const { user, ownerId, response } = await requireApiUserWithWriteOwner();
  if (!user || !ownerId) return response!;

  const parsed = await parseJson(req, patchSchema);
  if (parsed.response) return parsed.response;

  const {
    contextDevApiKey: keyIn,
    resendApiKey: resendIn,
    aiProvider: aiProviderIn,
    openaiApiKey: openaiKeyIn,
    vercelAiGatewayApiKey: gatewayKeyIn,
    aiModel: aiModelIn,
  } = parsed.data;

  if (
    keyIn === undefined &&
    resendIn === undefined &&
    aiProviderIn === undefined &&
    openaiKeyIn === undefined &&
    gatewayKeyIn === undefined &&
    aiModelIn === undefined
  ) {
    return badRequest(
      "Provide at least one of contextDevApiKey, resendApiKey, aiProvider, openaiApiKey, vercelAiGatewayApiKey, or aiModel",
    );
  }

  const contextDevApiKeyManaged = isContextDevApiKeyManagedByEnv();
  const resendApiKeyManaged = isResendApiKeyManagedByEnv();
  const openaiApiKeyManaged = isOpenAiApiKeyManagedByEnv();
  const vercelAiGatewayApiKeyManaged = isVercelAiGatewayApiKeyManagedByEnv();
  const aiModelManaged = isAiModelManagedByEnv();

  if (keyIn !== undefined && contextDevApiKeyManaged) {
    return badRequest("Context.dev API access is managed by this deployment");
  }
  if (resendIn !== undefined && resendApiKeyManaged) {
    return badRequest("Resend API access is managed by this deployment");
  }
  if (openaiKeyIn !== undefined && openaiApiKeyManaged) {
    return badRequest("OpenAI API access is managed by this deployment");
  }
  if (gatewayKeyIn !== undefined && vercelAiGatewayApiKeyManaged) {
    return badRequest("Vercel AI Gateway access is managed by this deployment");
  }
  if (aiModelIn !== undefined && aiModelManaged) {
    return badRequest("AI model is managed by this deployment");
  }

  const [existing] = await db
    .select({
      contextDevApiKey: schema.userNotificationSettings.contextDevApiKey,
      resendApiKey: schema.userNotificationSettings.resendApiKey,
      aiProvider: schema.userNotificationSettings.aiProvider,
      openaiApiKey: schema.userNotificationSettings.openaiApiKey,
      vercelAiGatewayApiKey: schema.userNotificationSettings.vercelAiGatewayApiKey,
      aiModel: schema.userNotificationSettings.aiModel,
    })
    .from(schema.userNotificationSettings)
    .where(eq(schema.userNotificationSettings.userId, ownerId))
    .limit(1);

  let contextKey = existing?.contextDevApiKey ?? null;
  let resendKey = existing?.resendApiKey ?? null;
  let aiProvider = existing?.aiProvider ?? null;
  let openaiKey = existing?.openaiApiKey ?? null;
  let gatewayKey = existing?.vercelAiGatewayApiKey ?? null;
  let aiModel = existing?.aiModel ?? null;

  if (keyIn !== undefined) contextKey = normalizeContextKey(keyIn);
  if (resendIn !== undefined) resendKey = normalizeResendApiKey(resendIn);
  if (aiProviderIn !== undefined) aiProvider = aiProviderIn;
  if (openaiKeyIn !== undefined) openaiKey = normalizeSecretKey(openaiKeyIn);
  if (gatewayKeyIn !== undefined) gatewayKey = normalizeSecretKey(gatewayKeyIn);
  if (aiModelIn !== undefined) aiModel = normalizeAiModel(aiModelIn);

  const openaiConfigured = Boolean(effectiveOpenAiApiKey(openaiKey));
  const vercelConfigured = Boolean(effectiveVercelAiGatewayApiKey(gatewayKey));
  const resolvedProvider = resolveEffectiveAiProvider({
    aiProvider,
    openaiConfigured,
    vercelConfigured,
  });
  if (resolvedProvider) {
    aiProvider = resolvedProvider;
    if (!aiModelManaged) {
      aiModel = resolveAiModelForProvider(resolvedProvider, aiModel);
    }
  } else {
    aiProvider = null;
    if (!aiModelManaged) aiModel = null;
  }

  if (aiProvider) {
    if (aiProvider === "openai" && !openaiConfigured) {
      return badRequest("OpenAI API key is required for the OpenAI provider");
    }
    if (aiProvider === "vercel_gateway" && !vercelConfigured) {
      return badRequest("Vercel AI Gateway API key is required for the AI Gateway provider");
    }
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
      aiProvider,
      openaiApiKey: openaiKey,
      vercelAiGatewayApiKey: gatewayKey,
      aiModel,
      updatedAt: now,
      ...(refreshedBrandLogoUrl !== undefined ? { accountBrandLogoUrl: refreshedBrandLogoUrl } : {}),
    })
    .onConflictDoUpdate({
      target: schema.userNotificationSettings.userId,
      set: {
        contextDevApiKey: contextKey,
        resendApiKey: resendKey,
        aiProvider,
        openaiApiKey: openaiKey,
        vercelAiGatewayApiKey: gatewayKey,
        aiModel,
        updatedAt: now,
        ...(refreshedBrandLogoUrl !== undefined ? { accountBrandLogoUrl: refreshedBrandLogoUrl } : {}),
      },
    });

  const settingsRow: SettingsRow = {
    ownerUserId: ownerId,
    contextDevApiKey: contextKey,
    resendApiKey: resendKey,
    aiProvider,
    openaiApiKey: openaiKey,
    vercelAiGatewayApiKey: gatewayKey,
    aiModel,
  };

  return NextResponse.json({
    ok: true,
    contextDevApiKey: contextDevApiKeyManaged ? null : contextKey,
    resendApiKey: resendApiKeyManaged ? null : resendKey,
    contextDevApiKeyManaged,
    resendApiKeyManaged,
    resendSendFromEmailManaged: isResendSendFromEmailManagedByEnv(),
    ...aiSettingsResponse(settingsRow),
    ...(refreshedBrandLogoUrl !== undefined ? { accountBrandLogoUrl: refreshedBrandLogoUrl } : {}),
  });
}

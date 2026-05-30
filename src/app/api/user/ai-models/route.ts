import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import type { AiProvider } from "@/lib/db/schema";
import { badRequest, parseJson, requireApiUserWithWriteOwner } from "@/lib/api";
import { listAiModelsForProvider } from "@/lib/ai-model-catalog";
import {
  effectiveOpenAiApiKey,
  effectiveVercelAiGatewayApiKey,
} from "@/lib/server-managed-config";

const providerSchema = z.enum(["openai", "vercel_gateway"]);

const postSchema = z.object({
  provider: providerSchema,
  apiKey: z.union([z.string(), z.null()]).optional(),
});

async function resolveApiKey(
  provider: AiProvider,
  ownerId: string,
  draftApiKey?: string | null,
): Promise<string | null> {
  const draft = draftApiKey?.trim();
  if (draft) return draft;

  const [row] = await db
    .select({
      openaiApiKey: schema.userNotificationSettings.openaiApiKey,
      vercelAiGatewayApiKey: schema.userNotificationSettings.vercelAiGatewayApiKey,
    })
    .from(schema.userNotificationSettings)
    .where(eq(schema.userNotificationSettings.userId, ownerId))
    .limit(1);

  if (provider === "openai") {
    return effectiveOpenAiApiKey(row?.openaiApiKey ?? null);
  }
  return effectiveVercelAiGatewayApiKey(row?.vercelAiGatewayApiKey ?? null);
}

export async function GET(req: Request) {
  const { user, ownerId, response } = await requireApiUserWithWriteOwner();
  if (!user || !ownerId) return response!;

  const url = new URL(req.url);
  const parsed = providerSchema.safeParse(url.searchParams.get("provider"));
  if (!parsed.success) {
    return badRequest("provider must be openai or vercel_gateway");
  }

  const apiKey = await resolveApiKey(parsed.data, ownerId, null);
  const result = await listAiModelsForProvider(parsed.data, apiKey);

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const { user, ownerId, response } = await requireApiUserWithWriteOwner();
  if (!user || !ownerId) return response!;

  const parsed = await parseJson(req, postSchema);
  if (parsed.response) return parsed.response;

  const { provider, apiKey: draftKey } = parsed.data;
  const apiKey = await resolveApiKey(provider, ownerId, draftKey ?? null);
  const result = await listAiModelsForProvider(provider, apiKey);

  return NextResponse.json(result);
}

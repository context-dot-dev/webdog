import type { AiProvider } from "./db/schema";
import {
  AI_MODELS_BY_PROVIDER,
  type AiModelOption,
  defaultAiModelForProvider,
} from "./ai-models";

export type { AiModelOption };
export { defaultAiModelForProvider };

const OPENAI_MODELS_URL = "https://api.openai.com/v1/models";
const VERCEL_AI_GATEWAY_MODELS_URL = "https://ai-gateway.vercel.sh/v1/models";
const CACHE_TTL_MS = 60 * 60 * 1000;
const DESCRIPTION_MAX_LEN = 160;

type CacheEntry = { expiresAt: number; models: AiModelOption[] };

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<AiModelOption[]>>();

function getCached(key: string): AiModelOption[] | null {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.models;
}

function setCached(key: string, models: AiModelOption[]): void {
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, models });
}

function trimDescription(text: string | undefined): string | undefined {
  const t = text?.trim();
  if (!t) return undefined;
  return t.length <= DESCRIPTION_MAX_LEN ? t : `${t.slice(0, DESCRIPTION_MAX_LEN - 1)}…`;
}

function humanizeOpenAiModelId(id: string): string {
  return id
    .replace(/^gpt-/i, "GPT-")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isOpenAiGenerativeModel(id: string): boolean {
  const lower = id.toLowerCase();
  if (
    lower.includes("embed") ||
    lower.includes("tts") ||
    lower.includes("whisper") ||
    lower.startsWith("dall-e") ||
    lower.startsWith("davinci-") ||
    lower.startsWith("babbage-") ||
    lower.includes("moderation") ||
    lower.includes("transcribe") ||
    lower.includes("realtime") ||
    lower.includes("audio") ||
    lower.includes("image") ||
    lower.includes("computer-use") ||
    lower.includes("search") ||
    lower.includes("instruct")
  ) {
    return false;
  }
  return (
    lower.startsWith("gpt-") ||
    /^o\d/.test(lower) ||
    lower.startsWith("chatgpt")
  );
}

function sortOpenAiModels(models: AiModelOption[]): AiModelOption[] {
  const rank = (id: string): number => {
    const lower = id.toLowerCase();
    if (lower.includes("nano")) return 0;
    if (lower.includes("mini")) return 1;
    if (lower.startsWith("gpt-4.1")) return 2;
    if (lower.startsWith("gpt-4o")) return 3;
    return 10;
  };
  return [...models].sort((a, b) => {
    const dr = rank(a.id) - rank(b.id);
    if (dr !== 0) return dr;
    return a.id.localeCompare(b.id);
  });
}

function sortGatewayModels(models: AiModelOption[]): AiModelOption[] {
  return [...models].sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
}

export function fallbackModelsForProvider(provider: AiProvider): AiModelOption[] {
  return AI_MODELS_BY_PROVIDER[provider];
}

async function dedupedFetch(
  cacheKey: string,
  fetcher: () => Promise<AiModelOption[]>,
): Promise<AiModelOption[]> {
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const pending = inflight.get(cacheKey);
  if (pending) return pending;

  const promise = fetcher().finally(() => {
    inflight.delete(cacheKey);
  });
  inflight.set(cacheKey, promise);
  return promise;
}

async function fetchOpenAiModels(apiKey: string): Promise<AiModelOption[]> {
  const cacheKey = `openai:${apiKey.slice(0, 12)}`;
  return dedupedFetch(cacheKey, async () => {
    const res = await fetch(OPENAI_MODELS_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`OpenAI models request failed (${res.status})`);
    }

    const json = (await res.json()) as {
      data?: Array<{ id?: string }>;
    };

    const models = sortOpenAiModels(
      (json.data ?? [])
        .map((m) => m.id?.trim())
        .filter((id): id is string => Boolean(id && isOpenAiGenerativeModel(id)))
        .map((id) => ({
          id,
          label: humanizeOpenAiModelId(id),
        })),
    );

    if (models.length === 0) {
      throw new Error("OpenAI returned no chat models");
    }

    setCached(cacheKey, models);
    return models;
  });
}

type GatewayModel = {
  id?: string;
  name?: string;
  description?: string;
  type?: string;
};

async function fetchVercelGatewayModels(apiKey?: string | null): Promise<AiModelOption[]> {
  const cacheKey = apiKey?.trim()
    ? `vercel_gateway:${apiKey.slice(0, 12)}`
    : "vercel_gateway";

  return dedupedFetch(cacheKey, async () => {
    const headers: Record<string, string> = {};
    const key = apiKey?.trim();
    if (key) {
      headers.Authorization = `Bearer ${key}`;
    }

    const res = await fetch(VERCEL_AI_GATEWAY_MODELS_URL, {
      headers,
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      throw new Error(`Vercel AI Gateway models request failed (${res.status})`);
    }

    const json = (await res.json()) as { data?: GatewayModel[] };
    const models = sortGatewayModels(
      (json.data ?? [])
        .filter((m) => m.type === "language" && m.id?.trim())
        .map((m) => ({
          id: m.id!.trim(),
          label: m.name?.trim() || m.id!.trim(),
          description: trimDescription(m.description),
        })),
    );

    if (models.length === 0) {
      throw new Error("Vercel AI Gateway returned no language models");
    }

    setCached(cacheKey, models);
    return models;
  });
}

export type ListAiModelsResult = {
  models: AiModelOption[];
  source: "live" | "fallback";
  error?: string;
};

export async function listAiModelsForProvider(
  provider: AiProvider,
  apiKey: string | null,
): Promise<ListAiModelsResult> {
  try {
    if (provider === "openai") {
      if (!apiKey?.trim()) {
        return { models: fallbackModelsForProvider(provider), source: "fallback" };
      }
      return { models: await fetchOpenAiModels(apiKey.trim()), source: "live" };
    }
    return {
      models: await fetchVercelGatewayModels(apiKey),
      source: "live",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load models";
    console.error(`listAiModelsForProvider(${provider}):`, err);
    return {
      models: fallbackModelsForProvider(provider),
      source: "fallback",
      error: message,
    };
  }
}

export function labelForModelId(
  models: AiModelOption[],
  modelId: string | null | undefined,
): string | null {
  if (!modelId?.trim()) return null;
  const hit = models.find((m) => m.id === modelId);
  return hit?.label ?? modelId;
}

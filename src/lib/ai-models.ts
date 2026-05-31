import type { AiProvider } from "./db/schema";

export type AiModelOption = { id: string; label: string; description?: string };

export const AI_MODELS_BY_PROVIDER: Record<AiProvider, AiModelOption[]> = {
  openai: [
    { id: "gpt-5.4-nano", label: "GPT-5.4 Nano (recommended)" },
    { id: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  ],
  vercel_gateway: [
    { id: "openai/gpt-5.4-nano", label: "GPT-5.4 Nano (recommended)" },
    { id: "openai/gpt-4.1-nano", label: "GPT-4.1 Nano" },
    { id: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini" },
  ],
};

export function defaultAiModelForProvider(provider: AiProvider): string {
  return AI_MODELS_BY_PROVIDER[provider][0]!.id;
}

/** Prefer the only configured provider; otherwise honor an explicit valid choice. */
export function resolveEffectiveAiProvider(settings: {
  aiProvider: AiProvider | null;
  openaiConfigured: boolean;
  vercelConfigured: boolean;
}): AiProvider | null {
  const { aiProvider, openaiConfigured, vercelConfigured } = settings;
  if (openaiConfigured && !vercelConfigured) return "openai";
  if (vercelConfigured && !openaiConfigured) return "vercel_gateway";
  if (aiProvider === "openai" && openaiConfigured) return "openai";
  if (aiProvider === "vercel_gateway" && vercelConfigured) return "vercel_gateway";
  if (openaiConfigured) return "openai";
  if (vercelConfigured) return "vercel_gateway";
  return null;
}

export function resolveAiModelForProvider(provider: AiProvider, model: string | null | undefined): string {
  const trimmed = model?.trim() ?? "";
  if (!trimmed) return defaultAiModelForProvider(provider);
  if (provider === "vercel_gateway") {
    return trimmed.includes("/") ? trimmed : `openai/${trimmed}`;
  }
  return trimmed.startsWith("openai/") ? trimmed.slice("openai/".length) : trimmed;
}

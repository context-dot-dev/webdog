import type { AiProvider } from "./db/schema";

export type AiModelOption = { id: string; label: string; description?: string };

export const AI_MODELS_BY_PROVIDER: Record<AiProvider, AiModelOption[]> = {
  openai: [
    { id: "gpt-4.1-nano", label: "GPT-4.1 Nano (recommended)" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  ],
  vercel_gateway: [
    { id: "openai/gpt-4.1-nano", label: "GPT-4.1 Nano (recommended)" },
    { id: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini" },
  ],
};

export function defaultAiModelForProvider(provider: AiProvider): string {
  return AI_MODELS_BY_PROVIDER[provider][0]!.id;
}

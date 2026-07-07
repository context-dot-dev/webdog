/**
 * LLM-generated plain-language summaries for website change alerts.
 */

import { createGateway } from "@ai-sdk/gateway";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import type { AiProvider, AlertKind, Website } from "./db/schema";
import { diffPreview } from "./diff-preview";
import {
  resolveAiModelForProvider,
  resolveEffectiveAiProvider,
} from "./ai-models";
import {
  effectiveAiModel,
  effectiveOpenAiApiKey,
  effectiveVercelAiGatewayApiKey,
} from "./server-managed-config";

const LLM_TIMEOUT_MS = 30_000;
const MAX_CHANGE_CHARS = 8_000;
const MAX_OUTPUT_TOKENS = 150;
const LLM_DIFF_LINE_CAP = 40;

export const SYSTEM_PROMPT = `You are a website change monitoring assistant. Your job is to summarize what changed on a monitored website in plain language for the site owner.

Write 2–4 short sentences. Do not use markdown, bullet points, or headings. Focus on what changed and why it might matter. Be factual; do not speculate beyond the change data provided. If the change is minor (typo, timestamp), say so briefly.`;

export type AiSummaryConfig = {
  provider: AiProvider;
  apiKey: string;
  model: string;
};

export type AlertDetailsForSummary = {
  pageUrl?: string;
  diffPreview?: string;
  totalAdded?: number;
  totalRemoved?: number;
  added?: string[];
  removed?: string[];
  productName?: string;
  previousPrice?: number | null;
  previousCurrency?: string | null;
  newPrice?: number | null;
  newCurrency?: string | null;
  beforeMarkdown?: string;
  afterMarkdown?: string;
};

export function resolveAiSummaryConfig(settings: {
  aiProvider: AiProvider | null;
  openaiApiKey: string | null;
  vercelAiGatewayApiKey: string | null;
  aiModel: string | null;
}): AiSummaryConfig | null {
  const openaiConfigured = Boolean(effectiveOpenAiApiKey(settings.openaiApiKey));
  const vercelConfigured = Boolean(effectiveVercelAiGatewayApiKey(settings.vercelAiGatewayApiKey));
  const provider = resolveEffectiveAiProvider({
    aiProvider: settings.aiProvider,
    openaiConfigured,
    vercelConfigured,
  });
  if (!provider) return null;

  const model = resolveAiModelForProvider(provider, effectiveAiModel(settings.aiModel));

  if (provider === "openai") {
    const apiKey = effectiveOpenAiApiKey(settings.openaiApiKey);
    if (!apiKey) return null;
    return { provider, apiKey, model };
  }

  const apiKey = effectiveVercelAiGatewayApiKey(settings.vercelAiGatewayApiKey);
  if (!apiKey) return null;
  return { provider, apiKey, model };
}

export function buildWebsiteContext(website: Pick<Website, "name" | "domain" | "url" | "title" | "description">): string {
  const lines = [
    `Site name: ${website.name}`,
    `Domain: ${website.domain}`,
    `URL: ${website.url}`,
  ];
  if (website.title?.trim()) lines.push(`Title: ${website.title.trim()}`);
  if (website.description?.trim()) lines.push(`Description: ${website.description.trim()}`);
  return lines.join("\n");
}

/** Bounded line diff for LLM input (more lines than notification preview). */
export function diffTextForLlm(before: string, after: string): string {
  const { preview, totalAdded, totalRemoved } = diffPreview(before, after, LLM_DIFF_LINE_CAP);
  if (!preview.trim()) return "(no line-level diff available)";
  const header = `Total lines added: ${totalAdded}, removed: ${totalRemoved}`;
  return `${header}\n\n${preview}`;
}

export function buildChangePayload(
  alertKind: AlertKind,
  details: AlertDetailsForSummary,
  title: string,
): string {
  switch (alertKind) {
    case "PAGE_CONTENT": {
      if (details.beforeMarkdown != null && details.afterMarkdown != null) {
        return diffTextForLlm(details.beforeMarkdown, details.afterMarkdown);
      }
      const page = details.pageUrl ?? "unknown page";
      const diff = details.diffPreview?.trim() || "(diff preview unavailable)";
      const added = details.totalAdded ?? 0;
      const removed = details.totalRemoved ?? 0;
      return `Page: ${page}\nLines added: ${added}, removed: ${removed}\n\nDiff:\n${diff}`;
    }
    case "PRODUCT_PRICE": {
      const fmt = (p: number | null | undefined, c: string | null | undefined) =>
        p === null || p === undefined ? "—" : `${c ? `${c} ` : ""}${p}`.trim();
      const name = details.productName ?? details.pageUrl ?? "product";
      return [
        `Product: ${name}`,
        details.pageUrl ? `Page: ${details.pageUrl}` : null,
        `Previous price: ${fmt(details.previousPrice, details.previousCurrency)}`,
        `New price: ${fmt(details.newPrice, details.newCurrency)}`,
        `Alert title: ${title}`,
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "NEW_LINK": {
      const urls = details.added ?? [];
      const list = urls.slice(0, 50).join("\n");
      const more = urls.length > 50 ? `\n… and ${urls.length - 50} more` : "";
      return `New links (${urls.length}):\n${list || "(none listed)"}${more}`;
    }
    case "REMOVED_LINK": {
      const urls = details.removed ?? [];
      const list = urls.slice(0, 50).join("\n");
      const more = urls.length > 50 ? `\n… and ${urls.length - 50} more` : "";
      return `Removed links (${urls.length}):\n${list || "(none listed)"}${more}`;
    }
    default:
      return title;
  }
}

function truncateChangeText(text: string): string {
  if (text.length <= MAX_CHANGE_CHARS) return text;
  return text.slice(0, MAX_CHANGE_CHARS - 20) + "\n… (truncated)";
}

function createLanguageModel(config: AiSummaryConfig) {
  if (config.provider === "openai") {
    return createOpenAI({ apiKey: config.apiKey })(config.model);
  }
  return createGateway({ apiKey: config.apiKey })(config.model);
}

export async function summarizeChange(params: {
  config: AiSummaryConfig;
  website: Pick<Website, "name" | "domain" | "url" | "title" | "description">;
  alertKind: AlertKind;
  title: string;
  changeText: string;
  /** User's free-text intent for this monitor; steers the summary toward what they care about. */
  watchNote?: string | null;
}): Promise<string | null> {
  const { config, website, alertKind, title, changeText, watchNote } = params;
  const siteContext = buildWebsiteContext(website);
  const note = watchNote?.trim();
  const userMessage = [
    `Website context:\n${siteContext}`,
    "",
    `Change type: ${alertKind}`,
    `Alert title: ${title}`,
    ...(note
      ? [
          "",
          `The user set up this monitor to watch for: "${note}". Lead with whether this change relates to that, then note anything else important.`,
        ]
      : []),
    "",
    "Change data:",
    truncateChangeText(changeText),
  ].join("\n");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    const { text } = await generateText({
      model: createLanguageModel(config),
      system: SYSTEM_PROMPT,
      prompt: userMessage,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.2,
      abortSignal: controller.signal,
    });
    clearTimeout(timeout);
    const summary = text.trim();
    return summary || null;
  } catch (err) {
    console.error("AI change summary failed:", err);
    return null;
  }
}

export function mergeAlertDetails(detailsJson: string, patch: { aiChangeSummary: string }): string {
  let base: Record<string, unknown> = {};
  try {
    base = JSON.parse(detailsJson) as Record<string, unknown>;
  } catch {
    base = {};
  }
  return JSON.stringify({ ...base, ...patch });
}

export async function trySummarizeAlert(params: {
  config: AiSummaryConfig;
  website: Pick<Website, "name" | "domain" | "url" | "title" | "description">;
  alertKind: AlertKind;
  title: string;
  detailsJson: string;
  detailsForSummary?: AlertDetailsForSummary;
  watchNote?: string | null;
}): Promise<string | null> {
  let details: AlertDetailsForSummary = params.detailsForSummary ?? {};
  if (!params.detailsForSummary) {
    try {
      details = JSON.parse(params.detailsJson) as AlertDetailsForSummary;
    } catch {
      details = {};
    }
  }
  const changeText = buildChangePayload(params.alertKind, details, params.title);
  return summarizeChange({
    config: params.config,
    website: params.website,
    alertKind: params.alertKind,
    title: params.title,
    changeText,
    watchNote: params.watchNote,
  });
}

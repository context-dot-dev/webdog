"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { AiModelSearchSelect } from "@/components/ai-model-search-select";
import type { AiProvider } from "@/lib/db/schema";
import {
  AI_MODELS_BY_PROVIDER,
  defaultAiModelForProvider,
  resolveAiModelForProvider,
  resolveEffectiveAiProvider,
} from "@/lib/ai-models";

type ServiceId = "context_dev" | "openai" | "vercel_gateway";

function redactKey(_key: string): string {
  return "••••••••••••";
}

function SystemServiceRow({
  title,
  subtitle,
  icon,
  iconContainerClassName,
  configured,
  managed,
  managedMessage,
  integrationSummary,
  formSlot,
  formOpen,
  onAdd,
  onEdit,
  onRemove,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  iconContainerClassName?: string;
  configured: boolean;
  managed: boolean;
  managedMessage?: string;
  integrationSummary?: ReactNode;
  formSlot: ReactNode | null;
  formOpen: boolean;
  onAdd: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const showConfigured = configured && !formOpen;
  const hasBody = showConfigured || Boolean(formSlot);

  return (
    <div
      className={`border-b border-neutral-950/5 last:border-b-0${formOpen ? " relative z-10" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-0.5 ring-1 ring-neutral-950/10 ${iconContainerClassName ?? ""}`}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-neutral-900">{title}</h3>
            <p className="text-xs text-neutral-500">{subtitle}</p>
          </div>
        </div>
        {managed ? null : configured ? (
          !formOpen ? (
            <button
              type="button"
              onClick={onEdit}
              className="btn-secondary box-border h-9 shrink-0 !px-3 !py-0 text-xs whitespace-nowrap"
            >
              Edit integration
            </button>
          ) : null
        ) : (
          !formOpen && (
            <button
              type="button"
              onClick={onAdd}
              className="btn-secondary box-border h-9 shrink-0 !px-3 !py-0 text-xs whitespace-nowrap"
            >
              Add integration
            </button>
          )
        )}
      </div>

      {managed ? (
        <div className="px-5 pb-5">
          <p className="text-sm text-neutral-700">{managedMessage}</p>
        </div>
      ) : hasBody ? (
        <div className="space-y-3 px-5 pb-5">
          {showConfigured ? (
            <div className="max-w-xl rounded-lg bg-neutral-50/80 px-3 py-2.5 ring-1 ring-neutral-950/5">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0 flex-1">{integrationSummary}</div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={onEdit}
                    className="btn-secondary box-border h-8 !px-2 !py-0 text-xs"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={onRemove}
                    className="btn-ghost box-border h-8 !px-2 !py-0 text-xs text-red-700 ring-red-200 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {formSlot}
        </div>
      ) : null}
    </div>
  );
}

export function SystemServicesSettings({
  initialContextDevApiKey,
  contextDevApiKeyManaged,
  initialOpenaiApiKey,
  initialVercelAiGatewayApiKey,
  initialAiProvider,
  initialAiModel,
  openaiApiKeyManaged,
  vercelAiGatewayApiKeyManaged,
  aiModelManaged,
}: {
  initialContextDevApiKey: string | null;
  contextDevApiKeyManaged: boolean;
  initialOpenaiApiKey: string | null;
  initialVercelAiGatewayApiKey: string | null;
  initialAiProvider: AiProvider | null;
  initialAiModel: string | null;
  openaiApiKeyManaged: boolean;
  vercelAiGatewayApiKeyManaged: boolean;
  aiModelManaged: boolean;
}) {
  const router = useRouter();
  const contextKeyId = useId();
  const openaiKeyId = useId();
  const gatewayKeyId = useId();
  const [contextKey, setContextKey] = useState(() => initialContextDevApiKey ?? "");
  const [openaiKey, setOpenaiKey] = useState(() => initialOpenaiApiKey ?? "");
  const [gatewayKey, setGatewayKey] = useState(() => initialVercelAiGatewayApiKey ?? "");
  const [aiProvider, setAiProvider] = useState<AiProvider | null>(() =>
    resolveEffectiveAiProvider({
      aiProvider: initialAiProvider ?? null,
      openaiConfigured:
        openaiApiKeyManaged || (initialOpenaiApiKey?.trim() ?? "") !== "",
      vercelConfigured:
        vercelAiGatewayApiKeyManaged || (initialVercelAiGatewayApiKey?.trim() ?? "") !== "",
    }),
  );
  const [aiModel, setAiModel] = useState(() => initialAiModel ?? "");

  const [editingService, setEditingService] = useState<ServiceId | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const contextConfigured =
    contextDevApiKeyManaged || (initialContextDevApiKey?.trim() ?? "") !== "";
  const openaiConfigured =
    openaiApiKeyManaged || (initialOpenaiApiKey?.trim() ?? "") !== "";
  const vercelConfigured =
    vercelAiGatewayApiKeyManaged || (initialVercelAiGatewayApiKey?.trim() ?? "") !== "";

  function startAdd(service: ServiceId) {
    setEditingService(service);
    setError(null);
    setSavedFlash(false);
  }

  function startEdit(service: ServiceId) {
    setEditingService(service);
    setError(null);
    setSavedFlash(false);
    if (service === "context_dev") setContextKey(initialContextDevApiKey ?? "");
    if (service === "openai") setOpenaiKey(initialOpenaiApiKey ?? "");
    if (service === "vercel_gateway") setGatewayKey(initialVercelAiGatewayApiKey ?? "");
  }

  function cancelForm() {
    setEditingService(null);
    setError(null);
    setContextKey(initialContextDevApiKey ?? "");
    setOpenaiKey(initialOpenaiApiKey ?? "");
    setGatewayKey(initialVercelAiGatewayApiKey ?? "");
  }

  async function patchSettings(body: Record<string, unknown>) {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/user/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return false;
      }
      setSavedFlash(true);
      setEditingService(null);
      router.refresh();
      window.setTimeout(() => setSavedFlash(false), 3000);
      return true;
    } catch {
      setError("Save failed");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveContextDev() {
    const key = contextKey.trim() === "" ? null : contextKey.trim();
    await patchSettings({ contextDevApiKey: key });
  }

  async function saveOpenAi() {
    const key = openaiKey.trim() === "" ? null : openaiKey.trim();
    const body: Record<string, unknown> = { openaiApiKey: key };
    if (key) {
      const nextProvider: AiProvider = "openai";
      if (!aiProvider || aiProvider === "openai" || !vercelConfigured) {
        body.aiProvider = nextProvider;
        if (!aiModelManaged) {
          body.aiModel = resolveAiModelForProvider(
            nextProvider,
            aiModel.trim() || initialAiModel,
          );
        }
      }
    } else if (aiProvider === "openai") {
      if (vercelConfigured) {
        const nextProvider: AiProvider = "vercel_gateway";
        body.aiProvider = nextProvider;
        if (!aiModelManaged) {
          body.aiModel = resolveAiModelForProvider(nextProvider, aiModel.trim() || initialAiModel);
        }
      } else {
        body.aiProvider = null;
        body.aiModel = null;
      }
    }
    await patchSettings(body);
  }

  async function saveVercelGateway() {
    const key = gatewayKey.trim() === "" ? null : gatewayKey.trim();
    const body: Record<string, unknown> = { vercelAiGatewayApiKey: key };
    if (key) {
      const nextProvider: AiProvider = "vercel_gateway";
      if (!aiProvider || aiProvider === "vercel_gateway" || !openaiConfigured) {
        body.aiProvider = nextProvider;
        if (!aiModelManaged) {
          body.aiModel = resolveAiModelForProvider(
            nextProvider,
            aiModel.trim() || initialAiModel,
          );
        }
      }
    } else if (aiProvider === "vercel_gateway") {
      if (openaiConfigured) {
        const nextProvider: AiProvider = "openai";
        body.aiProvider = nextProvider;
        if (!aiModelManaged) {
          body.aiModel = resolveAiModelForProvider(nextProvider, aiModel.trim() || initialAiModel);
        }
      } else {
        body.aiProvider = null;
        body.aiModel = null;
      }
    }
    await patchSettings(body);
  }

  async function removeContextDev() {
    setContextKey("");
    await patchSettings({ contextDevApiKey: null });
  }

  async function removeOpenAi() {
    setOpenaiKey("");
    const body: Record<string, unknown> = { openaiApiKey: null };
    if (aiProvider === "openai") {
      if (vercelConfigured) {
        const nextProvider: AiProvider = "vercel_gateway";
        body.aiProvider = nextProvider;
        if (!aiModelManaged) {
          body.aiModel = resolveAiModelForProvider(nextProvider, aiModel.trim() || initialAiModel);
        }
      } else {
        body.aiProvider = null;
        body.aiModel = null;
      }
    }
    await patchSettings(body);
  }

  async function removeVercelGateway() {
    setGatewayKey("");
    const body: Record<string, unknown> = { vercelAiGatewayApiKey: null };
    if (aiProvider === "vercel_gateway") {
      if (openaiConfigured) {
        const nextProvider: AiProvider = "openai";
        body.aiProvider = nextProvider;
        if (!aiModelManaged) {
          body.aiModel = resolveAiModelForProvider(nextProvider, aiModel.trim() || initialAiModel);
        }
      } else {
        body.aiProvider = null;
        body.aiModel = null;
      }
    }
    await patchSettings(body);
  }

  async function setSummaryProvider(provider: AiProvider) {
    if (!aiModelManaged) {
      const models = AI_MODELS_BY_PROVIDER[provider];
      const model =
        aiModel && models.some((m) => m.id === aiModel)
          ? aiModel
          : initialAiModel && models.some((m) => m.id === initialAiModel)
            ? initialAiModel
            : defaultAiModelForProvider(provider);
      await patchSettings({ aiProvider: provider, aiModel: model });
      setAiProvider(provider);
      setAiModel(model);
      return;
    }
    await patchSettings({ aiProvider: provider });
    setAiProvider(provider);
  }

  function formActions(onSave: () => void) {
    return (
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          disabled={saving}
          onClick={() => void onSave()}
          className="btn-primary box-border h-9 !px-3 !py-0 text-xs"
        >
          {saving ? "Saving…" : "Save integration"}
        </button>
        <button
          type="button"
          onClick={cancelForm}
          className="btn-secondary box-border h-9 !px-3 !py-0 text-xs"
        >
          Cancel
        </button>
        {savedFlash && (
          <span className="text-xs text-brand-700" role="status">
            Saved
          </span>
        )}
      </div>
    );
  }

  const contextForm =
    editingService === "context_dev" ? (
      <div className="max-w-xl space-y-2 rounded-lg bg-neutral-50/80 p-3 ring-1 ring-neutral-950/5">
        <label htmlFor={contextKeyId} className="text-sm font-medium text-neutral-900">
          API key
        </label>
        <p className="text-xs text-neutral-500">Bearer token. Stored in your account settings.</p>
        <input
          id={contextKeyId}
          name="contextDevApiKey"
          type="password"
          value={contextKey}
          onChange={(e) => setContextKey(e.target.value)}
          autoComplete="off"
          placeholder="brand_…"
          className="input box-border h-9 w-full font-mono text-xs"
        />
        {formActions(saveContextDev)}
      </div>
    ) : null;

  const openaiForm =
    editingService === "openai" ? (
      <div className="max-w-xl space-y-3 rounded-lg bg-neutral-50/80 p-3 ring-1 ring-neutral-950/5">
        <div className="space-y-2">
          <label htmlFor={openaiKeyId} className="text-sm font-medium text-neutral-900">
            API key
          </label>
          <input
            id={openaiKeyId}
            type="password"
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            autoComplete="off"
            placeholder="sk-…"
            className="input box-border h-9 w-full font-mono text-xs"
          />
        </div>
        {!aiModelManaged ? (
          <AiModelSearchSelect
            provider="openai"
            value={aiModel}
            onChange={setAiModel}
            draftApiKey={openaiKey}
            hint="Lightweight models are recommended for alert summaries."
          />
        ) : null}
        {formActions(saveOpenAi)}
      </div>
    ) : null;

  const vercelForm =
    editingService === "vercel_gateway" ? (
      <div className="max-w-xl space-y-3 rounded-lg bg-neutral-50/80 p-3 ring-1 ring-neutral-950/5">
        <div className="space-y-2">
          <label htmlFor={gatewayKeyId} className="text-sm font-medium text-neutral-900">
            API key
          </label>
          <input
            id={gatewayKeyId}
            type="password"
            value={gatewayKey}
            onChange={(e) => setGatewayKey(e.target.value)}
            autoComplete="off"
            placeholder="Gateway key"
            className="input box-border h-9 w-full font-mono text-xs"
          />
        </div>
        {!aiModelManaged ? (
          <AiModelSearchSelect
            provider="vercel_gateway"
            value={aiModel}
            onChange={setAiModel}
            draftApiKey={gatewayKey}
            hint="Search by model name or id (e.g. openai/gpt-5.4-nano)."
          />
        ) : null}
        {formActions(saveVercelGateway)}
      </div>
    ) : null;

  function aiSummaryExtras(provider: AiProvider, configured: boolean) {
    if (!configured || editingService === provider) return null;
    const isActive = aiProvider === provider;
    const savedModel =
      aiProvider === provider
        ? (aiModel.trim() || initialAiModel?.trim() || null)
        : initialAiProvider === provider
          ? (initialAiModel?.trim() || null)
          : null;

    return (
      <div className="mt-1 space-y-1">
        {isActive ? (
          <p className="text-xs text-brand-700">Default for AI change summaries</p>
        ) : (
          <button
            type="button"
            onClick={() => void setSummaryProvider(provider)}
            aria-label="Make default for AI change summaries"
            className="text-xs font-medium text-brand-700 hover:underline"
          >
            Make default
          </button>
        )}
        {isActive && savedModel && !aiModelManaged ? (
          <p className="font-mono text-xs text-neutral-500">Model: {savedModel}</p>
        ) : null}
        {isActive && aiModelManaged ? (
          <p className="text-xs text-neutral-500">Model is set by this deployment.</p>
        ) : null}
      </div>
    );
  }

  return (
    <section className="mt-6" aria-labelledby="system-services-heading">
      <h2 id="system-services-heading" className="text-sm font-medium text-neutral-900">
        System Services
      </h2>
      <p className="mt-1 text-sm text-neutral-600">
        External APIs used for scraping and optional AI change summaries. One integration per
        service.
      </p>

      <div className="mt-3 overflow-visible rounded-2xl bg-white ring-1 ring-neutral-950/5">
        <SystemServiceRow
          title="Context.dev"
          subtitle="Scrape sitemaps, page content, and brand data"
          icon={
            <Image
              src="/context-dev-logo.png"
              alt=""
              width={40}
              height={40}
              className="size-full rounded-[11px] object-cover"
            />
          }
          iconContainerClassName="p-0 ring-0"
          configured={contextConfigured}
          managed={contextDevApiKeyManaged}
          managedMessage="Context.dev requests use a server-managed key. Account API keys are not accepted here."
          integrationSummary={
            <div>
              <div className="text-sm font-medium text-neutral-900">API key</div>
              <div className="font-mono text-xs text-neutral-600">{redactKey("")}</div>
            </div>
          }
          formSlot={contextForm}
          formOpen={editingService === "context_dev"}
          onAdd={() => startAdd("context_dev")}
          onEdit={() => startEdit("context_dev")}
          onRemove={() => void removeContextDev()}
        />

        <SystemServiceRow
          title="OpenAI"
          subtitle="Optional plain-language summaries for alerts"
          icon={
            <Image
              src="/openai-logo.png"
              alt=""
              width={24}
              height={24}
              className="size-6 object-contain"
            />
          }
          configured={openaiConfigured}
          managed={openaiApiKeyManaged}
          managedMessage="OpenAI API access is managed by this deployment."
          integrationSummary={
            <div>
              <div className="text-sm font-medium text-neutral-900">API key</div>
              <div className="font-mono text-xs text-neutral-600">{redactKey("")}</div>
              {aiSummaryExtras("openai", openaiConfigured)}
            </div>
          }
          formSlot={openaiForm}
          formOpen={editingService === "openai"}
          onAdd={() => startAdd("openai")}
          onEdit={() => startEdit("openai")}
          onRemove={() => void removeOpenAi()}
        />

        <SystemServiceRow
          title="Vercel AI Gateway"
          subtitle="Optional summaries via Vercel AI Gateway"
          icon={
            <Image
              src="/vercel-logo.png"
              alt=""
              width={24}
              height={24}
              className="size-6 object-contain"
            />
          }
          configured={vercelConfigured}
          managed={vercelAiGatewayApiKeyManaged}
          managedMessage="Vercel AI Gateway access is managed by this deployment."
          integrationSummary={
            <div>
              <div className="text-sm font-medium text-neutral-900">API key</div>
              <div className="font-mono text-xs text-neutral-600">{redactKey("")}</div>
              {aiSummaryExtras("vercel_gateway", vercelConfigured)}
            </div>
          }
          formSlot={vercelForm}
          formOpen={editingService === "vercel_gateway"}
          onAdd={() => startAdd("vercel_gateway")}
          onEdit={() => startEdit("vercel_gateway")}
          onRemove={() => void removeVercelGateway()}
        />
      </div>

      <p className="mt-2 text-xs text-neutral-500">
        Enable AI summaries per target in target details. Lightweight models are recommended.
      </p>

      {error ? (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

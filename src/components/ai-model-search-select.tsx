"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AiProvider } from "@/lib/db/schema";
import {
  AI_MODELS_BY_PROVIDER,
  type AiModelOption,
  defaultAiModelForProvider,
} from "@/lib/ai-models";

const LIST_CAP = 80;

function modelMatchesQuery(model: AiModelOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    model.id.toLowerCase().includes(q) ||
    model.label.toLowerCase().includes(q) ||
    (model.description?.toLowerCase().includes(q) ?? false)
  );
}

export function AiModelSearchSelect({
  provider,
  value,
  onChange,
  draftApiKey,
  disabled,
  label = "Model for change summaries",
  hint,
}: {
  provider: AiProvider;
  value: string;
  onChange: (modelId: string) => void;
  /** Unsaved API key from the integration form. */
  draftApiKey?: string;
  disabled?: boolean;
  label?: string;
  hint?: string;
}) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const loadSeq = useRef(0);

  const [mounted, setMounted] = useState(false);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );

  const [models, setModels] = useState<AiModelOption[]>(() => AI_MODELS_BY_PROVIDER[provider]);
  const [source, setSource] = useState<"live" | "fallback" | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);

  const selected = useMemo(
    () => models.find((m) => m.id === value) ?? null,
    [models, value],
  );

  const loadModels = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setFetchError(null);
    try {
      const draft = draftApiKey?.trim();
      const res =
        draft && provider === "openai"
          ? await fetch("/api/user/ai-models", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ provider, apiKey: draft }),
            })
          : draft && provider === "vercel_gateway"
            ? await fetch("/api/user/ai-models", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ provider, apiKey: draft }),
              })
            : await fetch(`/api/user/ai-models?provider=${provider}`);

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        models?: AiModelOption[];
        source?: "live" | "fallback";
      };

      if (seq !== loadSeq.current) return;

      if (!res.ok) {
        setFetchError(data.error ?? "Could not load models");
        setModels(AI_MODELS_BY_PROVIDER[provider]);
        setSource("fallback");
        return;
      }

      const list = data.models?.length ? data.models : AI_MODELS_BY_PROVIDER[provider];
      setModels(list);
      setSource(data.source ?? "live");
      if (data.source === "fallback" && data.error) {
        setFetchError(data.error);
      }
    } catch {
      if (seq !== loadSeq.current) return;
      setFetchError("Could not load models");
      setModels(AI_MODELS_BY_PROVIDER[provider]);
      setSource("fallback");
    } finally {
      if (seq === loadSeq.current) {
        setLoading(false);
      }
    }
  }, [provider, draftApiKey]);

  useEffect(() => {
    if (!draftApiKey?.trim()) {
      void loadModels();
      return;
    }
    const t = window.setTimeout(() => void loadModels(), 400);
    return () => window.clearTimeout(t);
  }, [draftApiKey, loadModels]);

  useEffect(() => {
    if (loading || value || models.length === 0) return;
    const preferred = models.find((m) => m.id === defaultAiModelForProvider(provider));
    onChange(preferred?.id ?? models[0]!.id);
  }, [loading, value, models, provider, onChange]);

  const filtered = useMemo(() => {
    return models.filter((m) => modelMatchesQuery(m, query)).slice(0, LIST_CAP);
  }, [models, query]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [query, filtered.length]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const syncMenuRect = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuRect({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setMenuRect(null);
      return;
    }
    syncMenuRect();
    window.addEventListener("resize", syncMenuRect);
    window.addEventListener("scroll", syncMenuRect, true);
    return () => {
      window.removeEventListener("resize", syncMenuRect);
      window.removeEventListener("scroll", syncMenuRect, true);
    };
  }, [open, syncMenuRect]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !listboxRef.current?.contains(target)
      ) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const displayInputValue = open ? query : selected?.label ?? value;

  function pickModel(model: AiModelOption) {
    onChange(model.id);
    setOpen(false);
    setQuery("");
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlightIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && filtered[highlightIndex]) {
      e.preventDefault();
      pickModel(filtered[highlightIndex]!);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-1">
      <span className="text-sm font-medium text-neutral-900">{label}</span>
      {hint ? <p className="text-xs text-neutral-500">{hint}</p> : null}
      <div className="relative max-w-md">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          disabled={disabled}
          value={displayInputValue}
          placeholder={loading ? "Loading models…" : "Search models…"}
          className="input w-full font-mono text-xs"
          onFocus={() => {
            setOpen(true);
            setQuery(selected?.label ?? value);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onInputKeyDown}
        />
        {mounted && open && menuRect && filtered.length > 0
          ? createPortal(
              <ul
                ref={listboxRef}
                id={listboxId}
                role="listbox"
                className="fixed z-[200] max-h-60 overflow-auto rounded-xl bg-white py-1 shadow-lg ring-1 ring-neutral-950/10"
                style={{
                  top: menuRect.top,
                  left: menuRect.left,
                  width: menuRect.width,
                }}
              >
                {loading ? (
                  <li className="px-3 py-2 text-xs text-neutral-500">Updating model list…</li>
                ) : null}
                {filtered.map((model, index) => (
                  <li key={model.id} role="option" aria-selected={model.id === value}>
                    <button
                      type="button"
                      className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-cream-50 ${
                        index === highlightIndex ? "bg-cream-50" : ""
                      } ${model.id === value ? "text-brand-800" : "text-neutral-900"}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickModel(model)}
                    >
                      <span className="font-medium">{model.label}</span>
                      <span className="font-mono text-xs text-neutral-500">{model.id}</span>
                      {model.description ? (
                        <span className="line-clamp-2 text-xs text-neutral-500">
                          {model.description}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>,
              document.body,
            )
          : null}
      </div>
      {loading ? (
        <p className="text-xs text-neutral-500">Fetching available models…</p>
      ) : source === "fallback" ? (
        <p className="text-xs text-neutral-500">
          Showing a short default list{fetchError ? ` — ${fetchError}` : ""}.
        </p>
      ) : (
        <p className="text-xs text-neutral-500">
          {models.length} models available. Click the field and type to search.
        </p>
      )}
      {open && !loading && filtered.length === 0 ? (
        <p className="text-xs text-neutral-500">No models match your search.</p>
      ) : null}
      {!open && value && !selected && !loading ? (
        <p className="font-mono text-xs text-neutral-500">{value}</p>
      ) : null}
    </div>
  );
}

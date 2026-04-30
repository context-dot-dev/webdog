"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { caughtUnknownMessage } from "@/lib/caught-unknown-message";

export function ContextDevOnboardingForm({
  userName,
  className = "",
}: {
  userName: string;
  className?: string;
}) {
  const router = useRouter();
  const fieldId = useId();
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [deferBusy, setDeferBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSkipWarn, setShowSkipWarn] = useState(false);

  function onContinue(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    void (async () => {
      try {
        const res = await fetch("/api/user/context-intro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "complete", apiKey }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Something went wrong. Check your API key and try again.");
          return;
        }
        router.push("/dashboard");
        router.refresh();
      } catch (caught) {
        setError(caughtUnknownMessage(caught));
      } finally {
        setBusy(false);
      }
    })();
  }

  function runDefer() {
    setError(null);
    setDeferBusy(true);
    void (async () => {
      try {
        const res = await fetch("/api/user/context-intro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "defer" }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? "Could not skip right now.");
          return;
        }
        setShowSkipWarn(false);
        router.push("/dashboard");
        router.refresh();
      } catch (caught) {
        setError(caughtUnknownMessage(caught));
      } finally {
        setDeferBusy(false);
      }
    })();
  }

  return (
    <>
      <div className={className}>
        <p className="text-sm text-neutral-600">
          Hey {userName} —{" "}
          <span className="font-medium text-neutral-900">Web Watchdog</span> is powered by the Context.dev APIs.
          Visit{" "}
          <a
            href="https://context.dev/signup"
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-brand-700 underline decoration-brand-500/30 underline-offset-2 hover:decoration-brand-500"
          >
            context.dev/signup
          </a>{" "}
          to get your free API key, paste it below, and continue.
        </p>

        <form onSubmit={onContinue} className="mt-8 space-y-4">
          <div>
            <label htmlFor={fieldId} className="block text-sm font-medium text-neutral-900">
              Context.dev API key
            </label>
            <input
              id={fieldId}
              name="contextDevApiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
              placeholder="brand_…"
              className="input mt-1.5 box-border font-mono text-xs"
            />
          </div>

          {error && !showSkipWarn && (
            <p className="text-sm text-brand-700" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              disabled={busy || deferBusy}
              onClick={() => {
                setError(null);
                setShowSkipWarn(true);
              }}
              className="btn-ghost order-2 w-full py-2.5 sm:order-1 sm:w-auto sm:justify-self-start"
            >
              Skip
            </button>
            <button type="submit" disabled={busy || deferBusy} className="btn-accent order-1 w-full py-2.5 sm:order-2 sm:w-auto sm:min-w-[9rem]">
              {busy ? "Verifying…" : "Continue"}
            </button>
          </div>
        </form>

        <p className="mt-8 text-xs text-neutral-500">
          After you&apos;re done here, you can rotate your API key anytime under Settings in the dashboard.
        </p>
      </div>

      {showSkipWarn && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Dismiss dialog backdrop"
            className="absolute inset-0 bg-neutral-950/50"
            onClick={() => {
              setShowSkipWarn(false);
              setError(null);
            }}
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white p-6 shadow-card ring-1 ring-neutral-950/10">
            <p className="text-sm leading-relaxed text-neutral-900">
              A free context.dev API key is needed for Web Watchdog to work.
            </p>
            {error && (
              <p className="mt-4 text-sm text-brand-700" role="alert">
                {error}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={deferBusy}
                onClick={() => runDefer()}
                className="btn-ghost py-2.5 sm:px-4"
              >
                {deferBusy ? "Continuing…" : "Set up later"}
              </button>
              <button
                type="button"
                disabled={deferBusy}
                onClick={() => {
                  setShowSkipWarn(false);
                  setError(null);
                }}
                className="btn-accent py-2.5 sm:min-w-[7rem]"
              >
                Go back
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

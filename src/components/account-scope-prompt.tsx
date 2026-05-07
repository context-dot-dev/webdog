"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AccountChoice } from "@/lib/effective-account";

export function AccountScopePrompt({ choices }: { choices: AccountChoice[] }) {
  const router = useRouter();
  const [ownerId, setOwnerId] = useState(choices[0]?.ownerId ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    if (!ownerId) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/account/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerUserId: ownerId }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? "Could not save.");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (choices.length === 0) {
    return (
      <div className="rounded-2xl bg-amber-50 p-6 text-sm text-amber-900 ring-1 ring-amber-950/10">
        No accounts available. Reload the page after you have been invited or have created a site.
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-6 ring-1 ring-neutral-950/5">
      <h2 className="text-base font-semibold text-neutral-900">Choose an account</h2>
      <p className="mt-1 text-sm text-neutral-600">
        You have access to multiple accounts. Pick which one&apos;s settings you want to edit.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor="account-scope">
          Account
        </label>
        <select
          id="account-scope"
          className="input max-w-md"
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          disabled={loading}
        >
          {choices.map((c) => (
            <option key={c.ownerId} value={c.ownerId}>
              {c.kind === "self" ? `${c.label} (you)` : c.label}
            </option>
          ))}
        </select>
        <button type="button" className="btn-accent shrink-0 py-2" disabled={loading} onClick={() => void apply()}>
          {loading ? "Saving…" : "Continue"}
        </button>
      </div>
      {error && (
        <p className="mt-3 text-sm text-brand-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

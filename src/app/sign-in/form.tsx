"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { formatCredentialAuthUiError } from "@/lib/auth-ui-error";
import { caughtUnknownMessage } from "@/lib/caught-unknown-message";

export function SignInForm({
  className = "",
  inviteToken = null,
}: {
  className?: string;
  inviteToken?: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    void (async () => {
      try {
        const res = await authClient.signIn.email({ email, password });
        if (res.error) {
          setError(
            formatCredentialAuthUiError(res.error.message ?? "Sign in failed", res.error),
          );
          return;
        }
        const next =
          inviteToken && inviteToken.trim().length > 0
            ? `/invite/${encodeURIComponent(inviteToken.trim())}`
            : "/dashboard";
        router.push(next);
        router.refresh();
      } catch (caught) {
        setError(formatCredentialAuthUiError(caughtUnknownMessage(caught)));
      } finally {
        setLoading(false);
      }
    })();
  }

  return (
    <form onSubmit={onSubmit} className={`space-y-4 ${className}`}>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-neutral-900">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input mt-1.5"
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="block text-sm font-medium text-neutral-900">
            Password
          </label>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input mt-1.5"
        />
      </div>
      {error && (
        <p className="text-sm text-brand-700" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={loading} className="btn-accent w-full py-2.5">
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

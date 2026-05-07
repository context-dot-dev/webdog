"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { formatCredentialAuthUiError } from "@/lib/auth-ui-error";
import { caughtUnknownMessage } from "@/lib/caught-unknown-message";

export function SignUpForm({
  className = "",
  inviteToken = null,
}: {
  className?: string;
  inviteToken?: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
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
        const res = await authClient.signUp.email({ name, email, password });
        if (res.error) {
          setError(
            formatCredentialAuthUiError(res.error.message ?? "Sign up failed", res.error),
          );
          return;
        }
        const next =
          inviteToken && inviteToken.trim().length > 0
            ? `/invite/${encodeURIComponent(inviteToken.trim())}`
            : "/onboarding/context-dev";
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
        <label htmlFor="name" className="block text-sm font-medium text-neutral-900">
          Name
        </label>
        <input
          id="name"
          name="name"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input mt-1.5"
        />
      </div>
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
        <label htmlFor="password" className="block text-sm font-medium text-neutral-900">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input mt-1.5"
        />
        <p className="mt-1 text-xs text-neutral-500">At least 8 characters.</p>
      </div>
      {error && (
        <p className="text-sm text-brand-700" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={loading} className="btn-accent w-full py-2.5">
        {loading ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountChoice } from "@/lib/effective-account";

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    return j.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

/**
 * Visible when the user can access more than one account (personal + shared).
 */
export function AccountSwitcher({
  choices,
  activeOwnerId,
  className = "",
}: {
  choices: AccountChoice[];
  /** When missing (ambiguous scope), picker still switches once the user selects. */
  activeOwnerId?: string;
  className?: string;
}) {
  const router = useRouter();
  const [selection, setSelection] = useState(activeOwnerId ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelection(activeOwnerId ?? "");
  }, [activeOwnerId]);

  if (choices.length <= 1) return null;

  const value = selection;

  async function onSelect(next: string) {
    if (!next || next === selection) return;
    setError(null);
    setPending(true);
    setSelection(next);
    const res = await fetch("/api/account/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerUserId: next }),
    });
    setPending(false);
    if (res.ok) {
      router.refresh();
      return;
    }
    setSelection(activeOwnerId ?? "");
    setError(await parseErrorMessage(res));
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="flex items-center gap-2">
        <span className="sr-only">Active account</span>
        <select
          className="input max-w-[12rem] py-1.5 text-xs sm:max-w-[14rem]"
          value={value}
          aria-label="Active account"
          disabled={pending}
          onChange={(e) => void onSelect(e.target.value)}
        >
          {value === "" ? (
            <option value="">
              Choose account…
            </option>
          ) : null}
          {choices.map((c) => (
            <option key={`${c.kind}-${c.ownerId}`} value={c.ownerId}>
              {c.kind === "self" ? `${c.label} (you)` : c.label}
            </option>
          ))}
        </select>
      </label>
      {error ? (
        <p className="max-w-[14rem] text-xs text-brand-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function InviteClient({ token }: { token: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"working" | "done" | "error">("working");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/account/invites/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const j = (await res.json().catch(() => ({}))) as {
          error?: string;
          ownerUserId?: string;
        };
        if (!res.ok) {
          if (!cancelled) {
            setStatus("error");
            setMessage(j.error ?? "Could not accept invite.");
          }
          return;
        }
        if (j.ownerUserId) {
          await fetch("/api/account/active", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ownerUserId: j.ownerUserId }),
          });
        }
        if (!cancelled) {
          setStatus("done");
          router.push("/dashboard");
          router.refresh();
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Something went wrong. Try again from the invite link.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, token]);

  return (
    <div className="relative mx-auto grid min-h-dvh max-w-xs place-items-center px-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-32 size-[420px] rounded-full bg-peach opacity-50 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 size-[420px] rounded-full bg-mint opacity-50 blur-3xl" />
      </div>
      <div className="w-full rounded-3xl bg-white p-8 text-center shadow-soft ring-1 ring-neutral-900/5">
        {status === "working" && (
          <>
            <p className="text-sm font-medium text-neutral-900">Joining team…</p>
            <p className="mt-2 text-xs text-neutral-500">Hang on while we add you to this account.</p>
          </>
        )}
        {status === "done" && (
          <>
            <p className="text-sm font-medium text-neutral-900">You&apos;re in.</p>
            <p className="mt-2 text-xs text-neutral-500">Taking you to the dashboard…</p>
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-sm font-medium text-brand-800">{message ?? "Invite failed"}</p>
            <p className="mt-4 text-xs text-neutral-600">
              Ask whoever invited you for a fresh link from{" "}
              <span className="font-medium">Settings → Team</span>.
            </p>
            <Link href="/dashboard" className="mt-6 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">
              Go to dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

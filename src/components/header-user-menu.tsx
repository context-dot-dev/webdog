"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { caughtUnknownMessage } from "@/lib/caught-unknown-message";

export function HeaderUserMenu({
  user,
  avatarLogoUrl,
}: {
  user: { name: string; email: string };
  avatarLogoUrl?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const initials = user.name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const [avatarFailed, setAvatarFailed] = useState(false);
  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarLogoUrl]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function onSignOut() {
    setLoading(true);
    void (async () => {
      try {
        await authClient.signOut();
        router.push("/sign-in");
        router.refresh();
      } catch (caught) {
        console.error(caughtUnknownMessage(caught));
      } finally {
        setLoading(false);
      }
    })();
  }

  const showAvatarImg = Boolean(avatarLogoUrl && !avatarFailed);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        className={
          showAvatarImg
            ? "flex size-8 items-center justify-center overflow-hidden rounded-full bg-white text-xs font-medium ring-1 ring-neutral-950/10 transition hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            : "flex size-8 items-center justify-center overflow-hidden rounded-full bg-neutral-900 text-xs font-medium text-white transition hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        }
      >
        {showAvatarImg && avatarLogoUrl ? (
          <img
            src={avatarLogoUrl}
            alt=""
            className="size-full object-contain p-0.5"
            width={32}
            height={32}
            referrerPolicy="no-referrer"
            decoding="async"
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          initials || "?"
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl bg-white shadow-card ring-1 ring-neutral-950/10"
        >
          <div className="border-b border-neutral-950/5 p-3">
            <div className="truncate text-sm font-medium text-neutral-900">{user.name}</div>
            <div className="truncate text-xs text-neutral-500">{user.email}</div>
          </div>
          <div className="p-1">
            <button
              type="button"
              onClick={() => onSignOut()}
              disabled={loading}
              role="menuitem"
              className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-sm text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50"
            >
              {loading ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

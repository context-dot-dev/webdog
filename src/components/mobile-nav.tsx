"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const links = [
  { href: "/dashboard", label: "Websites" },
  { href: "/dashboard/alerts", label: "Alerts" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function MobileNav({ user }: { user: { name: string; email: string } }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  async function onSignOut() {
    setLoading(true);
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary px-2.5 py-1.5"
        aria-label="Open menu"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-4">
          <path d="M2 4h12M2 8h12M2 12h12" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-neutral-950/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 top-0 flex flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-950/5 px-4 py-3">
              <span className="font-semibold tracking-tight">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-ghost px-2 py-1 text-xs"
                aria-label="Close"
              >
                Close
              </button>
            </div>
            <nav className="flex flex-col gap-0.5 p-3" aria-label="Main">
              {links.map(({ href, label }) => {
                const active =
                  pathname === href ||
                  (href !== "/dashboard" && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-lg px-2.5 py-2 text-sm transition ${
                      active
                        ? "bg-neutral-100 text-neutral-900"
                        : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex items-center gap-3 border-t border-neutral-950/5 p-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-medium text-white">
                {user.name
                  .split(" ")
                  .map((s) => s[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join("")
                  .toUpperCase() || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-neutral-900">{user.name}</div>
                <div className="truncate text-xs text-neutral-500">{user.email}</div>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                disabled={loading}
                className="btn-ghost text-xs px-2 py-1"
                aria-label="Sign out"
              >
                {loading ? "…" : "Sign out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

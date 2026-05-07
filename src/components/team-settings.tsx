"use client";

import { useCallback, useEffect, useState } from "react";
import { INVITE_EXPIRY_MS, INVITE_MAX_USES } from "@/lib/invite-constants";

type InviteRow = {
  id: string;
  expiresAt: string;
  createdAt: string;
  useCount: number;
  maxUses: number;
};

type MemberRow = {
  userId: string;
  name: string;
  email: string;
  joinedAt: string;
};

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    return j.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export function TeamSettings() {
  const inviteDays = Math.round(INVITE_EXPIRY_MS / (24 * 60 * 60 * 1000));
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshInviteUrl, setFreshInviteUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [ir, mr] = await Promise.all([
      fetch("/api/account/invites", { cache: "no-store" }),
      fetch("/api/account/members", { cache: "no-store" }),
    ]);
    if (!ir.ok) {
      setError(await parseErrorMessage(ir));
      setLoading(false);
      return;
    }
    if (!mr.ok) {
      setError(await parseErrorMessage(mr));
      setLoading(false);
      return;
    }
    const ij = (await ir.json()) as { invites: InviteRow[] };
    const mj = (await mr.json()) as { members: MemberRow[] };
    setInvites(ij.invites);
    setMembers(mj.members);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createInvite() {
    setBusy(true);
    setError(null);
    setFreshInviteUrl(null);
    try {
      const res = await fetch("/api/account/invites", { method: "POST" });
      if (!res.ok) {
        setError(await parseErrorMessage(res));
        return;
      }
      const j = (await res.json()) as { inviteUrl: string };
      setFreshInviteUrl(j.inviteUrl);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function revokeInvite(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/account/invites/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) setError(await parseErrorMessage(res));
      else await load();
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(memberId: string) {
    if (
      !window.confirm("Remove this person from your account? They will lose dashboard access immediately.")
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/account/members/${encodeURIComponent(memberId)}`, {
        method: "DELETE",
      });
      if (!res.ok) setError(await parseErrorMessage(res));
      else await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-12" aria-labelledby="team-heading">
      <h2 id="team-heading" className="text-sm font-medium text-neutral-900">
        Team
      </h2>
      <p className="mt-1 text-sm text-neutral-600">
        Invite collaborators with one private link ({inviteDays}-day lifetime, up to {INVITE_MAX_USES} new members per
        link — handy for sharing in Slack). Links are shown here only; email is not sent for you. Collaborators have the
        same dashboard access as you for this account. Only you (the account owner) can create or revoke invite links;
        people you invite cannot issue new invites for this account.
      </p>
      <p className="mt-2 text-sm text-neutral-600">
        Password reset isn&apos;t available without email delivery. If someone forgets their password, remove their access
        and send a fresh invite once they&apos;ve signed up again.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-accent px-4 py-2 text-sm"
          disabled={busy || loading}
          onClick={() => void createInvite()}
        >
          Generate invite link
        </button>
      </div>

      {freshInviteUrl && (
        <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm ring-1 ring-emerald-950/10">
          <div className="font-medium text-emerald-900">
            Invite ready — share this URL with up to {INVITE_MAX_USES} teammates:
          </div>
          <code className="mt-2 block break-all font-mono text-xs text-emerald-900">{freshInviteUrl}</code>
          <button
            type="button"
            className="mt-3 text-xs font-medium text-emerald-800 underline underline-offset-2 hover:text-emerald-900"
            onClick={() => void navigator.clipboard.writeText(freshInviteUrl)}
          >
            Copy to clipboard
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-brand-700" role="alert">
          {error}
        </p>
      )}

      <div className="mt-8">
        <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500">Active invite links</h3>
        {loading ? (
          <p className="mt-2 text-sm text-neutral-500">Loading…</p>
        ) : invites.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No active invites. Generate one above.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-950/10 overflow-hidden rounded-xl bg-white ring-1 ring-neutral-950/5">
            {invites.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <div className="text-neutral-800">
                    {Math.max(0, inv.maxUses - inv.useCount)} of {inv.maxUses} seats left
                  </div>
                  <div className="text-xs text-neutral-500">Expires {new Date(inv.expiresAt).toLocaleString()}</div>
                  <div className="text-xs text-neutral-500">Created {new Date(inv.createdAt).toLocaleString()}</div>
                </div>
                <button
                  type="button"
                  className="btn-ghost shrink-0 px-2 py-1 text-xs"
                  disabled={busy}
                  onClick={() => void revokeInvite(inv.id)}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8">
        <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500">Members</h3>
        {loading ? (
          <p className="mt-2 text-sm text-neutral-500">Loading…</p>
        ) : members.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No collaborators yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-950/10 overflow-hidden rounded-xl bg-white ring-1 ring-neutral-950/5">
            {members.map((m) => (
              <li key={m.userId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium text-neutral-900">{m.name}</div>
                  <div className="truncate text-xs text-neutral-500">{m.email}</div>
                </div>
                <button
                  type="button"
                  className="btn-ghost shrink-0 px-2 py-1 text-xs"
                  disabled={busy}
                  onClick={() => void removeMember(m.userId)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

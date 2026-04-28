"use client";

import Link from "next/link";
import { useState } from "react";
import type { NotificationChannel } from "@/lib/db/schema";
import { parseWebsiteNotificationDestinationIds } from "@/lib/website-notification-destinations";

export type WebsiteDestOption = {
  id: string;
  channel: NotificationChannel;
  name: string;
};

function channelLabel(c: NotificationChannel): string {
  if (c === "SLACK") return "Slack";
  if (c === "EMAIL") return "Email";
  return "Webhook";
}

export function WebsiteNotificationDestinations({
  websiteId,
  notificationDestinationIdsJson,
  destinations,
}: {
  websiteId: string;
  notificationDestinationIdsJson: string | null;
  destinations: WebsiteDestOption[];
}) {
  const initialSel = parseWebsiteNotificationDestinationIds(notificationDestinationIdsJson);
  const initialMode: "all" | "none" | "some" =
    initialSel === null ? "all" : initialSel.length === 0 ? "none" : "some";

  const [mode, setMode] = useState<"all" | "none" | "some">(initialMode);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(initialSel ?? []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setError(null);
    if (mode === "some" && picked.size === 0) {
      setError("Select at least one destination, or choose “Don’t notify”.");
      return;
    }
    setSaving(true);
    try {
      const body =
        mode === "all"
          ? { notificationDestinationIds: null }
          : mode === "none"
            ? { notificationDestinationIds: [] }
            : { notificationDestinationIds: [...picked] };
      const res = await fetch(`/api/websites/${websiteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (destinations.length === 0) {
    return (
      <p className="text-sm text-neutral-600">
        Add notification destinations in{" "}
        <Link href="/dashboard/settings" className="text-brand-700 underline underline-offset-2 hover:decoration-brand-500">
          Settings
        </Link>{" "}
        to send alerts externally.
      </p>
    );
  }

  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-neutral-950/5">
      <h3 className="text-sm font-medium text-neutral-900">Alert destinations</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Choose where this site sends notifications when monitors fire.
      </p>

      <fieldset className="mt-4 space-y-2">
        <legend className="sr-only">Routing mode</legend>
        <label className="flex cursor-pointer items-start gap-2 text-sm text-neutral-800">
          <input
            type="radio"
            name="dest-mode"
            className="mt-1"
            checked={mode === "all"}
            onChange={() => {
              setMode("all");
              setError(null);
            }}
          />
          <span>All destinations (every integration you’ve added)</span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-sm text-neutral-800">
          <input
            type="radio"
            name="dest-mode"
            className="mt-1"
            checked={mode === "some"}
            onChange={() => {
              setMode("some");
              setPicked((p) => (p.size === 0 ? new Set(destinations.map((d) => d.id)) : p));
              setError(null);
            }}
          />
          <span>Only selected</span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-sm text-neutral-800">
          <input
            type="radio"
            name="dest-mode"
            className="mt-1"
            checked={mode === "none"}
            onChange={() => {
              setMode("none");
              setError(null);
            }}
          />
          <span>Don’t notify (in-app alerts only)</span>
        </label>
      </fieldset>

      {mode === "some" ? (
        <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-lg bg-neutral-50/80 p-3 ring-1 ring-neutral-950/5">
          {destinations.map((d) => (
            <li key={d.id}>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={picked.has(d.id)}
                  onChange={() => togglePick(d.id)}
                />
                <span className="font-medium text-neutral-900">{d.name}</span>
                <span className="text-xs text-neutral-500">({channelLabel(d.channel)})</span>
              </label>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="btn-primary box-border h-9 !px-3 !py-0 text-xs"
        >
          {saving ? "Saving…" : "Save routing"}
        </button>
        {saved ? (
          <span className="text-xs text-brand-700" role="status">
            Saved
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

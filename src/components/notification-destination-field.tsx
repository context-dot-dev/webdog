"use client";

import { useState } from "react";
import Link from "next/link";
import type { NotificationChannel } from "@/lib/db/schema";
import type { WebsiteDestOption } from "./website-notification-destinations";
import { TARGET_FORM_DASHBOARD_ONLY } from "@/lib/website-notification-destinations";

const CONTROL_CLASS =
  "w-full rounded-lg border border-neutral-950/10 bg-white px-2.5 py-2 text-sm text-neutral-800 shadow-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60";

function channelLabel(c: NotificationChannel): string {
  if (c === "SLACK") return "Slack";
  if (c === "EMAIL") return "Email";
  return "Webhook";
}

function defaultName(channel: NotificationChannel, value: string): string {
  if (channel === "EMAIL") {
    const first = value.split(/[,\s]+/).filter(Boolean)[0];
    return first || "Email";
  }
  if (channel === "SLACK") return "Slack";
  try {
    return new URL(value).host || "Webhook";
  } catch {
    return "Webhook";
  }
}

/**
 * Notification-destination selector with inline creation, decoupled from any
 * target (used pre-creation in the add-monitor modal). Picks an existing
 * destination or dashboard-only, or creates a new Email/Slack/Webhook one and
 * selects it — no page navigation.
 */
export function NotificationDestinationField({
  value,
  onChange,
  destinations,
  onDestinationsChange,
  resendApiKeyManaged,
  resendSendFromEmailManaged,
}: {
  value: string;
  onChange: (next: string) => void;
  destinations: WebsiteDestOption[];
  onDestinationsChange: (next: WebsiteDestOption[]) => void;
  resendApiKeyManaged: boolean;
  resendSendFromEmailManaged: boolean;
}) {
  const [adding, setAdding] = useState<NotificationChannel | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [emailTo, setEmailTo] = useState("");
  const [emailFrom, setEmailFrom] = useState("");
  const [slackUrl, setSlackUrl] = useState("");
  const [hookUrl, setHookUrl] = useState("");

  function openAdd(channel: NotificationChannel) {
    setAdding(channel);
    setError(null);
    setEmailTo("");
    setEmailFrom("");
    setSlackUrl("");
    setHookUrl("");
  }

  async function createDestination(channel: NotificationChannel) {
    setError(null);
    let payload: Record<string, unknown>;
    if (channel === "EMAIL") {
      const to = emailTo.trim();
      if (!to) {
        setError("Add at least one recipient email.");
        return;
      }
      payload = {
        channel: "EMAIL",
        name: defaultName("EMAIL", to),
        resendToEmails: to,
        ...(resendSendFromEmailManaged ? {} : { resendFromEmail: emailFrom.trim() }),
      };
    } else if (channel === "SLACK") {
      const url = slackUrl.trim();
      if (!url) {
        setError("Paste your Slack incoming webhook URL.");
        return;
      }
      payload = { channel: "SLACK", name: defaultName("SLACK", url), slackWebhookUrl: url };
    } else {
      const url = hookUrl.trim();
      if (!url) {
        setError("Paste the webhook URL to POST alerts to.");
        return;
      }
      payload = { channel: "WEBHOOK", name: defaultName("WEBHOOK", url), alertWebhookUrl: url };
    }

    setBusy(true);
    const res = await fetch("/api/user/notification-destinations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      destination?: { id: string; channel: NotificationChannel; name: string };
    };
    setBusy(false);
    if (!res.ok || !data.destination) {
      setError(data.error ?? "Could not add destination.");
      return;
    }
    const d = data.destination;
    onDestinationsChange([{ id: d.id, channel: d.channel, name: d.name }, ...destinations]);
    setAdding(null);
    onChange(d.id);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <select
        className={CONTROL_CLASS}
        value={value}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Where alerts go for this monitor"
      >
        <option value={TARGET_FORM_DASHBOARD_ONLY}>Dashboard only</option>
        {destinations.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name} ({channelLabel(d.channel)})
          </option>
        ))}
      </select>

      {adding === null ? (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-neutral-500">Add:</span>
          {(["EMAIL", "SLACK", "WEBHOOK"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => openAdd(c)}
              className="btn-ghost px-1.5 py-0.5 text-xs"
            >
              + {channelLabel(c)}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-0.5 space-y-2 rounded-lg bg-neutral-50 p-3 ring-1 ring-neutral-950/5">
          <div className="text-xs font-medium text-neutral-800">New {channelLabel(adding)} destination</div>

          {adding === "EMAIL" && (
            <>
              {!resendSendFromEmailManaged && (
                <input
                  className={CONTROL_CLASS}
                  type="email"
                  value={emailFrom}
                  onChange={(e) => setEmailFrom(e.target.value)}
                  placeholder="From (verified sender, e.g. alerts@yourdomain.com)"
                />
              )}
              <input
                className={CONTROL_CLASS}
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="Send to: you@co.com, ops@co.com"
              />
              {!resendApiKeyManaged && (
                <p className="text-xs text-neutral-500">
                  Email needs a Resend API key —{" "}
                  <Link href="/dashboard/settings" className="text-brand-700 hover:underline">
                    add it in Settings
                  </Link>
                  .
                </p>
              )}
            </>
          )}

          {adding === "SLACK" && (
            <input
              className={CONTROL_CLASS}
              value={slackUrl}
              onChange={(e) => setSlackUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/…"
            />
          )}

          {adding === "WEBHOOK" && (
            <input
              className={CONTROL_CLASS}
              value={hookUrl}
              onChange={(e) => setHookUrl(e.target.value)}
              placeholder="https://your-endpoint.com/hook"
            />
          )}

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void createDestination(adding)}
              disabled={busy}
              className="btn-primary box-border h-8 !px-3 !py-0 text-xs"
            >
              {busy ? "Saving…" : "Add & use"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(null);
                setError(null);
              }}
              className="btn-ghost px-2 py-1 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

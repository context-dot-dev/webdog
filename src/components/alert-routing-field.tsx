"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { NotificationChannel } from "@/lib/db/schema";
import type { WebsiteDestOption } from "./website-notification-destinations";
import { TARGET_FORM_DASHBOARD_ONLY } from "@/lib/website-notification-destinations";

const CONTROL_CLASS =
  "w-full rounded-lg border border-neutral-950/10 bg-white px-2.5 py-1.5 text-xs text-neutral-800 shadow-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60";

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
 * Inline alert routing for a single monitor: pick an existing destination,
 * create a new Email/Slack/Webhook destination without leaving the page, and
 * send a real test so users can confirm delivery works.
 */
export function AlertRoutingField({
  targetId,
  initialDestinations,
  initialValue,
  resendApiKeyManaged,
  resendSendFromEmailManaged,
}: {
  targetId: string;
  initialDestinations: WebsiteDestOption[];
  initialValue: string;
  resendApiKeyManaged: boolean;
  resendSendFromEmailManaged: boolean;
}) {
  const router = useRouter();
  const [dests, setDests] = useState<WebsiteDestOption[]>(initialDestinations);
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<NotificationChannel | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [emailTo, setEmailTo] = useState("");
  const [emailFrom, setEmailFrom] = useState("");
  const [slackUrl, setSlackUrl] = useState("");
  const [hookUrl, setHookUrl] = useState("");

  const [testState, setTestState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const isDashboardOnly = value === TARGET_FORM_DASHBOARD_ONLY;

  async function routeTarget(next: string): Promise<boolean> {
    setBusy(true);
    const body =
      next === TARGET_FORM_DASHBOARD_ONLY
        ? { externalNotify: false, notificationDestinationId: null }
        : { externalNotify: true, notificationDestinationId: next };
    const res = await fetch(`/api/targets/${targetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.ok) {
      setValue(next);
      setTestState("idle");
      setTestMsg(null);
      router.refresh();
      return true;
    }
    return false;
  }

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
    setDests((prev) => [{ id: d.id, channel: d.channel, name: d.name }, ...prev]);
    setAdding(null);
    await routeTarget(d.id);
  }

  async function sendTest() {
    if (isDashboardOnly) return;
    setTestState("sending");
    setTestMsg(null);
    try {
      const res = await fetch("/api/user/notification-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationId: value }),
      });
      if (res.ok) {
        setTestState("sent");
        window.setTimeout(() => setTestState("idle"), 4000);
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setTestState("error");
        setTestMsg(data.error ?? "Test failed.");
      }
    } catch {
      setTestState("error");
      setTestMsg("Test failed.");
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-neutral-500">
        Alert routing
      </span>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className={`${CONTROL_CLASS} max-w-xs`}
          value={value}
          disabled={busy}
          onChange={(e) => void routeTarget(e.target.value)}
          aria-label="Where alerts go for this monitor"
        >
          <option value={TARGET_FORM_DASHBOARD_ONLY}>None (dashboard only)</option>
          {dests.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({channelLabel(d.channel)})
            </option>
          ))}
        </select>

        {!isDashboardOnly && (
          <button
            type="button"
            onClick={() => void sendTest()}
            disabled={busy || testState === "sending"}
            className="btn-secondary box-border h-8 !px-2.5 !py-0 text-xs"
          >
            {testState === "sending" ? "Sending…" : testState === "sent" ? "Sent ✓" : "Send test"}
          </button>
        )}
      </div>

      {testState === "sent" && (
        <p className="text-xs text-emerald-700">Test notification sent — check your inbox / channel.</p>
      )}
      {testState === "error" && testMsg && (
        <p className="text-xs text-rose-600">{testMsg}</p>
      )}

      {/* Add a destination inline */}
      {adding === null ? (
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-neutral-500">Add:</span>
          {(["EMAIL", "SLACK", "WEBHOOK"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => openAdd(c)}
              className="btn-ghost px-2 py-1 text-xs"
            >
              + {channelLabel(c)}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-1 space-y-2 rounded-lg bg-white p-3 ring-1 ring-neutral-950/10">
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
              {busy ? "Saving…" : "Add & route here"}
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

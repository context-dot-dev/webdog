"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useCallback, useId, useState } from "react";
import type { NotificationDestination } from "@/lib/db/schema";
import { isValidAlertWebhookUrl } from "@/lib/notify-outbound-webhook";
import { parseResendToEmails } from "@/lib/notify-resend";
import { isValidSlackIncomingWebhookUrl } from "@/lib/notify-slack";
import { NEW_ALERTS_EVENT_TYPE, TEST_EVENT_TYPE } from "@/lib/product-info";

/** Envelope icon — Font Awesome Free v7.2.0 (https://fontawesome.com/license/free). */
function EmailEnvelopeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 640 640" fill="currentColor" aria-hidden {...props}>
      <path d="M125.4 128C91.5 128 64 155.5 64 189.4C64 190.3 64 191.1 64.1 192L64 192L64 448C64 483.3 92.7 512 128 512L512 512C547.3 512 576 483.3 576 448L576 192L575.9 192C575.9 191.1 576 190.3 576 189.4C576 155.5 548.5 128 514.6 128L125.4 128zM528 256.3L528 448C528 456.8 520.8 464 512 464L128 464C119.2 464 112 456.8 112 448L112 256.3L266.8 373.7C298.2 397.6 341.7 397.6 373.2 373.7L528 256.3zM112 189.4C112 182 118 176 125.4 176L514.6 176C522 176 528 182 528 189.4C528 193.6 526 197.6 522.7 200.1L344.2 335.5C329.9 346.3 310.1 346.3 295.8 335.5L117.3 200.1C114 197.6 112 193.6 112 189.4z" />
    </svg>
  );
}

function WebhookLinkIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
      />
    </svg>
  );
}

/** Circle “i” for hover tooltips (subtitle hints). */
function InfoHintIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
      />
    </svg>
  );
}

function trunc(s: string, n: number): string {
  const t = s.trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

/** Redact path/query for inbound webhook URLs (shown until user chooses Show). */
function redactSecretUrl(url: string): string {
  const t = url.trim();
  if (!t) return "—";
  try {
    const u = new URL(t);
    if (u.hostname === "hooks.slack.com" && u.pathname.startsWith("/services/")) {
      return `${u.origin}/services/••••••••`;
    }
    return `${u.origin}/••••••••`;
  } catch {
    return "••••••••";
  }
}

function destinationSecretUrl(d: NotificationDestination): string | null {
  if (d.channel === "SLACK") {
    const u = d.slackWebhookUrl?.trim() ?? "";
    return u || null;
  }
  if (d.channel === "WEBHOOK") {
    const u = d.alertWebhookUrl?.trim() ?? "";
    return u || null;
  }
  return null;
}

function destinationSummary(d: NotificationDestination, resendSendFromEmailManaged: boolean): string {
  if (d.channel === "SLACK") {
    const u = d.slackWebhookUrl?.trim() ?? "";
    return u ? trunc(u, 48) : "—";
  }
  if (d.channel === "EMAIL") {
    const from = d.resendFromEmail?.trim() ?? "";
    const to = parseResendToEmails(d.resendToEmails ?? null);
    const fromLabel = resendSendFromEmailManaged ? "Managed sender" : from;
    return fromLabel && to.length ? `${fromLabel} → ${to.length} recipient(s)` : "—";
  }
  const u = d.alertWebhookUrl?.trim() ?? "";
  return u ? trunc(u, 48) : "—";
}

/** Line in destination list: webhook URL with path redacted (no reveal control). */
function RedactedWebhookSummary({ url }: { url: string }) {
  return (
    <div className="truncate font-mono text-xs text-neutral-600">{redactSecretUrl(url)}</div>
  );
}

function canTestDestination(
  d: NotificationDestination,
  accountResendKey: string,
  resendApiKeyManaged: boolean,
  resendSendFromEmailManaged: boolean,
): boolean {
  if (d.channel === "SLACK") {
    const u = d.slackWebhookUrl?.trim() ?? "";
    return u !== "" && isValidSlackIncomingWebhookUrl(u);
  }
  if (d.channel === "WEBHOOK") {
    const u = d.alertWebhookUrl?.trim() ?? "";
    return u !== "" && isValidAlertWebhookUrl(u);
  }
  const keyOk = resendApiKeyManaged || accountResendKey.trim() !== "";
  const fromOk = resendSendFromEmailManaged || (d.resendFromEmail?.trim() ?? "") !== "";
  const to = parseResendToEmails(d.resendToEmails ?? null);
  return Boolean(keyOk && fromOk && to.length > 0);
}

type Channel = NotificationDestination["channel"];

function NotificationChannelRow({
  title,
  subtitle,
  subtitleHintTitle,
  icon,
  list,
  formSlot,
  onAdd,
  resendApiKey,
  onStartEdit,
  onDelete,
  onTest,
  testBusyId,
  testFlashId,
  formOpen,
  editingId,
  resendApiKeyManaged,
  resendSendFromEmailManaged,
}: {
  title: string;
  subtitle: string;
  /** Native tooltip on the info control beside the subtitle. */
  subtitleHintTitle?: string;
  icon: ReactNode;
  list: NotificationDestination[];
  formSlot: ReactNode;
  onAdd: () => void;
  resendApiKey: string;
  onStartEdit: (d: NotificationDestination) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
  testBusyId: string | null;
  testFlashId: string | null;
  formOpen: boolean;
  editingId: string | null;
  resendApiKeyManaged: boolean;
  resendSendFromEmailManaged: boolean;
}) {
  const visibleList = list.filter((d) => !(formOpen && editingId === d.id));
  const hasForm = Boolean(formSlot);
  const hasBody = visibleList.length > 0 || hasForm;

  return (
    <div className="border-b border-neutral-950/5 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-0.5 ring-1 ring-neutral-950/10">
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-neutral-900">{title}</h3>
            <div className="flex flex-wrap items-center gap-x-1 gap-y-0">
              <p className="text-xs text-neutral-500">{subtitle}</p>
              {subtitleHintTitle ? (
                <button
                  type="button"
                  className="inline-flex shrink-0 rounded-full p-0.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  title={subtitleHintTitle}
                  aria-label={subtitleHintTitle}
                >
                  <InfoHintIcon className="size-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="btn-secondary box-border h-9 shrink-0 !px-3 !py-0 text-xs whitespace-nowrap"
        >
          Add destination
        </button>
      </div>

      {hasBody ? (
        <div className="space-y-3 px-5 pb-5">
          {visibleList.length > 0 ? (
            <div className="max-w-xl space-y-2">
              {visibleList.map((d) => {
                const secretUrl = destinationSecretUrl(d);
                return (
                  <div
                    key={d.id}
                    className="rounded-lg bg-neutral-50/80 px-3 py-2.5 ring-1 ring-neutral-950/5"
                  >
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-neutral-900">{d.name}</div>
                        {secretUrl ? (
                          <RedactedWebhookSummary url={secretUrl} />
                        ) : (
                          <div className="truncate font-mono text-xs text-neutral-600">
                            {destinationSummary(d, resendSendFromEmailManaged)}
                          </div>
                        )}
                        {testFlashId === d.id ? (
                          <p className="mt-0.5 text-xs text-brand-700">Test sent</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onTest(d.id)}
                          disabled={
                            testBusyId === d.id ||
                            !canTestDestination(
                              d,
                              resendApiKey,
                              resendApiKeyManaged,
                              resendSendFromEmailManaged,
                            )
                          }
                          title={
                            !canTestDestination(
                              d,
                              resendApiKey,
                              resendApiKeyManaged,
                              resendSendFromEmailManaged,
                            )
                              ? "Complete this destination before testing"
                              : undefined
                          }
                          className="btn-secondary box-border h-8 !px-2 !py-0 text-xs"
                        >
                          {testBusyId === d.id ? "…" : "Test"}
                        </button>
                        <button
                          type="button"
                          onClick={() => onStartEdit(d)}
                          className="btn-secondary box-border h-8 !px-2 !py-0 text-xs"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDelete(d.id)}
                          className="btn-ghost box-border h-8 !px-2 !py-0 text-xs text-red-700 ring-red-200 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {formSlot}
        </div>
      ) : null}
    </div>
  );
}

export function NotificationChannelsSettings({
  initialResendApiKey,
  initialDestinations,
  resendApiKeyManaged,
  resendSendFromEmailManaged,
}: {
  initialResendApiKey: string | null;
  initialDestinations: NotificationDestination[];
  resendApiKeyManaged: boolean;
  resendSendFromEmailManaged: boolean;
}) {
  const [destinations, setDestinations] = useState<NotificationDestination[]>(() => initialDestinations);
  const [resendApiKey, setResendApiKey] = useState(() =>
    resendApiKeyManaged ? "" : initialResendApiKey ?? "",
  );

  const [addingChannel, setAddingChannel] = useState<Channel | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formSlackUrl, setFormSlackUrl] = useState("");
  const [formFrom, setFormFrom] = useState("");
  const [formTo, setFormTo] = useState("");
  const [formHookUrl, setFormHookUrl] = useState("");
  const [revealFormSlackUrl, setRevealFormSlackUrl] = useState(false);
  const [revealFormHookUrl, setRevealFormHookUrl] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);

  const [testBusyId, setTestBusyId] = useState<string | null>(null);
  const [testFlashId, setTestFlashId] = useState<string | null>(null);

  const emailFormId = useId();

  const byChannel = useCallback(
    (c: Channel) => destinations.filter((d) => d.channel === c),
    [destinations],
  );

  const startAdd = (channel: Channel) => {
    setEditingId(null);
    setAddingChannel(channel);
    setFormError(null);
    setFormName("");
    setFormSlackUrl("");
    setFormFrom("");
    setFormTo("");
    setFormHookUrl("");
    setRevealFormSlackUrl(false);
    setRevealFormHookUrl(false);
  };

  const startEdit = (d: NotificationDestination) => {
    setAddingChannel(null);
    setEditingId(d.id);
    setFormError(null);
    setFormName(d.name);
    setFormSlackUrl(d.slackWebhookUrl ?? "");
    setFormFrom(resendSendFromEmailManaged ? "" : d.resendFromEmail ?? "");
    setFormTo(d.resendToEmails ?? "");
    setFormHookUrl(d.alertWebhookUrl ?? "");
    setRevealFormSlackUrl(false);
    setRevealFormHookUrl(false);
  };

  const cancelForm = () => {
    setAddingChannel(null);
    setEditingId(null);
    setFormError(null);
    setRevealFormSlackUrl(false);
    setRevealFormHookUrl(false);
  };

  async function submitForm(channel: Channel) {
    setFormError(null);
    setFormSaving(true);
    try {
      if (channel === "EMAIL" && !resendApiKeyManaged) {
        const keyRes = await fetch("/api/user/notification-settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resendApiKey: resendApiKey.trim() === "" ? null : resendApiKey.trim(),
          }),
        });
        const keyData = (await keyRes.json().catch(() => ({}))) as {
          error?: string;
          resendApiKey?: string | null;
        };
        if (!keyRes.ok) {
          setFormError(keyData.error ?? "Could not save Resend API key");
          return;
        }
        if (keyData.resendApiKey !== undefined) setResendApiKey(keyData.resendApiKey ?? "");
      }

      if (editingId) {
        const body: Record<string, unknown> = { name: formName.trim() };
        if (channel === "SLACK") body.slackWebhookUrl = formSlackUrl.trim() || null;
        if (channel === "EMAIL") {
          if (!resendSendFromEmailManaged) body.resendFromEmail = formFrom.trim() || null;
          body.resendToEmails = formTo.trim() || null;
        }
        if (channel === "WEBHOOK") body.alertWebhookUrl = formHookUrl.trim() || null;

        const res = await fetch(`/api/user/notification-destinations/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          destination?: NotificationDestination;
        };
        if (!res.ok) {
          setFormError(data.error ?? "Save failed");
          return;
        }
        if (data.destination) {
          setDestinations((prev) => prev.map((x) => (x.id === data.destination!.id ? data.destination! : x)));
        }
        cancelForm();
        return;
      }

      const payload =
        channel === "SLACK"
          ? { channel: "SLACK" as const, name: formName.trim(), slackWebhookUrl: formSlackUrl.trim() }
          : channel === "EMAIL"
            ? {
                channel: "EMAIL" as const,
                name: formName.trim(),
                ...(resendSendFromEmailManaged ? {} : { resendFromEmail: formFrom.trim() }),
                resendToEmails: formTo.trim(),
              }
            : {
                channel: "WEBHOOK" as const,
                name: formName.trim(),
                alertWebhookUrl: formHookUrl.trim(),
              };

      const res = await fetch("/api/user/notification-destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        destination?: NotificationDestination;
      };
      if (!res.ok) {
        setFormError(data.error ?? "Save failed");
        return;
      }
      if (data.destination) {
        setDestinations((prev) => [data.destination!, ...prev]);
      }
      cancelForm();
    } catch {
      setFormError("Save failed");
    } finally {
      setFormSaving(false);
    }
  }

  async function deleteDestination(id: string) {
    if (!window.confirm("Remove this destination? Websites that only targeted it will stop notifying that route.")) {
      return;
    }
    const res = await fetch(`/api/user/notification-destinations/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDestinations((prev) => prev.filter((d) => d.id !== id));
      if (editingId === id) cancelForm();
    }
  }

  async function testDestination(id: string) {
    setTestBusyId(id);
    setTestFlashId(null);
    try {
      const res = await fetch("/api/user/notification-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationId: id }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        alert(data.error ?? "Test failed");
        return;
      }
      setTestFlashId(id);
      window.setTimeout(() => setTestFlashId(null), 3000);
    } catch {
      alert("Test failed");
    } finally {
      setTestBusyId(null);
    }
  }

  const renderForm = (channel: Channel) => {
    const show =
      addingChannel === channel || (editingId !== null && byChannel(channel).some((d) => d.id === editingId));
    if (!show) return null;
    const isEdit = Boolean(editingId && byChannel(channel).some((d) => d.id === editingId));
    return (
      <div className="max-w-xl rounded-lg border border-neutral-200 bg-white p-4 space-y-3">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-neutral-700">Name</label>
          <input
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            className="input box-border h-9 w-full text-sm"
            placeholder="e.g. Team alerts"
          />
        </div>
        {channel === "SLACK" ? (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-medium text-neutral-700">Slack webhook URL</label>
              <button
                type="button"
                onClick={() => setRevealFormSlackUrl((v) => !v)}
                aria-pressed={revealFormSlackUrl}
                aria-label={revealFormSlackUrl ? "Hide Slack webhook URL" : "Show Slack webhook URL"}
                className="btn-ghost box-border h-7 shrink-0 !px-2 !py-0 text-xs text-neutral-600"
              >
                {revealFormSlackUrl ? "Hide" : "Show"}
              </button>
            </div>
            <input
              value={formSlackUrl}
              onChange={(e) => setFormSlackUrl(e.target.value)}
              type={revealFormSlackUrl ? "text" : "password"}
              autoComplete="off"
              className="input box-border h-9 w-full font-mono text-xs"
              placeholder="https://hooks.slack.com/services/…"
            />
          </div>
        ) : null}
        {channel === "EMAIL" ? (
          <>
            {resendApiKeyManaged ? (
              <div className="rounded-lg bg-neutral-50/80 px-3 py-2 ring-1 ring-neutral-950/5">
                <p className="text-xs font-medium text-neutral-800">Email delivery is configured by this deployment.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label htmlFor={`${emailFormId}-resend`} className="block text-xs font-medium text-neutral-700">
                  Resend API key
                </label>
                <p className="text-xs text-neutral-500">
                  Saved to your account and autofilled here. Clearing it removes the stored key when you save.
                </p>
                <input
                  id={`${emailFormId}-resend`}
                  type="password"
                  value={resendApiKey}
                  onChange={(e) => setResendApiKey(e.target.value)}
                  autoComplete="off"
                  className="input box-border h-9 w-full font-mono text-xs"
                  placeholder="re_…"
                />
              </div>
            )}
            {resendSendFromEmailManaged ? (
              <div className="rounded-lg bg-neutral-50/80 px-3 py-2 ring-1 ring-neutral-950/5">
                <p className="text-xs font-medium text-neutral-800">Sender address is configured by this deployment.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label htmlFor={`${emailFormId}-from`} className="block text-xs font-medium text-neutral-700">
                  Verified from email
                </label>
                <input
                  id={`${emailFormId}-from`}
                  value={formFrom}
                  onChange={(e) => setFormFrom(e.target.value)}
                  type="email"
                  className="input box-border h-9 w-full text-sm"
                  placeholder="alerts@yourdomain.com"
                  autoComplete="email"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-neutral-700">Send to email(s)</label>
              <textarea
                value={formTo}
                onChange={(e) => setFormTo(e.target.value)}
                rows={2}
                className="input box-border min-h-[3.5rem] w-full py-2 font-mono text-xs"
                placeholder="you@co.com, ops@co.com"
              />
            </div>
          </>
        ) : null}
        {channel === "WEBHOOK" ? (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-medium text-neutral-700">Webhook URL</label>
              <button
                type="button"
                onClick={() => setRevealFormHookUrl((v) => !v)}
                aria-pressed={revealFormHookUrl}
                aria-label={revealFormHookUrl ? "Hide webhook URL" : "Show webhook URL"}
                className="btn-ghost box-border h-7 shrink-0 !px-2 !py-0 text-xs text-neutral-600"
              >
                {revealFormHookUrl ? "Hide" : "Show"}
              </button>
            </div>
            <input
              value={formHookUrl}
              onChange={(e) => setFormHookUrl(e.target.value)}
              type={revealFormHookUrl ? "text" : "password"}
              autoComplete="off"
              className="input box-border h-9 w-full font-mono text-xs"
              placeholder="https://…"
            />
          </div>
        ) : null}
        {formError ? (
          <p className="text-xs text-red-600" role="alert">
            {formError}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={formSaving}
            onClick={() => void submitForm(channel)}
            className="btn-primary box-border h-9 !px-3 !py-0 text-xs"
          >
            {formSaving ? "Saving…" : isEdit ? "Save changes" : "Add destination"}
          </button>
          <button type="button" onClick={cancelForm} className="btn-secondary box-border h-9 !px-3 !py-0 text-xs">
            Cancel
          </button>
        </div>
      </div>
    );
  };

  const sections: {
    channel: Channel;
    title: string;
    subtitle: string;
    icon: ReactNode;
  }[] = [
    {
      channel: "SLACK",
      title: "Slack",
      subtitle: "Incoming webhooks",
      icon: <Image src="/slack-logo.png" alt="" width={24} height={24} className="size-6 object-contain" />,
    },
    {
      channel: "EMAIL",
      title: "Email",
      subtitle: "Deliver via Resend",
      icon: <EmailEnvelopeIcon className="size-6 text-neutral-700" />,
    },
    {
      channel: "WEBHOOK",
      title: "Webhook",
      subtitle: "POST JSON for new alerts",
      icon: <WebhookLinkIcon className="size-6 text-neutral-700" />,
    },
  ];

  const webhookPayloadHintTitle =
    `Payloads use type: ${NEW_ALERTS_EVENT_TYPE} (and ${TEST_EVENT_TYPE} for tests).`;

  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-950/5">
      {sections.map((s) => {
        const list = byChannel(s.channel);
        const formOpen =
          addingChannel === s.channel ||
          (editingId !== null && list.some((d) => d.id === editingId));

        return (
          <NotificationChannelRow
            key={s.channel}
            title={s.title}
            subtitle={s.subtitle}
            subtitleHintTitle={s.channel === "WEBHOOK" ? webhookPayloadHintTitle : undefined}
            icon={s.icon}
            list={list}
            formSlot={renderForm(s.channel) ?? null}
            onAdd={() => startAdd(s.channel)}
            resendApiKey={resendApiKey}
            onStartEdit={startEdit}
            onDelete={deleteDestination}
            onTest={(id) => void testDestination(id)}
            testBusyId={testBusyId}
            testFlashId={testFlashId}
            formOpen={Boolean(formOpen)}
            editingId={editingId}
            resendApiKeyManaged={resendApiKeyManaged}
            resendSendFromEmailManaged={resendSendFromEmailManaged}
          />
        );
      })}
    </div>
  );
}

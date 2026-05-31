/**
 * Outbound email via Resend (https://resend.com/docs/api-reference/emails/send-email).
 */

import { z } from "zod";

const RESEND_API_URL = "https://api.resend.com/emails";
const FETCH_TIMEOUT_MS = 15_000;
const LIST_SPLIT = /[\n,]+/;

export function parseResendToEmails(raw: string | null | undefined): string[] {
  if (raw == null || raw.trim() === "") return [];
  const parts = raw
    .split(LIST_SPLIT)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.filter((p) => z.string().email().safeParse(p).success);
}

export function normalizeResendToEmailsForStorage(
  input: string | null,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (input === null) return { ok: true, value: null };
  const t = input.trim();
  if (t === "") return { ok: true, value: null };
  const parts = t
    .split(LIST_SPLIT)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { ok: true, value: null };
  for (const p of parts) {
    if (!z.string().email().safeParse(p).success) {
      return { ok: false, error: `Invalid email in list: ${p}` };
    }
  }
  return { ok: true, value: parts.join(", ") };
}

export function isResendNotifyConfigured(settings: {
  resendApiKey: string | null | undefined;
  resendFromEmail: string | null | undefined;
  resendToEmails: string | null | undefined;
}): boolean {
  const key = settings.resendApiKey?.trim() ?? "";
  const from = settings.resendFromEmail?.trim() ?? "";
  if (!key || !from) return false;
  return parseResendToEmails(settings.resendToEmails ?? null).length > 0;
}

export async function sendResendEmail(opts: {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const body: Record<string, unknown> = {
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
  };
  if (opts.html) body.html = opts.html;

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[resend] API error: ${res.status}`, body);
    const err = new Error(`resend_http_${res.status}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
}

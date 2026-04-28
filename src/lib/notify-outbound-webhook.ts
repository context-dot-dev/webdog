/**
 * Generic outbound webhooks: POST JSON to a user-configured URL (https or http).
 */

const FETCH_TIMEOUT_MS = 15_000;

export function isValidAlertWebhookUrl(urlStr: string): boolean {
  const s = urlStr.trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (!u.host) return false;
    return true;
  } catch {
    return false;
  }
}

export async function postAlertWebhookJson(url: string, body: unknown): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "WebWatchdog/1.0",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const err = new Error(`alert_webhook_http_${res.status}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
}

export const ALERT_WEBHOOK_TEST_BODY = {
  type: "web_watchdog.test",
  version: 1 as const,
  message: "If you receive this JSON payload, your Webhook integration is working.",
};

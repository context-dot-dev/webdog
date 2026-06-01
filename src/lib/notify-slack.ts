/**
 * Outbound Slack incoming webhooks (https://api.slack.com/messaging/webhooks).
 * Only POST to URLs validated with {@link isValidSlackIncomingWebhookUrl}.
 */

import type { SlackBlock } from "./notification-new-alerts";

const FETCH_TIMEOUT_MS = 15_000;

export function isValidSlackIncomingWebhookUrl(urlStr: string): boolean {
  const s = urlStr.trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" || u.hostname !== "hooks.slack.com") return false;
    if (!u.pathname.startsWith("/services/")) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * POST a message to a Slack incoming webhook.
 *
 * `text` is always sent as the notification fallback (required by Slack even
 * when blocks are present — it's used in push notifications, accessibility,
 * and unfurl contexts where blocks aren't rendered).
 *
 * `blocks` is the Block Kit payload for rich rendering in the Slack UI.
 */
export async function postSlackIncomingWebhook(
  url: string,
  text: string,
  blocks?: SlackBlock[],
): Promise<void> {
  const body: Record<string, unknown> = { text };
  if (blocks && blocks.length > 0) body.blocks = blocks;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const err = new Error(`slack_webhook_http_${res.status}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
}


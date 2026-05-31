/**
 * Optional deployment attribution (POSTFIX_TO_ALERTS) for notification footers.
 */

const CONTEXT_DEV_URL = "https://context.dev";

export function stripAlertPostfixText(text: string, postfix: string | null | undefined): string {
  if (!postfix) return text;
  const trimmedText = text.trimEnd();
  if (trimmedText.endsWith(postfix)) {
    return trimmedText.slice(0, trimmedText.length - postfix.length).trimEnd();
  }
  return text;
}

/** Plain footer line(s) for text email, Slack fallback, webhooks. */
export function formatAttributionPlain(postfix: string): string {
  return postfix;
}

/** Subtle italic mrkdwn for Slack context blocks (pre-escaped body). */
export function formatAttributionSlackMrkdwn(escapedPostfix: string): string {
  const linked = escapedPostfix.replace(/Context\.dev/g, `<${CONTEXT_DEV_URL}|Context.dev>`);
  return `_${linked}_`;
}

/** HTML snippet for email footers (expects escapeHtml). */
export function formatAttributionHtml(
  postfix: string,
  escapeHtml: (s: string) => string,
): string {
  const link = `<a href="${CONTEXT_DEV_URL}" style="color:#a3a3a3;text-decoration:underline;">Context.dev</a>`;
  const parts = postfix.split("Context.dev");
  if (parts.length > 1) {
    return parts.map((part, i) => escapeHtml(part) + (i < parts.length - 1 ? link : "")).join("");
  }
  return escapeHtml(postfix);
}

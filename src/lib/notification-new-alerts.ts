/**
 * Shared structure for "new alerts" notifications across Slack and email.
 */

import { parseDiff } from "./diff-display";
import { APP_NAME, NEW_ALERTS_EVENT_TYPE } from "./product-info";

export type NewAlertsSite = { id: string; name: string; domain: string };

export type NewAlertsAlert = {
  id: string;
  title: string;
  /** LLM-generated plain-language summary of the change. */
  aiChangeSummary?: string;
  /** Raw diff string from diffPreview() — lines prefixed with "+ " or "- ". */
  diffPreview?: string;
  /** True total added lines (may exceed what's stored in diffPreview). */
  totalAdded?: number;
  /** True total removed lines (may exceed what's stored in diffPreview). */
  totalRemoved?: number;
};

export type NewAlertsPayload = {
  kind: "new_alerts";
  appBaseUrl: string;
  site: NewAlertsSite;
  alerts: NewAlertsAlert[];
};

/** JSON body POSTed to the user-configured alert webhook URL. */
export type NewAlertsWebhookBody = {
  type: typeof NEW_ALERTS_EVENT_TYPE;
  version: 1;
  kind: "new_alerts";
  appBaseUrl: string;
  site: NewAlertsSite;
  alerts: (NewAlertsAlert & { dashboardUrl: string })[];
  /** Same human-readable summary as the Slack fallback text / email. */
  summaryText: string;
};

// ---------------------------------------------------------------------------
// Slack Block Kit types (subset needed for outbound webhook payloads)
// ---------------------------------------------------------------------------

type SlackTextObject =
  | { type: "plain_text"; text: string; emoji?: boolean }
  | { type: "mrkdwn"; text: string };

type SlackButtonElement = {
  type: "button";
  text: { type: "plain_text"; text: string; emoji?: boolean };
  url: string;
  action_id?: string;
};

export type SlackBlock =
  | { type: "header"; text: { type: "plain_text"; text: string; emoji?: boolean } }
  | { type: "section"; text: SlackTextObject }
  | { type: "divider" }
  | { type: "actions"; elements: SlackButtonElement[] };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function trunc(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

/** Escape Slack mrkdwn HTML entities (safe inside ~…~ and _…_ spans). */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Text inside Slack `<url|label>` cannot contain `|` (breaks the link grammar). */
function escSlackLinkLabel(s: string): string {
  return esc(s).replace(/\|/g, " · ");
}

function formatSummaryForSlack(summary: string | undefined): string {
  if (!summary?.trim()) return "";
  return `_Summary: ${esc(trunc(summary.trim(), 400))}_`;
}

function formatSummaryForPlain(summary: string | undefined): string {
  if (!summary?.trim()) return "";
  return `Summary: ${trunc(summary.trim(), 400)}`;
}

/**
 * If the total number of changed lines (added + removed) is at or below this
 * threshold, show all of them inline. Otherwise show a preview + "View all" button.
 */
export const INLINE_CHANGE_LIMIT = 3;

/**
 * Parse the raw diff string into separate add/del arrays and compute the true
 * total change count.
 */
function parseDiffLines(alert: NewAlertsAlert): {
  addLines: string[];
  delLines: string[];
  totalChanges: number;
} {
  const { diffPreview } = alert;
  if (!diffPreview?.trim()) return { addLines: [], delLines: [], totalChanges: 0 };

  const lines = parseDiff(diffPreview).filter((l) => l.kind !== "ctx");
  const addLines = lines.filter((l) => l.kind === "add").map((l) => l.text);
  const delLines = lines.filter((l) => l.kind === "del").map((l) => l.text);

  const totalAdded = alert.totalAdded ?? addLines.length;
  const totalRemoved = alert.totalRemoved ?? delLines.length;
  return { addLines, delLines, totalChanges: totalAdded + totalRemoved };
}

/**
 * Build the mrkdwn diff lines for a single alert.
 * – deleted lines → `~strikethrough~`
 * – added lines   → `_italic_`
 * Returns the diff lines (already mrkdwn-formatted) and whether there are more
 * changes that didn't fit in the preview.
 */
function buildDiffMrkdwnLines(
  alert: NewAlertsAlert,
): { lines: string[]; hasMore: boolean; totalChanges: number } {
  const { addLines, delLines, totalChanges } = parseDiffLines(alert);
  if (totalChanges === 0) return { lines: [], hasMore: false, totalChanges: 0 };

  const hasMore = totalChanges > INLINE_CHANGE_LIMIT;
  const parts: string[] = [];

  if (!hasMore) {
    const k = Math.min(addLines.length, delLines.length);
    for (let i = 0; i < k; i++) {
      parts.push(`~${esc(delLines[i])}~`);
      parts.push(`_${esc(addLines[i])}_`);
    }
    for (let i = k; i < delLines.length; i++) parts.push(`~${esc(delLines[i])}~`);
    for (let i = k; i < addLines.length; i++) parts.push(`_${esc(addLines[i])}_`);
  } else {
    // Show only the first pair for the preview
    if (delLines[0]) parts.push(`~${esc(delLines[0])}~`);
    if (addLines[0]) parts.push(`_${esc(addLines[0])}_`);
  }

  return { lines: parts, hasMore, totalChanges };
}

/** Deep-link to the global Alerts screen: expands the row and reveals the diff. */
export function alertDashboardDeepLink(appBaseUrl: string, alertId: string): string {
  const u = new URL("/dashboard/alerts", appBaseUrl);
  u.searchParams.set("alert", alertId);
  u.searchParams.set("diff", "1");
  return u.toString();
}

// ---------------------------------------------------------------------------
// Public builders
// ---------------------------------------------------------------------------

export function buildNewAlertsPayload(
  appBaseUrl: string,
  site: NewAlertsSite,
  alerts: NewAlertsAlert[],
): NewAlertsPayload {
  return { kind: "new_alerts", appBaseUrl, site, alerts };
}

/**
 * Builds a Slack Block Kit payload for a "new alerts" notification.
 *
 * Structure per alert:
 *   • section: bold title + mrkdwn diff lines (~deleted~, _added_)
 *   • actions block (only when changes > INLINE_CHANGE_LIMIT): real link button
 */
export function buildNewAlertsSlackBlocks(payload: NewAlertsPayload): SlackBlock[] {
  const { appBaseUrl, site, alerts } = payload;
  const n = alerts.length;
  const openUrl =
    n > 0
      ? alertDashboardDeepLink(appBaseUrl, alerts[0].id)
      : new URL("/dashboard/alerts", appBaseUrl).toString();
  const maxAlerts = 5;

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${APP_NAME}: ${n} new change${n === 1 ? "" : "s"}`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${esc(site.name)}* (${esc(site.domain)})`,
      },
    },
  ];

  for (const a of alerts.slice(0, maxAlerts)) {
    blocks.push({ type: "divider" });

    const { lines: diffLines, hasMore, totalChanges } = buildDiffMrkdwnLines(a);
    const url = alertDashboardDeepLink(appBaseUrl, a.id);

    let sectionText = `*<${url}|${escSlackLinkLabel(trunc(a.title, 200))}>*`;
    const summaryLine = formatSummaryForSlack(a.aiChangeSummary);
    if (summaryLine) sectionText += "\n" + summaryLine;
    if (diffLines.length > 0) sectionText += "\n" + diffLines.join("\n");

    blocks.push({ type: "section", text: { type: "mrkdwn", text: sectionText } });

    if (hasMore) {
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: `View all ${totalChanges} changes`, emoji: false },
            url,
            action_id: `view_alert_${a.id}`,
          },
        ],
      });
    }
  }

  if (n > maxAlerts) {
    blocks.push({ type: "divider" });
    const extra = n - maxAlerts;
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `_… and ${extra} more change${extra === 1 ? "" : "s"}_` },
    });
  }

  blocks.push({ type: "divider" });
  blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: `<${openUrl}|Open in ${APP_NAME}>` },
  });

  return blocks;
}

/**
 * Plain-text fallback string (required alongside blocks for Slack notifications
 * and used for email).  Inline "View all" link for the >3 changes case since
 * blocks aren't available in plain text contexts.
 */
export function formatNewAlertsSlackText(payload: NewAlertsPayload): string {
  const { appBaseUrl, site, alerts } = payload;
  const n = alerts.length;
  const openUrl =
    n > 0
      ? alertDashboardDeepLink(appBaseUrl, alerts[0].id)
      : new URL("/dashboard/alerts", appBaseUrl).toString();
  const maxAlerts = 5;

  const lines = alerts
    .slice(0, maxAlerts)
    .map((a) => {
      const { lines: diffLines, hasMore, totalChanges } = buildDiffMrkdwnLines(a);
      const deep = alertDashboardDeepLink(appBaseUrl, a.id);
      let text = `• ${trunc(a.title, 200)}\n<${deep}|Open alert & diff>`;
      const summaryPlain = formatSummaryForPlain(a.aiChangeSummary);
      if (summaryPlain) text += `\n${summaryPlain}`;
      if (diffLines.length > 0) {
        const shown = diffLines.filter((l) => l.startsWith("~") || l.startsWith("_")).length;
        const suffix = hasMore ? `\n_Showing ${shown} of ${totalChanges} changes in preview — use Open above for full diff._` : "";
        text += "\n" + diffLines.join("\n") + suffix;
      }
      return text;
    })
    .join("\n\n");
  const more = n > maxAlerts ? `\n… and ${n - maxAlerts} more` : "";

  return `${APP_NAME}: ${n} new change(s) for ${site.name} (${site.domain})\n\n${lines}${more}\n\nOpen: ${openUrl}`;
}

export function buildNewAlertsWebhookBody(payload: NewAlertsPayload): NewAlertsWebhookBody {
  const { appBaseUrl, alerts } = payload;
  return {
    type: NEW_ALERTS_EVENT_TYPE,
    version: 1,
    kind: payload.kind,
    appBaseUrl,
    site: payload.site,
    alerts: alerts.map((a) => ({
      ...a,
      dashboardUrl: alertDashboardDeepLink(appBaseUrl, a.id),
    })),
    summaryText: formatNewAlertsSlackText(payload),
  };
}

export function formatNewAlertsEmailSubject(payload: NewAlertsPayload): string {
  return `${APP_NAME}: ${payload.alerts.length} new change(s) for ${payload.site.name}`;
}

/** Plain text email body with inline +/- diff preview. */
export function formatNewAlertsEmailText(payload: NewAlertsPayload): string {
  const { appBaseUrl, site, alerts } = payload;
  const n = alerts.length;
  const openUrl =
    n > 0
      ? alertDashboardDeepLink(appBaseUrl, alerts[0].id)
      : new URL("/dashboard/alerts", appBaseUrl).toString();
  const maxAlerts = 5;

  const lines = alerts
    .slice(0, maxAlerts)
    .map((a) => {
      const deeplink = alertDashboardDeepLink(appBaseUrl, a.id);
      const { addLines, delLines, totalChanges } = parseDiffLines(a);
      const summaryPlain = formatSummaryForPlain(a.aiChangeSummary);
      if (totalChanges === 0) {
        const parts = [`• ${trunc(a.title, 200)}`, `  Open in app: ${deeplink}`];
        if (summaryPlain) parts.push(`  ${summaryPlain}`);
        return parts.join("\n");
      }

      const hasMore = totalChanges > INLINE_CHANGE_LIMIT;
      const parts: string[] = [`• ${trunc(a.title, 200)}`, `  Open in app: ${deeplink}`];
      if (summaryPlain) parts.push(`  ${summaryPlain}`);

      if (!hasMore) {
        const k = Math.min(addLines.length, delLines.length);
        for (let i = 0; i < k; i++) {
          parts.push(`  - ${delLines[i]}`);
          parts.push(`  + ${addLines[i]}`);
        }
        for (let i = k; i < delLines.length; i++) parts.push(`  - ${delLines[i]}`);
        for (let i = k; i < addLines.length; i++) parts.push(`  + ${addLines[i]}`);
      } else {
        const shownCount = (delLines[0] ? 1 : 0) + (addLines[0] ? 1 : 0);
        if (delLines[0]) parts.push(`  - ${delLines[0]}`);
        if (addLines[0]) parts.push(`  + ${addLines[0]}`);
        parts.push(`  Showing ${shownCount} of ${totalChanges} line changes above — full diff in app (same link)`);
      }

      return parts.join("\n");
    })
    .join("\n\n");
  const more = n > maxAlerts ? `\n… and ${n - maxAlerts} more` : "";

  return `${APP_NAME}: ${n} new change(s) for ${site.name} (${site.domain})\n\n${lines}${more}\n\nOpen: ${openUrl}`;
}

/** Backwards-compatible helper matching the previous notify-slack signature. */
export function buildNewAlertsSlackText(
  appBaseUrl: string,
  site: NewAlertsSite,
  alertTitles: string[],
): string {
  const alerts = alertTitles.map((title, i) => ({ id: `legacy-${i}`, title }));
  return formatNewAlertsSlackText(buildNewAlertsPayload(appBaseUrl, site, alerts));
}

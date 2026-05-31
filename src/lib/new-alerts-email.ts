/**
 * HTML + plain-text email bodies for "new alerts" notifications.
 */

import {
  buildPreviewRows,
  buildTokenDiffs,
  escapeHtml,
  packSegs,
  parseDiff,
  renderTokenDiffHtml,
  type DiffLine,
  type PreviewRow,
} from "./diff-display";
import {
  alertDashboardDeepLink,
  formatNewAlertsEmailText,
  INLINE_CHANGE_LIMIT,
  targetEditDeepLink,
  trunc,
  type NewAlertsAlert,
  type NewAlertsPayload,
} from "./notification-new-alerts";
import { formatAttributionHtml, formatAttributionPlain } from "./alert-postfix";
import { APP_NAME } from "./product-info";
import { alertPostfix, stripAlertPostfix } from "./server-managed-config";

const MAX_ALERTS = 5;
const BRAND = "#ff5a1f";

const DEL_ROW_BG = "#fff1f2";
const DEL_GUTTER_BG = "#ffe4e6";
const DEL_TEXT = "#9f1239";
const DEL_HIGHLIGHT = "background:#fecdd3;color:#881337;border-radius:2px;padding:0 2px;";

const ADD_ROW_BG = "#ecfdf5";
const ADD_GUTTER_BG = "#d1fae5";
const ADD_TEXT = "#047857";
const ADD_HIGHLIGHT = "background:#a7f3d0;color:#065f46;border-radius:2px;padding:0 2px;";

const CTX_ROW_BG = "#ffffff";
const CTX_GUTTER_BG = "#f5f5f5";
const CTX_TEXT = "color:#525252;";

const SUMMARY_BG = "#fff4ee";
const SUMMARY_BORDER = "#ffc8aa";
const SUMMARY_LABEL = "#7f2511";
const SUMMARY_TEXT = "#431407";

/** Normalized AI summary text for an alert, if present. */
export function getAlertAiSummary(alert: NewAlertsAlert): string | null {
  const s = alert.aiChangeSummary?.trim();
  return s ? trunc(s, 400) : null;
}

function aiSummaryBlockHtml(summary: string): string {
  return `<div style="margin-top:12px;padding:12px 14px;background:${SUMMARY_BG};border:1px solid ${SUMMARY_BORDER};border-radius:8px;">
  <p style="margin:0 0 6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:${SUMMARY_LABEL};">AI summary</p>
  <p style="margin:0;font-size:14px;line-height:1.55;color:${SUMMARY_TEXT};white-space:pre-wrap;">${escapeHtml(summary)}</p>
</div>`;
}

function emailPreheaderHtml(alerts: NewAlertsAlert[]): string {
  const first = alerts.map(getAlertAiSummary).find(Boolean);
  if (!first) return "";
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(first)}</div>`;
}

function totalChangesForAlert(alert: NewAlertsAlert): number {
  const lines = alert.diffPreview?.trim() ? parseDiff(alert.diffPreview) : [];
  const added = alert.totalAdded ?? lines.filter((l) => l.kind === "add").length;
  const removed = alert.totalRemoved ?? lines.filter((l) => l.kind === "del").length;
  return added + removed;
}

/** When over INLINE_CHANGE_LIMIT, show only the first paired change (matches Slack). */
function previewRowsForEmail(alert: NewAlertsAlert): { rows: PreviewRow[]; hasMore: boolean; totalChanges: number } {
  const raw = alert.diffPreview?.trim() ?? "";
  if (!raw) return { rows: [], hasMore: false, totalChanges: 0 };

  const lines = parseDiff(raw);
  const allRows = buildPreviewRows(lines);
  const totalChanges = totalChangesForAlert(alert);
  const hasMore = totalChanges > INLINE_CHANGE_LIMIT;

  if (!hasMore) return { rows: allRows, hasMore: false, totalChanges };

  const firstPair = allRows.find((r): r is Extract<PreviewRow, { type: "pair" }> => r.type === "pair");
  if (firstPair) return { rows: [firstPair], hasMore: true, totalChanges };

  const firstSingle = allRows.find((r) => r.type === "single");
  return { rows: firstSingle ? [firstSingle] : [], hasMore: true, totalChanges };
}

function diffRowHtml(
  sign: string,
  rowBg: string,
  gutterBg: string,
  gutterColor: string,
  contentHtml: string,
): string {
  return `<tr>
  <td style="width:28px;padding:6px 8px;text-align:center;font-family:ui-monospace,monospace;font-size:12px;font-weight:600;background:${gutterBg};color:${gutterColor};border-right:1px solid #e5e5e5;vertical-align:top;">${escapeHtml(sign)}</td>
  <td style="padding:6px 12px;font-family:ui-monospace,monospace;font-size:12px;line-height:1.45;background:${rowBg};word-break:break-word;white-space:pre-wrap;">${contentHtml || "&#160;"}</td>
</tr>`;
}

function pairedRowsHtml(oldText: string, newText: string): string {
  const { del, add } = buildTokenDiffs(oldText, newText);
  const delHtml = renderTokenDiffHtml(packSegs(del), {
    textStyle: `color:${DEL_TEXT}`,
    highlightStyle: DEL_HIGHLIGHT,
  });
  const addHtml = renderTokenDiffHtml(packSegs(add), {
    textStyle: `color:${ADD_TEXT}`,
    highlightStyle: ADD_HIGHLIGHT,
  });
  return (
    diffRowHtml("−", DEL_ROW_BG, DEL_GUTTER_BG, DEL_TEXT, delHtml) +
    diffRowHtml("+", ADD_ROW_BG, ADD_GUTTER_BG, ADD_TEXT, addHtml)
  );
}

function singleRowHtml(line: DiffLine): string {
  const text = escapeHtml(line.text || "\u00A0");
  if (line.kind === "add") {
    return diffRowHtml("+", ADD_ROW_BG, ADD_GUTTER_BG, ADD_TEXT, `<span style="color:${ADD_TEXT}">${text}</span>`);
  }
  if (line.kind === "del") {
    return diffRowHtml("−", DEL_ROW_BG, DEL_GUTTER_BG, DEL_TEXT, `<span style="color:${DEL_TEXT}">${text}</span>`);
  }
  return diffRowHtml(" ", CTX_ROW_BG, CTX_GUTTER_BG, "#a3a3a3", `<span style="${CTX_TEXT}">${text}</span>`);
}

function diffBlockHtml(alert: NewAlertsAlert, dashboardUrl: string): string {
  const { rows, hasMore, totalChanges } = previewRowsForEmail(alert);
  if (rows.length === 0 && totalChanges === 0) return "";

  const lines = alert.diffPreview?.trim() ? parseDiff(alert.diffPreview) : [];
  const added = alert.totalAdded ?? lines.filter((l) => l.kind === "add").length;
  const removed = alert.totalRemoved ?? lines.filter((l) => l.kind === "del").length;

  const badgeParts: string[] = [];
  if (added > 0) {
    badgeParts.push(
      `<span style="display:inline-block;margin-left:6px;padding:2px 6px;font-size:11px;font-weight:600;color:#047857;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:4px;">+${added}</span>`,
    );
  }
  if (removed > 0) {
    badgeParts.push(
      `<span style="display:inline-block;margin-left:4px;padding:2px 6px;font-size:11px;font-weight:600;color:#be123c;background:#fff1f2;border:1px solid #fecdd3;border-radius:4px;">−${removed}</span>`,
    );
  }

  const bodyRows = rows
    .map((row) => (row.type === "pair" ? pairedRowsHtml(row.old, row.new) : singleRowHtml(row.line)))
    .join("");

  const viewAllBtn = hasMore
    ? `<p style="margin:12px 0 0;font-size:13px;">
  <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;padding:8px 14px;background:#f5f5f5;color:#171717;text-decoration:none;font-weight:500;border-radius:6px;border:1px solid #e5e5e5;">View all ${totalChanges} changes</a>
</p>`
    : "";

  return `<div style="margin-top:12px;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;">
  <div style="padding:8px 12px;background:#fafafa;border-bottom:1px solid #e5e5e5;font-size:12px;font-weight:600;color:#404040;">
    Diff preview${badgeParts.join("")}
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
    <tbody>${bodyRows}</tbody>
  </table>
  ${viewAllBtn}
</div>`;
}

function alertCardHtml(alert: NewAlertsAlert, appBaseUrl: string): string {
  const url = alertDashboardDeepLink(appBaseUrl, alert.id);
  const title = escapeHtml(trunc(stripAlertPostfix(alert.title), 200));
  const summary = getAlertAiSummary(alert);
  const summaryBlock = summary ? aiSummaryBlockHtml(summary) : "";
  const diffBlock = diffBlockHtml(alert, url);

  return `<div style="margin:20px 0;padding:16px;background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;">
  <h3 style="margin:0;font-size:15px;font-weight:600;line-height:1.4;">
    <a href="${escapeHtml(url)}" style="color:#171717;text-decoration:none;">${title}</a>
  </h3>
  ${summaryBlock}
  ${diffBlock}
</div>`;
}

function wrapEmailDocument(inner: string, alerts: NewAlertsAlert[]): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(APP_NAME)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  ${emailPreheaderHtml(alerts)}
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f5f5f5;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;">
          ${inner}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function formatNewAlertsEmailHtml(payload: NewAlertsPayload): string {
  const { appBaseUrl, site, alerts } = payload;
  const n = alerts.length;
  const openUrl =
    n > 0
      ? alertDashboardDeepLink(appBaseUrl, alerts[0].id)
      : new URL("/dashboard/alerts", appBaseUrl).toString();

  const alertCards = alerts
    .slice(0, MAX_ALERTS)
    .map((a) => alertCardHtml(a, appBaseUrl))
    .join("");

  const moreBlock =
    n > MAX_ALERTS
      ? `<p style="margin:0 0 16px;font-size:14px;color:#737373;text-align:center;">… and ${n - MAX_ALERTS} more change${n - MAX_ALERTS === 1 ? "" : "s"}</p>`
      : "";

  const inner = `<tr>
  <td style="background:${BRAND};padding:16px 20px;border-radius:8px 8px 0 0;">
    <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">${escapeHtml(APP_NAME)}</p>
  </td>
</tr>
<tr>
  <td style="background:#ffffff;padding:20px;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#171717;line-height:1.3;">
      ${n} new change${n === 1 ? "" : "s"}
    </h1>
    <p style="margin:0;font-size:14px;color:#525252;">
      <strong style="color:#171717;">${escapeHtml(site.name)}</strong>
      <span style="color:#a3a3a3;"> · </span>
      <span style="font-family:ui-monospace,monospace;font-size:13px;">${escapeHtml(site.domain)}</span>
    </p>
    ${alertCards}
    ${moreBlock}
    <p style="margin:24px 0 0;text-align:center;">
      <a href="${escapeHtml(openUrl)}" style="display:inline-block;padding:12px 24px;background:${BRAND};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;border-radius:8px;">Open in ${escapeHtml(APP_NAME)}</a>
    </p>
  </td>
</tr>
<tr>
  <td style="padding:16px 20px;background:#fafafa;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 8px 8px;text-align:center;">
    ${emailFooterHtml(payload)}
  </td>
</tr>`;

  return wrapEmailDocument(inner, alerts);
}

function postfixFooterHtml(): string {
  const postfix = alertPostfix();
  if (!postfix) return "";
  return `<p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:#a3a3a3;">${formatAttributionHtml(postfix, escapeHtml)}</p>`;
}

function emailFooterText(payload: NewAlertsPayload): string {
  const lines = ["You received this because a monitored page changed."];
  const first = payload.alerts[0];
  if (first?.targetId && payload.site.id) {
    lines.push(
      `Edit this target: ${targetEditDeepLink(payload.appBaseUrl, payload.site.id, first.targetId)}`,
    );
  }
  const postfix = alertPostfix();
  if (postfix) lines.push(formatAttributionPlain(postfix));
  return lines.join("\n");
}

function emailFooterHtml(payload: NewAlertsPayload): string {
  const first = payload.alerts[0];
  const editLink =
    first?.targetId && payload.site.id
      ? targetEditDeepLink(payload.appBaseUrl, payload.site.id, first.targetId)
      : null;

  const editLine = editLink
    ? `<p style="margin:8px 0 0;font-size:12px;">
  <a href="${escapeHtml(editLink)}" style="color:#525252;text-decoration:underline;">Edit this target</a>
</p>`
    : "";

  return `<p style="margin:0;font-size:12px;color:#a3a3a3;">You received this because a monitored page changed.</p>${editLine}${postfixFooterHtml()}`;
}

function payloadForEmailBody(payload: NewAlertsPayload): NewAlertsPayload {
  return {
    ...payload,
    alerts: payload.alerts.map((a) => ({ ...a, title: stripAlertPostfix(a.title) })),
  };
}

export function renderNewAlertsEmail(payload: NewAlertsPayload): { html: string; text: string } {
  const bodyPayload = payloadForEmailBody(payload);
  return {
    html: formatNewAlertsEmailHtml(payload),
    text: `${formatNewAlertsEmailText(bodyPayload)}\n\n${emailFooterText(payload)}`,
  };
}

/** Sample payload for the notification test email in Settings. */
export function buildSampleNewAlertsEmailPayload(appBaseUrl: string): NewAlertsPayload {
  return {
    kind: "new_alerts",
    appBaseUrl,
    site: { id: "sample-site", name: "Example Site", domain: "example.com" },
    alerts: [
      {
        id: "sample-alert",
        targetId: "sample-target",
        title: "Pricing page — /pricing",
        aiChangeSummary:
          "The Pro plan price increased from $29 to $39 per month, and annual billing is now highlighted as the default option.",
        diffPreview: [
          "- Pro plan — $29/month",
          "- Billed monthly by default",
          "+ Pro plan — $39/month",
          "+ Billed annually (save 20%)",
        ].join("\n"),
        totalAdded: 2,
        totalRemoved: 2,
      },
    ],
  };
}

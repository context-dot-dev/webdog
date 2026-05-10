/**
 * `website.notificationDestinationIds`: JSON string array, or null/empty = notify all current destinations.
 */

import type { Target } from "./db/schema";

export type UserDestinationRow = {
  id: string;
  channel: string;
  slackWebhookUrl: string | null;
  resendFromEmail: string | null;
  resendToEmails: string | null;
  alertWebhookUrl: string | null;
};

/** Per-target routing: only explicit destinations notify externally. */
export function resolveDestinationsForTarget(
  target: Pick<Target, "notificationDestinationId" | "externalNotify">,
  userDestinations: UserDestinationRow[],
): UserDestinationRow[] {
  if (!(target.externalNotify ?? true)) return [];
  const tid = target.notificationDestinationId?.trim();
  if (tid) {
    const one = userDestinations.find((d) => d.id === tid);
    return one ? [one] : [];
  }
  return [];
}

export function parseWebsiteNotificationDestinationIds(raw: string | null | undefined): string[] | null {
  if (raw == null || raw === "") return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return null;
    return v.filter((x): x is string => typeof x === "string" && x.length > 0);
  } catch {
    return null;
  }
}

export function stringifyWebsiteNotificationDestinationIds(ids: string[] | null): string | null {
  if (ids === null) return null;
  return JSON.stringify(ids);
}

/** `selected === null` → use all destinations; otherwise only listed ids (may be empty = none). */
export function filterDestinationsForWebsite<T extends { id: string }>(
  all: T[],
  websiteRaw: string | null | undefined,
): T[] {
  const selected = parseWebsiteNotificationDestinationIds(websiteRaw);
  if (selected === null) return all;
  const set = new Set(selected);
  return all.filter((d) => set.has(d.id));
}

/** `<select>` value for routing alerts in-app only (no Slack/email/webhook). */
export const TARGET_FORM_DASHBOARD_ONLY = "__tgt_dashboard_only";

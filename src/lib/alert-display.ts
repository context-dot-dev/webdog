/**
 * Server-only alert title / attribution helpers for dashboard UI.
 */

import { alertPostfix, stripAlertPostfix } from "./server-managed-config";

export function alertTitleForDisplay(title: string): string {
  return stripAlertPostfix(title).replace(/https?:\/\//g, "");
}

export function alertAttributionText(): string | null {
  return alertPostfix();
}

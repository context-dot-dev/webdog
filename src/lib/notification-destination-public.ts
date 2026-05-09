import type { NotificationDestination } from "./db/schema";
import { isResendSendFromEmailManagedByEnv } from "./server-managed-config";

export type PublicNotificationDestination = NotificationDestination;

export function publicNotificationDestination(
  row: NotificationDestination,
): PublicNotificationDestination {
  if (isResendSendFromEmailManagedByEnv() && row.channel === "EMAIL") {
    return { ...row, resendFromEmail: null };
  }
  return row;
}

export function publicNotificationDestinations(
  rows: NotificationDestination[],
): PublicNotificationDestination[] {
  return rows.map(publicNotificationDestination);
}

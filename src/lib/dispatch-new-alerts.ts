import {
  type NewAlertsPayload,
  buildNewAlertsSlackBlocks,
  buildNewAlertsWebhookBody,
  formatNewAlertsEmailSubject,
  formatNewAlertsEmailText,
  formatNewAlertsSlackText,
} from "./notification-new-alerts";
import { isValidAlertWebhookUrl, postAlertWebhookJson } from "./notify-outbound-webhook";
import { isValidSlackIncomingWebhookUrl, postSlackIncomingWebhook } from "./notify-slack";
import { parseResendToEmails, sendResendEmail } from "./notify-resend";
import type { NotificationChannel } from "./db/schema";
import {
  appendAlertPostfix,
  effectiveResendApiKey,
  effectiveResendSendFromEmail,
} from "./server-managed-config";

export type DestinationDispatchRow = {
  channel: NotificationChannel;
  slackWebhookUrl: string | null;
  resendFromEmail: string | null;
  resendToEmails: string | null;
  alertWebhookUrl: string | null;
};

export async function dispatchNewAlertsForDestinations(
  destinations: DestinationDispatchRow[],
  accountResendApiKey: string | null | undefined,
  payload: NewAlertsPayload,
): Promise<void> {
  for (const d of destinations) {
    if (d.channel === "SLACK") {
      const url = d.slackWebhookUrl?.trim() ?? "";
      if (url && isValidSlackIncomingWebhookUrl(url)) {
        try {
          await postSlackIncomingWebhook(
            url,
            formatNewAlertsSlackText(payload),
            buildNewAlertsSlackBlocks(payload),
          );
        } catch (err) {
          console.error("[slack] failed to notify:", err);
        }
      }
    } else if (d.channel === "EMAIL") {
      const key = effectiveResendApiKey(accountResendApiKey) ?? "";
      const from = effectiveResendSendFromEmail(d.resendFromEmail) ?? "";
      const to = parseResendToEmails(d.resendToEmails ?? null);
      if (key && from && to.length > 0) {
        try {
          await sendResendEmail({
            apiKey: key,
            from,
            to,
            subject: appendAlertPostfix(formatNewAlertsEmailSubject(payload)),
            text: formatNewAlertsEmailText(payload),
          });
        } catch (err) {
          console.error("[resend] failed to notify:", err);
        }
      }
    } else if (d.channel === "WEBHOOK") {
      const url = d.alertWebhookUrl?.trim() ?? "";
      if (url && isValidAlertWebhookUrl(url)) {
        try {
          await postAlertWebhookJson(url, buildNewAlertsWebhookBody(payload));
        } catch (err) {
          console.error("[webhook] failed to notify:", err);
        }
      }
    }
  }
}

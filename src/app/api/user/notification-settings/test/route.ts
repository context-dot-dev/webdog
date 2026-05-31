import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { badRequest, notFound, parseJson, requireApiUserWithWriteOwner } from "@/lib/api";
import {
  ALERT_WEBHOOK_TEST_BODY,
  isValidAlertWebhookUrl,
  postAlertWebhookJson,
} from "@/lib/notify-outbound-webhook";
import { isValidSlackIncomingWebhookUrl, postSlackIncomingWebhook } from "@/lib/notify-slack";
import { authPublicBaseUrl } from "@/lib/auth";
import { buildSampleNewAlertsEmailPayload, renderNewAlertsEmail } from "@/lib/new-alerts-email";
import { parseResendToEmails, sendResendEmail } from "@/lib/notify-resend";
import { APP_NAME } from "@/lib/product-info";
import { formatNewAlertsEmailSubject } from "@/lib/notification-new-alerts";
import {
  effectiveResendApiKey,
  effectiveResendSendFromEmail,
  isResendApiKeyManagedByEnv,
  isResendSendFromEmailManagedByEnv,
} from "@/lib/server-managed-config";

const bodySchema = z.object({
  destinationId: z.string().min(1),
});

const SLACK_TEST_MESSAGE = `${APP_NAME}: Slack test — if you see this, the webhook works.`;
const EMAIL_TEST_TEXT =
  `This is a test message from ${APP_NAME}.\n\nIf you received this, your Resend integration is working.`;

export async function POST(req: Request) {
  const { user, ownerId, response } = await requireApiUserWithWriteOwner();
  if (!user || !ownerId) return response!;

  const parsed = await parseJson(req, bodySchema);
  if (parsed.response) return parsed.response;

  const [dest] = await db
    .select()
    .from(schema.notificationDestination)
    .where(
      and(
        eq(schema.notificationDestination.id, parsed.data.destinationId),
        eq(schema.notificationDestination.userId, ownerId),
      ),
    )
    .limit(1);
  if (!dest) return notFound("Destination not found");

  const [settings] = await db
    .select({ resendApiKey: schema.userNotificationSettings.resendApiKey })
    .from(schema.userNotificationSettings)
    .where(eq(schema.userNotificationSettings.userId, ownerId))
    .limit(1);

  if (dest.channel === "SLACK") {
    const url = dest.slackWebhookUrl?.trim() ?? "";
    if (!url || !isValidSlackIncomingWebhookUrl(url)) {
      return badRequest("Save a valid Slack webhook URL for this destination first");
    }
    try {
      await postSlackIncomingWebhook(url, SLACK_TEST_MESSAGE);
    } catch {
      return NextResponse.json({ error: "Slack webhook delivery failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  }

  if (dest.channel === "WEBHOOK") {
    const url = dest.alertWebhookUrl?.trim() ?? "";
    if (!url || !isValidAlertWebhookUrl(url)) {
      return badRequest("Save a valid webhook URL for this destination first");
    }
    try {
      await postAlertWebhookJson(url, ALERT_WEBHOOK_TEST_BODY);
    } catch {
      return NextResponse.json({ error: "Webhook delivery failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  }

  const key = effectiveResendApiKey(settings?.resendApiKey) ?? "";
  const from = effectiveResendSendFromEmail(dest.resendFromEmail) ?? "";
  const to = parseResendToEmails(dest.resendToEmails);
  if (!key || !from || to.length === 0) {
    const managedDelivery = isResendApiKeyManagedByEnv() && isResendSendFromEmailManagedByEnv();
    return badRequest(
      managedDelivery
        ? "Save at least one recipient on this email destination"
        : "Set your Resend API key in Email settings and save from/recipients on this destination",
    );
  }

  try {
    const samplePayload = buildSampleNewAlertsEmailPayload(authPublicBaseUrl);
    const { html, text } = renderNewAlertsEmail(samplePayload);
    await sendResendEmail({
      apiKey: key,
      from,
      to,
      subject: `${formatNewAlertsEmailSubject(samplePayload)} (test)`,
      text: `${EMAIL_TEST_TEXT}\n\n---\n\n${text}`,
      html,
    });
  } catch {
    return NextResponse.json({ error: "Email delivery failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

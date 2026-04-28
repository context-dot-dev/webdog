import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getApiUser, badRequest, notFound, parseJson } from "@/lib/api";
import {
  ALERT_WEBHOOK_TEST_BODY,
  isValidAlertWebhookUrl,
  postAlertWebhookJson,
} from "@/lib/notify-outbound-webhook";
import { isValidSlackIncomingWebhookUrl, postSlackIncomingWebhook } from "@/lib/notify-slack";
import { parseResendToEmails, sendResendEmail } from "@/lib/notify-resend";

const bodySchema = z.object({
  destinationId: z.string().min(1),
});

const SLACK_TEST_MESSAGE = "Web Watchdog: Slack test — if you see this, the webhook works.";
const EMAIL_TEST_SUBJECT = "Web Watchdog email test";
const EMAIL_TEST_TEXT =
  "This is a test message from Web Watchdog.\n\nIf you received this, your Resend integration is working.";

export async function POST(req: Request) {
  const { user, response } = await getApiUser();
  if (!user) return response;

  const parsed = await parseJson(req, bodySchema);
  if (parsed.response) return parsed.response;

  const [dest] = await db
    .select()
    .from(schema.notificationDestination)
    .where(
      and(
        eq(schema.notificationDestination.id, parsed.data.destinationId),
        eq(schema.notificationDestination.userId, user.id),
      ),
    )
    .limit(1);
  if (!dest) return notFound("Destination not found");

  const [settings] = await db
    .select({ resendApiKey: schema.userNotificationSettings.resendApiKey })
    .from(schema.userNotificationSettings)
    .where(eq(schema.userNotificationSettings.userId, user.id))
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

  const key = settings?.resendApiKey?.trim() ?? "";
  const from = dest.resendFromEmail?.trim() ?? "";
  const to = parseResendToEmails(dest.resendToEmails);
  if (!key || !from || to.length === 0) {
    return badRequest("Set your Resend API key in Email settings and save from/recipients on this destination");
  }

  try {
    await sendResendEmail({
      apiKey: key,
      from,
      to,
      subject: EMAIL_TEST_SUBJECT,
      text: EMAIL_TEST_TEXT,
    });
  } catch {
    return NextResponse.json({ error: "Email delivery failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

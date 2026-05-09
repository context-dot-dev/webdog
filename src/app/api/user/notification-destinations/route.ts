import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { badRequest, getApiUser, parseJson, requireApiUserWithWriteOwner } from "@/lib/api";
import { accountOwnerColumnAccessible } from "@/lib/account-access";
import { newId } from "@/lib/ids";
import { isValidAlertWebhookUrl } from "@/lib/notify-outbound-webhook";
import { normalizeResendToEmailsForStorage } from "@/lib/notify-resend";
import { isValidSlackIncomingWebhookUrl } from "@/lib/notify-slack";
import { isResendSendFromEmailManagedByEnv } from "@/lib/server-managed-config";
import {
  publicNotificationDestination,
  publicNotificationDestinations,
} from "@/lib/notification-destination-public";

const createSchema = z.discriminatedUnion("channel", [
  z.object({
    channel: z.literal("SLACK"),
    name: z.string().min(1).max(120),
    slackWebhookUrl: z.string(),
  }),
  z.object({
    channel: z.literal("EMAIL"),
    name: z.string().min(1).max(120),
    resendFromEmail: z.string().optional(),
    resendToEmails: z.string(),
  }),
  z.object({
    channel: z.literal("WEBHOOK"),
    name: z.string().min(1).max(120),
    alertWebhookUrl: z.string(),
  }),
]);

export async function GET() {
  const { user, response } = await getApiUser();
  if (!user) return response;

  const rows = await db
    .select()
    .from(schema.notificationDestination)
    .where(accountOwnerColumnAccessible(schema.notificationDestination.userId, user.id))
    .orderBy(desc(schema.notificationDestination.createdAt));

  return NextResponse.json({ destinations: publicNotificationDestinations(rows) });
}

export async function POST(req: Request) {
  const { user, ownerId, response } = await requireApiUserWithWriteOwner();
  if (!user || !ownerId) return response!;

  const parsed = await parseJson(req, createSchema);
  if (parsed.response) return parsed.response;

  const now = new Date();
  const id = newId("ndst");
  const name = parsed.data.name.trim();

  if (parsed.data.channel === "SLACK") {
    const url = parsed.data.slackWebhookUrl.trim();
    if (!isValidSlackIncomingWebhookUrl(url)) {
      return badRequest("slackWebhookUrl must be a valid https://hooks.slack.com/services/… URL");
    }
    await db.insert(schema.notificationDestination).values({
      id,
      userId: ownerId,
      channel: "SLACK",
      name,
      slackWebhookUrl: url,
      resendFromEmail: null,
      resendToEmails: null,
      alertWebhookUrl: null,
      createdAt: now,
      updatedAt: now,
    });
  } else if (parsed.data.channel === "EMAIL") {
    let from: string | null = null;
    if (isResendSendFromEmailManagedByEnv()) {
      if (parsed.data.resendFromEmail !== undefined) {
        return badRequest("Resend sender is managed by this deployment");
      }
    } else {
      from = parsed.data.resendFromEmail?.trim() ?? "";
      if (!from || !z.string().email().safeParse(from).success) {
        return badRequest("resendFromEmail must be a valid email address");
      }
    }
    const toNorm = normalizeResendToEmailsForStorage(parsed.data.resendToEmails);
    if (!toNorm.ok) return badRequest(toNorm.error);
    if (!toNorm.value) {
      return badRequest("Add at least one recipient email");
    }
    await db.insert(schema.notificationDestination).values({
      id,
      userId: ownerId,
      channel: "EMAIL",
      name,
      slackWebhookUrl: null,
      resendFromEmail: from,
      resendToEmails: toNorm.value,
      alertWebhookUrl: null,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    const url = parsed.data.alertWebhookUrl.trim();
    if (!isValidAlertWebhookUrl(url)) {
      return badRequest("alertWebhookUrl must be a valid http(s) URL");
    }
    await db.insert(schema.notificationDestination).values({
      id,
      userId: ownerId,
      channel: "WEBHOOK",
      name,
      slackWebhookUrl: null,
      resendFromEmail: null,
      resendToEmails: null,
      alertWebhookUrl: url,
      createdAt: now,
      updatedAt: now,
    });
  }

  const [row] = await db
    .select()
    .from(schema.notificationDestination)
    .where(eq(schema.notificationDestination.id, id))
    .limit(1);

  return NextResponse.json(
    { destination: row ? publicNotificationDestination(row) : row },
    { status: 201 },
  );
}

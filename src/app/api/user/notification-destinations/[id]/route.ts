import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { badRequest, notFound, parseJson, requireApiUserWithWriteOwner } from "@/lib/api";
import { isValidAlertWebhookUrl } from "@/lib/notify-outbound-webhook";
import { normalizeResendToEmailsForStorage } from "@/lib/notify-resend";
import { isValidSlackIncomingWebhookUrl } from "@/lib/notify-slack";
import { isResendSendFromEmailManagedByEnv } from "@/lib/server-managed-config";
import { publicNotificationDestination } from "@/lib/notification-destination-public";
import {
  parseWebsiteNotificationDestinationIds,
  stringifyWebsiteNotificationDestinationIds,
} from "@/lib/website-notification-destinations";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  slackWebhookUrl: z.union([z.string(), z.null()]).optional(),
  resendFromEmail: z.union([z.string(), z.null()]).optional(),
  resendToEmails: z.union([z.string(), z.null()]).optional(),
  alertWebhookUrl: z.union([z.string(), z.null()]).optional(),
});

async function pruneDeletedDestination(ownerUserId: string, destinationId: string) {
  const sites = await db
    .select({
      id: schema.website.id,
      notificationDestinationIds: schema.website.notificationDestinationIds,
    })
    .from(schema.website)
    .where(eq(schema.website.userId, ownerUserId));
  for (const s of sites) {
    const cur = parseWebsiteNotificationDestinationIds(s.notificationDestinationIds);
    if (cur === null) continue;
    const next = cur.filter((x) => x !== destinationId);
    if (next.length === cur.length) continue;
    await db
      .update(schema.website)
      .set({
        notificationDestinationIds:
          next.length === 0 ? "[]" : stringifyWebsiteNotificationDestinationIds(next),
      })
      .where(eq(schema.website.id, s.id));
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, ownerId, response } = await requireApiUserWithWriteOwner();
  if (!user || !ownerId) return response!;
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(schema.notificationDestination)
    .where(
      and(eq(schema.notificationDestination.id, id), eq(schema.notificationDestination.userId, ownerId)),
    )
    .limit(1);
  if (!existing) return notFound("Destination not found");

  const parsed = await parseJson(req, patchSchema);
  if (parsed.response) return parsed.response;
  const body = parsed.data;
  if (Object.keys(body).length === 0) {
    return badRequest("No fields to update");
  }

  let name = existing.name;
  let slackWebhookUrl = existing.slackWebhookUrl;
  let resendFromEmail = existing.resendFromEmail;
  let resendToEmails = existing.resendToEmails;
  let alertWebhookUrl = existing.alertWebhookUrl;

  if (body.name !== undefined) {
    name = body.name.trim();
  }

  if (existing.channel === "SLACK") {
    if (body.resendFromEmail !== undefined || body.resendToEmails !== undefined || body.alertWebhookUrl !== undefined) {
      return badRequest("Only name and slackWebhookUrl allowed for Slack destinations");
    }
    if (body.slackWebhookUrl !== undefined) {
      if (body.slackWebhookUrl === null) {
        slackWebhookUrl = null;
      } else {
        const u = body.slackWebhookUrl.trim();
        if (!isValidSlackIncomingWebhookUrl(u)) {
          return badRequest("slackWebhookUrl must be a valid https://hooks.slack.com/services/… URL");
        }
        slackWebhookUrl = u;
      }
    }
  } else if (existing.channel === "EMAIL") {
    if (body.slackWebhookUrl !== undefined || body.alertWebhookUrl !== undefined) {
      return badRequest("Only name, resendFromEmail, and resendToEmails allowed for email destinations");
    }
    if (isResendSendFromEmailManagedByEnv()) {
      if (body.resendFromEmail !== undefined) {
        return badRequest("Resend sender is managed by this deployment");
      }
    } else if (body.resendFromEmail !== undefined) {
      if (body.resendFromEmail === null) {
        resendFromEmail = null;
      } else {
        const f = body.resendFromEmail.trim();
        if (!z.string().email().safeParse(f).success) {
          return badRequest("resendFromEmail must be a valid email address");
        }
        resendFromEmail = f;
      }
    }
    if (body.resendToEmails !== undefined) {
      if (body.resendToEmails === null) {
        resendToEmails = null;
      } else {
        const norm = normalizeResendToEmailsForStorage(body.resendToEmails);
        if (!norm.ok) return badRequest(norm.error);
        resendToEmails = norm.value;
      }
    }
  } else {
    if (body.slackWebhookUrl !== undefined || body.resendFromEmail !== undefined || body.resendToEmails !== undefined) {
      return badRequest("Only name and alertWebhookUrl allowed for webhook destinations");
    }
    if (body.alertWebhookUrl !== undefined) {
      if (body.alertWebhookUrl === null) {
        alertWebhookUrl = null;
      } else {
        const u = body.alertWebhookUrl.trim();
        if (!isValidAlertWebhookUrl(u)) {
          return badRequest("alertWebhookUrl must be a valid http(s) URL");
        }
        alertWebhookUrl = u;
      }
    }
  }

  const now = new Date();
  await db
    .update(schema.notificationDestination)
    .set({
      name,
      slackWebhookUrl,
      resendFromEmail,
      resendToEmails,
      alertWebhookUrl,
      updatedAt: now,
    })
    .where(eq(schema.notificationDestination.id, id));

  const [row] = await db
    .select()
    .from(schema.notificationDestination)
    .where(eq(schema.notificationDestination.id, id))
    .limit(1);

  return NextResponse.json({ destination: row ? publicNotificationDestination(row) : row });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, ownerId, response } = await requireApiUserWithWriteOwner();
  if (!user || !ownerId) return response!;
  const { id } = await params;

  const result = await db
    .delete(schema.notificationDestination)
    .where(
      and(eq(schema.notificationDestination.id, id), eq(schema.notificationDestination.userId, ownerId)),
    )
    .returning({ id: schema.notificationDestination.id });
  if (result.length === 0) return notFound("Destination not found");

  await pruneDeletedDestination(ownerId, id);

  return NextResponse.json({ ok: true });
}

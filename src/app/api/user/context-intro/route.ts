import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getApiUser, badRequest, parseJson } from "@/lib/api";
import { ContextDevError, resolveAccountBrandLogoUrl } from "@/lib/context-client";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { isContextDevApiKeyManagedByEnv } from "@/lib/server-managed-config";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("defer") }),
  z.object({
    action: z.literal("complete"),
    apiKey: z.string().optional(),
  }),
]);

function ctxErrorResponse(err: ContextDevError) {
  const status =
    err.status === 401 || err.status === 403
      ? err.status
      : err.status >= 400 && err.status < 500
        ? 400
        : 502;
  const fallback =
    err.status === 401 ? "Invalid or missing Context.dev API key." : err.message;
  return NextResponse.json({ error: fallback }, { status });
}

export async function POST(req: Request) {
  const { user: sessionUser, response: unauthorized } = await getApiUser();
  if (!sessionUser) return unauthorized;
  if (!sessionUser.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseJson(req, bodySchema);
  if (parsed.response) return parsed.response;

  const now = new Date();

  if (parsed.data.action === "defer") {
    await db
      .update(schema.user)
      .set({
        contextIntroDismissedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.user.id, sessionUser.id));

    return NextResponse.json({ ok: true });
  }

  if (isContextDevApiKeyManagedByEnv()) {
    await db
      .update(schema.user)
      .set({
        contextIntroDismissedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.user.id, sessionUser.id));

    return NextResponse.json({ ok: true });
  }

  const trimmedKey = parsed.data.apiKey?.trim() ?? "";
  if (!trimmedKey) {
    return badRequest("Enter your Context.dev API key");
  }

  try {
    const accountBrandLogoUrl = await resolveAccountBrandLogoUrl(sessionUser.email, trimmedKey);

    await db.transaction(async (tx) => {
      await tx
        .insert(schema.userNotificationSettings)
        .values({
          userId: sessionUser.id,
          contextDevApiKey: trimmedKey,
          accountBrandLogoUrl,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.userNotificationSettings.userId,
          set: {
            contextDevApiKey: trimmedKey,
            accountBrandLogoUrl,
            updatedAt: now,
          },
        });

      await tx
        .update(schema.user)
        .set({
          contextIntroDismissedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.user.id, sessionUser.id));
    });

    return NextResponse.json({
      ok: true,
      accountBrandLogoUrl,
    });
  } catch (e) {
    if (e instanceof ContextDevError) {
      return ctxErrorResponse(e);
    }
    throw e;
  }
}

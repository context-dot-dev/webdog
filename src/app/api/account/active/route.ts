import { NextResponse } from "next/server";
import { z } from "zod";
import { userCanAccessAccountOwner } from "@/lib/account-access";
import { getApiUser, badRequest, parseJson } from "@/lib/api";
import { WD_ACCOUNT_COOKIE, WD_ACCOUNT_COOKIE_MAX_AGE } from "@/lib/effective-account";

const bodySchema = z.object({
  ownerUserId: z.string().min(1).nullable(),
});

export async function POST(req: Request) {
  const { user, response } = await getApiUser();
  if (!user) return response;

  const parsed = await parseJson(req, bodySchema);
  if (parsed.response) return parsed.response;

  const res = NextResponse.json({ ok: true });

  if (parsed.data.ownerUserId === null) {
    res.cookies.set(WD_ACCOUNT_COOKIE, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
    });
    return res;
  }

  const ownerId = parsed.data.ownerUserId;
  const allowed = await userCanAccessAccountOwner(user.id, ownerId);
  if (!allowed) {
    return badRequest("You do not have access to that account.");
  }

  res.cookies.set(WD_ACCOUNT_COOKIE, ownerId, {
    path: "/",
    maxAge: WD_ACCOUNT_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
  });
  return res;
}

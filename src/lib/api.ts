import { NextResponse } from "next/server";
import { z } from "zod";
import { getEffectiveAccountOwnerForWrites } from "./effective-account";
import { getCurrentSession } from "./session";

export async function getApiUser() {
  const session = await getCurrentSession();
  if (!session?.user) {
    return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user: session.user, response: null };
}

/**
 * User + account owner id for mutations (notification settings, websites keyed by owner).
 * Fails with 400 when several shared accounts need an explicit choice (set `wd_account` cookie).
 */
export async function requireApiUserWithWriteOwner() {
  const auth = await getApiUser();
  if (!auth.user) return { ...auth, ownerId: null as string | null };

  const scope = await getEffectiveAccountOwnerForWrites(auth.user.id);
  if (!scope.ok) {
    return {
      user: auth.user,
      ownerId: null,
      response: NextResponse.json(
        { error: scope.message, needsAccountSelection: true },
        { status: 400 },
      ),
    };
  }
  return { user: auth.user, ownerId: scope.ownerId, response: null };
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export async function parseJson<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<
  { data: z.infer<T>; response: null } | { data: null; response: NextResponse }
> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { data: null, response: badRequest("Invalid JSON body") };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { data: null, response: badRequest("Validation failed", parsed.error.flatten()) };
  }
  return { data: parsed.data, response: null };
}

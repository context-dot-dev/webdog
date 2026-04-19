import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "./session";

export async function getApiUser() {
  const session = await getCurrentSession();
  if (!session?.user) {
    return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user: session.user, response: null };
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

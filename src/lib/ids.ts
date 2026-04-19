import { randomBytes } from "node:crypto";

/** Short, URL-safe, lexicographically-ish sortable ID. */
export function newId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rand = randomBytes(6).toString("base64url");
  return `${prefix}_${ts}${rand}`;
}

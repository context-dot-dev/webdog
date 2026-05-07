/**
 * Client-safe constants (imported from client components). Keep this file free of
 * server-only imports (`next/headers`, `db`, etc.) so the client bundle stays valid.
 *
 * Time-to-live for account invite links (used by API and Team settings copy).
 */
export const INVITE_EXPIRY_MS = 10 * 24 * 60 * 60 * 1000;

/** Max distinct people who can accept the same invite link (e.g. shared in Slack). */
export const INVITE_MAX_USES = 5;

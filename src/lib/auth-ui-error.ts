const URL_MISMATCH_CODES = new Set([
  "INVALID_ORIGIN",
  "INVALID_CALLBACK_URL",
  "INVALID_REDIRECT_URL",
  "INVALID_ERROR_CALLBACK_URL",
  "INVALID_NEW_USER_CALLBACK_URL",
  "MISSING_OR_NULL_ORIGIN",
]);

/** Hint shown when Better Auth rejects the request Host / Origin vs configured base URL. */
const README_APP_URL_NOTE =
  ' See the README: "Deploy on Railway" → "Public URL / Better Auth" to configure the app URL.';

function readAuthClientError(authError?: unknown): { message?: string; code?: string } | null {
  if (
    authError &&
    typeof authError === "object" &&
    ("message" in authError || "code" in authError)
  ) {
    const o = authError as { message?: unknown; code?: unknown };
    const code = typeof o.code === "string" ? o.code : undefined;
    const message = typeof o.message === "string" ? o.message : undefined;
    return { message, code };
  }
  return null;
}

/**
 * Append a brief README pointer for errors that usually mean BETTER_AUTH_URL / public domain / NEXT_PUBLIC_APP_URL mismatch.
 */
export function formatCredentialAuthUiError(fallbackMessage: string, authError?: unknown): string {
  const err = readAuthClientError(authError);
  const message = err?.message?.trim() || fallbackMessage;
  const code = err?.code;
  const low = message.toLowerCase();

  const urlLikelyMismatch =
    (code && URL_MISMATCH_CODES.has(code)) ||
    low.includes("invalid origin") ||
    low.includes("missing or null origin") ||
    low.includes("invalid callbackurl") ||
    low.includes("invalid redirecturl");

  return urlLikelyMismatch ? `${message}${README_APP_URL_NOTE}` : message;
}

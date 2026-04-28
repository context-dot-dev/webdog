import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./db/schema";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

/**
 * `http://localhost` and `http://127.0.0.1` are different origins. The browser
 * sends whichever you used in the address bar; Better Auth only trusts `baseURL`'s
 * origin by default, so sign-up/sign-in from the other host would fail with INVALID_ORIGIN.
 */
function loopbackOriginAlt(urlStr: string): string | null {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const port = u.port || (u.protocol === "https:" ? "443" : "80");
    if (u.hostname === "localhost") return `${u.protocol}//127.0.0.1:${port}`;
    if (u.hostname === "127.0.0.1") return `${u.protocol}//localhost:${port}`;
    return null;
  } catch {
    return null;
  }
}

const extraTrusted = loopbackOriginAlt(baseURL);

/**
 * Better Auth requires a non-default `secret`. Use a dev-only value when running
 * locally or for `next build` without a configured env; require an explicit
 * secret in production on common host platforms.
 */
function resolveAuthSecret(): string {
  const fromEnv = process.env.BETTER_AUTH_SECRET?.trim();
  if (fromEnv) return fromEnv;

  const isHostedProd =
    process.env.NODE_ENV === "production" &&
    Boolean(process.env.VERCEL ?? process.env.CF_PAGES ?? process.env.NETLIFY);

  if (isHostedProd) {
    throw new Error(
      "BETTER_AUTH_SECRET must be set in production. Generate one with: openssl rand -base64 32"
    );
  }

  return "dev-only-unsafe-betterauth-secret-not-for-production-use";
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  secret: resolveAuthSecret(),
  baseURL,
  trustedOrigins: extraTrusted ? [extraTrusted] : [],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh idle sessions once a day
  },
});

export type Auth = typeof auth;

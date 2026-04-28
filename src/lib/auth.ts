import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./db/schema";

const RAILWAY_AUTH_SECRET_FILE = "/data/.better-auth-secret";

/**
 * Public URL for Better Auth callbacks. On Railway, defaults to https://$RAILWAY_PUBLIC_DOMAIN
 * when `BETTER_AUTH_URL` is unset (after you enable public networking / generate a domain).
 */
function resolveAuthBaseURL(): string {
  const explicit = process.env.BETTER_AUTH_URL?.trim();
  if (explicit) return explicit;
  const domain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (domain) return `https://${domain}`;
  return "http://localhost:3000";
}

const baseURL = resolveAuthBaseURL();

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

/** Stable random secret for `next build` only; never used at runtime. */
const NEXT_BUILD_AUTH_PLACEHOLDER =
  "next-build-placeholder-not-used-at-runtime-min-32-chars!!";

function isLikelyNextProductionBuild(): boolean {
  if (process.env.npm_lifecycle_event === "build") return true;
  const argvTail = process.argv.slice(1).join(" ");
  return /\bnext\s+build\b/.test(argvTail);
}

function railwayPersistedAuthSecret(): string {
  try {
    fs.mkdirSync("/data", { recursive: true });
    if (fs.existsSync(RAILWAY_AUTH_SECRET_FILE)) {
      const existing = fs.readFileSync(RAILWAY_AUTH_SECRET_FILE, "utf8").trim();
      if (existing.length >= 16) return existing;
    }
    const secret = randomBytes(32).toString("base64");
    fs.writeFileSync(RAILWAY_AUTH_SECRET_FILE, secret, { mode: 0o600 });
    return secret;
  } catch (e) {
    const hint = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Could not read or write ${RAILWAY_AUTH_SECRET_FILE}. Attach a Railway volume at /data (see README). ${hint}`,
    );
  }
}

/**
 * Better Auth requires a non-default `secret`. On Railway, if `BETTER_AUTH_SECRET` is unset,
 * a secret is created once on the persistent volume so one-click deploy only needs e.g. `CONTEXT_DEV_API_KEY`.
 * Vercel / Netlify / Cloudflare still require an explicit `BETTER_AUTH_SECRET`.
 */
function resolveAuthSecret(): string {
  const fromEnv = process.env.BETTER_AUTH_SECRET?.trim();
  if (fromEnv) return fromEnv;

  if (isLikelyNextProductionBuild()) {
    return NEXT_BUILD_AUTH_PLACEHOLDER;
  }

  if (process.env.RAILWAY_PROJECT_ID) {
    return railwayPersistedAuthSecret();
  }

  const isHostedProd =
    process.env.NODE_ENV === "production" &&
    Boolean(process.env.VERCEL ?? process.env.CF_PAGES ?? process.env.NETLIFY);

  if (isHostedProd) {
    throw new Error(
      "BETTER_AUTH_SECRET must be set in production. Generate one with: openssl rand -base64 32",
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

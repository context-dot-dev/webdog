import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./db/schema";

/** Trim slashes; keep a single usable origin-style base for Better Auth. */
function normalizeAuthBase(urlStr: string): string {
  const t = urlStr.trim().replace(/\/+$/, "");
  return t.length > 0 ? t : urlStr.trim();
}

/** True during `next build` — avoid Railway-only prod checks that need a runtime public URL. */
function isLikelyNextProductionBuild(): boolean {
  if (process.env.npm_lifecycle_event === "build") return true;
  const argvTail = process.argv.slice(1).join(" ");
  return /\bnext\s+build\b/.test(argvTail);
}

/**
 * Static canonical base URL (fallback when `BETTER_AUTH_ALLOWED_HOSTS` is unused).
 * Order on Railway (and locally):
 * 1. `BETTER_AUTH_URL` if set (overrides Railway; do not use the localhost placeholder on prod).
 * 2. `https://$RAILWAY_PUBLIC_DOMAIN` — Railway system env (enable public networking / generate a domain).
 * 3. `NEXT_PUBLIC_APP_URL` origin when `RAILWAY_PROJECT_ID` is set (if `RAILWAY_PUBLIC_DOMAIN` is empty or wrong).
 * 4. Local dev: `http://localhost:3000`.
 * `RAILWAY_PRIVATE_DOMAIN` is internal-only; never use it as the public auth URL.
 */
function resolveStaticAuthBaseURL(): string {
  const explicit = process.env.BETTER_AUTH_URL?.trim();
  if (explicit && explicit !== "http://localhost:3000")
    return normalizeAuthBase(explicit);

  let domain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (domain) {
    domain = domain.replace(/^https?:\/\//i, "").replace(/\/+$/, "").split("/")[0] ?? domain;
    if (domain.length > 0) return normalizeAuthBase(`https://${domain}`);
  }

  const onRailway = Boolean(process.env.RAILWAY_PROJECT_ID);
  const nextPublic = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (onRailway && nextPublic) {
    try {
      const u = new URL(nextPublic);
      if (u.protocol === "http:" || u.protocol === "https:")
        return normalizeAuthBase(u.origin);
    } catch {
      /* ignore */
    }
  }

  if (
    explicit === "http://localhost:3000" &&
    !(process.env.RAILWAY_PUBLIC_DOMAIN?.trim() || (onRailway && nextPublic))
  ) {
    return normalizeAuthBase(explicit);
  }

  return "http://localhost:3000";
}

/**
 * Better Auth `baseURL`: either a fixed string or dynamic host allowlist (wildcard patterns),
 * for multiple hostnames or URLs that change (e.g. `*.up.railway.app` + custom domain).
 *
 * Set `BETTER_AUTH_ALLOWED_HOSTS` to comma-separated host patterns (no scheme), e.g.
 * `*.up.railway.app,myapp.com,www.myapp.com`. The incoming `Host` / `x-forwarded-host` must match.
 * You still need a non-localhost **fallback** URL on hosted prod (`BETTER_AUTH_URL`, domain env, or `NEXT_PUBLIC_APP_URL`)
 * for contexts without a request (build, some server calls).
 */
function resolveAuthBaseURL():
  | string
  | { allowedHosts: string[]; fallback: string; protocol: "auto" } {
  const raw = process.env.BETTER_AUTH_ALLOWED_HOSTS?.trim();
  if (raw) {
    const allowedHosts = raw
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);
    if (allowedHosts.length > 0) {
      return {
        allowedHosts,
        fallback: normalizeAuthBase(resolveStaticAuthBaseURL()),
        protocol: "auto",
      };
    }
  }
  return resolveStaticAuthBaseURL();
}

const baseURL = resolveAuthBaseURL();

const isDynamicAuthBase =
  typeof baseURL === "object" &&
  baseURL !== null &&
  "allowedHosts" in baseURL &&
  Array.isArray(baseURL.allowedHosts);

const authFallbackOrigin =
  typeof baseURL === "string" ? baseURL : baseURL.fallback;

const isRailwayRuntimeProd =
  Boolean(process.env.RAILWAY_PROJECT_ID) &&
  process.env.NODE_ENV === "production" &&
  !isLikelyNextProductionBuild();
const fallbackIsLocalhost =
  authFallbackOrigin.startsWith("http://localhost") ||
  authFallbackOrigin.startsWith("http://127.0.0.1");
if (isRailwayRuntimeProd && fallbackIsLocalhost) {
  const suffix = isDynamicAuthBase
    ? " When using BETTER_AUTH_ALLOWED_HOSTS, Better Auth still needs BETTER_AUTH_URL (or NEXT_PUBLIC_APP_URL / RAILWAY_PUBLIC_DOMAIN) as a canonical https fallback."
    : " Set BETTER_AUTH_URL=https://YOUR_PUBLIC_HOST (exact URL users open), or NEXT_PUBLIC_APP_URL when RAILWAY_PUBLIC_DOMAIN is empty. For www vs apex, use BETTER_AUTH_ALLOWED_HOSTS or BETTER_AUTH_TRUSTED_ORIGINS.";
  throw new Error(
    "Better Auth has no public base URL on Railway (fallback is still localhost)." + suffix,
  );
}

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

const extraTrusted = loopbackOriginAlt(authFallbackOrigin);

/** Stable random secret for `next build` only; never used at runtime. */
const NEXT_BUILD_AUTH_PLACEHOLDER =
  "next-build-placeholder-not-used-at-runtime-min-32-chars!!";

/**
 * Better Auth requires a non-default `secret`. Hosted production deploys
 * require an explicit `BETTER_AUTH_SECRET`; local development keeps a dev-only fallback.
 */
function resolveAuthSecret(): string {
  const fromEnv = process.env.BETTER_AUTH_SECRET?.trim();
  if (fromEnv) return fromEnv;

  if (isLikelyNextProductionBuild()) {
    return NEXT_BUILD_AUTH_PLACEHOLDER;
  }

  const isHostedProd =
    process.env.NODE_ENV === "production" &&
    Boolean(process.env.RAILWAY_PROJECT_ID ?? process.env.VERCEL ?? process.env.CF_PAGES ?? process.env.NETLIFY);

  if (isHostedProd) {
    throw new Error(
      "BETTER_AUTH_SECRET must be set in production. Generate one with: openssl rand -base64 32",
    );
  }

  return "dev-only-unsafe-betterauth-secret-not-for-production-use";
}

/** Optional footgun: relax Better Auth URL / origin middleware. Default off. */
function resolveAuthAdvanced():
  | { advanced: { disableOriginCheck?: boolean; disableCSRFCheck?: boolean } }
  | undefined {
  const offOrigin = process.env.BETTER_AUTH_DISABLE_ORIGIN_CHECK?.trim() === "true";
  const offCsrf = process.env.BETTER_AUTH_DISABLE_CSRF_CHECK?.trim() === "true";
  if (!offOrigin && !offCsrf) return undefined;

  const advanced: { disableOriginCheck?: boolean; disableCSRFCheck?: boolean } = {};
  if (offOrigin) advanced.disableOriginCheck = true;
  if (offCsrf) advanced.disableCSRFCheck = true;
  else if (offOrigin)
    // Without this, Better Auth treats "origin check off" as legacy combined with CSRF off.
    advanced.disableCSRFCheck = false;

  return { advanced };
}

/** Same origin resolution as Better Auth non-request fallback (dashboard links in emails/alerts). */
export const authPublicBaseUrl = authFallbackOrigin;

export const auth = betterAuth({
  ...resolveAuthAdvanced(),
  database: drizzleAdapter(db, {
    provider: "pg",
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

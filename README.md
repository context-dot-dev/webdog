# Web Watchdog

Open-source website change monitoring: scrape pages, diff over time, and get notified when something moves, disappears, or edits.

## Requirements

- **Node.js** 20+ (recommended; matches Next.js 15)
- **npm** (or your preferred package manager)

## Setup

1. **Clone and install dependencies**

   ```bash
   git clone <your-repo-url>
   cd website-watchdog
   npm install
   ```

2. **Environment variables**

   Copy the example file and edit it:

   ```bash
   cp .env.example .env
   ```

   At minimum for local development, set **`BETTER_AUTH_SECRET`** to a long random string (for example: `openssl rand -base64 32`). Other keys in `.env.example` are documented there; `DATABASE_URL` defaults to a SQLite file under `./data/` if unset.

3. **Create the database schema**

   The app uses **SQLite** with [Drizzle](https://orm.drizzle.team/). Apply the schema (creates auth tables, websites, targets, and so on):

   ```bash
   npm run db:push
   ```

   Without this step, the API will error with `no such table: user` (or similar) and sign-in / sign-up will not work.

4. **Run the app**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) and create an account. If you use `http://127.0.0.1:3000` instead of `localhost`, ensure `BETTER_AUTH_URL` matches how you open the app, or add extra origins via `BETTER_AUTH_TRUSTED_ORIGINS` in `.env` (see [Better Auth](https://www.better-auth.com/docs) and `.env.example`).

## Other scripts

| Command            | Description                                      |
| ------------------ | ------------------------------------------------ |
| `npm run build`    | Production build                                 |
| `npm run start`    | Start production server (after `build`)         |
| `npm run worker`   | Long-running worker that runs scrapes on a schedule |
| `npm run worker:once` | Run the worker once and exit                 |
| `npm run db:generate` | Generate SQL migration files from the schema  |
| `npm run db:migrate`  | Run migrations (when you use generated files)  |

## Production notes

- On **Railway**, omit **`BETTER_AUTH_URL`** to use **`https://${RAILWAY_PUBLIC_DOMAIN}`** when public networking is enabled; override with **`BETTER_AUTH_URL`** or **`NEXT_PUBLIC_APP_URL`** if needed (see **Deploy on Railway**). Elsewhere set **`BETTER_AUTH_URL`** to your public `https://…` URL. Keep **`BETTER_AUTH_SECRET`** private.
- Use `npm run build` then `npm run start` for the Next.js app, and run the **worker** separately (e.g. as another process or service) if you need scheduled checks.

### Better Auth `disableOriginCheck` (avoid if you can)

Better Auth’s **`advanced.disableOriginCheck`** (here: opt in with **`BETTER_AUTH_DISABLE_ORIGIN_CHECK=true`**) does **not** only skip “compare `callbackURL` to `trustedOrigins`.” In this library’s middleware it also **short-circuits `Origin` / `Referer` validation** for many state-changing requests, which is part of the **CSRF** story for cookie-backed sessions.

**Risks if you enable it on an instance reachable from the web:**

- **Open redirects** — If any auth flow accepts `callbackURL`, `redirectTo`, or similar from the client (or from a URL the client can influence), an attacker can send victims through your domain and **land on a malicious site** after sign-in, or abuse redirects for phishing.
- **CSRF-class abuse** — With origin checks relaxed, **other websites** can more easily cause a victim’s browser to send **authenticated requests** to your app (session riding), depending on endpoint behavior and what the browser sends.

Prefer fixing **`BETTER_AUTH_URL`**, **`BETTER_AUTH_ALLOWED_HOSTS`**, or **`BETTER_AUTH_TRUSTED_ORIGINS`** instead. A second env **`BETTER_AUTH_DISABLE_CSRF_CHECK=true`** turns off even more protections; do not use on public deployments.


## Deploy on Railway (self-hosted, SQLite)

The repo includes [`railway.json`](railway.json) so one **Railway service** runs both the Next.js app and the scrape **worker** in the same container. They share a single SQLite file on a **persistent volume** (ephemeral disk would reset the database on every deploy).

### Public URL / Better Auth (Railway defaults vs configuration)

Railway injects system variables such as **`RAILWAY_PUBLIC_DOMAIN`** (the **public** hostname, e.g. `your-service.up.railway.app` or your custom domain) and **`RAILWAY_PRIVATE_DOMAIN`** (internal DNS like `*.railway.internal` — **not** a browser URL; do not use it for auth). See [Railway variables](https://docs.railway.com/reference/variables).

This app **defaults to Railway’s public domain first**, then falls back when needed:

1. **`BETTER_AUTH_URL`** — if you set it explicitly, it **wins** (use a full `https://…` URL). Omit it to use Railway’s domain automatically.
2. **`https://${RAILWAY_PUBLIC_DOMAIN}`** — used when **`BETTER_AUTH_URL`** is unset and Railway has populated **`RAILWAY_PUBLIC_DOMAIN`** (requires **public networking** and a generated or custom domain).
3. **`NEXT_PUBLIC_APP_URL`** — used on Railway only when step 2 is unavailable (e.g. empty domain after first deploy) or you want the client bundle and server to agree on a single explicit public URL. Set it to the same `https://…` origin users open.

You still **configure** the deployment so one of these resolves to a real HTTPS origin: turn on public networking, or set **`BETTER_AUTH_URL`** / **`NEXT_PUBLIC_APP_URL`**. The app does not guess a public URL without Railway’s public domain or your variables.

### One-click template (operators)

**You only need to provide a [context.dev](https://context.dev) API key.** Everything else has Railway-aware defaults:

- **`CONTEXT_DEV_API_KEY`** — required for scrapes (same as local dev).
- **`DATABASE_URL`** — optional; defaults to `/data/web-watchdog.db` on Railway when unset.
- **`BETTER_AUTH_URL`** — optional; if unset, the app uses **`https://${RAILWAY_PUBLIC_DOMAIN}`** when Railway provides it (see **Public URL / Better Auth** above). Set explicitly for an override or when the system domain variable is unreliable.
- **`NEXT_PUBLIC_APP_URL`** — optional Railway fallback (`https://…`) after **`RAILWAY_PUBLIC_DOMAIN`**; useful when the system variable is empty or must match Next’s public bundle.
- **`BETTER_AUTH_ALLOWED_HOSTS`** — optional; comma-separated **host patterns** (wildcards allowed, e.g. `*.up.railway.app`) so sign-in works from **multiple or changing** public URLs without redeploying each time.
- **`BETTER_AUTH_SECRET`** — optional on Railway; if unset, a secret is written once to `/data/.better-auth-secret` on the volume (persists across deploys). You can still set this variable explicitly or use `${{secret(...)}}` in a [published template](https://docs.railway.com/guides/create).
- **`SCRAPE_CRON`**, **`BETTER_AUTH_TRUSTED_ORIGINS`** — optional.

Steps:

1. Create a Railway project from this repo (or deploy a template based on it).
2. Attach a **volume** at **`/data`** on the service.
3. Turn on **public networking** and generate a Railway domain (or configure a custom domain).
4. Set **`CONTEXT_DEV_API_KEY`** (and optional overrides above), then deploy.

Start runs `npm run db:migrate` (SQLite needs the mounted `/data` volume in the main app container), then the worker in the background and `next start` in the foreground. Health checks use `GET /api/health`.

**“Invalid origin” on sign-up / sign-in** usually means **`BETTER_AUTH_URL` / Railway’s public domain / `NEXT_PUBLIC_APP_URL`** are out of sync with the address bar. Prefer fixing public networking so **`RAILWAY_PUBLIC_DOMAIN`** is set; then **`NEXT_PUBLIC_APP_URL`** or **`BETTER_AUTH_URL`** if it stays blank. Or use **`BETTER_AUTH_ALLOWED_HOSTS`** for several hostnames (comma-separated patterns, no scheme), e.g. **`*.up.railway.app,myapp.com,www.myapp.com`**. For one-off extra origins, **`BETTER_AUTH_TRUSTED_ORIGINS`**. Do **not** leave **`BETTER_AUTH_URL=http://localhost:3000`** on a public Railway site.

### Manual / non-template deploy

| Variable | Example / notes |
|----------|-----------------|
| `DATABASE_URL` | `/data/web-watchdog.db` if not using the default above |
| `BETTER_AUTH_SECRET` | Optional on Railway (volume file); required on Vercel / Netlify / Cloudflare |
| *(Railway system)* | **`RAILWAY_PUBLIC_DOMAIN`** — used automatically as `https://…` when **`BETTER_AUTH_URL`** is unset |
| `NEXT_PUBLIC_APP_URL` | Optional; `https://…` fallback on Railway when the system public domain is missing / you want an explicit public URL in the client |
| `BETTER_AUTH_URL` | Optional override; also the **fallback** when using **`BETTER_AUTH_ALLOWED_HOSTS`** |
| `BETTER_AUTH_ALLOWED_HOSTS` | Optional; e.g. `*.up.railway.app,my.com` — per-request host allowlist (see README above) |
| `CONTEXT_DEV_API_KEY` | Bearer token for context.dev |

If `better-sqlite3` fails to compile on the builder, add a Dockerfile with build tools and set Railway’s builder to Dockerfile (see [Railway builds](https://docs.railway.com/builds)).

### Publishing your own Railway template

In the [template composer](https://docs.railway.com/guides/create): add this repo as the service source, attach a volume at `/data`, enable HTTP public networking, and add a single **required** variable `CONTEXT_DEV_API_KEY` for deployers. Optional: add `BETTER_AUTH_SECRET=${{secret(43, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/")}}=` (see [template variable functions](https://docs.railway.com/guides/create#template-variable-functions)) instead of relying on the auto-generated volume secret. Copy the **template URL** Railway gives you into your README or site for true one-click deploys.

## Contributing

Contributions are welcome. Please open an issue or pull request with a short description of the change.

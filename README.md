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

- Set **`BETTER_AUTH_URL`** to your public site URL and keep **`BETTER_AUTH_SECRET`** private.
- Use `npm run build` then `npm run start` for the Next.js app, and run the **worker** separately (e.g. as another process or service) if you need scheduled checks.

## Deploy on Railway (self-hosted, SQLite)

The repo includes [`railway.json`](railway.json) so one **Railway service** runs both the Next.js app and the scrape **worker** in the same container. They share a single SQLite file on a **persistent volume** (ephemeral disk would reset the database on every deploy).

### One-click template (operators)

**You only need to provide a [context.dev](https://context.dev) API key.** Everything else has Railway-aware defaults:

- **`CONTEXT_DEV_API_KEY`** — required for scrapes (same as local dev).
- **`DATABASE_URL`** — optional; defaults to `/data/web-watchdog.db` on Railway when unset.
- **`BETTER_AUTH_URL`** — optional; defaults to `https://$RAILWAY_PUBLIC_DOMAIN` when unset. Enable **public networking** and **generate a domain** (or set this to your custom domain).
- **`BETTER_AUTH_SECRET`** — optional on Railway; if unset, a secret is written once to `/data/.better-auth-secret` on the volume (persists across deploys). You can still set this variable explicitly or use `${{secret(...)}}` in a [published template](https://docs.railway.com/guides/create).
- **`SCRAPE_CRON`**, **`BETTER_AUTH_TRUSTED_ORIGINS`** — optional.

Steps:

1. Create a Railway project from this repo (or deploy a template based on it).
2. Attach a **volume** at **`/data`** on the service.
3. Turn on **public networking** and generate a Railway domain (or configure a custom domain).
4. Set **`CONTEXT_DEV_API_KEY`** (and optional overrides above), then deploy.

Pre-deploy runs `npm run db:migrate`; start runs the worker in the background and `next start` in the foreground. Health checks use `GET /api/health`.

### Manual / non-template deploy

| Variable | Example / notes |
|----------|-----------------|
| `DATABASE_URL` | `/data/web-watchdog.db` if not using the default above |
| `BETTER_AUTH_SECRET` | Optional on Railway (volume file); required on Vercel / Netlify / Cloudflare |
| `BETTER_AUTH_URL` | Your public `https://…` URL if not using `RAILWAY_PUBLIC_DOMAIN` |
| `CONTEXT_DEV_API_KEY` | Bearer token for context.dev |

If `better-sqlite3` fails to compile on the builder, add a Dockerfile with build tools and set Railway’s builder to Dockerfile (see [Railway builds](https://docs.railway.com/builds)).

### Publishing your own Railway template

In the [template composer](https://docs.railway.com/guides/create): add this repo as the service source, attach a volume at `/data`, enable HTTP public networking, and add a single **required** variable `CONTEXT_DEV_API_KEY` for deployers. Optional: add `BETTER_AUTH_SECRET=${{secret(43, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/")}}=` (see [template variable functions](https://docs.railway.com/guides/create#template-variable-functions)) instead of relying on the auto-generated volume secret. Copy the **template URL** Railway gives you into your README or site for true one-click deploys.

## Contributing

Contributions are welcome. Please open an issue or pull request with a short description of the change.

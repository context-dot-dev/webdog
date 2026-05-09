# Railway template — publisher checklist

Use this when converting the repo into a published template in the [template composer](https://docs.railway.com/templates/create). It mirrors [Template best practices](https://docs.railway.com/templates/best-practices).

## Icons (template + service)

- Upload **`railway/icon.svg`** (or export it as PNG) for both the **template** and **webdog.ai** service.
- Prefer **1:1** aspect ratio; this asset is square **24×24** viewBox (scale up as needed).

## Naming

- **Template name:** **webdog.ai** (matches product naming).
- **Service name:** **webdog.ai** (single service).

## Private networking

- This stack is **one service** with SQLite on a **volume**; there is no separate database service. Use **public HTTP** for the app only.
- Do **not** point Better Auth or browser-facing URLs at **`RAILWAY_PRIVATE_DOMAIN`** — it is internal-only. See README **Deploy on Railway**.

## Persistent storage

- Attach a volume mounted at **`/data`** (matches [`railway.json`](../railway.json) **`requiredMountPath`**).
- SQLite file defaults to **`/data/webdog-ai.db`** when **`DATABASE_URL`** is unset on Railway.

## Health checks

- **Healthcheck path:** **`/api/health`**
- **Timeout:** **`300`** seconds (adjust if your builds are slower).
- Endpoint verifies the SQLite database is reachable (readiness-style check).

## Authentication

- Optional **`BETTER_AUTH_SECRET`**: prefer generating one with a template variable function instead of hardcoding — example value:

  `${{secret(43, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/")}}=`

  If unset on Railway with **`/data`** mounted, the app persists a secret under **`/data/.better-auth-secret`** on first boot.

## Environment variables (composer)

Set descriptions in the Railway UI exactly as below so deployers know what to enter.

| Name | Required | Description |
|------|----------|-------------|
| **`CONTEXT_DEV_API_KEY`** | Yes | Bearer API key from [context.dev](https://context.dev). Required for scraping and extraction. |
| **`RESEND_API_KEY`** | No | Server-managed Resend API key for email notifications. When set with **`RESEND_SEND_FROM_EMAIL`**, users configure recipients only. |
| **`RESEND_SEND_FROM_EMAIL`** | No | Server-managed sender address for email notifications. When set, the sender is not editable in the dashboard. |
| **`MAX_ALERTS`** | No | Maximum number of active monitors per account. Omit for unlimited monitors. |
| **`POSTFIX_TO_ALERTS`** | No | Optional text appended to new alert titles and outbound email subjects. |
| **`DATABASE_URL`** | No | SQLite file path. On Railway with the **`/data`** volume, omit this to use **`/data/webdog-ai.db`**, or set e.g. **`/data/webdog-ai.db`** explicitly. |
| **`BETTER_AUTH_SECRET`** | No | Secret for Better Auth cookie/session crypto. Omit on Railway with **`/data`** to auto-generate into the volume, or set **`${{secret(...)}}`** as above. |
| **`BETTER_AUTH_URL`** | No | Full public **`https://…`** origin for auth callbacks. Omit so the app uses Railway’s public hostname (**`RAILWAY_PUBLIC_DOMAIN`**) automatically when public networking sets it. |
| **`NEXT_PUBLIC_APP_URL`** | No | Same origin as **`https://…`** for the Next.js client bundle when **`RAILWAY_PUBLIC_DOMAIN`** is missing or must be overridden. |
| **`BETTER_AUTH_ALLOWED_HOSTS`** | No | Comma-separated host patterns (wildcards ok, e.g. **`*.up.railway.app`**) when users may hit multiple public hostnames. |
| **`BETTER_AUTH_TRUSTED_ORIGINS`** | No | Extra allowed origins for Better Auth (comma-separated full origins). |
| **`SCRAPE_CRON`** | No | Cron expression for the in-container worker (default **`*/15 * * * *`**). |

No reference variables are required between services (single-service template).

## Workspace naming

- Use your **own** workspace name unless you are officially affiliated with a brand you’re naming — see Railway’s workspace guidance in [best practices](https://docs.railway.com/templates/best-practices).

## Marketplace overview (paste into template overview)

```markdown
# Deploy and Host webdog.ai with Railway

webdog.ai is open-source website change monitoring: scrape pages, compare versions over time, and get alerts when content moves, disappears, or edits. Deploy it as a single service with SQLite on a persistent volume.

## About Hosting webdog.ai

You deploy one Railway service from this repository. The platform builds the Next.js app, runs database migrations against SQLite on a mounted volume at **`/data`**, starts a background worker for scheduled scrapes, and serves the UI over HTTPS. You supply a context.dev API key for scraping; Better Auth defaults to Railway’s public domain when **`BETTER_AUTH_URL`** is left unset.

## Common Use Cases

- Monitor pricing, availability, or copy on storefronts and dashboards.
- Detect unauthorized or accidental content changes on marketing sites.
- Track competitor pages or documentation when you need diff history.
- Self-host alerts without handing URLs to a third-party SaaS.

## Dependencies for webdog.ai Hosting

- **Node.js** app (Next.js 15) built via **`npm run build`**
- **SQLite** database file on a Railway **volume** at **`/data`**
- **context.dev** API access (**`CONTEXT_DEV_API_KEY`**)
- **Better Auth** for accounts (secret optional on Railway when volume-backed)

### Deployment Dependencies

- Source repository URL you attach to the template service (your **`https://github.com/…/webdog-ai`** fork or canonical repo)
- [context.dev](https://context.dev)
- [Railway volumes](https://docs.railway.com/guides/volumes)
- [Railway health checks](https://docs.railway.com/guides/healthchecks)
- [Template best practices](https://docs.railway.com/templates/best-practices)

### Why Deploy webdog.ai on Railway?

Railway hosts your infrastructure so you avoid manual server setup while keeping data on a persistent volume and scaling the service when needed. Run this app alongside databases, workers, and other services on one platform with minimal operational overhead.
```

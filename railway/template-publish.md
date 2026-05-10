# Railway template — publisher checklist

Use this when converting the repo into a published template in the [template composer](https://docs.railway.com/templates/create). It mirrors [Template best practices](https://docs.railway.com/templates/best-practices).

## Icons (template + service)

- Upload **`railway/icon.svg`** (or export it as PNG) for both the **template** and **webdog.ai** service.
- Prefer **1:1** aspect ratio; this asset is square **24×24** viewBox (scale up as needed).

## Naming

- **Template name:** **webdog.ai** (matches product naming).
- **Service name:** **webdog.ai** (single service).

## Private networking

- This stack is one app service plus a **PostgreSQL** service. Use **public HTTP** for the app only; keep database traffic internal/private when Railway wiring allows it.
- Do **not** point Better Auth or browser-facing URLs at **`RAILWAY_PRIVATE_DOMAIN`** — it is internal-only. See README **Deploy on Railway**.

## Database

- Add a Railway **PostgreSQL** service.
- Wire the app service **`DATABASE_URL`** to the PostgreSQL connection string.

## Health checks

- **Healthcheck path:** **`/api/health`**
- **Timeout:** **`300`** seconds (adjust if your builds are slower).
- Endpoint verifies PostgreSQL is reachable (readiness-style check).

## Authentication

- Required **`BETTER_AUTH_SECRET`**: prefer generating one with a template variable function instead of hardcoding — example value:

  `${{secret(43, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/")}}=`

## Environment variables (composer)

Set descriptions in the Railway UI exactly as below so deployers know what to enter.

| Name | Required | Description |
|------|----------|-------------|
| **`CONTEXT_DEV_API_KEY`** | Yes | Bearer API key from [context.dev](https://context.dev). Required for scraping and extraction. |
| **`RESEND_API_KEY`** | No | Server-managed Resend API key for email notifications. When set with **`RESEND_SEND_FROM_EMAIL`**, users configure recipients only. |
| **`RESEND_SEND_FROM_EMAIL`** | No | Server-managed sender address for email notifications. When set, the sender is not editable in the dashboard. |
| **`MAX_ALERTS`** | No | Maximum number of active monitors per account. Omit for unlimited monitors. |
| **`POSTFIX_TO_ALERTS`** | No | Optional text appended to new alert titles and outbound email subjects. |
| **`DATABASE_URL`** | Yes | PostgreSQL connection string. Wire this from the Railway PostgreSQL service. |
| **`BETTER_AUTH_SECRET`** | Yes | Secret for Better Auth cookie/session crypto. Set **`${{secret(...)}}`** as above. |
| **`BETTER_AUTH_URL`** | No | Full public **`https://…`** origin for auth callbacks. Omit so the app uses Railway’s public hostname (**`RAILWAY_PUBLIC_DOMAIN`**) automatically when public networking sets it. |
| **`NEXT_PUBLIC_APP_URL`** | No | Same origin as **`https://…`** for the Next.js client bundle when **`RAILWAY_PUBLIC_DOMAIN`** is missing or must be overridden. |
| **`BETTER_AUTH_ALLOWED_HOSTS`** | No | Comma-separated host patterns (wildcards ok, e.g. **`*.up.railway.app`**) when users may hit multiple public hostnames. |
| **`BETTER_AUTH_TRUSTED_ORIGINS`** | No | Extra allowed origins for Better Auth (comma-separated full origins). |
| **`SCRAPE_CRON`** | No | Cron expression for the in-container worker (default **`*/15 * * * *`**). |

Reference **`DATABASE_URL`** from the PostgreSQL service into the app service.

## Workspace naming

- Use your **own** workspace name unless you are officially affiliated with a brand you’re naming — see Railway’s workspace guidance in [best practices](https://docs.railway.com/templates/best-practices).

## Marketplace overview (paste into template overview)

```markdown
# Deploy and Host webdog.ai with Railway

webdog.ai is open-source website change monitoring: scrape pages, compare versions over time, and get alerts when content moves, disappears, or edits. Deploy it as a Next.js app backed by PostgreSQL.

## About Hosting webdog.ai

You deploy one Railway app service from this repository and one PostgreSQL service for storage. The platform builds the Next.js app, runs database migrations against PostgreSQL, starts a background worker for scheduled scrapes, and serves the UI over HTTPS. You supply a context.dev API key for scraping; Better Auth defaults to Railway’s public domain when **`BETTER_AUTH_URL`** is left unset.

## Common Use Cases

- Monitor pricing, availability, or copy on storefronts and dashboards.
- Detect unauthorized or accidental content changes on marketing sites.
- Track competitor pages or documentation when you need diff history.
- Self-host alerts without handing URLs to a third-party SaaS.

## Dependencies for webdog.ai Hosting

- **Node.js** app (Next.js 15) built via **`npm run build`**
- **PostgreSQL** database service exposed to the app as **`DATABASE_URL`**
- **context.dev** API access (**`CONTEXT_DEV_API_KEY`**)
- **Better Auth** for accounts (**`BETTER_AUTH_SECRET`**)

### Deployment Dependencies

- Source repository URL you attach to the template service (your **`https://github.com/…/webdog-ai`** fork or canonical repo)
- Railway PostgreSQL service
- [context.dev](https://context.dev)
- [Railway health checks](https://docs.railway.com/guides/healthchecks)
- [Template best practices](https://docs.railway.com/templates/best-practices)

### Why Deploy webdog.ai on Railway?

Railway hosts your infrastructure so you avoid manual server setup while keeping data in managed PostgreSQL and scaling the service when needed. Run this app alongside databases, workers, and other services on one platform with minimal operational overhead.
```

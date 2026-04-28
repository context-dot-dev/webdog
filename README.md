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

## Contributing

Contributions are welcome. Please open an issue or pull request with a short description of the change.

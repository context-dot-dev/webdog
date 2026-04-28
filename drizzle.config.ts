import type { Config } from "drizzle-kit";

function databaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.RAILWAY_PROJECT_ID) return "/data/web-watchdog.db";
  return "./data/web-watchdog.db";
}

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: databaseUrl(),
  },
} satisfies Config;

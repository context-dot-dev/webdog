#!/usr/bin/env tsx

import "dotenv/config";

import { Pool } from "pg";
import { resolveDatabaseUrl } from "../src/lib/db/database-url";

function redactedDatabaseLabel(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  const user = parsed.username ? `${parsed.username}@` : "";
  return `${parsed.protocol}//${user}${parsed.host}${parsed.pathname}`;
}

function assertResetAllowed(databaseUrl: string) {
  if (process.env.ALLOW_DATABASE_RESET?.trim() === "true") return;

  const hostname = new URL(databaseUrl).hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return;

  throw new Error(
    "Refusing to reset a non-local PostgreSQL database. Set ALLOW_DATABASE_RESET=true to override.",
  );
}

async function main() {
  const databaseUrl = resolveDatabaseUrl();
  assertResetAllowed(databaseUrl);

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
    await pool.query("CREATE SCHEMA public");
    console.log(`Reset PostgreSQL schema for ${redactedDatabaseLabel(databaseUrl)}.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

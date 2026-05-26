#!/usr/bin/env tsx

import "dotenv/config";

import { Pool } from "pg";
import { resolveDatabaseUrl } from "../src/lib/db/database-url";

const EXPECTED_TABLES = [
  "account",
  "accountInvite",
  "accountMembership",
  "alert",
  "notificationDestination",
  "session",
  "snapshot",
  "target",
  "user",
  "userNotificationSettings",
  "verification",
  "website",
] as const;

function redactedDatabaseLabel(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  const user = parsed.username ? `${parsed.username}@` : "";
  return `${parsed.protocol}//${user}${parsed.host}${parsed.pathname}`;
}

async function main() {
  const databaseUrl = resolveDatabaseUrl();
  const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });

  try {
    const connected = await pool.query<{
      current_database: string;
      current_user: string;
      server_version: string;
    }>("select current_database(), current_user, current_setting('server_version') as server_version");

    const tables = await pool.query<{ table_name: string }>(
      `
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name = any($1::text[])
      `,
      [EXPECTED_TABLES],
    );

    const present = new Set(tables.rows.map((row) => row.table_name));
    const missing = EXPECTED_TABLES.filter((tableName) => !present.has(tableName));

    if (missing.length > 0) {
      throw new Error(
        `Database is reachable but schema is incomplete. Missing tables: ${missing.join(", ")}. Run npm run db:push.`,
      );
    }

    const row = connected.rows[0];
    console.log(`Connected to ${redactedDatabaseLabel(databaseUrl)}`);
    console.log(
      `Database ${row.current_database} as ${row.current_user}; PostgreSQL ${row.server_version}; ${EXPECTED_TABLES.length} expected tables present.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

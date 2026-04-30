import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";

function resolveDatabaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.RAILWAY_PROJECT_ID) return "/data/web-watchdog.db";
  return "./data/web-watchdog.db";
}

type Connection = {
  sqlite: Database.Database;
  db: BetterSQLite3Database<typeof schema>;
};

let connection: Connection | null = null;

function getConnection(): Connection {
  if (connection) return connection;

  const dbUrl = resolveDatabaseUrl();
  const dbPath = path.isAbsolute(dbUrl) ? dbUrl : path.join(process.cwd(), dbUrl);

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  connection = { sqlite, db: drizzle(sqlite, { schema }) };
  return connection;
}

export const db = new Proxy({} as BetterSQLite3Database<typeof schema>, {
  get(_target, prop) {
    return (getConnection().db as Record<string | symbol, unknown>)[prop];
  },
});

export { schema };

export const rawSqlite = new Proxy({} as Database.Database, {
  get(_target, prop) {
    return (getConnection().sqlite as Record<string | symbol, unknown>)[prop];
  },
});

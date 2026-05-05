import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import {
  ensureSQLiteParentDir,
  resolveDatabaseUrl,
  sqliteFilePath,
} from "./database-path";
import * as schema from "./schema";

type Connection = {
  sqlite: Database.Database;
  db: BetterSQLite3Database<typeof schema>;
};

let connection: Connection | null = null;

function getConnection(): Connection {
  if (connection) return connection;

  const dbUrl = resolveDatabaseUrl();
  ensureSQLiteParentDir(dbUrl);
  const dbPath = sqliteFilePath(dbUrl);
  console.log(`[db] opening database at: ${dbPath}`);

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  connection = { sqlite, db: drizzle(sqlite, { schema }) };
  return connection;
}

export const db = new Proxy({} as BetterSQLite3Database<typeof schema>, {
  get(_target, prop) {
    return (getConnection().db as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export { schema };

export const rawSqlite = new Proxy({} as Database.Database, {
  get(_target, prop) {
    return (getConnection().sqlite as unknown as Record<string | symbol, unknown>)[prop];
  },
});

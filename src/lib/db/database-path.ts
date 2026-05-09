import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_DATABASE_PATH, RAILWAY_DATABASE_PATH } from "../product-info";

export function resolveDatabaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.RAILWAY_PROJECT_ID) return RAILWAY_DATABASE_PATH;
  return DEFAULT_DATABASE_PATH;
}

/** Filesystem path to the SQLite file (handles `file:` URLs). */
export function sqliteFilePath(databaseUrl: string): string {
  if (databaseUrl.startsWith("file:")) return fileURLToPath(databaseUrl);
  return path.isAbsolute(databaseUrl)
    ? databaseUrl
    : path.join(process.cwd(), databaseUrl);
}

/** SQLite does not create parent dirs; mirror runtime app behavior before migrate. */
export function ensureSQLiteParentDir(databaseUrl: string): void {
  const dbPath = sqliteFilePath(databaseUrl);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

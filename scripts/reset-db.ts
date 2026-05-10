#!/usr/bin/env tsx

import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import { resolveDatabaseUrl, sqliteFilePath } from "../src/lib/db/database-path";

function displayPath(filePath: string): string {
  const relative = path.relative(process.cwd(), filePath);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return relative;
  }
  return filePath;
}

const databaseUrl = resolveDatabaseUrl();
const dbPath = path.resolve(sqliteFilePath(databaseUrl));

if (dbPath === path.parse(dbPath).root) {
  throw new Error("Refusing to reset the filesystem root as a database path.");
}

if (fs.existsSync(dbPath) && fs.statSync(dbPath).isDirectory()) {
  throw new Error(`Refusing to reset directory database path: ${displayPath(dbPath)}`);
}

const files = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`];
const removed: string[] = [];

for (const file of files) {
  if (fs.existsSync(file)) {
    removed.push(displayPath(file));
  }
  fs.rmSync(file, { force: true });
}

console.log(`Reset SQLite database target: ${displayPath(dbPath)}`);
if (removed.length) {
  console.log(`Removed ${removed.length} file(s): ${removed.join(", ")}`);
} else {
  console.log("No existing SQLite files found for that target.");
}

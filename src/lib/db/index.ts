import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { resolveDatabaseUrl } from "./database-url";
import * as schema from "./schema";

type Db = NodePgDatabase<typeof schema>;

type Connection = {
  db: Db;
};

declare global {
  var webdogPgConnection: Connection | undefined;
}

function getConnection(): Connection {
  if (globalThis.webdogPgConnection) return globalThis.webdogPgConnection;

  const databaseUrl = resolveDatabaseUrl();
  const db = drizzle(databaseUrl, { schema });

  globalThis.webdogPgConnection = { db };
  return globalThis.webdogPgConnection;
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    return (getConnection().db as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export { schema };

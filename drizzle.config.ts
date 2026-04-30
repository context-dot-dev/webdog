import type { Config } from "drizzle-kit";
import {
  ensureSQLiteParentDir,
  resolveDatabaseUrl,
} from "./src/lib/db/database-path";

const url = resolveDatabaseUrl();
ensureSQLiteParentDir(url);

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url,
  },
} satisfies Config;

import "dotenv/config";

import type { Config } from "drizzle-kit";
import { resolveDatabaseUrl } from "./src/lib/db/database-url";

const url = resolveDatabaseUrl();

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
} satisfies Config;

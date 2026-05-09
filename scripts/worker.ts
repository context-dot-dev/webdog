#!/usr/bin/env tsx
// Standalone worker process. Runs the scrape+diff pipeline for every website
// on a cron schedule. Start alongside `next dev` in a second terminal:
//   npm run worker            # long-running
//   npm run worker:once       # single pass, then exit
// Env: SCRAPE_CRON (default every 15 min), CONTEXT_DEV_API_KEY, RESEND_API_KEY,
// RESEND_SEND_FROM_EMAIL, POSTFIX_TO_ALERTS, MAX_ALERTS, DATABASE_URL.

import "dotenv/config";
import cron from "node-cron";
import { runAllChecks } from "../src/lib/scraper";

async function runOnce() {
  const start = Date.now();
  console.log(`[worker] tick ${new Date().toISOString()}`);
  try {
    const result = await runAllChecks();
    console.log(
      `[worker] done in ${Date.now() - start}ms — ${result.websites} site(s), ${result.alerts} alert(s), ${result.errors} error(s)`,
    );
  } catch (err) {
    console.error("[worker] run failed:", err);
  }
}

async function main() {
  const once = process.argv.includes("--once");
  if (once) {
    await runOnce();
    process.exit(0);
  }

  const expr = process.env.SCRAPE_CRON ?? "*/15 * * * *";
  if (!cron.validate(expr)) {
    console.error(`[worker] invalid SCRAPE_CRON: ${expr}`);
    process.exit(1);
  }

  console.log(`[worker] scheduling on "${expr}" (press Ctrl+C to stop)`);
  cron.schedule(expr, () => {
    void runOnce();
  });

  // Run once immediately so the first tick isn't a long wait.
  await runOnce();
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});

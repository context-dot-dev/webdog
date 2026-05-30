import { listAiModelsForProvider } from "../src/lib/ai-model-catalog";

const key = process.argv[2];

async function main() {
  const t0 = Date.now();
  const result = await listAiModelsForProvider(
    "vercel_gateway",
    key ?? null,
  );
  console.log({
    ms: Date.now() - t0,
    source: result.source,
    count: result.models.length,
    error: result.error,
    sample: result.models.slice(0, 3),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

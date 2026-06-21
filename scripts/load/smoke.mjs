/**
 * Minimal load smoke test for HomeThread backend.
 *
 * Usage:
 *   node scripts/load/smoke.mjs
 *   API_BASE_URL=https://your-backend.example/api/v1 node scripts/load/smoke.mjs
 */

const baseUrl = (process.env.API_BASE_URL ?? "http://localhost:3001/api/v1").replace(/\/$/, "");
const iterations = Number(process.env.LOAD_ITERATIONS ?? 20);

async function hitHealth() {
  const started = Date.now();
  const response = await fetch(`${baseUrl}/health`);
  const body = await response.json();
  return {
    ok: response.ok,
    status: response.status,
    durationMs: Date.now() - started,
    body
  };
}

async function main() {
  const results = [];

  for (let index = 0; index < iterations; index += 1) {
    results.push(await hitHealth());
  }

  const failures = results.filter((result) => !result.ok);
  const durations = results.map((result) => result.durationMs);
  const p95 = durations.sort((left, right) => left - right)[Math.max(0, Math.floor(durations.length * 0.95) - 1)] ?? 0;

  console.log(
    JSON.stringify(
      {
        baseUrl,
        iterations,
        failures: failures.length,
        p95Ms: p95,
        sample: results[0]?.body ?? null
      },
      null,
      2
    )
  );

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

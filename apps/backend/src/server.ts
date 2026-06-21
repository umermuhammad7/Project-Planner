import { buildApp } from "./app.js";
import { env } from "./env.js";
import { initBackendSentry } from "./lib/sentry.js";
import { startJobWorker, stopJobWorker } from "./jobs/boss.js";

initBackendSentry();

const app = buildApp();
await startJobWorker();

await app.listen({
  host: "0.0.0.0",
  port: env.PORT
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await stopJobWorker();
    await app.close();
    process.exit(0);
  });
}

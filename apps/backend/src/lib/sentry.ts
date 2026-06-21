import * as Sentry from "@sentry/node";

import { env } from "../env.js";

let initialized = false;

export function initBackendSentry() {
  if (initialized || !env.SENTRY_DSN?.trim() || env.NODE_ENV === "test") {
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 0
  });

  initialized = true;
}

export { Sentry };

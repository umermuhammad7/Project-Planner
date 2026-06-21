declare const process: {
  env: {
    EXPO_PUBLIC_SENTRY_DSN?: string;
  };
};

let initialized = false;

export function initMobileSentry() {
  if (initialized || __DEV__) {
    return;
  }

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) {
    return;
  }

  try {
    // Optional dependency: only active when DSN is configured in production builds.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require("@sentry/react-native") as {
      init: (options: { dsn: string; enableNative: boolean; tracesSampleRate: number }) => void;
    };
    Sentry.init({
      dsn,
      enableNative: true,
      tracesSampleRate: 0.1
    });
    initialized = true;
  } catch {
    console.error("Sentry is configured but @sentry/react-native is unavailable in this build.");
  }
}

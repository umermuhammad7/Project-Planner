declare const process: {
  env: {
    EXPO_PUBLIC_SENTRY_DSN?: string;
  };
};

let initialized = false;

type SentryModule = {
  init: (options: { dsn: string; enableNative: boolean; tracesSampleRate: number }) => void;
  captureException: (error: unknown) => void;
};

function loadSentryModule(): SentryModule | null {
  try {
    // Optional dependency: only active when DSN is configured in production builds.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@sentry/react-native") as SentryModule;
  } catch {
    return null;
  }
}

export function initMobileSentry() {
  if (initialized || __DEV__) {
    return;
  }

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) {
    return;
  }

  const Sentry = loadSentryModule();
  if (!Sentry) {
    console.error("Sentry is configured but @sentry/react-native is unavailable in this build.");
    return;
  }

  Sentry.init({
    dsn,
    enableNative: true,
    tracesSampleRate: 0.1
  });
  initialized = true;
}

export function captureMobileError(error: unknown) {
  if (__DEV__) {
    return;
  }

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) {
    return;
  }

  const Sentry = loadSentryModule();
  if (!Sentry) {
    return;
  }

  Sentry.captureException(error);
}

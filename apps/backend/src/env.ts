import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default("postgresql://postgres:postgres@localhost:5432/homethread"),
  SUPABASE_URL: z.url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  FRONTEND_URL: z.string().default("exp://homethread"),
  DEV_AUTH_TOKEN: z.string().min(1).default("homethread-dev-token"),
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY_1: z.string().optional(),
  GROQ_API_KEY_2: z.string().optional(),
  GROQ_API_KEY_3: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.url().optional(),
  GOOGLE_CALENDAR_SCOPES: z
    .string()
    .default("https://www.googleapis.com/auth/calendar.readonly"),
  CALENDAR_TOKEN_ENCRYPTION_KEY: z.string().optional(),
  JOBS_ENABLED: z.coerce.boolean().default(false),
  EXPO_PUSH_ACCESS_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  TRAVEL_HOME_LATITUDE: z.coerce.number().optional(),
  TRAVEL_HOME_LONGITUDE: z.coerce.number().optional(),
  REVENUECAT_WEBHOOK_SECRET: z.string().optional(),
  REVENUECAT_ENTITLEMENT_ID: z.string().default("family_plus")
});

export const env = envSchema.parse(process.env);

export function getAllowedFrontendOrigins() {
  return env.FRONTEND_URL.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getAuthStatus() {
  const supabaseConfigured = Boolean(env.SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  const devTokenAllowed = env.NODE_ENV !== "production";

  let mode: "supabase" | "dev_token" | "unconfigured" = "unconfigured";
  if (supabaseConfigured) {
    mode = "supabase";
  } else if (devTokenAllowed) {
    mode = "dev_token";
  }

  return {
    supabaseConfigured,
    devTokenAllowed,
    mode
  };
}

export function getAssistantProviderStatus() {
  const groqKeys = [env.GROQ_API_KEY_1, env.GROQ_API_KEY_2, env.GROQ_API_KEY_3].filter((key) =>
    Boolean(key?.trim())
  );

  return {
    openaiConfigured: Boolean(env.OPENAI_API_KEY?.trim()),
    groqKeysConfigured: groqKeys.length
  };
}

export function getCalendarSyncStatus() {
  const googleOAuthConfigured = Boolean(
    env.GOOGLE_OAUTH_CLIENT_ID?.trim() && env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
  );
  const tokenEncryptionConfigured = Boolean(env.CALENDAR_TOKEN_ENCRYPTION_KEY?.trim());

  return {
    googleOAuthConfigured,
    googleConnectImplemented: googleOAuthConfigured && tokenEncryptionConfigured,
    icalImportImplemented: true,
    message: googleOAuthConfigured
      ? tokenEncryptionConfigured
        ? "Google OAuth credentials are present. Connect Google Calendar or save an iCal feed, then use Sync now to import future events manually."
        : "Google OAuth credentials are present, but CALENDAR_TOKEN_ENCRYPTION_KEY is still missing. Google Calendar connect stays off until tokens can be stored safely."
      : "External calendar sync can import iCal feeds manually. Google OAuth is not configured on this server yet."
  };
}

export function getGoogleOAuthConfig() {
  if (
    !env.GOOGLE_OAUTH_CLIENT_ID?.trim() ||
    !env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ||
    !env.CALENDAR_TOKEN_ENCRYPTION_KEY?.trim()
  ) {
    return null;
  }

  const redirectUri =
    env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ||
    `http://localhost:${env.PORT}/api/v1/calendar-sync/google/callback`;

  return {
    clientId: env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri,
    scopes: env.GOOGLE_CALENDAR_SCOPES
      .split(/[,\s]+/u)
      .map((scope) => scope.trim())
      .filter(Boolean)
  };
}

export function getJobsConfig() {
  return {
    enabled: env.JOBS_ENABLED,
    hasExpoPushAccessToken: Boolean(env.EXPO_PUSH_ACCESS_TOKEN?.trim()),
    hasResend: Boolean(env.RESEND_API_KEY?.trim() && env.RESEND_FROM_EMAIL?.trim())
  };
}

export function getTravelConfig() {
  return {
    hasGoogleMapsKey: Boolean(env.GOOGLE_MAPS_API_KEY?.trim()),
    homeCoordinatesConfigured:
      typeof env.TRAVEL_HOME_LATITUDE === "number" && typeof env.TRAVEL_HOME_LONGITUDE === "number"
  };
}

export function getRevenueCatConfig() {
  return {
    webhookSecretConfigured: Boolean(env.REVENUECAT_WEBHOOK_SECRET?.trim()),
    entitlementId: env.REVENUECAT_ENTITLEMENT_ID
  };
}

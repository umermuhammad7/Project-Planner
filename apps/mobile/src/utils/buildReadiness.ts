import { getApiConfigurationStatus } from "../services/api";

declare const process: {
  env: {
    EXPO_PUBLIC_EAS_PROJECT_ID?: string;
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    EXPO_PUBLIC_REVENUECAT_API_KEY?: string;
    EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?: string;
    EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?: string;
    EXPO_PUBLIC_REVENUECAT_WEB_API_KEY?: string;
  };
};

function isSignInConfigured() {
  return Boolean(
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}

function hasBillingSdkKey() {
  return Boolean(
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() ||
      process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim() ||
      process.env.EXPO_PUBLIC_REVENUECAT_WEB_API_KEY?.trim() ||
      process.env.EXPO_PUBLIC_REVENUECAT_API_KEY?.trim()
  );
}

export type BuildReadinessItem = {
  key: string;
  label: string;
  ready: boolean;
  detail: string;
};

export function getClientBuildReadiness(): BuildReadinessItem[] {
  const api = getApiConfigurationStatus();
  const billingConfigured = hasBillingSdkKey();
  const pushConfigured = Boolean(process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim());

  return [
    {
      key: "api",
      label: "Household server",
      ready: !api.usingDefaultLocalUrl,
      detail: api.usingDefaultLocalUrl
        ? "This build still points at a local dev server. Physical devices need a reachable API host."
        : "This build points at a configured API host."
    },
    {
      key: "sign-in",
      label: "Account sign-in",
      ready: isSignInConfigured(),
      detail: isSignInConfigured()
        ? "Email and Google sign-in are configured in this build."
        : "Sign-in is not configured in this build."
    },
    {
      key: "push",
      label: "Push registration",
      ready: pushConfigured,
      detail: pushConfigured
        ? "Expo push project is configured for device token registration."
        : "Push token registration is not configured in this build."
    },
    {
      key: "billing",
      label: "Store billing SDK",
      ready: billingConfigured,
      detail: billingConfigured
        ? "Billing SDK key is set. Store products still need to be configured before checkout works."
        : "Store billing is not configured in this build yet."
    }
  ];
}

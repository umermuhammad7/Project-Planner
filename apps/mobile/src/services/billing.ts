import { Platform } from "react-native";

declare const __DEV__: boolean;
declare const process: {
  env: {
    EXPO_PUBLIC_REVENUECAT_API_KEY?: string;
    EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?: string;
    EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?: string;
    EXPO_PUBLIC_REVENUECAT_WEB_API_KEY?: string;
  };
};

export type BillingStatus = {
  available: boolean;
  keyPresent: boolean;
  platform: string;
  message: string;
};

export type BillingPackageSummary = {
  id: string;
  title: string;
  description: string;
  priceLabel: string;
  periodLabel: string | null;
};

type RevenueCatPackage = import("react-native-purchases").PurchasesPackage;
type RevenueCatCustomerInfo = import("react-native-purchases").CustomerInfo;

type PurchasesClient = {
  isConfigured: () => Promise<boolean>;
  configure: (configuration: { apiKey: string; appUserID?: string | null }) => void;
  setLogLevel: (level: unknown) => Promise<void>;
  logIn: (appUserID: string) => Promise<unknown>;
  getOfferings: () => Promise<{
    current: {
      identifier: string;
      availablePackages: RevenueCatPackage[];
    } | null;
  }>;
  purchasePackage: (aPackage: RevenueCatPackage) => Promise<{
    customerInfo: RevenueCatCustomerInfo;
    productIdentifier: string;
  }>;
  restorePurchases: () => Promise<RevenueCatCustomerInfo>;
  getCustomerInfo: () => Promise<RevenueCatCustomerInfo>;
  logOut: () => Promise<unknown>;
};

let configuredAppUserId: string | null = null;

function billingApiKey() {
  if (Platform.OS === "ios") {
    return (
      process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() ||
      process.env.EXPO_PUBLIC_REVENUECAT_API_KEY?.trim() ||
      null
    );
  }

  if (Platform.OS === "android") {
    return (
      process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim() ||
      process.env.EXPO_PUBLIC_REVENUECAT_API_KEY?.trim() ||
      null
    );
  }

  if (Platform.OS === "web") {
    return (
      process.env.EXPO_PUBLIC_REVENUECAT_WEB_API_KEY?.trim() ||
      process.env.EXPO_PUBLIC_REVENUECAT_API_KEY?.trim() ||
      null
    );
  }

  return process.env.EXPO_PUBLIC_REVENUECAT_API_KEY?.trim() || null;
}

function describePeriod(subscriptionPeriod: string | null | undefined) {
  if (!subscriptionPeriod) {
    return null;
  }

  if (subscriptionPeriod === "P1W") return "weekly";
  if (subscriptionPeriod === "P1M") return "monthly";
  if (subscriptionPeriod === "P2M") return "every 2 months";
  if (subscriptionPeriod === "P3M") return "every 3 months";
  if (subscriptionPeriod === "P6M") return "every 6 months";
  if (subscriptionPeriod === "P1Y") return "yearly";

  return subscriptionPeriod;
}

function friendlyBillingError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  if (/purchase_cancelled|cancelled|canceled/i.test(error.message)) {
    return "Purchase was cancelled before checkout finished.";
  }

  if (/not available in expo go|native module|uninitialized/i.test(error.message)) {
    return "Store billing needs a development build, TestFlight build, or production build on a real device.";
  }

  if (/configuration|offerings|products registered|could not be fetched/i.test(error.message)) {
    return "Billing is connected, but the store products are not ready yet.";
  }

  return error.message || fallback;
}

function toSummary(aPackage: RevenueCatPackage): BillingPackageSummary {
  return {
    id: aPackage.identifier,
    title: aPackage.product.title,
    description: aPackage.product.description,
    priceLabel: aPackage.product.priceString,
    periodLabel: describePeriod(aPackage.product.subscriptionPeriod)
  };
}

async function loadPurchasesModule(): Promise<
  | { ok: true; module: { LOG_LEVEL: { DEBUG: unknown } }; Purchases: PurchasesClient }
  | { ok: false; message: string }
> {
  try {
    const importedModule = await import("react-native-purchases");
    return {
      ok: true,
      module: {
        LOG_LEVEL: importedModule.LOG_LEVEL
      },
      Purchases: importedModule.default as unknown as PurchasesClient
    };
  } catch (error) {
    return {
      ok: false,
      message: friendlyBillingError(
        error,
        "Store billing is not available in this app build."
      )
    };
  }
}

export function getBillingStatus(): BillingStatus {
  const apiKey = billingApiKey();
  if (!apiKey) {
    return {
      available: false,
      keyPresent: false,
      platform: Platform.OS,
      message: "Store billing is not configured in this build yet."
    };
  }

  return {
    available: true,
    keyPresent: true,
    platform: Platform.OS,
    message:
      Platform.OS === "web"
        ? "Billing SDK key is set. Store products still need to be configured before checkout works."
        : "Billing SDK key is set. App Store or Play products still need to be configured before checkout works."
  };
}

async function ensureConfigured(appUserId: string) {
  const status = getBillingStatus();
  if (!status.available) {
    return {
      ok: false as const,
      message: status.message
    };
  }

  const purchasesModule = await loadPurchasesModule();
  if (!purchasesModule.ok) {
    return {
      ok: false as const,
      message: purchasesModule.message
    };
  }

  const { Purchases, module } = purchasesModule;

  try {
    const isConfigured = await Purchases.isConfigured();

    if (!isConfigured) {
      Purchases.configure({
        apiKey: billingApiKey()!,
        appUserID: appUserId
      });

      if (__DEV__) {
        await Purchases.setLogLevel(module.LOG_LEVEL.DEBUG);
      }
    } else if (configuredAppUserId && configuredAppUserId !== appUserId) {
      await Purchases.logIn(appUserId);
    } else if (!configuredAppUserId) {
      await Purchases.logIn(appUserId);
    }

    configuredAppUserId = appUserId;

    return {
      ok: true as const,
      Purchases,
      module
    };
  } catch (error) {
    return {
      ok: false as const,
      message: friendlyBillingError(error, "Store billing could not start.")
    };
  }
}

export async function getBillingPackages(appUserId: string) {
  const configured = await ensureConfigured(appUserId);
  if (!configured.ok) {
    return configured;
  }

  try {
    const offerings = await configured.Purchases.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];

    return {
      ok: true as const,
      offeringIdentifier: offerings.current?.identifier ?? null,
      packages,
      summaries: packages.map(toSummary)
    };
  } catch (error) {
    return {
      ok: false as const,
      message: friendlyBillingError(error, "Could not load store plans.")
    };
  }
}

export async function purchaseBillingPackage(appUserId: string, aPackage: RevenueCatPackage) {
  const configured = await ensureConfigured(appUserId);
  if (!configured.ok) {
    return configured;
  }

  try {
    const result = await configured.Purchases.purchasePackage(aPackage);
    return {
      ok: true as const,
      customerInfo: result.customerInfo,
      productIdentifier: result.productIdentifier,
      message: "Purchase completed."
    };
  } catch (error) {
    return {
      ok: false as const,
      message: friendlyBillingError(error, "Purchase could not be completed.")
    };
  }
}

export async function restoreBillingPurchases(appUserId: string) {
  const configured = await ensureConfigured(appUserId);
  if (!configured.ok) {
    return configured;
  }

  try {
    const customerInfo = await configured.Purchases.restorePurchases();
    return {
      ok: true as const,
      customerInfo,
      message: "Restore finished."
    };
  } catch (error) {
    return {
      ok: false as const,
      message: friendlyBillingError(error, "Could not restore purchases.")
    };
  }
}

export async function getBillingCustomerInfo(appUserId: string) {
  const configured = await ensureConfigured(appUserId);
  if (!configured.ok) {
    return configured;
  }

  try {
    const customerInfo = await configured.Purchases.getCustomerInfo();
    return {
      ok: true as const,
      customerInfo
    };
  } catch (error) {
    return {
      ok: false as const,
      message: friendlyBillingError(error, "Could not read billing state.")
    };
  }
}

export async function resetBillingSession() {
  const purchasesModule = await loadPurchasesModule();
  configuredAppUserId = null;

  if (!purchasesModule.ok) {
    return;
  }

  try {
    if (await purchasesModule.Purchases.isConfigured()) {
      await purchasesModule.Purchases.logOut();
    }
  } catch {
    // Billing reset is best-effort so sign-out is not blocked by SDK state.
  }
}

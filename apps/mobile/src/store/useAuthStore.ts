import { create } from "zustand";

import {
  apiRequest,
  getApiConfigurationStatus,
  setApiAccessTokenProvider,
  setApiUnauthorizedHandler
} from "../services/api";
import { resetBillingSession } from "../services/billing";
import { isSupabaseConfigured, supabaseClient } from "../services/supabase";
import {
  AuthMeResponse,
  AuthStatusResponse,
  FamilySetupResponse,
  NotificationPermissionState,
  NotificationPrefs,
  NotificationPrefsResponse
} from "../types";

declare const process: {
  env: {
    EXPO_PUBLIC_DEV_AUTH_TOKEN?: string;
  };
};

export type AuthMode = "loading" | "signed_out" | "dev_token" | "supabase";

type AuthState = {
  mode: AuthMode;
  accessToken: string | null;
  userId: string | null;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  authProvider: string | null;
  familyId: string | null;
  pushToken: string | null;
  notificationPrefs: NotificationPrefs;
  notificationPermission: NotificationPermissionState;
  authMessage: string | null;
  backendAuthMode: AuthStatusResponse["mode"] | null;
  supabaseConfiguredOnClient: boolean;
  devTokenAvailable: boolean;
  bootstrap: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  signInWithGoogle: () => Promise<{ ok: boolean; message?: string }>;
  signInWithDevToken: () => Promise<{ ok: boolean; message?: string }>;
  createFamily: (name: string) => Promise<{ ok: boolean; message?: string; inviteCode?: string }>;
  joinFamily: (inviteCode: string) => Promise<{ ok: boolean; message?: string }>;
  refreshMembership: () => Promise<{ ok: boolean; familyId?: string | null; message?: string }>;
  updateProfile: (input: { displayName: string; avatarUrl?: string | null }) => Promise<{ ok: boolean; message?: string }>;
  updatePassword: (nextPassword: string) => Promise<{ ok: boolean; message?: string }>;
  requestPasswordReset: () => Promise<{ ok: boolean; message?: string }>;
  savePushToken: (pushToken: string) => Promise<{ ok: boolean; message?: string }>;
  updateNotificationPrefs: (
    prefs: NotificationPrefs
  ) => Promise<{ ok: boolean; message?: string }>;
  setNotificationPermission: (permission: NotificationPermissionState) => void;
  deleteAccount: () => Promise<{ ok: boolean; message?: string }>;
  handleExternalSignedOut: (message?: string | null) => Promise<void>;
  signOut: () => Promise<void>;
};

const defaultNotificationPrefs: NotificationPrefs = {
  daily_digest: true,
  event_reminders: true,
  chore_reminders: true,
  family_activity: true
};

const signedOutState = {
  mode: "signed_out" as const,
  accessToken: null,
  userId: null,
  email: null,
  displayName: null,
  avatarUrl: null,
  authProvider: null,
  familyId: null,
  pushToken: null,
  notificationPrefs: defaultNotificationPrefs,
  notificationPermission: "unknown" as const
};

const devAuthToken = process.env.EXPO_PUBLIC_DEV_AUTH_TOKEN?.trim() ?? "homethread-dev-token";

type AuthSessionModule = typeof import("expo-auth-session");
type QueryParamsModule = {
  getQueryParams: (url: string) => {
    params: Record<string, string | undefined>;
    errorCode: string | null;
  };
};
type WebBrowserModule = typeof import("expo-web-browser");

let authBrowserPrepared = false;

async function loadAuthModules() {
  const [authSession, webBrowser] = await Promise.all([
    import("expo-auth-session") as Promise<AuthSessionModule>,
    import("expo-web-browser") as Promise<WebBrowserModule>
  ]);
  // Expo does not publish public typings for this deep helper path, so we lazy-load it locally.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const queryParams = require("expo-auth-session/build/QueryParams") as QueryParamsModule;

  if (!authBrowserPrepared) {
    webBrowser.maybeCompleteAuthSession();
    authBrowserPrepared = true;
  }

  return { authSession, queryParams, webBrowser };
}

function friendlyAuthError(message: string | undefined, fallback: string) {
  if (!message) {
    return fallback;
  }

  if (/failed to fetch|network request failed/i.test(message)) {
    return "HomeThread could not reach sign-in right now. Check the connection and try again.";
  }

  if (/invalid bearer token/i.test(message)) {
    return "That sign-in option is not available here. Use Google, create an account, or log in.";
  }

  if (/supabase is not configured/i.test(message)) {
    return "Sign-in is not set up in this version of the app yet.";
  }

  return message;
}

function getBrowserRedirectUrl() {
  if (typeof window === "undefined" || !window.location) {
    return null;
  }

  return `${window.location.origin}${window.location.pathname}`;
}

async function getAuthRedirectUrl() {
  const browserRedirectUrl = getBrowserRedirectUrl();
  if (browserRedirectUrl) {
    return browserRedirectUrl;
  }

  const { authSession } = await loadAuthModules();
  return authSession.makeRedirectUri({
    scheme: "homethread",
    path: "auth/callback"
  });
}

async function loadMembership(accessToken: string) {
  const previousToken = useAuthStore.getState().accessToken;
  useAuthStore.setState({ accessToken });

  const result = await apiRequest<AuthMeResponse>("/auth/me");
  if (!result.data) {
    useAuthStore.setState({ accessToken: previousToken });
    return {
      ok: false as const,
      message: result.error?.message ?? "Could not load your HomeThread profile."
    };
  }

  const primaryMembership = result.data.memberships[0];

  return {
    ok: true as const,
    userId: result.data.user.id,
    email: result.data.user.email ?? null,
    displayName: result.data.user.displayName ?? null,
    avatarUrl: result.data.user.avatarUrl ?? null,
    familyId: primaryMembership?.family.id ?? null,
    pushToken: result.data.user.pushToken ?? null,
    notificationPrefs: result.data.user.notificationPrefs ?? defaultNotificationPrefs
  };
}

async function applySupabaseSession(accessToken: string, authProvider: string | null) {
  const membership = await loadMembership(accessToken);
  if (!membership.ok) {
    return { ok: false as const, message: membership.message };
  }

  useAuthStore.setState({
    mode: "supabase",
    accessToken,
    userId: membership.userId,
    email: membership.email,
    displayName: membership.displayName,
    avatarUrl: membership.avatarUrl,
    authProvider,
    familyId: membership.familyId,
    pushToken: membership.pushToken,
    notificationPrefs: membership.notificationPrefs,
    authMessage: membership.familyId
      ? null
      : "Signed in, but this account is not linked to a family yet."
  });

  return { ok: true as const };
}

async function createSessionFromUrl(url: string) {
  if (!supabaseClient) {
    return {
      ok: false as const,
      message: friendlyAuthError(undefined, "Sign-in is not set up in this version of the app yet.")
    };
  }

  const { queryParams } = await loadAuthModules();
  const { params, errorCode } = queryParams.getQueryParams(url);
  if (errorCode) {
    return {
      ok: false as const,
      message: friendlyAuthError(errorCode, "Could not finish Google sign-in.")
    };
  }

  const accessToken =
    typeof params.access_token === "string" ? params.access_token : null;
  const refreshToken =
    typeof params.refresh_token === "string" ? params.refresh_token : null;

  if (!accessToken || !refreshToken) {
    return {
      ok: false as const,
      message: "Google sign-in returned without a usable session."
    };
  }

  const { data, error } = await supabaseClient.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  if (error || !data.session?.access_token) {
    return {
      ok: false as const,
      message: friendlyAuthError(error?.message, "Could not save the Google session.")
    };
  }

  return applySupabaseSession(
    data.session.access_token,
    data.session.user.app_metadata?.provider ?? "google"
  );
}

export const useAuthStore = create<AuthState>((set, get) => ({
  mode: "loading",
  accessToken: null,
  userId: null,
  email: null,
  displayName: null,
  avatarUrl: null,
  authProvider: null,
  familyId: null,
  pushToken: null,
  notificationPrefs: defaultNotificationPrefs,
  notificationPermission: "unknown",
  authMessage: null,
  backendAuthMode: null,
  supabaseConfiguredOnClient: isSupabaseConfigured,
  devTokenAvailable: Boolean(devAuthToken),
  bootstrap: async () => {
    try {
      setApiAccessTokenProvider(() => get().accessToken);
      setApiUnauthorizedHandler(async () => {
        const currentMode = get().mode;
        if (currentMode === "signed_out" || currentMode === "loading") {
          return;
        }

        if (supabaseClient) {
          await supabaseClient.auth.signOut({ scope: "local" });
        }

        await resetBillingSession();

        set({
          ...signedOutState,
          authMessage: "Your session expired. Sign in again to keep household data in sync."
        });
      });

      const statusResult = await apiRequest<AuthStatusResponse>("/auth/status");
      const backendAuthMode = statusResult.data?.mode ?? null;
      const devTokenAvailable = Boolean(devAuthToken) && (statusResult.data?.devTokenAllowed ?? false);
      const apiConfig = getApiConfigurationStatus();

      if (!supabaseClient) {
        set({
          ...signedOutState,
          backendAuthMode,
          devTokenAvailable,
          authMessage: isSupabaseConfigured
            ? null
            : devTokenAvailable
              ? null
              : "Sign-in is not available in this version of the app yet."
        });
        return;
      }

      const { data, error } = await supabaseClient.auth.getSession();

      if (error) {
        set({
          ...signedOutState,
          backendAuthMode,
          devTokenAvailable,
          authMessage: friendlyAuthError(error.message, "Could not restore your session.")
        });
        return;
      }

      if (!data.session?.access_token) {
        set({
          ...signedOutState,
          backendAuthMode,
          devTokenAvailable,
          authMessage: statusResult.data
            ? apiConfig.message
              ? friendlyAuthError(apiConfig.message, apiConfig.message)
              : null
            : friendlyAuthError(statusResult.error?.message, "Could not reach HomeThread sign-in.")
        });
        return;
      }

      const membership = await loadMembership(data.session.access_token);
      if (!membership.ok) {
        set({
          ...signedOutState,
          backendAuthMode,
          devTokenAvailable,
          authMessage: friendlyAuthError(membership.message, "Could not load your profile.")
        });
        return;
      }

      set({
        mode: "supabase",
        accessToken: data.session.access_token,
        userId: membership.userId,
        email: membership.email,
        displayName: membership.displayName,
        avatarUrl: membership.avatarUrl,
        authProvider: data.session.user.app_metadata?.provider ?? null,
        familyId: membership.familyId,
        pushToken: membership.pushToken,
        notificationPrefs: membership.notificationPrefs,
        backendAuthMode,
        authMessage: membership.familyId
          ? null
          : "Signed in, but this account is not linked to a family yet."
      });
    } catch (error) {
      set({
        ...signedOutState,
        devTokenAvailable: get().devTokenAvailable,
        authMessage:
          error instanceof Error
            ? friendlyAuthError(error.message, "HomeThread could not start sign-in.")
            : "HomeThread could not start sign-in."
      });
    }
  },
  signInWithPassword: async (email, password) => {
    if (!supabaseClient) {
      return { ok: false, message: friendlyAuthError(undefined, "Sign-in is not set up in this version of the app yet.") };
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (error || !data.session?.access_token) {
      return { ok: false, message: error?.message ?? "Sign in failed." };
    }

    const applied = await applySupabaseSession(
      data.session.access_token,
      data.user?.app_metadata?.provider ?? data.session.user.app_metadata?.provider ?? null
    );
    if (!applied.ok) {
      await supabaseClient.auth.signOut();
      set({
        ...signedOutState,
        authMessage: applied.message
      });
      return { ok: false, message: applied.message };
    }

    return { ok: true };
  },
  signUpWithPassword: async (email, password) => {
    if (!supabaseClient) {
      return { ok: false, message: friendlyAuthError(undefined, "Sign-in is not set up in this version of the app yet.") };
    }

    const { data, error } = await supabaseClient.auth.signUp({
      email: email.trim(),
      password
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    if (!data.session?.access_token) {
      return {
        ok: false,
        message:
          "Account created. Check your email to confirm your address before signing in."
      };
    }

    const applied = await applySupabaseSession(
      data.session.access_token,
      data.user?.app_metadata?.provider ?? data.session.user.app_metadata?.provider ?? null
    );
    if (!applied.ok) {
      await supabaseClient.auth.signOut();
      set({
        ...signedOutState,
        authMessage: applied.message
      });
      return { ok: false, message: applied.message };
    }
    set({
      authMessage: get().familyId
        ? null
        : "Account created. Family setup is still required before HomeThread can load household data."
    });

    return { ok: true };
  },
  signInWithGoogle: async () => {
    if (!supabaseClient) {
      return { ok: false, message: friendlyAuthError(undefined, "Sign-in is not set up in this version of the app yet.") };
    }

    const redirectTo = await getAuthRedirectUrl();
    const isBrowser = Boolean(getBrowserRedirectUrl());

    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: !isBrowser,
        queryParams: {
          prompt: "select_account",
          access_type: "offline"
        }
      }
    });

    if (error) {
      return { ok: false, message: friendlyAuthError(error.message, "Google sign-in could not start.") };
    }

    if (isBrowser) {
      return { ok: true };
    }

    const { webBrowser } = await loadAuthModules();
    const result = await webBrowser.openAuthSessionAsync(data?.url ?? "", redirectTo);
    if (result.type !== "success" || !result.url) {
      return {
        ok: false,
        message: "Google sign-in was cancelled before it finished."
      };
    }

    return createSessionFromUrl(result.url);
  },
  createFamily: async (name) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return { ok: false, message: "Family name is required." };
    }

    const result = await apiRequest<FamilySetupResponse>("/families", {
      method: "POST",
      body: JSON.stringify({ name: trimmedName })
    });

    if (!result.data) {
      return {
        ok: false,
        message: result.error?.message ?? "Could not create your family."
      };
    }

    set({
      familyId: result.data.family.id,
      authMessage: null
    });

    return { ok: true, inviteCode: result.data.family.inviteCode };
  },
  joinFamily: async (inviteCode) => {
    const trimmedCode = inviteCode.trim().toUpperCase();
    if (!trimmedCode) {
      return { ok: false, message: "Invite code is required." };
    }

    const result = await apiRequest<FamilySetupResponse>("/families/join", {
      method: "POST",
      body: JSON.stringify({ inviteCode: trimmedCode })
    });

    if (!result.data) {
      return {
        ok: false,
        message: result.error?.message ?? "Could not join that family."
      };
    }

    set({
      familyId: result.data.family.id,
      authMessage: null
    });

    return { ok: true };
  },
  refreshMembership: async () => {
    const { accessToken, mode } = get();
    if (!accessToken || mode === "loading" || mode === "signed_out") {
      return { ok: false, message: "Sign in before refreshing membership." };
    }

    const membership = await loadMembership(accessToken);
    if (!membership.ok) {
      return { ok: false, message: membership.message };
    }

    set({
      userId: membership.userId,
      email: membership.email,
      displayName: membership.displayName,
      avatarUrl: membership.avatarUrl,
      familyId: membership.familyId,
      pushToken: membership.pushToken,
      notificationPrefs: membership.notificationPrefs,
      authMessage: membership.familyId
        ? null
        : "Signed in, not linked to a family yet."
    });

    return { ok: true, familyId: membership.familyId };
  },
  updateProfile: async ({ displayName, avatarUrl }) => {
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      return { ok: false, message: "Display name is required." };
    }

    const result = await apiRequest<{ user: { displayName: string | null; avatarUrl?: string | null } }>("/auth/profile", {
      method: "POST",
      body: JSON.stringify({
        displayName: trimmedName,
        avatarUrl: avatarUrl ?? get().avatarUrl ?? null,
        phone: null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        locale: Intl.DateTimeFormat().resolvedOptions().locale || "en"
      })
    });

    if (!result.data?.user) {
      return {
        ok: false,
        message: result.error?.message ?? "Could not update your profile."
      };
    }

    set({
      displayName: result.data.user.displayName ?? trimmedName,
      avatarUrl: result.data.user.avatarUrl ?? avatarUrl ?? null
    });

    return { ok: true };
  },
  updatePassword: async (nextPassword) => {
    const trimmedPassword = nextPassword.trim();
    if (!supabaseClient || get().mode !== "supabase") {
      return {
        ok: false,
        message: "Password updates are only available for signed-in accounts."
      };
    }

    if (trimmedPassword.length < 8) {
      return {
        ok: false,
        message: "Use at least 8 characters for the new password."
      };
    }

    const { error } = await supabaseClient.auth.updateUser({
      password: trimmedPassword
    });

    if (error) {
      return {
        ok: false,
        message: friendlyAuthError(error.message, "Could not update your password.")
      };
    }

    return {
      ok: true,
      message: "Password updated."
    };
  },
  requestPasswordReset: async () => {
    const email = get().email?.trim();
    if (!supabaseClient || !email) {
      return {
        ok: false,
        message: "Password reset is not available for this session."
      };
    }

    const redirectTo = await getAuthRedirectUrl();
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);

    if (error) {
      return {
        ok: false,
        message: friendlyAuthError(error.message, "Could not send a password reset email.")
      };
    }

    return {
      ok: true,
      message: "Password reset email sent."
    };
  },
  signInWithDevToken: async () => {
    const membership = await loadMembership(devAuthToken);
    if (!membership.ok) {
      const message = friendlyAuthError(membership.message, "Dev sign-in failed.");
      set({
        ...signedOutState,
        devTokenAvailable: get().devTokenAvailable,
        authMessage: message
      });
      return { ok: false, message };
    }

    set({
      mode: "dev_token",
      accessToken: devAuthToken,
      userId: membership.userId,
      email: membership.email,
      displayName: membership.displayName,
      avatarUrl: membership.avatarUrl,
      authProvider: "dev_token",
      familyId: membership.familyId,
      pushToken: membership.pushToken,
      notificationPrefs: membership.notificationPrefs,
      authMessage: null
    });

    return { ok: true };
  },
  savePushToken: async (pushToken) => {
    const trimmed = pushToken.trim();
    if (!trimmed) {
      return { ok: false, message: "Push token is required." };
    }

    const result = await apiRequest<{ user: { pushToken?: string | null } }>("/auth/push-token", {
      method: "PUT",
      body: JSON.stringify({ pushToken: trimmed })
    });

    if (!result.data?.user) {
      return {
        ok: false,
        message: result.error?.message ?? "Could not save your push token."
      };
    }

    set({
      pushToken: result.data.user.pushToken ?? trimmed
    });
    return { ok: true };
  },
  updateNotificationPrefs: async (prefs) => {
    const result = await apiRequest<NotificationPrefsResponse>("/auth/notification-prefs", {
      method: "PUT",
      body: JSON.stringify(prefs)
    });

    if (!result.data?.user?.notificationPrefs) {
      return {
        ok: false,
        message: result.error?.message ?? "Could not save notification settings."
      };
    }

    set({
      notificationPrefs: result.data.user.notificationPrefs,
      pushToken: result.data.user.pushToken ?? get().pushToken
    });

    return { ok: true };
  },
  setNotificationPermission: (permission) => {
    set({ notificationPermission: permission });
  },
  deleteAccount: async () => {
    const result = await apiRequest<{ deleted: boolean }>("/auth/account", {
      method: "DELETE"
    });

    if (!result.data?.deleted) {
      return {
        ok: false,
        message: result.error?.message ?? "Could not delete this account."
      };
    }

    if (supabaseClient) {
      try {
        await supabaseClient.auth.signOut();
      } catch {
        // Account deletion already succeeded server-side. Local sign-out should still complete.
      }
    }

    await get().handleExternalSignedOut("Account deleted.");

    return { ok: true };
  },
  handleExternalSignedOut: async (message = null) => {
    await resetBillingSession();
    set({
      ...signedOutState,
      authMessage: message
    });
  },
  signOut: async () => {
    if (get().mode === "signed_out") {
      return;
    }

    if (supabaseClient) {
      try {
        await supabaseClient.auth.signOut();
      } catch {
        // Keep sign-out resilient even if the auth provider request fails on web reloads.
      }
    }

    await get().handleExternalSignedOut();
  }
}));

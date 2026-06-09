import { create } from "zustand";

import {
  apiRequest,
  getApiConfigurationStatus,
  setApiAccessTokenProvider,
  setApiUnauthorizedHandler
} from "../services/api";
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
  updateProfile: (input: { displayName: string }) => Promise<{ ok: boolean; message?: string }>;
  savePushToken: (pushToken: string) => Promise<{ ok: boolean; message?: string }>;
  updateNotificationPrefs: (
    prefs: NotificationPrefs
  ) => Promise<{ ok: boolean; message?: string }>;
  setNotificationPermission: (permission: NotificationPermissionState) => void;
  deleteAccount: () => Promise<{ ok: boolean; message?: string }>;
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
  familyId: null,
  pushToken: null,
  notificationPrefs: defaultNotificationPrefs,
  notificationPermission: "unknown" as const
};

const devAuthToken = process.env.EXPO_PUBLIC_DEV_AUTH_TOKEN?.trim() ?? "homethread-dev-token";

function getBrowserRedirectUrl() {
  if (typeof window === "undefined" || !window.location) {
    return null;
  }

  return `${window.location.origin}${window.location.pathname}`;
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
    familyId: primaryMembership?.family.id ?? null,
    pushToken: result.data.user.pushToken ?? null,
    notificationPrefs: result.data.user.notificationPrefs ?? defaultNotificationPrefs
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  mode: "loading",
  accessToken: null,
  userId: null,
  email: null,
  displayName: null,
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
          await supabaseClient.auth.signOut();
        }

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
            : "Supabase is not configured in the app. Sign in with the local dev token or add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
        });
        return;
      }

      const { data, error } = await supabaseClient.auth.getSession();

      if (error) {
        set({
          ...signedOutState,
          backendAuthMode,
          authMessage: error.message
        });
        return;
      }

      if (!data.session?.access_token) {
        set({
          ...signedOutState,
          backendAuthMode,
          authMessage: statusResult.data ? apiConfig.message : statusResult.error?.message ?? apiConfig.message
        });
        return;
      }

      const membership = await loadMembership(data.session.access_token);
      if (!membership.ok) {
        set({
          ...signedOutState,
          backendAuthMode,
          authMessage: membership.message
        });
        return;
      }

      set({
        mode: "supabase",
        accessToken: data.session.access_token,
        userId: membership.userId,
        email: membership.email,
        displayName: membership.displayName,
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
        authMessage:
          error instanceof Error
            ? `HomeThread could not start sign-in services: ${error.message}`
            : "HomeThread could not start sign-in services."
      });
    }
  },
  signInWithPassword: async (email, password) => {
    if (!supabaseClient) {
      return { ok: false, message: "Supabase is not configured in this app build." };
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (error || !data.session?.access_token) {
      return { ok: false, message: error?.message ?? "Sign in failed." };
    }

    const membership = await loadMembership(data.session.access_token);
    if (!membership.ok) {
      await supabaseClient.auth.signOut();
      set({
        ...signedOutState,
        authMessage: membership.message
      });
      return { ok: false, message: membership.message };
    }

    set({
      mode: "supabase",
      accessToken: data.session.access_token,
      userId: membership.userId,
      email: membership.email,
      displayName: membership.displayName,
      familyId: membership.familyId,
      pushToken: membership.pushToken,
      notificationPrefs: membership.notificationPrefs,
      authMessage: membership.familyId
        ? null
        : "Signed in, but this account is not linked to a family yet."
    });

    return { ok: true };
  },
  signUpWithPassword: async (email, password) => {
    if (!supabaseClient) {
      return { ok: false, message: "Supabase is not configured in this app build." };
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
          "Account created. If email confirmation is enabled in Supabase, confirm your email before signing in."
      };
    }

    const membership = await loadMembership(data.session.access_token);
    if (!membership.ok) {
      await supabaseClient.auth.signOut();
      set({
        ...signedOutState,
        authMessage: membership.message
      });
      return { ok: false, message: membership.message };
    }

    set({
      mode: "supabase",
      accessToken: data.session.access_token,
      userId: membership.userId,
      email: membership.email,
      displayName: membership.displayName,
      familyId: membership.familyId,
      pushToken: membership.pushToken,
      notificationPrefs: membership.notificationPrefs,
      authMessage: membership.familyId
        ? null
        : "Account created. Family setup is still required before HomeThread can load household data."
    });

    return { ok: true };
  },
  signInWithGoogle: async () => {
    if (!supabaseClient) {
      return { ok: false, message: "Supabase is not configured in this app build." };
    }

    const redirectTo = getBrowserRedirectUrl();
    if (!redirectTo) {
      return {
        ok: false,
        message: "Google sign-in is only wired for the browser in this build."
      };
    }

    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo
      }
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    return { ok: true };
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
      familyId: membership.familyId,
      pushToken: membership.pushToken,
      notificationPrefs: membership.notificationPrefs,
      authMessage: membership.familyId
        ? null
        : "Signed in, not linked to a family yet."
    });

    return { ok: true, familyId: membership.familyId };
  },
  updateProfile: async ({ displayName }) => {
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      return { ok: false, message: "Display name is required." };
    }

    const result = await apiRequest<{ user: { displayName: string | null } }>("/auth/profile", {
      method: "POST",
      body: JSON.stringify({
        displayName: trimmedName,
        avatarUrl: null,
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
      displayName: result.data.user.displayName ?? trimmedName
    });

    return { ok: true };
  },
  signInWithDevToken: async () => {
    set({
      accessToken: devAuthToken,
      mode: "dev_token",
      authMessage: "Using explicit local dev token auth."
    });

    const membership = await loadMembership(devAuthToken);
    if (!membership.ok) {
      set({
        ...signedOutState,
        authMessage: membership.message
      });
      return { ok: false, message: membership.message };
    }

    set({
      mode: "dev_token",
      accessToken: devAuthToken,
      userId: membership.userId,
      email: membership.email,
      displayName: membership.displayName,
      familyId: membership.familyId,
      pushToken: membership.pushToken,
      notificationPrefs: membership.notificationPrefs,
      authMessage: "Signed in with local dev token."
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
      await supabaseClient.auth.signOut();
    }

    set({
      ...signedOutState,
      authMessage: "Account deleted."
    });

    return { ok: true };
  },
  signOut: async () => {
    if (get().mode === "signed_out") {
      return;
    }

    if (supabaseClient) {
      await supabaseClient.auth.signOut();
    }

    set({
      ...signedOutState,
      authMessage: null
    });
  }
}));

import { create } from "zustand";

import { apiRequest, setApiAccessTokenProvider } from "../services/api";
import { isSupabaseConfigured, supabaseClient } from "../services/supabase";
import { AuthMeResponse, AuthStatusResponse, FamilySetupResponse } from "../types";

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
  familyId: string | null;
  authMessage: string | null;
  backendAuthMode: AuthStatusResponse["mode"] | null;
  supabaseConfiguredOnClient: boolean;
  devTokenAvailable: boolean;
  bootstrap: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  signInWithDevToken: () => Promise<{ ok: boolean; message?: string }>;
  createFamily: (name: string) => Promise<{ ok: boolean; message?: string; inviteCode?: string }>;
  joinFamily: (inviteCode: string) => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
};

const devAuthToken = process.env.EXPO_PUBLIC_DEV_AUTH_TOKEN?.trim() ?? "homethread-dev-token";

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
    familyId: primaryMembership?.family.id ?? null
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  mode: "loading",
  accessToken: null,
  userId: null,
  email: null,
  familyId: null,
  authMessage: null,
  backendAuthMode: null,
  supabaseConfiguredOnClient: isSupabaseConfigured,
  devTokenAvailable: Boolean(devAuthToken),
  bootstrap: async () => {
    setApiAccessTokenProvider(() => get().accessToken);

    const statusResult = await apiRequest<AuthStatusResponse>("/auth/status");
    const backendAuthMode = statusResult.data?.mode ?? null;
    const devTokenAvailable = Boolean(devAuthToken) && (statusResult.data?.devTokenAllowed ?? false);

    if (!supabaseClient) {
      set({
        mode: "signed_out",
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
        mode: "signed_out",
        backendAuthMode,
        authMessage: error.message
      });
      return;
    }

    if (!data.session?.access_token) {
      set({
        mode: "signed_out",
        backendAuthMode,
        authMessage: null
      });
      return;
    }

    const membership = await loadMembership(data.session.access_token);
    if (!membership.ok) {
      set({
        mode: "signed_out",
        accessToken: null,
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
      familyId: membership.familyId,
      backendAuthMode,
      authMessage: membership.familyId
        ? null
        : "Signed in, but this account is not linked to a family yet."
    });
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
        mode: "signed_out",
        accessToken: null,
        userId: null,
        email: null,
        familyId: null,
        authMessage: membership.message
      });
      return { ok: false, message: membership.message };
    }

    set({
      mode: "supabase",
      accessToken: data.session.access_token,
      userId: membership.userId,
      email: membership.email,
      familyId: membership.familyId,
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
        mode: "signed_out",
        accessToken: null,
        userId: null,
        email: null,
        familyId: null,
        authMessage: membership.message
      });
      return { ok: false, message: membership.message };
    }

    set({
      mode: "supabase",
      accessToken: data.session.access_token,
      userId: membership.userId,
      email: membership.email,
      familyId: membership.familyId,
      authMessage: membership.familyId
        ? null
        : "Account created. Family setup is still required before HomeThread can load household data."
    });

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
    const trimmedCode = inviteCode.trim();
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
  signInWithDevToken: async () => {
    set({
      accessToken: devAuthToken,
      mode: "dev_token",
      authMessage: "Using explicit local dev token auth."
    });

    const membership = await loadMembership(devAuthToken);
    if (!membership.ok) {
      set({
        mode: "signed_out",
        accessToken: null,
        userId: null,
        email: null,
        familyId: null,
        authMessage: membership.message
      });
      return { ok: false, message: membership.message };
    }

    set({
      mode: "dev_token",
      accessToken: devAuthToken,
      userId: membership.userId,
      email: membership.email,
      familyId: membership.familyId,
      authMessage: "Signed in with local dev token."
    });

    return { ok: true };
  },
  signOut: async () => {
    if (supabaseClient) {
      await supabaseClient.auth.signOut();
    }

    set({
      mode: "signed_out",
      accessToken: null,
      userId: null,
      email: null,
      familyId: null,
      authMessage: null
    });
  }
}));

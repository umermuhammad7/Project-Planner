import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";

import {
  CHILD_DEVICE_TOKEN_KEY,
  completeChildDeviceChore,
  fetchChildDeviceChores,
  fetchChildDeviceSession,
  pairChildDevice,
  previewChildPairingCode,
  saveChildDevicePushToken,
  setChildDeviceTokenProvider,
  setChildDeviceUnauthorizedHandler,
  uploadChildDeviceAvatar,
  unpairChildDevice
} from "../services/childDeviceApi";
import { refreshPushTokenIfAvailable } from "../services/notifications";

export type ChildDeviceChore = {
  id: string;
  title: string;
  dueTime: string | null;
  stars: number;
  completed: boolean;
};

type ChildDeviceSession = {
  deviceToken: string;
  familyId: string;
  familyName: string;
  memberId: string;
  memberName: string;
  avatarUrl: string | null;
  starBalance: number;
};

type ChildDeviceState = {
  mode: "unknown" | "unpaired" | "paired";
  session: ChildDeviceSession | null;
  chores: ChildDeviceChore[];
  statusMessage: string | null;
  isLoading: boolean;
  isSaving: boolean;
  bootstrapComplete: boolean;
  bootstrap: () => Promise<void>;
  previewPairingCode: (
    pairingCode: string
  ) => Promise<{
    ok: boolean;
    preview?: {
      pairingCode: string;
      expiresAt: string;
      family: { id: string; name: string };
      member: { id: string; displayName: string };
    };
    message?: string;
  }>;
  pairWithCode: (pairingCode: string) => Promise<{ ok: boolean; message?: string }>;
  refresh: () => Promise<void>;
  completeChore: (choreId: string) => Promise<{ ok: boolean; message: string }>;
  uploadAvatar: (imageBase64: string, mimeType: string) => Promise<{ ok: boolean; message: string }>;
  registerPushToken: () => Promise<void>;
  unpair: () => Promise<void>;
  clearStatusMessage: () => void;
};

const memoryTokenStore = new Map<string, string>();

async function readStoredDeviceToken() {
  if (Platform.OS === "web") {
    return memoryTokenStore.get(CHILD_DEVICE_TOKEN_KEY) ?? null;
  }

  try {
    return await SecureStore.getItemAsync(CHILD_DEVICE_TOKEN_KEY);
  } catch {
    return null;
  }
}

async function writeStoredDeviceToken(token: string | null) {
  if (Platform.OS === "web") {
    if (token) {
      memoryTokenStore.set(CHILD_DEVICE_TOKEN_KEY, token);
    } else {
      memoryTokenStore.delete(CHILD_DEVICE_TOKEN_KEY);
    }
    return;
  }

  if (!token) {
    await SecureStore.deleteItemAsync(CHILD_DEVICE_TOKEN_KEY);
    return;
  }

  await SecureStore.setItemAsync(CHILD_DEVICE_TOKEN_KEY, token);
}

function mapChores(response: Awaited<ReturnType<typeof fetchChildDeviceChores>>["data"]) {
  if (!response) {
    return [];
  }

  return response.chores.map((chore) => ({
    id: chore.id,
    title: chore.title,
    dueTime: chore.dueTime ?? null,
    stars: chore.starsValue,
    completed: chore.completedToday
  }));
}

let validatingDeviceToken: string | null = null;

export const useChildDeviceStore = create<ChildDeviceState>((set, get) => {
  setChildDeviceTokenProvider(() => get().session?.deviceToken ?? validatingDeviceToken);
  setChildDeviceUnauthorizedHandler(async () => {
    await writeStoredDeviceToken(null);
    set({
      mode: "unpaired",
      session: null,
      chores: [],
      statusMessage: "This child device was replaced or unpaired by a parent."
    });
  });

  return {
    mode: "unknown",
    session: null,
    chores: [],
    statusMessage: null,
    isLoading: false,
    isSaving: false,
    bootstrapComplete: false,
    bootstrap: async () => {
      set({
        isLoading: true,
        statusMessage: null,
        mode: "unknown",
        session: null,
        chores: []
      });
      const storedToken = await readStoredDeviceToken();

      if (!storedToken) {
        set({
          mode: "unpaired",
          session: null,
          chores: [],
          isLoading: false,
          bootstrapComplete: true
        });
        return;
      }

      validatingDeviceToken = storedToken;
      const result = await fetchChildDeviceSession();
      validatingDeviceToken = null;

      if (!result.data) {
        await writeStoredDeviceToken(null);
        set({
          mode: "unpaired",
          session: null,
          chores: [],
          isLoading: false,
          bootstrapComplete: true,
          statusMessage: result.error?.message ?? "Child device session expired."
        });
        return;
      }

      const session: ChildDeviceSession = {
        deviceToken: storedToken,
        familyId: result.data.family.id,
        familyName: result.data.family.name,
        memberId: result.data.member.id,
        memberName: result.data.member.displayName,
        avatarUrl: result.data.member.avatarUrl ?? null,
        starBalance: result.data.member.starBalance
      };

      const choresResult = await fetchChildDeviceChores();
      set({
        mode: "paired",
        session,
        chores: mapChores(choresResult.data),
        isLoading: false,
        bootstrapComplete: true
      });

      await get().registerPushToken();
    },
    previewPairingCode: async (pairingCode) => {
      set({ isSaving: true, statusMessage: null });
      const result = await previewChildPairingCode(pairingCode);
      set({ isSaving: false });

      if (!result.data) {
        return {
          ok: false,
          message: result.error?.message ?? "Could not look up that pairing code."
        };
      }

      return { ok: true, preview: result.data };
    },
    pairWithCode: async (pairingCode) => {
      set({ isSaving: true, statusMessage: null });
      const result = await pairChildDevice(pairingCode);
      set({ isSaving: false });

      if (!result.data) {
        return {
          ok: false,
          message: result.error?.message ?? "Could not pair this device."
        };
      }

      await writeStoredDeviceToken(result.data.deviceToken);
      set({
        mode: "paired",
        session: {
          deviceToken: result.data.deviceToken,
          familyId: result.data.family.id,
          familyName: result.data.family.name,
          memberId: result.data.member.id,
          memberName: result.data.member.displayName,
          avatarUrl: null,
          starBalance: result.data.member.starBalance
        },
        chores: []
      });

      await get().refresh();
      await get().registerPushToken();
      return { ok: true };
    },
    refresh: async () => {
      const session = get().session;
      if (!session) {
        return;
      }

      const [meResult, choresResult] = await Promise.all([fetchChildDeviceSession(), fetchChildDeviceChores()]);
      if (!meResult.data) {
        // A genuinely invalid/revoked token is already handled by the unauthorized
        // handler above (it resets mode/session with a specific explanation). Anything
        // else here is a transient failure (network blip, server hiccup) — don't punt
        // a legitimately paired child out of their session over that.
        return;
      }

      set({
        session: {
          ...session,
          familyName: meResult.data.family.name,
          memberName: meResult.data.member.displayName,
          avatarUrl: meResult.data.member.avatarUrl ?? null,
          starBalance: meResult.data.member.starBalance
        },
        chores: choresResult.data ? mapChores(choresResult.data) : get().chores
      });
    },
    completeChore: async (choreId) => {
      const session = get().session;
      if (!session) {
        return { ok: false, message: "This device is not paired." };
      }

      set({ isSaving: true });
      const dueDate = new Date().toISOString().slice(0, 10);
      const result = await completeChildDeviceChore(choreId, session.memberId, dueDate);
      set({ isSaving: false });

      if (!result.data) {
        return { ok: false, message: result.error?.message ?? "Could not complete that chore." };
      }

      await get().refresh();
      return { ok: true, message: "Nice work - chore completed." };
    },
    uploadAvatar: async (imageBase64, mimeType) => {
      const session = get().session;
      if (!session) {
        return { ok: false, message: "This device is not paired." };
      }

      set({ isSaving: true });
      const result = await uploadChildDeviceAvatar(imageBase64, mimeType);
      set({ isSaving: false });

      if (!result.data?.avatarUrl) {
        return { ok: false, message: result.error?.message ?? "Could not update that profile photo." };
      }

      set({
        session: {
          ...session,
          avatarUrl: result.data.avatarUrl
        }
      });

      return { ok: true, message: "Profile photo updated." };
    },
    registerPushToken: async () => {
      const refreshed = await refreshPushTokenIfAvailable();
      if (!refreshed.ok || !refreshed.pushToken) {
        return;
      }

      await saveChildDevicePushToken(refreshed.pushToken);
    },
    unpair: async () => {
      await unpairChildDevice();
      await writeStoredDeviceToken(null);
      set({
        mode: "unpaired",
        session: null,
        chores: [],
        statusMessage: "Device unpaired."
      });
    },
    clearStatusMessage: () => {
      set({ statusMessage: null });
    }
  };
});

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";

import {
  CHILD_DEVICE_TOKEN_KEY,
  completeChildDeviceChore,
  fetchChildDeviceChores,
  fetchChildDeviceSession,
  pairChildDevice,
  saveChildDevicePushToken,
  setChildDeviceTokenProvider,
  setChildDeviceUnauthorizedHandler,
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
  starBalance: number;
};

type ChildDeviceState = {
  mode: "unknown" | "unpaired" | "paired";
  session: ChildDeviceSession | null;
  chores: ChildDeviceChore[];
  statusMessage: string | null;
  isLoading: boolean;
  isSaving: boolean;
  bootstrap: () => Promise<void>;
  pairWithCode: (pairingCode: string) => Promise<{ ok: boolean; message?: string }>;
  refresh: () => Promise<void>;
  completeChore: (choreId: string) => Promise<{ ok: boolean; message: string }>;
  registerPushToken: () => Promise<void>;
  unpair: () => Promise<void>;
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

export const useChildDeviceStore = create<ChildDeviceState>((set, get) => {
  setChildDeviceTokenProvider(() => get().session?.deviceToken ?? null);
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
    bootstrap: async () => {
      set({ isLoading: true, statusMessage: null });
      const storedToken = await readStoredDeviceToken();

      if (!storedToken) {
        set({ mode: "unpaired", session: null, chores: [], isLoading: false });
        return;
      }

      set({
        mode: "paired",
        session: {
          deviceToken: storedToken,
          familyId: "",
          familyName: "",
          memberId: "",
          memberName: "",
          starBalance: 0
        }
      });

      const result = await fetchChildDeviceSession();
      if (!result.data) {
        await writeStoredDeviceToken(null);
        set({
          mode: "unpaired",
          session: null,
          chores: [],
          isLoading: false,
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
        starBalance: result.data.member.starBalance
      };

      const choresResult = await fetchChildDeviceChores();
      set({
        mode: "paired",
        session,
        chores: mapChores(choresResult.data),
        isLoading: false
      });

      await get().registerPushToken();
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
        await get().unpair();
        return;
      }

      set({
        session: {
          ...session,
          familyName: meResult.data.family.name,
          memberName: meResult.data.member.displayName,
          starBalance: meResult.data.member.starBalance
        },
        chores: mapChores(choresResult.data)
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
    }
  };
});

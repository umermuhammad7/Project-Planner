import type AsyncStorage from "@react-native-async-storage/async-storage";
import type * as SecureStore from "expo-secure-store";
import { createClient, type SupportedStorage, type SupabaseClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

declare const process: {
  env: {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
  };
};

const memoryStorage = new Map<string, string>();
const isBrowser = typeof window !== "undefined" && typeof window.location !== "undefined";

async function getNativeAsyncStorage(): Promise<typeof AsyncStorage> {
  const module = await import("@react-native-async-storage/async-storage");
  return (module.default ?? module) as unknown as typeof AsyncStorage;
}

async function getNativeSecureStore(): Promise<typeof SecureStore> {
  return (await import("expo-secure-store")) as typeof SecureStore;
}

const browserStorage: SupportedStorage = {
  getItem(key: string) {
    if (typeof localStorage === "undefined") {
      return memoryStorage.get(key) ?? null;
    }

    return localStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    if (typeof localStorage === "undefined") {
      memoryStorage.set(key, value);
      return;
    }

    localStorage.setItem(key, value);
  },
  removeItem(key: string) {
    if (typeof localStorage === "undefined") {
      memoryStorage.delete(key);
      return;
    }

    localStorage.removeItem(key);
  }
};

const nativeStorage: SupportedStorage = {
  async getItem(key: string) {
    try {
      const secureStore = await getNativeSecureStore();
      return await secureStore.getItemAsync(key);
    } catch {
      const storage = await getNativeAsyncStorage();
      return storage.getItem(key);
    }
  },
  async setItem(key: string, value: string) {
    try {
      const secureStore = await getNativeSecureStore();
      await secureStore.setItemAsync(key, value);
      return;
    } catch {
      const storage = await getNativeAsyncStorage();
      await storage.setItem(key, value);
    }
  },
  async removeItem(key: string) {
    try {
      const secureStore = await getNativeSecureStore();
      await secureStore.deleteItemAsync(key);
      return;
    } catch {
      const storage = await getNativeAsyncStorage();
      await storage.removeItem(key);
    }
  }
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabaseClient: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        storage: isBrowser ? browserStorage : nativeStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: isBrowser,
        flowType: "pkce"
      }
    })
  : null;

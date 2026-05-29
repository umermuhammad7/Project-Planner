import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare const process: {
  env: {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
  };
};

const memoryStorage = new Map<string, string>();

const authStorage = {
  getItem(key: string) {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(key);
    }

    return memoryStorage.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, value);
      return;
    }

    memoryStorage.set(key, value);
  },
  removeItem(key: string) {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(key);
      return;
    }

    memoryStorage.delete(key);
  }
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabaseClient: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        storage: authStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    })
  : null;

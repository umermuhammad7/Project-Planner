import AsyncStorage from "@react-native-async-storage/async-storage";

export type HouseholdSetupIntent = "create" | "join";

const storageKey = "homethread.householdSetupIntent";

export async function readHouseholdSetupIntent(): Promise<HouseholdSetupIntent | null> {
  try {
    const value = await AsyncStorage.getItem(storageKey);
    return value === "create" || value === "join" ? value : null;
  } catch {
    return null;
  }
}

export async function writeHouseholdSetupIntent(intent: HouseholdSetupIntent): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey, intent);
  } catch {
    // Non-critical - in-memory state still guides the current session.
  }
}

export async function clearHouseholdSetupIntent(): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey);
  } catch {
    // Ignore storage failures on clear.
  }
}

import AsyncStorage from "@react-native-async-storage/async-storage";

const storageKey = "homethread.dismissedPromoteNudgeMemberIds";

export async function readDismissedPromoteNudgeIds(): Promise<string[]> {
  try {
    const value = await AsyncStorage.getItem(storageKey);
    if (!value) {
      return [];
    }
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export async function dismissPromoteNudge(memberId: string): Promise<void> {
  try {
    const existing = await readDismissedPromoteNudgeIds();
    if (existing.includes(memberId)) {
      return;
    }
    await AsyncStorage.setItem(storageKey, JSON.stringify([...existing, memberId]));
  } catch {
    // Non-critical - worst case the nudge reappears next visit.
  }
}

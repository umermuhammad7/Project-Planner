import { Platform } from "react-native";

export async function copyText(value: string): Promise<{ ok: boolean; message?: string }> {
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, message: "Nothing to copy." };
  }

  if (Platform.OS === "web") {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(trimmed);
        return { ok: true };
      } catch {
        return { ok: false, message: "Could not copy automatically. Select the code and copy manually." };
      }
    }

    return { ok: false, message: "Copy is not available here. Select the code manually." };
  }

  return { ok: false, message: "Long-press the code to copy on this device." };
}

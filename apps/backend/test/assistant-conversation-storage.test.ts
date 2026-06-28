import { beforeEach, describe, expect, it, vi } from "vitest";

const { asyncStorageData, platformOs, asyncStorageMock } = vi.hoisted(() => ({
  asyncStorageData: new Map<string, string>(),
  platformOs: { value: "web" as "web" | "ios" | "android" },
  asyncStorageMock: {
    getItem: vi.fn(async (key: string) => asyncStorageData.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      asyncStorageData.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      asyncStorageData.delete(key);
    })
  }
}));

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return platformOs.value;
    }
  }
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: asyncStorageMock
}));

import {
  ASSISTANT_WELCOME_MESSAGE,
  loadAssistantConversationFromStorage,
  saveAssistantConversationToStorage
} from "../../mobile/src/services/assistantConversationStorage.js";

describe("assistantConversationStorage", () => {
  let webStorage: Map<string, string>;

  beforeEach(() => {
    asyncStorageData.clear();
    webStorage = new Map();
    platformOs.value = "web";
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => webStorage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        webStorage.set(key, value);
      },
      removeItem: (key: string) => {
        webStorage.delete(key);
      },
      clear: () => {
        webStorage.clear();
      },
      get length() {
        return webStorage.size;
      },
      key: () => null
    });
    vi.clearAllMocks();
  });

  it("returns the welcome message when nothing is stored", async () => {
    const messages = await loadAssistantConversationFromStorage("family-1");
    expect(messages).toEqual([ASSISTANT_WELCOME_MESSAGE]);
  });

  it("persists and reloads conversation messages on web", async () => {
    await saveAssistantConversationToStorage("family-1", [
      ASSISTANT_WELCOME_MESSAGE,
      { id: "user-1", role: "user", body: "Add milk" }
    ]);

    const messages = await loadAssistantConversationFromStorage("family-1");
    expect(messages).toHaveLength(2);
    expect(messages[1]?.body).toBe("Add milk");
    expect(asyncStorageMock.setItem).not.toHaveBeenCalled();
  });

  it("uses AsyncStorage on native platforms", async () => {
    platformOs.value = "ios";
    asyncStorageData.set(
      "homethread-assistant-thread:family-2",
      JSON.stringify([{ id: "user-2", role: "user", body: "Plan dinner" }])
    );

    const messages = await loadAssistantConversationFromStorage("family-2");
    expect(asyncStorageMock.getItem).toHaveBeenCalledWith("homethread-assistant-thread:family-2");
    expect(messages[0]?.body).toBe("Plan dinner");
  });
});

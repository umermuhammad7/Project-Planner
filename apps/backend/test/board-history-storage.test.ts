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
  clearBoardHistoryStorage,
  loadBoardHistoryFromStorage,
  saveBoardHistoryToStorage
} from "../../mobile/src/services/boardHistoryStorage.js";

const sampleUpdates = [
  {
    id: "entry-1",
    direction: "outbound" as const,
    author: "HomeThread",
    body: "Added event: Soccer practice",
    createdAt: "Now",
    convertedTo: "event" as const
  }
];

describe("board history storage", () => {
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

  it("persists and reloads household-scoped board history on web", async () => {
    const familyId = "family-board-web";

    await saveBoardHistoryToStorage(familyId, sampleUpdates);
    await expect(loadBoardHistoryFromStorage(familyId)).resolves.toEqual(sampleUpdates);
    await expect(loadBoardHistoryFromStorage("other-family")).resolves.toEqual([]);
    expect(asyncStorageMock.setItem).not.toHaveBeenCalled();
  });

  it("persists and reloads household-scoped board history on native AsyncStorage", async () => {
    platformOs.value = "ios";
    const familyId = "family-board-native";

    await saveBoardHistoryToStorage(familyId, sampleUpdates);

    expect(asyncStorageMock.setItem).toHaveBeenCalledWith(
      `homethread-board-history:${familyId}`,
      JSON.stringify(sampleUpdates)
    );
    expect(webStorage.size).toBe(0);

    await expect(loadBoardHistoryFromStorage(familyId)).resolves.toEqual(sampleUpdates);
    expect(asyncStorageMock.getItem).toHaveBeenCalledWith(`homethread-board-history:${familyId}`);
    await expect(loadBoardHistoryFromStorage("other-family")).resolves.toEqual([]);
  });

  it("clears native board history for a household", async () => {
    platformOs.value = "android";
    const familyId = "family-board-clear";

    await saveBoardHistoryToStorage(familyId, sampleUpdates);
    await clearBoardHistoryStorage(familyId);

    expect(asyncStorageMock.removeItem).toHaveBeenCalledWith(`homethread-board-history:${familyId}`);
    await expect(loadBoardHistoryFromStorage(familyId)).resolves.toEqual([]);
  });
});

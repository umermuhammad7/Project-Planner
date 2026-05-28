import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn()
}));

vi.mock("../../mobile/src/services/api.js", () => ({
  apiRequest: apiRequestMock
}));

vi.mock("../../mobile/src/constants/theme.js", () => ({
  colors: {
    primary: "#3157D5",
    coral: "#F9735B",
    mint: "#2DAA84",
    berry: "#A85576"
  }
}));

import { useHomeThreadStore } from "../../mobile/src/store/useHomeThreadStore.js";

describe("HomeThread mobile store semantics", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    useHomeThreadStore.setState(useHomeThreadStore.getInitialState(), true);
  });

  it("hydrates multi-list backend state while preserving selected list and event assignments", async () => {
    useHomeThreadStore.setState({
      selectedListId: "list-hardware",
      completedChoreIds: { "chore-1": true }
    });

    apiRequestMock.mockImplementation(async (path: string) => {
      switch (path) {
        case "/families/00000000-0000-4000-8000-000000000201":
          return {
            data: {
              family: { id: "family-1", name: "Parker Home" },
              members: [
                {
                  id: "member-parent",
                  userId: "user-parent",
                  displayName: "Mara Parker",
                  color: "#F97316",
                  role: "admin"
                },
                {
                  id: "member-kid",
                  userId: null,
                  displayName: "Luca Parker",
                  color: "#2563EB",
                  role: "child"
                }
              ]
            }
          };
        case "/families/00000000-0000-4000-8000-000000000201/events":
          return {
            data: {
              events: [
                {
                  id: "event-1",
                  title: "Soccer Practice",
                  location: "Field 3",
                  startAt: "2026-05-29T16:00:00.000Z",
                  memberIds: ["member-kid"]
                }
              ]
            }
          };
        case "/families/00000000-0000-4000-8000-000000000201/chores/today":
          return {
            data: {
              chores: [
                {
                  id: "chore-1",
                  title: "Take out trash",
                  dueTime: "18:00:00",
                  assignedTo: "member-kid",
                  starsValue: 2
                }
              ]
            }
          };
        case "/families/00000000-0000-4000-8000-000000000201/lists":
          return {
            data: {
              lists: [
                {
                  id: "list-grocery",
                  title: "Groceries",
                  type: "grocery",
                  items: [
                    {
                      id: "item-milk",
                      content: "Milk",
                      category: "dairy",
                      quantity: null,
                      isChecked: false,
                      checkedBy: null
                    }
                  ]
                },
                {
                  id: "list-hardware",
                  title: "Hardware",
                  type: "todo",
                  items: [
                    {
                      id: "item-bulbs",
                      content: "Light bulbs",
                      category: "household",
                      quantity: null,
                      isChecked: false,
                      checkedBy: null
                    },
                    {
                      id: "item-battery",
                      content: "AA batteries",
                      category: "household",
                      quantity: null,
                      isChecked: true,
                      checkedBy: null
                    }
                  ]
                }
              ]
            }
          };
        default:
          throw new Error(`Unexpected path: ${path}`);
      }
    });

    await useHomeThreadStore.getState().hydrateFromBackend();

    const state = useHomeThreadStore.getState();
    expect(state.syncSource).toBe("api");
    expect(state.familyId).toBe("family-1");
    expect(state.selectedListId).toBe("list-hardware");
    expect(state.shoppingItems.map((item: { title: string }) => item.title)).toEqual(["Light bulbs", "AA batteries"]);
    expect(state.listItemsByListId["list-grocery"]?.map((item: { title: string }) => item.title)).toEqual(["Milk"]);
    expect(state.events[0]?.assignedTo).toEqual(["member-kid"]);
    expect(state.chores[0]?.completed).toBe(true);
    expect(state.syncMessage).toContain("2 lists");
    expect(state.syncMessage).toContain("3 items");
  });

  it("keeps last known api state when refresh fails after sync", async () => {
    useHomeThreadStore.setState({
      syncSource: "api",
      syncMessage: "Previously synced",
      familyName: "Stable Home"
    });

    apiRequestMock.mockResolvedValue({
      error: {
        message: "connect ECONNREFUSED",
        code: "NETWORK_ERROR"
      }
    });

    await useHomeThreadStore.getState().hydrateFromBackend();

    const state = useHomeThreadStore.getState();
    expect(state.syncSource).toBe("api");
    expect(state.familyName).toBe("Stable Home");
    expect(state.syncMessage).toContain("Refresh failed");
    expect(state.syncMessage).toContain("last synced data");
  });

  it("saves a list draft into the currently selected backend list", async () => {
    useHomeThreadStore.setState({
      syncSource: "api",
      familyId: "family-1",
      currentMemberId: "member-parent",
      groceryListId: "list-grocery",
      selectedListId: "list-hardware",
      lists: [
        { id: "list-grocery", title: "Groceries", type: "grocery", icon: "basket" },
        { id: "list-hardware", title: "Hardware", type: "todo", icon: null }
      ],
      listItemsByListId: {
        "list-grocery": [],
        "list-hardware": []
      },
      shoppingItems: []
    });

    apiRequestMock.mockResolvedValue({
      data: {
        item: {
          id: "item-hooks",
          content: "Command hooks",
          category: "household",
          quantity: null,
          isChecked: false,
          checkedBy: null
        }
      }
    });

    await useHomeThreadStore.getState().commitDraft({
      kind: "list",
      title: "Buy command hooks",
      detail: "Shopping list",
      confidence: 0.92,
      rawText: "Buy command hooks"
    });

    const state = useHomeThreadStore.getState();
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/families/family-1/lists/list-hardware/items",
      expect.objectContaining({ method: "POST" })
    );
    expect(state.listItemsByListId["list-hardware"]?.map((item: { title: string }) => item.title)).toEqual(["Command hooks"]);
    expect(state.shoppingItems.map((item: { title: string }) => item.title)).toEqual(["Command hooks"]);
    expect(state.listItemsByListId["list-grocery"]).toEqual([]);
    expect(state.saveMessage).toBe("Saved list item to local database");
  });

  it("creates and selects a grocery list when the family has none yet", async () => {
    useHomeThreadStore.setState({
      syncSource: "api",
      familyId: "family-1",
      currentMemberId: "member-parent",
      groceryListId: null,
      selectedListId: null,
      lists: [],
      listItemsByListId: {},
      shoppingItems: []
    });

    apiRequestMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === "/families/family-1/lists" && options?.method === "POST") {
        return {
          data: {
            list: {
              id: "list-created",
              title: "Groceries",
              type: "grocery",
              icon: "basket"
            }
          }
        };
      }

      if (path === "/families/family-1/lists/list-created/items" && options?.method === "POST") {
        return {
          data: {
            item: {
              id: "item-bread",
              content: "Bread",
              category: "bakery",
              quantity: null,
              isChecked: false,
              checkedBy: null
            }
          }
        };
      }

      throw new Error(`Unexpected request: ${options?.method ?? "GET"} ${path}`);
    });

    const created = await useHomeThreadStore.getState().createShoppingItem({ title: "Bread" });

    const state = useHomeThreadStore.getState();
    expect(created).toBe(true);
    expect(state.groceryListId).toBe("list-created");
    expect(state.selectedListId).toBe("list-created");
    expect(state.lists).toEqual([{ id: "list-created", title: "Groceries", type: "grocery", icon: "basket" }]);
    expect(state.shoppingItems.map((item: { title: string }) => item.title)).toEqual(["Bread"]);
    expect(state.listItemsByListId["list-created"]?.map((item: { title: string }) => item.title)).toEqual(["Bread"]);
  });

  it("creates a new custom list and switches the active view to it", async () => {
    useHomeThreadStore.setState({
      syncSource: "api",
      familyId: "family-1",
      currentMemberId: "member-parent",
      groceryListId: "list-grocery",
      selectedListId: "list-grocery",
      lists: [{ id: "list-grocery", title: "Groceries", type: "grocery", icon: "basket" }],
      listItemsByListId: {
        "list-grocery": [
          {
            id: "item-milk",
            backendListId: "list-grocery",
            title: "Milk",
            category: "Dairy",
            addedBy: "member-parent",
            checked: false
          }
        ]
      },
      shoppingItems: [
        {
          id: "item-milk",
          backendListId: "list-grocery",
          title: "Milk",
          category: "Dairy",
          addedBy: "member-parent",
          checked: false
        }
      ]
    });

    apiRequestMock.mockResolvedValue({
      data: {
        list: {
          id: "list-camping",
          title: "Camping weekend",
          type: "packing",
          icon: "briefcase"
        }
      }
    });

    const created = await useHomeThreadStore.getState().createList({ title: "Camping weekend", type: "packing" });

    const state = useHomeThreadStore.getState();
    expect(created).toBe(true);
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/families/family-1/lists",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "Camping weekend",
          type: "packing",
          icon: "briefcase",
          isShared: true
        })
      })
    );
    expect(state.selectedListId).toBe("list-camping");
    expect(state.shoppingItems).toEqual([]);
    expect(state.lists.map((list) => list.title)).toEqual(["Groceries", "Camping weekend"]);
    expect(state.listItemsByListId["list-camping"]).toEqual([]);
    expect(state.saveMessage).toBe("Created Camping weekend");
  });

  it("clears checked items from the active list after backend confirmation", async () => {
    useHomeThreadStore.setState({
      syncSource: "api",
      familyId: "family-1",
      selectedListId: "list-grocery",
      listItemsByListId: {
        "list-grocery": [
          {
            id: "item-milk",
            backendListId: "list-grocery",
            title: "Milk",
            category: "Dairy",
            addedBy: "member-parent",
            checked: false
          },
          {
            id: "item-eggs",
            backendListId: "list-grocery",
            title: "Eggs",
            category: "Dairy",
            addedBy: "member-parent",
            checked: true
          }
        ]
      },
      shoppingItems: [
        {
          id: "item-milk",
          backendListId: "list-grocery",
          title: "Milk",
          category: "Dairy",
          addedBy: "member-parent",
          checked: false
        },
        {
          id: "item-eggs",
          backendListId: "list-grocery",
          title: "Eggs",
          category: "Dairy",
          addedBy: "member-parent",
          checked: true
        }
      ]
    });

    apiRequestMock.mockResolvedValue({
      data: {
        deletedCount: 1
      }
    });

    await useHomeThreadStore.getState().clearCheckedShoppingItems();

    const state = useHomeThreadStore.getState();
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/families/family-1/lists/list-grocery/clear-checked",
      expect.objectContaining({ method: "POST" })
    );
    expect(state.shoppingItems.map((item) => item.title)).toEqual(["Milk"]);
    expect(state.listItemsByListId["list-grocery"]?.map((item) => item.title)).toEqual(["Milk"]);
    expect(state.saveMessage).toBe("Cleared 1 checked item");
  });
});

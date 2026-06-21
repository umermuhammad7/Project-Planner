import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock, refreshMembershipMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
  refreshMembershipMock: vi.fn(async () => ({ ok: true, familyId: null }))
}));

vi.mock("../../mobile/src/services/api.js", () => ({
  apiRequest: apiRequestMock
}));

vi.mock("../../mobile/src/store/useAuthStore.js", () => ({
  useAuthStore: {
    getState: () => ({
      mode: "dev_token",
      familyId: "00000000-0000-4000-8000-000000000201",
      userId: "user-parent",
      accessToken: "dev-token",
      refreshMembership: refreshMembershipMock
    })
  }
}));

vi.mock("../../mobile/src/services/offlineQueueStorage.js", () => {
  let queue: unknown[] = [];
  return {
    loadOfflineQueueFromStorage: () => queue,
    saveOfflineQueueToStorage: (items: unknown[]) => {
      queue = items;
    },
    clearOfflineQueueStorage: () => {
      queue = [];
    }
  };
});

vi.mock("../../mobile/src/constants/theme.js", () => ({
  colors: {
    primary: "#3157D5",
    coral: "#F9735B",
    mint: "#2DAA84",
    berry: "#A85576"
  }
}));

import { useHomeThreadStore } from "../../mobile/src/store/useHomeThreadStore.js";
import { clearOfflineQueue } from "../../mobile/src/services/offlineQueue.js";

function currentWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);

  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, "0");
  const date = String(monday.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

describe("HomeThread mobile store semantics", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    clearOfflineQueue();
    useHomeThreadStore.setState(useHomeThreadStore.getInitialState(), true);
  });

  it("hydrates multi-list backend state while preserving selected list and event assignments", async () => {
    const weekStart = currentWeekStart();

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
                  role: "admin",
                  starBalance: 3
                },
                {
                  id: "member-kid",
                  userId: null,
                  displayName: "Luca Parker",
                  color: "#2563EB",
                  role: "child",
                  starBalance: 11
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
        case `/families/00000000-0000-4000-8000-000000000201/meals?weekStart=${weekStart}`:
          return {
            data: {
              weekStart,
              items: [
                {
                  id: "meal-1",
                  dayOfWeek: 0,
                  mealType: "dinner",
                  customTitle: "Taco Tuesday prep",
                  notes: "Marinate ahead"
                }
              ]
            }
          };
        case "/families/00000000-0000-4000-8000-000000000201/recipes":
          return {
            data: {
              recipes: [
                {
                  id: "recipe-1",
                  title: "Taco kit",
                  ingredients: [{ name: "tortillas" }, { name: "salsa" }]
                }
              ]
            }
          };
        case "/notifications":
          return {
            data: {
              notifications: []
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
    expect(state.members.find((member) => member.id === "member-kid")?.starBalance).toBe(11);
    expect(state.meals[0]?.title).toBe("Taco Tuesday prep");
    expect(state.chores[0]?.completed).toBe(true);
    expect(state.chores[0]?.dueLabel).toBe("Today at 6:00 PM");
    expect(state.syncMessage).toContain("2 lists");
    expect(state.syncMessage).toContain("2 lists");
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
    expect(state.saveMessage).toBe("List item saved.");
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
    expect(created).toEqual({ ok: true, kind: "saved", message: "List item saved." });
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
    expect(created).toEqual({ ok: true, kind: "saved", message: "Created Camping weekend" });
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
    expect(state.saveMessage).toBe("Cleared 1 checked item from your household list.");
  });

  it("queues create_list_item when backend sync is unavailable", async () => {
    useHomeThreadStore.setState({
      syncSource: "mock",
      familyId: "00000000-0000-4000-8000-000000000201",
      selectedListId: "list-grocery",
      lists: [{ id: "list-grocery", title: "Groceries", type: "grocery", icon: "basket" }],
      listItemsByListId: { "list-grocery": [] },
      shoppingItems: []
    });

    const outcome = await useHomeThreadStore.getState().createShoppingItem({ title: "Bananas" });

    expect(outcome).toEqual({
      ok: true,
      kind: "queued",
      message: expect.stringContaining("queued")
    });
    expect(useHomeThreadStore.getState().offlineQueue).toHaveLength(1);
    expect(useHomeThreadStore.getState().offlineQueue[0]?.type).toBe("create_list_item");
  });

  it("saves a new meal plan item for the active week", async () => {
    useHomeThreadStore.setState({
      syncSource: "api",
      familyId: "family-1",
      mealWeekStart: "2026-05-25",
      meals: [
        {
          id: "meal-1",
          dayOfWeek: 0,
          mealType: "dinner",
          title: "Sheet-pan chicken fajitas",
          notes: "Double peppers"
        }
      ]
    });

    apiRequestMock.mockResolvedValue({
      data: {
        weekStart: "2026-05-25",
        items: [
          {
            id: "meal-1",
            dayOfWeek: 0,
            mealType: "dinner",
            customTitle: "Sheet-pan chicken fajitas",
            notes: "Double peppers"
          },
          {
            id: "meal-2",
            dayOfWeek: 2,
            mealType: "dinner",
            customTitle: "Pasta night",
            notes: null
          }
        ]
      }
    });

    const saved = await useHomeThreadStore.getState().createMeal({
      dayOfWeek: 2,
      mealType: "dinner",
      title: "Pasta night"
    });

    const state = useHomeThreadStore.getState();
    expect(saved).toEqual({ ok: true, kind: "saved", message: "Meal saved." });
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/families/family-1/meals",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          weekStart: "2026-05-25",
          items: [
            {
              dayOfWeek: 0,
              mealType: "dinner",
              customTitle: "Sheet-pan chicken fajitas",
              notes: "Double peppers",
              recipeId: null
            },
            {
              dayOfWeek: 2,
              mealType: "dinner",
              customTitle: "Pasta night",
              notes: null,
              recipeId: null
            }
          ]
        })
      })
    );
    expect(state.meals.map((meal) => meal.title)).toEqual(["Sheet-pan chicken fajitas", "Pasta night"]);
    expect(state.saveMessage).toBe("Meal saved.");
  });

  it("saves a meal plan item linked to a saved recipe", async () => {
    useHomeThreadStore.setState({
      syncSource: "api",
      familyId: "family-1",
      mealWeekStart: "2026-05-25",
      meals: [],
      recipes: [
        {
          id: "recipe-1",
          title: "Taco kit",
          ingredients: [{ name: "tortillas" }, { name: "salsa" }]
        }
      ]
    });

    apiRequestMock.mockResolvedValue({
      data: {
        weekStart: "2026-05-25",
        items: [
          {
            id: "meal-1",
            dayOfWeek: 1,
            mealType: "dinner",
            customTitle: null,
            recipeId: "recipe-1",
            recipeTitle: "Taco kit",
            notes: null
          }
        ]
      }
    });

    const saved = await useHomeThreadStore.getState().createMeal({
      dayOfWeek: 1,
      mealType: "dinner",
      title: "",
      recipeId: "recipe-1"
    });

    const state = useHomeThreadStore.getState();
    expect(saved).toEqual({ ok: true, kind: "saved", message: "Meal saved." });
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/families/family-1/meals",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          weekStart: "2026-05-25",
          items: [
            {
              dayOfWeek: 1,
              mealType: "dinner",
              customTitle: null,
              notes: null,
              recipeId: "recipe-1"
            }
          ]
        })
      })
    );
    expect(state.meals[0]?.title).toBe("Taco kit");
    expect(state.meals[0]?.recipeId).toBe("recipe-1");
    expect(state.saveMessage).toBe("Meal saved.");
  });

  it("removes a meal plan item from the active week", async () => {
    useHomeThreadStore.setState({
      syncSource: "api",
      familyId: "family-1",
      mealWeekStart: "2026-05-25",
      meals: [
        {
          id: "meal-1",
          dayOfWeek: 0,
          mealType: "dinner",
          title: "Sheet-pan chicken fajitas",
          notes: "Double peppers"
        },
        {
          id: "meal-2",
          dayOfWeek: 2,
          mealType: "dinner",
          title: "Pasta night"
        }
      ]
    });

    apiRequestMock.mockResolvedValue({
      data: {
        weekStart: "2026-05-25",
        items: [
          {
            id: "meal-2",
            dayOfWeek: 2,
            mealType: "dinner",
            customTitle: "Pasta night",
            notes: null
          }
        ]
      }
    });

    const outcome = await useHomeThreadStore.getState().removeMeal("meal-1");

    const state = useHomeThreadStore.getState();
    expect(outcome).toEqual({ ok: true, kind: "saved", message: "Updated meal plan" });
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/families/family-1/meals",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          weekStart: "2026-05-25",
          items: [
            {
              dayOfWeek: 2,
              mealType: "dinner",
              customTitle: "Pasta night",
              notes: null,
              recipeId: null
            }
          ]
        })
      })
    );
    expect(state.meals.map((meal) => meal.title)).toEqual(["Pasta night"]);
    expect(state.saveMessage).toBe("Updated meal plan");
  });

  it("adds recipe ingredients to the grocery list through the meal bridge", async () => {
    useHomeThreadStore.setState({
      syncSource: "api",
      familyId: "family-1",
      groceryListId: "list-grocery",
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
      ],
      recipes: [
        {
          id: "recipe-1",
          title: "Taco kit",
          ingredients: [{ name: "tortillas" }, { name: "salsa" }]
        }
      ]
    });

    apiRequestMock.mockResolvedValue({
      data: {
        listId: "list-grocery",
        added: [
          { id: "item-tortillas", content: "tortillas" },
          { id: "item-salsa", content: "salsa" }
        ],
        skipped: []
      }
    });

    const added = await useHomeThreadStore.getState().addMealIngredientsToGrocery({ recipeId: "recipe-1" });
    const state = useHomeThreadStore.getState();

    expect(added).toEqual({ ok: true, kind: "saved", message: "Added 2 ingredients to grocery list" });
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/families/family-1/meals/to-grocery",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          recipeId: "recipe-1",
          listId: "list-grocery"
        })
      })
    );
    expect(state.shoppingItems.map((item) => item.title)).toEqual(["tortillas", "salsa", "Milk"]);
    expect(state.saveMessage).toBe("Added 2 ingredients to grocery list");
  });

  it("adds the active week's meal ingredients to the grocery list", async () => {
    useHomeThreadStore.setState({
      syncSource: "api",
      familyId: "family-1",
      mealWeekStart: "2026-05-25",
      groceryListId: "list-grocery",
      selectedListId: "list-grocery",
      listItemsByListId: {
        "list-grocery": []
      },
      shoppingItems: [],
      meals: [
        {
          id: "meal-1",
          dayOfWeek: 0,
          mealType: "dinner",
          title: "Taco kit",
          recipeId: "recipe-1"
        },
        {
          id: "meal-2",
          dayOfWeek: 2,
          mealType: "dinner",
          title: "Pasta night"
        }
      ],
      recipes: [
        {
          id: "recipe-1",
          title: "Taco kit",
          ingredients: [{ name: "tortillas" }, { name: "salsa" }]
        }
      ]
    });

    apiRequestMock.mockResolvedValue({
      data: {
        listId: "list-grocery",
        weekStart: "2026-05-25",
        mealsProcessed: 2,
        added: [
          { id: "item-tortillas", content: "tortillas" },
          { id: "item-salsa", content: "salsa" },
          { id: "item-pasta", content: "Pasta night" }
        ],
        skipped: []
      }
    });

    const added = await useHomeThreadStore.getState().addWeekMealsToGrocery();
    const state = useHomeThreadStore.getState();

    expect(added).toEqual({ ok: true, kind: "saved", message: "Added 3 ingredients for this week" });
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/families/family-1/meals/week-to-grocery",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          weekStart: "2026-05-25",
          listId: "list-grocery"
        })
      })
    );
    expect(state.shoppingItems.map((item) => item.title)).toEqual(["tortillas", "salsa", "Pasta night"]);
    expect(state.saveMessage).toBe("Added 3 ingredients for this week");
  });

  it("creates a grocery list before bridging recipe ingredients when none exists yet", async () => {
    useHomeThreadStore.setState({
      syncSource: "api",
      familyId: "family-1",
      groceryListId: null,
      selectedListId: null,
      lists: [],
      listItemsByListId: {},
      shoppingItems: [],
      recipes: [
        {
          id: "recipe-1",
          title: "Taco kit",
          ingredients: [{ name: "tortillas" }, { name: "salsa" }]
        }
      ]
    });

    apiRequestMock.mockImplementation(async (path: string, options?: { method?: string; body?: string }) => {
      if (path === "/families/family-1/lists" && options?.method === "POST") {
        return {
          data: {
            list: {
              id: "list-grocery-new",
              title: "Groceries",
              type: "grocery",
              icon: "basket"
            }
          }
        };
      }

      if (path === "/families/family-1/meals/to-grocery") {
        return {
          data: {
            listId: "list-grocery-new",
            added: [
              { id: "item-tortillas", content: "tortillas" },
              { id: "item-salsa", content: "salsa" }
            ],
            skipped: []
          }
        };
      }

      return { data: null, error: { message: `Unexpected path: ${path}` } };
    });

    const added = await useHomeThreadStore.getState().addMealIngredientsToGrocery({ recipeId: "recipe-1" });
    const state = useHomeThreadStore.getState();

    expect(added).toEqual({ ok: true, kind: "saved", message: "Added 2 ingredients to grocery list" });
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/families/family-1/lists",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "Groceries",
          type: "grocery",
          icon: "basket",
          isShared: true
        })
      })
    );
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/families/family-1/meals/to-grocery",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          recipeId: "recipe-1",
          listId: "list-grocery-new"
        })
      })
    );
    expect(state.groceryListId).toBe("list-grocery-new");
    expect(state.lists).toEqual([
      {
        id: "list-grocery-new",
        title: "Groceries",
        type: "grocery",
        icon: "basket"
      }
    ]);
    expect(state.shoppingItems.map((item) => item.title)).toEqual(["tortillas", "salsa"]);
  });

  it("queues create_event when backend sync is unavailable instead of pretending success", async () => {
    useHomeThreadStore.setState({
      syncSource: "mock",
      familyId: "00000000-0000-4000-8000-000000000201"
    });

    const saved = await useHomeThreadStore.getState().createEvent({
      title: "Queued soccer practice",
      location: "Field 3"
    });

    expect(saved).toEqual({
      ok: true,
      kind: "queued",
      message: expect.stringContaining("queued")
    });
    const state = useHomeThreadStore.getState();
    expect(state.offlineQueue).toHaveLength(1);
    expect(state.offlineQueue[0]?.type).toBe("create_event");
    expect(state.offlineQueue[0]?.summary).toContain("Queued soccer practice");
    expect(state.saveMessage).toContain("queued");
  });

  it("updates the family name through the backend patch route", async () => {
    useHomeThreadStore.setState({
      syncSource: "api",
      familyId: "family-1",
      familyName: "Old Name",
      isFamilyAdmin: true
    });

    apiRequestMock.mockResolvedValueOnce({
      data: {
        family: {
          name: "New Household Name"
        }
      }
    });

    const result = await useHomeThreadStore.getState().updateFamilyName("New Household Name");
    expect(result.ok).toBe(true);
    expect(apiRequestMock).toHaveBeenCalledWith("/families/family-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "New Household Name" })
    });
    expect(useHomeThreadStore.getState().familyName).toBe("New Household Name");
  });

  it("credits the assigned kid when a chore is completed", async () => {
    useHomeThreadStore.setState({
      syncSource: "api",
      familyId: "family-1",
      currentMemberId: "member-parent",
      members: [
        { id: "member-parent", name: "Mara", initials: "M", color: "#000", role: "parent", starBalance: 0 },
        { id: "member-kid", name: "Noah", initials: "N", color: "#2563EB", role: "kid", starBalance: 4 }
      ],
      chores: [
        {
          id: "chore-laundry",
          title: "Laundry",
          dueLabel: "Due 5:30 PM",
          assignedTo: "member-kid",
          stars: 2,
          completed: false
        }
      ],
      completedChoreIds: {},
      textUpdates: []
    });

    apiRequestMock.mockResolvedValueOnce({
      data: {
        completion: { id: "completion-1" },
        reward: { id: "reward-1", stars: 2 }
      }
    });

    await useHomeThreadStore.getState().completeChore("chore-laundry");

    const state = useHomeThreadStore.getState();
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/families/family-1/chores/chore-laundry/complete",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("\"memberId\":\"member-kid\"")
      })
    );
    expect(state.members.find((member) => member.id === "member-kid")?.starBalance).toBe(6);
    expect(state.saveMessage).toContain("Noah earned 2 stars");
  });

  it("clears Parker mock household data when first signed-in hydrate fails", async () => {
    const initial = useHomeThreadStore.getInitialState();
    expect(initial.familyName).toBe("The Parker Home");
    expect(initial.members.length).toBeGreaterThan(0);
    expect(initial.events.length).toBeGreaterThan(0);

    apiRequestMock.mockResolvedValue({
      error: {
        message: "connect ECONNREFUSED",
        code: "NETWORK_ERROR"
      }
    });

    await useHomeThreadStore.getState().hydrateFromBackend();

    const state = useHomeThreadStore.getState();
    expect(state.familyName).toBe("HomeThread");
    expect(state.members).toEqual([]);
    expect(state.events).toEqual([]);
    expect(state.chores).toEqual([]);
    expect(state.familyId).toBe("00000000-0000-4000-8000-000000000201");
    expect(state.syncSource).toBe("mock");
    expect(state.syncMessage).toContain("connect ECONNREFUSED");
  });

  it("returns local-only outcome when commitDraft cannot reach the backend", async () => {
    useHomeThreadStore.setState({
      syncSource: "mock",
      familyId: "00000000-0000-4000-8000-000000000201",
      events: [],
      textUpdates: []
    });

    const outcome = await useHomeThreadStore.getState().commitDraft({
      kind: "event",
      title: "Soccer practice",
      detail: "Saturday at 10 AM",
      confidence: 0.9,
      rawText: "Soccer practice Saturday at 10 AM"
    });

    expect(outcome).toEqual({
      ok: true,
      kind: "local",
      message: "Saved on this device."
    });
    expect(useHomeThreadStore.getState().events.some((event) => event.title === "Soccer practice")).toBe(true);
    expect(apiRequestMock).not.toHaveBeenCalled();
  });

  it("clears household state after leaving a family", async () => {
    useHomeThreadStore.setState({
      syncSource: "api",
      familyId: "family-1",
      familyName: "Parker Home",
      members: [{ id: "member-1", name: "Mara", initials: "M", color: "#000", role: "parent", starBalance: 0 }],
      events: [{ id: "event-1", title: "Soccer", time: "4:00 PM", dateLabel: "Fri", assignedTo: [], source: "manual" }]
    });

    apiRequestMock.mockResolvedValueOnce({
      data: { left: true }
    });

    const result = await useHomeThreadStore.getState().leaveFamily();
    expect(result.ok).toBe(true);
    expect(result.needsFamilySetup).toBe(true);
    expect(refreshMembershipMock).toHaveBeenCalled();
    const state = useHomeThreadStore.getState();
    expect(state.familyId).toBeNull();
    expect(state.members).toEqual([]);
    expect(state.events).toEqual([]);
    expect(state.syncMessage).toContain("Join or create a family");
  });
});

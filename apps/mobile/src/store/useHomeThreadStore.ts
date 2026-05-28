import { format } from "date-fns";
import { create } from "zustand";

import {
  chores as initialChores,
  mealPlanItems as initialMealPlanItems,
  members as initialMembers,
  planEvents as initialEvents,
  shoppingItems as initialShopping,
  textUpdates as initialTexts
} from "../data/mockFamily";
import { apiRequest } from "../services/api";
import {
  AssistantDraft,
  Chore,
  FamilyList,
  FamilyMember,
  MealPlanItem,
  PlanEvent,
  ShoppingItem,
  SyncSource,
  TextUpdate
} from "../types";
import { createDigest, parseFamilyText } from "../utils/textParser";

const defaultFamilyId = "00000000-0000-4000-8000-000000000201";
const mockGroceryListId = "mock-grocery-list";
const weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const initialMockLists: FamilyList[] = [{ id: mockGroceryListId, title: "Groceries", type: "grocery", icon: "basket" }];
const initialMockListItemsByListId: Record<string, ShoppingItem[]> = {
  [mockGroceryListId]: initialShopping.map((item) => ({ ...item, backendListId: mockGroceryListId }))
};

type HomeThreadState = {
  familyId: string | null;
  currentMemberId: string | null;
  groceryListId: string | null;
  lists: FamilyList[];
  selectedListId: string | null;
  listItemsByListId: Record<string, ShoppingItem[]>;
  familyName: string;
  members: FamilyMember[];
  events: PlanEvent[];
  mealWeekStart: string;
  meals: MealPlanItem[];
  chores: Chore[];
  completedChoreIds: Record<string, true>;
  shoppingItems: ShoppingItem[];
  textUpdates: TextUpdate[];
  syncSource: SyncSource;
  syncMessage: string;
  isHydrating: boolean;
  isSaving: boolean;
  saveMessage: string;
  hydrateFromBackend: () => Promise<void>;
  refreshFromBackend: () => Promise<void>;
  createEvent: (input: { title: string; location?: string; startTime?: string; memberIds?: string[] }) => Promise<boolean>;
  createChore: (input: { title: string; dueTime?: string; assignedTo?: string | null; starsValue?: number }) => Promise<boolean>;
  completeChore: (id: string) => Promise<void>;
  toggleChore: (id: string) => void;
  toggleShoppingItem: (id: string) => Promise<void>;
  clearCheckedShoppingItems: () => Promise<void>;
  selectList: (listId: string) => void;
  createList: (input: { title: string; type: FamilyList["type"] }) => Promise<boolean>;
  createShoppingItem: (input: { title: string; category?: string | null }) => Promise<boolean>;
  createMeal: (input: { dayOfWeek: number; mealType: MealPlanItem["mealType"]; title: string; notes?: string }) => Promise<boolean>;
  removeMeal: (id: string) => Promise<void>;
  importText: (body: string) => AssistantDraft;
  commitDraft: (draft: AssistantDraft) => Promise<void>;
  sendDigestToThread: () => string;
};

export const useHomeThreadStore = create<HomeThreadState>((set, get) => ({
  familyId: defaultFamilyId,
  currentMemberId: null,
  groceryListId: mockGroceryListId,
  lists: initialMockLists,
  selectedListId: mockGroceryListId,
  listItemsByListId: initialMockListItemsByListId,
  familyName: "The Parker Home",
  members: initialMembers,
  events: initialEvents,
  mealWeekStart: "2026-05-25",
  meals: initialMealPlanItems,
  chores: initialChores,
  completedChoreIds: {},
  shoppingItems: initialMockListItemsByListId[mockGroceryListId] ?? [],
  textUpdates: initialTexts,
  syncSource: "mock",
  syncMessage: "Using local prototype data",
  isHydrating: false,
  isSaving: false,
  saveMessage: "Quick add is ready",
  hydrateFromBackend: async () => {
    set({
      isHydrating: true,
      syncMessage: "Checking local HomeThread backend..."
    });

    const [familyResult, eventsResult, choresResult, listsResult, mealsResult] = await Promise.all([
      apiRequest<BackendFamilyResponse>(`/families/${defaultFamilyId}`),
      apiRequest<BackendEventsResponse>(`/families/${defaultFamilyId}/events`),
      apiRequest<BackendChoresResponse>(`/families/${defaultFamilyId}/chores/today`),
      apiRequest<BackendListsResponse>(`/families/${defaultFamilyId}/lists`),
      apiRequest<BackendMealsResponse>(`/families/${defaultFamilyId}/meals?weekStart=${currentWeekStart()}`)
    ]);

    if (!familyResult.data || !eventsResult.data || !choresResult.data || !listsResult.data || !mealsResult.data) {
      const previous = get();
      const failureMessage =
        familyResult.error?.message ??
        eventsResult.error?.message ??
        choresResult.error?.message ??
        listsResult.error?.message ??
        mealsResult.error?.message ??
        "Refresh failed";

      set({
        isHydrating: false,
        syncSource: previous.syncSource === "api" ? "api" : "mock",
        syncMessage:
          previous.syncSource === "api"
            ? `Refresh failed — showing last synced data (${failureMessage})`
            : failureMessage || "Falling back to mock data"
      });
      return;
    }

    const currentMember = familyResult.data.members.find((member) => member.userId) ?? familyResult.data.members[0] ?? null;
    const memberId = currentMember?.id ?? "family";
    const backendLists = listsResult.data.lists;
    const groceryList = backendLists.find((list) => list.type === "grocery") ?? backendLists[0] ?? null;
    const listItemsByListId = buildListItemsByListId(backendLists, memberId);
    const previous = get();
    const selectedListId =
      previous.selectedListId && listItemsByListId[previous.selectedListId]
        ? previous.selectedListId
        : groceryList?.id ?? backendLists[0]?.id ?? null;
    const totalListItems = Object.values(listItemsByListId).reduce((sum, items) => sum + items.length, 0);
    const completedChoreIds = get().completedChoreIds;
    const hydratedChores = choresResult.data.chores
      .map(mapChore)
      .map((chore) => (completedChoreIds[chore.id] ? { ...chore, completed: true } : chore));

    set({
      familyId: familyResult.data.family.id,
      currentMemberId: currentMember?.id ?? null,
      groceryListId: groceryList?.id ?? null,
      lists: backendLists.map(mapList),
      selectedListId,
      listItemsByListId,
      familyName: familyResult.data.family.name,
      members: familyResult.data.members.map(mapMember),
      events: eventsResult.data.events.map((event) => mapEvent(event, event.memberIds ?? [])),
      mealWeekStart: mealsResult.data.weekStart,
      meals: mealsResult.data.items.map(mapMeal),
      chores: hydratedChores,
      shoppingItems: selectedListId ? (listItemsByListId[selectedListId] ?? []) : [],
      syncSource: "api",
      syncMessage: `Loaded ${eventsResult.data.events.length} plans, ${mealsResult.data.items.length} meals, ${choresResult.data.chores.length} chores, ${backendLists.length} lists (${totalListItems} items) from local database`,
      isHydrating: false
    });
  },
  refreshFromBackend: async () => {
    await get().hydrateFromBackend();
  },
  createEvent: async ({ title, location, startTime, memberIds: rawMemberIds }) => {
    const state = get();
    if (state.syncSource !== "api" || !state.familyId) {
      set({
        saveMessage: "Backend sync is unavailable — event was not created",
      });
      return false;
    }

    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      set({ saveMessage: "Event title is required" });
      return false;
    }

    const trimmedTime = startTime?.trim() ?? "";
    const startAt = trimmedTime ? inferStartDateTime(trimmedTime) : defaultEventStartAt();
    if (trimmedTime && !startAt) {
      set({ saveMessage: 'Start time must be blank or like "18:00" (24h)' });
      return false;
    }

    const memberIds = dedupeMemberIds(rawMemberIds);

    set({ isSaving: true, saveMessage: "Creating event..." });

    const endAt = new Date(startAt!.getTime() + 60 * 60 * 1000);
    const result = await apiRequest<{ event: BackendEventRecord }>(`/families/${state.familyId}/events`, {
      method: "POST",
      body: JSON.stringify({
        title: normalizedTitle,
        description: null,
        location: location?.trim() ? location.trim() : null,
        startAt: startAt!.toISOString(),
        endAt: endAt.toISOString(),
        allDay: false,
        memberIds
      })
    });

    if (!result.data) {
      set({ isSaving: false, saveMessage: result.error?.message ?? "Failed to create event" });
      return false;
    }

    set((current) => ({
      events: [mapEvent(result.data!.event, memberIds, "manual"), ...current.events],
      textUpdates: [
        makeActivityUpdate({
          author: "HomeThread",
          body: `Added event: ${normalizedTitle}`,
          convertedTo: "event"
        }),
        ...current.textUpdates
      ],
      isSaving: false,
      saveMessage: "Saved event to local database"
    }));

    return true;
  },
  createChore: async ({ title, dueTime, assignedTo, starsValue }) => {
    const state = get();
    if (state.syncSource !== "api" || !state.familyId) {
      set({
        saveMessage: "Backend sync is unavailable — chore was not created",
      });
      return false;
    }

    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      set({ saveMessage: "Chore title is required" });
      return false;
    }

    const normalizedDueTime = normalizeDueTime(dueTime);
    if (dueTime?.trim() && normalizedDueTime === null) {
      set({ saveMessage: 'Due time must be like "18:00" (24h)' });
      return false;
    }

    set({ isSaving: true, saveMessage: "Creating chore..." });

    const fallbackAssignee =
      state.members.find((member) => member.role === "kid")?.id ?? state.currentMemberId;

    const result = await apiRequest<{ chore: BackendChoreRecord }>(`/families/${state.familyId}/chores`, {
      method: "POST",
      body: JSON.stringify({
        title: normalizedTitle,
        description: null,
        icon: null,
        starsValue: starsValue ?? 2,
        assignedTo: assignedTo ?? fallbackAssignee ?? null,
        recurrenceRule: null,
        dueTime: normalizedDueTime,
        isActive: true
      })
    });

    if (!result.data) {
      set({ isSaving: false, saveMessage: result.error?.message ?? "Failed to create chore" });
      return false;
    }

    set((current) => ({
      chores: [mapChore(result.data!.chore), ...current.chores],
      textUpdates: [
        makeActivityUpdate({
          author: "HomeThread",
          body: `Added chore: ${normalizedTitle}`,
          convertedTo: "chore"
        }),
        ...current.textUpdates
      ],
      isSaving: false,
      saveMessage: "Saved chore to local database"
    }));

    return true;
  },
  completeChore: async (id) => {
    const current = get();
    const target = current.chores.find((chore) => chore.id === id);
    if (!target) return;

    // If already completed (or we're reopening), we have no backend "uncomplete" route yet.
    if (target.completed) {
      set({ saveMessage: "Reopen is not available yet" });
      return;
    }

    // Optimistic UI completion.
    set((state) => ({
      chores: state.chores.map((chore) => (chore.id === id ? { ...chore, completed: true } : chore)),
      completedChoreIds: { ...state.completedChoreIds, [id]: true }
    }));

    if (current.syncSource !== "api" || !current.familyId) {
      set({ saveMessage: "Backend sync is unavailable — chore marked complete locally only" });
      return;
    }

    const memberId = current.currentMemberId ?? current.members[0]?.id ?? null;
    if (!memberId) {
      // Revert: we can't claim a completion without an actor id.
      set((state) => ({
        chores: state.chores.map((chore) => (chore.id === id ? { ...chore, completed: false } : chore)),
        completedChoreIds: Object.fromEntries(Object.entries(state.completedChoreIds).filter(([key]) => key !== id)),
        saveMessage: "Missing family member id — completion not recorded"
      }));
      return;
    }

    set({ isSaving: true, saveMessage: `Completing ${target.title}...` });

    const result = await apiRequest<{ completion: unknown; reward: unknown }>(
      `/families/${current.familyId}/chores/${id}/complete`,
      {
        method: "POST",
        body: JSON.stringify({
          memberId,
          dueDate: formatISODate(new Date()),
          notes: null,
          photoUrl: null
        })
      }
    );

    if (!result.data) {
      // Revert optimistic completion on failure.
      set((state) => ({
        chores: state.chores.map((chore) => (chore.id === id ? { ...chore, completed: false } : chore)),
        completedChoreIds: Object.fromEntries(Object.entries(state.completedChoreIds).filter(([key]) => key !== id)),
        isSaving: false,
        saveMessage: result.error?.message ?? "Failed to record completion"
      }));
      return;
    }

    // Success: keep the local completed state. Do not fake reward balance updates here.
    const actorName = resolveMemberName(current.members, memberId) ?? "HomeThread";
    set({
      isSaving: false,
      saveMessage: `${target.title} completed`
    });

    set((state) => ({
      textUpdates: [
        makeActivityUpdate({
          author: actorName,
          body: `Completed chore: ${target.title}`
        }),
        ...state.textUpdates
      ]
    }));
  },
  toggleChore: (id) => {
    set((state) => ({
      chores: state.chores.map((chore) =>
        chore.id === id ? { ...chore, completed: !chore.completed } : chore
      )
    }));
  },
  selectList: (listId) => {
    const state = get();
    set({
      selectedListId: listId,
      shoppingItems: state.listItemsByListId[listId] ?? []
    });
  },
  createList: async ({ title, type }) => {
    const trimmed = title.trim();
    if (!trimmed) {
      set({ saveMessage: "List name is required" });
      return false;
    }

    const state = get();
    if (state.syncSource !== "api" || !state.familyId) {
      set({ saveMessage: "Backend sync is unavailable â€” list was not created" });
      return false;
    }

    set({ isSaving: true, saveMessage: "Creating list..." });

    const result = await apiRequest<{ list: Omit<BackendListRecord, "items"> }>(`/families/${state.familyId}/lists`, {
      method: "POST",
      body: JSON.stringify({
        title: trimmed,
        type,
        icon: iconForListType(type),
        isShared: true
      })
    });

    if (!result.data?.list) {
      set({ isSaving: false, saveMessage: result.error?.message ?? "Failed to create list" });
      return false;
    }

    const createdList = mapList(result.data.list);
    set((current) => ({
      lists: [...current.lists, createdList],
      selectedListId: createdList.id,
      listItemsByListId: replaceListItems(current.listItemsByListId, createdList.id, []),
      shoppingItems: [],
      textUpdates: [
        makeActivityUpdate({
          author: "HomeThread",
          body: `Created list: ${trimmed}`,
          convertedTo: "list"
        }),
        ...current.textUpdates
      ],
      isSaving: false,
      saveMessage: `Created ${trimmed}`
    }));

    return true;
  },
  toggleShoppingItem: async (id) => {
    const target = get().shoppingItems.find((item) => item.id === id);
    if (!target) {
      return;
    }

    const nextChecked = !target.checked;

    const listId = target.backendListId ?? get().selectedListId;
    set((state) => {
      const nextShoppingItems = state.shoppingItems.map((item) =>
        item.id === id ? { ...item, checked: nextChecked } : item
      );
      return {
        shoppingItems: nextShoppingItems,
        listItemsByListId: listId
          ? replaceListItems(state.listItemsByListId, listId, nextShoppingItems)
          : state.listItemsByListId
      };
    });

    const state = get();
    if (state.syncSource !== "api" || !state.familyId || !target.backendListId) {
      return;
    }

    set({
      isSaving: true,
      saveMessage: `${nextChecked ? "Checking off" : "Reopening"} ${target.title}...`
    });

    const result = await apiRequest<{ item: BackendListItemRecord }>(
      `/families/${state.familyId}/lists/${target.backendListId}/items/${target.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          isChecked: nextChecked
        })
      }
    );

    if (!result.data) {
      set((current) => {
        const revertedItems = current.shoppingItems.map((item) =>
          item.id === id ? { ...item, checked: target.checked } : item
        );
        return {
          shoppingItems: revertedItems,
          listItemsByListId: listId
            ? replaceListItems(current.listItemsByListId, listId, revertedItems)
            : current.listItemsByListId,
          isSaving: false,
          saveMessage: "List sync fell back to local mode for this change"
        };
      });
      return;
    }

    const updatedItem = result.data.item;
    const fallbackMemberId = state.currentMemberId ?? state.members[0]?.id ?? "family";
    set((current) => {
      const nextShoppingItems = current.shoppingItems.map((item) =>
        item.id === id ? mapShoppingItem(updatedItem, target.backendListId!, fallbackMemberId) : item
      );
      return {
        shoppingItems: nextShoppingItems,
        listItemsByListId: replaceListItems(current.listItemsByListId, target.backendListId!, nextShoppingItems),
        textUpdates: [
          makeActivityUpdate({
            author: resolveMemberName(state.members, state.currentMemberId) ?? "HomeThread",
            body: `${nextChecked ? "Checked off" : "Reopened"} ${target.title}`
          }),
          ...current.textUpdates
        ],
        isSaving: false,
        saveMessage: `${target.title} updated`
      };
    });
  },
  clearCheckedShoppingItems: async () => {
    const state = get();
    const listId = state.selectedListId ?? null;
    const checkedItems = state.shoppingItems.filter((item) => item.checked);
    if (!listId || checkedItems.length === 0) {
      return;
    }

    const nextShoppingItems = state.shoppingItems.filter((item) => !item.checked);
    set((current) => ({
      shoppingItems: nextShoppingItems,
      listItemsByListId: replaceListItems(current.listItemsByListId, listId, nextShoppingItems)
    }));

    if (state.syncSource !== "api" || !state.familyId) {
      set({ saveMessage: "Cleared checked items locally" });
      return;
    }

    set({ isSaving: true, saveMessage: "Clearing checked items..." });

    const result = await apiRequest<{ deletedCount: number }>(
      `/families/${state.familyId}/lists/${listId}/clear-checked`,
      {
        method: "POST",
        body: JSON.stringify({})
      }
    );

    if (!result.data) {
      set((current) => ({
        shoppingItems: state.shoppingItems,
        listItemsByListId: replaceListItems(current.listItemsByListId, listId, state.shoppingItems),
        isSaving: false,
        saveMessage: result.error?.message ?? "Failed to clear checked items"
      }));
      return;
    }

    set((current) => ({
      textUpdates: [
        makeActivityUpdate({
          author: "HomeThread",
          body: `Cleared ${checkedItems.length} checked item${checkedItems.length === 1 ? "" : "s"}`
        }),
        ...current.textUpdates
      ],
      isSaving: false,
      saveMessage: `Cleared ${checkedItems.length} checked item${checkedItems.length === 1 ? "" : "s"}`
    }));
  },
  createShoppingItem: async ({ title, category }) => {
    const trimmed = title.trim();
    if (!trimmed) {
      set({ saveMessage: "Item name is required" });
      return false;
    }

    const state = get();
    if (state.syncSource !== "api" || !state.familyId) {
      set({ saveMessage: "Backend sync is unavailable — item was not added" });
      return false;
    }

    set({ isSaving: true, saveMessage: "Adding item..." });

    const ensuredList = await ensureActiveListId(state);
    const listId = ensuredList?.id ?? null;
    if (!listId) {
      set({ isSaving: false, saveMessage: "Unable to resolve list — item was not added" });
      return false;
    }

    const result = await apiRequest<{ item: BackendListItemRecord }>(
      `/families/${state.familyId}/lists/${listId}/items`,
      {
        method: "POST",
        body: JSON.stringify({
          content: trimmed,
          category: category ?? inferListCategory(trimmed)
        })
      }
    );

    if (!result.data) {
      set({ isSaving: false, saveMessage: result.error?.message ?? "Failed to add item" });
      return false;
    }

    const fallbackMemberId = state.currentMemberId ?? state.members[0]?.id ?? "family";
    const mappedItem = mapShoppingItem(result.data!.item, listId, fallbackMemberId);
    set((current) => {
      const nextListItems = [mappedItem, ...(current.listItemsByListId[listId] ?? [])];
      const nextSelectedListId = current.selectedListId ?? listId;
      const nextLists =
        ensuredList?.createdList && !current.lists.some((list) => list.id === ensuredList.createdList!.id)
          ? [...current.lists, ensuredList.createdList]
          : current.lists;
      return {
        groceryListId: current.groceryListId ?? (current.lists.find((list) => list.type === "grocery")?.id ?? listId),
        lists: nextLists,
        selectedListId: nextSelectedListId,
        listItemsByListId: replaceListItems(current.listItemsByListId, listId, nextListItems),
        shoppingItems: nextSelectedListId === listId ? nextListItems : current.shoppingItems,
        textUpdates: [
          makeActivityUpdate({
            author: "HomeThread",
            body: `Added list item: ${trimmed}`,
            convertedTo: "list"
          }),
          ...current.textUpdates
        ],
        isSaving: false,
        saveMessage: "Saved list item to local database"
      };
    });

    return true;
  },
  createMeal: async ({ dayOfWeek, mealType, title, notes }) => {
    const state = get();
    const trimmed = title.trim();
    if (!trimmed) {
      set({ saveMessage: "Meal title is required" });
      return false;
    }

    const nextMeals = [
      ...state.meals,
      {
        id: `temp-meal-${Date.now()}`,
        dayOfWeek,
        mealType,
        title: trimmed,
        notes: notes?.trim() || undefined
      }
    ];

    if (state.syncSource !== "api" || !state.familyId) {
      set({
        meals: nextMeals,
        saveMessage: "Saved meal locally in prototype mode"
      });
      return true;
    }

    set({ isSaving: true, saveMessage: "Saving meal..." });

    const result = await apiRequest<BackendMealsResponse>(`/families/${state.familyId}/meals`, {
      method: "POST",
      body: JSON.stringify({
        weekStart: state.mealWeekStart,
        items: nextMeals.map((meal) => ({
          dayOfWeek: meal.dayOfWeek,
          mealType: meal.mealType,
          customTitle: meal.title,
          notes: meal.notes ?? null,
          recipeId: null
        }))
      })
    });

    if (!result.data) {
      set({ isSaving: false, saveMessage: result.error?.message ?? "Failed to save meal" });
      return false;
    }

    set((current) => ({
      mealWeekStart: result.data!.weekStart,
      meals: result.data!.items.map(mapMeal),
      textUpdates: [
        makeActivityUpdate({
          author: "HomeThread",
          body: `Added meal: ${trimmed}`,
          convertedTo: "meal"
        }),
        ...current.textUpdates
      ],
      isSaving: false,
      saveMessage: "Saved meal plan to local database"
    }));

    return true;
  },
  removeMeal: async (id) => {
    const state = get();
    const nextMeals = state.meals.filter((meal) => meal.id !== id);
    if (nextMeals.length === state.meals.length) {
      return;
    }

    if (state.syncSource !== "api" || !state.familyId) {
      set({
        meals: nextMeals,
        saveMessage: "Removed meal locally in prototype mode"
      });
      return;
    }

    set({ isSaving: true, saveMessage: "Removing meal..." });

    const result = await apiRequest<BackendMealsResponse>(`/families/${state.familyId}/meals`, {
      method: "POST",
      body: JSON.stringify({
        weekStart: state.mealWeekStart,
        items: nextMeals.map((meal) => ({
          dayOfWeek: meal.dayOfWeek,
          mealType: meal.mealType,
          customTitle: meal.title,
          notes: meal.notes ?? null,
          recipeId: null
        }))
      })
    });

    if (!result.data) {
      set({ isSaving: false, saveMessage: result.error?.message ?? "Failed to remove meal" });
      return;
    }

    set((current) => ({
      meals: result.data!.items.map(mapMeal),
      textUpdates: [
        makeActivityUpdate({
          author: "HomeThread",
          body: "Updated the meal plan",
          convertedTo: "meal"
        }),
        ...current.textUpdates
      ],
      isSaving: false,
      saveMessage: "Updated meal plan"
    }));
  },
  importText: (body) => {
    const draft = parseFamilyText(body);
    set((state) => ({
      textUpdates: [
        {
          id: `text-${Date.now()}`,
          direction: "inbound",
          author: "Pasted text",
          body,
          createdAt: "Now",
          convertedTo: draft.kind
        },
        ...state.textUpdates
      ]
    }));
    return draft;
  },
  commitDraft: async (draft) => {
    set({
      isSaving: true,
      saveMessage: `Saving ${draft.kind}...`
    });

    const state = get();
    const persisted = state.syncSource === "api" && state.familyId ? await persistDraftToApi(draft, state) : null;

    if (persisted) {
      set((current) => applyPersistedDraft(current, persisted, draft.kind));
      return;
    }

    set((current) => ({
      ...applyLocalDraft(current, draft),
      isSaving: false,
      saveMessage:
        current.syncSource === "api"
          ? "Saved locally while backend sync was unavailable"
          : "Saved locally in prototype mode"
    }));
  },
  sendDigestToThread: () => {
    const state = get();
    const digest = createDigest({
      events: state.events,
      chores: state.chores,
      items: flattenListItems(state.listItemsByListId, state.shoppingItems)
    });

    set((current) => ({
      textUpdates: [
        {
          id: `digest-${Date.now()}`,
          direction: "outbound",
          author: "HomeThread",
          body: digest,
          createdAt: "Now"
        },
        ...current.textUpdates
      ]
    }));

    return digest;
  }
}));

type BackendFamilyResponse = {
  family: {
    id: string;
    name: string;
  };
  members: BackendMemberRecord[];
};

type BackendMemberRecord = {
  id: string;
  userId: string | null;
  displayName: string;
  color: string;
  role: "admin" | "member" | "child";
};

type BackendEventRecord = {
  id: string;
  title: string;
  location: string | null;
  startAt: string;
  memberIds: string[];
};

type BackendEventsResponse = {
  events: BackendEventRecord[];
};

type BackendChoreRecord = {
  id: string;
  title: string;
  dueTime: string | null;
  assignedTo: string | null;
  starsValue: number;
};

type BackendChoresResponse = {
  chores: BackendChoreRecord[];
};

type BackendListItemRecord = {
  id: string;
  content: string;
  category: string | null;
  quantity: string | null;
  isChecked: boolean;
  checkedBy: string | null;
};

type BackendListRecord = {
  id: string;
  title: string;
  type: string;
  icon?: string | null;
  items?: BackendListItemRecord[];
};

type BackendListsResponse = {
  lists: BackendListRecord[];
};

type BackendMealRecord = {
  id: string;
  dayOfWeek: number;
  mealType: MealPlanItem["mealType"];
  customTitle: string | null;
  notes: string | null;
};

type BackendMealsResponse = {
  weekStart: string;
  items: BackendMealRecord[];
};

type PersistedDraft = {
  event?: PlanEvent;
  chore?: Chore;
  shoppingItem?: ShoppingItem;
  groceryListId?: string;
  createdList?: FamilyList;
};

async function persistDraftToApi(draft: AssistantDraft, state: HomeThreadState): Promise<PersistedDraft | null> {
  if (!state.familyId) {
    return null;
  }

  if (draft.kind === "event") {
    const window = inferEventWindow(draft);
    const memberIds = findMemberIdsInText(draft.rawText, state.members);
    const result = await apiRequest<{ event: BackendEventRecord }>(`/families/${state.familyId}/events`, {
      method: "POST",
      body: JSON.stringify({
        title: draft.title,
        description: draft.rawText,
        location: inferLocation(draft.rawText),
        startAt: window.startAt.toISOString(),
        endAt: window.endAt.toISOString(),
        allDay: false,
        memberIds
      })
    });

    if (!result.data) {
      return null;
    }

    return {
      event: mapEvent(result.data.event, memberIds, "assistant")
    };
  }

  if (draft.kind === "chore") {
    const memberIds = findMemberIdsInText(draft.rawText, state.members);
    const assignedTo = memberIds[0] ?? state.members.find((member) => member.role === "kid")?.id ?? state.currentMemberId;
    const result = await apiRequest<{ chore: BackendChoreRecord }>(`/families/${state.familyId}/chores`, {
      method: "POST",
      body: JSON.stringify({
        title: draft.title,
        description: draft.rawText,
        starsValue: 2,
        assignedTo,
        dueTime: inferDueTime(draft),
        isActive: true
      })
    });

    if (!result.data) {
      return null;
    }

    return {
      chore: mapChore(result.data.chore)
    };
  }

  const ensuredList = await ensureActiveListId(state);
  if (!ensuredList) {
    return null;
  }

  const content = stripShoppingPrefix(draft.title);
  const result = await apiRequest<{ item: BackendListItemRecord }>(
    `/families/${state.familyId}/lists/${ensuredList.id}/items`,
    {
      method: "POST",
      body: JSON.stringify({
        content,
        category: inferListCategory(content)
      })
    }
  );

  if (!result.data) {
    return null;
  }

  return {
    groceryListId: ensuredList.id,
    createdList: ensuredList.createdList,
    shoppingItem: mapShoppingItem(
      result.data.item,
      ensuredList.id,
      state.currentMemberId ?? state.members[0]?.id ?? "family"
    )
  };
}

async function ensureActiveListId(state: HomeThreadState): Promise<{ id: string; createdList?: FamilyList } | null> {
  if (state.selectedListId) {
    return { id: state.selectedListId };
  }

  if (state.groceryListId) {
    return { id: state.groceryListId };
  }

  return ensureGroceryListId(state);
}

async function ensureGroceryListId(state: HomeThreadState): Promise<{ id: string; createdList?: FamilyList } | null> {
  if (state.groceryListId) {
    return { id: state.groceryListId };
  }

  if (!state.familyId) {
    return null;
  }

  const result = await apiRequest<{ list: Omit<BackendListRecord, "items"> }>(`/families/${state.familyId}/lists`, {
    method: "POST",
    body: JSON.stringify({
      title: "Groceries",
      type: "grocery",
      icon: "basket",
      isShared: true
    })
  });

  if (!result.data?.list.id) {
    return null;
  }

  return {
    id: result.data.list.id,
    createdList: mapList(result.data.list)
  };
}

function buildListItemsByListId(lists: BackendListRecord[], memberId: string) {
  return lists.reduce<Record<string, ShoppingItem[]>>((grouped, list) => {
    grouped[list.id] = (list.items ?? []).map((item) => mapShoppingItem(item, list.id, memberId));
    return grouped;
  }, {});
}

function replaceListItems(
  record: Record<string, ShoppingItem[]>,
  listId: string,
  items: ShoppingItem[]
): Record<string, ShoppingItem[]> {
  return { ...record, [listId]: items };
}

function flattenListItems(record: Record<string, ShoppingItem[]>, fallback: ShoppingItem[]) {
  const flattened = Object.values(record).flat();
  return flattened.length > 0 ? flattened : fallback;
}

function mapList(list: BackendListRecord): FamilyList {
  return {
    id: list.id,
    title: list.title,
    type: list.type,
    icon: list.icon ?? null
  };
}

function iconForListType(type: FamilyList["type"]) {
  if (type === "grocery") return "basket";
  if (type === "todo") return "checkbox";
  if (type === "packing") return "briefcase";
  return "list";
}

function applyPersistedDraft(
  state: HomeThreadState,
  persisted: PersistedDraft,
  kind: AssistantDraft["kind"]
): Partial<HomeThreadState> {
  if (persisted.event) {
    return {
      events: [persisted.event, ...state.events],
      isSaving: false,
      saveMessage: "Saved event to local database",
      syncMessage: "HomeThread is synced with your local database"
    };
  }

  if (persisted.chore) {
    return {
      chores: [persisted.chore, ...state.chores],
      isSaving: false,
      saveMessage: "Saved chore to local database",
      syncMessage: "HomeThread is synced with your local database"
    };
  }

  if (persisted.shoppingItem) {
    const listId = persisted.groceryListId ?? state.selectedListId ?? state.groceryListId;
    const nextListItems = listId
      ? [persisted.shoppingItem, ...(state.listItemsByListId[listId] ?? [])]
      : state.shoppingItems;
    const selectedListId = state.selectedListId ?? listId ?? null;
    const lists =
      persisted.createdList && !state.lists.some((list) => list.id === persisted.createdList!.id)
        ? [...state.lists, persisted.createdList]
        : state.lists;
    return {
      groceryListId: persisted.groceryListId ?? state.groceryListId,
      lists,
      selectedListId,
      listItemsByListId: listId
        ? replaceListItems(state.listItemsByListId, listId, nextListItems)
        : state.listItemsByListId,
      shoppingItems: listId && selectedListId === listId ? nextListItems : state.shoppingItems,
      isSaving: false,
      saveMessage: "Saved list item to local database",
      syncMessage: "HomeThread is synced with your local database"
    };
  }

  return {
    isSaving: false,
    saveMessage: `Saved ${kind}`
  };
}

function applyLocalDraft(state: HomeThreadState, draft: AssistantDraft): Partial<HomeThreadState> {
  const id = `${draft.kind}-${Date.now()}`;
  const memberIds = findMemberIdsInText(draft.rawText, state.members);

  if (draft.kind === "event") {
    return {
      events: [
        {
          id,
          title: draft.title,
          time: draft.detail.includes(" at ") ? draft.detail.split(" at ").at(-1) ?? "TBD" : "TBD",
          dateLabel: draft.detail.split(" at ")[0] || "Today",
          assignedTo: memberIds,
          source: "assistant"
        },
        ...state.events
      ]
    };
  }

  if (draft.kind === "chore") {
    return {
      chores: [
        {
          id,
          title: draft.title,
          dueLabel: draft.detail,
          assignedTo: memberIds[0] ?? state.members.find((member) => member.role === "kid")?.id ?? "unassigned",
          stars: 2,
          completed: false
        },
        ...state.chores
      ]
    };
  }

  const listId = state.selectedListId ?? state.groceryListId ?? mockGroceryListId;
  const localItem: ShoppingItem = {
    id,
    backendListId: listId,
    title: stripShoppingPrefix(draft.title),
    category: inferListCategory(draft.title),
    addedBy: state.currentMemberId ?? state.members[0]?.id ?? "family",
    checked: false
  };
  const nextListItems = [localItem, ...(state.listItemsByListId[listId] ?? [])];
  return {
    listItemsByListId: replaceListItems(state.listItemsByListId, listId, nextListItems),
    shoppingItems: state.selectedListId === listId ? nextListItems : state.shoppingItems
  };
}

function mapMember(member: BackendMemberRecord): FamilyMember {
  const existing = initialMembers.find((item) => item.name.toLowerCase() === member.displayName.toLowerCase());

  return {
    id: member.id,
    userId: member.userId,
    name: member.displayName,
    initials: member.displayName
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    color: member.color,
    role: member.role === "child" ? "kid" : member.role === "admin" ? "parent" : "caregiver",
    starBalance: existing?.starBalance ?? 0
  };
}

function mapEvent(
  event: BackendEventRecord,
  assignedTo: string[] = [],
  source: PlanEvent["source"] = "manual"
): PlanEvent {
  const startAt = new Date(event.startAt);
  return {
    id: event.id,
    title: event.title,
    time: format(startAt, "h:mm a"),
    dateLabel: format(startAt, "EEE"),
    location: event.location ?? undefined,
    assignedTo,
    source
  };
}

function mapChore(chore: BackendChoreRecord): Chore {
  return {
    id: chore.id,
    title: chore.title,
    dueLabel: chore.dueTime ? `Due ${chore.dueTime}` : "Anytime today",
    assignedTo: chore.assignedTo ?? "unassigned",
    stars: chore.starsValue,
    completed: false
  };
}

function mapShoppingItem(item: BackendListItemRecord, listId: string, fallbackMemberId: string): ShoppingItem {
  return {
    id: item.id,
    backendListId: listId,
    title: item.content,
    category: formatCategory(item.category),
    addedBy: fallbackMemberId,
    checked: item.isChecked
  };
}

function mapMeal(item: BackendMealRecord): MealPlanItem {
  return {
    id: item.id,
    dayOfWeek: item.dayOfWeek,
    mealType: item.mealType,
    title: item.customTitle ?? "Planned meal",
    notes: item.notes ?? undefined
  };
}

function findMemberIdsInText(rawText: string, members: FamilyMember[]) {
  const lower = rawText.toLowerCase();
  return members
    .filter((member) => lower.includes(member.name.toLowerCase()))
    .map((member) => member.id);
}

function inferEventWindow(draft: AssistantDraft) {
  const startAt = inferDateTime(`${draft.rawText} ${draft.detail}`);
  return {
    startAt,
    endAt: new Date(startAt.getTime() + 60 * 60 * 1000)
  };
}

function inferDateTime(source: string) {
  const lower = source.toLowerCase();
  const date = new Date();

  if (lower.includes("tomorrow")) {
    date.setDate(date.getDate() + 1);
  } else {
    const weekdayIndex = weekdayNames.findIndex((day) => lower.includes(day));
    if (weekdayIndex >= 0) {
      const daysAhead = (weekdayIndex - date.getDay() + 7) % 7 || 7;
      date.setDate(date.getDate() + daysAhead);
    }
  }

  const timeMatch = source.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  let hours = lower.includes("tonight") ? 18 : 17;
  let minutes = 0;

  if (timeMatch) {
    hours = Number(timeMatch[1]);
    minutes = Number(timeMatch[2] ?? 0);
    const meridiem = timeMatch[3]?.toLowerCase();

    if (meridiem === "pm" && hours < 12) {
      hours += 12;
    } else if (meridiem === "am" && hours === 12) {
      hours = 0;
    } else if (!meridiem && hours <= 7) {
      hours += 12;
    }
  }

  date.setHours(hours, minutes, 0, 0);
  return date;
}

function inferLocation(rawText: string) {
  const matches = [...rawText.matchAll(/\bat\s+([^,.!?]+)/gi)];
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const candidate = matches[index]?.[1]?.trim();
    if (candidate && !looksLikeTimeOrDay(candidate)) {
      return candidate;
    }
  }

  return null;
}

function looksLikeTimeOrDay(value: string) {
  const lower = value.toLowerCase();
  return weekdayNames.some((day) => lower === day) || /\d/.test(lower) || lower === "today" || lower === "tomorrow";
}

function inferDueTime(draft: AssistantDraft) {
  const lower = `${draft.rawText} ${draft.detail}`.toLowerCase();
  if (lower.includes("tonight")) {
    return "18:00:00";
  }

  const timeMatch = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!timeMatch) {
    return null;
  }

  let hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2] ?? 0);
  const meridiem = timeMatch[3]?.toLowerCase();

  if (meridiem === "pm" && hours < 12) {
    hours += 12;
  } else if (meridiem === "am" && hours === 12) {
    hours = 0;
  } else if (!meridiem && hours <= 7) {
    hours += 12;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
}

function stripShoppingPrefix(value: string) {
  return value
    .replace(/^buy\s+/i, "")
    .replace(/^grab\s+/i, "")
    .replace(/^pick up\s+/i, "")
    .trim();
}

function inferListCategory(value: string) {
  const lower = value.toLowerCase();
  if (/(milk|yogurt|cheese|butter)/u.test(lower)) return "Dairy";
  if (/(banana|berries|strawberries|apple|produce|lettuce|spinach)/u.test(lower)) return "Produce";
  if (/(soap|detergent|paper towels|trash bags)/u.test(lower)) return "Household";
  return "Inbox";
}

function formatCategory(value: string | null) {
  if (!value) {
    return "Inbox";
  }

  return value
    .split(/[\s_-]+/u)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function defaultEventStartAt() {
  const now = new Date();
  const date = new Date(now);
  const minutes = date.getMinutes();
  if (minutes !== 0) {
    date.setHours(date.getHours() + 1);
  }
  date.setMinutes(0, 0, 0);
  return date;
}

function inferStartDateTime(value: string) {
  const parsed = parseTimeHHMM(value);
  if (!parsed) return null;

  const now = new Date();
  const date = new Date(now);
  date.setHours(parsed.hours, parsed.minutes, 0, 0);
  return date;
}

function normalizeDueTime(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^([01]\d|2[0-3]):[0-5]\d$/u.test(trimmed)) return `${trimmed}:00`;
  if (/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/u.test(trimmed)) return trimmed;
  return null;
}

function parseTimeHHMM(value: string) {
  const match = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/u);
  if (!match) return null;
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

function formatISODate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return formatISODate(monday);
}

function dedupeMemberIds(memberIds?: string[]) {
  if (!memberIds || memberIds.length === 0) return [];
  return Array.from(new Set(memberIds.filter(Boolean)));
}

function makeActivityUpdate(input: { author: string; body: string; convertedTo?: TextUpdate["convertedTo"] }): TextUpdate {
  return {
    id: `activity-${Date.now()}`,
    direction: "outbound",
    author: input.author,
    body: input.body,
    createdAt: "Now",
    convertedTo: input.convertedTo
  };
}

function resolveMemberName(members: FamilyMember[], memberId: string | null) {
  if (!memberId) return null;
  return members.find((member) => member.id === memberId)?.name ?? null;
}



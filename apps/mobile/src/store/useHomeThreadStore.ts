import { buildCreateRecipeRequestBody } from "@homethread/shared";
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
  clearOfflineQueue,
  enqueueOfflineItem,
  getOfflineQueue,
  isRetryableApiError,
  replayOfflineQueue as replayOfflineQueueService
} from "../services/offlineQueue";
import { loadOfflineQueueFromStorage } from "../services/offlineQueueStorage";
import { buildWidgetSnapshot, saveWidgetSnapshot } from "../services/widgetSnapshot";
import { useAuthStore } from "./useAuthStore";
import {
  AssistantDraft,
  Chore,
  FamilyList,
  FamilyMember,
  MealPlanItem,
  OfflineQueueItem,
  NotificationItem,
  PlanEvent,
  Recipe,
  RecipeIngredient,
  ShoppingItem,
  RealtimeSyncStatus,
  SyncSource,
  TextUpdate,
  SaveOutcome
} from "../types";
import { createDigest, parseFamilyText } from "../utils/textParser";
import { makeSaveOutcome } from "../utils/saveOutcome";

const defaultFamilyId = "00000000-0000-4000-8000-000000000201";
const mockGroceryListId = "mock-grocery-list";
const weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const initialMockLists: FamilyList[] = [{ id: mockGroceryListId, title: "Groceries", type: "grocery", icon: "basket" }];
const initialMockListItemsByListId: Record<string, ShoppingItem[]> = {
  [mockGroceryListId]: initialShopping.map((item) => ({ ...item, backendListId: mockGroceryListId }))
};

let suppressOfflineReplay = false;

function buildSignedOutHomeState(): Pick<
  HomeThreadState,
  | "familyId"
  | "currentMemberId"
  | "groceryListId"
  | "lists"
  | "selectedListId"
  | "listItemsByListId"
  | "familyName"
  | "inviteCode"
  | "familyCreatedBy"
  | "isFamilyAdmin"
  | "members"
  | "events"
  | "mealWeekStart"
  | "meals"
  | "recipes"
  | "chores"
  | "completedChoreIds"
  | "shoppingItems"
  | "notifications"
  | "textUpdates"
  | "syncSource"
  | "syncMessage"
  | "isHydrating"
  | "isSaving"
  | "saveMessage"
  | "offlineQueue"
  | "isReplayingOffline"
  | "offlineReplayMessage"
  | "realtimeStatus"
  | "realtimeMessage"
> {
  return {
    familyId: null,
    currentMemberId: null,
    groceryListId: null,
    lists: [],
    selectedListId: null,
    listItemsByListId: {},
    familyName: "HomeThread",
    inviteCode: null,
    familyCreatedBy: null,
    isFamilyAdmin: false,
    members: [],
    events: [],
    mealWeekStart: currentWeekStart(),
    meals: [],
    recipes: [],
    chores: [],
    completedChoreIds: {},
    shoppingItems: [],
    notifications: [],
    textUpdates: [],
    syncSource: "mock",
    syncMessage: "Sign in to load household data.",
    isHydrating: false,
    isSaving: false,
    saveMessage: "Sign in to keep household changes in sync.",
    offlineQueue: [],
    isReplayingOffline: false,
    offlineReplayMessage: null,
    realtimeStatus: "inactive",
    realtimeMessage: ""
  };
}

function buildAuthenticatedHydrateFailureShell(
  familyId: string | null,
  failureMessage: string
): Pick<
  HomeThreadState,
  | "familyId"
  | "currentMemberId"
  | "groceryListId"
  | "lists"
  | "selectedListId"
  | "listItemsByListId"
  | "familyName"
  | "inviteCode"
  | "familyCreatedBy"
  | "isFamilyAdmin"
  | "members"
  | "events"
  | "mealWeekStart"
  | "meals"
  | "recipes"
  | "chores"
  | "completedChoreIds"
  | "shoppingItems"
  | "notifications"
  | "textUpdates"
  | "syncSource"
  | "syncMessage"
  | "saveMessage"
  | "offlineQueue"
> {
  const empty = buildSignedOutHomeState();

  return {
    familyId,
    currentMemberId: null,
    groceryListId: null,
    lists: [],
    selectedListId: null,
    listItemsByListId: {},
    familyName: "HomeThread",
    inviteCode: null,
    familyCreatedBy: null,
    isFamilyAdmin: false,
    members: [],
    events: [],
    mealWeekStart: empty.mealWeekStart,
    meals: [],
    recipes: [],
    chores: [],
    completedChoreIds: {},
    shoppingItems: [],
    notifications: [],
    textUpdates: [],
    syncSource: "mock",
    syncMessage: failureMessage,
    saveMessage: "Try refresh when you're ready to load household data.",
    offlineQueue: getOfflineQueue()
  };
}

function resolveQueueFamilyId(state: HomeThreadState) {
  return state.familyId ?? useAuthStore.getState().familyId;
}

async function maybeReplayOfflineQueue(
  get: () => HomeThreadState,
  set: (partial: Partial<HomeThreadState> | ((state: HomeThreadState) => Partial<HomeThreadState>)) => void
) {
  if (suppressOfflineReplay) {
    return { replayed: 0, failed: 0, remaining: getOfflineQueue().length };
  }

  const state = get();
  if (state.syncSource !== "api" || !state.familyId) {
    return { replayed: 0, failed: 0, remaining: getOfflineQueue().length };
  }

  set({
    isReplayingOffline: true,
    offlineReplayMessage: "Replaying queued changes..."
  });

  const result = await replayOfflineQueueService({
    familyId: state.familyId,
    listContext: {
      familyId: state.familyId,
      groceryListId: state.groceryListId,
      lists: state.lists,
      ensureList: async ({ listId, listTitle, listType }) => {
        if (listId) {
          return listId;
        }

        const current = get();
        const ensured = await ensureActiveListId({
          ...current,
          selectedListId: current.selectedListId,
          groceryListId: current.groceryListId ?? current.lists.find((list) => list.type === (listType ?? "grocery"))?.id ?? null,
          lists: current.lists
        });

        return ensured?.id ?? null;
      }
    }
  });

  const replayMessage =
    result.replayed > 0 || result.failed > 0
      ? `Replayed ${result.replayed}, failed ${result.failed}, ${result.remaining} still waiting. No conflict merge yet.`
      : null;

  set({
    offlineQueue: getOfflineQueue(),
    isReplayingOffline: false,
    offlineReplayMessage: replayMessage
  });

  if (result.replayed > 0) {
    suppressOfflineReplay = true;
    await get().hydrateFromBackend();
    suppressOfflineReplay = false;
  }

  return result;
}

type HomeThreadState = {
  familyId: string | null;
  currentMemberId: string | null;
  groceryListId: string | null;
  lists: FamilyList[];
  selectedListId: string | null;
  listItemsByListId: Record<string, ShoppingItem[]>;
  familyName: string;
  inviteCode: string | null;
  familyCreatedBy: string | null;
  isFamilyAdmin: boolean;
  members: FamilyMember[];
  events: PlanEvent[];
  mealWeekStart: string;
  meals: MealPlanItem[];
  recipes: Recipe[];
  chores: Chore[];
  completedChoreIds: Record<string, true>;
  shoppingItems: ShoppingItem[];
  notifications: NotificationItem[];
  textUpdates: TextUpdate[];
  syncSource: SyncSource;
  syncMessage: string;
  isHydrating: boolean;
  isSaving: boolean;
  saveMessage: string;
  offlineQueue: OfflineQueueItem[];
  isReplayingOffline: boolean;
  offlineReplayMessage: string | null;
  realtimeStatus: RealtimeSyncStatus;
  realtimeMessage: string;
  hydrateFromBackend: (options?: { skipOfflineReplay?: boolean }) => Promise<void>;
  refreshFromBackend: (options?: { skipOfflineReplay?: boolean }) => Promise<void>;
  replayPendingOfflineMutations: () => Promise<{ replayed: number; failed: number; remaining: number }>;
  markNotificationsRead: (notificationIds: string[]) => Promise<{ ok: boolean; updated: number; message?: string }>;
  regenerateInviteCode: () => Promise<{ ok: boolean; message?: string }>;
  updateFamilyName: (name: string) => Promise<{ ok: boolean; message?: string }>;
  leaveFamily: () => Promise<{ ok: boolean; message?: string; needsFamilySetup?: boolean }>;
  createVirtualMember: (input: {
    displayName: string;
    role: "child" | "member";
  }) => Promise<{ ok: boolean; message?: string }>;
  updateVirtualMember: (input: {
    memberId: string;
    displayName: string;
  }) => Promise<{ ok: boolean; message?: string }>;
  removeVirtualMember: (memberId: string) => Promise<{ ok: boolean; message?: string }>;
  createEvent: (input: {
    title: string;
    location?: string;
    startDate?: string;
    startTime?: string;
    memberIds?: string[];
  }) => Promise<SaveOutcome>;
  updateEvent: (input: {
    eventId: string;
    title: string;
    location?: string;
    startDate?: string;
    startTime?: string;
    memberIds?: string[];
  }) => Promise<SaveOutcome>;
  deleteEvent: (eventId: string) => Promise<SaveOutcome>;
  createChore: (input: { title: string; dueTime?: string; assignedTo?: string | null; starsValue?: number }) => Promise<SaveOutcome>;
  completeChore: (id: string) => Promise<SaveOutcome | null>;
  toggleChore: (id: string) => void;
  toggleShoppingItem: (id: string) => Promise<SaveOutcome | null>;
  clearCheckedShoppingItems: () => Promise<SaveOutcome | null>;
  selectList: (listId: string) => void;
  createList: (input: { title: string; type: FamilyList["type"] }) => Promise<SaveOutcome>;
  createShoppingItem: (input: { title: string; category?: string | null }) => Promise<SaveOutcome>;
  createMeal: (input: {
    dayOfWeek: number;
    mealType: MealPlanItem["mealType"];
    title: string;
    notes?: string;
    recipeId?: string | null;
  }) => Promise<SaveOutcome>;
  createRecipe: (input: {
    title: string;
    ingredientNames?: string[];
    ingredients?: Recipe["ingredients"];
    description?: string | null;
    instructions?: Recipe["instructions"];
    prepTimeMinutes?: number | null;
    cookTimeMinutes?: number | null;
    servings?: number | null;
  }) => Promise<SaveOutcome>;
  addMealIngredientsToGrocery: (input: { mealPlanItemId?: string; recipeId?: string }) => Promise<SaveOutcome>;
  addWeekMealsToGrocery: () => Promise<SaveOutcome>;
  removeMeal: (id: string) => Promise<SaveOutcome | null>;
  importText: (body: string) => AssistantDraft;
  commitDraft: (draft: AssistantDraft) => Promise<SaveOutcome>;
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
  inviteCode: null,
  familyCreatedBy: null,
  isFamilyAdmin: false,
  members: initialMembers,
  events: initialEvents,
  mealWeekStart: "2026-05-25",
  meals: initialMealPlanItems,
  recipes: [],
  chores: initialChores,
  completedChoreIds: {},
  shoppingItems: initialMockListItemsByListId[mockGroceryListId] ?? [],
  notifications: [],
  textUpdates: initialTexts,
  syncSource: "mock",
  syncMessage: "Preview household on this device.",
  isHydrating: false,
  isSaving: false,
  saveMessage: "Quick add is ready",
  offlineQueue: loadOfflineQueueFromStorage(),
  isReplayingOffline: false,
  offlineReplayMessage: null,
  realtimeStatus: "inactive",
  realtimeMessage: "",
  replayPendingOfflineMutations: async () => maybeReplayOfflineQueue(get, set),
  hydrateFromBackend: async (options) => {
    const authState = useAuthStore.getState();

    if (authState.mode === "supabase" && !authState.familyId) {
      set({
        familyId: null,
        currentMemberId: null,
        groceryListId: null,
        lists: [],
        selectedListId: null,
        listItemsByListId: {},
        familyName: "HomeThread",
        inviteCode: null,
        familyCreatedBy: null,
        isFamilyAdmin: false,
        members: [],
        events: [],
        mealWeekStart: currentWeekStart(),
        meals: [],
        recipes: [],
        chores: [],
        completedChoreIds: {},
        shoppingItems: [],
        notifications: [],
        textUpdates: [],
        isHydrating: false,
        syncSource: "mock",
        saveMessage: "Family setup is still required before HomeThread can save household changes.",
        offlineQueue: getOfflineQueue(),
        isReplayingOffline: false,
        syncMessage:
          "Signed in, but this account has no family membership yet. HomeThread cannot load household data."
      });
      return;
    }

    const targetFamilyId = authState.familyId ?? defaultFamilyId;

    set({
      isHydrating: true,
      syncMessage: "Checking for the latest household updates..."
    });

    const [familyResult, eventsResult, choresResult, listsResult, mealsResult, recipesResult, notificationsResult] = await Promise.all([
      apiRequest<BackendFamilyResponse>(`/families/${targetFamilyId}`),
      apiRequest<BackendEventsResponse>(`/families/${targetFamilyId}/events`),
      apiRequest<BackendChoresResponse>(`/families/${targetFamilyId}/chores/today`),
      apiRequest<BackendListsResponse>(`/families/${targetFamilyId}/lists`),
      apiRequest<BackendMealsResponse>(`/families/${targetFamilyId}/meals?weekStart=${currentWeekStart()}`),
      apiRequest<BackendRecipesResponse>(`/families/${targetFamilyId}/recipes`),
      apiRequest<BackendNotificationsResponse>("/notifications")
    ]);

    if (
      !familyResult.data ||
      !eventsResult.data ||
      !choresResult.data ||
      !listsResult.data ||
      !mealsResult.data ||
      !recipesResult.data ||
      !notificationsResult.data
    ) {
      const previous = get();
      const failureMessage =
        familyResult.error?.message ??
        eventsResult.error?.message ??
        choresResult.error?.message ??
        listsResult.error?.message ??
        mealsResult.error?.message ??
        recipesResult.error?.message ??
        notificationsResult.error?.message ??
        "Refresh failed";

      if (previous.syncSource === "api") {
        set({
          isHydrating: false,
          syncSource: "api",
          syncMessage: `Refresh failed - showing last synced data (${failureMessage})`
        });
        return;
      }

      const isSignedIn = authState.mode === "supabase" || authState.mode === "dev_token";
      if (isSignedIn && authState.familyId) {
        set({
          ...buildAuthenticatedHydrateFailureShell(
            authState.familyId,
            failureMessage || "Could not load household data yet. Pull to refresh when you're ready."
          ),
          isHydrating: false
        });
        return;
      }

      set({
        isHydrating: false,
        syncSource: "mock",
        syncMessage: failureMessage || "Falling back to mock data"
      });
      return;
    }

    const authUserId = authState.userId;
    const currentMember =
      (authUserId
        ? familyResult.data.members.find((member) => member.userId === authUserId)
        : undefined) ??
      familyResult.data.members.find((member) => member.userId) ??
      familyResult.data.members[0] ??
      null;
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
    const mappedEvents = eventsResult.data.events.map((event) => mapEvent(event, event.memberIds ?? []));

    set({
      familyId: familyResult.data.family.id,
      currentMemberId: currentMember?.id ?? null,
      groceryListId: groceryList?.id ?? null,
      lists: backendLists.map(mapList),
      selectedListId,
      listItemsByListId,
      familyName: familyResult.data.family.name,
      inviteCode: familyResult.data.family.inviteCode,
      familyCreatedBy: familyResult.data.family.createdBy ?? null,
      isFamilyAdmin: currentMember?.role === "admin",
      members: familyResult.data.members.map(mapMember),
      events: mappedEvents,
      mealWeekStart: mealsResult.data.weekStart,
      meals: mealsResult.data.items.map(mapMeal),
      recipes: recipesResult.data.recipes.map(mapRecipe),
      chores: hydratedChores,
      shoppingItems: selectedListId ? (listItemsByListId[selectedListId] ?? []) : [],
      notifications: notificationsResult.data.notifications,
      syncSource: "api",
      syncMessage: `Updated ${eventsResult.data.events.length} plans, ${mealsResult.data.items.length} meals, ${choresResult.data.chores.length} chores, and ${backendLists.length} lists.`,
      offlineQueue: getOfflineQueue(),
      isHydrating: false
    });

    saveWidgetSnapshot(
      buildWidgetSnapshot({
        familyName: familyResult.data.family.name,
        events: mappedEvents.map((event) => ({
          title: event.title,
          time: event.time,
          dateLabel: event.dateLabel
        })),
        openChores: hydratedChores.filter((chore) => !chore.completed).length,
        openShoppingItems: Object.values(listItemsByListId)
          .flat()
          .filter((item) => !item.checked).length
      })
    );

    if (!options?.skipOfflineReplay) {
      await maybeReplayOfflineQueue(get, set);
    }
  },
  refreshFromBackend: async (options) => {
    await get().hydrateFromBackend(options);
  },
  markNotificationsRead: async (notificationIds) => {
    const ids = notificationIds.filter(Boolean);
    if (ids.length === 0) {
      return { ok: true, updated: 0 };
    }

    const result = await apiRequest<{ updated: number }>("/notifications/mark-read", {
      method: "POST",
      body: JSON.stringify({ notificationIds: ids })
    });

    if (typeof result.data?.updated !== "number") {
      return {
        ok: false,
        updated: 0,
        message: result.error?.message ?? "Could not mark notifications as read."
      };
    }

    const readAt = new Date().toISOString();
    set((state) => ({
      notifications: state.notifications.map((item) =>
        ids.includes(item.id)
          ? {
              ...item,
              readAt
            }
          : item
      )
    }));

    return {
      ok: true,
      updated: result.data.updated
    };
  },
  regenerateInviteCode: async () => {
    const state = get();
    if (state.syncSource !== "api" || !state.familyId) {
      return { ok: false, message: "Sign in to sync your household before regenerating invite codes." };
    }
    if (!state.isFamilyAdmin) {
      return { ok: false, message: "Only family admins can regenerate invite codes." };
    }

    set({ isSaving: true, saveMessage: "Regenerating invite code..." });
    const result = await apiRequest<{ inviteCode: string }>(`/families/${state.familyId}/invite`, {
      method: "POST"
    });
    set({ isSaving: false });

    if (!result.data?.inviteCode) {
      return {
        ok: false,
        message: result.error?.message ?? "Could not regenerate the invite code."
      };
    }

    set({
      inviteCode: result.data.inviteCode,
      saveMessage: "Invite code updated."
    });
    return { ok: true };
  },
  updateFamilyName: async (name) => {
    const state = get();
    const trimmedName = name.trim();
    if (!trimmedName) {
      return { ok: false, message: "Family name is required." };
    }
    if (state.syncSource !== "api" || !state.familyId) {
      return { ok: false, message: "Sign in to sync your household before renaming the family." };
    }
    if (!state.isFamilyAdmin) {
      return { ok: false, message: "Only family admins can rename the household." };
    }

    set({ isSaving: true, saveMessage: "Saving family name..." });
    const result = await apiRequest<{ family: { name: string } }>(`/families/${state.familyId}`, {
      method: "PATCH",
      body: JSON.stringify({ name: trimmedName })
    });
    set({ isSaving: false });

    if (!result.data?.family?.name) {
      return {
        ok: false,
        message: result.error?.message ?? "Could not update the family name."
      };
    }

    set({
      familyName: result.data.family.name,
      saveMessage: "Family name updated."
    });
    return { ok: true };
  },
  leaveFamily: async () => {
    const state = get();
    if (state.syncSource !== "api" || !state.familyId) {
      return { ok: false, message: "Sign in to sync your household before leaving a family." };
    }

    set({ isSaving: true, saveMessage: "Leaving household..." });
    const familyId = state.familyId;
    const result = await apiRequest<{ left: boolean }>(`/families/${familyId}/leave`, {
      method: "DELETE"
    });

    if (!result.data?.left) {
      set({
        isSaving: false,
        saveMessage: result.error?.message ?? "Could not leave this household."
      });
      return {
        ok: false,
        message: result.error?.message ?? "Could not leave this household."
      };
    }

    const refreshed = await useAuthStore.getState().refreshMembership();
    set({
      familyId: null,
      currentMemberId: null,
      groceryListId: null,
      lists: [],
      selectedListId: null,
      listItemsByListId: {},
      familyName: "HomeThread",
      inviteCode: null,
      familyCreatedBy: null,
      isFamilyAdmin: false,
        members: [],
        events: [],
        mealWeekStart: currentWeekStart(),
        meals: [],
        recipes: [],
        chores: [],
        completedChoreIds: {},
        shoppingItems: [],
        notifications: [],
        textUpdates: [],
      syncSource: "mock",
      isSaving: false,
      isHydrating: false,
      saveMessage: "You left this household.",
      syncMessage: refreshed.familyId
        ? "Membership refreshed after leave."
        : "You left this household. Join or create a family to continue."
    });

    return {
      ok: true,
      needsFamilySetup: !refreshed.familyId,
      message: refreshed.familyId ? undefined : "You left this household."
    };
  },
  createVirtualMember: async ({ displayName, role }) => {
    const state = get();
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      return { ok: false, message: "Member name is required." };
    }
    if (state.syncSource !== "api" || !state.familyId) {
      return { ok: false, message: "Sign in to sync your household before adding members." };
    }
    if (!state.isFamilyAdmin) {
      return { ok: false, message: "Only family admins can add members." };
    }

    const memberColors = ["#F9735B", "#2DAA84", "#F4B740", "#A85576", "#3A91C9", "#3157D5"];
    const color = memberColors[state.members.length % memberColors.length];

    set({ isSaving: true, saveMessage: "Adding member..." });
    const result = await apiRequest<{ member: BackendMemberRecord }>(`/families/${state.familyId}/members`, {
      method: "POST",
      body: JSON.stringify({
        displayName: trimmedName,
        color,
        role,
        isVirtual: true
      })
    });

    if (!result.data?.member) {
      set({
        isSaving: false,
        saveMessage: result.error?.message ?? "Could not add member."
      });
      return {
        ok: false,
        message: result.error?.message ?? "Could not add member."
      };
    }

    const successMessage =
      role === "child"
        ? `${trimmedName} added as a child profile. Open Kids mode from Home when you're ready.`
        : `${trimmedName} added to your household.`;

    set({
      isSaving: false,
      saveMessage: successMessage
    });
    void get().refreshFromBackend();
    return { ok: true };
  },
  updateVirtualMember: async ({ memberId, displayName }) => {
    const state = get();
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      return { ok: false, message: "Member name is required." };
    }
    if (state.syncSource !== "api" || !state.familyId) {
      return { ok: false, message: "Sign in to sync your household before editing members." };
    }
    if (!state.isFamilyAdmin) {
      return { ok: false, message: "Only family admins can edit members." };
    }

    const member = state.members.find((item) => item.id === memberId);
    if (!member?.isVirtual) {
      return { ok: false, message: "Only virtual profiles can be edited in this build." };
    }

    set({ isSaving: true, saveMessage: "Saving member..." });
    const result = await apiRequest<{ member: BackendMemberRecord }>(
      `/families/${state.familyId}/members/${memberId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          displayName: trimmedName,
          color: member.color,
          role: member.role === "kid" ? "child" : "member",
          isVirtual: true
        })
      }
    );

    if (!result.data?.member) {
      set({
        isSaving: false,
        saveMessage: result.error?.message ?? "Could not update member."
      });
      return {
        ok: false,
        message: result.error?.message ?? "Could not update member."
      };
    }

    set({
      isSaving: false,
      saveMessage: `${trimmedName} updated.`
    });
    void get().refreshFromBackend();
    return { ok: true };
  },
  removeVirtualMember: async (memberId) => {
    const state = get();
    if (state.syncSource !== "api" || !state.familyId) {
      return { ok: false, message: "Sign in to sync your household before removing members." };
    }
    if (!state.isFamilyAdmin) {
      return { ok: false, message: "Only family admins can remove members." };
    }

    const member = state.members.find((item) => item.id === memberId);
    if (!member?.isVirtual) {
      return { ok: false, message: "Only virtual profiles can be removed in this build." };
    }

    set({ isSaving: true, saveMessage: "Removing member..." });
    const result = await apiRequest<{ deleted: boolean }>(
      `/families/${state.familyId}/members/${memberId}`,
      {
        method: "DELETE"
      }
    );

    if (!result.data?.deleted) {
      set({
        isSaving: false,
        saveMessage: result.error?.message ?? "Could not remove member."
      });
      return {
        ok: false,
        message: result.error?.message ?? "Could not remove member."
      };
    }

    set({
      isSaving: false,
      saveMessage: `${member.name} removed from your household.`
    });
    void get().refreshFromBackend();
    return { ok: true };
  },
  createEvent: async ({ title, location, startDate, startTime, memberIds: rawMemberIds }) => {
    const state = get();
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      const outcome = makeSaveOutcome("failed", "Event title is required");
      set({ saveMessage: outcome.message });
      return outcome;
    }

    const trimmedDate = startDate?.trim() ?? "";
    const trimmedTime = startTime?.trim() ?? "";
    const startAt = resolveEventStartAt({ startDate: trimmedDate, startTime: trimmedTime });
    if (!startAt) {
      const outcome = makeSaveOutcome("failed", 'Choose a real day and use a time like "5:30 PM".');
      set({ saveMessage: outcome.message });
      return outcome;
    }

    const memberIds = dedupeMemberIds(rawMemberIds);
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
    const queueFamilyId = resolveQueueFamilyId(state);
    const eventPayload = {
      title: normalizedTitle,
      description: null,
      location: location?.trim() ? location.trim() : null,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      allDay: false,
      memberIds
    };

    if (state.syncSource !== "api" || !state.familyId) {
      if (!queueFamilyId) {
        const outcome = makeSaveOutcome("failed", "Backend sync is unavailable - event was not queued");
        set({ saveMessage: outcome.message });
        return outcome;
      }

      enqueueOfflineItem({
        familyId: queueFamilyId,
        type: "create_event",
        summary: `Create event: ${normalizedTitle}`,
        payload: eventPayload
      });
      const outcome = makeSaveOutcome(
        "queued",
        "Backend unavailable - event queued for replay when the server is reachable"
      );
      set({
        offlineQueue: getOfflineQueue(),
        saveMessage: outcome.message
      });
      return outcome;
    }

    set({ isSaving: true, saveMessage: "Creating event..." });

    const result = await apiRequest<{ event: BackendEventRecord }>(`/families/${state.familyId}/events`, {
      method: "POST",
      body: JSON.stringify(eventPayload)
    });

    if (!result.data) {
      if (isRetryableApiError(result)) {
        enqueueOfflineItem({
          familyId: state.familyId,
          type: "create_event",
          summary: `Create event: ${normalizedTitle}`,
          payload: eventPayload
        });
        const outcome = makeSaveOutcome("queued", "Network error - event queued for replay");
        set({
          isSaving: false,
          offlineQueue: getOfflineQueue(),
          saveMessage: outcome.message
        });
        return outcome;
      }

      const outcome = makeSaveOutcome("failed", result.error?.message ?? "Failed to create event");
      set({ isSaving: false, saveMessage: outcome.message });
      return outcome;
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
      saveMessage: "Event saved."
    }));

    return makeSaveOutcome("saved", "Event saved.");
  },
  updateEvent: async ({ eventId, title, location, startDate, startTime, memberIds: rawMemberIds }) => {
    const state = get();
    const existingEvent = state.events.find((event) => event.id === eventId);
    if (!existingEvent) {
      const outcome = makeSaveOutcome("failed", "That event is no longer available.");
      set({ saveMessage: outcome.message });
      return outcome;
    }

    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      const outcome = makeSaveOutcome("failed", "Event title is required");
      set({ saveMessage: outcome.message });
      return outcome;
    }

    const trimmedDate = startDate?.trim() ?? "";
    const trimmedTime = startTime?.trim() ?? "";
    const startAt = resolveEventStartAt({ startDate: trimmedDate, startTime: trimmedTime });
    if (!startAt) {
      const outcome = makeSaveOutcome("failed", 'Choose a real day and use a time like "5:30 PM".');
      set({ saveMessage: outcome.message });
      return outcome;
    }

    const memberIds = dedupeMemberIds(rawMemberIds);
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
    const eventPayload = {
      title: normalizedTitle,
      description: null,
      location: location?.trim() ? location.trim() : null,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      allDay: false,
      memberIds
    };

    if (state.syncSource !== "api" || !state.familyId) {
      const updatedLocalEvent = mapEvent(
        {
          id: eventId,
          title: normalizedTitle,
          location: eventPayload.location,
          startAt: eventPayload.startAt,
          memberIds,
          countdownLabel: existingEvent.countdownLabel ?? null,
          externalSource: existingEvent.externalSource ?? null,
          importedFrom: existingEvent.importedFrom ?? null,
          externalCalendarId: existingEvent.externalCalendarId ?? null
        },
        memberIds,
        existingEvent.source
      );
      const outcome = makeSaveOutcome("local", "Event updated on this device.");
      set((current) => ({
        events: current.events.map((event) => (event.id === eventId ? updatedLocalEvent : event)),
        saveMessage: outcome.message
      }));
      return outcome;
    }

    set({ isSaving: true, saveMessage: "Saving event..." });

    const result = await apiRequest<{ event: BackendEventRecord }>(`/families/${state.familyId}/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify(eventPayload)
    });

    if (!result.data?.event) {
      const outcome = makeSaveOutcome("failed", result.error?.message ?? "Failed to update event");
      set({ isSaving: false, saveMessage: outcome.message });
      return outcome;
    }

    const outcome = makeSaveOutcome("saved", "Event updated.");
    set((current) => ({
      events: current.events.map((event) =>
        event.id === eventId
          ? mapEvent(result.data!.event, result.data!.event.memberIds ?? memberIds, existingEvent.source)
          : event
      ),
      isSaving: false,
      saveMessage: outcome.message
    }));
    return outcome;
  },
  deleteEvent: async (eventId) => {
    const state = get();
    const existingEvent = state.events.find((event) => event.id === eventId);
    if (!existingEvent) {
      const outcome = makeSaveOutcome("failed", "That event is no longer available.");
      set({ saveMessage: outcome.message });
      return outcome;
    }

    if (state.syncSource !== "api" || !state.familyId) {
      const outcome = makeSaveOutcome("local", "Event removed from this device.");
      set((current) => ({
        events: current.events.filter((event) => event.id !== eventId),
        saveMessage: outcome.message
      }));
      return outcome;
    }

    set({ isSaving: true, saveMessage: "Removing event..." });

    const result = await apiRequest<{ deleted: boolean }>(`/families/${state.familyId}/events/${eventId}`, {
      method: "DELETE"
    });

    if (!result.data?.deleted) {
      const outcome = makeSaveOutcome("failed", result.error?.message ?? "Failed to remove event");
      set({ isSaving: false, saveMessage: outcome.message });
      return outcome;
    }

    const outcome = makeSaveOutcome("saved", "Event removed.");
    set((current) => ({
      events: current.events.filter((event) => event.id !== eventId),
      isSaving: false,
      saveMessage: outcome.message
    }));
    return outcome;
  },
  createChore: async ({ title, dueTime, assignedTo, starsValue }) => {
    const state = get();
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      const outcome = makeSaveOutcome("failed", "Chore title is required");
      set({ saveMessage: outcome.message });
      return outcome;
    }

    const normalizedDueTime = normalizeDueTime(dueTime);
    if (dueTime?.trim() && normalizedDueTime === null) {
      const outcome = makeSaveOutcome("failed", 'Use a time like "5:30 PM".');
      set({ saveMessage: outcome.message });
      return outcome;
    }

    const fallbackAssignee =
      state.members.find((member) => member.role === "kid")?.id ?? state.currentMemberId;
    const chorePayload = {
      title: normalizedTitle,
      description: null,
      icon: null,
      starsValue: starsValue ?? 2,
      assignedTo: assignedTo ?? fallbackAssignee ?? null,
      recurrenceRule: null,
      dueTime: normalizedDueTime,
      isActive: true
    };
    const queueFamilyId = resolveQueueFamilyId(state);

    if (state.syncSource !== "api" || !state.familyId) {
      if (!queueFamilyId) {
        const outcome = makeSaveOutcome("failed", "Backend sync is unavailable - chore was not queued");
        set({ saveMessage: outcome.message });
        return outcome;
      }

      enqueueOfflineItem({
        familyId: queueFamilyId,
        type: "create_chore",
        summary: `Create chore: ${normalizedTitle}`,
        payload: chorePayload
      });
      const outcome = makeSaveOutcome(
        "queued",
        "Backend unavailable - chore queued for replay when the server is reachable"
      );
      set({
        offlineQueue: getOfflineQueue(),
        saveMessage: outcome.message
      });
      return outcome;
    }

    set({ isSaving: true, saveMessage: "Creating chore..." });

    const result = await apiRequest<{ chore: BackendChoreRecord }>(`/families/${state.familyId}/chores`, {
      method: "POST",
      body: JSON.stringify(chorePayload)
    });

    if (!result.data) {
      if (isRetryableApiError(result)) {
        enqueueOfflineItem({
          familyId: state.familyId,
          type: "create_chore",
          summary: `Create chore: ${normalizedTitle}`,
          payload: chorePayload
        });
        const outcome = makeSaveOutcome("queued", "Network error - chore queued for replay");
        set({
          isSaving: false,
          offlineQueue: getOfflineQueue(),
          saveMessage: outcome.message
        });
        return outcome;
      }

      const outcome = makeSaveOutcome("failed", result.error?.message ?? "Failed to create chore");
      set({ isSaving: false, saveMessage: outcome.message });
      return outcome;
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
      saveMessage: "Chore saved."
    }));

    return makeSaveOutcome("saved", "Chore saved.");
  },
  completeChore: async (id) => {
    const current = get();
    const target = current.chores.find((chore) => chore.id === id);
    if (!target) {
      return null;
    }

    if (target.completed) {
      const outcome = makeSaveOutcome("failed", "Reopen is not available yet");
      set({ saveMessage: outcome.message });
      return outcome;
    }

    set((state) => ({
      chores: state.chores.map((chore) => (chore.id === id ? { ...chore, completed: true } : chore)),
      completedChoreIds: { ...state.completedChoreIds, [id]: true }
    }));

    const memberId =
      (target.assignedTo && target.assignedTo !== "unassigned" ? target.assignedTo : null) ??
      current.currentMemberId ??
      current.members[0]?.id ??
      null;
    const actorName = memberId ? resolveMemberName(current.members, memberId) ?? "HomeThread" : "HomeThread";

    if (current.syncSource !== "api" || !current.familyId) {
      const outcome = makeSaveOutcome(
        "local",
        `${actorName} earned ${target.stars} star${target.stars === 1 ? "" : "s"} on this device. Sign in to keep stars in sync for the family.`
      );
      set((state) => ({
        members: memberId
          ? state.members.map((member) =>
              member.id === memberId ? { ...member, starBalance: member.starBalance + target.stars } : member
            )
          : state.members,
        saveMessage: outcome.message
      }));
      return outcome;
    }

    if (!memberId) {
      set((state) => ({
        chores: state.chores.map((chore) => (chore.id === id ? { ...chore, completed: false } : chore)),
        completedChoreIds: Object.fromEntries(Object.entries(state.completedChoreIds).filter(([key]) => key !== id)),
        saveMessage: "Choose a family member before completing this chore."
      }));
      return makeSaveOutcome("failed", "Choose a family member before completing this chore.");
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
      set((state) => ({
        chores: state.chores.map((chore) => (chore.id === id ? { ...chore, completed: false } : chore)),
        completedChoreIds: Object.fromEntries(Object.entries(state.completedChoreIds).filter(([key]) => key !== id)),
        isSaving: false,
        saveMessage: result.error?.message ?? "Could not record that chore yet."
      }));
      return makeSaveOutcome("failed", result.error?.message ?? "Could not record that chore yet.");
    }

    const outcome = makeSaveOutcome(
      "saved",
      `${actorName} earned ${target.stars} star${target.stars === 1 ? "" : "s"} for ${target.title}.`
    );
    set((state) => ({
      members: state.members.map((member) =>
        member.id === memberId
          ? { ...member, starBalance: member.starBalance + target.stars }
          : member
      ),
      textUpdates: [
        makeActivityUpdate({
          author: actorName,
          body: `Completed chore: ${target.title}`
        }),
        ...state.textUpdates
      ],
      isSaving: false,
      saveMessage: outcome.message
    }));
    return outcome;
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
      const outcome = makeSaveOutcome("failed", "List name is required");
      set({ saveMessage: outcome.message });
      return outcome;
    }

    const state = get();
    if (state.syncSource !== "api" || !state.familyId) {
      const outcome = makeSaveOutcome("failed", "Sign in and refresh to create a shared list.");
      set({ saveMessage: outcome.message });
      return outcome;
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
      const outcome = makeSaveOutcome("failed", result.error?.message ?? "Failed to create list");
      set({ isSaving: false, saveMessage: outcome.message });
      return outcome;
    }

    const createdList = mapList(result.data.list);
    const outcome = makeSaveOutcome("saved", `Created ${trimmed}`);
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
      saveMessage: outcome.message
    }));

    return outcome;
  },
  toggleShoppingItem: async (id) => {
    const target = get().shoppingItems.find((item) => item.id === id);
    if (!target) {
      return null;
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
      return null;
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
      const outcome = makeSaveOutcome("failed", result.error?.message ?? "Could not sync that list change.");
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
          saveMessage: outcome.message
        };
      });
      return outcome;
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

    return null;
  },
  clearCheckedShoppingItems: async () => {
    const state = get();
    const listId = state.selectedListId ?? null;
    const checkedItems = state.shoppingItems.filter((item) => item.checked);
    if (!listId || checkedItems.length === 0) {
      return null;
    }

    const nextShoppingItems = state.shoppingItems.filter((item) => !item.checked);
    set((current) => ({
      shoppingItems: nextShoppingItems,
      listItemsByListId: replaceListItems(current.listItemsByListId, listId, nextShoppingItems)
    }));

    if (state.syncSource !== "api" || !state.familyId) {
      const outcome = makeSaveOutcome(
        "local",
        `Cleared ${checkedItems.length} checked item${checkedItems.length === 1 ? "" : "s"} on this device.`
      );
      set({ saveMessage: outcome.message });
      return outcome;
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
      const outcome = makeSaveOutcome("failed", result.error?.message ?? "Failed to clear checked items");
      set((current) => ({
        shoppingItems: state.shoppingItems,
        listItemsByListId: replaceListItems(current.listItemsByListId, listId, state.shoppingItems),
        isSaving: false,
        saveMessage: outcome.message
      }));
      return outcome;
    }

    const outcome = makeSaveOutcome(
      "saved",
      `Cleared ${checkedItems.length} checked item${checkedItems.length === 1 ? "" : "s"} from your household list.`
    );
    set((current) => ({
      textUpdates: [
        makeActivityUpdate({
          author: "HomeThread",
          body: `Cleared ${checkedItems.length} checked item${checkedItems.length === 1 ? "" : "s"}`
        }),
        ...current.textUpdates
      ],
      isSaving: false,
      saveMessage: outcome.message
    }));
    return outcome;
  },
  createShoppingItem: async ({ title, category }) => {
    const trimmed = title.trim();
    if (!trimmed) {
      const outcome = makeSaveOutcome("failed", "Item name is required");
      set({ saveMessage: outcome.message });
      return outcome;
    }

    const state = get();
    const queueFamilyId = resolveQueueFamilyId(state);
    const listIdHint = state.selectedListId ?? state.groceryListId ?? state.lists.find((list) => list.type === "grocery")?.id ?? null;
    const listItemPayload = {
      content: trimmed,
      category: category ?? inferListCategory(trimmed),
      listId: listIdHint,
      listTitle: "Groceries",
      listType: "grocery"
    };

    if (state.syncSource !== "api" || !state.familyId) {
      if (!queueFamilyId) {
        const outcome = makeSaveOutcome("failed", "Backend sync is unavailable - item was not queued");
        set({ saveMessage: outcome.message });
        return outcome;
      }

      enqueueOfflineItem({
        familyId: queueFamilyId,
        type: "create_list_item",
        summary: `Add list item: ${trimmed}`,
        payload: listItemPayload
      });
      const outcome = makeSaveOutcome(
        "queued",
        "Backend unavailable - list item queued for replay when the server is reachable"
      );
      set({
        offlineQueue: getOfflineQueue(),
        saveMessage: outcome.message
      });
      return outcome;
    }

    set({ isSaving: true, saveMessage: "Adding item..." });

    const ensuredList = await ensureActiveListId(state);
    const listId = ensuredList?.id ?? null;
    if (!listId) {
      const outcome = makeSaveOutcome("failed", "Unable to resolve list - item was not added");
      set({ isSaving: false, saveMessage: outcome.message });
      return outcome;
    }

    const result = await apiRequest<{ item: BackendListItemRecord }>(
      `/families/${state.familyId}/lists/${listId}/items`,
      {
        method: "POST",
        body: JSON.stringify({
          content: trimmed,
          category: listItemPayload.category
        })
      }
    );

    if (!result.data) {
      if (isRetryableApiError(result)) {
        enqueueOfflineItem({
          familyId: state.familyId,
          type: "create_list_item",
          summary: `Add list item: ${trimmed}`,
          payload: {
            ...listItemPayload,
            listId
          }
        });
        const outcome = makeSaveOutcome("queued", "Network error - list item queued for replay");
        set({
          isSaving: false,
          offlineQueue: getOfflineQueue(),
          saveMessage: outcome.message
        });
        return outcome;
      }

      const outcome = makeSaveOutcome("failed", result.error?.message ?? "Failed to add item");
      set({ isSaving: false, saveMessage: outcome.message });
      return outcome;
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
        saveMessage: "List item saved."
      };
    });

    return makeSaveOutcome("saved", "List item saved.");
  },
  createMeal: async ({ dayOfWeek, mealType, title, notes, recipeId }) => {
    const state = get();
    const trimmed = title.trim();
    const linkedRecipe = recipeId ? state.recipes.find((recipe) => recipe.id === recipeId) : undefined;
    const resolvedTitle = trimmed || linkedRecipe?.title || "";
    if (!resolvedTitle) {
      const outcome = makeSaveOutcome("failed", "Meal title is required");
      set({ saveMessage: outcome.message });
      return outcome;
    }

    const nextMeals = [
      ...state.meals,
      {
        id: `temp-meal-${Date.now()}`,
        dayOfWeek,
        mealType,
        title: resolvedTitle,
        notes: notes?.trim() || undefined,
        recipeId: recipeId ?? null
      }
    ];

    if (state.syncSource !== "api" || !state.familyId) {
      const outcome = makeSaveOutcome("local", "Meal saved on this device.");
      set({
        meals: nextMeals,
        saveMessage: outcome.message
      });
      return outcome;
    }

    set({ isSaving: true, saveMessage: "Saving meal..." });

    const result = await apiRequest<BackendMealsResponse>(`/families/${state.familyId}/meals`, {
      method: "POST",
      body: JSON.stringify({
        weekStart: state.mealWeekStart,
        items: nextMeals.map((meal) => ({
          dayOfWeek: meal.dayOfWeek,
          mealType: meal.mealType,
          customTitle: meal.recipeId ? null : meal.title,
          notes: meal.notes ?? null,
          recipeId: meal.recipeId ?? null
        }))
      })
    });

    if (!result.data) {
      const outcome = makeSaveOutcome("failed", result.error?.message ?? "Failed to save meal");
      set({ isSaving: false, saveMessage: outcome.message });
      return outcome;
    }

    const outcome = makeSaveOutcome("saved", "Meal saved.");
    set((current) => ({
      mealWeekStart: result.data!.weekStart,
      meals: result.data!.items.map(mapMeal),
      textUpdates: [
        makeActivityUpdate({
          author: "HomeThread",
          body: `Added meal: ${resolvedTitle}`,
          convertedTo: "meal"
        }),
        ...current.textUpdates
      ],
      isSaving: false,
      saveMessage: outcome.message
    }));

    return outcome;
  },
  createRecipe: async ({
    title,
    ingredientNames = [],
    ingredients: structuredIngredients,
    description,
    instructions,
    prepTimeMinutes,
    cookTimeMinutes,
    servings
  }) => {
    const state = get();
    const trimmedTitle = title.trim();
    const ingredients =
      structuredIngredients && structuredIngredients.length > 0
        ? structuredIngredients
        : ingredientNames
            .map((name) => name.trim())
            .filter(Boolean)
            .map((name) => ({ name }));

    if (!trimmedTitle) {
      const outcome = makeSaveOutcome("failed", "Recipe title is required");
      set({ saveMessage: outcome.message });
      return outcome;
    }

    if (ingredients.length === 0) {
      const outcome = makeSaveOutcome("failed", "Add at least one ingredient");
      set({ saveMessage: outcome.message });
      return outcome;
    }

    const requestBody = buildCreateRecipeRequestBody({
      title: trimmedTitle,
      description: description ?? null,
      ingredients,
      instructions,
      prepTimeMinutes,
      cookTimeMinutes,
      servings
    });

    if (state.syncSource !== "api" || !state.familyId) {
      const localRecipe: Recipe = {
        id: `temp-recipe-${Date.now()}`,
        title: requestBody.title,
        description: requestBody.description ?? null,
        ingredients: requestBody.ingredients,
        instructions: requestBody.instructions,
        prepTimeMinutes: requestBody.prepTimeMinutes ?? null,
        cookTimeMinutes: requestBody.cookTimeMinutes ?? null,
        servings: requestBody.servings ?? null
      };
      const outcome = makeSaveOutcome("local", "Recipe saved on this device.");
      set({
        recipes: [...state.recipes, localRecipe],
        saveMessage: outcome.message
      });
      return outcome;
    }

    set({ isSaving: true, saveMessage: "Saving recipe..." });

    const result = await apiRequest<{ recipe: BackendRecipeRecord }>(`/families/${state.familyId}/recipes`, {
      method: "POST",
      body: JSON.stringify(requestBody)
    });

    if (!result.data) {
      const outcome = makeSaveOutcome("failed", result.error?.message ?? "Failed to save recipe");
      set({ isSaving: false, saveMessage: outcome.message });
      return outcome;
    }

    const outcome = makeSaveOutcome("saved", "Recipe saved.");
    set((current) => ({
      recipes: [...current.recipes.filter((recipe) => recipe.id !== result.data!.recipe.id), mapRecipe(result.data!.recipe)],
      textUpdates: [
        makeActivityUpdate({
          author: "HomeThread",
          body: `Saved recipe: ${trimmedTitle}`,
          convertedTo: "meal"
        }),
        ...current.textUpdates
      ],
      isSaving: false,
      saveMessage: outcome.message
    }));

    return outcome;
  },
  addMealIngredientsToGrocery: async ({ mealPlanItemId, recipeId }) => {
    const state = get();
    if (!mealPlanItemId && !recipeId) {
      const outcome = makeSaveOutcome("failed", "Choose a meal or recipe first");
      set({ saveMessage: outcome.message });
      return outcome;
    }

    const localIngredients = resolveLocalGroceryIngredients(state, { mealPlanItemId, recipeId });
    if (!localIngredients) {
      const outcome = makeSaveOutcome("failed", "No ingredients found for that meal or recipe");
      set({ saveMessage: outcome.message });
      return outcome;
    }

    if (state.syncSource !== "api" || !state.familyId) {
      const listId = state.groceryListId ?? state.selectedListId ?? mockGroceryListId;
      const existing = state.listItemsByListId[listId] ?? [];
      const existingTitles = new Set(existing.map((item) => item.title.trim().toLowerCase()));
      const memberId = state.currentMemberId ?? state.members[0]?.id ?? "family";
      const added = localIngredients
        .map((ingredient) => formatLocalIngredient(ingredient))
        .filter((content) => {
          const normalized = content.toLowerCase();
          if (existingTitles.has(normalized)) {
            return false;
          }
          existingTitles.add(normalized);
          return true;
        })
        .map((content) => ({
          id: `temp-item-${Date.now()}-${content}`,
          backendListId: listId,
          title: content,
          category: "Pantry",
          addedBy: memberId,
          checked: false
        }));

      const nextListItems = [...added, ...existing];
      const outcome = makeSaveOutcome(
        added.length > 0 ? "local" : "failed",
        added.length > 0
          ? `Added ${added.length} ingredient${added.length === 1 ? "" : "s"} to grocery list on this device.`
          : "Those ingredients are already on the grocery list"
      );
      set((current) => ({
        listItemsByListId: replaceListItems(current.listItemsByListId, listId, nextListItems),
        shoppingItems: (current.selectedListId ?? listId) === listId ? nextListItems : current.shoppingItems,
        saveMessage: outcome.message
      }));
      return outcome;
    }

    set({ isSaving: true, saveMessage: "Adding ingredients to grocery list..." });

    const ensuredList = await ensureGroceryListId(get());
    if (!ensuredList) {
      const outcome = makeSaveOutcome("failed", "Unable to resolve grocery list");
      set({ isSaving: false, saveMessage: outcome.message });
      return outcome;
    }

    if (ensuredList.createdList) {
      set((current) => ({
        ...applyEnsuredGroceryListState(current, ensuredList),
        isSaving: true,
        saveMessage: "Adding ingredients to grocery list..."
      }));
    }

    const result = await apiRequest<BackendMealToGroceryResponse>(`/families/${state.familyId}/meals/to-grocery`, {
      method: "POST",
      body: JSON.stringify({
        mealPlanItemId,
        recipeId,
        listId: ensuredList.id
      })
    });

    if (!result.data) {
      const outcome = makeSaveOutcome("failed", result.error?.message ?? "Failed to add ingredients to grocery list");
      set({ isSaving: false, saveMessage: outcome.message });
      return outcome;
    }

    const listId = result.data.listId;
    const memberId = state.currentMemberId ?? state.members[0]?.id ?? "family";
    const mappedItems = result.data.added.map((item) =>
      mapShoppingItem(
        {
          id: item.id,
          content: item.content,
          category: null,
          quantity: null,
          isChecked: false,
          checkedBy: null
        },
        listId,
        memberId
      )
    );

    const outcome = makeSaveOutcome(
      result.data!.added.length > 0 ? "saved" : "failed",
      result.data!.added.length > 0
        ? `Added ${result.data!.added.length} ingredient${result.data!.added.length === 1 ? "" : "s"} to grocery list`
        : "Those ingredients are already on the grocery list"
    );
    set((current) => {
      const nextListItems = [...mappedItems, ...(current.listItemsByListId[listId] ?? [])];
      const nextSelectedListId = current.selectedListId ?? listId;
      return {
        ...applyEnsuredGroceryListState(current, { id: listId, createdList: ensuredList.createdList }),
        selectedListId: nextSelectedListId,
        listItemsByListId: replaceListItems(current.listItemsByListId, listId, nextListItems),
        shoppingItems: nextSelectedListId === listId ? nextListItems : current.shoppingItems,
        textUpdates: [
          makeActivityUpdate({
            author: "HomeThread",
            body: `Added ${result.data!.added.length} grocery item${result.data!.added.length === 1 ? "" : "s"} from a meal`,
            convertedTo: "list"
          }),
          ...current.textUpdates
        ],
        isSaving: false,
        saveMessage: outcome.message
      };
    });

    return outcome;
  },
  addWeekMealsToGrocery: async () => {
    const state = get();
    if (state.meals.length === 0) {
      const outcome = makeSaveOutcome("failed", "No planned meals for this week");
      set({ saveMessage: outcome.message });
      return outcome;
    }

    if (state.syncSource !== "api" || !state.familyId) {
      const listId = state.groceryListId ?? state.selectedListId ?? mockGroceryListId;
      const existing = state.listItemsByListId[listId] ?? [];
      const existingTitles = new Set(existing.map((item) => item.title.trim().toLowerCase()));
      const seenInBatch = new Set<string>();
      const memberId = state.currentMemberId ?? state.members[0]?.id ?? "family";
      const addedItems: ShoppingItem[] = [];
      let skipped = 0;

      for (const meal of state.meals) {
        const mealIngredients = resolveLocalGroceryIngredients(state, { mealPlanItemId: meal.id });
        if (!mealIngredients) {
          continue;
        }

        for (const ingredient of mealIngredients) {
          const content = formatLocalIngredient(ingredient);
          const normalized = content.toLowerCase();
          if (seenInBatch.has(normalized)) {
            skipped += 1;
            continue;
          }
          seenInBatch.add(normalized);

          if (existingTitles.has(normalized)) {
            skipped += 1;
            continue;
          }

          existingTitles.add(normalized);
          addedItems.push({
            id: `temp-item-${Date.now()}-${content}`,
            backendListId: listId,
            title: content,
            category: "Pantry",
            addedBy: memberId,
            checked: false
          });
        }
      }

      if (seenInBatch.size === 0) {
        const outcome = makeSaveOutcome("failed", "No ingredients found for this week's meals");
        set({ saveMessage: outcome.message });
        return outcome;
      }

      const nextListItems = [...addedItems, ...existing];
      const message = formatGroceryBridgeMessage(addedItems.length, skipped, "week");
      const outcome = makeSaveOutcome(addedItems.length > 0 ? "local" : "failed", message);
      set((current) => ({
        listItemsByListId: replaceListItems(current.listItemsByListId, listId, nextListItems),
        shoppingItems: (current.selectedListId ?? listId) === listId ? nextListItems : current.shoppingItems,
        saveMessage: outcome.message
      }));
      return outcome;
    }

    set({ isSaving: true, saveMessage: "Adding this week's ingredients..." });

    const ensuredList = await ensureGroceryListId(get());
    if (!ensuredList) {
      const outcome = makeSaveOutcome("failed", "Unable to resolve grocery list");
      set({ isSaving: false, saveMessage: outcome.message });
      return outcome;
    }

    if (ensuredList.createdList) {
      set((current) => ({
        ...applyEnsuredGroceryListState(current, ensuredList),
        isSaving: true,
        saveMessage: "Adding this week's ingredients..."
      }));
    }

    const result = await apiRequest<BackendWeekMealToGroceryResponse>(
      `/families/${state.familyId}/meals/week-to-grocery`,
      {
        method: "POST",
        body: JSON.stringify({
          weekStart: state.mealWeekStart,
          listId: ensuredList.id
        })
      }
    );

    if (!result.data) {
      const outcome = makeSaveOutcome("failed", result.error?.message ?? "Failed to add this week's ingredients");
      set({ isSaving: false, saveMessage: outcome.message });
      return outcome;
    }

    const listId = result.data.listId;
    const memberId = state.currentMemberId ?? state.members[0]?.id ?? "family";
    const mappedItems = result.data.added.map((item) =>
      mapShoppingItem(
        {
          id: item.id,
          content: item.content,
          category: null,
          quantity: null,
          isChecked: false,
          checkedBy: null
        },
        listId,
        memberId
      )
    );

    const outcome = makeSaveOutcome(
      result.data!.added.length > 0 || result.data!.skipped.length > 0 ? "saved" : "failed",
      formatGroceryBridgeMessage(result.data!.added.length, result.data!.skipped.length, "week")
    );
    set((current) => {
      const nextListItems = [...mappedItems, ...(current.listItemsByListId[listId] ?? [])];
      const nextSelectedListId = current.selectedListId ?? listId;
      return {
        ...applyEnsuredGroceryListState(current, { id: listId, createdList: ensuredList.createdList }),
        selectedListId: nextSelectedListId,
        listItemsByListId: replaceListItems(current.listItemsByListId, listId, nextListItems),
        shoppingItems: nextSelectedListId === listId ? nextListItems : current.shoppingItems,
        textUpdates: [
          makeActivityUpdate({
            author: "HomeThread",
            body: `Added ${result.data!.added.length} grocery items from this week's meals`,
            convertedTo: "list"
          }),
          ...current.textUpdates
        ],
        isSaving: false,
        saveMessage: outcome.message
      };
    });

    return outcome;
  },
  removeMeal: async (id) => {
    const state = get();
    const nextMeals = state.meals.filter((meal) => meal.id !== id);
    if (nextMeals.length === state.meals.length) {
      return null;
    }

    if (state.syncSource !== "api" || !state.familyId) {
      const outcome = makeSaveOutcome("local", "Meal removed on this device.");
      set({
        meals: nextMeals,
        saveMessage: outcome.message
      });
      return outcome;
    }

    set({ isSaving: true, saveMessage: "Removing meal..." });

    const result = await apiRequest<BackendMealsResponse>(`/families/${state.familyId}/meals`, {
      method: "POST",
      body: JSON.stringify({
        weekStart: state.mealWeekStart,
        items: nextMeals.map((meal) => ({
          dayOfWeek: meal.dayOfWeek,
          mealType: meal.mealType,
          customTitle: meal.recipeId ? null : meal.title,
          notes: meal.notes ?? null,
          recipeId: meal.recipeId ?? null
        }))
      })
    });

    if (!result.data) {
      const outcome = makeSaveOutcome("failed", result.error?.message ?? "Failed to remove meal");
      set({ isSaving: false, saveMessage: outcome.message });
      return outcome;
    }

    const outcome = makeSaveOutcome("saved", "Updated meal plan");
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
      saveMessage: outcome.message
    }));
    return outcome;
  },
  importText: (body) => parseFamilyText(body),
  commitDraft: async (draft) => {
    set({
      isSaving: true,
      saveMessage: `Saving ${draft.kind}...`
    });

    const state = get();
    const persisted = state.syncSource === "api" && state.familyId ? await persistDraftToApi(draft, state) : null;

    if (persisted) {
      const applied = applyPersistedDraft(state, persisted, draft.kind);
      set((current) => ({
        ...current,
        ...applied,
        isSaving: false,
        textUpdates: draft.rawText
          ? [
              {
                id: `text-${Date.now()}`,
                direction: "inbound",
                author: "Pasted text",
                body: draft.rawText,
                createdAt: "Now",
                convertedTo: draft.kind
              },
              ...current.textUpdates
            ]
          : current.textUpdates
      }));
      return makeSaveOutcome("saved", applied.saveMessage ?? "Saved to household.");
    }

    const localMessage =
      state.syncSource === "api"
        ? "Saved on this device. Pull to refresh once the connection is steady."
        : "Saved on this device.";

    set((current) => ({
      ...applyLocalDraft(current, draft),
      isSaving: false,
      saveMessage: localMessage,
      textUpdates: draft.rawText
        ? [
            {
              id: `text-${Date.now()}`,
              direction: "inbound",
              author: "Pasted text",
              body: draft.rawText,
              createdAt: "Now",
              convertedTo: draft.kind
            },
            ...current.textUpdates
          ]
        : current.textUpdates
    }));
    return makeSaveOutcome("local", localMessage);
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

export function resetHomeThreadStoreForSignedOut() {
  clearOfflineQueue();
  suppressOfflineReplay = false;
  useHomeThreadStore.setState(buildSignedOutHomeState());
}

type BackendFamilyResponse = {
  family: {
    id: string;
    name: string;
    inviteCode: string;
    createdBy?: string;
  };
  members: BackendMemberRecord[];
};

type BackendMemberRecord = {
  id: string;
  userId: string | null;
  displayName: string;
  color: string;
  role: "admin" | "member" | "child";
  isVirtual?: boolean;
  starBalance?: number;
};

type BackendEventRecord = {
  id: string;
  title: string;
  location: string | null;
  countdownLabel?: string | null;
  startAt: string;
  memberIds: string[];
  externalSource?: string | null;
  importedFrom?: string | null;
  externalCalendarId?: string | null;
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
  recipeId?: string | null;
  customTitle: string | null;
  recipeTitle?: string | null;
  notes: string | null;
};

type BackendMealsResponse = {
  weekStart: string;
  items: BackendMealRecord[];
};

type BackendRecipeRecord = {
  id: string;
  title: string;
  description?: string | null;
  ingredients: RecipeIngredient[];
  instructions?: Recipe["instructions"];
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  servings?: number | null;
};

type BackendRecipesResponse = {
  recipes: BackendRecipeRecord[];
};

type BackendNotificationsResponse = {
  notifications: NotificationItem[];
};

type BackendMealToGroceryResponse = {
  listId: string;
  added: Array<{ id: string; content: string }>;
  skipped: string[];
};

type BackendWeekMealToGroceryResponse = {
  listId: string;
  weekStart: string;
  mealsProcessed: number;
  added: Array<{ id: string; content: string }>;
  skipped: string[];
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

  const groceryFromLists = state.lists.find((list) => list.type === "grocery");
  if (groceryFromLists) {
    return { id: groceryFromLists.id };
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

function applyEnsuredGroceryListState(
  current: HomeThreadState,
  ensured: { id: string; createdList?: FamilyList }
): Pick<HomeThreadState, "groceryListId" | "lists" | "listItemsByListId"> {
  const listId = ensured.id;
  const nextLists =
    ensured.createdList && !current.lists.some((list) => list.id === listId)
      ? [...current.lists, ensured.createdList]
      : current.lists;

  return {
    groceryListId: listId,
    lists: nextLists,
    listItemsByListId: {
      ...current.listItemsByListId,
      [listId]: current.listItemsByListId[listId] ?? []
    }
  };
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
      saveMessage: "Event saved.",
      syncMessage: "Household synced."
    };
  }

  if (persisted.chore) {
    return {
      chores: [persisted.chore, ...state.chores],
      isSaving: false,
      saveMessage: "Chore saved.",
      syncMessage: "Household synced."
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
      saveMessage: "List item saved.",
      syncMessage: "Household synced."
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
    const inferredWindow = inferEventWindow(draft);
    return {
      events: [
        {
          id,
          title: draft.title,
          time: draft.detail.includes(" at ") ? draft.detail.split(" at ").at(-1) ?? "TBD" : "TBD",
          dateLabel: draft.detail.split(" at ")[0] || "Today",
          startAt: inferredWindow.startAt.toISOString(),
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
    isVirtual: member.isVirtual ?? false,
    starBalance: member.starBalance ?? existing?.starBalance ?? 0
  };
}

function mapEvent(
  event: BackendEventRecord,
  assignedTo: string[] = [],
  source: PlanEvent["source"] = "manual"
): PlanEvent {
  const startAt = new Date(event.startAt);
  const validStartAt = Number.isNaN(startAt.getTime()) ? new Date() : startAt;
  const safeAssignedTo = Array.isArray(assignedTo) ? assignedTo.filter((id) => typeof id === "string") : [];

  return {
    id: event.id,
    title: event.title,
    time: format(validStartAt, "h:mm a"),
    dateLabel: format(validStartAt, "EEE, MMM d"),
    startAt: Number.isNaN(startAt.getTime()) ? validStartAt.toISOString() : event.startAt,
    location: event.location ?? undefined,
    countdownLabel: event.countdownLabel ?? null,
    assignedTo: safeAssignedTo,
    source,
    externalSource: event.externalSource ?? null,
    importedFrom: event.importedFrom ?? null,
    externalCalendarId: event.externalCalendarId ?? null
  };
}

function mapChore(chore: BackendChoreRecord): Chore {
  return {
    id: chore.id,
    title: chore.title,
    dueLabel: chore.dueTime ? `Today at ${formatStoredTimeValue(chore.dueTime)}` : "Anytime today",
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
    title: item.recipeTitle ?? item.customTitle ?? "Planned meal",
    notes: item.notes ?? undefined,
    recipeId: item.recipeId ?? null
  };
}

function mapRecipe(recipe: BackendRecipeRecord): Recipe {
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description ?? null,
    ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
    instructions: Array.isArray(recipe.instructions) ? recipe.instructions : undefined,
    prepTimeMinutes: recipe.prepTimeMinutes ?? null,
    cookTimeMinutes: recipe.cookTimeMinutes ?? null,
    servings: recipe.servings ?? null
  };
}

function resolveLocalGroceryIngredients(
  state: HomeThreadState,
  input: { mealPlanItemId?: string; recipeId?: string }
) {
  if (input.recipeId) {
    const recipe = state.recipes.find((entry) => entry.id === input.recipeId);
    return recipe?.ingredients.length ? recipe.ingredients : null;
  }

  if (!input.mealPlanItemId) {
    return null;
  }

  const meal = state.meals.find((entry) => entry.id === input.mealPlanItemId);
  if (!meal) {
    return null;
  }

  if (meal.recipeId) {
    const recipe = state.recipes.find((entry) => entry.id === meal.recipeId);
    if (recipe?.ingredients.length) {
      return recipe.ingredients;
    }
  }

  return [{ name: meal.title }];
}

function formatLocalIngredient(ingredient: RecipeIngredient) {
  const amount = ingredient.amount?.trim();
  const unit = ingredient.unit?.trim();
  const name = ingredient.name.trim();
  const prefix = [amount, unit].filter(Boolean).join(" ");
  return prefix ? `${prefix} ${name}`.trim() : name;
}

function formatGroceryBridgeMessage(added: number, skipped: number, scope: "meal" | "week") {
  if (added === 0 && skipped > 0) {
    return scope === "week"
      ? "This week's ingredients are already on the grocery list"
      : "Those ingredients are already on the grocery list";
  }

  const scopeLabel = scope === "week" ? "for this week" : "to grocery list";
  const addedPart = `Added ${added} ingredient${added === 1 ? "" : "s"} ${scopeLabel}`;
  if (skipped > 0) {
    return `${addedPart} (${skipped} already on list)`;
  }

  return addedPart;
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

function resolveEventStartAt(input: { startDate?: string; startTime?: string }) {
  const trimmedDate = input.startDate?.trim() ?? "";
  const trimmedTime = input.startTime?.trim() ?? "";

  if (!trimmedDate && !trimmedTime) {
    return defaultEventStartAt();
  }

  const baseDate = trimmedDate ? parseDateInput(trimmedDate) : new Date();
  if (!baseDate) {
    return null;
  }

  const parsedTime = trimmedTime ? parseFlexibleTime(trimmedTime) : null;
  if (trimmedTime && !parsedTime) {
    return null;
  }

  if (parsedTime) {
    baseDate.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);
    return baseDate;
  }

  const fallback = defaultEventStartAt();
  baseDate.setHours(fallback.getHours(), fallback.getMinutes(), 0, 0);
  return baseDate;
}

function normalizeDueTime(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const parsed = parseFlexibleTime(trimmed);
  if (!parsed) return null;
  return `${String(parsed.hours).padStart(2, "0")}:${String(parsed.minutes).padStart(2, "0")}:00`;
}

function parseFlexibleTime(value: string) {
  const trimmed = value.trim().toLowerCase();
  const twelveHourMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/u);
  if (twelveHourMatch) {
    let hours = Number(twelveHourMatch[1]);
    const minutes = Number(twelveHourMatch[2] ?? 0);
    const meridiem = twelveHourMatch[3];
    if (hours < 1 || hours > 12 || minutes > 59) {
      return null;
    }
    if (meridiem === "pm" && hours < 12) {
      hours += 12;
    }
    if (meridiem === "am" && hours === 12) {
      hours = 0;
    }
    return { hours, minutes };
  }

  const twentyFourHourMatch = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/u);
  if (!twentyFourHourMatch) {
    return null;
  }

  return {
    hours: Number(twentyFourHourMatch[1]),
    minutes: Number(twentyFourHourMatch[2])
  };
}

function parseDateInput(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) return null;

  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
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

function formatStoredTimeValue(value: string) {
  const parsed = parseFlexibleTime(value);
  if (!parsed) {
    return value;
  }

  const date = new Date();
  date.setHours(parsed.hours, parsed.minutes, 0, 0);
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

import { format } from "date-fns";
import { create } from "zustand";

import {
  chores as initialChores,
  members as initialMembers,
  planEvents as initialEvents,
  shoppingItems as initialShopping,
  textUpdates as initialTexts
} from "../data/mockFamily";
import { apiRequest } from "../services/api";
import { AssistantDraft, Chore, FamilyMember, PlanEvent, ShoppingItem, SyncSource, TextUpdate } from "../types";
import { createDigest, parseFamilyText } from "../utils/textParser";

const defaultFamilyId = "00000000-0000-4000-8000-000000000201";
const weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

type HomeThreadState = {
  familyId: string | null;
  currentMemberId: string | null;
  groceryListId: string | null;
  familyName: string;
  members: FamilyMember[];
  events: PlanEvent[];
  chores: Chore[];
  shoppingItems: ShoppingItem[];
  textUpdates: TextUpdate[];
  syncSource: SyncSource;
  syncMessage: string;
  isHydrating: boolean;
  isSaving: boolean;
  saveMessage: string;
  hydrateFromBackend: () => Promise<void>;
  toggleChore: (id: string) => void;
  toggleShoppingItem: (id: string) => Promise<void>;
  importText: (body: string) => AssistantDraft;
  commitDraft: (draft: AssistantDraft) => Promise<void>;
  sendDigestToThread: () => string;
};

export const useHomeThreadStore = create<HomeThreadState>((set, get) => ({
  familyId: defaultFamilyId,
  currentMemberId: null,
  groceryListId: null,
  familyName: "The Parker Home",
  members: initialMembers,
  events: initialEvents,
  chores: initialChores,
  shoppingItems: initialShopping,
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

    const [familyResult, eventsResult, choresResult, listsResult] = await Promise.all([
      apiRequest<BackendFamilyResponse>(`/families/${defaultFamilyId}`),
      apiRequest<BackendEventsResponse>(`/families/${defaultFamilyId}/events`),
      apiRequest<BackendChoresResponse>(`/families/${defaultFamilyId}/chores/today`),
      apiRequest<BackendListsResponse>(`/families/${defaultFamilyId}/lists`)
    ]);

    if (!familyResult.data || !eventsResult.data || !choresResult.data || !listsResult.data) {
      set({
        isHydrating: false,
        syncSource: "mock",
        syncMessage:
          familyResult.error?.message ??
          eventsResult.error?.message ??
          choresResult.error?.message ??
          listsResult.error?.message ??
          "Falling back to mock data"
      });
      return;
    }

    const currentMember = familyResult.data.members.find((member) => member.userId) ?? familyResult.data.members[0] ?? null;
    const groceryList =
      listsResult.data.lists.find((list) => list.type === "grocery") ?? listsResult.data.lists[0] ?? null;

    set({
      familyId: familyResult.data.family.id,
      currentMemberId: currentMember?.id ?? null,
      groceryListId: groceryList?.id ?? null,
      familyName: familyResult.data.family.name,
      members: familyResult.data.members.map(mapMember),
      events: eventsResult.data.events.map((event) => mapEvent(event)),
      chores: choresResult.data.chores.map(mapChore),
      shoppingItems: groceryList
        ? groceryList.items.map((item) => mapShoppingItem(item, groceryList.id, currentMember?.id ?? "family"))
        : [],
      syncSource: "api",
      syncMessage: `Loaded ${eventsResult.data.events.length} plans, ${choresResult.data.chores.length} chores, and ${groceryList?.items.length ?? 0} list items from local database`,
      isHydrating: false
    });
  },
  toggleChore: (id) => {
    set((state) => ({
      chores: state.chores.map((chore) =>
        chore.id === id ? { ...chore, completed: !chore.completed } : chore
      )
    }));
  },
  toggleShoppingItem: async (id) => {
    const target = get().shoppingItems.find((item) => item.id === id);
    if (!target) {
      return;
    }

    const nextChecked = !target.checked;

    set((state) => ({
      shoppingItems: state.shoppingItems.map((item) =>
        item.id === id ? { ...item, checked: nextChecked } : item
      )
    }));

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
      set((current) => ({
        shoppingItems: current.shoppingItems.map((item) =>
          item.id === id ? { ...item, checked: target.checked } : item
        ),
        isSaving: false,
        saveMessage: "List sync fell back to local mode for this change"
      }));
      return;
    }

    const updatedItem = result.data.item;
    const fallbackMemberId = state.currentMemberId ?? state.members[0]?.id ?? "family";
    set((current) => ({
      shoppingItems: current.shoppingItems.map((item) =>
        item.id === id ? mapShoppingItem(updatedItem, target.backendListId!, fallbackMemberId) : item
      ),
      isSaving: false,
      saveMessage: `${target.title} updated`
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
      items: state.shoppingItems
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
  items: BackendListItemRecord[];
};

type BackendListsResponse = {
  lists: BackendListRecord[];
};

type PersistedDraft = {
  event?: PlanEvent;
  chore?: Chore;
  shoppingItem?: ShoppingItem;
  groceryListId?: string;
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

  const ensuredList = await ensureGroceryListId(state);
  if (!ensuredList) {
    return null;
  }

  const content = stripShoppingPrefix(draft.title);
  const result = await apiRequest<{ item: BackendListItemRecord }>(
    `/families/${state.familyId}/lists/${ensuredList}/items`,
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
    groceryListId: ensuredList,
    shoppingItem: mapShoppingItem(
      result.data.item,
      ensuredList,
      state.currentMemberId ?? state.members[0]?.id ?? "family"
    )
  };
}

async function ensureGroceryListId(state: HomeThreadState): Promise<string | null> {
  if (state.groceryListId) {
    return state.groceryListId;
  }

  if (!state.familyId) {
    return null;
  }

  const result = await apiRequest<{ list: { id: string } }>(`/families/${state.familyId}/lists`, {
    method: "POST",
    body: JSON.stringify({
      title: "Groceries",
      type: "grocery",
      icon: "basket",
      isShared: true
    })
  });

  return result.data?.list.id ?? null;
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
    return {
      groceryListId: persisted.groceryListId ?? state.groceryListId,
      shoppingItems: [persisted.shoppingItem, ...state.shoppingItems],
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

  return {
    shoppingItems: [
      {
        id,
        title: stripShoppingPrefix(draft.title),
        category: inferListCategory(draft.title),
        addedBy: state.currentMemberId ?? state.members[0]?.id ?? "family",
        checked: false
      },
      ...state.shoppingItems
    ]
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

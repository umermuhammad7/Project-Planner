import { create } from "zustand";

import {
  chores as initialChores,
  members as initialMembers,
  planEvents as initialEvents,
  shoppingItems as initialShopping,
  textUpdates as initialTexts
} from "../data/mockFamily";
import { AssistantDraft, Chore, FamilyMember, PlanEvent, ShoppingItem, TextUpdate } from "../types";
import { createDigest, parseFamilyText } from "../utils/textParser";

type HomeThreadState = {
  members: FamilyMember[];
  events: PlanEvent[];
  chores: Chore[];
  shoppingItems: ShoppingItem[];
  textUpdates: TextUpdate[];
  toggleChore: (id: string) => void;
  toggleShoppingItem: (id: string) => void;
  importText: (body: string) => AssistantDraft;
  commitDraft: (draft: AssistantDraft) => void;
  sendDigestToThread: () => string;
};

export const useHomeThreadStore = create<HomeThreadState>((set, get) => ({
  members: initialMembers,
  events: initialEvents,
  chores: initialChores,
  shoppingItems: initialShopping,
  textUpdates: initialTexts,
  toggleChore: (id) => {
    set((state) => ({
      chores: state.chores.map((chore) =>
        chore.id === id ? { ...chore, completed: !chore.completed } : chore
      )
    }));
  },
  toggleShoppingItem: (id) => {
    set((state) => ({
      shoppingItems: state.shoppingItems.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
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
  commitDraft: (draft) => {
    const id = `${draft.kind}-${Date.now()}`;
    set((state) => {
      if (draft.kind === "event") {
        return {
          events: [
            {
              id,
              title: draft.title,
              time: draft.detail.includes(" at ") ? draft.detail.split(" at ").at(-1) ?? "TBD" : "TBD",
              dateLabel: draft.detail.split(" at ")[0] || "Today",
              assignedTo: ["mara"],
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
              assignedTo: "jules",
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
            title: draft.title.replace(/^buy\s+/i, "").replace(/^grab\s+/i, ""),
            category: "Inbox",
            addedBy: "mara",
            checked: false
          },
          ...state.shoppingItems
        ]
      };
    });
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

export type MemberRole = "parent" | "kid" | "caregiver";

export type FamilyMember = {
  id: string;
  userId?: string | null;
  name: string;
  initials: string;
  color: string;
  role: MemberRole;
  starBalance: number;
};

export type PlanEvent = {
  id: string;
  title: string;
  time: string;
  dateLabel: string;
  location?: string;
  assignedTo: string[];
  source: "manual" | "text" | "assistant";
};

export type Chore = {
  id: string;
  title: string;
  dueLabel: string;
  assignedTo: string;
  stars: number;
  completed: boolean;
};

export type ShoppingItem = {
  id: string;
  backendListId?: string;
  title: string;
  category: string;
  addedBy: string;
  checked: boolean;
};

export type FamilyList = {
  id: string;
  title: string;
  type: string;
  icon?: string | null;
};

export type TextUpdate = {
  id: string;
  direction: "inbound" | "outbound";
  author: string;
  body: string;
  createdAt: string;
  convertedTo?: "event" | "chore" | "list";
};

export type DraftKind = "event" | "chore" | "list";

export type AssistantDraft = {
  kind: DraftKind;
  title: string;
  detail: string;
  confidence: number;
  rawText: string;
};

export type TabKey = "home" | "plan" | "chores" | "lists" | "thread" | "add";

export type SyncSource = "mock" | "api";

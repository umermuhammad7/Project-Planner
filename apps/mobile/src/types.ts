export type MemberRole = "parent" | "kid" | "caregiver";

export type FamilyMember = {
  id: string;
  userId?: string | null;
  name: string;
  initials: string;
  color: string;
  role: MemberRole;
  isVirtual?: boolean;
  starBalance: number;
};

export type PlanEvent = {
  id: string;
  title: string;
  time: string;
  dateLabel: string;
  startAt?: string | null;
  location?: string;
  countdownLabel?: string | null;
  assignedTo: string[];
  source: "manual" | "text" | "assistant";
  externalSource?: string | null;
  importedFrom?: string | null;
  externalCalendarId?: string | null;
};

export type CalendarConnection = {
  id: string;
  provider: "google" | "apple" | "outlook" | "ical";
  externalCalendarId: string | null;
  icalUrl: string | null;
  isActive: boolean;
  lastSyncedAt: string | null;
};

export type CalendarSyncStatus = {
  googleOAuthConfigured: boolean;
  googleConnectImplemented: boolean;
  icalImportImplemented: boolean;
  message: string;
};

export type CalendarConnectAttempt = {
  ok: boolean;
  message: string;
  authUrl?: string;
};

export type CalendarSyncConnectionResult = {
  connectionId: string;
  provider: CalendarConnection["provider"];
  added: number;
  skipped: number;
  failed: number;
  message: string;
};

export type CalendarSyncNowResponse = {
  ok: boolean;
  message: string;
  results: CalendarSyncConnectionResult[];
};

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  sentAt: string;
  readAt: string | null;
  familyId: string | null;
};

export type OfflineQueueStatus = "pending" | "failed";

export type OfflineQueueMutationType = "create_event" | "create_chore" | "create_list_item";

export type OfflineQueueCreateEventPayload = {
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  memberIds: string[];
};

export type OfflineQueueCreateChorePayload = {
  title: string;
  description: string | null;
  icon: string | null;
  starsValue: number;
  assignedTo: string | null;
  recurrenceRule: string | null;
  dueTime: string | null;
  isActive: boolean;
};

export type OfflineQueueCreateListItemPayload = {
  content: string;
  category: string | null;
  listId?: string | null;
  listTitle?: string;
  listType?: string;
};

export type OfflineQueueItem = {
  id: string;
  familyId: string;
  type: OfflineQueueMutationType;
  summary: string;
  payload:
    | OfflineQueueCreateEventPayload
    | OfflineQueueCreateChorePayload
    | OfflineQueueCreateListItemPayload;
  createdAt: string;
  status: OfflineQueueStatus;
  lastError: string | null;
};

/** @deprecated Use OfflineQueueItem */
export type PendingOfflineAction = {
  id: string;
  summary: string;
  createdAt: string;
};

export type Chore = {
  id: string;
  title: string;
  dueLabel: string;
  dueTime?: string | null;
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

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type RecipeIngredient = {
  name: string;
  amount?: string | null;
  unit?: string | null;
};

export type RecipeInstruction = {
  step?: number;
  text: string;
};

export type Recipe = {
  id: string;
  title: string;
  description?: string | null;
  ingredients: RecipeIngredient[];
  instructions?: RecipeInstruction[];
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  servings?: number | null;
};

export type RecipeImportDraft = {
  title: string;
  description?: string | null;
  ingredients: RecipeIngredient[];
  instructions?: RecipeInstruction[];
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  servings?: number | null;
};

export type RecipeImportResponse = {
  mode: "ai" | "local";
  provider: string | null;
  message: string;
  source: "text" | "url";
  recipe: RecipeImportDraft | null;
};

export type MealPlanItem = {
  id: string;
  dayOfWeek: number;
  mealType: MealType;
  title: string;
  notes?: string;
  recipeId?: string | null;
};

export type TextUpdate = {
  id: string;
  direction: "inbound" | "outbound";
  author: string;
  body: string;
  createdAt: string;
  convertedTo?: "event" | "chore" | "list" | "meal";
};

export type DraftKind = "event" | "chore" | "list";

export type AssistantDraft = {
  kind: DraftKind;
  title: string;
  detail: string;
  confidence: number;
  rawText: string;
};

export type AssistantIntent = "general" | "import_text" | "meal_plan" | "grocery_list" | "chores" | "day_summary";

export type AssistantContext = {
  familyName?: string;
  timezone?: string;
  today?: string;
  members?: string[];
  upcomingEvents?: Array<{
    title: string;
    time: string;
    dateLabel: string;
    location?: string | null;
    assignedTo?: string[];
  }>;
  openChores?: Array<{
    title: string;
    dueLabel: string;
  }>;
};

export type AssistantAssistResponse = {
  mode: "ai" | "local";
  provider: string | null;
  message: string;
  draft: AssistantDraft | null;
};

export type AssistantMealSuggestion = {
  dayOfWeek: number;
  mealType: MealType;
  title: string;
  notes?: string | null;
};

export type AssistantMealSuggestResponse = {
  mode: "ai" | "local";
  provider: string | null;
  message: string;
  suggestions: AssistantMealSuggestion[] | null;
};

export type TabKey = "home" | "plan" | "chores" | "lists" | "more";

export type MoreDestination = "hub" | "meals" | "board" | "assistant";

/** Routes reachable from Home shortcuts and legacy tab keys. */
export type ScreenDestination = TabKey | "meals" | "thread" | "assistant" | "add";

export type SyncSource = "mock" | "api";

export type SaveOutcomeKind = "saved" | "queued" | "local" | "failed";

export type SaveOutcomeField = "title" | "date" | "time";

export type HomeThreadSaveScope = "plan" | "chores" | "lists" | "meals" | "board" | "family";

export type SaveOutcome = {
  ok: boolean;
  kind: SaveOutcomeKind;
  message: string;
  invalidField?: SaveOutcomeField;
};

export type RealtimeSyncStatus = "inactive" | "connecting" | "connected" | "unavailable" | "error";

export type NotificationPrefs = {
  daily_digest: boolean;
  event_reminders: boolean;
  chore_reminders: boolean;
  family_activity: boolean;
};

export type NotificationPermissionState =
  | "unknown"
  | "granted"
  | "denied"
  | "undetermined"
  | "unsupported";

export type AuthStatusResponse = {
  supabaseConfigured: boolean;
  devTokenAllowed: boolean;
  mode: "supabase" | "dev_token" | "unconfigured";
};

export type AuthMeResponse = {
  user: {
    id: string;
    email?: string;
    displayName?: string | null;
    avatarUrl?: string | null;
    pushToken?: string | null;
    notificationPrefs?: NotificationPrefs;
  };
  memberships: Array<{
    member: {
      id: string;
      familyId: string;
      role: string;
    };
    family: {
      id: string;
      name: string;
    };
  }>;
};

export type NotificationPrefsResponse = {
  user: {
    id: string;
    notificationPrefs: NotificationPrefs;
    pushToken?: string | null;
  };
};

export type FamilySetupResponse = {
  family: {
    id: string;
    name: string;
    inviteCode: string;
  };
  member: {
    id: string;
    familyId: string;
    role: string;
    userId: string | null;
  };
};

export type MobileSubscriptionStatus = {
  familyId: string;
  subscriptionStatus: "free" | "plus" | "cancelled";
  subscriptionExpiresAt: string | null;
  revenueCatId: string | null;
  provider: "none" | "revenuecat";
  message: string;
};

export type TravelReminderStatus = {
  supported: boolean;
  reason: string;
  recommendedLeadMinutes: number | null;
  estimatedTravelMinutes: number | null;
  provider: "google_maps" | "unavailable";
};

export type InsightsWeekly = {
  windowDays: number;
  upcomingEvents: number;
  openChores: number;
  plannedMeals: number;
  unreadNotifications: number;
  activeMembers: number;
};

export type InsightsChoreMember = {
  memberId: string;
  name: string;
  role: string;
  completedCount: number;
  outstandingCount: number;
  starsEarned: number;
};

export type InsightsChores = {
  windowDays: number;
  members: InsightsChoreMember[];
};

export type InsightsBusynessDay = {
  dayLabel: string;
  eventCount: number;
};

export type InsightsBusynessMember = {
  memberId: string;
  name: string;
  eventCount: number;
};

export type InsightsBusyness = {
  windowDays: number;
  days: InsightsBusynessDay[];
  members: InsightsBusynessMember[];
};

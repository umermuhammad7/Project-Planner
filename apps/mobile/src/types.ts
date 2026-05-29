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

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type RecipeIngredient = {
  name: string;
  amount?: string | null;
  unit?: string | null;
};

export type Recipe = {
  id: string;
  title: string;
  ingredients: RecipeIngredient[];
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

export type AssistantIntent = "general" | "import_text" | "meal_plan" | "grocery_list" | "chores";

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

export type TabKey = "home" | "plan" | "chores" | "lists" | "meals" | "thread" | "add";

export type SyncSource = "mock" | "api";

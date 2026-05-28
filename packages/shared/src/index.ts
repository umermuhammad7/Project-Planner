import { z } from "zod";

export const uuidSchema = z.uuid();
export const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/u, "Expected a hex color like #4F6AF0");

export const memberRoleSchema = z.enum(["admin", "member", "child"]);
export const subscriptionStatusSchema = z.enum(["free", "plus", "cancelled"]);
export const listTypeSchema = z.enum(["grocery", "todo", "packing", "custom"]);
export const externalCalendarSourceSchema = z.enum(["google", "apple", "outlook"]);
export const completionScopeSchema = z.enum(["this", "future", "all"]).default("this");
export const mealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);

export const errorResponseSchema = z.object({
  error: z.string(),
  code: z.string()
});

export const userProfileSchema = z.object({
  displayName: z.string().min(1).max(80),
  avatarUrl: z.url().optional().nullable(),
  phone: z.string().max(32).optional().nullable(),
  timezone: z.string().min(1).max(80).default("UTC"),
  locale: z.string().min(2).max(12).default("en")
});

export const pushTokenSchema = z.object({
  pushToken: z.string().min(8).max(256)
});

export const createFamilySchema = z.object({
  name: z.string().min(1).max(80),
  avatarUrl: z.url().optional().nullable()
});

export const updateFamilySchema = createFamilySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one family field is required"
);

export const joinFamilySchema = z.object({
  inviteCode: z.string().min(4).max(12)
});

export const createMemberSchema = z.object({
  displayName: z.string().min(1).max(80),
  avatarUrl: z.url().optional().nullable(),
  color: hexColorSchema,
  role: memberRoleSchema.default("member"),
  isVirtual: z.boolean().default(true),
  dateOfBirth: z.iso.date().optional().nullable()
});

export const updateMemberSchema = createMemberSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one member field is required"
);

export const createEventSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(2000).optional().nullable(),
  location: z.string().max(240).optional().nullable(),
  locationLat: z.number().min(-90).max(90).optional().nullable(),
  locationLng: z.number().min(-180).max(180).optional().nullable(),
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
  allDay: z.boolean().default(false),
  color: hexColorSchema.optional().nullable(),
  recurrenceRule: z.string().max(500).optional().nullable(),
  recurrenceEndAt: z.iso.datetime().optional().nullable(),
  memberIds: z.array(uuidSchema).default([])
});

export const updateEventSchema = createEventSchema.partial().extend({
  memberIds: z.array(uuidSchema).optional()
}).refine((value) => Object.keys(value).length > 0, "At least one event field is required");

export const listEventsQuerySchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  memberId: uuidSchema.optional()
});

export const createChoreSchema = z.object({
  title: z.string().min(1).max(140),
  description: z.string().max(1000).optional().nullable(),
  icon: z.string().max(80).optional().nullable(),
  starsValue: z.int().min(0).max(100).default(1),
  assignedTo: uuidSchema.optional().nullable(),
  recurrenceRule: z.string().max(500).optional().nullable(),
  dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/u).optional().nullable(),
  isActive: z.boolean().default(true)
});

export const updateChoreSchema = createChoreSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one chore field is required"
);

export const completeChoreSchema = z.object({
  memberId: uuidSchema,
  dueDate: z.iso.date(),
  notes: z.string().max(1000).optional().nullable(),
  photoUrl: z.url().optional().nullable()
});

export const createListSchema = z.object({
  title: z.string().min(1).max(80),
  type: listTypeSchema.default("custom"),
  color: hexColorSchema.optional().nullable(),
  icon: z.string().max(80).optional().nullable(),
  isShared: z.boolean().default(true)
});

export const updateListSchema = createListSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one list field is required"
);

export const createListItemSchema = z.object({
  content: z.string().min(1).max(160),
  category: z.string().max(80).optional().nullable(),
  quantity: z.string().max(40).optional().nullable(),
  sortOrder: z.int().min(0).max(100000).optional()
});

export const updateListItemSchema = z.object({
  content: z.string().min(1).max(160).optional(),
  category: z.string().max(80).optional().nullable(),
  quantity: z.string().max(40).optional().nullable(),
  isChecked: z.boolean().optional(),
  sortOrder: z.int().min(0).max(100000).optional()
}).refine((value) => Object.keys(value).length > 0, "At least one list item field is required");

export const mealWeekQuerySchema = z.object({
  weekStart: z.iso.date().optional()
});

export const mealPlanItemInputSchema = z.object({
  dayOfWeek: z.int().min(0).max(6),
  mealType: mealTypeSchema,
  recipeId: uuidSchema.optional().nullable(),
  customTitle: z.string().min(1).max(160).optional().nullable(),
  notes: z.string().max(500).optional().nullable()
}).refine((value) => Boolean(value.recipeId || value.customTitle), {
  message: "A meal item needs either a recipeId or customTitle"
});

export const saveMealPlanSchema = z.object({
  weekStart: z.iso.date(),
  items: z.array(mealPlanItemInputSchema).max(28)
});

export const recipeIngredientSchema = z.object({
  name: z.string().min(1).max(120),
  amount: z.string().max(40).optional().nullable(),
  unit: z.string().max(40).optional().nullable()
});

export const recipeInstructionSchema = z.object({
  step: z.number().int().min(1).max(50).optional(),
  text: z.string().min(1).max(500)
});

export const createRecipeSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(2000).optional().nullable(),
  ingredients: z.array(recipeIngredientSchema).min(1).max(50),
  instructions: z.array(recipeInstructionSchema).max(30).optional(),
  prepTimeMinutes: z.number().int().min(0).max(600).optional().nullable(),
  cookTimeMinutes: z.number().int().min(0).max(600).optional().nullable(),
  servings: z.number().int().min(1).max(50).optional().nullable()
});

export const mealToGrocerySchema = z.object({
  recipeId: uuidSchema.optional(),
  mealPlanItemId: uuidSchema.optional(),
  listId: uuidSchema.optional()
}).refine((value) => Boolean(value.recipeId || value.mealPlanItemId), {
  message: "recipeId or mealPlanItemId is required"
});

export const mealWeekToGrocerySchema = z.object({
  weekStart: z.iso.date().optional(),
  listId: uuidSchema.optional()
});

export type UserProfileInput = z.infer<typeof userProfileSchema>;
export type CreateFamilyInput = z.infer<typeof createFamilySchema>;
export type UpdateFamilyInput = z.infer<typeof updateFamilySchema>;
export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type CreateChoreInput = z.infer<typeof createChoreSchema>;
export type UpdateChoreInput = z.infer<typeof updateChoreSchema>;
export type CompleteChoreInput = z.infer<typeof completeChoreSchema>;
export type CreateListInput = z.infer<typeof createListSchema>;
export type UpdateListInput = z.infer<typeof updateListSchema>;
export type CreateListItemInput = z.infer<typeof createListItemSchema>;
export type UpdateListItemInput = z.infer<typeof updateListItemSchema>;
export type MealWeekQueryInput = z.infer<typeof mealWeekQuerySchema>;
export type MealPlanItemInput = z.infer<typeof mealPlanItemInputSchema>;
export type SaveMealPlanInput = z.infer<typeof saveMealPlanSchema>;
export type RecipeIngredientInput = z.infer<typeof recipeIngredientSchema>;
export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;
export type MealToGroceryInput = z.infer<typeof mealToGrocerySchema>;
export type MealWeekToGroceryInput = z.infer<typeof mealWeekToGrocerySchema>;

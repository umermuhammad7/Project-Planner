import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  decimal,
  index,
  integer,
  jsonb,
  pgSchema,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  unique,
  uuid
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

const authSchema = pgSchema("auth");

export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey()
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().references(() => authUsers.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  displayNameSetByUser: boolean("display_name_set_by_user").notNull().default(false),
  avatarUrl: text("avatar_url"),
  phone: text("phone"),
  timezone: text("timezone").notNull().default("UTC"),
  locale: text("locale").notNull().default("en"),
  pushToken: text("push_token"),
  notificationPrefs: jsonb("notification_prefs")
    .notNull()
    .default({
      notifications_enabled: true,
      daily_digest: true,
      event_reminders: true,
      chore_reminders: true,
      family_activity: true
    }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const families = pgTable(
  "families",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    avatarUrl: text("avatar_url"),
    inviteCode: text("invite_code")
      .notNull()
      .unique()
      .default(sql`substr(md5(random()::text), 0, 9)`),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    subscriptionStatus: text("subscription_status").notNull().default("free"),
    subscriptionExpiresAt: timestamp("subscription_expires_at", { withTimezone: true }),
    revenueCatId: text("revenue_cat_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    subscriptionStatusCheck: check(
      "families_subscription_status_check",
      sql`${table.subscriptionStatus} in ('free', 'plus', 'cancelled')`
    )
  })
);

export const familyMembers = pgTable(
  "family_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    color: text("color").notNull(),
    role: text("role").notNull().default("member"),
    isVirtual: boolean("is_virtual").notNull().default(false),
    dateOfBirth: date("date_of_birth"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    uniqueFamilyUser: unique("family_members_family_id_user_id_unique").on(table.familyId, table.userId),
    roleCheck: check("family_members_role_check", sql`${table.role} in ('admin', 'member', 'child')`),
    familyIdx: index("idx_family_members_family").on(table.familyId),
    userIdx: index("idx_family_members_user").on(table.userId)
  })
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    location: text("location"),
    locationLat: decimal("location_lat", { precision: 9, scale: 6 }),
    locationLng: decimal("location_lng", { precision: 9, scale: 6 }),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    allDay: boolean("all_day").notNull().default(false),
    color: text("color"),
    recurrenceRule: text("recurrence_rule"),
    recurrenceEndAt: timestamp("recurrence_end_at", { withTimezone: true }),
    originalEventId: uuid("original_event_id").references((): AnyPgColumn => events.id),
    externalCalendarId: text("external_calendar_id"),
    externalSource: text("external_source"),
    importedFrom: text("imported_from"),
    countdownLabel: text("countdown_label"),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    familyStartIdx: index("idx_events_family_start").on(table.familyId, table.startAt)
  })
);

export const eventMembers = pgTable(
  "event_members",
  {
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" })
  },
  (table) => ({
    pk: primaryKey({ columns: [table.eventId, table.memberId] }),
    memberIdx: index("idx_event_members_member").on(table.memberId)
  })
);

export const chores = pgTable(
  "chores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    icon: text("icon"),
    starsValue: integer("stars_value").notNull().default(1),
    assignedTo: uuid("assigned_to").references(() => familyMembers.id, { onDelete: "set null" }),
    recurrenceRule: text("recurrence_rule"),
    dueTime: time("due_time"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    familyIdx: index("idx_chores_family").on(table.familyId),
    assignedToIdx: index("idx_chores_assigned_to").on(table.assignedTo)
  })
);

export const choreCompletions = pgTable(
  "chore_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    choreId: uuid("chore_id").notNull().references(() => chores.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
    dueDate: date("due_date").notNull(),
    notes: text("notes"),
    photoUrl: text("photo_url")
  },
  (table) => ({
    memberIdx: index("idx_chore_completions_member").on(table.memberId, table.dueDate)
  })
);

export const rewards = pgTable(
  "rewards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
    stars: integer("stars").notNull(),
    reason: text("reason").notNull(),
    referenceId: uuid("reference_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    memberIdx: index("idx_rewards_member").on(table.memberId, table.createdAt)
  })
);

export const rewardPrizes = pgTable(
  "reward_prizes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    starsCost: integer("stars_cost").notNull(),
    isActive: boolean("is_active").notNull().default(true)
  },
  (table) => ({
    familyIdx: index("idx_reward_prizes_family").on(table.familyId)
  })
);

export const lists = pgTable(
  "lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: text("type").notNull().default("custom"),
    color: text("color"),
    icon: text("icon"),
    isShared: boolean("is_shared").notNull().default(true),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    typeCheck: check("lists_type_check", sql`${table.type} in ('grocery', 'todo', 'packing', 'custom')`)
  })
);

export const listItems = pgTable(
  "list_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id").notNull().references(() => lists.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    category: text("category"),
    quantity: text("quantity"),
    isChecked: boolean("is_checked").notNull().default(false),
    checkedBy: uuid("checked_by").references(() => familyMembers.id),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    listIdx: index("idx_list_items_list").on(table.listId, table.sortOrder)
  })
);

export const mealPlans = pgTable(
  "meal_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    uniqueFamilyWeek: unique("meal_plans_family_id_week_start_unique").on(table.familyId, table.weekStart)
  })
);

export const recipes = pgTable(
  "recipes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").references(() => families.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    ingredients: jsonb("ingredients").notNull().default([]),
    instructions: jsonb("instructions").notNull().default([]),
    prepTimeMinutes: integer("prep_time_minutes"),
    cookTimeMinutes: integer("cook_time_minutes"),
    servings: integer("servings"),
    imageUrl: text("image_url"),
    sourceUrl: text("source_url"),
    tags: text("tags").array(),
    nutrition: jsonb("nutrition"),
    isFavorite: boolean("is_favorite").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    familyIdx: index("idx_recipes_family").on(table.familyId)
  })
);

export const mealPlanItems = pgTable(
  "meal_plan_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id").notNull().references(() => mealPlans.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id").references(() => recipes.id, { onDelete: "set null" }),
    dayOfWeek: integer("day_of_week").notNull(),
    mealType: text("meal_type").notNull(),
    customTitle: text("custom_title"),
    notes: text("notes")
  },
  (table) => ({
    dayCheck: check("meal_plan_items_day_of_week_check", sql`${table.dayOfWeek} between 0 and 6`),
    mealTypeCheck: check("meal_plan_items_meal_type_check", sql`${table.mealType} in ('breakfast', 'lunch', 'dinner', 'snack')`),
    planIdx: index("idx_meal_plan_items_plan").on(table.planId)
  })
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    familyId: uuid("family_id").references(() => families.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    data: jsonb("data"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
    pushTicket: text("push_ticket")
  },
  (table) => ({
    userIdx: index("idx_notifications_user").on(table.userId, table.sentAt),
    familyIdx: index("idx_notifications_family").on(table.familyId)
  })
);

export const calendarConnections = pgTable(
  "calendar_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    externalCalendarId: text("external_calendar_id"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    syncToken: text("sync_token"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    providerCheck: check("calendar_connections_provider_check", sql`${table.provider} in ('google', 'apple', 'outlook')`),
    userIdx: index("idx_calendar_connections_user").on(table.userId),
    familyIdx: index("idx_calendar_connections_family").on(table.familyId)
  })
);

export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    messages: jsonb("messages").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userIdx: index("idx_ai_conversations_user").on(table.userId),
    familyIdx: index("idx_ai_conversations_family").on(table.familyId)
  })
);

export const childPairingCodes = pgTable(
  "child_pairing_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
    code: text("code").notNull().unique(),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    familyIdx: index("idx_child_pairing_codes_family").on(table.familyId),
    memberIdx: index("idx_child_pairing_codes_member").on(table.memberId)
  })
);

export const childDevices = pgTable(
  "child_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull().references(() => familyMembers.id, { onDelete: "cascade" }),
    pairingCodeId: uuid("pairing_code_id").references(() => childPairingCodes.id, { onDelete: "set null" }),
    deviceToken: text("device_token").notNull().unique(),
    pushToken: text("push_token"),
    deviceLabel: text("device_label"),
    pairedAt: timestamp("paired_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
  },
  (table) => ({
    familyIdx: index("idx_child_devices_family").on(table.familyId),
    memberIdx: index("idx_child_devices_member").on(table.memberId)
  })
);

export const childPairingAttempts = pgTable("child_pairing_attempts", {
  clientKey: text("client_key").primaryKey(),
  failureCount: integer("failure_count").notNull().default(0),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

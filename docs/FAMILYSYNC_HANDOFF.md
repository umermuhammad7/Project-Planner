# FamilySync — Full Codex Handoff Document
> Complete specification for building a family calendar & organizer app for iOS and Android.  
> Read every section before writing any code. This document is the single source of truth.

---

# Current Working Handoff
> Updated Sunday, July 19, 2026. Read this section first. If anything below conflicts with this handoff, follow this handoff.

## Current Scope

- Work only in `E:\project planner\Project-Planner`.
- Focus only on the HomeThread app.
- Do not touch `E:\project tax tracker`.
- Do not open the UI or browser yourself.
- We are now working with Claude Code, not Cursor.

## Working Style

- Use a supervisor-style workflow with short, strict prompts to the coding agent.
- Let the coding agent make the change, then verify the result.
- Use ponytail rules: prefer reuse, the smallest safe diff, and no unnecessary abstractions.
- Use GitNexus before any logic-touching work or risky auth, calendar, or backend work.

## Main Docs To Follow

- `final corrections/FINAL_TODO.md`
- `final corrections/information from the devaloper .md`
- `final corrections/refined.md`
- `final corrections/screens critigue by me.txt`
- `docs/FAMILYSYNC_HANDOFF.md`

## Current Product Status

- Welcome screen: paused, good enough for now.
- Home screen: paused, good enough for now.
- Plan screen: closed-state UI is now acceptable enough.
- Remaining Plan UI work: final form-focus pass for Add/Edit plan.
- Deferred Plan logic work: weather incorrectly becoming plan items, and real calendar sync/auth truth.

## Plan Screen Decisions Already Made

- Stop redesigning the closed-state top/header/list.
- Many-plan usability was addressed enough for now.
- Upcoming groups first.
- Earlier moved to bottom.
- Earlier can be collapsed when large.
- Search appears for larger plan counts.
- No more visual churn on the closed-state list unless there is a serious defect.

## What Is Still Wrong On The Plan Form

- Add/Edit form still does not feel like a true focused compose flow.
- Bottom tab bar is still visible in the screenshot.
- Form still feels embedded in the screen instead of becoming the active task.
- Primary action is not clearly anchored in a bottom footer.
- Lower part of the form collides with bottom chrome.
- Date/time controls still feel too large and awkward.
- Assignee area gets cramped low in the screen.

## Next Task

Do a final safe UI pass for the Plan form only.

## Allowed Files

- `apps/mobile/src/screens/PlanScreen.tsx`
- optionally `apps/mobile/src/components/DateField.tsx`
- optionally `apps/mobile/src/components/TimeField.tsx`

## Do Not Touch

- create/update/delete logic
- sorting/search/grouping logic
- calendar auth/sync logic
- backend/store logic
- package files

## Required Outcome Of The Next Pass

- `showForm` should behave like a true focused compose state.
- No week card, agenda, travel tip, or calendar footer should be visible while the form is open.
- The form should read as 3 zones: top header, scrollable field body, anchored bottom action footer.
- If there is a safe existing way to hide the tab bar, use it.
- Otherwise the compose layer must visually cover the lower area cleanly.
- Do not falsely claim the tab bar is hidden if it is still visible.
- Date/time controls should match the rhythm of normal inputs, not oversized blocks.
- Assignee chips must remain fully usable and not crushed near the bottom.

## Calendar Intent

- Calendar sync is for connecting external calendars like Google Calendar and iCal.
- The purpose is to bring outside events into HomeThread.
- It is not about importing events from a geographic area.
- Location, weather, and travel reminders are separate concerns.
- Safe future direction: read-in sync first, push-back later.
- A later logic pass should verify timezone handling, duplicates, imported-event updates, and honest connection state, with GitNexus first.

## Honest Closed-State Calendar Footer Copy

- Title: `Calendar`
- Body: `Connect a calendar to bring outside events into your family plan`
- Action: `Connect` or `Manage`

## Required Verification After The Next Pass

Run these checks after the coding agent finishes:

- `git status --short`
- `git diff -- apps/mobile/src/screens/PlanScreen.tsx apps/mobile/src/components/DateField.tsx apps/mobile/src/components/TimeField.tsx`
- `npm run typecheck` from `E:\project planner\Project-Planner\apps\mobile`

## Stop Condition

- Once the form pass is done well, stop Plan UI work.
- The next Plan work after that should be logic-only debugging for weather/calendar, using GitNexus first.

---

## 0. Project Overview

**App name:** FamilySync  
**Tagline:** "Your family, in sync."  
**What it is:** A cross-platform mobile app (iOS + Android) that replaces sticky notes, group chats, and paper schedules with a beautiful shared family hub — calendars, chores, meals, lists, and AI assistance in one place.  
**Target users:** Parents with children, co-parenting households, multi-generational families.  
**Monetization:** Freemium — generous free tier, one flat "Family Plus" subscription at $4.99/month or $39.99/year.  
**Database:** PostgreSQL (already provisioned by developer).

---

## 1. Tech Stack

### Mobile App
| Layer | Choice | Why |
|---|---|---|
| Framework | React Native 0.74+ | Single codebase for iOS + Android |
| Build tooling | Expo SDK 51 (managed workflow) | Simplest path to App Store + Play Store |
| Navigation | React Navigation v6 | Industry standard, well-documented |
| State management | Zustand | Lightweight, no boilerplate |
| Server state | TanStack Query (React Query v5) | Caching, background sync, offline support |
| Styling | NativeWind v4 (Tailwind for RN) | Consistent design system |
| Forms | React Hook Form + Zod | Validation, great DX |
| Animations | React Native Reanimated 3 | Smooth 60fps animations |
| Gestures | React Native Gesture Handler | Required by Reanimated |
| Icons | @expo/vector-icons (Ionicons) | Built-in with Expo |
| Calendar UI | react-native-calendars | Proven calendar component |
| Notifications | expo-notifications | Push + local notifications |
| Widgets | expo-widget (iOS) + via native module (Android) | Home screen widgets |
| Storage (offline) | expo-sqlite + MMKV | Local persistence |
| Image handling | expo-image | Fast, cached image display |
| Haptics | expo-haptics | Tactile feedback |

### Backend
| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js 20 LTS | Stable, well-supported |
| Framework | Fastify v4 | Faster than Express, schema validation built-in |
| ORM | Drizzle ORM | Type-safe, lightweight, works great with Postgres |
| Database | PostgreSQL (existing) | Already provisioned |
| Auth | Supabase Auth | JWT, social login, email magic link — free tier |
| Real-time | Supabase Realtime | WebSocket sync across devices |
| File storage | Supabase Storage | Profile photos, recipe images |
| AI features | OpenAI API (GPT-4o-mini) | Meal planning, smart assistant, import parsing |
| Email | Resend | Transactional emails, free tier generous |
| Push notifications | Expo Push Notification Service | Free, handles APNs + FCM |
| Job queue | pg-boss | Postgres-backed job queue (no Redis needed) |
| Validation | Zod | Shared schema between frontend and backend |

### DevOps / Infrastructure
| Layer | Choice |
|---|---|
| Backend hosting | Railway (free tier → $5/month starter) |
| Postgres hosting | Your existing Postgres |
| CI/CD | GitHub Actions |
| App builds | EAS Build (Expo Application Services) — free tier |
| App submission | EAS Submit |
| Monitoring | Sentry (free tier) |
| Analytics | PostHog (free, self-hostable) |

---

## 2. File & Folder Structure

```
familysync/
├── apps/
│   └── mobile/                          # React Native app (Expo)
│       ├── app.json                     # Expo config
│       ├── eas.json                     # EAS Build config
│       ├── babel.config.js
│       ├── metro.config.js
│       ├── tailwind.config.js           # NativeWind config
│       ├── tsconfig.json
│       ├── .env                         # EXPO_PUBLIC_API_URL, EXPO_PUBLIC_SUPABASE_URL, etc.
│       │
│       ├── src/
│       │   ├── app/                     # Expo Router file-based navigation
│       │   │   ├── _layout.tsx          # Root layout (fonts, theme, auth gate)
│       │   │   ├── index.tsx            # Splash / redirect
│       │   │   │
│       │   │   ├── (auth)/              # Auth flow (no tab bar)
│       │   │   │   ├── _layout.tsx
│       │   │   │   ├── welcome.tsx      # Onboarding / landing
│       │   │   │   ├── login.tsx
│       │   │   │   ├── register.tsx
│       │   │   │   └── forgot-password.tsx
│       │   │   │
│       │   │   ├── (onboarding)/        # First-time setup wizard
│       │   │   │   ├── _layout.tsx
│       │   │   │   ├── create-family.tsx
│       │   │   │   ├── add-members.tsx
│       │   │   │   ├── sync-calendars.tsx
│       │   │   │   └── choose-plan.tsx
│       │   │   │
│       │   │   └── (tabs)/              # Main app (tab bar visible)
│       │   │       ├── _layout.tsx      # Tab bar config
│       │   │       ├── home.tsx         # Dashboard / today view
│       │   │       ├── calendar.tsx     # Full calendar
│       │   │       ├── chores.tsx       # Chores & routines
│       │   │       ├── lists.tsx        # Shopping & to-do lists
│       │   │       └── more.tsx         # Meals, settings, insights, account
│       │   │
│       │   ├── components/
│       │   │   ├── ui/                  # Primitive UI components
│       │   │   │   ├── Button.tsx
│       │   │   │   ├── Card.tsx
│       │   │   │   ├── Input.tsx
│       │   │   │   ├── Modal.tsx
│       │   │   │   ├── Avatar.tsx
│       │   │   │   ├── Badge.tsx
│       │   │   │   ├── Chip.tsx
│       │   │   │   ├── Skeleton.tsx     # Loading placeholders
│       │   │   │   ├── SwipeableRow.tsx # Swipe to delete/complete
│       │   │   │   ├── BottomSheet.tsx  # Action sheets
│       │   │   │   └── Toast.tsx
│       │   │   │
│       │   │   ├── calendar/
│       │   │   │   ├── CalendarStrip.tsx       # Horizontal day scroller
│       │   │   │   ├── MonthView.tsx
│       │   │   │   ├── WeekView.tsx
│       │   │   │   ├── AgendaView.tsx
│       │   │   │   ├── EventCard.tsx
│       │   │   │   ├── EventForm.tsx           # Create/edit event modal
│       │   │   │   ├── MemberDot.tsx           # Color-coded family member dot
│       │   │   │   └── CountdownBadge.tsx
│       │   │   │
│       │   │   ├── chores/
│       │   │   │   ├── ChoreCard.tsx
│       │   │   │   ├── ChoreForm.tsx
│       │   │   │   ├── RoutineList.tsx
│       │   │   │   ├── StarReward.tsx          # Animated star burst on completion
│       │   │   │   ├── StreakBadge.tsx
│       │   │   │   └── KidsView.tsx            # Simplified UI for children
│       │   │   │
│       │   │   ├── meals/
│       │   │   │   ├── MealPlanGrid.tsx        # Week grid of meals
│       │   │   │   ├── RecipeCard.tsx
│       │   │   │   ├── RecipeImport.tsx        # URL/photo import
│       │   │   │   ├── MealSuggestion.tsx      # AI suggestion card
│       │   │   │   └── NutritionBadge.tsx
│       │   │   │
│       │   │   ├── lists/
│       │   │   │   ├── ListContainer.tsx
│       │   │   │   ├── ListItem.tsx
│       │   │   │   ├── CheckableItem.tsx
│       │   │   │   └── CategoryGroup.tsx       # Auto-grouped grocery items
│       │   │   │
│       │   │   ├── ai/
│       │   │   │   ├── AIChatSheet.tsx         # AI assistant bottom sheet
│       │   │   │   ├── AIMessageBubble.tsx
│       │   │   │   └── QuickPrompts.tsx        # Suggested prompts
│       │   │   │
│       │   │   ├── home/
│       │   │   │   ├── TodaySummary.tsx
│       │   │   │   ├── UpcomingEvents.tsx
│       │   │   │   ├── ChoresDueToday.tsx
│       │   │   │   ├── WeatherWidget.tsx
│       │   │   │   ├── FamilyFeed.tsx          # Activity / memory feed
│       │   │   │   └── QuickAdd.tsx            # FAB for quick entry
│       │   │   │
│       │   │   └── shared/
│       │   │       ├── MemberPicker.tsx
│       │   │       ├── ColorPicker.tsx
│       │   │       ├── DateTimePicker.tsx
│       │   │       ├── RecurrenceSelector.tsx
│       │   │       ├── OfflineBanner.tsx       # Shows when offline
│       │   │       └── SyncStatus.tsx
│       │   │
│       │   ├── hooks/
│       │   │   ├── useFamily.ts
│       │   │   ├── useEvents.ts
│       │   │   ├── useChores.ts
│       │   │   ├── useMeals.ts
│       │   │   ├── useLists.ts
│       │   │   ├── useMembers.ts
│       │   │   ├── useNotifications.ts
│       │   │   ├── useOfflineSync.ts
│       │   │   ├── useAIAssistant.ts
│       │   │   └── useWeather.ts
│       │   │
│       │   ├── stores/
│       │   │   ├── authStore.ts         # User session, profile
│       │   │   ├── familyStore.ts       # Active family, members
│       │   │   ├── uiStore.ts           # Theme, modal state
│       │   │   └── offlineStore.ts      # Pending mutations queue
│       │   │
│       │   ├── services/
│       │   │   ├── api.ts               # Axios instance, base URL, auth headers
│       │   │   ├── supabase.ts          # Supabase client init
│       │   │   ├── calendarSync.ts      # Google/Apple calendar sync logic
│       │   │   ├── pushNotifications.ts # Register, handle, schedule
│       │   │   ├── offlineQueue.ts      # Local-first mutation queue
│       │   │   └── analytics.ts        # PostHog wrapper
│       │   │
│       │   ├── utils/
│       │   │   ├── colors.ts            # Family color palette, member color assignment
│       │   │   ├── dates.ts             # date-fns helpers
│       │   │   ├── recurrence.ts        # rrule helpers
│       │   │   ├── formatting.ts        # Currency, duration, relative time
│       │   │   └── validation.ts        # Shared Zod schemas
│       │   │
│       │   ├── constants/
│       │   │   ├── theme.ts             # Colors, spacing, typography
│       │   │   ├── routes.ts            # Route name constants
│       │   │   └── config.ts            # API URLs, feature flags
│       │   │
│       │   └── types/
│       │       ├── api.ts               # API response types
│       │       ├── models.ts            # Core domain types (Event, Chore, Member, etc.)
│       │       └── navigation.ts        # Navigation param types
│       │
│       └── assets/
│           ├── fonts/
│           │   ├── DMSans-Regular.ttf
│           │   ├── DMSans-Medium.ttf
│           │   └── DMSans-Bold.ttf
│           ├── images/
│           │   ├── onboarding-1.png
│           │   ├── onboarding-2.png
│           │   └── onboarding-3.png
│           └── icons/
│               ├── icon.png             # 1024x1024 app icon
│               ├── adaptive-icon.png    # Android adaptive icon
│               └── splash.png          # Splash screen
│
├── apps/
│   └── backend/                         # Fastify API server
│       ├── package.json
│       ├── tsconfig.json
│       ├── .env                         # DATABASE_URL, SUPABASE_*, OPENAI_API_KEY, etc.
│       ├── drizzle.config.ts
│       │
│       ├── src/
│       │   ├── index.ts                 # Server entry, plugin registration
│       │   ├── config.ts                # Env vars, validated with Zod
│       │   │
│       │   ├── db/
│       │   │   ├── index.ts             # Drizzle + pg pool init
│       │   │   ├── schema/
│       │   │   │   ├── index.ts         # Re-exports all schemas
│       │   │   │   ├── users.ts
│       │   │   │   ├── families.ts
│       │   │   │   ├── members.ts
│       │   │   │   ├── events.ts
│       │   │   │   ├── chores.ts
│       │   │   │   ├── lists.ts
│       │   │   │   ├── meals.ts
│       │   │   │   ├── recipes.ts
│       │   │   │   ├── rewards.ts
│       │   │   │   ├── notifications.ts
│       │   │   │   └── subscriptions.ts
│       │   │   └── migrations/          # Auto-generated by drizzle-kit
│       │   │
│       │   ├── plugins/
│       │   │   ├── auth.ts              # Supabase JWT verification plugin
│       │   │   ├── cors.ts
│       │   │   ├── rateLimit.ts
│       │   │   ├── sensible.ts          # Error helpers
│       │   │   └── swagger.ts           # Auto API docs
│       │   │
│       │   ├── routes/
│       │   │   ├── index.ts             # Register all route plugins
│       │   │   ├── auth.ts              # /auth/* (profile, preferences)
│       │   │   ├── families.ts          # /families/*
│       │   │   ├── members.ts           # /families/:id/members/*
│       │   │   ├── events.ts            # /families/:id/events/*
│       │   │   ├── chores.ts            # /families/:id/chores/*
│       │   │   ├── lists.ts             # /families/:id/lists/*
│       │   │   ├── meals.ts             # /families/:id/meals/*
│       │   │   ├── recipes.ts           # /recipes/*
│       │   │   ├── rewards.ts           # /families/:id/rewards/*
│       │   │   ├── ai.ts                # /ai/* (assistant, meal suggest, import)
│       │   │   ├── calendar-sync.ts     # /calendar-sync/* (Google, Apple)
│       │   │   ├── notifications.ts     # /notifications/*
│       │   │   ├── subscriptions.ts     # /subscriptions/* (Stripe/RevenueCat)
│       │   │   ├── insights.ts          # /families/:id/insights/*
│       │   │   └── webhooks.ts          # /webhooks/* (Stripe, etc.)
│       │   │
│       │   ├── services/
│       │   │   ├── ai.service.ts        # OpenAI calls, prompt templates
│       │   │   ├── calendar.service.ts  # Google Calendar API, iCal parsing
│       │   │   ├── notification.service.ts  # Expo push, scheduling
│       │   │   ├── recipe.service.ts    # URL scraping, photo OCR via OpenAI
│       │   │   ├── weather.service.ts   # Open-Meteo API (free, no key needed)
│       │   │   ├── email.service.ts     # Resend integration
│       │   │   ├── subscription.service.ts  # RevenueCat webhooks
│       │   │   └── insights.service.ts  # Family stats aggregation
│       │   │
│       │   ├── jobs/
│       │   │   ├── index.ts             # pg-boss init, register all jobs
│       │   │   ├── dailyDigest.job.ts   # Morning family summary push notification
│       │   │   ├── choreReminder.job.ts # Scheduled chore reminders
│       │   │   ├── travelReminder.job.ts # Smart travel-time reminders
│       │   │   ├── weeklyInsights.job.ts # Sunday insights email
│       │   │   └── calendarPoll.job.ts  # Poll external calendars every 15min
│       │   │
│       │   ├── middleware/
│       │   │   ├── requireAuth.ts
│       │   │   ├── requireFamily.ts     # User must be a member of :familyId
│       │   │   └── requirePlus.ts       # Gate Plus-only routes
│       │   │
│       │   └── utils/
│       │       ├── rrule.ts             # Recurrence rule helpers
│       │       ├── travel.ts            # Google Maps Distance Matrix
│       │       └── errors.ts            # Typed error classes
│       │
│       └── scripts/
│           ├── seed.ts                  # Dev seed data
│           └── migrate.ts              # Run migrations
│
├── packages/
│   └── shared/                          # Shared types & validation (monorepo)
│       ├── package.json
│       ├── src/
│       │   ├── types.ts                 # All shared TypeScript interfaces
│       │   └── schemas.ts               # Shared Zod schemas
│
├── package.json                         # Turborepo / pnpm workspace root
├── pnpm-workspace.yaml
├── turbo.json
├── .gitignore
└── README.md
```

---

## 3. Database Schema (PostgreSQL / Drizzle ORM)

Implement every table below exactly as specified. All UUIDs use `gen_random_uuid()`.

```sql
-- USERS (mirrors Supabase auth.users, extended profile)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  locale TEXT NOT NULL DEFAULT 'en',
  push_token TEXT,              -- Expo push token
  notification_prefs JSONB NOT NULL DEFAULT '{"daily_digest": true, "event_reminders": true, "chore_reminders": true, "family_activity": true}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FAMILIES
CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  avatar_url TEXT,
  invite_code TEXT NOT NULL UNIQUE DEFAULT substr(md5(random()::text), 0, 9),
  created_by UUID NOT NULL REFERENCES users(id),
  subscription_status TEXT NOT NULL DEFAULT 'free' CHECK (subscription_status IN ('free', 'plus', 'cancelled')),
  subscription_expires_at TIMESTAMPTZ,
  revenue_cat_id TEXT,          -- RevenueCat customer ID
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FAMILY_MEMBERS (many-to-many users <> families)
CREATE TABLE family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- NULL for kid profiles without accounts
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  color TEXT NOT NULL,           -- Hex color, e.g. '#FF6B6B'
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'child')),
  is_virtual BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE for kids/pets without logins
  date_of_birth DATE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(family_id, user_id)
);

-- EVENTS
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  location_lat DECIMAL(9,6),
  location_lng DECIMAL(9,6),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT FALSE,
  color TEXT,                    -- Override member color
  recurrence_rule TEXT,          -- RRULE string e.g. 'FREQ=WEEKLY;BYDAY=MO,WE,FR'
  recurrence_end_at TIMESTAMPTZ,
  original_event_id UUID REFERENCES events(id),  -- For edited recurrence instances
  external_calendar_id TEXT,     -- Google Calendar event ID
  external_source TEXT,          -- 'google' | 'apple' | 'outlook'
  imported_from TEXT,            -- 'email' | 'pdf' | 'photo'
  countdown_label TEXT,          -- e.g. 'Family Vacation!'
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- EVENT_MEMBERS (who is this event for)
CREATE TABLE event_members (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, member_id)
);

-- CHORES
CREATE TABLE chores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,                     -- Ionicons name
  stars_value INTEGER NOT NULL DEFAULT 1,
  assigned_to UUID REFERENCES family_members(id) ON DELETE SET NULL,
  recurrence_rule TEXT,          -- RRULE string
  due_time TIME,                 -- Time of day (e.g. '08:00:00')
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CHORE_COMPLETIONS
CREATE TABLE chore_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chore_id UUID NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date DATE NOT NULL,        -- Which day's instance this completes
  notes TEXT,
  photo_url TEXT                 -- Optional proof photo
);

-- REWARDS (Points/stars ledger)
CREATE TABLE rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  stars INTEGER NOT NULL,        -- Positive = earned, negative = spent
  reason TEXT NOT NULL,          -- 'chore_complete' | 'bonus' | 'redeemed'
  reference_id UUID,             -- chore_completion_id or null
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- REWARD_PRIZES (what stars can be redeemed for)
CREATE TABLE reward_prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title TEXT NOT NULL,           -- e.g. 'Extra screen time'
  stars_cost INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- LISTS
CREATE TABLE lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'custom' CHECK (type IN ('grocery', 'todo', 'packing', 'custom')),
  color TEXT,
  icon TEXT,
  is_shared BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- LIST_ITEMS
CREATE TABLE list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  category TEXT,                 -- 'produce', 'dairy', etc. (AI-auto-categorized for groceries)
  quantity TEXT,                 -- '2 lbs', '1 dozen', etc.
  is_checked BOOLEAN NOT NULL DEFAULT FALSE,
  checked_by UUID REFERENCES family_members(id),
  checked_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- MEAL_PLANS
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,      -- Always a Monday
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(family_id, week_start)
);

-- MEAL_PLAN_ITEMS
CREATE TABLE meal_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Mon, 6=Sun
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  custom_title TEXT,             -- If no recipe, just a title
  notes TEXT
);

-- RECIPES
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,  -- NULL = global recipe
  title TEXT NOT NULL,
  description TEXT,
  ingredients JSONB NOT NULL DEFAULT '[]',   -- [{name, amount, unit}]
  instructions JSONB NOT NULL DEFAULT '[]',  -- [{step, text}]
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  servings INTEGER,
  image_url TEXT,
  source_url TEXT,               -- Original recipe URL
  tags TEXT[],                   -- ['vegetarian', 'quick', 'kids-friendly']
  nutrition JSONB,               -- {calories, protein, carbs, fat}
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- NOTIFICATIONS (audit log)
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  type TEXT NOT NULL,            -- 'event_reminder' | 'chore_due' | 'daily_digest' | etc.
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,                    -- Deep link data
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  push_ticket TEXT               -- Expo push ticket for delivery tracking
);

-- CALENDAR_CONNECTIONS (linked external calendars)
CREATE TABLE calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'apple', 'outlook', 'ical')),
  external_calendar_id TEXT,
  access_token TEXT,             -- Encrypted
  refresh_token TEXT,            -- Encrypted
  token_expires_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  sync_token TEXT,               -- For incremental Google sync
  ical_url TEXT,                 -- For iCal/Outlook feed
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI_CONVERSATIONS (optional: persist AI chat)
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',  -- [{role, content, timestamp}]
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_events_family_start ON events(family_id, start_at);
CREATE INDEX idx_chores_family ON chores(family_id);
CREATE INDEX idx_chore_completions_member ON chore_completions(member_id, due_date);
CREATE INDEX idx_list_items_list ON list_items(list_id, sort_order);
CREATE INDEX idx_rewards_member ON rewards(member_id, created_at);
CREATE INDEX idx_notifications_user ON notifications(user_id, sent_at);
CREATE INDEX idx_family_members_family ON family_members(family_id);
CREATE INDEX idx_family_members_user ON family_members(user_id);

-- RLS (Row Level Security) — enable on all tables
-- Supabase enforces: users can only access families they are members of
```

---

## 4. API Routes Specification

All routes are prefixed with `/api/v1`. All routes except `/auth/*` and `/webhooks/*` require a valid Supabase JWT in the `Authorization: Bearer <token>` header.

### Authentication
```
POST   /api/v1/auth/profile          Update user profile (name, avatar, timezone)
GET    /api/v1/auth/me               Get current user + family memberships
DELETE /api/v1/auth/account          Delete account (GDPR)
```

### Families
```
POST   /api/v1/families              Create a family
GET    /api/v1/families/:id          Get family details + members
PATCH  /api/v1/families/:id          Update family name/avatar (admin only)
POST   /api/v1/families/join         Join via invite code
POST   /api/v1/families/:id/invite   Regenerate invite code
DELETE /api/v1/families/:id/leave    Leave family
```

### Members
```
GET    /api/v1/families/:id/members              List all members
POST   /api/v1/families/:id/members              Add virtual member (kid/pet)
PATCH  /api/v1/families/:id/members/:memberId    Update member (name, color, avatar)
DELETE /api/v1/families/:id/members/:memberId    Remove member (admin only)
```

### Events
```
GET    /api/v1/families/:id/events               List events (query: from, to, memberId)
POST   /api/v1/families/:id/events               Create event
GET    /api/v1/families/:id/events/:eventId      Get single event
PATCH  /api/v1/families/:id/events/:eventId      Update event (query: scope=this|future|all for recurrence)
DELETE /api/v1/families/:id/events/:eventId      Delete event (query: scope=this|future|all)
GET    /api/v1/families/:id/events/upcoming      Next 10 upcoming events
GET    /api/v1/families/:id/events/countdowns    Active countdown events
```

### Chores
```
GET    /api/v1/families/:id/chores               List chores
POST   /api/v1/families/:id/chores               Create chore
PATCH  /api/v1/families/:id/chores/:choreId      Update chore
DELETE /api/v1/families/:id/chores/:choreId      Delete chore
POST   /api/v1/families/:id/chores/:choreId/complete    Mark complete (triggers star award + animation)
GET    /api/v1/families/:id/chores/today         Today's chores with completion status
GET    /api/v1/families/:id/chores/history       Completion history (query: memberId, from, to)
```

### Rewards
```
GET    /api/v1/families/:id/rewards/:memberId    Get star balance + history
GET    /api/v1/families/:id/rewards/prizes       List available prizes
POST   /api/v1/families/:id/rewards/prizes       Create a prize
POST   /api/v1/families/:id/rewards/redeem       Redeem stars for a prize
POST   /api/v1/families/:id/rewards/bonus        Give bonus stars (admin only)
```

### Lists
```
GET    /api/v1/families/:id/lists                List all lists
POST   /api/v1/families/:id/lists                Create list
PATCH  /api/v1/families/:id/lists/:listId        Update list
DELETE /api/v1/families/:id/lists/:listId        Delete list
GET    /api/v1/families/:id/lists/:listId/items  Get items
POST   /api/v1/families/:id/lists/:listId/items  Add item (AI auto-categorizes grocery items)
PATCH  /api/v1/families/:id/lists/:listId/items/:itemId     Update / reorder item
DELETE /api/v1/families/:id/lists/:listId/items/:itemId     Delete item
POST   /api/v1/families/:id/lists/:listId/items/:itemId/check  Toggle check
POST   /api/v1/families/:id/lists/:listId/clear-checked     Remove all checked items
```

### Meal Planning
```
GET    /api/v1/families/:id/meals                Get meal plan for week (query: weekStart)
POST   /api/v1/families/:id/meals                Save/update meal plan
DELETE /api/v1/families/:id/meals/:itemId        Remove a meal from plan
POST   /api/v1/families/:id/meals/to-grocery     Add meal plan ingredients to grocery list
GET    /api/v1/families/:id/recipes              List family recipes (+ search)
POST   /api/v1/families/:id/recipes              Save recipe
PATCH  /api/v1/families/:id/recipes/:recipeId    Update recipe
DELETE /api/v1/families/:id/recipes/:recipeId    Delete recipe
POST   /api/v1/families/:id/recipes/import       Import from URL or image (AI)
```

### AI Endpoints
```
POST   /api/v1/ai/chat               AI assistant (streaming SSE response)
POST   /api/v1/ai/meal-suggest       Generate weekly meal plan (Plus only)
POST   /api/v1/ai/import-event       Parse email/PDF/photo → event data
POST   /api/v1/ai/categorize-items   Auto-categorize grocery list items
POST   /api/v1/ai/recipe-import      Extract recipe from URL or image
```

### Calendar Sync
```
GET    /api/v1/calendar-sync/connections         List connected external calendars
POST   /api/v1/calendar-sync/google/connect      Start Google OAuth flow
GET    /api/v1/calendar-sync/google/callback     Google OAuth callback
POST   /api/v1/calendar-sync/ical               Add iCal URL feed
DELETE /api/v1/calendar-sync/:connectionId       Disconnect calendar
POST   /api/v1/calendar-sync/:connectionId/sync  Force manual sync
```

### Insights (Plus only)
```
GET    /api/v1/families/:id/insights/weekly       Weekly family summary
GET    /api/v1/families/:id/insights/chores       Chore completion rates by member
GET    /api/v1/families/:id/insights/busyness     Busiest days/members
```

### Notifications
```
GET    /api/v1/notifications         List user's notifications
POST   /api/v1/notifications/mark-read  Mark as read
PUT    /api/v1/auth/push-token       Register/update Expo push token
```

### Subscriptions
```
GET    /api/v1/subscriptions/status  Current subscription status
POST   /api/v1/webhooks/revenuecat   RevenueCat webhook (subscription events)
```

---

## 5. Feature Specifications (All Screens & Logic)

### 5.1 Authentication Flow

**Screens:** Welcome → Login / Register → (Onboarding if new user)

- Use Supabase Auth. Support: email+password, Google OAuth, Apple Sign In (required for iOS App Store).
- After login, check if user has a `family_members` record. If not → onboarding flow. If yes → main app.
- Store session in Zustand `authStore`. Refresh tokens automatically via Supabase client.
- Implement biometric unlock (Face ID / Touch ID) using `expo-local-authentication` for returning sessions.

**Onboarding (4 steps):**
1. Create or join a family (create with name + avatar, or enter invite code)
2. Add family members (name, color, age — child toggle)
3. Connect external calendars (optional, skippable)
4. Choose plan (free vs Plus — can skip)

### 5.2 Home Dashboard

**Purpose:** At-a-glance view of the family's day. This is the first screen users see every morning.

**Components (top to bottom):**
1. Header: Family name, date, user avatar
2. Greeting: "Good morning, Sarah 👋"
3. Today's weather + temperature (Open-Meteo API, free, no key)
4. Today's events — horizontal scroll of EventCards
5. Chores due today — for each member, show their chores with avatar
6. Upcoming countdowns — any events with countdown labels
7. Quick add FAB (Floating Action Button) — tap to add event, chore, list item
8. Family activity feed — recent actions (Jane completed 'Make bed', Tom added 'Soccer practice')

**Quick Add FAB:**
- Tap → bottom sheet with options: Add Event, Add Chore, Add to Shopping List, Ask AI
- Each option navigates to the appropriate form or opens AI chat

### 5.3 Calendar Screen

**Views:** Month | Week | Day | Agenda — tab-switched at top  
**Default view:** Week (most practical for families)

**Features:**
- Color-coded dots on calendar days showing whose events fall there
- Tap day → shows event list for that day
- Tap event → event detail sheet (title, time, location, who, weather at event time, travel reminder toggle)
- Long press day → quick-add event for that day
- Member filter chips at top — tap to show only selected member's events
- Swipe left/right to navigate weeks/months
- "Jump to today" button when scrolled away

**Event Detail Sheet:**
- Shows: title, time, all-day toggle, location (with map preview), members, recurrence info, description
- Actions: Edit, Delete, Share
- "Set travel reminder" toggle — uses Google Maps to calculate travel time from home, sets reminder accordingly
- Weather preview for outdoor events

**Create/Edit Event Form:**
- Fields: Title (required), Date & Time, All Day toggle, End time, Location (with autocomplete), Add members (multi-select), Color override, Recurrence (none/daily/weekly/monthly/custom), Countdown label (optional), Description
- "Import from email/PDF" button → opens file picker or email forward instructions

### 5.4 Chores Screen

**Two modes:** Family view (all members) | Kids mode (simplified, big icons, gamified)

**Family View:**
- Today tab + All Chores tab
- Today: shows each chore with assigned member avatar, due time, complete button
- Completing a chore triggers: star burst animation, haptic feedback, star added to member's balance
- All Chores: list of all recurring chores, grouped by assignee
- Streak indicator on each member — consecutive days with all chores done

**Kids Mode (child role or parent toggles):**
- Large, colorful cards with icons
- Simple "Done!" button
- Animated star reward on completion
- Show current star balance prominently
- Stars progress bar toward next prize

**Chore Form:**
- Fields: Title, Icon (picker from list), Assign to (member), Recurrence (daily/weekly/specific days), Due time, Stars value (1-5), Description
- "Add to routine" option groups chores into morning/evening/weekend routines

### 5.5 Lists Screen

**List types:** Grocery, To-Do, Packing, Custom

**Grocery List:**
- Items auto-categorized by AI (Produce, Dairy, Meat, Pantry, etc.)
- Items sorted by category with section headers
- "Add item" — text input at bottom (always visible)
- Voice input via mic button
- Checked items collapse to bottom
- "Clear checked" button
- Real-time sync — if spouse checks off milk, you see it immediately

**General Lists:**
- Ordered by user via drag-and-drop
- Due dates on to-do items (optional)
- Assign to member (optional)

### 5.6 Meal Planning Screen (Plus feature)

**Layout:** Week grid (Mon–Sun × Breakfast/Lunch/Dinner)

**Features:**
- Tap any cell → add a meal (pick from saved recipes or type custom)
- "AI Suggest Week" button → sends family's preferences + recent history to GPT-4o-mini → fills the week
- "Push to Grocery" → extracts all recipe ingredients, adds to grocery list (deduplicated)
- Saved recipes tab — family recipe book with search and tags
- Import recipe via URL or photo — AI extracts title, ingredients, instructions

**Recipe Card:**
- Photo, title, prep+cook time, servings
- Ingredients list, instructions list
- "Save to plan" button
- Tags: quick (<30min), vegetarian, kid-friendly, etc.

### 5.7 AI Assistant

**Access:** FAB → "Ask AI" OR pull-up bottom sheet from anywhere

**Capabilities:**
- "Add soccer practice Tuesday 4pm" → creates event draft, user confirms
- "Plan meals for next week, we don't eat pork" → generates meal plan
- "What does the family have on Friday?" → answers from family data
- "Remind me to leave for Jake's game 30 min early" → creates travel reminder
- "Add milk, eggs, bread to the grocery list" → adds items

**Implementation:**
- Streaming response via SSE
- System prompt includes: user's name, family members, today's date, timezone, recent events
- Tool calling: the AI can call `create_event`, `add_list_items`, `suggest_meals` server-side functions
- Context window: last 10 messages + current family context

**UI:**
- Bottom sheet, 80% of screen height
- Chat bubbles (user right, AI left)
- Streaming text animation
- Quick prompt chips: "Plan this week's meals", "What's on today?", "Add to grocery list"
- Thinking indicator (animated dots) while AI responds

### 5.8 Insights Dashboard (Plus)

**Access:** More tab → Insights

**Cards:**
1. Busiest family member this week
2. Chore completion rate (per member, %) — bar chart
3. Most active calendar day
4. Total events this month vs last month
5. Stars leaderboard — who earned the most this week
6. Weekly digest email preview (can send now)

### 5.9 Settings & Account

**Sections:**
- Profile: photo, name, email, timezone, language
- Family: name, avatar, members, invite new member, leave family
- Notifications: toggle each notification type, quiet hours, daily digest time
- Connected Calendars: list connections, add new, remove
- Appearance: light/dark/system mode
- Kids Mode: enable/disable, set PIN to exit
- Subscription: current plan, upgrade/manage, restore purchases
- Privacy: export data, delete account
- Help: FAQ link, contact support, send feedback

---

## 6. Offline Support Implementation

This is a key differentiator. Use optimistic updates + a local queue.

### Strategy
1. All reads are served from TanStack Query cache first (stale-while-revalidate)
2. All writes go to an offline queue in `expo-sqlite` if no connection
3. When connection restores, queue is drained in order
4. Conflicts: server wins (show toast "Updated by [member]")

### Offline Queue Schema (local SQLite)
```sql
CREATE TABLE offline_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation TEXT NOT NULL,     -- 'CREATE' | 'UPDATE' | 'DELETE'
  resource TEXT NOT NULL,      -- 'events' | 'chores' | 'list_items' | etc.
  payload TEXT NOT NULL,       -- JSON
  created_at INTEGER NOT NULL  -- Unix timestamp
);
```

### Offline Banner
Show `OfflineBanner` component at top of screen whenever `NetInfo.isConnected === false`. Dismiss automatically when reconnected. Show "X changes pending sync" if queue is non-empty.

---

## 7. Push Notifications

### Types & Triggers

| Type | Trigger | Timing |
|---|---|---|
| `daily_digest` | Every morning | Configurable, default 7:30am local time |
| `event_reminder` | Per event | 1 hour before (default), or smart travel time |
| `chore_due` | Per chore | At the chore's due time |
| `chore_completed` | When member completes chore | Immediately (for parents) |
| `family_activity` | New event added by other member | Immediately |
| `list_item_added` | Item added to shared list | Immediately |
| `stars_earned` | Child earns stars | Immediately (to child's device) |
| `weekly_insights` | Sunday evening | 6pm |
| `invite_accepted` | Someone joined via invite link | Immediately |

### Travel-Time Reminders (Smart Feature)
When user enables travel reminder on an event:
1. Store event location lat/lng
2. Nightly job pre-calculates travel time from user's home address using Google Maps Distance Matrix API
3. Schedule push notification to arrive `travel_time + 15min` buffer before event
4. Update calculation the evening before in case traffic conditions changed

### Implementation
- Register push token on app launch: `expo-notifications` → send token to `PUT /api/v1/auth/push-token`
- Backend uses Expo Push API (free) to send notifications
- Use `pg-boss` job queue for scheduling future notifications
- All sent notifications logged to `notifications` table

---

## 8. Home Screen Widgets

### iOS Widget (WidgetKit via Expo)
Use `expo-widget` (available in Expo SDK 51+) or the native Swift widget with React Native bridge.

**Widget sizes:**
- Small: Next event title + time, or chores count due today
- Medium: Today's events list (3 events max) + weather
- Large: Full day view with events + chores

**Data:** Widget reads from App Group shared container. App writes widget data to shared UserDefaults/App Group after every sync.

### Android Widget
Use `react-native-android-widget` package.

**Same sizes as iOS.** Widget taps deep link into relevant app section.

---

## 9. Calendar Sync Implementation

### Google Calendar
1. User taps "Connect Google" → backend initiates OAuth 2.0 flow
2. Redirect to Google consent screen (scopes: `calendar.readonly` or `calendar` for full sync)
3. Callback stores encrypted access + refresh tokens in `calendar_connections`
4. Background job polls every 15 minutes using Google's sync token for incremental updates
5. New/changed Google events → create/update in `events` table with `external_source: 'google'`
6. Events created in FamilySync can optionally be pushed back to Google Calendar

### Apple Calendar (iCloud)
- Use CalDAV protocol. User provides iCloud app-specific password
- Or use iCal URL subscription (read-only but simpler)

### Outlook / Generic iCal
- Accept iCal URL feed, poll every 15 minutes, parse with `ical.js`

### Magic Import (AI-powered)
- User forwards email to their unique FamilySync address (Resend inbound)
- Or uploads PDF/photo in app
- Backend extracts text, sends to GPT-4o-mini with prompt to extract event data (title, date, time, location)
- Returns structured event draft → user confirms in app

---

## 10. Monetization & Subscriptions

### Free Tier (generous)
- Unlimited family members
- Shared calendar (unlimited events)
- Chores + basic rewards
- 3 shared lists
- Basic grocery list
- 7-day weather
- Manual event entry

### Family Plus — $4.99/month or $39.99/year
- Everything in free
- AI assistant (unlimited)
- AI meal planning
- Recipe import (URL + photo)
- Home screen widgets
- Photo screensaver / memory feed
- School calendar integrations
- Insights dashboard
- Weekly email digest
- Travel-time smart reminders
- Unlimited lists
- Priority support

### Implementation: RevenueCat
- Use RevenueCat SDK (`react-native-purchases`) for in-app purchases
- Handles App Store + Play Store billing, subscription management, webhooks
- Backend verifies subscription status via RevenueCat REST API or webhook
- `families.subscription_status` is the source of truth (updated via RevenueCat webhook)
- Gate Plus routes with `requirePlus` middleware: returns `402 Payment Required` if not subscribed

---

## 11. Design System & UI Guidelines

### Typography
- Font: DM Sans (Google Fonts, free) — clean, friendly, modern
- Display/headings: DM Sans Bold (700)
- Body: DM Sans Regular (400)
- Captions: DM Sans Medium (500)

### Color Palette
```typescript
// src/constants/theme.ts
export const colors = {
  // Brand
  primary: '#4F6AF0',       // Indigo blue — main CTA, active states
  primaryLight: '#EEF0FD',  // Primary backgrounds
  secondary: '#FF6B6B',     // Coral — accents, rewards
  
  // Semantic
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  
  // Neutrals
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  
  // Member colors (10 options)
  memberColors: [
    '#FF6B6B', '#FF8E53', '#FFC048', '#4ECDC4',
    '#45B7D1', '#96CEB4', '#DDA0DD', '#F08080',
    '#87CEEB', '#98D8C8',
  ],
  
  // Backgrounds
  background: '#FFFFFF',
  backgroundSecondary: '#F9FAFB',
  surface: '#FFFFFF',
  
  // Dark mode equivalents
  dark: {
    background: '#0F172A',
    backgroundSecondary: '#1E293B',
    surface: '#1E293B',
  }
};
```

### Spacing
Use an 8px base grid: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64

### Border Radius
- Small (chips, badges): 6px
- Medium (cards, inputs): 12px
- Large (sheets, modals): 24px
- Full (avatars, buttons): 9999px

### Animation Principles
- Completion animations: scale + fade star burst (Reanimated)
- Screen transitions: native iOS slide, Android fade
- List items: spring animation on add/remove
- Loading: skeleton screens (never spinner alone)
- Tab bar: spring tab indicator

### Component Rules
- Every interactive element: minimum 44×44pt touch target
- All inputs: 52px height, 12px border radius, visible focus ring
- Buttons: 52px height, full-width in forms, pill shape
- Cards: 12px border radius, subtle shadow (`rgba(0,0,0,0.06) 0 2px 8px`)
- Never use `opacity` for disabled state alone — also reduce contrast

---

## 12. Security Considerations

1. **JWT verification:** Every API request verifies Supabase JWT. Extract `user.id` from token, never from request body.
2. **Family membership check:** All `/families/:id/*` routes verify the requesting user is a member of that family via `requireFamily` middleware.
3. **Row Level Security:** Enable Postgres RLS on all tables. Users can only see rows belonging to their families.
4. **Token encryption:** Store Google/Apple OAuth tokens encrypted at rest (use `node:crypto` AES-256-GCM with a secret key).
5. **Rate limiting:** Apply via `@fastify/rate-limit`. Auth endpoints: 5 req/min. AI endpoints: 20 req/min per user.
6. **Input validation:** All inputs validated with Zod on both frontend and backend.
7. **File uploads:** Route through Supabase Storage with signed URLs. Max 10MB per upload.
8. **Invite codes:** 8-character alphanumeric, regeneratable, expirable.
9. **CORS:** Only allow your app's domain + `capacitor://` and `exp://` schemes.
10. **Secrets:** Never commit `.env` files. Use Railway/environment variables in production.

---

## 13. Phase-by-Phase Build Plan

### Phase 1 — Core Foundation (Weeks 1–6)
**Goal:** Working app with shared calendar and chores. Can demo to users.

#### Backend (Weeks 1–3)
- [ ] Set up Fastify project with TypeScript
- [ ] Connect to existing PostgreSQL, set up Drizzle ORM
- [ ] Run migrations: `users`, `families`, `family_members`, `events`, `event_members`, `chores`, `chore_completions`, `rewards`
- [ ] Supabase Auth integration + JWT plugin
- [ ] Routes: `/auth/*`, `/families/*`, `/members/*`, `/events/*`, `/chores/*`
- [ ] Basic push notification registration
- [ ] Deploy to Railway (free tier)

#### Mobile (Weeks 2–6, starts Week 2 parallel)
- [ ] Initialize Expo project, set up file structure above
- [ ] Configure NativeWind, DM Sans fonts, theme constants
- [ ] Auth screens: Welcome, Login, Register
- [ ] Onboarding flow: 4 steps
- [ ] Tab navigation shell
- [ ] Home dashboard (events + chores sections)
- [ ] Calendar screen: Month + Week view, event cards, event form
- [ ] Chores screen: today view, complete action with star animation
- [ ] Offline banner + basic offline support
- [ ] Push notification registration
- [ ] **Internal TestFlight + Play Store internal testing build**

### Phase 2 — Smart Features (Weeks 7–12)
**Goal:** AI assistant, meal planning, lists, sync. This is the differentiator.

#### Backend (Weeks 7–9)
- [ ] Migrations: `lists`, `list_items`, `recipes`, `meal_plans`, `meal_plan_items`, `calendar_connections`, `notifications`
- [ ] Routes: `/lists/*`, `/meals/*`, `/recipes/*`, `/ai/*`, `/calendar-sync/*`
- [ ] OpenAI integration: assistant, meal suggest, grocery categorization, event import
- [ ] Google Calendar OAuth + sync job
- [ ] iCal feed parser
- [ ] Weather service integration (Open-Meteo)
- [ ] Travel-time reminder job (Google Maps Distance Matrix)
- [ ] Daily digest job + email (Resend)
- [ ] pg-boss job queue setup

#### Mobile (Weeks 8–12)
- [ ] Lists screen: grocery + to-do, real-time sync via Supabase Realtime
- [ ] Meal planning screen: week grid, recipe cards, meal form
- [ ] Recipe import (URL + photo)
- [ ] AI assistant bottom sheet: chat, streaming, quick prompts
- [ ] Calendar sync settings screen
- [ ] Smart travel reminder toggle on events
- [ ] Weather on event cards
- [ ] Countdown badges
- [ ] Full offline queue implementation
- [ ] Home screen widgets (iOS + Android)
- [ ] Kids mode view

### Phase 3 — Monetization & Polish (Weeks 13–16)
**Goal:** Subscription system, insights, and production-ready polish.

#### Backend (Weeks 13–14)
- [ ] Migrations: `subscriptions`, `reward_prizes`, `ai_conversations`
- [ ] RevenueCat webhook handler
- [ ] `requirePlus` middleware
- [ ] Insights aggregation service + routes
- [ ] Weekly insights email job
- [ ] Rewards + prizes system
- [ ] Subscription status route
- [ ] Rate limiting + security hardening
- [ ] Sentry error monitoring setup
- [ ] PostHog analytics

#### Mobile (Weeks 14–16)
- [ ] RevenueCat SDK integration (`react-native-purchases`)
- [ ] Subscription/paywall screen (Plus features gated with upgrade prompt)
- [ ] Insights dashboard screen
- [ ] Rewards prizes screen (redeem stars)
- [ ] Settings screen (all sections)
- [ ] Dark mode support
- [ ] Accessibility: font scaling, screen reader labels
- [ ] App icon + splash screen final assets
- [ ] Onboarding polish (animations, illustrations)
- [ ] Performance audit (Flashlist for long lists, image caching)
- [ ] Crash reporting verification

### Phase 4 — App Store & Play Store Launch (Weeks 17–20)
**Goal:** Ship it.

#### Preparation (Week 17)
- [ ] App icon: 1024×1024px PNG (no rounded corners — stores add them)
- [ ] Splash screen: simple logo on brand color
- [ ] Screenshots: 6 required for iOS (6.7" + 6.1" + iPad), 8 for Android
- [ ] App Store description (en): written, localized if needed
- [ ] Privacy policy URL (required by both stores)
- [ ] Terms of service URL
- [ ] Support email
- [ ] Age rating questionnaire (both stores)

#### EAS Build Setup (Week 17)
```bash
npm install -g eas-cli
eas login
eas build:configure      # Creates eas.json
eas credentials          # Set up iOS certs + Android keystore
```

`eas.json`:
```json
{
  "cli": { "version": ">= 10.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

#### iOS App Store (Weeks 18–19)
- [ ] Apple Developer Program enrollment ($99/year) — allow 1–2 days for approval
- [ ] Create App ID in developer.apple.com
- [ ] Create App in App Store Connect
- [ ] Configure: bundle ID, capabilities (Push Notifications, Sign in with Apple)
- [ ] Run production build: `eas build --platform ios --profile production`
- [ ] Upload to TestFlight: `eas submit --platform ios`
- [ ] TestFlight beta test (minimum 1 week — gives time to find bugs)
- [ ] Submit for App Store Review (typical 24–48hr review time)
- [ ] Common rejection reasons to avoid:
  - Missing privacy policy
  - Sign in with Apple not implemented (required if you offer Google login)
  - Subscription terms not clearly displayed
  - Broken demo account (provide test credentials in review notes)

#### Google Play Store (Weeks 18–19, parallel)
- [ ] Google Play Console account ($25 one-time)
- [ ] Create app in Play Console
- [ ] Complete Data Safety form (declare what data you collect)
- [ ] Run production build: `eas build --platform android --profile production`
- [ ] Upload AAB (Android App Bundle): `eas submit --platform android`
- [ ] Internal testing → Closed testing (minimum 20 testers, 14 days) → Production
- [ ] Play Store listing: description, screenshots, feature graphic (1024×500px)
- [ ] Note: Google review typically 7 days for first submission

#### Post-Launch (Week 20+)
- [ ] Monitor Sentry for crash spikes
- [ ] Respond to App Store / Play Store reviews
- [ ] PostHog funnel analysis: which onboarding steps drop off?
- [ ] Set up feature flags for gradual rollout of new features
- [ ] Week 1 goal: 100 downloads, 30% day-7 retention
- [ ] Plan first update: fixes only, ship within 2 weeks of launch

---

## 14. Environment Variables

### Mobile (`apps/mobile/.env`)
```
EXPO_PUBLIC_API_URL=https://your-api.railway.app/api/v1
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
EXPO_PUBLIC_REVENUECAT_IOS_KEY=your_ios_key
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=your_android_key
EXPO_PUBLIC_GOOGLE_MAPS_KEY=your_maps_key
EXPO_PUBLIC_SENTRY_DSN=your_sentry_dsn
EXPO_PUBLIC_POSTHOG_KEY=your_posthog_key
```

### Backend (`apps/backend/.env`)
```
DATABASE_URL=postgresql://user:password@host:5432/familysync
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=sk-...
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_MAPS_API_KEY=your_maps_key
REVENUECAT_WEBHOOK_SECRET=your_webhook_secret
RESEND_API_KEY=re_...
SENTRY_DSN=your_backend_sentry_dsn
TOKEN_ENCRYPTION_KEY=32-char-random-string
ENCRYPTION_IV=16-char-random-string
NODE_ENV=production
PORT=3000
FRONTEND_URL=exp://your-app-scheme
```

---

## 15. Third-Party Accounts to Create (Before Starting)

Do these on Day 1:
1. **Supabase** — supabase.com → Create project → get URL + anon key + service role key
2. **Railway** — railway.app → Create project → Deploy Node.js → get deployment URL
3. **OpenAI** — platform.openai.com → Create API key → add $10 credit to start
4. **Resend** — resend.com → Free account → get API key → verify sending domain
5. **Sentry** — sentry.io → Free account → Create React Native + Node.js projects
6. **RevenueCat** — revenuecat.com → Free account → Create app → get iOS + Android keys
7. **Google Cloud Console** — console.cloud.google.com → Enable Calendar API + Maps Distance Matrix API → Create OAuth 2.0 credentials
8. **PostHog** — posthog.com → Free cloud account → get project key

Do these when ready to ship (Phase 4):
9. **Apple Developer Program** — developer.apple.com → Enroll ($99) — allow 2 days
10. **Google Play Console** — play.google.com/console → Enroll ($25 one-time)

---

## 16. Key Packages — Installation Commands

```bash
# In apps/mobile
npx expo install expo-router expo-notifications expo-local-authentication expo-sqlite expo-image expo-haptics expo-linear-gradient expo-font expo-status-bar expo-web-browser expo-linking

npx expo install @supabase/supabase-js react-native-url-polyfill @react-native-async-storage/async-storage

npx expo install react-native-reanimated react-native-gesture-handler react-native-screens react-native-safe-area-context

npm install @tanstack/react-query zustand react-hook-form zod react-native-purchases

npm install react-native-calendars date-fns rrule axios @expo/vector-icons nativewind

# In apps/backend
npm init -y
npm install fastify @fastify/cors @fastify/rate-limit @fastify/swagger fastify-plugin

npm install drizzle-orm pg drizzle-kit

npm install @supabase/supabase-js openai ical.js pg-boss zod resend

npm install @sentry/node

npm install -D typescript ts-node @types/node @types/pg
```

---

## 17. Testing Checklist Before App Store Submission

Go through this list manually before submitting:

**Auth:**
- [ ] Register new account with email
- [ ] Login with email + password
- [ ] Google sign-in works
- [ ] Apple sign-in works (on real iOS device)
- [ ] Forgot password email received
- [ ] Biometric unlock works

**Onboarding:**
- [ ] Create family flow completes
- [ ] Invite code share works
- [ ] Join family via invite code works
- [ ] Skip calendar sync works
- [ ] Onboarding does not repeat after completion

**Calendar:**
- [ ] Create event (single)
- [ ] Create recurring event (weekly, edit this/all)
- [ ] Delete recurring event (this/all)
- [ ] Sync Google Calendar (if credentials configured)
- [ ] Events show correct times in user's timezone
- [ ] Events show correct member color dots

**Chores:**
- [ ] Create chore, assign to member
- [ ] Complete chore → star animation plays
- [ ] Stars added to member balance correctly
- [ ] Recurring chore appears next day

**Lists:**
- [ ] Add item to grocery list
- [ ] Check off item, uncheck item
- [ ] Clear checked items
- [ ] Real-time: add item on one device, appears on other device

**AI:**
- [ ] "Add [event] on [date]" → event created
- [ ] "What's on tomorrow?" → correct answer
- [ ] Meal suggestion generates 7 days
- [ ] Quick prompts all function

**Offline:**
- [ ] Turn on airplane mode → offline banner shows
- [ ] Add event while offline → appears locally
- [ ] Restore connection → event synced to server

**Subscriptions:**
- [ ] Free user sees upgrade prompt for Plus features
- [ ] Purchase Plus (use Sandbox environment)
- [ ] Plus features unlock immediately after purchase
- [ ] Restore purchases works

**Notifications:**
- [ ] Grant permission on first launch
- [ ] Event reminder arrives at correct time
- [ ] Tap notification → deep links to correct screen
- [ ] Chore reminder arrives at set time
- [ ] Daily digest arrives at configured time

**Performance:**
- [ ] App launches in < 2 seconds (on mid-range device)
- [ ] Scrolling lists at 60fps (no jank)
- [ ] No memory leak after 10 minutes of use

---

## 18. Codex Instructions

When implementing this project:

1. **Always read this entire document before writing any file.** Do not skip sections.
2. **Build in phase order.** Do not start Phase 2 backend work until Phase 1 backend is tested.
3. **Shared types first.** Define all types in `packages/shared/src/types.ts` before implementing routes or components.
4. **Database schema is final.** Do not alter column names — frontend and backend depend on them.
5. **Every API route must validate input with Zod** and return typed errors in the format `{ error: string, code: string }`.
6. **Every component must handle three states:** loading (skeleton), empty (empty state illustration + CTA), and data.
7. **Real-time sync via Supabase Realtime** must be set up on: events, chores, list_items tables. Other tables use polling/manual refresh.
8. **Never store secrets in the codebase.** All keys come from `.env` files.
9. **Feature flag Plus-only features** from day one — this makes testing and gating simpler.
10. **Test on a real device early and often.** Simulators do not accurately represent push notifications, biometrics, or widget behavior.

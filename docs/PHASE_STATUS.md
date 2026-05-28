# Phase Status

This file maps the current repository to the original `docs/FAMILYSYNC_HANDOFF.md` phases.

## Current Position

We are in **Phase 1: Core Foundation**. The repo now has both a usable mobile prototype and the backend/shared-code foundation needed to continue the production build.

The repository now contains a usable Expo mobile MVP/prototype for the main family loop:

- Home dashboard
- Family plan timeline
- Chores and reward stars
- Shopping list
- Family text thread
- SMS digest launcher
- Pasted-text quick-add parser
- Local database hydration for plans, chores, and groceries
- Quick-add persistence into the local database when the dev API is available
- App naming and design system

## Completed From Phase 1

- Mobile app scaffold
- Core navigation shell
- Shared TypeScript domain types
- Shared Zod request validation package
- Design system source of truth
- Fastify backend project with TypeScript
- Security note: the original handoff specified Fastify v4, but npm currently reports high advisories for that line, so the backend uses Fastify v5-compatible packages.
- Drizzle ORM schema covering the handoff database tables
- Generated initial SQL migration
- Supabase JWT auth plugin foundation
- Family membership/admin guard foundation
- Routes for `/auth/*`, `/families/*`, `/members/*`, `/events/*`, `/chores/*`, and `/lists/*`
- Basic push token registration route
- Events, chores, lists, members, and text-thread data models
- Local state for the primary mobile workflow
- Welcome, login/register shell, and 4-step onboarding shell
- Offline banner component
- Texting-first quick-add and digest experience
- Local PostgreSQL `HomeThread` database connected, migrated, and seeded
- Mobile hydration from the local API for the seeded family
- Grocery list item create/check/delete flow verified against the local database

## Still Needed For Phase 1 Production

- Verify Supabase JWTs against real mobile auth tokens
- Replace local mobile auth/onboarding demo state with Supabase Auth
- Finish wiring every mobile screen to API/TanStack Query instead of the current hybrid store
- Add event and chore forms against the API
- Add real-time sync for events and chores
- Add offline queue persistence
- Push notification setup
- Expand route and mobile tests
- Deploy backend to Railway
- Internal TestFlight / Play Store internal testing build

## Local Database Status

The local PostgreSQL database `HomeThread` is connected and working with the backend on this laptop.

Validated locally:

- `npm --workspace apps/backend run db:check`
- `npm run db:migrate`
- `npm --workspace apps/backend run db:seed`
- `npm --workspace apps/backend run verify:dev`
- direct `POST`, `PATCH`, and `DELETE` requests against `/api/v1/families/:familyId/lists/:listId/items`

## Later Handoff Phases Not Done Yet

- Phase 2 smart features: AI meal planning, calendar sync, travel-time reminders, widgets
- Phase 3 monetization and polish: RevenueCat, Family Plus gates, analytics, settings depth
- Phase 4 launch: EAS production builds, store listings, TestFlight, Play Store testing, review checklist

## Honest Status

All work is **not** done. Phase 1 now has a real local database path and live mobile-to-backend sync for the main family loop, but it still needs Supabase mobile auth wiring, broader API coverage in the app, realtime/offline behavior, notifications, deployment, and app-store testing before it can be called Phase 1 complete.

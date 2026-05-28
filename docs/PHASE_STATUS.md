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
- Routes for `/auth/*`, `/families/*`, `/members/*`, `/events/*`, and `/chores/*`
- Basic push token registration route
- Events, chores, lists, members, and text-thread data models
- Local state for the primary mobile workflow
- Welcome, login/register shell, and 4-step onboarding shell
- Offline banner component
- Texting-first quick-add and digest experience

## Still Needed For Phase 1 Production

- Connect the backend to the real provisioned PostgreSQL/Supabase project
- Run the migration against the real database
- Verify Supabase JWTs against real mobile auth tokens
- Replace local mobile auth/onboarding demo state with Supabase Auth
- Wire mobile screens to API/TanStack Query instead of mock data
- Add event and chore forms against the API
- Add real-time sync for events and chores
- Add offline queue persistence
- Push notification setup
- Expand route and mobile tests
- Deploy backend to Railway
- Internal TestFlight / Play Store internal testing build

## Later Handoff Phases Not Done Yet

- Phase 2 smart features: AI meal planning, calendar sync, travel-time reminders, widgets
- Phase 3 monetization and polish: RevenueCat, Family Plus gates, analytics, settings depth
- Phase 4 launch: EAS production builds, store listings, TestFlight, Play Store testing, review checklist

## Honest Status

All work is **not** done. Phase 1 is now properly underway with real foundations, but it still needs database credentials, migration execution, Supabase mobile auth wiring, API-backed mobile screens, realtime/offline behavior, and deployment before it can be called Phase 1 complete.

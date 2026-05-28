# HomeThread

HomeThread is a mobile-first family planning app based on the original FamilySync handoff spec. The first build focuses on the behavior families already use every day: a shared home plan, quick chores and grocery lists, and a texting-friendly thread for sending or importing updates.

## What Is Built

- Expo React Native app scaffold in `apps/mobile`
- Dashboard for today's schedule, chores, shopping, and family status
- Calendar/plan screen with member-colored events
- Chores screen with reward/star balance
- Lists screen with grocery and errand grouping
- Text thread screen for family SMS-style digests and pasted-message import
- Assistant quick-add screen that can parse natural family text into event, chore, or list drafts
- Shared product/design source of truth in `DESIGN.md`
- Shared validation/types package in `packages/shared`
- Fastify/Drizzle backend foundation in `apps/backend`
- Initial SQL migration in `apps/backend/drizzle`

## Source Spec

The original project handoff is preserved in `docs/FAMILYSYNC_HANDOFF.md`. Current phase status is tracked in `docs/PHASE_STATUS.md`.

## Why The Name

The recommended app name is **HomeThread**. It keeps the warmth of a family app while making the texting behavior feel native: every plan, chore, and grocery update becomes part of one shared household thread.

## Run Locally

```bash
npm install
npm run start
```

Then open the Expo app on iOS/Android, or press `w` in the Expo terminal to run the web preview.

For a phone-sized desktop preview on Windows:

```powershell
.\scripts\open-phone-preview.ps1
```

Backend development:

```bash
cp apps/backend/.env.example apps/backend/.env
npm run backend:dev
```

Local pgAdmin/Postgres setup is documented in `docs/LOCAL_DATABASE.md`.

Database migration generation:

```bash
npm run db:generate
```

## Project Layout

```text
apps/mobile/
  App.tsx
  app.json
  index.js
  src/
    components/
    data/
    screens/
    utils/
    constants/
    types.ts
```

## Current Scope

This is a strong mobile MVP/prototype, not the full production backend described in the handoff. The next production step is to add the shared package, Fastify/Drizzle backend, Supabase auth, and real-time persistence behind these screens.

# Product Analysis

Source reviewed: `familysync_codex_handoff.md` from the parent workspace.

## What The Handoff Specifies

The original handoff describes FamilySync, a cross-platform iOS and Android family organizer with calendar, chores, meals, shopping lists, AI assistance, push notifications, widgets, subscriptions, Supabase auth, a Fastify backend, Drizzle, PostgreSQL, and app-store launch work.

That is a production-scale product. The handoff itself estimates roughly 20 weeks through launch, including backend, real-time sync, monetization, calendar integrations, widgets, store review, and beta testing.

## Fastest Honest MVP

The first useful version should not try to build every integration at once. It should validate the daily household loop:

- What is happening today?
- Who owns each task?
- What still needs to be bought?
- Can a family member participate through text?
- Can a pasted text become a structured item?

The current implementation builds that loop as a local Expo app with typed mock data and deterministic parsing. It is intentionally ready for backend replacement later: events, chores, members, shopping items, and text updates are typed separately.

## 2026 UX Direction

The strongest product direction is not "another calendar." It is a family coordination layer that treats SMS as a bridge. U.S. families often include people with different phone habits, custody schedules, caregiver roles, and app tolerance. A texting-first workflow lets the app create value before every participant installs it.

## Naming Recommendation

Recommended name: **HomeThread**.

Why it works:

- It sounds warm without becoming childish.
- It communicates shared household coordination.
- It naturally supports the texting concept.
- It is broader than calendar-only planning.

FamilySync remains a clear internal codename, but it is more generic and less ownable.

## Implemented Now

- Expo mobile app scaffold
- Home dashboard
- Family plan timeline
- Chores and star rewards
- Shopping list
- Family text thread
- SMS digest launcher
- Paste-text parser for event, chore, and list drafts
- Quick-add assistant screen
- Design system in `DESIGN.md`

## Not Implemented Yet

- Supabase authentication
- PostgreSQL persistence
- Fastify API
- Real-time sync
- Push notifications
- Calendar integrations
- RevenueCat subscriptions
- OpenAI-backed assistant
- App Store and Play Store assets

These are deliberately left as production phases rather than faked inside the MVP.

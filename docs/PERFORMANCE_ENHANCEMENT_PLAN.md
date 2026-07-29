# HomeThread Performance Enhancement Plan

This document is the third production source-of-truth for HomeThread.

The app-wide test cases live in `docs/APP_WIDE_TEST_CASES.md`.

The production, security, Apple, and scalability gate lives in `docs/APPLE_PRODUCTION_SECURITY_SCALABILITY_PLAN.md`.

The frontend UX consistency plan lives in `docs/FRONTEND_UX_CONSISTENCY_PLAN.md`.

This file is only about making the entire app faster, smoother, lighter, more reliable, and easier to scale within every module.

## Owner Concern And Goal

The owner concern is that HomeThread should not only work and look consistent. It must also feel fast and dependable for real families using it every day.

The goal is to improve performance 10/10 by 10/10:

- Fast cold launch.
- Fast sign-in restore.
- Fast first household load.
- Smooth scrolling in every screen.
- No heavy widgets inside widgets that make the app stutter.
- No repeated refreshes that waste battery, network, backend, or Supabase quota.
- No slow module should make the whole app feel slow.
- No hidden performance cliff when a household grows from demo data to real family data.
- No production release without baseline measurements.

Performance is user experience. A beautiful family app that freezes, waits, refreshes too often, or drains battery will feel unsafe.

## Current Performance Baseline From Code Review

Known structure:

- Mobile app is Expo React Native in `apps/mobile`.
- Backend is Fastify and Drizzle in `apps/backend`.
- Shared schemas live in `packages/shared`.
- Mobile state is mostly centralized in `apps/mobile/src/store/useHomeThreadStore.ts`.
- First household hydrate currently requests family, events, chores, lists, meals, recipes, and notifications in parallel.
- Realtime updates currently debounce changes and then trigger a broad household refresh.
- Offline queue supports up to 50 queued mutations and replays after hydrate.
- Several large screens use `ScrollView`; Lists uses `FlatList` in parts.
- Child Device Shell has its own child-device data path.
- Avatar/photo upload exists for adult and child profiles.
- AI, recipe import, calendar sync, RevenueCat, notifications, and realtime all add performance and cost surfaces.

GitNexus performance-relevant flows surfaced:

- `hydrateFromBackend`
- `refreshFromBackend`
- `maybeReplayOfflineQueue`
- `loadOfflineQueueFromStorage`
- `saveOfflineQueueToStorage`
- `startFamilyRealtimeSync`
- child-device session refresh
- notification push token refresh

Important: this document does not claim performance has already been measured. It defines what must be measured and improved before broad release.

## Performance Principles

Use these rules before changing code:

1. Measure before optimizing.
2. Fix the slowest real user path first.
3. Prefer deleting work over making work faster.
4. Prefer one shared fix over many screen-specific patches.
5. Avoid new dependencies unless the current stack cannot solve it.
6. Performance fixes must not weaken security, correctness, accessibility, or data freshness.
7. Every optimization needs a before/after note or test.
8. If a module is rarely used, do not let it slow the common app path.
9. Network, database, render, and bundle performance must be treated separately.
10. Performance success means users feel calm, not just charts look green.

## Performance Budgets

These are launch targets. Update them after real-device measurement.

| Area | Target | No-Go Threshold |
| --- | --- | --- |
| Cold launch to first visible UI | under 2.5s on recent iPhone | over 4s |
| Session restore to Home | under 2s on Wi-Fi | over 4s |
| First household hydrate | under 2.5s on Wi-Fi, under 5s on slow network | over 8s |
| Pull-to-refresh | under 2s for normal household | over 5s |
| Screen transition | under 200ms perceived delay | visible freeze |
| Tap feedback | under 100ms | no immediate feedback |
| Scroll frame drops | no obvious jank on long screens | repeated stutter |
| Offline queue replay | 50 items without blocking UI | app freeze or lost state |
| Child device launch | under 2s after token restore | over 4s |
| API p95 for normal reads | under 500ms server time | over 1500ms |
| API p95 for normal writes | under 700ms server time | over 2000ms |
| Full app memory | no crash on large household data | crash or OS kill |

## Measurement Plan

Do not rely on feelings alone. Capture real evidence.

### Mobile Measurements

- [ ] Cold launch time on clean iPhone install.
- [ ] Warm launch time after app kill/reopen.
- [ ] Sign-in restore time.
- [ ] First household hydrate time.
- [ ] Home screen first interactive time.
- [ ] Time to open each main tab.
- [ ] Time to save create/edit actions.
- [ ] Scroll smoothness on long screens.
- [ ] Memory behavior after 10 minutes of use.
- [ ] Battery/network behavior during realtime and refresh loops.
- [ ] Sentry performance traces if available.
- [ ] TestFlight crash and hang evidence.

### Backend Measurements

- [ ] API response p50, p95, p99 by route.
- [ ] DB query duration by route.
- [ ] DB connection pool usage.
- [ ] Slow query log.
- [ ] Request body sizes.
- [ ] Response payload sizes.
- [ ] Error rate by route.
- [ ] Rate-limit events.
- [ ] Job duration and failure rate.
- [ ] Push send latency and failure rate.

### Web Preview Measurements

Web preview is not the final iOS runtime, but it is useful for bundle and obvious rendering regressions.

- [ ] `localhost:8081` normal app baseline.
- [ ] `localhost:8082` child-device shell preview baseline.
- [ ] Bundle size trend.
- [ ] Number of web resources.
- [ ] Initial render timing.
- [ ] Heavy modules pulled into initial bundle.

## Test Data Sizes

Performance testing must use realistic and stress data, not only demo household data.

### Normal Household

- 2 adults.
- 2 children.
- 20 plans.
- 20 chores.
- 5 lists.
- 60 list items.
- 14 meal plan items.
- 20 recipes.
- 20 board posts.
- 20 notifications.
- 1 child device.

### Large Household

- 4 adults or caregivers.
- 6 children.
- 150 plans.
- 120 chores.
- 15 lists.
- 400 list items.
- 60 meal plan items.
- 200 recipes.
- 250 board posts.
- 200 notifications.
- 6 child devices.
- 30 offline queued actions.

### Stress Household

- 8 adults/caregivers.
- 10 children.
- 500 plans.
- 500 chores.
- 30 lists.
- 1500 list items.
- 400 recipes.
- 1000 board posts.
- 1000 notifications.
- 10 child devices.
- 50 offline queued actions.

Stress data is not the expected normal user. It is how we find cliffs before users do.

## App-Wide Performance Gates

No broad release until:

- [ ] Real-device performance baseline exists.
- [ ] Large household test completes without crash.
- [ ] Every main screen remains scrollable and tappable under large data.
- [ ] First hydrate does not fetch unbounded history.
- [ ] Realtime does not trigger repeated full refresh storms.
- [ ] Offline replay does not freeze the UI.
- [ ] Images and avatars do not trigger repeated reload loops.
- [ ] AI, recipe import, calendar sync, and billing are not loaded on the critical Home path unless needed.
- [ ] Backend route timings are visible in logs or monitoring.
- [ ] Slowest routes have owners and next actions.

## Critical Performance Risks

### P0: Full Household Hydrate Gets Too Heavy

Current hydrate requests multiple modules at once:

- family
- events
- chores
- lists
- meals
- recipes
- notifications

Risk:

- As data grows, every refresh pulls too much.
- Realtime changes can cause broad refreshes.
- One slow module can delay the whole app.

Required work:

- [ ] Measure response size and duration for each hydrate request.
- [ ] Add route timing logs.
- [ ] Cap initial data per module.
- [ ] Load non-critical modules after Home is interactive.
- [ ] Consider split hydration: critical Home data first, module data on screen open.
- [ ] Keep stale data visible during refresh.
- [ ] Add pagination for history-heavy modules.

Recommended priority:

1. Keep family, members, today chores, upcoming plans, selected list, and unread notifications in first hydrate.
2. Defer recipes, full meal details, older board history, older notifications, and heavy insights.
3. Add module-level refresh after a screen opens.

### P0: Realtime Refresh Storms

Current realtime listens to events, chores, lists, and list items, then triggers `refreshFromBackend`.

Risk:

- Multiple changes can cause repeated broad refresh.
- Two active adults can create a refresh loop feel.
- Large list/item changes can reload unrelated modules.

Required work:

- [ ] Measure how often realtime fires during common flows.
- [ ] Increase debounce if needed after real testing.
- [ ] Collapse burst updates into one refresh.
- [ ] Avoid full hydrate when only one module changed.
- [ ] Consider module-specific refresh paths.
- [ ] Stop realtime cleanly on sign-out, child mode, and background.

Best target:

- One remote change should update the relevant screen without making the whole app look like it is constantly refreshing.

### P0: Long Scroll Screens

Risk:

- Many screens use large `ScrollView` content.
- Large household data can render too many cards at once.
- Nested widgets increase layout work.

Required work:

- [ ] Identify screens rendering unbounded lists.
- [ ] Use `FlatList` for long repeated data.
- [ ] Keep `ScrollView` only for short pages and forms.
- [ ] Avoid rendering hidden forms and heavy sections until opened.
- [ ] Use empty/loading states that do not trigger layout jumps.

High-risk screens:

- Home
- Plan
- Chores
- Lists
- Meals
- Family Board
- Household
- Insights

### P0: Backend Query Growth

Risk:

- Family routes aggregate members, rewards, avatars.
- Events, chores, lists, meals, recipes, notifications, and insights may grow without route limits.
- Missing pagination can turn normal actions into heavy reads.

Required work:

- [ ] Confirm indexes for every `family_id`, `user_id`, date, and list lookup path.
- [ ] Add query duration logging.
- [ ] Add limits to routes returning history.
- [ ] Add pagination/cursors to board posts, notifications, recipes, and events history.
- [ ] Make insights operate on bounded windows.
- [ ] Load only current week meals by default.

## Module-By-Module Plan

### 1. App Shell And Navigation

Performance goal:

- App opens, restores session, and reaches the right mode without visible stalls.

Risks:

- App shell owns auth bootstrap, child-device bootstrap, hydration, realtime, push token refresh, pinned headers, bottom bar, and screen switching.
- Too much work during app startup can delay first useful UI.

Actions:

- [ ] Measure boot sequence: auth, child-device check, API status, hydrate.
- [ ] Show UI as soon as safe instead of waiting on non-critical work.
- [ ] Defer push token refresh until after initial Home render.
- [ ] Defer realtime connection until first API hydrate is complete.
- [ ] Keep child-device routing cheap.
- [ ] Remove parent-phone Kids Mode if product decision confirms child-device shell is the only child path.
- [ ] Avoid loading heavy module screens until opened.

Acceptance:

- Main app and child-device app do not block each other.
- App shell has no hidden startup loop.
- `8081` and `8082` local previews are both stable.

### 2. Welcome, Auth, Create, Join

Performance goal:

- Auth screens respond instantly and do not re-run unnecessary intent/state work.

Risks:

- OAuth round trips are network-bound.
- Stale setup intent can route users into wrong state.
- Long copy can increase scroll height on small phones.

Actions:

- [ ] Measure sign-in start to session created.
- [ ] Keep provider buttons immediate.
- [ ] Avoid loading household modules before user has a household.
- [ ] Keep create/join completion screens lightweight.
- [ ] Cache or minimize how-it-works carousel work.

Acceptance:

- Create household and join household feel immediate after backend response.
- Already-member and multi-household notice screens do not trigger full app hydration until needed.

### 3. Home

Performance goal:

- Home is fast, calm, and gives useful status without rendering the entire app.

Risks:

- Home summarizes many modules.
- Family Desk can become too dynamic.
- Child-device pairing status can add extra network calls.

Actions:

- [ ] Keep Home data bounded to summary counts and top items.
- [ ] Do not fetch child devices repeatedly on every render.
- [ ] Cache child-device pairing status per family session.
- [ ] Keep Family Desk items limited to the top 2 or 3 next actions.
- [ ] Avoid expensive derived arrays on every render if data grows.
- [ ] Measure Home render after large hydrate.

Acceptance:

- Home remains smooth with large household data.
- Family Desk does not add a noticeable delay.

### 4. Plan

Performance goal:

- Upcoming plans load fast, filter fast, and scroll smoothly.

Risks:

- Events grow quickly over time.
- Recurring events and assignments can create heavy mapping.
- Calendar sync can import many events.

Actions:

- [ ] Default to a bounded date window.
- [ ] Add pagination or month/week windowing for history.
- [ ] Avoid rendering all old events.
- [ ] Confirm event indexes on `family_id` and `start_at`.
- [ ] Measure calendar-imported event volume.
- [ ] Keep travel reminder calculations lazy.

Acceptance:

- 500 events do not freeze Plan.
- Opening Plan does not require recipes, board posts, or old notifications.

### 5. Chores

Performance goal:

- Chores feel instant because they are a daily-use feature.

Risks:

- Chore filters by member can recalculate repeatedly.
- Completion triggers refresh and reward updates.
- Large chore history could become heavy.

Actions:

- [ ] Keep default query to today/open chores.
- [ ] Load history only when needed.
- [ ] Confirm indexes on chore family, assigned member, and completion date.
- [ ] Avoid re-rendering every chore when one chore completes.
- [ ] Test child-device completion and adult completion under slow network.

Acceptance:

- Marking a chore done gives immediate feedback and never waits silently.
- 500 chores in history do not slow today view.

### 6. Lists

Performance goal:

- Shopping and list interactions stay fast even with many items.

Risks:

- Lists can contain many items.
- Checking items can update frequently across adults.
- Realtime list item changes can trigger broad refresh.

Actions:

- [ ] Keep `FlatList` for long item lists.
- [ ] Add virtualization to every repeated list section.
- [ ] Avoid rendering all lists and all items at once.
- [ ] Make checked item archive/clear path efficient.
- [ ] Confirm list item indexes on `list_id` and sort order.
- [ ] Consider module-specific realtime refresh for list item changes.

Acceptance:

- 1500 list items across lists do not freeze the app.
- Checking an item feels instant.

### 7. Meals And Recipes

Performance goal:

- Meal planning loads current week quickly, while recipes load on demand.

Risks:

- Recipe library can grow large.
- Recipe import can be AI/network-heavy.
- Inline recipe forms can make the screen heavy.

Actions:

- [ ] Keep current week meal plan separate from recipe library.
- [ ] Paginate recipes.
- [ ] Lazy-load recipe detail, import, and edit flows.
- [ ] Bound recipe import text and URL work.
- [ ] Measure AI/local import duration.
- [ ] Avoid loading the whole recipe list during first hydrate if not needed for Home.

Acceptance:

- Current week meal view opens fast even with 400 recipes.
- Recipe search/list remains smooth.

### 8. Family Board / Thread

Performance goal:

- Board feels like a quick family update feed, not a heavy chat archive.

Risks:

- Board history can grow without limit.
- Local storage can become large.
- Text import/review can add parsing work.

Actions:

- [ ] Cap initial board posts.
- [ ] Add pagination or "Load earlier".
- [ ] Trim local board history per family.
- [ ] Measure save/load from storage.
- [ ] Keep text import review lazy.

Acceptance:

- 1000 board posts do not load at once.
- Family Board opens quickly from More or Home.

### 9. Assistant And AI

Performance goal:

- Assistant must not slow the app unless the user opens it.

Risks:

- AI calls can be slow and expensive.
- Assistant context can accidentally include too much family data.
- Long conversations can grow local storage and request payloads.

Actions:

- [ ] Load Assistant only when opened.
- [ ] Limit context size.
- [ ] Limit conversation history.
- [ ] Show immediate pending state.
- [ ] Add timeout and retry copy.
- [ ] Track AI route latency and error rate.
- [ ] Keep premium gating checks cheap.

Acceptance:

- Home cold launch never waits on AI.
- Assistant handles slow provider responses without freezing UI.

### 10. Household / Family

Performance goal:

- Household management stays smooth while showing adults, kids, devices, invites, billing, and safety settings.

Risks:

- This screen can become a large admin dashboard.
- Child pairing status and devices can add extra calls.
- Billing/RevenueCat can be slow.

Actions:

- [ ] Split high-cost sections into collapsible or lazy-loaded groups.
- [ ] Fetch child devices only when child-device section is visible or screen opens.
- [ ] Fetch billing only when billing section is visible.
- [ ] Avoid reloading all family data after every member edit if local update is safe.
- [ ] Keep remove/leave/promotion operations responsive with clear pending state.

Acceptance:

- Household opens fast for admin and non-admin users.
- Billing does not block member management.

### 11. Child Device Setup

Performance goal:

- Pairing preview and final pairing are fast, clear, and safe.

Risks:

- Pairing code preview is public and can be rate-limited.
- Slow network can make pairing feel broken.
- Pairing should not load adult app data.

Actions:

- [ ] Measure preview and pair endpoints.
- [ ] Keep child pairing flow separate from adult hydrate.
- [ ] Avoid loading full household state for child device.
- [ ] Show precise loading and retry states.

Acceptance:

- Child device setup works independently from adult app modules.

### 12. Child Device Shell

Performance goal:

- Child phone opens directly into a simple, fast, kid-safe experience.

Risks:

- Avatar upload can be large.
- Chore completion should not trigger adult app hydrate.
- Child token validation can delay launch.

Actions:

- [ ] Measure child token restore.
- [ ] Fetch only child session and today's chores.
- [ ] Compress or bound avatar uploads.
- [ ] Avoid loading adult tabs, Home, Household, or Assistant in child path.
- [ ] Keep `localhost:8082` preview useful for visual performance review.

Acceptance:

- Child-device launch is faster than adult app launch.
- Child device shell never pulls adult-only modules.

### 13. Settings

Performance goal:

- Settings opens quickly and loads expensive account actions only when used.

Risks:

- Avatar upload.
- Notification token refresh.
- Password/account deletion operations.
- Legal/support links.

Actions:

- [ ] Do not refresh push token automatically just because Settings opens.
- [ ] Keep avatar preview local and upload bounded.
- [ ] Keep legal links static.
- [ ] Show pending states for account actions.

Acceptance:

- Settings never feels like a dashboard refresh.

### 14. Insights

Performance goal:

- Insights gives quick summaries without heavy client computation.

Risks:

- Insights can become expensive if calculated over all historical data.
- Ranking/busyness summaries can grow with events and chores.

Actions:

- [ ] Keep insights windows bounded.
- [ ] Do calculations server-side with indexed queries.
- [ ] Cache if repeated often.
- [ ] Do not hydrate insights during app launch.

Acceptance:

- Insights opens on demand and does not slow Home.

### 15. Calendar Sync

Performance goal:

- Calendar connect/sync must be bounded, observable, and non-blocking.

Risks:

- External feeds can be large or slow.
- Google token refresh can fail.
- iCal imports can create many events.

Actions:

- [ ] Add strict timeouts and limits.
- [ ] Cap imported events per sync.
- [ ] Make sync asynchronous or clearly pending if it can take time.
- [ ] Track provider latency and failures.
- [ ] Keep sync off the critical Home launch path.

Acceptance:

- Calendar sync failure does not slow or break normal app use.

### 16. Notifications And Push

Performance goal:

- Notifications are useful without causing slow launch or refresh noise.

Risks:

- Push token refresh on startup.
- Large notification history.
- Notification read state updates.

Actions:

- [ ] Defer push token refresh until after UI is usable.
- [ ] Limit notification fetch count.
- [ ] Add pagination for history.
- [ ] Batch mark-read operations.

Acceptance:

- Notifications do not slow cold launch.

### 17. Billing And RevenueCat

Performance goal:

- Billing should never block household management or app startup.

Risks:

- RevenueCat SDK load and store product fetch can be slow.
- Purchase restore can take time.
- Subscription status requires backend consistency.

Actions:

- [ ] Lazy-load billing only when billing section opens.
- [ ] Cache subscription status per session.
- [ ] Show clear loading states.
- [ ] Keep purchase/restore separate from first household hydrate.

Acceptance:

- Household screen can open even if StoreKit/RevenueCat is slow.

## Backend Performance Plan

### API Route Budgets

| Route Area | Budget | Notes |
| --- | --- | --- |
| `/auth/me` | p95 under 400ms | Needed for session restore. |
| `/families/:id` | p95 under 500ms | Members and family summary only. |
| `/events` | p95 under 600ms | Must be date bounded. |
| `/chores/today` | p95 under 500ms | Daily critical path. |
| `/lists` | p95 under 700ms | Watch response size. |
| `/meals` | p95 under 500ms | Current week only. |
| `/recipes` | p95 under 700ms | Needs pagination as library grows. |
| `/notifications` | p95 under 400ms | Limit history. |
| child device `/me` | p95 under 400ms | Child launch critical path. |
| child device chores | p95 under 400ms | Child launch critical path. |
| AI routes | p95 depends on provider | Must be timed and bounded. |
| calendar sync | async or bounded | Must not block normal usage. |

### Database Work

- [ ] Confirm indexes for every `family_id` filter.
- [ ] Confirm composite index for events by `family_id`, `start_at`.
- [ ] Confirm list item index by `list_id`, `sort_order`.
- [ ] Confirm notifications index by `user_id`, `sent_at`.
- [ ] Confirm child devices index by `family_id`, `member_id`.
- [ ] Confirm child pairing attempts are indexed by client key/code if needed.
- [ ] Add slow-query logging.
- [ ] Add route-level query timing.
- [ ] Avoid N+1 reads when hydrating family data.
- [ ] Add pagination before large history grows.

### Response Size Control

- [ ] Log response payload size in development and staging.
- [ ] Keep Home hydrate payload small.
- [ ] Do not return all historical events by default.
- [ ] Do not return all recipes by default.
- [ ] Do not return all board history by default.
- [ ] Do not return all notifications by default.
- [ ] Use summaries where the screen only needs counts.

## Mobile Rendering Plan

### Screen Rendering Rules

- Use `FlatList` for long repeated lists.
- Use `ScrollView` for short pages and forms only.
- Do not render hidden expensive sections.
- Keep forms mounted only when open if they are heavy.
- Keep primary action feedback immediate.
- Avoid repeated image `cache: "reload"` unless needed.
- Keep avatar failures from retrying endlessly.
- Avoid deriving large arrays multiple times per render.
- Keep Home summaries small.

### Bundle And Startup Rules

- Lazy-load expensive provider SDKs where possible.
- Keep AI, billing, calendar sync, and image picker off the cold launch path.
- Avoid adding new dependencies for small helpers.
- Track Expo web bundle size as an early warning.
- Track iOS app size before App Store submission.

## Observability Plan

Performance cannot be improved if we cannot see it.

Required:

- [ ] Backend request timing logs.
- [ ] Backend route error counts.
- [ ] DB slow query visibility.
- [ ] Sentry mobile errors and crashes.
- [ ] Sentry backend errors.
- [ ] User-facing safe error states.
- [ ] Health endpoint monitored.
- [ ] Performance baseline file updated before major release.

Recommended log fields:

- request id
- route
- method
- status code
- duration ms
- response size
- user id hash or family id hash where safe
- error code
- DB duration if available

Do not log raw family content, tokens, invite codes, pairing codes, calendar tokens, AI prompts, or photos.

## Performance Test Matrix

| Flow | Normal Household | Large Household | Stress Household | Slow Network | Offline | Two Devices |
| --- | --- | --- | --- | --- | --- | --- |
| Cold launch |  |  |  |  |  |  |
| Session restore |  |  |  |  |  |  |
| First hydrate |  |  |  |  |  |  |
| Home scroll |  |  |  |  |  |  |
| Plan open/filter |  |  |  |  |  |  |
| Chore complete |  |  |  |  |  |  |
| List item check |  |  |  |  |  |  |
| Meal week open |  |  |  |  |  |  |
| Recipe library |  |  |  |  |  |  |
| Family Board |  |  |  |  |  |  |
| Assistant prompt |  |  |  |  |  |  |
| Household open |  |  |  |  |  |  |
| Child pair |  |  |  |  |  |  |
| Child shell launch |  |  |  |  |  |  |
| Realtime update |  |  |  |  |  |  |
| Offline replay 50 items |  |  |  |  |  |  |

## Execution Order

### Phase 1: Baseline First

1. Run app on `localhost:8081`.
2. Run child shell preview on `localhost:8082`.
3. Capture web preview load and bundle signals.
4. Capture real iPhone cold launch and hydrate time.
5. Record backend route timings for first hydrate.

Exit:

- We know what is slow before changing performance code.

### Phase 2: Critical Path Slimming

1. Slim first household hydrate.
2. Defer non-critical modules from startup.
3. Prevent realtime from triggering broad repeated refreshes.
4. Defer push token refresh and billing/provider SDK work.

Exit:

- Home becomes interactive faster.

### Phase 3: Large Data Safety

1. Add pagination/limits for history-heavy modules.
2. Use list virtualization where needed.
3. Add large household seed/test data.
4. Measure large household screen performance.

Exit:

- Large households do not crash or freeze.

### Phase 4: Module Polish

1. Optimize Plan.
2. Optimize Chores.
3. Optimize Lists.
4. Optimize Meals/Recipes.
5. Optimize Family Board.
6. Optimize Household.
7. Optimize Child Device Shell.

Exit:

- Each module has its own acceptable performance profile.

### Phase 5: Regression Guard

1. Save performance baseline.
2. Add manual performance checklist to release flow.
3. Add automated bundle or route-size checks if practical.
4. Re-run before TestFlight and before App Store submission.

Exit:

- Performance does not silently decay.

## First Fix Candidates

These are likely high-leverage, but still require measurement first.

1. Split first hydrate into critical and deferred module loads.
2. Add response limits/pagination for recipes, board history, notifications, and old events.
3. Make realtime refresh module-specific where possible.
4. Use virtualization for long repeated screen sections.
5. Lazy-load billing, AI, calendar sync, image picker, and heavy forms.
6. Remove or hide parent-phone Kids Mode if child-device shell is the chosen child path.
7. Add backend route timing and response-size logging.
8. Add large household seed data for performance testing.
9. Reduce repeated avatar reload behavior.
10. Keep child-device shell independent from adult app hydration.

## What Not To Do

- Do not add a state management rewrite.
- Do not add a caching library before measuring.
- Do not hide broken freshness behind stale cache without user trust copy.
- Do not optimize by removing security checks.
- Do not make AI or billing part of app startup.
- Do not load every module to make Home summaries feel complete.
- Do not add infinite lists without pagination.
- Do not rely only on web performance for iOS release decisions.

## Claude Discussion Prompts

Use Claude as an outside performance reviewer.

### Prompt 1: App-Wide Performance Review

```text
You are Claude acting as an independent mobile performance reviewer.

Review docs/PERFORMANCE_ENHANCEMENT_PLAN.md and inspect the HomeThread repo read-only.

Focus on:
- cold launch
- session restore
- first household hydrate
- Home screen render
- realtime refresh behavior
- offline queue replay
- long list rendering
- large household data
- child-device shell independence
- backend route/query growth

Return:
1. Top P0/P1 performance risks.
2. What the plan gets right.
3. What the plan misses.
4. The smallest first code changes that reduce the most risk.
5. What should be measured before any performance refactor.
```

### Prompt 2: Hydration And Realtime Review

```text
You are Claude reviewing HomeThread's data hydration and realtime update performance.

Inspect read-only:
- apps/mobile/src/store/useHomeThreadStore.ts
- apps/mobile/src/services/familyRealtimeSync.ts
- apps/mobile/src/services/offlineQueue.ts
- apps/backend/src/routes/*.ts

Questions:
1. Is first hydrate pulling too much data?
2. Which modules should load first, and which should defer?
3. Where can realtime updates become refresh storms?
4. Which routes need limits or pagination?
5. What minimal changes would improve perceived performance without breaking freshness?
```

### Prompt 3: Screen Rendering Review

```text
You are Claude reviewing HomeThread screen rendering performance.

Inspect all mobile screens read-only.

Focus on:
- ScrollView vs FlatList
- repeated cards
- hidden forms
- expensive derived arrays
- images and avatars
- dynamic sections
- small iPhone performance
- large household data

Return a table:
- screen
- likely render bottleneck
- large-data risk
- smallest safe fix
- test scenario
```

### Prompt 4: Backend Query And Payload Review

```text
You are Claude reviewing HomeThread backend performance.

Inspect:
- apps/backend/src/routes/*.ts
- apps/backend/src/db/schema.ts
- apps/backend/drizzle/*.sql
- apps/mobile/src/store/useHomeThreadStore.ts

Focus on:
- indexes
- route response sizes
- N+1 patterns
- pagination gaps
- hydration payload size
- slow query risks
- route timing observability

Return:
1. Top backend performance risks.
2. Missing indexes or query limits.
3. Routes that need pagination first.
4. Suggested performance logs.
5. What can wait until after first App Store approval.
```

### Prompt 5: Adversarial Performance Challenge

```text
You are Claude acting as an adversarial performance reviewer.

Try to break this HomeThread performance plan.

Look for:
- optimizations that could make data stale or unsafe
- cache ideas that could leak family data
- deferring modules that could confuse users
- pagination that could hide important family content
- realtime changes that could reduce trust
- mobile optimizations that hurt accessibility
- backend changes that improve speed but weaken auth checks

Return:
1. Strongest objections.
2. What must not be optimized away.
3. Safer alternatives.
4. Final recommended first 5 actions.
```

## Performance Response Log

Paste Claude responses below this line.

### Claude Prompt 1 Response

Pending.

### Claude Prompt 2 Response

Pending.

### Claude Prompt 3 Response

Pending.

### Claude Prompt 4 Response

Pending.

### Claude Prompt 5 Response

Pending.

## Final Go / No-Go Rules

Do not treat the app as performance-ready if any of these are true:

- No real-device launch baseline exists.
- First hydrate has no timing or payload evidence.
- Large household data has not been tested.
- Realtime can trigger repeated broad refreshes without measurement.
- Long list screens render unbounded histories.
- Child-device shell depends on adult app hydration.
- AI, billing, calendar sync, or photo upload can slow app startup.
- Backend route timings are invisible.
- Slow query behavior is unknown.
- App freezes or drops input during offline queue replay.

Only mark this plan ready when performance has evidence, not guesses.

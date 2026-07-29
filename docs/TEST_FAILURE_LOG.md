# HomeThread Test Failure Log

This file is the holding area for all failed or blocked test cases discovered while executing:

- [APP_WIDE_TEST_CASES.md](./APP_WIDE_TEST_CASES.md)
- [REAL_USER_JOURNEY_TEST_CASES.md](./REAL_USER_JOURNEY_TEST_CASES.md)

Nothing gets fixed from this file immediately unless we explicitly decide to stop testing and switch into bug-fix mode.

## Rules

- Every `FAIL` or `BLOCKED` case from either test document gets a row here.
- One failure row per unique issue. If the same bug breaks five cases, link all affected IDs into the same row.
- Do not write guesses. If the root cause is unknown, say `Unknown`.
- Do not mark anything `Fixed` until the original failing test is re-run and passes.

## Status Labels

- `OPEN` - confirmed failure, not fixed yet
- `BLOCKED_ENV` - test could not run because env/device/build/accounts were missing
- `BLOCKED_EXTERNAL` - blocked by Google, Supabase, Railway, TestFlight, RevenueCat, or similar external dependency
- `READY_FOR_FIX` - failure is understood enough to begin fixing
- `FIXED_AWAITING_RETEST` - code or config change was made, but original test still needs re-run
- `CLOSED_PASS` - original failing case was re-run and passed
- `NOT_REPRO` - reported once, but later testing could not reproduce it

## Failure Intake Template

Use this template for each new issue:

```md
### F-### - Short failure title

- Status: OPEN
- Source doc: APP_WIDE_TEST_CASES or REAL_USER_JOURNEY_TEST_CASES
- Test IDs: AW-000, UJ-000
- Severity: P0 / P1 / P2 / P3
- Area: auth / family / child pairing / plan / chores / lists / meals / board / assistant / settings / calendar / notifications / subscriptions / build / infra
- Environment: device + build + backend/env summary
- Preconditions:
  - ...
- Steps to reproduce:
  1. ...
  2. ...
- Expected:
  - ...
- Actual:
  - ...
- Evidence:
  - screenshot / recording / logs / response body
- Suspected layer:
  - mobile / backend / env / third-party / unknown
- Notes:
  - ...
```

## Current Failure Queue

Add new failures at the top.

### F-012 - childDevices.test.ts push-delivery mock missing `.json()` masked child push delivery as failed

- Status: CLOSED_PASS
- Source doc: Full backend vitest suite re-run (post UX-polish-pass commit `1011c78`), not tied to an APP_WIDE_TEST_CASES ID
- Test IDs: N/A (backend unit test only)
- Severity: P3
- Area: notifications / child device / test infra
- Environment: Windows 10 dev host; local vitest, `apps/backend/test/childDevices.test.ts`
- Preconditions:
  - Full `npm run test` (33 files) run from `apps/backend` after the 2026-07-29 UX-polish-pass commit.
- Steps to reproduce:
  1. `npx vitest run test/childDevices.test.ts -t "delivers chore reminders to a paired child device"`.
- Expected:
  - `deliverHouseholdNotification` reports `childDelivered: 1` and calls `fetch` for a paired, push-token-registered child device.
- Actual:
  - **Before fix:** `childDevicesTargeted: 1` but `childDelivered: 0`. Root cause: commit `e64a6a3` (2026-07-24) changed `sendExpoPush` in `apps/backend/src/lib/pushNotifications.ts` to call `response.json()` on the Expo push API response, and correctly updated the mock in `test/pushNotifications.test.ts` to include a `json()` method, but missed the identical `fetchMock.mockResolvedValue({ ok: true })` in `test/childDevices.test.ts`. The mock's resolved value had no `.json` method, so `sendExpoPush`'s `try` block threw, was swallowed by its `catch`, and silently returned `{ delivered: false, staleToken: false }`. This was a test-mock gap, not a product bug — the real Expo push API always returns a JSON body.
  - **After fix:** `test/childDevices.test.ts` beforeEach mock updated to `fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: { status: "ok" } }) })`, matching `pushNotifications.test.ts`.
- Evidence:
  - Pre-fix: `npx vitest run test/childDevices.test.ts` -> 1 failed (`expected +0 to be 1`).
  - Fix retest: full `npm run test` -> 33 files passed, 153/153 tests passed.
- Suspected layer:
  - test gap only
- Notes:
  - Also found and fixed in the same pass: local `apps/backend/.env` had `JOBS_ENABLED=true` left over from the F-005 manual verification session, which made `notifications.test.ts > reports job queue status honestly` fail. Removed the line (per the `z.coerce.boolean()` truthy-string gotcha already documented under F-002 — setting it to the literal string `"false"` does not disable the flag, only removing/unsetting it does). This was local dev-machine state, never committed.

### F-011 - AW-021 Welcome create/join mode switch leaks email field values

- Status: CLOSED_PASS
- Source doc: APP_WIDE_TEST_CASES
- Test IDs: AW-021
- Severity: P2
- Area: auth
- Environment: Windows 10 dev host; Expo web @ `http://localhost:8081`
- Preconditions:
  - AW-021 requires switching between create-household and join-household Welcome paths without cross-mode value leakage.
- Steps to reproduce:
  1. Open Welcome on Expo web.
  2. Tap `Create household`, enter an email on the register form.
  3. Back out to Welcome, tap `Join household`.
  4. Observe login form field values.
  5. Repeat switching create <-> join.
- Expected:
  - UI mode remains coherent and values from one path do not leak into the other.
- Actual:
  - **Before fix:** Mode labels/copy switch correctly, but email textbox retained prior create-path value when entering join login path and when returning to create register path.
  - **After fix:** `beginCreateJourney` and `beginJoinJourney` clear shared `email`/`password` state when switching paths from Welcome.
- Evidence:
  - Browser automation 2026-07-03 (pre-fix): join path snapshot `value: aw014batch20260703@mailinator.com` after prior create-path entry.
  - Fix 2026-07-03: `setEmail("")` / `setPassword("")` added to `beginCreateJourney` and `beginJoinJourney` in `apps/mobile/src/screens/WelcomeScreen.tsx`.
  - Retest 2026-07-04: Expo web on `http://localhost:8081` (Metro started with `NODE_ENV` unset; prior `NODE_ENV=test` caused `DefaultToolLauncher` crash).
    - Create path: entered `aw021retest20260704@mailinator.com` -> Back -> Join path -> email/password `value:""` (CDP verified).
    - Join path: entered `aw021joinpath20260704@mailinator.com` -> Back -> Create path -> email/password `value:""` (CDP verified).
    - Mode pills/copy correct (`Creating a household` / `Joining a household`).
- Suspected layer:
  - mobile
- Notes:
  - Case closed after fix and Expo web retest on 2026-07-04.

### F-010 - AW-004 iOS EAS build path blocked: no Expo account and no Windows iOS prebuild

- Status: BLOCKED_EXTERNAL
- Source doc: APP_WIDE_TEST_CASES
- Test IDs: AW-004
- Severity: P1
- Area: build / infra
- Environment: Windows 10 dev host on `main` @ `e2cf18e`; `eas` CLI present globally; no `EXPO_TOKEN`; no Expo/EAS login in session
- Preconditions:
  - AW-004 requires running the documented production-style iOS build path from repo root / workspace (`README.md`: `npm run eas:build:preview` or `npm --workspace apps/mobile exec eas -- build --platform ios --profile preview`).
- Steps to reproduce:
  1. From `apps/mobile`, run `eas build --platform ios --profile preview --non-interactive`.
  2. From repo root, run `npx expo prebuild --platform ios --no-install`.
  3. Optionally confirm root Expo config resolves (`npx expo config --type public`).
- Expected:
  - iOS build tooling uses the intended Expo config and completes without root prebuild conflicts.
- Actual:
  - EAS cloud build aborted before queueing: `An Expo user account is required to proceed. Either log in with eas login or set the EXPO_TOKEN environment variable`.
  - Local iOS prebuild on Windows was skipped: `Skipping generating the iOS native project files. Run npx expo prebuild again from macOS or Linux`.
  - Root `npx expo config --type public` resolved `HomeThread` with `./apps/mobile/assets/icon.png` plugin paths (config loads; not a substitute for iOS build completion).
  - Android-only `npx expo prebuild --platform android --no-install` from root finished successfully (artifact removed after probe); does not satisfy the iOS case requirement.
- Evidence:
  - `git log -1 --oneline` -> `e2cf18e Disable Sentry auto-upload in EAS builds`
  - `eas build --platform ios --profile preview --non-interactive` -> login required error
  - Final release pass 2026-07-04: `EXPO_TOKEN` absent; `eas whoami` -> `Not logged in`; `eas build --platform ios --profile production --non-interactive` -> `An Expo user account is required to proceed`
  - `expo prebuild --platform ios --no-install` -> iOS generation skipped on Windows
  - `expo config --type public` (root) -> `name: HomeThread`, `icon: ./apps/mobile/assets/icon.png`
- Suspected layer:
  - env / third-party
- Notes:
  - Retest owner: human with Expo/EAS credentials and macOS or EAS cloud iOS build access.

### F-009 - AW-158 chore history date query params accepted but not applied

- Status: CLOSED_PASS
- Source doc: APP_WIDE_TEST_CASES
- Test IDs: AW-158
- Severity: P2
- Area: chores
- Environment: Windows 10 dev host; local app.inject with `NODE_ENV=test` + dev auth token
- Preconditions:
  - AW-158 requires member/date filter variants on chore completion history when available.
- Steps to reproduce:
  1. `GET /api/v1/families/:familyId/chores/history` with dev auth -> note completion count.
  2. `GET` same route with `?from=2099-01-01&to=2099-01-02` (range with no completions).
  3. Compare counts.
- Expected:
  - Date-filtered history returns only completions within the requested range.
- Actual:
  - **Before fix:** Future-only date range still returned all completions because `historyQuerySchema` parsed `from`/`to` but `GET /history` only applied `memberId`.
  - **After fix:** `from`/`to` constrain `choreCompletions.completedAt` inclusively; future-only range returns `[]`; today's range includes newly completed rows; `memberId` filter still works.
- Evidence:
  - Verification harness pre-fix: `{"allCount":5,"futureDateFilterCount":5,"dateFilterApplied":false}`.
  - Create+complete path still 201; `historyIncreased: true`; `julesFilterOk: true` on pass 2.
  - Fix retest: `npx vitest run chores.test.ts` -> 2/2 passed (`memberId filtering`, `from/to date filters on completedAt`).
- Suspected layer:
  - backend
- Notes:
  - First pass marked AW-158 PASS without exercising date filter; verification pass 2 corrected status.
  - Case closed after focused route fix and vitest retest on 2026-07-03.

### F-008 - AW-159 list item delete reports success for missing items

- Status: CLOSED_PASS
- Source doc: APP_WIDE_TEST_CASES
- Test IDs: AW-159
- Severity: P2
- Area: lists
- Environment: Windows 10 dev host; local app.inject with `NODE_ENV=test` + dev auth token
- Preconditions:
  - AW-159 requires truthful errors when deleting a list item that does not exist.
- Steps to reproduce:
  1. Create a list and add one item under `POST /api/v1/families/:familyId/lists`.
  2. `DELETE /api/v1/families/:familyId/lists/:listId/items/:itemId` for a valid item -> 200 `deleted:true`.
  3. `DELETE` the same route with a non-existent `itemId` on a valid list.
- Expected:
  - Missing list/item paths return truthful not-found errors (404 with `LIST_ITEM_NOT_FOUND` or equivalent).
- Actual:
  - **Before fix:** Missing list path returned 404 `LIST_NOT_FOUND` as expected; missing item path returned 200 `{"deleted":true}` because `lists.ts` deleted without checking affected row count.
  - **After fix:** Missing item delete returns 404 `{ error: "List item not found", code: "LIST_ITEM_NOT_FOUND" }`; valid item delete still returns 200 `{ deleted: true }`; missing list delete still returns 404 `LIST_NOT_FOUND`.
- Evidence:
  - Section T probe harness `aw159.missingList` -> 404 `LIST_NOT_FOUND` (pre-fix).
  - `aw159.missingItem` -> 200 (pre-fix) for fake item UUID on valid list.
  - Fix retest: `npx vitest run lists.test.ts` -> 4/4 passed (`deletes an existing list item`, `returns 404 when deleting a missing list item`, `returns 404 when deleting from a missing list`).
- Suspected layer:
  - backend
- Notes:
  - List metadata patch and valid item delete paths passed in the original run.
  - Case closed after focused route fix and vitest retest on 2026-07-03.

### F-007 - AW-157 single-event lookup missing not-found response

- Status: CLOSED_PASS
- Source doc: APP_WIDE_TEST_CASES
- Test IDs: AW-157
- Severity: P2
- Area: plan / events
- Environment: Windows 10 dev host; local app.inject with `NODE_ENV=test` + dev auth token
- Preconditions:
  - AW-157 requires truthful not-found behavior for single-event lookup.
- Steps to reproduce:
  1. `GET /api/v1/families/:familyId/events/upcoming` with dev auth -> observe ordered future events.
  2. `GET /api/v1/families/:familyId/events/countdowns` after an event has `countdown_label` set -> observe labeled rows only.
  3. `GET /api/v1/families/:familyId/events/:eventId` with a UUID that does not exist in the household.
- Expected:
  - Missing event returns 404 with `EVENT_NOT_FOUND` (consistent with `GET /:eventId/travel-reminder`).
- Actual:
  - **Before fix:** `GET /events/:missingId` returned HTTP 200 with an empty JSON body (`{}`) because `apps/backend/src/routes/events.ts` returned `{ event }` when `event` was null.
  - **After fix:** `GET /events/:missingId` returns 404 `{ error: "Event not found", code: "EVENT_NOT_FOUND" }`; existing event lookup still returns 200 with the event payload.
- Evidence:
  - Probe output `aw157.upcomingOrdered: true`, `countdownsAfterDbLabel.includesB: true` (prior pass-2 auxiliary checks).
  - `aw157.singleMissing` -> `status: 200`, `body: {}` (pre-fix).
  - Fix retest: `npx vitest run events.test.ts` -> 2/2 passed (`returns a single event by id`, `returns 404 for a missing event id`).
- Suspected layer:
  - backend
- Notes:
  - Countdown labels are not writable via create/update event API schema; read filter was verified after direct DB label set on prior pass.
  - Case closed after focused route fix and vitest retest on 2026-07-03.

### F-006 - Real-user journey packs A-F blocked: no mobile/device/account execution path

- Status: BLOCKED_ENV
- Source doc: REAL_USER_JOURNEY_TEST_CASES
- Test IDs: UJ-001, UJ-002, UJ-003, UJ-004, UJ-005, UJ-006, UJ-007, UJ-008, UJ-009, UJ-010, UJ-011, UJ-012, UJ-013, UJ-014, UJ-015, UJ-016, UJ-017, UJ-018, UJ-019, UJ-020, UJ-021, UJ-022, UJ-023, UJ-024, UJ-025, UJ-026, UJ-027, UJ-028, UJ-029, UJ-030, UJ-031, UJ-032, UJ-033, UJ-034, UJ-035, UJ-036, UJ-037, UJ-038, UJ-039
- Severity: P0
- Area: build / auth / family / child pairing / plan / settings / calendar / notifications / infra
- Environment: Windows 10 dev host on `main` @ `e2cf18e`; Railway backend health `200`; no iPhone/TestFlight build; no iOS simulator (`xcrun` absent); no Android emulator (`adb` absent); no provisioned Adult A/B accounts with mailbox access; no child test device; prior Expo web sign-up stopped at Supabase email-confirmation gate (see F-001)
- Preconditions:
  - Journey packs A-F require full end-to-end mobile execution per [REAL_USER_JOURNEY_TEST_CASES.md](./REAL_USER_JOURNEY_TEST_CASES.md).
  - Pack B+ depend on Pack A household creation (UJ-001).
  - Pack C depends on household + child device.
  - Packs D-F depend on authenticated mobile shell and/or device-only flows (offline, permissions, TestFlight upgrade, foreground/background).
- Steps to reproduce:
  1. Confirm `git status` on `E:\project planner\Project-Planner` at `e2cf18e`.
  2. Verify environment: `no_xcrun`, no `adb`, Railway `GET /api/v1/health` -> `200`.
  3. Attempt Pack A entry journey UJ-001 (install -> sign in -> create household -> Home).
  4. Observe no fresh mobile install, no confirmed Adult A session, and no path to complete any downstream pack without that prerequisite.
- Expected:
  - Each journey completes its full user goal end to end on a client-style mobile build with required accounts/devices.
- Actual:
  - No journey in packs A-F was executed to completion.
  - All 39 journeys marked `BLOCKED` with exact dependency/env blockers recorded in journey execution results table.
  - Backend-only evidence from prior app-wide runs is not treated as journey PASS.
- Evidence:
  - `git log -1 --oneline` -> `e2cf18e Disable Sentry auto-upload in EAS builds`
  - Environment probe: `no_xcrun`, Railway health `200`, auth status `200`
  - F-001 prior evidence: Expo web sign-up returned email-confirmation gate; no household shell reached
  - Journey results table added to `docs/REAL_USER_JOURNEY_TEST_CASES.md`
- Suspected layer:
  - env
- Notes:
  - See also F-001 for overlapping GO/NO-GO app-wide blockers AW-144..AW-149.
  - Retest owner for all blocked journeys: human tester with TestFlight/production-style iOS build, Adult A/B accounts, and child device.

### F-005 - AW-154 enabled job-state digest routes not exercised in current env

- Status: CLOSED_PASS
- Source doc: APP_WIDE_TEST_CASES
- Test IDs: AW-154
- Severity: P2
- Area: notifications / infra
- Environment: Windows 10 dev host; local vitest + `NODE_ENV=test` app.inject
- Preconditions:
  - AW-154 requires preview, queue, send-now, and jobs status in both enabled and disabled job states.
- Steps to reproduce:
  1. Run `npx vitest run notifications.test.ts -t "builds a daily digest preview"` and `-t "reports job queue status"`.
  2. Run app.inject for `POST /api/v1/notifications/daily-digest/queue` and `POST /api/v1/notifications/daily-digest/send-now` with `NODE_ENV=test`.
  3. Search `apps/backend/test` for `JOBS_ENABLED`, `daily-digest/queue`, or enabled-queue success coverage.
- Expected:
  - Preview, queue, send-now, and jobs status are truthful in both enabled and disabled job states.
- Actual:
  - Cursor correctly verified the disabled-path behavior first.
  - Supervisor then reran the route set with `NODE_ENV=test` and `JOBS_ENABLED=true`, started the PgBoss worker, seeded a push token for the dev user, and exercised enabled status, queue, and send-now successfully.
- Evidence:
  - `notifications.test.ts > builds a daily digest preview for the current family` passed.
  - `notifications.test.ts > reports job queue status honestly` passed (`enabled:false`, `started:false`).
  - app.inject `POST /notifications/daily-digest/queue?familyId=00000000-0000-4000-8000-000000000201` -> `409` `JOBS_DISABLED`.
  - Supervisor enabled-path harness:
    - `GET /notifications/jobs/status` -> `200 {"enabled":true,"started":true}`
    - `POST /notifications/daily-digest/queue?familyId=00000000-0000-4000-8000-000000000201` -> `200 {"queued":true,"jobId":"...","message":"Daily digest queued for background delivery."}`
    - Daily-digest notification count for the seeded dev user increased from `61` to `62`
    - Latest notification row matched `type:"daily_digest"` and `title:"Daily family digest"`
    - `POST /notifications/daily-digest/send-now?familyId=00000000-0000-4000-8000-000000000201` -> `200 {"queued":false,"delivered":1,"createdNotifications":1,"message":"Daily digest created and push delivery attempted for signed-in family members."}`
    - Stubbed push targets observed twice: `ExponentPushToken[aw154-enabled-probe]`
- Suspected layer:
  - none
- Notes:
  - Case is closed as passed.
  - Both disabled/unavailable and enabled/working job states were observed directly.

### F-004 - AW-153 saved recipe lifecycle incomplete in current build

- Status: CLOSED_PASS
- Source doc: APP_WIDE_TEST_CASES
- Test IDs: AW-153
- Severity: P2
- Area: meals / recipes
- Environment: Windows 10 dev host; local vitest + `NODE_ENV=test` app.inject
- Preconditions:
  - AW-153 requires create, edit, reuse in Meals, and delete (if path exists) with linked meal rendering stability.
- Steps to reproduce:
  1. Create recipe, patch title, link to meal plan via `POST /meals`.
  2. `DELETE /recipes/:recipeId`.
  3. `GET /meals` for the same week.
- Expected:
  - Full saved-recipe lifecycle survives create -> edit -> meal reuse -> delete, with stable linked meal rendering.
- Actual:
  - **Before fix:** delete cleared `recipeId` via FK `ON DELETE SET NULL` but left `customTitle` null, so `GET /meals` returned `recipeTitle:null` and mobile `mapMeal()` fell back to `"Planned meal"`.
  - **After fix:** recipe delete copies the recipe title into `meal_plan_items.customTitle` for linked items that had no custom title, then deletes the recipe; meal remains in the week with `recipeId:null`, stable `customTitle`, and `recipeTitle:null`.
- Evidence:
  - Fix 2026-07-03: `apps/backend/src/routes/recipes.ts` `DELETE /:recipeId` transaction updates linked `meal_plan_items` before recipe delete.
  - `npx vitest run recipes.test.ts` -> 2/2 passed (`supports saved recipe create, edit, meal reuse, and delete lifecycle` asserts post-delete `customTitle: "AW153 Lifecycle Recipe Updated"`).
  - GitNexus `impact({target: "recipesRoutes", direction: "upstream"})` -> risk LOW, 0 direct dependents.
- Suspected layer:
  - backend
- Notes:
  - Backend-only fix; mobile `mapMeal()` already prefers `recipeTitle ?? customTitle`.
  - Case closed after focused route fix and vitest retest on 2026-07-03.

### F-003 - AW-143 cross-family notification isolation not verifiable in current test suite

- Status: CLOSED_PASS
- Source doc: APP_WIDE_TEST_CASES
- Test IDs: AW-143
- Severity: P1
- Area: notifications / security
- Environment: Windows 10 dev host; local vitest (`security-hardening.test.ts`, `pushNotifications.test.ts`, `notifications.test.ts`)
- Preconditions:
  - AW-143 requires triggering notifications for Household A while authenticated as a different account in Household B, then proving notification data and device routing do not leak across families.
- Steps to reproduce:
  1. Run `npm --workspace apps/backend run test -- --run security-hardening.test.ts pushNotifications.test.ts notifications.test.ts`.
  2. Search `apps/backend/test` for cross-family notification isolation coverage (`rg -n "cross-family|notification" apps/backend/test`).
  3. Confirm whether any test creates two households with two distinct accounts, delivers notification for family A, and asserts family B account/device does not receive or list it.
- Expected:
  - Notification data and device routing stay isolated by household across accounts.
- Actual:
  - Cursor was correct that the committed test suite lacked a dedicated AW-143 case.
  - Supervisor then executed a direct harness from `apps/backend` using two isolated families, two adult users, and two child-device push targets.
  - Delivering an `event_reminder` to Family A created one notification row for Family A's adult only, created zero rows for Family B's adult, and attempted push delivery only to Family A adult/child tokens.
- Evidence:
  - `npx vitest run security-hardening.test.ts pushNotifications.test.ts notifications.test.ts` -> 3 files passed, 15 tests passed; none map to AW-143 cross-family isolation.
  - `rg` across `apps/backend/test` found cross-family coverage for events/chores/reads only, not notifications across households/accounts.
  - Supervisor harness output:
    - `delivery={"adultDelivered":1,"adultNotificationsCreated":1,"childDelivered":1,"childDevicesTargeted":1}`
    - `rowsForUserA=[{"userId":"00000000-0000-4000-8000-00000000a143","familyId":"00000000-0000-4000-8000-00000000c143","title":"AW-143 isolation probe"}]`
    - `rowsForUserB=[]`
    - `pushTargets=["ExponentPushToken[aw143-adult-a]","ExponentPushToken[aw143-child-a]"]`
- Suspected layer:
  - test gap only
- Notes:
  - Positive single-household routing tests were insufficient for AW-143 per supervisor rule, so the supervisor completed the missing negative-recipient verification directly.
  - Case is closed as passed.

### F-002 - AW-150 unconfigured auth-status mode not exercisable in current env

- Status: CLOSED_PASS
- Source doc: APP_WIDE_TEST_CASES
- Test IDs: AW-150
- Severity: P2
- Area: auth / infra
- Environment: Windows 10 dev host; local vitest + Railway production backend
- Preconditions:
  - AW-150 requires querying `/api/v1/auth/status` without a bearer token in both configured and unconfigured auth modes.
- Steps to reproduce:
  1. Verify configured mode via `GET https://homethread-backend-production.up.railway.app/api/v1/auth/status` (no token).
  2. Attempt to boot/query the same endpoint in an unconfigured auth mode without Supabase credentials.
  3. Try unsetting `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` before importing backend env; backend env schema rejects empty values and local `.env` always repopulates credentials on startup.
- Expected:
  - Auth status is truthful in both configured and unconfigured auth modes without requiring a session.
- Actual:
  - Original Cursor run verified configured mode only and stopped short of a true unconfigured harness.
  - Supervisor reran the case with Supabase env vars removed, `DEV_AUTH_ENABLED` removed, and `DOTENV_CONFIG_PATH` pointed at a missing file so `apps/backend/.env` was not loaded.
  - Under that isolated process, `/api/v1/auth/status` returned truthful unconfigured output and the case passed.
- Evidence:
  - Configured HTTP 200: `{"supabaseConfigured":true,"devTokenAllowed":false,"mode":"supabase"}`.
  - Local vitest `auth guard > returns auth status without requiring a token` passed (200, `devTokenAllowed: true` in `NODE_ENV=test`).
  - Local isolated subprocess: `{"NODE_ENV":"development","DEV_AUTH_ENABLED":false,"status":{"supabaseConfigured":false,"devTokenAllowed":false,"mode":"unconfigured"}}`.
  - Local isolated app inject: `{"statusCode":200,"body":{"supabaseConfigured":false,"devTokenAllowed":false,"mode":"unconfigured"}}`.
- Suspected layer:
  - env
- Notes:
  - Case is closed as passed.
  - Important harness note: `z.coerce.boolean()` treats the string `"false"` as truthy, so `DEV_AUTH_ENABLED` must be removed rather than set to `"false"` when simulating disabled dev auth.

### F-001 - Release smoke batch AW-144..AW-149 blocked: no device/build accounts for GO/NO-GO E2E

- Status: BLOCKED_ENV
- Source doc: APP_WIDE_TEST_CASES
- Test IDs: AW-001, AW-002, AW-003, AW-005, AW-006, AW-007, AW-008, AW-009, AW-010, AW-011, AW-012, AW-013, AW-014, AW-015, AW-016, AW-017, AW-020, AW-022, AW-024, AW-025, AW-026, AW-030, AW-031, AW-035, AW-041, AW-042, AW-043, AW-049, AW-051, AW-052, AW-053, AW-054, AW-055, AW-056, AW-057, AW-058, AW-059, AW-060, AW-064, AW-066, AW-067, AW-068, AW-069, AW-072, AW-073, AW-074, AW-075, AW-076, AW-077, AW-078, AW-079, AW-080, AW-085, AW-086, AW-087, AW-088, AW-089, AW-090, AW-091, AW-092, AW-093, AW-094, AW-095, AW-096, AW-097, AW-098, AW-099, AW-101, AW-104, AW-105, AW-106, AW-107, AW-108, AW-109, AW-112, AW-113, AW-114, AW-115, AW-116, AW-117, AW-118, AW-119, AW-120, AW-121, AW-122, AW-124, AW-127, AW-128, AW-129, AW-130, AW-131, AW-132, AW-133, AW-134, AW-144, AW-145, AW-146, AW-147, AW-148, AW-149, AW-155, AW-156
- Severity: P0
- Area: build / auth / family / child pairing / plan / settings / calendar / infra
- Environment: Windows 10 dev host; Expo web at `http://localhost:19006`; Railway backend `https://homethread-backend-production.up.railway.app/api/v1` (`health` 200, `db: ok`); Supabase auth mode `supabase` with `devTokenAllowed: false`; no iPhone/TestFlight build (E1); no iOS simulator (`xcrun` absent); no Android emulator (`adb` absent); no provisioned Adult A/B test accounts (E3/E4); no child test device (E5)
- Preconditions:
  - GO/NO-GO cases require fresh install -> sign-in -> full household journeys on a real mobile build.
  - Adult A must reach household creation and invite code (AW-144).
  - Adult B, child device, planner objects, settings/avatar, and calendar sync depend on completed authenticated household state.
- Steps to reproduce:
  1. Attempt AW-144 on available environment (Expo web, not fresh iPhone install).
  2. Open Welcome -> Create household -> email/password sign-up with `aw144qa202607030332@mailinator.com`.
  3. Observe post-sign-up state and attempt to continue into household creation/shell.
  4. Confirm no iPhone/Android device, no second adult account, and no child device are available for AW-145..AW-149.
- Expected:
  - AW-144: Fresh install -> sign in -> create household -> enter shell with adult invite code.
  - AW-145..AW-149: Dependent GO/NO-GO journeys complete on authenticated household/device surfaces.
- Actual:
  - Expo web Welcome loaded and sign-up submitted successfully with message: `Account created. Check your email to confirm your address before signing in.`
  - Could not sign in, create household, or enter shell because email confirmation was not available in this session.
  - Could not execute fresh-install mobile path; web dev session is not the required E1 environment.
  - AW-145..AW-149 were not runnable because prerequisite authenticated household/device state was never established.
- Evidence:
  - Browser screenshot: Welcome auth form after sign-up showing email-confirmation message.
  - HTTP: `GET /api/v1/health` -> `{"status":"ok","service":"homethread-backend","db":"ok"}`.
  - HTTP: `GET /api/v1/auth/status` -> `{"supabaseConfigured":true,"devTokenAllowed":false,"mode":"supabase"}`.
  - HTTP: `POST /api/v1/families` with dev token -> `401` (production dev-auth disabled).
  - Expo web console: bundled successfully on `http://localhost:19006`.
  - Blockers: missing E1 fresh iPhone/TestFlight install, missing E3/E4 accounts with mailbox access, missing E5 child device.
- Suspected layer:
  - env
- Notes:
  - Backend unit tests `families.test.ts` + `childDevices.test.ts` passed locally (16/16), but those are not substitutes for GO/NO-GO UI/runtime cases and were not used to mark PASS.
  - AW-145 remains blocked by dependency on AW-144 per supervisor rules.
  - Section D: AW-024/025/026 blocked (no Adult A/B household UI path); AW-030/031/035 blocked (client-only confirmation/multi-view/cascade messaging); API-backed join/member/admin cases passed separately in execution table.
  - Section C: AW-014/015 blocked at Supabase email-confirmation gate; AW-016/017 blocked before Google post-auth/cancel verification; AW-020 blocked (reset only in Settings); AW-022 blocked pending signed-in household setup.
  - Also blocks Section B startup/lifecycle cases AW-007..AW-013 (client kill/relaunch, session restore, backgrounding, offline relaunch, child cold relaunch require E1/E5 mobile runtime).
  - AW-007 partial only: fresh Expo web tab @ `http://localhost:19006` rendered Welcome entry (`Create household`, `Join household`, `Set up child's device`) without adult tabs — not substituted for mobile cold launch.
  - AW-010..AW-012 additionally depend on AW-008 household session prerequisite per master-order dependency rule.
  - Also blocks Section A install/launch cases AW-001, AW-002, AW-003, AW-005, AW-006 (no E1 production-style device build to install/launch).
  - Also blocks AW-155 (child shell unpair/relaunch) and AW-156 (Settings diagnostics UI on current build).
  - AW-004 tracked separately under F-010 (EAS login / iOS prebuild host limits).
  - Section E: AW-041 blocked (FamilyScreen pairing-code reopen UI); AW-042 blocked (child-device preview display on E5); AW-043 blocked (child shell + local token storage); AW-049 blocked (OS notification permission on E5). API-backed pairing/security/chore cases passed separately in execution table.
  - Section F: AW-051..AW-055 blocked (Home/More/Kids Mode client navigation requires authenticated household shell; Expo web snapshot 2026-07-03 shows Welcome only, no adult tabs).
  - Section G: AW-056..AW-060 blocked (PlanScreen/Home event UI requires authenticated shell; API/unit partial evidence recorded separately). AW-061..AW-063 passed via backend tests.
  - Section H: AW-064/066..069 blocked (ChoresScreen/adult shell UI requires authenticated shell; API/store partial evidence recorded separately). AW-065/070/071 passed via backend tests.
  - Section I: AW-072..AW-078 blocked (ListsScreen/offline client flows require authenticated shell or E1/E7 device runtime; API/mobile-store partial evidence recorded separately).
  - Section J: AW-079/080/085/086 blocked (MealsScreen/grocery-bridge client flows require authenticated shell; API/store partial evidence recorded separately). AW-081..AW-084 passed via backend tests.
  - Section K: AW-087..AW-095 blocked (ThreadScreen/AssistantScreen client-shell flows require authenticated shell or device UI; board/assistant storage and `/ai/*` API partial evidence recorded separately, not upgraded to PASS).
  - Section L: AW-096/097/098/099/101 blocked (CalendarSyncScreen/provider handoff requires authenticated shell; API partial evidence only). AW-100/102/103 passed via backend callback/security/sync tests.
  - Section M: AW-104..AW-109 blocked (InsightsScreen/notifications inbox client surfaces require authenticated shell; API partial evidence only, not upgraded to PASS). AW-110/111 passed via backend jobs-status and push-routing tests (AW-110 enabled branch cites F-005 harness; AW-154 not rerun).
  - Section N: AW-112..AW-121 blocked (SettingsScreen/profile/password/account-safety flows require authenticated shell or device runtime; API/store/code partial evidence only, not upgraded to PASS).
  - Section O: AW-122/124 blocked (FamilyScreen billing preview/status and role-based billing controls require authenticated shell; preview copy is not production proof). AW-123/125/126 passed via backend plus-gating and RevenueCat webhook tests (AW-126 wrong-secret branch verified by one-off inject probe, not vitest).
  - Section P: AW-127..AW-134 blocked (offline/replay/realtime/recovery/isolation flows require device/shell runtime; store/service unit partial evidence recorded separately, not upgraded to PASS). AW-135 passed via `childDevices.test.ts` adult-on-child route rejection plus one-off inject probe for child token on adult family route.
  - Section R: AW-144..AW-149 blocked (GO/NO-GO release smoke requires E1 mobile build plus authenticated household/device paths; AW-144 stopped at Supabase email-confirmation gate on Expo web; AW-145..AW-149 not runnable without prerequisite state).
  - Final release pass 2026-07-04: no TestFlight/iPhone/Android device path available; `eas whoami` not logged in and `EXPO_TOKEN` absent (see F-010); Section R not re-executed — prerequisites unchanged.
  - Section Q/S execution tables reconciled 2026-07-03 in `APP_WIDE_TEST_CASES.md` (AW-137..143 PASS; AW-150/151/152/154 PASS; AW-153 FAIL F-004).

## Summary Checklist

- [x] All current failures have a unique `F-###` entry
- [x] Every failed or blocked test case in execution chat is mirrored here
- [ ] Every `FIXED_AWAITING_RETEST` item has an explicit retest owner
- [ ] No item is marked `CLOSED_PASS` without a re-run of the original case

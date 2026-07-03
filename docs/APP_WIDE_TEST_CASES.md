# HomeThread App-Wide Test Cases

This document is the exhaustive, system-level test inventory for the entire HomeThread app as it exists at current `HEAD` (`e2cf18e` when this document was prepared).

It is intentionally broad. It covers user-visible behavior, backend-backed behavior, external integrations, household-role safety, child-device flows, offline/realtime behavior, and release smoke checks.

This file does not mean the cases were executed. It is a test design artifact for deadline-driven handoff and final stabilization.

## Supervisor Execution Rules

This file is the primary execution master for full-app testing.

Use these status labels exactly:

- `TODO` - not executed yet
- `IN_PROGRESS` - currently being tested
- `PASS` - executed and matched expected behavior
- `FAIL` - executed and did not match expected behavior
- `BLOCKED` - could not be executed because of missing device, build, env, account, or external dependency
- `N/A` - intentionally not applicable to the current build or test environment

Hard rules:

- Do not mark a case `PASS` unless the behavior was actually observed.
- Do not invent results when Cursor or a tester cannot complete a step.
- Every `FAIL` or `BLOCKED` result must be logged in [TEST_FAILURE_LOG.md](./TEST_FAILURE_LOG.md).
- If a case depends on real device behavior, keep it `BLOCKED` until someone with the right device/build confirms it.
- If a later case depends on an earlier failed case, keep the later case `BLOCKED` and reference the failure ID.

## Current Progress Checklist

Mark these checkboxes as execution proceeds.

- [x] Section A complete: Build, Install, Upgrade, and Launch Packaging — mixed 2026-07-03 (AW-001/002/003/005/006 BLOCKED F-001; AW-004 BLOCKED F-010)
- [x] Section B complete: Startup, Session Bootstrap, and Lifecycle — all BLOCKED 2026-07-03 under F-001 (no E1 mobile client lifecycle path)
- [x] Section C complete: Authentication and Entry Flows — mixed 2026-07-04 (AW-018/019/021/023 PASS Expo web; remainder BLOCKED F-001)
- [x] Section D complete: Household Creation, Join, Member Management, and Admin Roles — mixed 2026-07-03 (AW-027..029/032..034/036..039 PASS API; AW-024..026/030/031/035 BLOCKED F-001)
- [x] Section E complete: Child Device Lifecycle — mixed 2026-07-03 (AW-040/044..048/050 PASS API; AW-041..043/049 BLOCKED F-001)
- [x] Section F complete: Home, Navigation, More Hub, and Kids Mode — all BLOCKED 2026-07-03 under F-001 (no authenticated household shell)
- [x] Section G complete: Plan and Events — mixed 2026-07-03 (AW-061..063 PASS API; AW-056..060 BLOCKED F-001)
- [x] Section H complete: Chores and Rewards — mixed 2026-07-03 (AW-065/070/071 PASS API; AW-064/066..069 BLOCKED F-001)
- [x] Section I complete: Lists and Grocery — all BLOCKED 2026-07-03 under F-001 (ListsScreen client flows; API/store partial evidence recorded)
- [x] Section J complete: Meals and Recipes — mixed 2026-07-03 (AW-081..084 PASS API; AW-079/080/085/086 BLOCKED F-001)
- [x] Section K complete: Family Board, Thread, and Assistant — all BLOCKED 2026-07-03 under F-001 (Thread/Assistant client-shell flows; storage/API partial evidence only)
- [x] Section L complete: Calendar Sync — mixed 2026-07-03 (AW-100/102/103 PASS API; AW-096/097/098/099/101 BLOCKED F-001)
- [x] Section M complete: Insights and Notifications — mixed 2026-07-03 (AW-110/111 PASS API; AW-104..109 BLOCKED F-001)
- [x] Section N complete: Settings, Profile, Notifications, and Account Safety — all BLOCKED 2026-07-03 under F-001 (SettingsScreen/device runtime; API/code partial only)
- [x] Section O complete: Subscriptions, Billing, and Monetization Controls — mixed 2026-07-03 (AW-123/125/126 PASS API; AW-122/124 BLOCKED F-001)
- [x] Section P complete: Offline, Realtime Sync, Recovery, and Data Integrity — mixed 2026-07-03 (AW-135/136 PASS API; AW-127..134 BLOCKED F-001)
- [x] Section Q complete: Security, Permissions, and Trustworthiness — mixed 2026-07-03 (AW-137..143 PASS API/harness; AW-143 cites F-003 closed)
- [x] Section R complete: Release Smoke and Client-Handoff Minimum Pack — all BLOCKED 2026-07-04 under F-001 (final pass: no E1/TestFlight/device path; AW-144..AW-149 not re-run; see F-010 for iOS build auth)
- [x] Section S complete: Supplemental API, Recipe, and Ops Coverage — PASS 2026-07-03 (AW-150..154 PASS API; AW-153 PASS API F-004 closed)
- [x] Section T complete: Hidden/Admin/API Surfaces and Release Diagnostics — mixed 2026-07-03 verified pass 2 (AW-155/156 BLOCKED F-001; AW-157/158/159 PASS API retest 2026-07-03; AW-160 PASS)

Real-user journey execution ([REAL_USER_JOURNEY_TEST_CASES.md](./REAL_USER_JOURNEY_TEST_CASES.md)): Packs A–F all **BLOCKED** under F-006 as of 2026-07-03 (39 journeys; no mobile/device/account path on current Windows dev host).

## How Cursor Should Report Results

For each executed case, return results in this shape:

`TEST_ID | STATUS | short outcome | evidence note`

Examples:

- `AW-024 | PASS | household created and invite code shown | screen recording + copied code`
- `AW-043 | FAIL | child preview showed wrong household name | screenshot attached`
- `AW-098 | BLOCKED | Google OAuth env not ready in Railway | waiting for backend env confirmation`

If Cursor cannot verify a runtime-dependent case, it must not guess. It should report `BLOCKED` with the exact blocker.

## How This Was Built

Pass 1 used the live application surface:

- refreshed GitNexus index for `Project-Planner`
- `apps/mobile/App.tsx` screen shell and navigation
- all mobile screens in `apps/mobile/src/screens`
- backend route registration in `apps/backend/src/app.ts`
- GitNexus route map for the backend API surface
- backend test suite in `apps/backend/test`

Pass 2 added cross-flow and regression coverage:

- startup/session/bootstrap behavior
- offline queue and realtime sync
- child-device security and revocation
- external service truthfulness
- release/install/update confidence checks

Pass 3 closed coverage gaps that were easy to miss on a first audit:

- hidden child-device lifecycle surfaces such as self-unpair and relaunch
- settings diagnostics and release-readiness truthfulness
- ancillary read endpoints for events and chores
- list edit/delete API edges
- member roster and last-admin removal safety

## Environment Matrix

Use these environments when possible:

- `E1` Clean iPhone install with TestFlight or production-style build
- `E2` Existing iPhone install upgraded over an older build
- `E3` Adult account A with no household
- `E4` Adult account B for join flow
- `E5` Child device or fresh simulator/install for pairing
- `E6` Healthy backend + Supabase + Railway env
- `E7` Limited or no network
- `E8` Google OAuth configured correctly
- `E9` Supabase avatar bucket and storage policies configured
- `E10` Push permission allowed and denied variants

## Coverage Map

| Surface | Coverage Source |
| --- | --- |
| Mobile shell and navigation | `apps/mobile/App.tsx` |
| User-facing screens | `apps/mobile/src/screens/*` |
| Backend routes | `apps/backend/src/app.ts` + GitNexus route map |
| Shared behavior expectations | backend tests in `apps/backend/test` |
| Existing launch concerns | `FINAL_RUNTIME_CHECKLIST.md` and `LAUNCH_AUDIT_TRACKER.md` |

## Surface Traceability

This section exists to prove that the test inventory covers the full app surface rather than only a few obvious flows.

### Mobile Surface to Test-ID Mapping

| Mobile Surface | Primary Coverage |
| --- | --- |
| `WelcomeScreen` | `AW-007` to `AW-023` |
| `HomeScreen` | `AW-008` to `AW-013`, `AW-051` to `AW-055` |
| `FamilyScreen` | `AW-024` to `AW-050`, `AW-122` to `AW-126`, `AW-160` |
| `ChildDeviceSetupScreen` | `AW-040` to `AW-049` |
| `ChildDeviceShellScreen` | `AW-043`, `AW-049`, `AW-050`, `AW-155` |
| `PlanScreen` | `AW-056` to `AW-063` |
| `ChoresScreen` | `AW-064` to `AW-071` |
| `ListsScreen` | `AW-072` to `AW-078` |
| `MealsScreen` | `AW-079` to `AW-086` |
| `ThreadScreen` / Family Board | `AW-087` to `AW-090` |
| `AssistantScreen` | `AW-091` to `AW-095` |
| `CalendarSyncScreen` | `AW-096` to `AW-103`, `AW-149` |
| `InsightsScreen` | `AW-104` to `AW-106` |
| `SettingsScreen` | `AW-112` to `AW-121`, `AW-148`, `AW-156` |
| `MoreScreen` | `AW-051` to `AW-055`, `AW-122` to `AW-126` |
| `KidsModeScreen` / `KidsModePickerScreen` | `AW-050`, `AW-055` |
| Shell-level startup, auth, realtime, offline, and install behavior | `AW-001` to `AW-023`, `AW-127` to `AW-136`, `AW-144` to `AW-149` |

### Backend Surface to Test-ID Mapping

| Backend Surface | Primary Coverage |
| --- | --- |
| `/api/v1/auth/*` | `AW-014` to `AW-023`, `AW-112` to `AW-121`, `AW-150`, `AW-152` |
| `/api/v1/families/*` | `AW-024` to `AW-039`, `AW-133`, `AW-144`, `AW-145` |
| `/api/v1/families/:familyId/members/*` | `AW-033` to `AW-039`, `AW-160` |
| `/api/v1/families/:familyId/* child admin routes` | `AW-040` to `AW-050` |
| `/api/v1/child-devices/*` | `AW-042` to `AW-050`, `AW-135`, `AW-155` |
| `/api/v1/families/:familyId/events/*` | `AW-056` to `AW-063`, `AW-127`, `AW-138`, `AW-140`, `AW-141`, `AW-157` |
| `/api/v1/families/:familyId/chores/*` | `AW-064` to `AW-071`, `AW-139`, `AW-158` |
| `/api/v1/families/:familyId/lists/*` | `AW-072` to `AW-078`, `AW-159` |
| `/api/v1/families/:familyId/meals/*` | `AW-079` to `AW-086` |
| `/api/v1/families/:familyId/recipes/*` | `AW-081` to `AW-086`, `AW-153` |
| `/api/v1/ai/*` | `AW-091` to `AW-095` |
| `/api/v1/calendar-sync/*` | `AW-096` to `AW-103`, `AW-149` |
| `/api/v1/families/:familyId/insights/*` | `AW-104` to `AW-106` |
| `/api/v1/notifications/*` | `AW-107` to `AW-111`, `AW-154` |
| `/api/v1/subscriptions/*` and `/api/v1/webhooks/revenuecat` | `AW-122` to `AW-126` |
| `/api/v1/health` | `AW-151` |

### Coverage Rule

If any new screen, new route, or new third-party integration is added after this document, the test plan is no longer complete until at least one positive case and one failure-truthfulness case are added for that surface.

## Supervisor Completeness Verdict

As of current `HEAD`, every mobile screen, registered backend route group, and identified hidden/local-only release surface in HomeThread maps to at least one case in this file.

That means the inventory is complete for the current product surface. It does **not** mean all cases have passed. Execution status and known failures still live in [TEST_FAILURE_LOG.md](./TEST_FAILURE_LOG.md).

## Pass 1: Feature-By-Feature Test Cases

### A. Build, Install, Upgrade, and Launch Packaging

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| AW-001 | `[P0]` Clean install on fresh iPhone | Install latest production-style iOS build on a device with no prior app data; launch once. | App installs successfully, launches without crash, and shows branded startup path. |
| AW-002 | `[P0]` Upgrade over an existing install | Install a newer build over a previously installed working build. | App upgrades without corrupting local state, session, or household-linked data. |
| AW-003 | Reinstall after delete | Delete the app fully, reinstall, and launch. | Device-local state is cleared; the user must sign in or re-pair rather than inheriting stale local data. |
| AW-004 | Root Expo config remains build-safe | Run a production-style iOS build path from repo root using the documented TLS-safe command pattern. | Build tooling uses the intended Expo config and does not fail because of root prebuild conflicts. |
| AW-005 | Sentry runtime initialization does not block app start | Launch a build with Sentry DSN present and without Sentry auto-upload during build. | App starts normally; runtime monitoring setup does not block launch. |
| AW-006 | Production API configuration truthfulness | Launch a production-style build with intentionally missing or wrong public API config. | App surfaces a truthful startup/config problem instead of silently pretending the backend is healthy. |

### Section A execution results (2026-07-03)

| TEST_ID | STATUS | short outcome | evidence note |
| --- | --- | --- | --- |
| AW-001 | BLOCKED | fresh iPhone clean install not runnable | F-001: no_xcrun, no TestFlight/production iOS build (E1), no physical iPhone in session |
| AW-002 | BLOCKED | upgrade-over-install not runnable | F-001: requires prior installed working iOS build + newer build; no E1 device/install baseline |
| AW-003 | BLOCKED | reinstall-after-delete not runnable | F-001: requires full app delete/reinstall cycle on device; no E1 device |
| AW-004 | BLOCKED | iOS production-style EAS build not completed | F-010: `eas build --platform ios --profile preview` from `apps/mobile` stops with `An Expo user account is required`; `expo prebuild --platform ios` on Windows skips iOS native generation; root `expo config` resolves `HomeThread` with `apps/mobile` asset paths (partial only) |
| AW-005 | BLOCKED | production build launch with Sentry not runnable | F-001: no production-style installed build to launch; partial config only: `eas.json` sets `SENTRY_DISABLE_AUTO_UPLOAD:true` on all profiles @ `e2cf18e`; `initMobileSentry()` no-ops in `__DEV__` |
| AW-006 | BLOCKED | misconfigured production API launch not runnable | F-001: case requires launching a production-style build with wrong/missing `EXPO_PUBLIC_API_URL`; code path exists (`isProductionApiMisconfigured()` -> config block UI in `App.tsx`) but not observed on a production install here |

### B. Startup, Session Bootstrap, and Lifecycle

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| AW-007 | `[P0]` Cold launch while signed out | Kill the app; relaunch with no active session. | Splash/brief loading resolves to Welcome, not to adult tabs or child shell. |
| AW-008 | `[P0]` Cold launch while signed in with a household | Sign in successfully, kill the app, relaunch. | Session restores cleanly, backend hydrate completes, and Home opens without loop or blank state. |
| AW-009 | Signed-in user without household | Sign in with a valid account that is not linked to a household. | App lands in family setup, not in the main shell with broken empty state. |
| AW-010 | Background then foreground | Open the app, send to background for 30-60 seconds, reopen. | Session remains valid; app resumes the same household context without forced sign-out. |
| AW-011 | Long session token refresh | Keep the app open long enough for auth token refresh to occur. | Session stays usable and app does not fully reboot into a broken intermediate state. |
| AW-012 | Offline launch after prior success | Use the app successfully, then kill it and reopen while offline. | App behaves honestly: cached state may appear, but new network actions do not pretend to succeed. |
| AW-013 | Child device cold relaunch | Pair a child device, kill the app, relaunch it. | Child device reopens into validated child flow or truthful unpaired state, never adult shell flash. |

### Section B execution results (2026-07-03)

| TEST_ID | STATUS | short outcome | evidence note |
| --- | --- | --- | --- |
| AW-007 | BLOCKED | cold launch signed-out not runnable on E1 | F-001: no_xcrun/no_adb/no TestFlight iOS build; case requires kill+relaunch mobile app; Expo web fresh load @ `localhost:19006` shows Welcome actions only (Create/Join/Child setup) — partial, not E1 cold launch |
| AW-008 | BLOCKED | signed-in household cold relaunch not runnable | F-001: no confirmed adult session with household (prior sign-up stopped at Supabase email-confirmation gate) |
| AW-009 | BLOCKED | signed-in no-household path not runnable | F-001: no provisioned adult account without family membership available in session |
| AW-010 | BLOCKED | background/foreground resume not runnable | F-001 + depends on AW-008 authenticated household session never established |
| AW-011 | BLOCKED | long session token refresh not runnable | F-001 + depends on AW-008 sustained authenticated mobile session |
| AW-012 | BLOCKED | offline relaunch not runnable | F-001 + depends on AW-008 prior successful in-app household use on device |
| AW-013 | BLOCKED | child device cold relaunch not runnable | F-001: no child test device (E5); no paired child shell to kill/relaunch |

### C. Authentication and Entry Flows

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| AW-014 | `[P0]` Email/password sign-up | Register a new adult account with email/password. | Account is created or a clear error is shown; next step routes into household setup. |
| AW-015 | `[P0]` Email/password sign-in | Sign in with an existing adult account. | Sign-in succeeds and the user lands in either household setup or the app shell, depending on membership. |
| AW-016 | `[P0]` Google sign-in | Start Google sign-in from Welcome and complete provider consent. | User returns to the app and lands in the correct post-auth state. |
| AW-017 | Google sign-in cancel | Start Google sign-in and cancel midway. | App reports cancellation truthfully and remains usable. |
| AW-018 | Invalid password | Enter wrong password for an existing email. | App shows a clear auth failure without entering the shell. |
| AW-019 | Unknown account sign-in | Attempt sign-in for an unregistered account. | Failure is explicit and does not create accidental partial session state. |
| AW-020 | Password reset request | Trigger forgot-password/reset flow from a valid account context. | User gets truthful feedback that the reset request was sent or why it was unavailable. |
| AW-021 | Welcome mode switching | Switch between create-household and join-household paths from Welcome repeatedly. | UI state remains coherent; no mode gets stuck or leaks values from the other path. |
| AW-022 | Back navigation from family setup | Enter family setup as a signed-in user with no household, then back out. | App stays usable and still provides a clear way to create or join a household. |
| AW-023 | Child-device entry from Welcome | Tap the child-device setup entry from Welcome. | App opens child setup flow directly rather than adult onboarding. |

### Section C execution results (2026-07-03)

| TEST_ID | STATUS | short outcome | evidence note |
| --- | --- | --- | --- |
| AW-014 | BLOCKED | sign-up does not reach household setup | F-001: Expo web create-account -> `Account created. Check your email to confirm...`; stayed on register screen, no family-setup route (no mailbox to confirm) |
| AW-015 | BLOCKED | confirmed-account sign-in not runnable | F-001: sign-in attempt on AW-014 account -> `Email not confirmed`; no shell/household-setup landing |
| AW-016 | BLOCKED | Google sign-in post-auth not completed | F-001: `Continue with Google` opened `accounts.google.com` chooser; did not complete consent/return to verify post-auth landing |
| AW-017 | BLOCKED | Google cancel midway not executed | F-001: OAuth abandon via browser return left Welcome usable, but no in-flow cancel message observed; depends on AW-016 completion path |
| AW-018 | PASS | wrong password shows auth failure | Expo web login with existing `aw014batch...@mailinator.com` + wrong password -> `Invalid login credentials`; remained on Welcome/login |
| AW-019 | PASS | unknown account sign-in fails explicitly | Expo web login `aw019unknownnotexist@mailinator.com` -> `Invalid login credentials`; no shell entered |
| AW-020 | BLOCKED | password reset not reachable unsigned | F-001: `requestPasswordReset` exists only in `SettingsScreen`; requires signed-in account context not available here |
| AW-021 | PASS | create/join mode switch clears email across paths | F-011 closed 2026-07-04: Expo web `http://localhost:8081` create->email->back->join email/password empty; join->email->back->create empty; mode pills coherent |
| AW-022 | BLOCKED | family-setup back nav not runnable | F-001: depends on AW-014 signed-in household-setup state never reached |
| AW-023 | PASS | Welcome opens child setup flow | Expo web `Set up child's device` -> Child device / Pair this device / KC- code entry; not adult onboarding |

### D. Household Creation, Join, Member Management, and Admin Roles

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| AW-024 | `[P0]` Create a household as Adult A | Sign in as a new adult, choose create household, enter household name. | Household is created, Adult A becomes admin, and adult invite code is shown. |
| AW-025 | Copy adult invite code | Use the copy action on the adult invite code. | Copy feedback is shown and the copied code is pasteable elsewhere. |
| AW-026 | `[P0]` Join a household as Adult B | Sign in as another adult, choose join, paste Adult A's invite code. | Join succeeds and Adult B enters the same household. |
| AW-027 | Join code normalization | Enter the adult invite code with lower-case letters or leading/trailing whitespace. | Join flow normalizes input and still succeeds. |
| AW-028 | Reject unknown adult invite code | Enter a non-existent adult invite code. | User gets a truthful not-found error and is not linked to a household. |
| AW-029 | Reject child pairing code on adult join | Enter a `KC-...` code in the adult join flow. | Flow rejects it with adult-invite-required guidance. |
| AW-030 | Rename household | As an admin, edit the household name. | New name persists across refresh and across other adult views. |
| AW-031 | Regenerate adult invite code | As an admin, trigger invite regeneration and confirm it. | New invite code is issued, old code is invalidated, and the warning/confirmation path is clear. |
| AW-032 | Non-admin invite regeneration blocked | Attempt invite regeneration as a non-admin adult. | Action is blocked with truthful authorization messaging. |
| AW-033 | Create virtual child member | As an admin, add a child profile/member. | Child profile is created and appears correctly in household management. |
| AW-034 | Edit virtual child member | Update a child member's display name or related metadata. | Changes persist and are shown consistently. |
| AW-035 | Delete virtual child member | Delete a child profile after reviewing the destructive warning. | Child profile is removed and any cascading device consequences are clearly communicated. |
| AW-036 | Promote signed-in adult to admin | Promote Adult B to admin from household management. | Promotion succeeds only for valid adult members and reflects in labels and permissions. |
| AW-037 | Reject invalid admin promotion target | Attempt to promote a virtual child or invalid adult target. | Backend and UI both reject the action cleanly. |
| AW-038 | Last admin leave blocked | As the only admin, attempt to leave the household. | Leave is blocked with a specific prompt to promote another adult first. |
| AW-039 | Admin leave after promotion | Promote another adult to admin, then leave as the original admin. | Leave succeeds and household remains intact for remaining members. |

### Section D execution results (2026-07-03)

| TEST_ID | STATUS | short outcome | evidence note |
| --- | --- | --- | --- |
| AW-024 | BLOCKED | Adult A household create UI not runnable | F-001: requires signed-in new adult + household name on client; dev-token `POST /families` partial only (not UI/P0 path) |
| AW-025 | BLOCKED | invite copy action not runnable | F-001: requires authenticated household UI copy feedback; no Adult A shell |
| AW-026 | BLOCKED | Adult B join not runnable | F-001: depends AW-024; no second provisioned adult account (E3/E4) |
| AW-027 | PASS | join code normalization works | `families.test.ts` `normalizes invite codes before joining` — `  ht2026  ` -> 200 join HT2026 |
| AW-028 | PASS | unknown invite rejected | `families.test.ts` `rejects unknown invite codes` -> 404 `INVITE_NOT_FOUND` |
| AW-029 | PASS | KC code rejected on adult join | `childDevices.test.ts` `rejects adult join attempts that use a child pairing code` -> 400 `ADULT_INVITE_REQUIRED` |
| AW-030 | BLOCKED | rename across adult views not runnable | F-001: `families.test.ts` admin PATCH rename 200 partial only; no multi-adult UI refresh |
| AW-031 | BLOCKED | invite regen confirm UI not runnable | F-001: `members.test.ts` admin regen changes code partial only; confirmation/warning UI not exercised |
| AW-032 | PASS | non-admin invite regen blocked | app.inject non-admin `POST /families/:id/invite` -> 403 `ADMIN_REQUIRED` |
| AW-033 | PASS | virtual child member created | `members.test.ts` `creates a virtual child member for admins` -> 201 child profile |
| AW-034 | PASS | virtual child member updated | `members.test.ts` `updates a virtual child member for admins` -> 200 renamed |
| AW-035 | BLOCKED | child delete warning/UI not runnable | F-001: API delete 200 in vitest partial; destructive warning + device cascade messaging not exercised on client |
| AW-036 | PASS | adult promoted to admin | `members.test.ts` `promotes a signed-in adult member to admin` -> 200 role admin |
| AW-037 | PASS | invalid admin promotion rejected | `members.test.ts` `rejects promoting a virtual child profile to admin` -> 400 `PROMOTE_INVALID_TARGET` |
| AW-038 | PASS | last admin leave blocked | `families.test.ts` `blocks the last admin from leaving a household` -> 409 `LAST_ADMIN_LEAVE_BLOCKED` |
| AW-039 | PASS | admin leave after promotion | `families.test.ts` `lets an admin leave after another admin exists` -> 200 `{left:true}` |

### E. Child Device Lifecycle

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| AW-040 | `[P0]` Generate child pairing code | As an admin, generate a pairing code for a child profile. | A `KC-...` code is created and shown with expiry information. |
| AW-041 | Pairing code survives household screen reopen | Generate a code, leave household screen, reopen it. | Active code is still visible until expiry or revocation. |
| AW-042 | `[P0]` Preview child pairing before confirmation | On child device, enter a valid `KC-...` code and continue. | App shows the correct household name and child profile before final pairing. |
| AW-043 | `[P0]` Pair child device successfully | Confirm pairing on a valid preview. | Child shell opens, device token is stored, and child-only experience loads. |
| AW-044 | Reject adult invite code on child device | Enter adult invite code in child setup. | Flow rejects it clearly and instructs the user to use a `KC-...` code. |
| AW-045 | Reject expired or invalid pairing code | Enter an expired, revoked, or fake `KC-...` code. | App shows a truthful invalid/expired message and does not partially pair. |
| AW-046 | Rate-limit repeated failed pairing attempts | Repeatedly enter wrong pairing codes on preview and pair endpoints. | System eventually rate-limits the client and reports the cooldown honestly. |
| AW-047 | Re-pair same child to a new device | Pair Child X on Device 1, then pair Child X again on Device 2. | New pairing succeeds and the prior device loses access on next validation. |
| AW-048 | Revoke a child device from household screen | As an admin, revoke an active child device. | Device is removed from active list and child session becomes invalid on next use. |
| AW-049 | Child push token registration | Pair a child device and enable notifications. | Child device push token is saved on child-specific path without adult auth leakage. |
| AW-050 | Child chore completion updates rewards | Complete an assigned chore from a paired child device. | Chore completion persists and star balance updates for the correct child only. |

### Section E execution results (2026-07-03)

| TEST_ID | STATUS | short outcome | evidence note |
| --- | --- | --- | --- |
| AW-040 | PASS | admin pairing code created with KC format and expiry | `childDevices.test.ts` `creates a child pairing code...` POST 201 `KC-[A-Z0-9]{6}` + list `expiresAt`; probe `POST .../child-pairing-code` 201 |
| AW-041 | BLOCKED | household screen reopen not runnable | F-001: FamilyScreen leave/reopen UI not exercised (E5); API `GET .../child-pairing-codes` x2 shows same active code (partial only) |
| AW-042 | BLOCKED | child device preview UI not runnable | F-001: ChildDeviceSetupScreen on E5 not exercised; API `POST .../pair/preview` 200 `The Parker Home` / `Jules` (partial only) |
| AW-043 | BLOCKED | child shell pairing not runnable | F-001: child-only shell + local device token storage require E5; API `POST .../pair` 201 + `deviceToken` (partial only) |
| AW-044 | PASS | adult invite rejected on child pairing route | `childDevices.test.ts` `rejects adult invite codes on the child pairing route` — `HT2026` -> 400 on pair + preview |
| AW-045 | PASS | fake KC code rejected without partial pair | probe `KC-ZZZZZZ` -> preview+pair 400 `CHILD_PAIRING_CODE_INVALID` (expired/revoked variants not separately probed) |
| AW-046 | PASS | pairing rate limit after repeated failures | `childDevices.test.ts` `blocks repeated failed child pairing attempts...` -> 429 `CHILD_PAIRING_RATE_LIMITED` |
| AW-047 | PASS | re-pair revokes prior device access | `childDevices.test.ts` `revokes the previous active device when pairing again...` — first token `GET /me` -> 401 |
| AW-048 | PASS | admin revoke invalidates child session | probe `DELETE .../child-devices/:deviceId` -> 200 `{revoked:true}`; revoked token `GET /me` -> 401 `CHILD_DEVICE_AUTH_INVALID` |
| AW-049 | BLOCKED | OS notification enable not runnable | F-001: device push permission (E5) not exercised; API `PUT .../push-token` 200 + adult bearer rejected on child routes in vitest (partial only) |
| AW-050 | PASS | child chore completion updates star balance | probe ChildDevice `POST .../chores/:id/complete` 201 `rewardStars:2`; `GET .../chores/today` starBalance 6 -> 8 |

### F. Home, Navigation, More Hub, and Kids Mode

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| AW-051 | Home header truthfulness | Open Home after successful sync. | Greeting, date, household name, and member/connection indicators are coherent and not placeholder garbage. |
| AW-052 | Avatar opens settings | Tap the home avatar/profile shortcut. | Settings opens reliably. |
| AW-053 | Home quick-access navigation | Use home shortcuts into household or insights. | Correct destination opens and back navigation returns safely. |
| AW-054 | More hub navigation | Open More and enter Meals, Family Board, Assistant, Household, Insights, and Settings. | Each entry reaches the correct surface and back navigation returns to More hub. |
| AW-055 | Kids mode selection | Enter Kids Mode when one child exists and when multiple children exist. | One child goes straight in; multiple children show a picker; exit returns cleanly to adult shell. |

### Section F execution results (2026-07-03)

| TEST_ID | STATUS | short outcome | evidence note |
| --- | --- | --- | --- |
| AW-051 | BLOCKED | Home header after sync not runnable | F-001: Expo web @ `localhost:19006` shows Welcome only (`Create household`, `Join household`, `Set up child's device`); no signed-in household session (AW-008 never established); Home/sync header not reachable |
| AW-052 | BLOCKED | home avatar → Settings not runnable | F-001 + depends AW-051/AW-008: HomeScreen avatar shortcut requires authenticated household shell |
| AW-053 | BLOCKED | home quick-access navigation not runnable | F-001 + depends AW-051/AW-008: household/insights shortcuts on Home require authenticated shell |
| AW-054 | BLOCKED | More hub navigation not runnable | F-001 + depends AW-051/AW-008: More tab entries (Meals, Family Board, Assistant, Household, Insights, Settings) require authenticated adult shell |
| AW-055 | BLOCKED | kids mode selection not runnable | F-001 + depends AW-051/AW-008: KidsMode/KidsModePicker require household with child members in signed-in shell |

### G. Plan and Events

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| AW-056 | `[P0]` Create event | Add a new event with title, date, time, and assignee/member. | Event saves successfully and appears in plan views. |
| AW-057 | Edit event | Modify title, date, or time of an existing event. | Updated values persist after refresh. |
| AW-058 | Delete event | Delete an event from the plan screen. | Event disappears and stays removed after refresh. |
| AW-059 | Event ordering and urgency labels | Create multiple near-term and future events, then inspect plan/home presentation. | Events sort correctly and urgency/countdown labels remain truthful. |
| AW-060 | Imported event labeling | Sync or create imported calendar events and inspect labels. | Imported sources are labeled clearly, manual events are not mislabeled. |
| AW-061 | Travel reminder route behavior | Use travel reminder on supported and unsupported backend configurations. | Feature is either available and works, or reports truthful unavailable state. |
| AW-062 | Cross-family event member validation | Attempt to save an event referencing a member from another household. | Backend rejects the mutation cleanly. |
| AW-063 | Non-admin event edit permissions | Attempt to edit an event as a member who should not have permission. | App/API block unauthorized edits without corrupting state. |

### Section G execution results (2026-07-03)

| TEST_ID | STATUS | short outcome | evidence note |
| --- | --- | --- | --- |
| AW-056 | BLOCKED | Plan screen event create not runnable | F-001: PlanScreen add-event UI requires authenticated shell (AW-051/AW-008); API probe POST 201 + GET list contains event (partial only) |
| AW-057 | BLOCKED | Plan screen event edit not runnable | F-001 + depends AW-056 Plan UI; API probe PATCH 200 title persisted on GET (partial only) |
| AW-058 | BLOCKED | Plan screen event delete not runnable | F-001 + depends AW-056 Plan UI; API probe DELETE 200 `{deleted:true}` (partial only) |
| AW-059 | BLOCKED | plan/home urgency presentation not runnable | F-001: Plan/Home UI inspection requires shell; `eventUrgency.test.ts` helper sort/label unit tests pass (partial only) |
| AW-060 | BLOCKED | imported event label inspection not runnable | F-001: calendar sync + Plan label display require shell; `event-import-label.test.ts` `describeImportedEventSource` unit tests pass (partial only) |
| AW-061 | PASS | travel reminder reports truthful unavailable state | `travelReminder.test.ts` GET `.../travel-reminder` -> 200 `{supported:false, provider:'unavailable', recommendedLeadMinutes:null}` (maps not configured) |
| AW-062 | PASS | cross-family member assignment rejected | `security-hardening.test.ts` `rejects cross-family member ids on events` -> 400 `EVENT_MEMBER_INVALID` |
| AW-063 | PASS | non-creator non-admin edit blocked | `security-hardening.test.ts` `blocks event edits from non-admin members who did not create the event` -> 403 `EVENT_FORBIDDEN` |

### H. Chores and Rewards

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| AW-064 | `[P0]` Create chore | Add a new chore with title, assignee, and optional due time. | Chore saves and appears in today's chore view. |
| AW-065 | Unassigned chore stays unassigned | Create a chore explicitly without an assignee. | Chore remains unassigned rather than silently attaching to a fallback member. |
| AW-066 | Edit chore | Modify title, assignee, or due time on an existing chore. | Edits persist after refresh. |
| AW-067 | Delete chore | Delete a chore with confirmation. | Chore is removed and does not reappear after sync. |
| AW-068 | Complete chore from adult shell | Mark a chore complete from adult view. | Completion persists, history updates, and relevant reward logic runs once. |
| AW-069 | Due-time and daily label truthfulness | Create chores with and without due time. | UI labels reflect real behavior such as daily cadence and due-time wording honestly. |
| AW-070 | Reminder scheduling path | Use chores with due times and no due times. | Reminder scheduling uses expected lead time or default morning behavior. |
| AW-071 | Prevent duplicate rewards and cross-family completions | Attempt repeated or unauthorized completion actions. | Backend prevents duplicate reward claims and cross-family abuse. |

### Section H execution results (2026-07-03)

| TEST_ID | STATUS | short outcome | evidence note |
| --- | --- | --- | --- |
| AW-064 | BLOCKED | ChoresScreen create not runnable | F-001: ChoresScreen + today's chore view require authenticated shell (AW-051/AW-008); API probe POST 201 + GET `/chores/today` contains chore (partial only) |
| AW-065 | PASS | unassigned chore stays null assignee | API probe POST without `assignedTo` -> 201 `assignedTo: null` (no fallback member) |
| AW-066 | BLOCKED | ChoresScreen edit not runnable | F-001 + depends AW-064 Chores UI; API probe PATCH 200 title/dueTime persisted (partial only) |
| AW-067 | BLOCKED | ChoresScreen delete not runnable | F-001 + depends AW-064 Chores UI; API probe DELETE 200 `{deleted:true}` + absent from GET list (partial only) |
| AW-068 | BLOCKED | adult shell chore complete not runnable | F-001: adult ChoresScreen completion UI requires shell; API probe POST complete 201 + history entry (partial only) |
| AW-069 | BLOCKED | due-time/daily label UI not runnable | F-001: ChoresScreen/KidsMode label display requires shell; `mobile-store.test.ts` maps dueTime -> `Daily · by 6:00 PM` in store (partial only) |
| AW-070 | PASS | chore reminder scheduling logic | `reminderScheduling.test.ts` — due-time lead scheduling, next-day rollover, default morning when no due time (3/3 pass) |
| AW-071 | PASS | duplicate/cross-family completions blocked | `security-hardening.test.ts` `rejects cross-family chore completions and duplicate reward claims` -> 400 `CHORE_MEMBER_INVALID` + 409 `CHORE_ALREADY_COMPLETED` |

### I. Lists and Grocery

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| AW-072 | `[P0]` Create a new custom list | Create a new list from Lists screen. | List is created, selected, and shown in UI. |
| AW-073 | Auto-create grocery list when missing | Use grocery-dependent actions in a household with no grocery list yet. | System creates a grocery list and routes items into it. |
| AW-074 | Add list item into selected list | Select a list and add a new item. | Item is stored in the active list rather than another list. |
| AW-075 | Toggle item checked/unchecked | Mark an item complete and then reopen it. | Toggle state persists after refresh. |
| AW-076 | Clear checked items | Use clear-checked action on a list with completed items. | Checked items are removed only after backend confirmation. |
| AW-077 | Preserve selected list across hydrate | Refresh or relaunch while using a non-default list. | App preserves selected list and does not silently jump away. |
| AW-078 | Queue list-item creation offline | Go offline and add a list item. | Mutation is queued honestly and later replayed when network returns. |

### Section I execution results (2026-07-03)

| TEST_ID | STATUS | short outcome | evidence note |
| --- | --- | --- | --- |
| AW-072 | BLOCKED | ListsScreen custom list create not runnable | F-001: ListsScreen create/select/show requires authenticated shell (AW-051/AW-008); `mobile-store.test.ts` `creates a new custom list...` + API POST list 201 (partial only) |
| AW-073 | BLOCKED | grocery auto-create UI not runnable | F-001: grocery-dependent client action requires shell; `mobile-store.test.ts` `creates and selects a grocery list when the family has none yet` (partial only) |
| AW-074 | BLOCKED | add item to selected list UI not runnable | F-001: list selection + add UI requires shell; `mobile-store.test.ts` `saves a list draft into the currently selected backend list` + API items land on correct listIds (partial only) |
| AW-075 | BLOCKED | toggle checked UI not runnable | F-001: ListsScreen toggle requires shell; API PATCH `isChecked` true→false→true on list item (partial only) |
| AW-076 | BLOCKED | clear-checked UI action not runnable | F-001: clear-checked client action requires shell; `mobile-store.test.ts` `clears checked items...` + API POST clear-checked 200 `deletedCount:1` (partial only) |
| AW-077 | BLOCKED | selected list across hydrate not runnable | F-001: refresh/relaunch UI requires shell; `mobile-store.test.ts` `hydrates multi-list backend state while preserving selected list` keeps `selectedListId: list-hardware` (partial only) |
| AW-078 | BLOCKED | offline list-item queue not runnable on device | F-001: real offline/network toggle requires E1/E7 mobile runtime; `mobile-store.test.ts` `queues create_list_item when backend sync is unavailable` -> `kind:queued` (partial only; no device replay) |

### J. Meals and Recipes

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| AW-079 | `[P0]` Create meal plan item | Add a meal to the current week. | Meal appears on the expected day/slot and persists after refresh. |
| AW-080 | Edit or remove meal | Change or remove an existing meal plan item. | Change persists or removal is durable after refresh. |
| AW-081 | Save meal linked to saved recipe | Create a recipe and attach it to a meal plan entry. | Link remains intact and meal renders recipe-backed details correctly. |
| AW-082 | Import recipe from pasted text with local fallback | Use recipe import when AI providers are unavailable. | App returns honest local parsing behavior instead of pretending cloud parsing happened. |
| AW-083 | Import recipe from pasted text with provider enabled | Use recipe import when AI provider is configured. | Structured recipe output is returned and can be saved. |
| AW-084 | URL recipe import honesty | Import recipe from URL route. | Flow reports truthful behavior and does not claim full page scraping when it is not doing that. |
| AW-085 | Send recipe ingredients to grocery list | Use recipe-to-grocery bridge on a saved recipe. | Ingredients land in grocery list in normalized form. |
| AW-086 | Send week meal ingredients to grocery list | Use week-to-grocery action for current meal plan. | Ingredients from current week are transferred correctly. |

### Section J execution results (2026-07-03)

| TEST_ID | STATUS | short outcome | evidence note |
| --- | --- | --- | --- |
| AW-079 | BLOCKED | Meals screen create not runnable | F-001: MealsScreen add-to-week UI requires authenticated shell (AW-051/AW-008); `mobile-store.test.ts` `saves a new meal plan item...` + API POST meals 201 (partial only) |
| AW-080 | BLOCKED | Meals screen edit/remove not runnable | F-001 + depends AW-079 Meals UI; `mobile-store.test.ts` `removes a meal plan item...` + API POST meals replace 201 title edited (partial only) |
| AW-081 | PASS | meal linked to saved recipe persists | `recipes.test.ts` `supports saved recipe create, edit, meal reuse...` — POST meal with `recipeId` -> 201 `recipeTitle`; GET week list retains link (client recipe-backed render not exercised) |
| AW-082 | PASS | local recipe import when AI unavailable | `recipeImport.test.ts` `falls back to local text parsing when AI is unavailable` -> 200 `mode:local` structured ingredients |
| AW-083 | PASS | AI recipe import with provider enabled | `recipeImport.test.ts` `returns structured recipes from AI for pasted text` -> 200 `mode:ai` `provider:openai` |
| AW-084 | PASS | URL import reports no page fetch | `recipeImport.test.ts` `returns a truthful response for URL import without fetching pages` -> 200 honest paste-import message, `recipe:null` |
| AW-085 | BLOCKED | recipe-to-grocery client bridge not runnable | F-001: Meals/Recipes UI action requires shell; API POST `meals/to-grocery` 201 adds normalized ingredients to grocery list (partial only) |
| AW-086 | BLOCKED | week-to-grocery client action not runnable | F-001: week-to-grocery UI requires shell; API POST `meals/week-to-grocery` 201 `mealsProcessed:3` for seeded week `2026-05-25` (partial only) |

### K. Family Board, Thread, and Assistant

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| AW-087 | Board history loads after prior use | Use board/thread, leave, and return later. | Household-scoped thread history is restored on the same device. |
| AW-088 | Board history is household-scoped | Switch households or leave/rejoin, then inspect board history. | One household does not leak board/thread data into another. |
| AW-089 | Save board update or imported summary | Add a board entry or imported text summary. | Entry appears in board feed and reflects save outcome honestly. |
| AW-090 | Offline board commit honesty | Attempt board-import commit while backend is unavailable. | App reports local-only or failed behavior truthfully. |
| AW-091 | Assistant local mode truthfulness | Use assistant when no providers are configured. | Assistant states local/unavailable mode honestly and remains usable. |
| AW-092 | Assistant structured response path | Use assistant with providers configured for a planning prompt. | Assistant returns structured output that can become draft plan/list/chore content. |
| AW-093 | Assistant meal suggestion path | Ask assistant for meal suggestions and save one into Meals. | Suggestion converts into meal plan entry correctly. |
| AW-094 | Assistant conversation persistence | Leave and re-enter Assistant on same device/household. | Conversation history persists for that household. |
| AW-095 | Assistant scroll behavior on long thread | Scroll up in a long thread, wait for a response, then interact again. | View does not yank unexpectedly while the user is reading older messages. |

### Section K execution results (2026-07-03)

| TEST_ID | STATUS | short outcome | evidence note |
| --- | --- | --- | --- |
| AW-087 | BLOCKED | board history leave/return not runnable | F-001: ThreadScreen leave-and-return requires authenticated shell on device; `board-history-storage.test.ts` save/reload on web+native (partial only) |
| AW-088 | BLOCKED | household board isolation UI not runnable | F-001: switch-household/rejoin inspection requires shell; storage test `other-family` -> `[]` (partial only) |
| AW-089 | BLOCKED | board save/import feed UI not runnable | F-001: ThreadScreen entry + feed display requires shell; `commitDraft` board path in store exists but not exercised E2E (partial only) |
| AW-090 | BLOCKED | offline board commit UI not runnable | F-001: offline board-import requires E1/E7 + shell; store `commitDraft` returns `kind:local` when API persist fails (code partial only) |
| AW-091 | BLOCKED | Assistant local-mode UI not runnable | F-001: AssistantScreen usability requires shell; `assistant.test.ts` POST `/ai/assist` -> 200 `mode:local` (API partial only) |
| AW-092 | BLOCKED | Assistant structured draft UI not runnable | F-001: draft-to-plan/list/chore apply requires shell; `assistant.test.ts` AI draft `kind:list`/`kind:chore` (API partial only) |
| AW-093 | BLOCKED | meal suggestion save-to-Meals not runnable | F-001: Assistant -> Meals save requires shell; `mealSuggest.test.ts` structured suggestions API (partial only) |
| AW-094 | BLOCKED | Assistant leave/re-enter UI not runnable | F-001: AssistantScreen navigation requires shell; `assistant-conversation-storage.test.ts` persist/reload (partial only) |
| AW-095 | BLOCKED | Assistant scroll stability not runnable | F-001: long-thread scroll/interaction requires device UI; `AssistantScreen.tsx` `scrollConversationToBottom` exists, no runtime test |

### L. Calendar Sync

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| AW-096 | Calendar sync status truthfulness | Open calendar sync with Google OAuth configured and unconfigured variants. | Status reflects real backend capability and encryption readiness. |
| AW-097 | List calendar connections | Connect or seed connections, then open connections list. | Active connections are listed accurately for the selected family. |
| AW-098 | `[P0]` Start Google OAuth connect | Trigger Google Calendar connect from the app. | Backend returns a valid auth URL and app hands user into provider flow. |
| AW-099 | Explicit Google redirect URI respected | Execute Google connect in environment with explicit redirect URI set. | Auth URL and callback handling use the configured redirect exactly. |
| AW-100 | Reject invalid OAuth state | Hit callback with invalid or missing state. | Backend rejects the callback safely and reports failure honestly. |
| AW-101 | Add iCal feed with HTTPS | Add a valid HTTPS iCal URL. | Feed saves successfully as a connection. |
| AW-102 | Reject unsafe or non-HTTPS iCal feed | Enter non-HTTPS or unsafe local/private feed URL. | Backend rejects it and masked URLs stay masked in outputs. |
| AW-103 | Manual sync imports future events and skips duplicates | Run sync more than once against same connection. | Future events import, duplicates are skipped, and results are truthful. |

### Section L execution results (2026-07-03)

| TEST_ID | STATUS | short outcome | evidence note |
| --- | --- | --- | --- |
| AW-096 | BLOCKED | CalendarSyncScreen status UI not runnable | F-001: opening Calendar Sync requires authenticated shell; API `GET /calendar-sync/status` truthful unconfigured + configured variants probed (`googleConnectImplemented` false/true) (partial only) |
| AW-097 | BLOCKED | connections list UI not runnable | F-001: CalendarSyncScreen list requires shell; API `GET /calendar-sync/connections` empty + post-google/post-ical entries in `calendarSync.test.ts` (partial only) |
| AW-098 | BLOCKED | Google OAuth app handoff not runnable | F-001: provider consent handoff requires client/runtime; API `POST /google/connect` returns `authUrl` only (partial only; not P0 E2E) |
| AW-099 | BLOCKED | Google connect redirect E2E not runnable | F-001: app/provider callback handoff not exercised; API authUrl uses explicit `GOOGLE_OAUTH_REDIRECT_URI` in `calendarSync.test.ts` (partial only) |
| AW-100 | PASS | invalid/missing OAuth state rejected | `calendarSync.test.ts` `rejects callbacks with invalid state` -> 400; probe missing `state` -> 400 callback page |
| AW-101 | BLOCKED | add iCal feed UI not runnable | F-001: CalendarSyncScreen add-feed requires shell; API `POST /calendar-sync/ical` HTTPS 201 + masked connection list (partial only) |
| AW-102 | PASS | unsafe iCal feeds rejected; URLs masked | `calendarSync.test.ts` rejects `http://`; `security-hardening.test.ts` masks `https://1.1.1.1/...` + rejects `https://localhost/...` -> 400 `ICAL_URL_NOT_ALLOWED` |
| AW-103 | PASS | manual sync imports once, skips duplicates | `calendarSync.test.ts` `imports future iCal events on manual sync and skips duplicates` — first sync `added:1`, second `skipped:1` |

### M. Insights and Notifications

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| AW-104 | Weekly family summary loads | Open Insights weekly view for a household with data. | Summary metrics load correctly or fail per-section honestly. |
| AW-105 | Chore completion insights | Open chore-related insight sections. | Per-member stats reflect household chore history. |
| AW-106 | Busyness insights | Open busyness view with upcoming events. | Breakdown is coherent and based on upcoming plan data. |
| AW-107 | List notifications | Open notifications/inbox surface after activity exists. | Notifications list for current user loads correctly. |
| AW-108 | Mark notifications as read | Mark one or more notifications as read. | Read state persists and unread count/appearance updates. |
| AW-109 | Daily digest preview | Trigger daily digest preview for a household. | Preview is generated truthfully for current family context. |
| AW-110 | Job queue status honesty | Open or query notification jobs status when jobs are enabled and disabled. | System reports real queue capability without false confidence. |
| AW-111 | Adult/child push routing correctness | Trigger adult-only, child-only, and mixed reminder notifications. | Push targets route to the correct household members/devices. |

### Section M execution results (2026-07-03)

| TEST_ID | STATUS | short outcome | evidence note |
| --- | --- | --- | --- |
| AW-104 | BLOCKED | Insights weekly view UI not runnable | F-001: InsightsScreen requires authenticated shell; `insights.test.ts` `GET .../insights/weekly` 200 metrics (partial only) |
| AW-105 | BLOCKED | chore insights UI not runnable | F-001: InsightsScreen chore section requires shell; `insights.test.ts` `GET .../insights/chores` 200 per-member stats (partial only) |
| AW-106 | BLOCKED | busyness insights UI not runnable | F-001: InsightsScreen busyness view requires shell; `insights.test.ts` `GET .../insights/busyness` 200 days/members (partial only) |
| AW-107 | BLOCKED | in-app notifications inbox not runnable | F-001: Home/notifications surface requires shell; `notifications.test.ts` `GET /notifications` list API (partial only; route ≠ inbox UI) |
| AW-108 | BLOCKED | mark-read UI/unread appearance not runnable | F-001: in-app read state/unread count requires shell; `notifications.test.ts` `POST /mark-read` -> `{updated:1}` API (partial only; route ≠ UI) |
| AW-109 | BLOCKED | digest preview trigger UI not runnable | F-001: client trigger surface requires shell; `notifications.test.ts` `GET /daily-digest/preview` 200 family context (partial only) |
| AW-110 | PASS | jobs status truthful disabled and enabled | `notifications.test.ts` `GET /jobs/status` -> `{enabled:false,started:false}`; enabled variant per F-005 supervisor harness `-> {enabled:true,started:true}` (AW-154 not rerun) |
| AW-111 | PASS | push routing targets correct devices | `pushNotifications.test.ts` adult-only digest -> adult token; child chore -> child token; mixed event -> both tokens in fetch targets |

### N. Settings, Profile, Notifications, and Account Safety

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| AW-112 | Update display name | Open Settings, change display name, save. | New display name persists across app reload and relevant screens. |
| AW-113 | `[P0]` Profile photo upload success | Choose a valid photo from library and complete upload. | Photo uploads, profile is updated, and avatar reflects new image. |
| AW-114 | Photo permission denied | Deny photo-library permission, then attempt upload. | App gives clear permission guidance and does not crash. |
| AW-115 | Supabase storage policy or bucket failure | Attempt upload when bucket or storage policy is misconfigured. | App reports the storage problem honestly rather than a vague success. |
| AW-116 | Update notification preferences | Toggle notification preference settings while online. | Preferences persist and round-trip with backend state. |
| AW-117 | Save/refresh push token | Trigger push-token registration or refresh. | Push token is saved only when available and UI feedback is truthful. |
| AW-118 | Password update | Change password from Settings as a valid signed-in user. | Password update succeeds or a clear failure is shown. |
| AW-119 | Password reset request from settings context | Request password reset from an eligible signed-in account. | App reports successful request or truthful unavailability. |
| AW-120 | Delete account safety | Attempt account deletion online and offline. | Online delete is explicit and correct; offline delete is blocked or described honestly. |
| AW-121 | Sign out and re-sign in | Sign out, then sign back in as same and different users. | App clears state on sign-out and does not leak household data between users. |

### Section N execution results (2026-07-03)

| TEST_ID | STATUS | short outcome | evidence note |
| --- | --- | --- | --- |
| AW-112 | BLOCKED | Settings display-name save UI not runnable | F-001: SettingsScreen save + reload requires authenticated shell; `auth.test.ts` `POST /auth/profile` displayName persist API (partial only) |
| AW-113 | BLOCKED | profile photo upload UI not runnable | F-001: library pick + Supabase upload requires signed-in mobile/runtime; `pickAndUploadAvatar` exists but no success-path test executed |
| AW-114 | BLOCKED | photo permission-denied UI not runnable | F-001: permission denial requires device ImagePicker runtime; `avatarUpload.ts` denied-message string only (code partial, not exercised) |
| AW-115 | BLOCKED | storage-policy upload failure UI not runnable | F-001: misconfigured bucket test requires runtime upload attempt; `friendlyAvatarUploadError` mapping in code only (not exercised) |
| AW-116 | BLOCKED | notification pref toggles UI not runnable | F-001: Settings toggles require shell + online session; `auth.test.ts` `PUT /auth/notification-prefs` round-trip API (partial only) |
| AW-117 | BLOCKED | push token registration UI not runnable | F-001: OS permission + device token requires E1/mobile runtime; `auth.test.ts` `PUT /auth/push-token` API + `notifications.ts` helpers (partial only) |
| AW-118 | BLOCKED | password update UI not runnable | F-001: Settings password form requires signed-in Supabase session; `useAuthStore.updatePassword` exists, no runtime execution |
| AW-119 | BLOCKED | password reset from Settings not runnable | F-001: requires signed-in account context (same gate as AW-020); `requestPasswordReset` store method only (not exercised) |
| AW-120 | BLOCKED | account delete online/offline UI not runnable | F-001: Settings delete button disabled when `syncSource !== "api"` (code partial); `DELETE /auth/account` route exists, no E2E online/offline execution |
| AW-121 | BLOCKED | sign-out/re-sign-in UI not runnable | F-001: sign-out state clearing + re-auth across users requires shell; `signOut`/`handleExternalSignedOut` in store only (not exercised E2E) |

### O. Subscriptions, Billing, and Monetization Controls

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| AW-122 | Subscription status | Open subscription/billing status for current family. | App and backend return current family subscription truthfully. |
| AW-123 | Plus entitlement gating | Enable backend plus requirement and attempt gated routes. | App/API block gated actions honestly when entitlement is missing. |
| AW-124 | Billing controls by role | Open billing-related UI as admin and non-admin adults. | Only the intended role sees actionable billing control paths. |
| AW-125 | RevenueCat webhook accepted with secret | Send a valid test webhook when secret is configured. | Backend accepts and processes the webhook. |
| AW-126 | RevenueCat webhook rejected without secret | Send webhook when secret is missing or wrong. | Backend rejects it explicitly and safely. |

### Section O execution results (2026-07-03)

| TEST_ID | STATUS | short outcome | evidence note |
| --- | --- | --- | --- |
| AW-122 | BLOCKED | subscription/billing status UI not runnable | F-001: FamilyScreen billing preview + `loadSubscriptionStatus` require authenticated shell; `subscriptions.test.ts` `GET /subscriptions/status` 200 familyId/status/provider (API partial only) |
| AW-123 | PASS | plus entitlement blocks gated API route | `security-hardening.test.ts` `REQUIRE_PLUS=true` -> `GET /ai/status` 403 `{code:"PLUS_REQUIRED"}`; app-side gating not exercised |
| AW-124 | BLOCKED | admin vs non-admin billing controls not demonstrated | F-001: role-visibility/actionability requires shell as admin and non-admin; `FamilyScreen` preview card shown to all + `loadBillingOptions` admin gate in code only (not runtime) |
| AW-125 | PASS | valid RevenueCat TEST webhook accepted | `subscriptions.test.ts` POST `/webhooks/revenuecat` Bearer secret -> 200 `{ok:true,test:true}` |
| AW-126 | PASS | webhook rejected when secret missing or wrong | `subscriptions.test.ts` secret unset -> 503 `WEBHOOK_NOT_CONFIGURED`; one-off probe wrong Bearer -> 401 `WEBHOOK_FORBIDDEN` (not in vitest suite) |

## Pass 2: Cross-Flow, Regression, Security, and Release Coverage

### P. Offline, Realtime Sync, Recovery, and Data Integrity

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| AW-127 | Queue event creation offline | Go offline and create an event. | App queues the mutation honestly instead of pretending the backend saved it. |
| AW-128 | Offline replay after reconnect | Build up queued mutations offline, restore network, allow replay. | Pending mutations replay once, in order, and resulting state is consistent. |
| AW-129 | Duplicate replay protection | Force a retry or partial replay on the same queued mutation. | App/backend avoid duplicate durable writes and mark outcomes honestly. |
| AW-130 | Refresh failure preserves last known API state | Disconnect backend after successful sync, then refresh. | App retains last known good state instead of wiping the household UI. |
| AW-131 | Realtime sync subscribe and cleanup | Use app with realtime enabled; switch households or sign out. | Subscriptions attach to current household only and clean up on exit. |
| AW-132 | Realtime debounce and refresh requests | Trigger multiple backend changes quickly. | App debounces refresh behavior and does not thrash or duplicate updates. |
| AW-133 | Leave-household state clearing | Leave a household and inspect home, board, assistant, and member state. | Household-scoped state is cleared and user is routed to appropriate post-leave path. |
| AW-134 | Cross-household isolation after account switch | Sign in as one household user, sign out, then sign in as a different household user on same device. | No data from Household A leaks into Household B. |
| AW-135 | Child/adult auth boundary | Use adult token on child routes and child token on adult routes where applicable. | Auth boundaries are enforced cleanly and safely. |
| AW-136 | Invalid JSON and malformed request handling | Send malformed request bodies to backend-facing paths. | API returns 4xx validation errors, not masked 500s. |

### Section P execution results (2026-07-03)

| TEST_ID | STATUS | short outcome | evidence note |
| --- | --- | --- | --- |
| AW-127 | BLOCKED | offline event queue UI not runnable | F-001: go-offline + create event requires device/shell; `mobile-store.test.ts` queues `create_event` when `syncSource:"mock"` (store unit partial only) |
| AW-128 | BLOCKED | offline replay after reconnect not runnable E2E | F-001: reconnect/replay flow requires runtime; `offline-queue.test.ts` replays one queued `create_event` via mocked API (service unit partial only) |
| AW-129 | BLOCKED | duplicate replay protection not demonstrated | F-001: force-retry/partial-replay requires runtime; `offline-queue.test.ts` marks failed replay honestly but does not exercise duplicate-success protection |
| AW-130 | BLOCKED | refresh-failure UI preservation not runnable | F-001: disconnect-then-refresh requires shell; `mobile-store.test.ts` `hydrateFromBackend` network error keeps `familyName` + `syncSource:"api"` (store unit partial only) |
| AW-131 | BLOCKED | realtime subscribe/cleanup in-app not runnable | F-001: household switch/sign-out attach/cleanup requires shell; `family-realtime-sync.test.ts` subscribe + `stopFamilyRealtimeSync` removes channel (service unit partial only) |
| AW-132 | BLOCKED | realtime debounce in-app not runnable | F-001: rapid backend changes in shell not exercised; `family-realtime-sync.test.ts` double callback + 400ms timer -> one `onRefreshRequested` (service unit partial only) |
| AW-133 | BLOCKED | leave-household UI/routing not runnable | F-001: inspect home/board/assistant post-leave requires shell; `mobile-store.test.ts` `leaveFamily` clears `familyId`/`members`/`events` (store unit partial only) |
| AW-134 | BLOCKED | cross-household isolation after account switch not runnable | F-001: sign-out + different-user sign-in E2E required; `signOut`/`reset` store code presence not sufficient per supervisor |
| AW-135 | PASS | adult/child route auth boundaries enforced | `childDevices.test.ts` adult Bearer on `GET /child-devices/me` -> 401 `CHILD_DEVICE_AUTH_REQUIRED`; inject probe child `ChildDevice` token on `GET /families/.../members` -> 401 `AUTH_REQUIRED` |
| AW-136 | PASS | malformed JSON returns 4xx not masked 500 | `app.test.ts` invalid JSON -> 400; Railway `POST /child-devices/pair` malformed body -> 400 `FST_ERR_CTP_INVALID_JSON_BODY` |

### Q. Security, Permissions, and Trustworthiness

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| AW-137 | Dev-token auth disabled outside allowed modes | Start backend in non-test mode without explicit dev-auth enablement. | Dev-token path is disabled unless intentionally enabled. |
| AW-138 | Cross-family member-id rejection on events | Attempt to create/update events with a member from another family. | Backend rejects the action and preserves current family data integrity. |
| AW-139 | Cross-family chore completion rejection | Attempt chore completion against another family's chore/member combination. | Backend blocks it and does not issue rewards. |
| AW-140 | Non-member event read blocked | Attempt to read household events as a non-member. | Backend returns authorization failure. |
| AW-141 | Non-admin event edit blocked | Attempt event edit as a household member lacking edit permission. | Backend/UI block the change and keep original data intact. |
| AW-142 | Unsafe local iCal feed rejection | Submit iCal feed URL that points to local/private infrastructure. | Backend rejects feed to avoid SSRF-style misuse. |
| AW-143 | Notification routing does not cross families | Trigger notifications for Household A while authenticated in Household B on another account. | Notification data and device routing stay isolated by household. |

### Section Q execution results (2026-07-03)

| TEST_ID | STATUS | short outcome | evidence note |
| --- | --- | --- | --- |
| AW-137 | PASS | dev-token disabled outside allowed modes | `security-hardening.test.ts` `devTokenAllowed:false` when `DEV_AUTH_ENABLED` unset in development; Railway dev token on `/auth/me` -> 401 `AUTH_INVALID` |
| AW-138 | PASS | cross-family member on event rejected | `security-hardening.test.ts` `rejects cross-family member ids on events` -> 400 `EVENT_MEMBER_INVALID` |
| AW-139 | PASS | cross-family chore completion rejected | `security-hardening.test.ts` `rejects cross-family chore completions and duplicate reward claims` -> 400 `CHORE_MEMBER_INVALID` |
| AW-140 | PASS | non-member event read blocked | `security-hardening.test.ts` `blocks cross-family event reads` -> 403 `FAMILY_FORBIDDEN` |
| AW-141 | PASS | non-admin event edit blocked | `security-hardening.test.ts` `blocks event edits from non-admin members who did not create the event` -> 403 `EVENT_FORBIDDEN` |
| AW-142 | PASS | unsafe iCal feed rejected | `security-hardening.test.ts` masks saved iCal URLs + rejects `https://localhost/...` -> 400 `ICAL_URL_NOT_ALLOWED` |
| AW-143 | PASS | cross-family notification isolation verified | F-003 supervisor harness: Family A delivery created rows for User A only (`rowsForUserB=[]`); push targets limited to Family A adult/child tokens |

### R. Release Smoke and Client-Handoff Minimum Pack

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| AW-144 | `[GO/NO-GO]` First-time owner to household creation | Fresh install -> sign in -> create household -> enter shell. | Flow completes without blockers and surfaces adult invite code. |
| AW-145 | `[GO/NO-GO]` Second adult join and sync | Use real adult invite -> join from second account -> verify same household data. | Join succeeds and shared state matches across adults. |
| AW-146 | `[GO/NO-GO]` Child profile creation and device pair | Add child -> generate KC code -> pair child device -> complete one assigned chore. | Pairing, child shell, and parent-visible completion all work. |
| AW-147 | `[GO/NO-GO]` Core planner save set | Create event, chore, list item, meal, and one assistant-derived draft. | All primary household planning primitives can be created successfully. |
| AW-148 | `[GO/NO-GO]` Profile photo, notifications, and settings | Update name, upload avatar, toggle notification prefs, and return to Home. | Settings changes persist and do not destabilize shell. |
| AW-149 | `[GO/NO-GO]` Calendar sync sanity | Open calendar sync, start Google connect or save iCal feed, then run sync. | Calendar integration path is either working or truthfully blocked by env/config. |

### Section R execution results (2026-07-03)

| TEST_ID | STATUS | short outcome | evidence note |
| --- | --- | --- | --- |
| AW-144 | BLOCKED | first-time owner flow stopped before household shell | F-001: Expo web sign-up `aw144qa202607030332@mailinator.com` -> email-confirmation gate; no E1 fresh install/TestFlight path to create household and enter shell |
| AW-145 | BLOCKED | second-adult join not runnable | F-001: depends on AW-144 household state; missing E3/E4 Adult B accounts with mailbox access and authenticated join path |
| AW-146 | BLOCKED | child profile/pair/chore GO/NO-GO not runnable | F-001: prerequisite authenticated household never established; missing E5 child device and child-shell runtime |
| AW-147 | BLOCKED | core planner save set not runnable | F-001: GO/NO-GO create event/chore/list/meal/assistant draft requires authenticated household shell; never reached |
| AW-148 | BLOCKED | settings/profile GO/NO-GO not runnable | F-001: name/avatar/notification-pref shell flow requires signed-in mobile session; no device runtime available |
| AW-149 | BLOCKED | calendar sync sanity in-app not runnable | F-001: CalendarSyncScreen Google/iCal/sync steps require authenticated household shell; never reached |

### S. Supplemental API, Recipe, and Ops Coverage

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| AW-150 | Auth status endpoint truthfulness | Query auth status without a bearer token in configured and unconfigured auth modes. | Backend reports real auth mode and capability without requiring a session. |
| AW-151 | Health endpoint with database status | Query service health while backend is healthy and while DB connectivity is degraded if safely testable. | Health output reflects service and database state honestly. |
| AW-152 | Mobile API request content-type behavior | Trigger one request with JSON body and one request without body through mobile API wrapper. | JSON content-type is present only when a JSON body is actually sent. |
| AW-153 | Saved recipe lifecycle | Create a saved recipe, edit it, reuse it in Meals, and delete it if the UI/API path exists in the current build. | Recipe data survives the expected lifecycle and linked meal rendering remains stable. |
| AW-154 | Daily digest queue and send-now admin routes | Trigger preview, queue, and send-now flows for daily digest in enabled and disabled job states. | Notifications job flows either execute or report truthful unavailability; no fake success states. |

### Section S execution results (2026-07-03)

| TEST_ID | STATUS | short outcome | evidence note |
| --- | --- | --- | --- |
| AW-150 | PASS | auth status truthful configured and unconfigured | F-002 closed: Railway `GET /auth/status` -> 200 `mode:supabase`; isolated subprocess/inject with Supabase env removed -> 200 `mode:unconfigured` |
| AW-151 | PASS | health endpoint reports service and db | `health.test.ts` `returns service health with database status` -> 200 `status:ok` with `db` field |
| AW-152 | PASS | JSON content-type only when body present | `mobile-api.test.ts` JSON body request sets `Content-Type: application/json`; no-body request omits JSON content-type |
| AW-153 | PASS | saved recipe lifecycle preserves linked meal title after delete | F-004 closed: `recipes.test.ts` create/patch/meal-link/delete -> post-delete `GET /meals` has `recipeId:null`, `customTitle:"AW153 Lifecycle Recipe Updated"`, `recipeTitle:null` |
| AW-154 | PASS | digest preview and queue truthful in both job states | F-005 closed: disabled paths vitest + `JOBS_DISABLED` on queue; enabled harness `GET /jobs/status` -> `{enabled:true,started:true}`, queue/send-now 200 with delivery |

### T. Hidden/Admin/API Surfaces and Release Diagnostics

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| AW-155 | Child device self-unpair and relaunch truthfulness | On a paired child device, load the child shell, verify device/member context, hold to unpair, then relaunch. | The device returns to truthful unpaired state, stale child tokens stop opening the shell, and the device can only return through fresh `KC-...` pairing. |
| AW-156 | Settings diagnostics and build readiness truthfulness | Open Settings -> Advanced -> diagnostics on the current build and compare the readiness rows against real config. | Household server, sign-in, push, billing, Apple sign-in, and Sentry readiness are reported honestly and do not overstate ship readiness. |
| AW-157 | Event auxiliary read endpoints truthfulness | Exercise upcoming events, countdown-only events, and single-event lookup through the current UI/API surface. | Ordering, countdown filtering, single-event lookup, and not-found behavior are accurate for the current household only. |
| AW-158 | Chore full-list and history truthfulness | Exercise active chore list plus chore completion history after creating and completing chores, including member/date filter variants if available. | Active chores and completion history remain accurate, ordered correctly, and filtered results do not leak unrelated household data. |
| AW-159 | List metadata edit and single-item delete | If the current build exposes list rename/type edit or single-item delete through UI or API, execute those paths. | List metadata changes persist, single-item deletion is durable, and missing list/item errors remain truthful. |
| AW-160 | Household member list and last-admin removal guard | Exercise member roster listing and, where the current admin/member surface exists, attempt removal that would leave the household without an admin. | Member roster is accurate and the last-admin removal path is blocked with specific remediation guidance. |

### Section T execution results (2026-07-03, verification pass 2)

| TEST_ID | STATUS | short outcome | evidence note |
| --- | --- | --- | --- |
| AW-155 | BLOCKED | child shell unpair/relaunch not runnable here | F-001: no paired child device or mobile client; API-only unpair probe (`POST /child-devices/unpair` -> 200 `revoked:true`, stale token -> 401 `CHILD_DEVICE_AUTH_INVALID`) does not satisfy relaunch/shell steps |
| AW-156 | BLOCKED | Settings diagnostics UI not runnable here | F-001: no mobile build; `ux-copy-labels.test.ts` helper labels pass but do not compare Settings -> Advanced rows against real installed config |
| AW-157 | PASS | single-event lookup truthful including not-found | `events.test.ts` create+GET 200 with event; missing id GET -> 404 `EVENT_NOT_FOUND` (F-007 closed 2026-07-03); prior pass-2 upcoming/countdown checks unchanged |
| AW-158 | PASS | chore history filters truthful | `chores.test.ts` create+complete 201; `memberId` filter OK; `from=${today}&to=${today}` includes new row; `from=2099-01-01&to=2099-01-02` -> `[]` (F-009 closed 2026-07-03) |
| AW-159 | PASS | list-item delete truthful including not-found | `lists.test.ts` valid DELETE -> 200 `{deleted:true}`; missing item -> 404 `LIST_ITEM_NOT_FOUND`; missing list -> 404 `LIST_NOT_FOUND` (F-008 closed 2026-07-03) |
| AW-160 | PASS | roster list + last-admin guard | app.inject: `GET /members` 200 family-scoped (includes Mara/Jules/Noah; test DB polluted with prior virtual-child artifacts); solo-admin `DELETE` -> 409 `LAST_ADMIN_REMOVE_BLOCKED` with remediation text |

## Recommended Execution Order

1. `AW-144` to `AW-149`
2. `AW-024` to `AW-050`
3. `AW-056` to `AW-121`
4. `AW-127` to `AW-143`
5. `AW-150` to `AW-154`
6. `AW-155` to `AW-160`
7. `AW-001` to `AW-006` as release/build confirmation

## Stop-Ship Conditions

- Cannot create a household, join a household, or restore an existing session reliably
- Child pairing fails for valid codes or opens wrong shell
- Core planner objects cannot be created or persisted
- Profile/account actions corrupt session or cross-household state
- Google Calendar flow lies about success or fails because of known env mismatch that has not been resolved
- Offline/realtime behavior loses data or duplicates durable writes
- Any auth boundary leak between adults, children, or different households

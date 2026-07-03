# HomeThread Real-User Journey Test Cases

This document reframes the app-wide matrix into real household journeys. It is designed for UAT, demo validation, delegated testing, and client-facing confidence work.

It focuses on what actual people do:

- first adult creates a home
- second adult joins
- parent adds children
- child uses their own device
- family plans, shops, cooks, and completes chores
- users recover from mistakes, poor network, app updates, and account changes

This file is based on the refreshed GitNexus index plus the current mobile shell, backend route surface, and backend behavior tests. It is still a design artifact, not proof of execution.

## Journey Execution Rules

- Use this file after or alongside the app-wide execution master in [APP_WIDE_TEST_CASES.md](./APP_WIDE_TEST_CASES.md).
- If a journey fails, log it in [TEST_FAILURE_LOG.md](./TEST_FAILURE_LOG.md) with all affected journey IDs and any underlying app-wide test IDs if known.
- A journey only counts as `PASS` if the full user goal is completed end to end.
- If one step in the middle is blocked by env, device, or account setup, mark the whole journey `BLOCKED` and record the blocker exactly.

## How Cursor Should Report Results

For each executed journey, report results in this shape:

`JOURNEY_ID | STATUS | short outcome | evidence note | linked AW IDs if known`

Examples:

- `UJ-001 | PASS | Adult A created household and reached Home | recording + invite code shown | AW-144, AW-024`
- `UJ-004 | FAIL | child preview showed wrong household before pairing | screenshot + response note | AW-042`
- `UJ-023 | BLOCKED | Google OAuth mismatch still not testable in current mobile env | waiting on live callback env | AW-149`

## Personas

- `Adult A`: first household owner/admin
- `Adult B`: second adult invited into the home
- `Child`: paired child device user
- `Returning Adult`: existing user reopening the app after prior use
- `Stressed User`: someone with weak network, wrong code, or a rushed real-life scenario

## Recommended Test Setup

- Two adult emails or Google accounts
- One fresh child device or cleared install
- Real backend environment
- One build from the same branch intended for client delivery
- Push permissions tested once as allowed and once as denied
- Google Calendar environment tested only after redirect URI and Railway env are confirmed

## Delegated Execution Packs

Use these packs if you need to hand testing to another person quickly without asking them to design their own plan.

| Pack | Best Tester | Estimated Time | Journeys | Purpose |
| --- | --- | --- | --- | --- |
| Pack A | Owner/Admin tester | 25-35 min | `UJ-001`, `UJ-005`, `UJ-011`, `UJ-012` | Confirms a single adult can install, enter, personalize, use, and reopen the app. |
| Pack B | Second adult tester | 20-30 min | `UJ-002`, `UJ-013`, `UJ-014`, `UJ-017`, `UJ-018`, `UJ-033` | Confirms invite lifecycle, household admin reality, and admin-leave safety. |
| Pack C | Parent + child-device tester | 35-45 min | `UJ-003`, `UJ-004`, `UJ-015`, `UJ-016`, `UJ-030`, `UJ-034`, `UJ-035` | Confirms the full child lifecycle from profile creation through real child use and clean reset handling. |
| Pack D | Planner-feature tester | 35-45 min | `UJ-006`, `UJ-007`, `UJ-008`, `UJ-009`, `UJ-032`, `UJ-036`, `UJ-037` | Confirms daily planning value, list management, and whether household signals feel trustworthy. |
| Pack E | Integrations/settings tester | 30-40 min | `UJ-010`, `UJ-021`, `UJ-022`, `UJ-023`, `UJ-024`, `UJ-031`, `UJ-038`, `UJ-039` | Confirms the fragile runtime edges: calendar, profile photo, notifications, billing, and account safety truthfulness. |
| Pack F | Regression/recovery tester | 20-30 min | `UJ-019`, `UJ-020`, `UJ-025`, `UJ-026`, `UJ-027`, `UJ-028`, `UJ-029` | Confirms real-world resilience: poor network, account switching, upgrades, resumes, and degraded AI. |

## Journey Progress Checklist

Execution state as of 2026-07-03 on Windows dev host (`HEAD` `e2cf18e`). All packs blocked under **F-006** / **F-001** until a real mobile build and test accounts are available.

- [ ] Pack A complete — **BLOCKED** (`UJ-001`, `UJ-005`, `UJ-011`, `UJ-012`)
- [ ] Pack B complete — **BLOCKED** (depends on Pack A household; `UJ-002`, `UJ-013`, `UJ-014`, `UJ-017`, `UJ-018`, `UJ-033`)
- [ ] Pack C complete — **BLOCKED** (depends on household + child device; `UJ-003`, `UJ-004`, `UJ-015`, `UJ-016`, `UJ-030`, `UJ-034`, `UJ-035`)
- [ ] Pack D complete — **BLOCKED** (depends on authenticated household shell; `UJ-006`, `UJ-007`, `UJ-008`, `UJ-009`, `UJ-032`, `UJ-036`, `UJ-037`)
- [ ] Pack E complete — **BLOCKED** (depends on mobile/settings surfaces; `UJ-010`, `UJ-021`, `UJ-022`, `UJ-023`, `UJ-024`, `UJ-031`, `UJ-038`, `UJ-039`)
- [ ] Pack F complete — **BLOCKED** (depends on mobile/device/network flows; `UJ-019`, `UJ-020`, `UJ-025`, `UJ-026`, `UJ-027`, `UJ-028`, `UJ-029`)

## Journey Execution Results (2026-07-03)

| Journey | Status | Blocker / outcome | Linked AW IDs |
| --- | --- | --- | --- |
| UJ-001 | BLOCKED | No fresh mobile install or signed-in Adult A | AW-144, AW-024 |
| UJ-002 | BLOCKED | Depends on UJ-001 / F-001; no Adult B account | AW-145, AW-026 |
| UJ-003 | BLOCKED | Depends on household shell; no mobile session | AW-033 |
| UJ-004 | BLOCKED | No child test device; depends on UJ-003 | AW-042, AW-043 |
| UJ-005 | BLOCKED | Depends on UJ-001 household shell | AW-056, AW-064, AW-072 |
| UJ-006 | BLOCKED | Depends on UJ-001 household shell | AW-079 |
| UJ-007 | BLOCKED | Depends on UJ-006 / household shell | AW-085, AW-086 |
| UJ-008 | BLOCKED | Depends on UJ-001 household shell | AW-091, AW-092 |
| UJ-009 | BLOCKED | Depends on UJ-001 household shell | AW-087, AW-088 |
| UJ-010 | BLOCKED | No mobile calendar-sync session | AW-149, AW-098 |
| UJ-011 | BLOCKED | Depends on UJ-001; no photo-library device path | AW-148, AW-112, AW-113 |
| UJ-012 | BLOCKED | Depends on UJ-001 successful session + relaunch on device | AW-008, AW-010 |
| UJ-013 | BLOCKED | Depends on UJ-001 + UJ-002 / F-001 | AW-031 |
| UJ-014 | BLOCKED | Depends on join flow / F-001 | AW-027, AW-028 |
| UJ-015 | BLOCKED | Depends on UJ-004 child-device path | AW-045 |
| UJ-016 | BLOCKED | Depends on UJ-004 + second child device | AW-047 |
| UJ-017 | BLOCKED | Depends on UJ-002 + admin promotion on device | AW-039 |
| UJ-018 | BLOCKED | Depends on UJ-001 sole-admin household on device | AW-038 |
| UJ-019 | BLOCKED | No mobile offline simulation on device | AW-127, AW-078 |
| UJ-020 | BLOCKED | Depends on UJ-019 offline queue on device | AW-128 |
| UJ-021 | BLOCKED | No mobile photo-permission path | AW-114 |
| UJ-022 | BLOCKED | No mobile upload against live storage env | AW-115 |
| UJ-023 | BLOCKED | No mobile Google OAuth handoff | AW-098, AW-149 |
| UJ-024 | BLOCKED | No mobile push-permission path | AW-117 |
| UJ-025 | BLOCKED | No two-household account switch on one device | AW-134 |
| UJ-026 | BLOCKED | Depends on UJ-001 signed-in session on device | AW-121 |
| UJ-027 | BLOCKED | No TestFlight upgrade path (N+1 over N) | AW-002 |
| UJ-028 | BLOCKED | No mobile foreground/background device | AW-010 |
| UJ-029 | BLOCKED | No mobile Assistant session | AW-091 |
| UJ-030 | BLOCKED | Depends on UJ-003 child profile on device | AW-055 |
| UJ-031 | BLOCKED | No mobile billing/subscription session | AW-122, AW-123 |
| UJ-032 | BLOCKED | Depends on Pack A + D prerequisites on device | AW-051+ |
| UJ-033 | BLOCKED | Depends on UJ-001 household admin on device | AW-030, AW-031 |
| UJ-034 | BLOCKED | Depends on UJ-004 paired child device | AW-050 |
| UJ-035 | BLOCKED | Depends on UJ-004 paired child device | AW-048 |
| UJ-036 | BLOCKED | Depends on UJ-001 household shell | AW-072, AW-075, AW-076 |
| UJ-037 | BLOCKED | Depends on planner activity + mobile Insights/Home | AW-104, AW-107, AW-108 |
| UJ-038 | BLOCKED | Depends on UJ-001 real-account Settings session | AW-118, AW-119 |
| UJ-039 | BLOCKED | Depends on UJ-001 real-account deletion path | AW-120 |

## Pass 1: Core Real-User Journeys

| Journey ID | Persona | Goal | Journey Steps | Success Criteria | Failure Signals |
| --- | --- | --- | --- | --- | --- |
| UJ-001 | Adult A | Create a new household from scratch | Install app -> sign in with Google or email -> choose create household -> name household -> continue into app. | Adult A becomes admin, sees household name, sees adult invite code, and reaches Home cleanly. | Stuck in setup, invite code missing, lands in wrong shell, or startup loops. |
| UJ-002 | Adult B | Join an existing household | Sign in on a second account -> choose join -> paste Adult A invite code -> enter app. | Adult B joins the same household and sees shared data. | Invite accepted but household wrong, join fails for valid code, or app lands in broken empty state. |
| UJ-003 | Adult A | Add a child profile | Open household management -> add a child member/profile -> save. | Child appears under family members with correct role labeling. | Child not created, role labels wrong, or member list becomes inconsistent. |
| UJ-004 | Adult A and Child | Pair a child phone the normal way | Adult A generates `KC-...` code -> Child opens app -> chooses child setup -> enters code -> confirms preview -> pairs. | Child sees correct household and child name before pairing, then lands in child shell after confirmation. | Wrong household shown, adult shell flashes, or valid code cannot pair. |
| UJ-005 | Adult A | Create the first family plan | Add one event, one chore, and one grocery/list item from normal app surfaces. | All three save, remain visible, and survive refresh/relaunch. | Save says success but data disappears, wrong member attached, or refresh wipes state. |
| UJ-006 | Adult A | Plan meals for the week | Open Meals -> add meal plan entries -> optionally save/import a recipe. | Meals appear on the week plan and can be revisited later. | Meals do not persist, recipe data breaks rendering, or back navigation loses work. |
| UJ-007 | Adult A | Turn meal planning into shopping | From a saved recipe or the current week, send ingredients to grocery. | Grocery list receives expected ingredients in usable format. | Ingredients go nowhere, duplicate badly, or create wrong list state. |
| UJ-008 | Adult A | Use assistant for fast capture | Ask assistant to add household items, chores, or an event from plain language. | Assistant returns a usable draft and saving it creates the right object in the app. | Assistant lies about save, creates wrong object type, or loses the draft entirely. |
| UJ-009 | Adult A | Use the family board like a real household note stream | Open Family Board -> add a summary/update -> leave -> return later. | Board/thread history is still there on the same household/device. | History disappears immediately or leaks between households. |
| UJ-010 | Adult A | Connect calendar | Open calendar sync -> start Google connect or save an iCal feed -> run sync. | Connection flow is either working end-to-end or blocked with truthful messaging. | OAuth returns nowhere, wrong redirect, false success, or sync creates duplicates wildly. |
| UJ-011 | Adult A | Personalize the account | Open Settings -> change display name -> upload profile photo -> enable notifications if supported -> adjust notification prefs. | Profile changes persist, notification state is truthful, and the app stays stable. | Photo upload silently fails, notification state lies, or shell breaks after settings edits. |
| UJ-012 | Returning Adult | Reopen the app after a normal day | Use app successfully -> kill it -> reopen later. | Session restores, household state returns, and Home remains coherent. | Random sign-out, empty state despite valid account, or endless "connecting" behavior. |

## Pass 2: Real-World Interruptions, Mistakes, and Deadline Risks

| Journey ID | Persona | Goal | Journey Steps | Success Criteria | Failure Signals |
| --- | --- | --- | --- | --- | --- |
| UJ-013 | Adult B | Recover from a regenerated invite code | Start join with old invite -> fail -> receive new code from Adult A -> retry. | Old code is rejected, new code works, and guidance is understandable. | Both codes accepted, both rejected, or user cannot tell which code is current. |
| UJ-014 | Adult B | Handle wrong invite entry like a real person | Paste lower-case code, code with spaces, or a totally wrong code. | Normalization works for formatting issues; truly wrong codes are rejected clearly. | User gets vague failure or app behaves inconsistently between tries. |
| UJ-015 | Child | Enter wrong `KC-...` code and then the correct one | Type a bad child code -> see error -> retry with real code -> continue pairing. | Wrong code fails safely, correct code still works, and pairing state is clean. | Bad attempt poisons future valid attempt or shows wrong child preview. |
| UJ-016 | Parent replacing a child's phone | Move child access to a new device | Pair Child X on one phone -> later pair same child on a replacement phone. | New phone works and old phone loses access on next check-in. | Both phones remain active or replacement phone cannot take over. |
| UJ-017 | Adult A | Leave household after promoting another admin | Promote Adult B -> leave household -> inspect app state. | Adult A is routed out safely and Adult B retains a healthy household. | Adult A remains half-in household or household becomes orphaned. |
| UJ-018 | Sole admin | Learn they cannot leave yet | Attempt leave as only admin. | App blocks the action with clear next step. | Leave succeeds and strands the household, or error message is too vague to act on. |
| UJ-019 | Adult in weak network | Keep working while offline | Lose network during event/list/chore creation. | App either queues work honestly or fails honestly without pretending cloud save happened. | User sees success but data is lost after refresh. |
| UJ-020 | Returning Adult after outage | Recover queued changes after reconnect | Build up pending offline actions -> restore network -> reopen or refresh. | Queued work replays once and final data is correct. | Duplicate items/events/chores or stuck pending forever. |
| UJ-021 | Adult changing avatar | Handle denied photo permission | Tap upload photo -> deny permission -> retry later with permission allowed. | Denied path is graceful; later allowed path still works. | App crashes, gets stuck, or never recovers from denied state. |
| UJ-022 | Adult changing avatar in broken storage env | Surface real upload blocker | Attempt photo upload with bucket/policy misconfiguration. | App tells the user storage is not ready or permissions are wrong. | Upload fails with meaningless generic copy or appears to succeed without actual change. |
| UJ-023 | Adult using Google Calendar | Recover from auth cancellation or mismatch | Start Google auth -> cancel once -> retry; separately test callback/env mismatch variant. | Cancel path returns safely; env mismatch is reported truthfully instead of silent failure. | Browser handoff breaks the app, or UI falsely claims calendar is connected. |
| UJ-024 | Adult managing notifications | Understand permission denial | Open notification setup -> deny permissions -> try again. | App clearly distinguishes denied permission from backend token state. | UI says notifications are ready when iOS permission is denied. |
| UJ-025 | Shared household phone handoff | Prevent cross-household bleed | Sign in as Household A user -> sign out -> sign in as Household B user. | Second user sees only their own household. | Old board, assistant history, members, or chores remain visible. |
| UJ-026 | Same user re-entry | Sign out and sign back into the same household | Sign out -> sign back in with same account. | Household restores cleanly without needing manual cleanup. | Sign-in works but household state is empty or partially mismatched. |
| UJ-027 | TestFlight update | Survive app upgrade like a real client device | Install build N -> use app -> install build N+1 -> reopen. | Session and critical household data survive the update. | Upgrade logs user out, breaks child pairing, or corrupts lists/plan data. |
| UJ-028 | Busy family day | Foreground/background repeatedly | Use app, background it, reopen several times, answer messages, reopen from notifications if available. | App remains stable and coherent through ordinary device usage. | Random resets, stuck loading, or duplicate actions triggered on resume. |
| UJ-029 | Adult using Assistant with providers unavailable | Keep app useful when AI is degraded | Open Assistant while providers are off/unreachable. | App remains honest and still usable without pretending cloud AI worked. | Blank screen, spinner forever, or fake "saved" results. |
| UJ-030 | Family using Kids Mode | Enter and exit Kids Mode from adult shell | Parent enters Kids Mode for one or more children, then exits back. | Kids Mode selection and exit path are obvious and safe. | Parent gets stuck in Kids Mode or wrong child context opens. |
| UJ-031 | Adult testing subscription-sensitive flows | Observe truthful monetization gating | Open billing/subscription areas or gated flows in current entitlement state. | UI/API reflect actual family entitlement, not a fake "coming soon" success. | User is blocked without explanation or allowed into inconsistent half-enabled flow. |
| UJ-032 | End-of-day confidence loop | Use the app across the main family loop | Open app -> check Home -> add event -> complete chore -> update list -> add meal -> leave and return. | Entire family loop feels internally consistent and all data remains aligned. | One flow mutates another incorrectly, or household data feels untrustworthy by end of loop. |
| UJ-033 | Adult A | Tidy up the household after day-one setup | Open Household -> rename the household -> review member roster and role labels -> edit a child/member detail if needed -> copy or regenerate the adult invite code. | Household details persist, roster/role labeling is accurate, and invite controls behave truthfully for the current admin state. | Rename disappears, role labels are wrong, or invite controls are misleading or broken. |
| UJ-034 | Child and Parent | Use the paired child phone for actual chores | Pair or reopen a paired child device -> verify child name and household -> complete one assigned chore -> verify stars on child phone -> verify parent sees the completion. | Child sees only their own chores/context, completion persists once, and rewards update for the correct child. | Wrong child context appears, rewards duplicate, or parent and child views disagree. |
| UJ-035 | Parent or Child | Reset a child phone cleanly | On a paired child phone, unpair from the child shell or revoke from Household -> relaunch the child app. | The phone returns to truthful unpaired state and requires a fresh `KC-...` code before re-entry. | A stale device token still opens the child shell, or the app falls into the wrong shell/ghost session. |
| UJ-036 | Adult A | Use lists like a real organizer, not just grocery | Create a custom list -> add several items -> check and uncheck one -> clear checked or delete a single item -> leave and return to the same list. | The correct list stays selected, list/item changes persist, and cleanup actions are honest and durable. | Items land in the wrong list, selected list resets, or cleanup actions lie. |
| UJ-037 | Returning Adult | Trust the app's signals after real activity | After plans, chores, meals, or reminders exist, open Home and Insights -> review recent alerts -> mark one notification read -> compare insights with real household activity. | Recent notifications, unread counts, weekly summary, chore momentum, and busyness feel internally consistent. | Counts contradict visible data, mark-read fails silently, or insights look fabricated or stale. |
| UJ-038 | Adult A | Manage password and access recovery safely | Open Settings -> update password if the current auth provider allows it -> request reset email if needed -> verify any unavailable path is explained truthfully. | Password and recovery controls work where supported and give clear guidance where they are unavailable. | Buttons do nothing, developer-session restrictions are hidden, or the user cannot tell whether the action worked. |
| UJ-039 | Adult A | Leave the service safely | Attempt account deletion from Settings in a signed-in real-account context. | The destructive path is explicit, backend result is truthful, and the app does not strand the user in a half-deleted broken session. | Delete appears to succeed but account/session remains corrupted, or the real blocker is hidden. |

## Supervisor Completeness Verdict

As of current `HEAD`, every major user-visible product area from the completed [APP_WIDE_TEST_CASES.md](./APP_WIDE_TEST_CASES.md) master is represented here by at least one realistic end-to-end or interruption-style journey.

That means this file is complete as a real-user journey inventory for the current build surface. It is still not proof of execution. Runtime status, failures, and blockers remain tracked in [TEST_FAILURE_LOG.md](./TEST_FAILURE_LOG.md).

## Minimum Must-Pass Journeys Before Client Delivery

These are the smallest believable set if time is brutally limited:

| Priority | Journey IDs | Why They Matter |
| --- | --- | --- |
| P0 | `UJ-001`, `UJ-002`, `UJ-004`, `UJ-005`, `UJ-011`, `UJ-012`, `UJ-034` | They prove the app can be installed, entered, shared, paired, actually used by a child, personalized, and reopened. |
| P1 | `UJ-006`, `UJ-007`, `UJ-008`, `UJ-010`, `UJ-019`, `UJ-020`, `UJ-036`, `UJ-037` | They prove the app handles planner depth, list reality, trustworthy household signals, and weak-network behavior. |
| P1 | `UJ-016`, `UJ-022`, `UJ-023`, `UJ-027`, `UJ-035`, `UJ-038`, `UJ-039` | They target the current highest-risk runtime areas: child replacement/reset, photo upload, calendar env, build upgrade stability, and account safety. |

## What a Delegate Tester Should Capture

For every failed journey, capture:

- build number
- device model and iOS version
- account email(s) involved
- household name
- whether backend sync looked connected before the failure
- exact step where the failure first appeared
- screenshot or screen recording
- whether restarting the app changed the symptom

## Fail-Fast Client-Risk Signals

Stop calling the build client-ready if any of these are true:

- first adult cannot create a household cleanly
- second adult cannot join with a valid invite code
- child pairing fails for a valid `KC-...` code
- event/chore/list save flows claim success but data disappears
- profile photo upload has no truthful success/failure path
- app relaunch produces random sign-outs or broken empty states
- Google Calendar appears "connected" when callback/env mismatch still exists
- switching accounts on one device leaks another household's data

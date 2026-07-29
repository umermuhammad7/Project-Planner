# HomeThread Launch Audit Tracker

Internal working tracker for the phased QA / UX / architecture audit.

Status rules:
- `verified`: confirmed by direct code review or direct test output
- `likely`: strong code signal, but still wants runtime confirmation
- `runtime`: needs device/runtime confirmation before fix priority is final
- `resolved`: fixed and re-verified
- `rejected`: reported once, but not carrying forward as a real issue

This file is intentionally a working note and should stay uncommitted unless we explicitly decide to keep it in the repo.

## Audit Plan

| Phase | Focus | Status |
| --- | --- | --- |
| 1 | Startup, auth, household entry, render blockers | reviewed |
| 2 | Household management, roles, child-device lifecycle | reviewed |
| 3 | Core planner workflows: plan, chores, lists, board, meals | reviewed |
| 4 | Assistant, insights, settings, notifications, polish flows | reviewed |
| 5 | Final preview-build readiness, cross-flow regression, launch gate | reviewed |

## Locked Strategy

We are in issue-collection and verification mode first.

Rules:
- Do not do broad fixes during audit phases unless a blocker prevents the next phase from being audited.
- Keep backend-contract safety in mind.
- Prefer one concrete defect map over scattered audit notes.
- Only promote issues into the master list when they are verified or clearly likely.

## Master Issue List

### Phase 1: Startup and Entry

| ID | Status | Severity | Issue | Notes |
| --- | --- | --- | --- | --- |
| P1-01 | resolved | blocker | Create-household flow can skip the adult invite reveal screen | Fixed by holding `enteredApp` behind an explicit onboarding handoff instead of auto-entering the app as soon as `familyId` appears mid-flow. Verified with code review plus typecheck/tests/export. |
| P1-02 | resolved | high | Family-setup Back loops back into family-setup for signed-in users without a household | Fixed by adding a local handoff flag so Back can return a signed-in user to welcome without the auto-redirect effect immediately forcing family-setup again. Verified with code review plus typecheck/tests/export. |
| P1-03 | resolved | high | Dev-token no-household path is inconsistent with Supabase no-household path | Fixed by routing dev-token sign-in through the same household-boundary completion flow and extending the hydrate guard to dev-token sessions with no household. Verified with code review plus typecheck/tests/export. |
| P1-04 | resolved | medium | Child device bootstrap renders optimistic paired shell before real session loads | Fixed by keeping child bootstrap in an unresolved loading state until `/child-devices/me` validates the stored token, then falling back cleanly to unpaired if validation fails. Verified with code review plus typecheck/tests/export. |
| P1-05 | resolved | medium | Child-device unknown bootstrap may briefly fall through adult shell path | Fixed by explicitly gating the shell on child bootstrap completion and rendering a dedicated “Checking this device” state while unresolved. Verified with code review plus typecheck/tests/export. |
| P1-06 | resolved | medium | Realtime connection may churn on initial list hydration | Fixed by memoizing the shell-level list-id key and deferring first realtime connect until the initial API hydrate completes, without stop/start churn on ordinary refresh cycles. Verified with code review plus typecheck/tests/export. |
| P1-07 | resolved | medium | Supabase `TOKEN_REFRESHED` re-runs full auth bootstrap | Fixed by narrowing token-refresh handling to access-token sync while keeping full bootstrap for true sign-in and user-update events. Verified with code review plus typecheck/tests/export. |
| P1-08 | rejected | low | Error boundary retry behavior is a launch blocker | Worth polishing later, but not carrying as a phase gate issue right now. |
| P1-09 | rejected | low | Child setup is only reachable from signed-out Welcome | Overstated. Parents can manage child pairing from Household; this is more flow polish than a strict defect. |
| P1-10 | resolved | blocker | React 19 / Zustand startup-loop risk from derived array selectors in shell | Current shell startup paths were normalized by removing fresh-array selectors from `App.tsx` startup routing and memoizing derived shell inputs. The pattern remains something to watch, but the concrete shell-level startup risk is cleared in the current code. Verified with code review plus typecheck/tests/export. |

### Phase 2: Household, Roles, and Child Devices

| ID | Status | Severity | Issue | Notes |
| --- | --- | --- | --- | --- |
| P2-01 | resolved | blocker | Last admin can leave and orphan the household | Fixed with a server-side leave guard that returns `LAST_ADMIN_LEAVE_BLOCKED` when the final admin tries to leave, plus matching Household UI guidance. Verified with code review plus typecheck/tests/export. |
| P2-02 | resolved | blocker | Phase 1 invite reveal skip also breaks second-adult onboarding | Carryover from P1-01, cleared by the same onboarding handoff fix. Verified with code review plus typecheck/tests/export. |
| P2-03 | resolved | high | No path for second adult to become admin | Fixed with backend role-promotion validation on family members and a Household `Make admin` action for eligible signed-in adults. Verified with code review plus typecheck/tests/export. |
| P2-04 | resolved | high | KC pairing codes are ephemeral in Family UI state | Fixed by adding an admin-only active-code fetch route and loading active child pairing codes when Household opens, instead of relying only on local screen state. Verified with code review plus typecheck/tests/export. |
| P2-05 | resolved | high | Pairing-code expiry is not shown to parents in Household UI | Fixed by rendering readable expiry text for active KC codes in Household and on the child-device confirmation step. Verified with code review plus typecheck/tests/export. |
| P2-06 | resolved | medium | `familyCreatedBy` owner label becomes stale if owner leaves | Fixed by deriving the effective owner only if the creator still exists as a current household member; promoted admins remain truthfully labeled Admin. Verified with code review plus typecheck/tests/export. |
| P2-07 | resolved | medium | Regenerating adult invite code invalidates in-flight joins without a strong warning | Fixed with explicit warning copy and a two-step confirmation before regeneration. Verified with code review plus typecheck/tests/export. |
| P2-08 | resolved | medium | Removing a child profile has no confirmation and cascades child devices | Fixed with destructive confirmation that warns about child-profile deletion and paired-device loss, including active device count when known. Verified with code review plus typecheck/tests/export. |
| P2-09 | resolved | medium | Child pairing abuse protection is process-local | Fixed by moving failed-attempt tracking into a shared database-backed window (`child_pairing_attempts`) while keeping Fastify burst limiting on the public pairing routes. Verified with code review plus typecheck/tests/export. |
| P2-10 | resolved | medium | Wrong-child pairing is possible by parent mistake | Fixed by adding a preview/confirm step on the child device that shows the household and child profile before final pairing. Verified with code review plus typecheck/tests/export. |
| P2-11 | resolved | low | Adult member row wording can imply an invite-pending model that does not really exist | Fixed by replacing misleading invite-pending wording with truthful account-state labels such as Signed in, Profile only, and No linked account. Verified with code review plus typecheck/tests/export. |
| P2-12 | resolved | low | Leave-household flow relies on shell effects instead of explicit transition handling | Fixed by adding an explicit `onLeaveComplete` handoff from Household back into the app shell so leaving cleanly resets overlays and returns the user to setup when needed. Verified with code review plus typecheck/tests/export. |

### Phase 3: Plan, Chores, Lists, Board, and Meals

| ID | Status | Severity | Issue | Notes |
| --- | --- | --- | --- | --- |
| P3-01 | resolved | high | "Unassigned" chore creation silently assigns a fallback child or current member | Fixed by preserving explicit `null` from the UI and only applying the fallback when `assignedTo === undefined`. Verified with code review plus typecheck/tests/export. |
| P3-02 | resolved | high | Signed-in households can still show mock Parker board history | Fixed by clearing `textUpdates` on successful API hydrate so signed-in households cannot inherit seeded mock board entries. Verified with code review plus typecheck/tests/export. |
| P3-03 | resolved | high | Board history is not yet durably persisted on native cold start | Fixed by moving native board history storage to AsyncStorage with per-household keys, async load on hydrate, and explicit clear-on-leave behavior. Verified with code review plus typecheck/tests/export. |
| P3-04 | resolved | medium | Chore planning is still time-only / today-shaped, not date-based | Addressed honestly by matching the UI to the real backend model: chores are daily household assignments with optional due times, not calendar-dated tasks. Verified with code review plus typecheck/tests/export. |
| P3-05 | resolved | medium | Global `isSaving` can freeze unrelated actions across planner modules | Fixed by introducing scoped save-state gating (`saveScope`) so planner surfaces only disable their own actions. Verified with code review plus typecheck/tests/export. |
| P3-06 | resolved | medium | Create-list flow is visually buried after existing list content | Fixed by moving the new-list action and form to the top of Lists so capture is primary before list switching and item entry. Verified with code review plus typecheck/tests/export. |
| P3-07 | resolved | medium | List item toggle has no positive user feedback beyond the checkbox change | Fixed with short-lived success feedback on check/reopen actions in `ListsScreen`. Verified with code review plus typecheck/tests/export. |
| P3-08 | resolved | medium | Plan invalid date/time errors are banner-level, not field-level | Fixed by threading `invalidField` through save outcomes and rendering date/time field errors directly in `PlanScreen`. Verified with code review plus typecheck/tests/export. |
| P3-09 | rejected | low | Text import saving locally while signed in is a hidden failure | Not carrying forward: current UI explicitly says the draft was saved on this device only and tells the user to refresh when the connection is steady. |
| P3-10 | resolved | low | Chores UI still has no edit or delete path | Fixed by wiring chore edit and delete to the existing backend PATCH/DELETE routes and adding the matching Chores UI with confirmation and feedback. Verified with code review plus typecheck/tests/export. |
| P3-11 | resolved | low | Plan expanded member pills expose raw internal role labels | Fixed by mapping internal role names to consumer-facing labels such as Child, Adult admin, and Adult. Verified with code review plus typecheck/tests/export. |
| P3-12 | resolved | low | Meals form open behavior is less polished than Plan / Chores | Fixed by applying the same scroll-to-form reveal pattern used in Plan/Chores when opening the meal form. Verified with code review plus typecheck/tests/export. |

### Phase 4: Assistant, Settings, Insights, Notifications, and Secondary Navigation

| ID | Status | Severity | Issue | Notes |
| --- | --- | --- | --- | --- |
| P4-01 | resolved | high | Assistant thread is ephemeral component state and is lost when leaving the screen | Fixed by persisting assistant messages device-locally per household and restoring them when Assistant reopens. Verified with code review plus typecheck/tests/export. |
| P4-02 | resolved | high | Assistant composer is not viewport-sticky on long threads | Fixed by moving conversation scrolling into an internal Assistant panel while keeping the composer pinned at the bottom of that surface. Verified with code review plus typecheck/tests/export. |
| P4-03 | resolved | high | Home "Family board" section is actually rendering notifications, not board history | Fixed by truthfully reframing the Home section as recent household alerts rather than inventing board data. Verified with code review plus typecheck/tests/export. |
| P4-04 | resolved | high | Settings profile save is blocked by unrelated global planner saves | Fixed by removing the unrelated household-store `isSaving` dependency from the profile-save button and press guard. Verified with code review plus typecheck/tests/export. |
| P4-05 | resolved | high | Notification setup copy overstates readiness | Fixed by separating permission state, token-saved state, and explicit “delivery not verified” wording in Settings. Verified with code review plus typecheck/tests/export. |
| P4-06 | resolved | medium | Assistant draft and meal UI can show unrelated global `saveMessage` text | Fixed by scoping Assistant feedback to its own local draft/meal save state instead of reading the global household save message. Verified with code review plus typecheck/tests/export. |
| P4-07 | resolved | medium | Assistant auto-scroll can pull the viewport while the user is reading older messages | Fixed by only auto-scrolling when the user is already near the bottom, while still forcing bottom-stickiness when the user sends a new message. Verified with code review plus typecheck/tests/export. |
| P4-08 | resolved | medium | Insights is all-or-nothing when one API call fails | Fixed by loading each insight section independently and showing inline section-level errors while successful sections remain visible. Verified with code review plus typecheck/tests/export. |
| P4-09 | resolved | medium | Settings is still buried behind the Home avatar only | Fixed by adding a clear Settings entry in the More hub so account controls no longer depend on the Home avatar path alone. Verified with code review plus typecheck/tests/export. |
| P4-10 | resolved | medium | Household and Insights now have redundant entry points with no clear canonical path | Improved by clarifying More as the full hub and Home as quick access, while matching household/insights wording across Home, More, and Settings. Verified with code review plus typecheck/tests/export. |
| P4-11 | resolved | medium | Delete account appears available offline but silently no-ops | Fixed by disabling the destructive action when backend sync is unavailable and surfacing honest explanatory copy. Verified with code review plus typecheck/tests/export. |
| P4-12 | resolved | medium | Notification permission state is stored but not surfaced distinctly in UI | Fixed by rendering permission-specific notification status copy in Settings for denied, unsupported, undetermined, granted-without-token, and granted-with-token states. Verified with code review plus typecheck/tests/export. |
| P4-13 | resolved | medium | Home header hierarchy still diverges from the shared ScreenHeader system | Fixed by moving Home onto the shared `ScreenHeader` hierarchy while preserving its household-specific avatar shortcut and overall identity. Verified with code review plus typecheck/tests/export. |
| P4-14 | resolved | low | Insights "Preview" labeling is inconsistent across surfaces | Fixed by carrying the Preview label into the Insights screen itself and matching the wording in More/Home/Settings entry points. Verified with code review plus typecheck/tests/export. |
| P4-15 | resolved | low | Notification enable button is not actually disabled while working | Fixed by wiring real disabled/loading state into the Settings notification button while registration is in flight. Verified with code review plus typecheck/tests/export. |

### Phase 5: Final Preview-Build Launch Gate

This phase is the final collapse layer, not a new defect family. It tells us which already-verified issues actually block another preview build.

#### P0 blockers before the next preview build

All previously locked P0 blockers in this tracker are now cleared in-repo:

- `P1-01` / `P2-02`: resolved
- `P3-02`: resolved
- `P3-01`: resolved
- `P4-03`: resolved

Next step is not another broad audit. Next step is a cautious P1 fix batch, followed by targeted runtime/device confirmation.

#### P1 trust and onboarding issues right after P0

This batch also cleared:

- `P1-02`: resolved
- `P1-03`: resolved
- `P4-05`: resolved
- `P4-04`: resolved

And the next high-value household-integrity batch cleared:

- `P2-01`: resolved
- `P2-03`: resolved
- `P2-07`: resolved
- `P2-08`: resolved

#### Remaining tracked follow-up

- No in-repo milestone defects remain open in this tracker.
- Production can still benefit from stronger edge/WAF throttling in front of public pairing routes, but that is now an ops hardening layer rather than an open application-code defect.

## Confirmed Safe Foundations

These are not current defects and should be treated as stable unless a later phase disproves them:

- Adult invite codes and child pairing codes are separated in both UI copy and backend validation.
- Child-device auth rejects adult bearer tokens.
- One-device-per-child logic exists server-side and revokes the prior active device.
- Adult and child push-token wiring exists on separate paths.
- Notification routing foundation distinguishes adults from child devices.
- Household name edit and core family admin gates exist server-side.
- Phase 4 code does not show a fresh maximum-update-depth loop on its own surfaces; the known startup-loop class still belongs to Phase 1 vigilance.

## Things We Must Keep Watching

- Any Zustand selector in startup or shell code that returns a fresh array/object.
- Any effect in `App.tsx`, `WelcomeScreen.tsx`, or child-device bootstrap that can bounce state on mount.
- Any UX that hides the exact next step for:
  - household creator
  - second adult
  - parent pairing a child's phone
  - child entering Kids mode on their own device

## Next Phase Target

No more audit phases.

Next step is runtime confirmation mode:
1. deploy the backend migration and updated code
2. run a targeted iPhone checklist across entry, household, child pairing, planner flows, assistant, notifications, and leave/rejoin paths
3. only then promote the next build as a serious candidate

## Runtime Confirmation Findings

Source-backed verification pass completed against startup, auth, household, and planner flows.

### Verified pre-build blockers

| ID | Severity | Area | Issue | Status |
| --- | --- | --- | --- | --- |
| R1 | high | `apps/mobile/App.tsx` | `isHydrating` currently drives a full-screen `Connecting to HomeThread` state even after initial entry, so ordinary refresh/hydrate actions can blank the whole app instead of behaving like background sync. | resolved |
| R2 | high | `apps/mobile/src/screens/WelcomeScreen.tsx` | Signed-in no-household users who back out of family setup can land on Welcome with no actionable Create/Join path because the signed-in state hides those entry buttons. | resolved |

### Confirmed secondary issues to validate or polish later

| ID | Severity | Area | Issue | Status |
| --- | --- | --- | --- | --- |
| R3 | medium | `apps/mobile/src/screens/AssistantScreen.tsx` + `apps/mobile/App.tsx` | Assistant still lives inside the root shell scroll while also using its own inner scroll; likely to need device validation for nested-scroll feel. | validate-on-device |
| R4 | medium | `apps/mobile/src/screens/ThreadScreen.tsx` + `apps/mobile/src/services/boardHistoryStorage.ts` | Board history is intentionally device-local; this is honest but must be remembered during multi-device testing. | known-limitation |
| R5 | medium | `apps/mobile/src/screens/FamilyScreen.tsx` | Child profile rows can become very tall when pairing code and destructive confirmations are open together on smaller phones. | polish-later |
| R6 | medium | `apps/mobile/src/screens/MealsScreen.tsx` | Seven-day meal layout is coherent but long on phone-sized screens. | polish-later |
| R7 | medium | `apps/mobile/src/screens/MoreScreen.tsx` | Meals / Board / Assistant depend on More or Home shortcuts and may still need device-level discoverability judgment. | validate-on-device |
| R8 | medium | `apps/mobile/src/store/useHomeThreadStore.ts` | Chores currently hydrate from `/chores/today`; must be validated against intended product scope on device. | validate-on-device |
| R9 | low | `apps/mobile/src/screens/InsightsScreen.tsx` | Some role labels remain raw API values instead of the friendlier household labels used elsewhere. | polish-later |
| R10 | low | `apps/mobile/src/store/useHomeThreadStore.ts` | Board entries often use `createdAt: "Now"` in local outcomes, weakening scanability of board history. | polish-later |
| R11 | low | multiple mobile screens | Some builder-facing wording remains (`KC- codes`, `Preview`, `Cloud AI`, etc.). | polish-later |

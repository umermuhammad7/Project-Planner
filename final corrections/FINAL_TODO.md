# HomeThread Final Corrections TODO

Source files reviewed:
- `information from the devaloper .md`
- `refined.md`
- `screens critigue by me.txt`

Review passes completed:
- Pass 1: inventory of all files and main modules.
- Pass 2: grouped repeated issues by screen and root cause.
- Pass 3: checked critical tester notes, trust defects, dependencies, and risky areas.

Working rules for Cursor:
- Work screen by screen. Do not jump between modules unless fixing a shared root cause.
- Keep working functionality intact. Prefer UI-only fixes before logic changes.
- Use GitNexus before logic-touching edits. Current GitNexus status is stale, so run `npx gitnexus analyze` before impact tracing or risky implementation.
- Use the existing request/API layer, including Axios if that is the current project path. Do not introduce a new HTTP wrapper while fixing canceled-request or sync issues.
- Do not touch `E:\project tax tracker`.
- Apple Sign-In and real subscription checkout come at the end. Until then, premium UI must be honest but not wired to unfinished payment promises.
- Any change touching auth, household membership, child pairing, backend access control, calendar sync, or subscription enforcement needs explicit impact review before editing.
- If one screen depends on a module scheduled for later, mark the dependency and preserve the current behavior until that module is fixed. Do not fake a finished state.

Labels:
- `[SAFE UI]`: layout, copy, spacing, visual hierarchy, keyboard dismissal, feedback messages.
- `[LOGIC TOUCHING]`: save destination, routing, state model, role checks, sync behavior, data display.
- `[RISKY]`: auth, household access, child pairing, billing/subscription enforcement, backend authorization, destructive account flows.
- `[DEFER FINAL]`: Apple Sign-In, production subscription/payment setup, deployment-only work.

## 0. Shared Foundations

- [ ] `[LOGIC TOUCHING]` Refresh GitNexus index before implementation work: run `npx gitnexus analyze`, then use GitNexus impact tracing before risky edits.
- [ ] `[LOGIC TOUCHING]` Implement one app-wide scroll policy: opening a primary module or different entity starts at the top; Back to the exact same context may restore position; every form/detail/modal opens at the top.
- [ ] `[SAFE UI]` Apply keyboard-safe focused flows across forms: primary action visible above keyboard, bottom nav hidden during focused entry/review, no background scrolling behind modal/sheet forms, logical position restored after dismiss.
- [ ] `[SAFE UI]` Reduce nested rounded-card density and standardize section spacing, typography, contrast, button hierarchy, selected states, status badges, and destructive action styling.
- [ ] `[SAFE UI]` Remove permanent sync explanations from primary screens. Normal sync should be invisible; show Retry only when sync fails.
- [ ] `[SAFE UI]` Replace technical/vague user-facing copy: no `Refresh push token`, `device token`, `build diagnostics`, `Cloud AI`, `confidence %`, `KC code`, `Save to household`, or raw backend errors.
- [ ] `[LOGIC TOUCHING]` Standardize save confirmations so every success names the object and exact destination, such as `Brownies saved to Meals` or `8 ingredients added to Grocery shopping`.
- [ ] `[LOGIC TOUCHING]` Replace usernames such as `kumer031` with saved display names in family-facing UI; show account identifiers only where necessary.
- [ ] `[LOGIC TOUCHING]` Verify timestamps across modules. Do not permanently store/render `Now`; use real timestamps, local formatting, and safe missing-date fallbacks.
- [ ] `[LOGIC TOUCHING]` Define premium gates before wiring screens: Assistant is Premium-only; standard users must still use non-AI Meals, Lists, Plan, Chores, Household, and Family Board.
- [ ] `[LOGIC TOUCHING]` Track cross-module dependencies while working screen by screen, especially Assistant -> Meals/Lists/Plan, Meals -> Lists, Family Board -> Plan/Chores/Lists/Meals, Household -> Settings/Auth, and Settings -> notification/backend setup.

## 1. Home Screen

- [ ] `[SAFE UI]` Make the first viewport answer: what needs attention today? Keep greeting compact and make the unassigned/needs-attention card the strongest element.
- [ ] `[SAFE UI]` Add an easy-to-find `How it works` entry near the top of Home or onboarding. It should open a simple swipeable/slideshow-style guide with a close option, without blocking normal use.
- [ ] `[SAFE UI]` Replace awkward greeting/name display issues, including `Good day, kumer` and the tester note that `muhammad` appears under the name on the first screen.
- [ ] `[SAFE UI]` Reduce pill overload. Separate primary action, secondary action, and non-clickable status badges visually.
- [ ] `[SAFE UI]` Improve scanability of chores, groceries, alerts, kids reminders, and quick access with larger readable text, fewer words, and clearer counts.
- [ ] `[SAFE UI]` Soften reminder language: avoid surveillance or pressure wording like waiting timers unless it is truly useful.
- [ ] `[SAFE UI]` Make Kids Mode feel like a deliberate mode switch, not a routine equal-weight shortcut.
- [ ] `[LOGIC TOUCHING]` Review bottom navigation count and Assistant placement. Lowest-risk path is to keep existing routes but avoid overcrowding visible tabs.
- [ ] `[LOGIC TOUCHING]` Ensure Home does not show weather questions as `Next plan` unless the user explicitly created a weather reminder/event.

## 2. Plan Screen

- [ ] `[SAFE UI]` Reorder the first viewport around the family plan: title, Add plan, upcoming/empty state, then household/calendar/supporting information.
- [ ] `[SAFE UI]` Move Google Calendar and refresh/sync information lower or into a connections/settings area so it does not compete with Add plan.
- [ ] `[SAFE UI]` Rename/calm copy: `Add plan`, `Coming up`, `No plans yet`, `Household is up to date`, and remove developer-style live-update explanations.
- [ ] `[SAFE UI]` Make event create/edit forms keyboard-safe with focused modal/sheet behavior, clear Cancel, and sticky primary action.
- [ ] `[SAFE UI]` Improve date/time picker presentation, assignment chips, selected states, and destructive delete confirmation copy.
- [ ] `[LOGIC TOUCHING]` Verify calendar sync because tester reports calendar not working. Do not rewrite sync before tracing the real flow.
- [ ] `[LOGIC TOUCHING]` After creating/editing a plan, return to and reveal/highlight the relevant event card.
- [ ] `[RISKY]` Google auth/calendar reminder: Google auth uses Supabase auth, not a Railway callback. Confirm before changing any callback/auth code.

## 3. Chores Screen

- [ ] `[SAFE UI]` Compress chore cards so active chores are scannable without excessive scrolling.
- [ ] `[SAFE UI]` Make responsibility cues clearer with display name, avatar/initial, recurrence/due date, and selected ownership state.
- [ ] `[SAFE UI]` Remove always-visible destructive controls from active cards where possible; put Delete behind confirmation/overflow.
- [ ] `[SAFE UI]` Make completed chores visually calmer and more compact than open chores.
- [ ] `[SAFE UI]` Replace technical sync and refresh copy with plain states only when needed.
- [ ] `[SAFE UI]` Fix create/edit chore keyboard behavior so buttons are not cramped near the keyboard.
- [ ] `[LOGIC TOUCHING]` After creating/completing/editing a chore, reveal the affected chore and preserve household consistency.

## 4. Lists Screen

- [ ] `[LOGIC TOUCHING]` Fix the shared/entity scroll defect here first if this is the easiest reproduction: switching lists must open the selected list at the top.
- [ ] `[SAFE UI]` Strengthen selected-list chip state and keep the selected chip visible in the horizontal selector.
- [ ] `[SAFE UI]` Make quick add the dominant workflow. Avoid large inline data-entry cards that push content around.
- [ ] `[SAFE UI]` Replace inline add/new-list flows with keyboard-safe modal/sheet or focused flow.
- [ ] `[SAFE UI]` Keep list-specific copy accurate. Do not show shopping language on unrelated lists.
- [ ] `[LOGIC TOUCHING]` Imported/inbox items must explain origin and destination before saving into a normal list.
- [ ] `[LOGIC TOUCHING]` After adding an item/list, reveal the added item or new list at a logical position.

## 5. Assistant Screen

- [ ] `[RISKY]` Before editing, trace Assistant intent routing, generated response rendering, save actions, destinations, subscription checks, and API calls with GitNexus.
- [ ] `[LOGIC TOUCHING]` Fix weather behavior: informational weather questions must return an informational answer/card and must not create Plan items unless the user explicitly asks for a reminder/event.
- [ ] `[LOGIC TOUCHING]` Audit weather location source. Do not silently assume Karachi unless it comes from an authorized household/device setting and is displayed clearly.
- [ ] `[LOGIC TOUCHING]` Fix recipe state model: generated recipes start as unsaved previews, then save to Meals/Recipes only after explicit user action.
- [ ] `[LOGIC TOUCHING]` Add separate explicit action for recipe ingredients: review ingredients, choose grocery list, then add to Lists.
- [ ] `[SAFE UI]` Replace repeated embedded prompt forms with one keyboard-safe sticky composer.
- [ ] `[SAFE UI]` Remove unexplained confidence percentages, `Cloud AI`, and vague messages like `Saved to your household`.
- [ ] `[SAFE UI]` Avoid long recipe content trapped in nested cards. Use concise previews and details where needed.
- [ ] `[RISKY]` Enforce Assistant Premium access in frontend and backend. Free users should see a clear premium state before interaction, not a technical failure after tapping.

## 6. Meals Screen

- [ ] `[SAFE UI]` Separate the screen into two clear views: Week plan and Recipes.
- [ ] `[SAFE UI]` Keep Week plan focused on date range, compact Monday-Sunday rows, Plan a meal, meal coverage, and Add week's ingredients.
- [ ] `[SAFE UI]` Keep Recipes focused on saved recipes, import, manual save, edit/view, Add ingredients, and Premium Generate with Assistant.
- [ ] `[SAFE UI]` Replace inline expanding forms with keyboard-safe modal/sheet flows for Plan a meal, Import recipe, Save manually, and Edit recipe.
- [ ] `[SAFE UI]` Replace labels like `Open` with `No meal planned`; compress empty days so the full week is scannable.
- [ ] `[LOGIC TOUCHING]` Recipe detail should support name, ingredients, instructions, servings/times/notes if existing schema allows. Inspect schema before adding fields.
- [ ] `[LOGIC TOUCHING]` Add ingredients to groceries must show review list, quantities/removals if supported, destination grocery list, skipped meals/items, and exact success message.
- [ ] `[LOGIC TOUCHING]` Import recipe should support paste/link if already feasible, show editable review before save, and use plain failure copy.
- [ ] `[RISKY]` Keep Meals useful for standard users without Assistant; only AI generation/suggestions are Premium.

## 7. Family Board

- [ ] `[RISKY]` Before editing, trace board posts, imported text, AI review, summary creation, save destinations, activity history, timestamps, keyboard behavior, scroll behavior, and SMS-related UI.
- [ ] `[LOGIC TOUCHING]` Define Family Board as the household update feed first, not an import utility or raw system activity log.
- [ ] `[SAFE UI]` Default screen should show feed first: heading, Post update action, pinned/recent updates. Move Import family text to a secondary modal/sheet.
- [ ] `[SAFE UI]` Remove or replace confusing Paste/Review/Save pills unless they become a real stepper.
- [ ] `[LOGIC TOUCHING]` Remove all `Save to household` actions and confirmations. Use exact destinations: Post to Family Board, Add to Plan, Create chore, Add to Grocery shopping, Save to Meals.
- [ ] `[LOGIC TOUCHING]` Informal text like `Rayyan where are you?` must not automatically become a list item. Suggested routing must be editable before saving.
- [ ] `[LOGIC TOUCHING]` Summary flow: generate from pasted content, show editable preview, post only after explicit approval, then reveal the new board card at the top.
- [ ] `[SAFE UI]` Remove Send with SMS from Family Board UI and related helper/loading/success/permission states.
- [ ] `[LOGIC TOUCHING]` Separate human board updates from routine system activity. Move or filter `Saved to Lists`, `Created list`, and similar logs.
- [ ] `[LOGIC TOUCHING]` Fix board timestamps with real server/client timestamp handling and no false `Now`.

## 8. Settings

- [ ] `[SAFE UI]` Restructure into Account, Notifications, Household, Subscription, Support, and Danger Zone.
- [ ] `[SAFE UI]` Fix profile save feedback: after Save profile, dismiss keyboard or keep field stable, show clear success/error, and disable Save until changes exist.
- [ ] `[LOGIC TOUCHING]` Profile photo upload currently fails with `profile photo storage is not ready`; verify Supabase avatar bucket/config and show a user-safe unavailable state if backend setup is missing.
- [ ] `[SAFE UI]` Replace `Refresh push token` with user-friendly notification repair wording shown only when setup fails.
- [ ] `[LOGIC TOUCHING]` Notification setup currently shows delivery verification/settings errors and the toggle hits backend rate limiting. Trace registration/update flow and avoid repeated calls while preserving error handling.
- [ ] `[SAFE UI]` Notification preferences need plain descriptions for plans/calendar, chores, household changes, and daily recap. Daily recap should allow delivery time if enabled.
- [ ] `[SAFE UI]` Treat Google-managed email as read-only unless a verified email-change flow exists.
- [ ] `[SAFE UI]` Hide diagnostics/build/test details in production behind debug/dev mode.
- [ ] `[RISKY]` Delete account needs a protected flow with confirmation, re-authentication where supported, and consequences for household ownership, children, paired devices, subscription, and shared data.

## 9. Household

- [ ] `[RISKY]` Before editing, trace household roles, adult invites, child pairing, ownership transfer, leave household, and `apps/backend/src/plugins/familyAccess.ts`.
- [ ] `[SAFE UI]` Restructure into Household overview, Adults, Children, Pairing, Permissions, Subscription, and Leave household.
- [ ] `[SAFE UI]` Fix household-name editing: focused modal/sheet, keyboard-safe buttons, success feedback, keyboard dismissal, and return to the updated household card.
- [ ] `[LOGIC TOUCHING]` Adult invite flow is failing for the second adult with `fetch request has been canceled`. Trace request cancellation/network handling before changing UI.
- [ ] `[RISKY]` Second adult should be able to join with the correct code and use the household according to role, like wife/co-adult expectations. Verify backend authorization and household state sync.
- [ ] `[LOGIC TOUCHING]` Do not permanently expose invite codes as dominant content. Show purpose, expiry, regenerate/copy/share states, and safe expired handling.
- [ ] `[SAFE UI]` Replace `KC code` with `Child pairing code` and clearly separate adult invite codes from child device pairing.
- [ ] `[LOGIC TOUCHING]` Distinguish child profiles from paired devices. Show whether each child has zero/one/multiple paired devices.
- [ ] `[SAFE UI]` Move Rename/Remove child controls into overflow. Strongly confirm removal and explain data/device consequences.
- [ ] `[RISKY]` Verify leave-household and ownership-transfer rules before enabling actions. Disable leaving when user is only owner until transfer is complete.
- [ ] `[LOGIC TOUCHING]` Ensure household information stays consistent and updated between household members after edits/invites/pairing.

## 10. Insights

- [ ] `[SAFE UI]` Redefine Insights as a calm household summary of what needs attention, not analytics/ranking.
- [ ] `[SAFE UI]` Remove judgment/ranking language such as `Top helper`, `Most involved`, and productivity comparisons across adults/children.
- [ ] `[SAFE UI]` Replace corporate wording such as `Schedule load` with family wording like `Busiest day`.
- [ ] `[LOGIC TOUCHING]` Add minimum-data thresholds. Do not generate strong conclusions from tiny datasets.
- [ ] `[SAFE UI]` Focus cards on neutral actionable information: upcoming plans, chores remaining, meals planned, unread updates, unassigned items, unpaired devices, days needing meal coverage.
- [ ] `[RISKY]` Decide whether Insights is Free, Premium, or partially Premium. If AI weekly recap exists, enforce premium server-side and label calmly.
- [ ] `[SAFE UI]` Remove duplicate preview labels and technical copy such as counts refreshing explanations.

## 11. Auth, Onboarding, And Session

- [ ] `[SAFE UI]` Add or reposition `How it works` near the top/onboarding area as an easy-to-skip slideshow/animation with a close option.
- [ ] `[RISKY]` Tester preference: remove email/password fields and use Google + Apple only. Defer until auth impact is traced because this touches login, account recovery, and existing users.
- [ ] `[RISKY]` Fix repeated login prompts/session persistence so users are not asked to log in again and again.
- [ ] `[DEFER FINAL]` Add Apple Sign-In after screen corrections and before deployment readiness.

## 12. Subscription And Deployment-Final Work

- [ ] `[RISKY]` Replace unfinished billing UI such as `Billing preview`, `No payment in this build`, `Preview`, and `View planned tiers` with a concrete current-plan state once plans are defined.
- [ ] `[RISKY]` Enforce Premium plan checks on backend for Assistant and any premium Insights/AI features.
- [ ] `[DEFER FINAL]` Add real subscription/paywall/checkout after the user provides final plan details.
- [ ] `[DEFER FINAL]` Verify EAS/TestFlight build numbers remotely. Do not infer iOS build numbers from repo files.

## Verification Checklist Per Screen

- [ ] Real iPhone test.
- [ ] Laptop phone preview with `.\scripts\open-phone-preview.ps1`.
- [ ] Small iPhone viewport.
- [ ] Common Android viewport.
- [ ] Keyboard open and dismissed.
- [ ] Dynamic font / long names / long list or recipe titles.
- [ ] Offline, loading, empty, success, failure, permission denied, role denied, and subscription denied states where applicable.
- [ ] Primary module opens at logical top.
- [ ] Entity switch opens at logical top.
- [ ] Back navigation returns to the same context correctly.
- [ ] Save confirmation names exact object and destination.
- [ ] No raw technical/developer copy visible in production UI.
- [ ] No working auth, household, child pairing, calendar, or backend flow broken.

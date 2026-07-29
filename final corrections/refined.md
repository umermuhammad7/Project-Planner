# HomeThread — Master Frontend, UX, Product Logic, and Reliability Audit Prompt for Codex

You are reviewing and improving an existing mobile application called **HomeThread**.

Do not treat this as a cosmetic redesign task. Most functionality already works, so preserve working routes, backend contracts, data models, and user flows wherever possible. However, fix incorrect logic, misleading states, broken navigation behavior, poor responsive behavior, unclear save destinations, unsafe destructive actions, inconsistent subscription enforcement, and technical language exposed to normal users.

The goal is to make HomeThread feel like a calm, trustworthy shared family thread for busy households—not a corporate project-management tool, developer dashboard, surveillance system, or childish family app.

---

## 1. Product Context

HomeThread is a mobile-first family coordination app for busy U.S. households.

### Primary users

- Parents
- Co-parents
- Caregivers
- Second adults in the household
- Children using paired child devices
- Families with mixed technical comfort and mixed phone habits

### Product promise

Help a household coordinate plans, chores, groceries, meals, family updates, reminders, and child-device access in one place without making the experience feel heavy, punitive, technical, or overly productivity-focused.

### Desired emotional tone

- Warm utility
- Calm shared-family feeling
- Plainspoken language
- Fast scanning on small phones
- Clear ownership and responsibility cues
- Trustworthy save, sync, error, and permission states
- No guilt or surveillance tone
- No corporate productivity jargon
- No childish decoration
- No developer terminology in production UI

### Important architecture constraint

Prefer low-risk improvements first:

- UI hierarchy
- spacing
- typography
- card density
- button hierarchy
- responsive behavior
- keyboard handling
- scroll behavior
- copy
- state clarity
- confirmation messages
- safer destructive actions
- consistent navigation
- consistent premium gating

Do not rewrite working backend systems unless required to fix broken product logic or a trust-critical defect.

---

# 2. Mandatory App-Wide Audit Before Editing Individual Screens

Before changing components, inspect the current implementation across navigation, state, API integration, role permissions, billing/subscription status, timestamps, notifications, and assistant routing.

Create a written internal map of:

- every primary module
- every nested screen
- every modal, sheet, and inline form
- every save destination
- every subscription-gated action
- every role-restricted action
- every destructive action
- every timestamp source
- every loading, success, empty, offline, and error state

Do not assume that labels match actual behavior. Trace the code and verify what each action really does.

---

# 3. Global Navigation and Scroll Rules

The app currently preserves incorrect scroll offsets and often opens users halfway down a screen. This problem appears across modules and must be fixed as a shared navigation rule, not with random screen-specific patches.

Implement the following policy consistently:

## Opening a primary module

When the user opens Home, Plan, Chores, Lists, Meals, Family Board, Settings, Household, or Insights from primary navigation, open the destination at its logical top.

## Switching entities inside a module

When switching between different lists, households, children, recipes, dates, or other entities, reset the destination content to the top.

Examples:

- Grocery Shopping → Concert list: start at top
- Week Plan → Recipes: start at top
- one child profile → another: start at top
- one household → another: start at top

## Back navigation

When returning through Back to the exact same screen and same entity, preserving the previous scroll position is acceptable and often desirable.

## Opening detail, create, or edit flows

Every detail view, form, modal, or bottom sheet must open at its top.

## After saving

Return the user to a meaningful place:

- new meal: relevant weekday row
- new recipe: newly saved recipe card
- new list item: added item
- new child: new child profile
- new board post: new board post at top
- new event: new event card

Briefly highlight or reveal the newly created item.

## Assistant conversation

For an existing conversation, open to the latest complete response, not an arbitrary preserved offset. For a new conversation, start at the empty-state top.

Use a shared hook, utility, navigation listener, or screen-focus policy so behavior is predictable throughout the app.

---

# 4. Global Responsive and Keyboard Rules

Audit every screen on:

- smallest supported iPhone
- standard iPhone sizes
- common Android sizes
- short screens
- large screens
- keyboard open
- dynamic font scaling
- long names and labels
- long list and recipe titles
- large household membership
- offline state
- loading state
- failed API state

Mandatory rules:

- Respect top and bottom safe areas.
- Bottom navigation must never cover content.
- Add enough scroll padding below content.
- Hide bottom navigation during focused forms, keyboard entry, destructive confirmations, and draft review when space is limited.
- Keep focused fields visible above the keyboard.
- Keep the primary action above the keyboard.
- Prevent unpredictable whole-page jumps.
- Prevent background scrolling behind modal or sheet forms.
- Avoid nested scroll views unless strictly necessary.
- Do not use fixed heights that clip text or controls.
- Use at least approximately 44×44-point touch targets.
- Support text wrapping safely.
- Never use ellipsis when it hides critical meaning without a detail view.
- Ensure selected controls remain visible.
- Restore a logical screen position after keyboard dismissal.

---

# 5. Global Visual System

The current app overuses pale beige cards, rounded containers, tiny chips, and equally weighted buttons. Create and apply a consistent design system.

## Hierarchy

Use clear levels:

1. Page title
2. Primary status or summary
3. Main action
4. Main content
5. Secondary actions
6. Technical or account details only where necessary

## Cards

Do not place every field, row, label, and action inside separate rounded cards.

Use cards for grouped content, not for every individual element.

Standardize:

- corner radius
- internal padding
- card spacing
- divider style
- shadow or no-shadow rule
- border contrast

## Buttons

Use consistent hierarchy:

- Primary: one main action per screen or state
- Secondary: supporting action
- Tertiary: text or icon action
- Destructive: separated and clearly dangerous
- Status badge: must not look clickable

Do not let Refresh, Delete, diagnostics, and core actions all look equally important.

## Typography

- Body text should generally be around 15–16 px equivalent.
- Metadata should generally not be smaller than 12–13 px.
- Improve line height.
- Increase contrast.
- Use display names instead of usernames in family-facing screens.
- Avoid unnecessary uppercase section labels.

## Color and accessibility

Keep the warm palette, but improve contrast.

Do not communicate selection, ownership, error, success, or completion through color alone. Pair color with icons, labels, checks, or other state indicators.

---

# 6. Global Copy and State Rules

Remove technical and vague language from production UI.

Do not expose phrases such as:

- server configuration
- API name
- cloud AI
- push token
- device token
- build diagnostics
- parsing error
- billing preview
- planned tiers
- no payment in this build
- counts refresh when screen opens
- household synced explanation
- live updates explanation
- save to household
- added to your list

## Every save confirmation must say

- what was saved
- where it was saved

Examples:

- Brownies saved to Recipes
- 8 ingredients added to Grocery Shopping
- Soccer practice added to Plan
- Laundry assigned to Rayyan
- Summary posted to Family Board
- Concert list created

## Loading states

Prevent repeated taps and show meaningful text:

- Adding…
- Saving…
- Updating…
- Marking done…

## Error states

Explain the user impact and next action, not internal details.

Example:

**We couldn’t update your meals.**
Try again when you’re connected.

## Normal synchronization

Normal sync should be invisible. Do not permanently display explanations about live updates or manual refresh.

Show retry only when synchronization fails. Pull-to-refresh may remain available.

---

# 7. Global Subscription and Authorization Rules

The HomeThread Assistant is available only on the Premium plan.

This must be enforced in both:

- frontend presentation
- backend authorization

Do not only hide buttons. Direct routes and API calls must also reject unauthorized access safely.

## Standard users must still have a complete usable app

Standard users should still be able to:

- create and edit plans
- manage chores
- create and use lists
- manually save recipes
- import recipes
- plan meals
- add recipe ingredients to grocery lists
- use Family Board manually
- manage household members according to role

## Premium users may receive

- Assistant access
- AI-generated recipes
- natural-language quick add
- AI summaries
- AI meal suggestions
- advanced AI insights, only if product-defined

Locked premium features must be visibly locked before interaction.

Use clear UI:

**Generate with HomeThread Assistant**
Available with Premium

Action:

**View Premium**

Do not let a free user tap a seemingly working control and receive a technical failure afterward.

---

# 8. Home Screen

The Home screen should answer one question immediately:

> What does my family need today?

## Problems to fix

- Too many sections compete equally.
- Main priority is unclear.
- Too many tiny pills.
- Text is small and low contrast.
- Bottom navigation is crowded.
- Secondary shortcuts compete with urgent content.
- Some language feels corporate, such as “needs an owner.”
- Page can look visually finished even when more content exists below.

## Recommended hierarchy

1. Greeting and today’s date
2. What needs attention
3. Quick add
4. Today’s household summary
5. People needing follow-up
6. Recent updates
7. Navigation

## Header

Use a compact greeting such as:

**Hi, Kumer**
**Tuesday, May 13**

Use a time-based greeting only if it updates reliably.

## Attention card

Replace vague copy with concrete counts and examples.

Example:

**3 things still need someone**

- School pickup at 3:15 PM
- Buy milk and bread

Action:

**Assign items**

## Assistant action

For Premium users, use a practical label:

**Add something quickly**

Example hint:

“Add soccer practice Friday at 5.”

For standard users, show a Premium lock treatment or omit the action according to product policy.

## Kids Mode

Use:

**Switch to Kid Mode**

Make clear that it changes app context. Prevent accidental entry.

## Chores and grocery summaries

Show concrete summaries:

- 2 chores remaining
- 5 grocery items left

Use clear ownership where relevant.

## Reminder language

Replace judgmental language such as “Kids who need a nudge” with:

- Needs a reminder
- Waiting on
- Check in

Avoid pressure timers unless they serve a real purpose.

## Recent alerts

Differentiate:

- informational
- needs action
- failed sync
- completed

## Quick access

Do not duplicate bottom navigation. Prefer Quick Add actions:

- Add event
- Add grocery item
- Add chore
- Post update

---

# 9. Plan Screen

The actual family plan must be the main content, not sync administration.

## Problems to fix

- Too much sync and refresh content.
- Header is too tall.
- Event list appears too low.
- Create/edit forms are cramped.
- Keyboard and bottom navigation conflict.
- Date and time pickers feel disconnected.
- Assignee states are weak.
- Event cards repeat date and time.
- Delete is too exposed.
- Technical travel-reminder error is shown.

## Recommended hierarchy

1. This week
2. Add plan
3. Coming up
4. Household context
5. Calendar connections
6. Sync errors only if needed

## Header

Use:

**This week**
**1 plan coming up**

Remove permanent live-update explanation and visible Refresh.

## Add action

Prefer:

**Add plan**

instead of formal “Add event,” unless consistency requires otherwise.

## Create/edit form

Use a dedicated modal, sheet, or focused screen.

Fields:

- What is it?
- Where? — optional
- Date
- Time — optional
- Who is involved? or Who is responsible?

Requirements:

- start at top
- hide bottom navigation
- sticky primary button above keyboard
- clear focus states
- larger assignment chips with avatar, name, and selected check
- Cancel as secondary

## Date/time pickers

Keep existing native controls if safer, but improve surrounding UI:

- Choose a date
- Choose a time
- Cancel
- Set time

Use larger controls and stronger selected states.

## Event card

Use concise hierarchy:

**Visit village**
Tue, Aug 11 · 5:26 PM
Dir
Kumer

Visible action:

**Edit** or card tap

Move Delete to overflow.

## Delete safety

Use confirmation:

**Delete “Visit village”?**
This removes it from the household plan.

Buttons:

- Keep plan
- Delete

## Travel reminders

Never show Google Maps Distance Matrix or server setup language.

Use:

**Leave-time reminders are unavailable right now.**
You can still create and manage plans normally.

## Calendar connection

Move Google Calendar connection lower or into a dedicated connections section.

Show:

- Connected
- Not connected
- Needs attention

---

# 10. Chores Screen

The Chores screen should feel like a calm household checklist, not an admin queue.

## Problems to fix

- Chore cards are too tall.
- Mark Done, Edit, and Delete are all permanently visible.
- Ownership cues are weak.
- Sync text and Refresh dominate.
- Completed chores consume too much space.
- Assignment chips are small.
- Delete confirmation is cramped.
- Keyboard behavior is unstable.

## Recommended hierarchy

1. Household chores
2. Open count
3. Add a chore
4. Still to do
5. Finished today
6. Stars
7. Sync error only if needed

## Chore card

Compress to:

**Laundry**
Rayyan · Daily · Any time
Reward: 2 stars

Actions:

- Mark as done
- overflow menu for Edit and Delete

Use clear ownership text, not initials alone.

## Completion

After marking done:

**Laundry marked done**
Undo

Move the chore into Finished after a brief success state.

## Create/edit chore form

Use focused modal or sheet.

Fields:

- What needs doing?
- Reminder time — optional
- Who should do it?
- Reward, if applicable

Helper:

**We’ll send a daily reminder at this time.**

Use larger assignee chips with names and checks.

## Finished section

Use a compact collapsed list:

**Finished today (1)**

Rows should be smaller than active chores.

## Stars

Keep rewards visually secondary and avoid making the screen feel transactional.

---

# 11. Lists Screen

The Lists screen has a major navigation defect: switching lists preserves the old scroll position. Fix this across the app.

## Core behavior

When a different list is selected:

- reset content to top
- show the selected list title immediately
- keep selected list chip visible
- clear keyboard focus unless intentionally adding an item

## Problems to fix

- Current list is not dominant enough.
- Selected list chip is too subtle.
- Top section is repetitive and too tall.
- Quick add is too form-heavy.
- New-list creation expands inline.
- Keyboard and bottom navigation conflict.
- Empty-state copy is sometimes type-inappropriate.
- Success message says “List item saved” after creating a list.
- Inbox purpose is unclear.
- Sync text and visible Refresh are unnecessary.

## Recommended hierarchy

1. Current list title
2. Remaining count
3. Horizontal list selector
4. Quick add
5. Active items
6. Completed items
7. Imported/message items, if needed

## Header

Example:

**Grocery Shopping**
**3 items left**

Overflow menu:

- Rename list
- List settings
- Delete list

## List selector

Use horizontal scrolling, strong selected state, one line per chip, and automatic scroll to selected item.

Do not wrap into multiple uneven rows.

## Quick add

Use compact input:

[ Add an item… ] [ + ]

After adding:

- show Adding…
- clear field
- show new item
- optionally retain keyboard for rapid entry
- do not jump to an unrelated offset

## Empty states

Use neutral copy:

**Nothing here yet**
Add the first item to get this list started.

Use type-specific copy only when accurate.

Never show shopping language for Concert, To-do, or Custom lists.

## New-list flow

Use modal or sheet:

**New list**

- List name
- List type
- Create list
- Cancel

After save:

**Concert created**

## Inbox/imported items

Clarify purpose. If these are messages captured for review, say:

**Items captured from messages**
Review and move them into a shared list.

Provide explicit actions:

- Add to list
- Choose list
- Dismiss

Do not mix imported suggestions with normal list items without explanation.

---

# 12. Assistant Screen

The Assistant is Premium-only and currently has critical product-logic defects.

Do not only restyle it. Trace intent classification, result rendering, save actions, destinations, and subscription authorization.

## Critical defects

- Weather questions are incorrectly becoming event drafts or Plan items.
- Recipe generation says it was added before the user actually saves it.
- Recipe destination is unclear.
- “Saved to household” is vague.
- Location may be assumed without explanation.
- Repeated prompt forms make the screen long and unstable.
- Confidence percentages are unexplained.
- Cloud AI and technical labels are exposed.
- Long recipe content is trapped inside embedded cards.

## Response type model

Every Assistant response must clearly be one of:

### Informational answer

Examples:

- weather
- recipe explanation
- household question

No save required.

### Suggested action

Examples:

- create plan
- create chore
- add grocery items
- post family update

Requires user review and explicit approval.

### Saved action

Must clearly state what was saved and where.

## Weather behavior

For:

**What is the weather like today?**

Return an informational weather card.

Show:

- location
- condition
- current temperature
- high/low
- rain chance
- brief advice

Do not create a Plan item unless the user explicitly asks for an event, reminder, or plan.

If location is unknown, ask for city or use an authorized household/device location and display it clearly.

Audit where the current city value comes from. Remove hardcoded defaults.

## Recipe behavior

1. Generate unsaved recipe preview.
2. User reviews.
3. User chooses Save to Meals.
4. Recipe appears under Meals → Recipes.
5. User may separately choose Add ingredients to groceries.
6. User selects destination grocery list and reviews ingredients.

Correct confirmations:

- Brownies saved to Recipes
- 8 ingredients added to Grocery Shopping

Never say the recipe was added before save completes.

## Assistant layout

Use:

- compact header
- conversation content
- one sticky composer at bottom

Remove repeated embedded prompt forms.

Composer:

**Ask HomeThread…**

Hide bottom navigation while keyboard is open or draft review is active.

## Draft cards

Only create structured drafts for explicit action requests.

Example:

**New plan**
Soccer practice
Friday · 5:00 PM
Unassigned

Actions:

- Edit
- Add to Plan

Remove unexplained confidence percentages. When uncertain, explain the uncertainty in plain language.

## Long content

Show concise recipe preview and open a dedicated detail view for full ingredients and instructions.

---

# 13. Meals Screen

The Meals screen currently combines too many workflows on one long page. Separate it into two clear views while preserving backend behavior.

## Primary structure

Use a real segmented control or tabs:

**Week Plan | Recipes**

### Week Plan contains

- current week and date range
- plan a meal
- compact Monday–Sunday rows
- meal coverage
- add week’s ingredients to groceries

### Recipes contains

- saved recipes
- import recipe
- save manually
- Premium: Generate with Assistant

## Standard vs Premium

Meals must remain useful without Assistant.

Standard users can:

- plan meals
- save recipes manually
- import recipes
- edit recipes
- add ingredients to groceries

Premium users additionally get AI recipe generation and meal suggestions.

## Week rows

Replace ambiguous “Open” with:

**No meal planned**

Use compact rows:

**Monday**
No meal planned   Add

Do not let seven empty days create excessive vertical length.

## Plan-a-meal flow

Use focused modal or sheet.

Clearly separate:

- choose saved recipe
- enter custom meal

Fields:

- Recipe or meal name
- Which days? Select one or more.
- Meal type

Use strong selected states with checks.

Warn before replacing an existing meal.

After save:

**Brownies added to Monday snack**

## Recipe cards

Use:

**Fries**
2 ingredients

Visible actions:

- View recipe
- Add ingredients

Move Edit and Delete into overflow.

## Recipe detail

Show:

- title
- ingredients
- instructions
- prep time
- cook time
- servings
- notes
- source
- Add ingredients to groceries
- Add to Week Plan

Inspect the existing schema before migrations. Preserve compatibility.

## Add ingredients to groceries

Do not blindly add everything.

Show review sheet:

- ingredient list
- remove items already at home
- edit quantity
- avoid obvious duplicates where safe
- choose destination grocery list
- confirm

Then show:

**5 ingredients added to Grocery Shopping**

## Add week’s ingredients

Collect ingredients only from linked recipes.

Show review and clearly report skipped custom meals:

**2 planned meals did not include ingredients and were skipped.**

## Import recipe

Replace “Parse recipe” with:

**Review recipe**

Tabs:

- Paste recipe
- From a link

After extraction, show editable review before saving.

Safe error:

**We couldn’t read that recipe. Try pasting the recipe text instead.**

## Forms

Move Plan Meal, Import Recipe, Save Manually, and Edit Recipe into focused keyboard-safe flows.

---

# 14. Family Board

The Family Board currently has no clear primary purpose. Define it as:

> A shared household update feed for announcements, handoff notes, summaries, and important family changes.

It must not primarily look like an import utility or raw system activity log.

## Main screen hierarchy

1. Family Board heading
2. Post an update
3. Pinned updates, if supported
4. Recent family updates
5. Import family text as a secondary action

The feed must appear before import tools.

## Remove Send with SMS

Remove from Family Board:

- Send with SMS button
- SMS helper text
- SMS loading, success, and permission flows

Do not expose SMS here.

## Remove vague Paste / Review / Save pills

Unless these are a true interactive stepper, remove them.

Use a clear import flow:

1. Paste or type family text
2. Review interpretation
3. Edit result
4. Confirm destination
5. Perform destination-specific action

## Destination-specific actions

Never use “Save to household.”

Use:

- Post to Family Board
- Add to Plan
- Create chore
- Add to Grocery Shopping
- Save to Meals

## Classification

Text such as:

**Rayyan, where are you?**

must not automatically become a list item.

It should be treated as:

- a message
- a possible board post
- non-actionable text

User must be able to change the suggested destination before saving.

Routing examples:

- Pick Grandma up at 4 PM → Plan or Chore
- We need eggs, milk, and bread → Grocery list
- Dinner is pasta tonight → Meal plan or Board
- School is closed tomorrow → Board or Plan note

## Summary behavior

A summary must be generated from pasted content, shown in an editable preview, and posted only after explicit approval.

Example:

**Today’s family update**

- Rayyan will pick Grandma up at 4 PM.
- Groceries are planned between 3–4 PM.
- The village visit is planned between 5–6 PM.

Actions:

- Edit summary
- Post to Family Board
- Cancel

After posting:

**Summary posted to Family Board**

Action:

**View post**

## Feed content

Separate:

### Family Board

- announcements
- handoff notes
- summaries
- meaningful cross-module updates

### Activity History

- recipe saved
- list created
- chore completed
- routine system events

Do not mix all raw activity into the main family feed.

## Timestamps

Fix the repeated “Now” defect.

Persist exact timestamps. Never permanently store the word Now.

Formatting:

- under 60 seconds: Now
- under one hour: 2 min ago
- earlier today: 7:42 PM
- yesterday: Yesterday, 5:15 PM
- older: Jul 12, 4:30 PM

Use user-local timezone.

Trace:

- createdAt
- updatedAt
- server timezone
- database serialization
- client parsing
- relative-time formatter
- missing-date fallback

If missing, omit time or show Time unavailable. Do not falsely show Now.

Keep event time in post body separate from post creation time.

---

# 15. Settings

Settings currently mixes normal preferences, developer tools, notifications troubleshooting, household shortcuts, and dangerous account controls.

## Recommended structure

### Account

- Profile photo
- Display name
- Email
- Sign-in method

### Notifications

- Event reminders
- Chore reminders
- Family updates
- Daily summary

### Household

- Manage household
- Manage child profiles

### Subscription

- Current plan
- View Premium
- Manage billing

### Support

- Help
- Privacy
- Terms
- App version

### Danger Zone

- Sign out
- Delete account

## Profile

If email is managed by Google, show it as read-only, not as an editable input.

Show:

**Sign-in method**
Google

**Password and account security are managed by Google.**

Disable Save Profile until changes exist.

After save:

**Profile updated**

Verify photo upload, crop, persistence, replacement, and removal.

## Notifications

Remove:

- Refresh push token
- device token
- token registration language

Use clear states:

- Notifications are on
- Notifications are off in device settings
- We couldn’t finish setting up notifications

Repair action:

**Try again** or **Open settings**

Add descriptions for each toggle.

Daily summary should include a delivery time.

## Diagnostics

Hide build diagnostics, test controls, and internal details in production. Put them behind a debug flag or hidden developer mode.

## Delete account

Use dedicated protected flow.

Explain:

- what is deleted
- household ownership consequences
- child-device consequences
- subscription consequences
- shared data consequences

Require explicit confirmation and re-authentication where supported.

---

# 16. Household

The Household screen is overcrowded and exposes too many codes and administrative actions at once.

## Recommended structure

### Household Overview

- household name
- current plan
- member count

### Adults

- adult member list
- invite adult

### Children

- child profiles
- add child
- device status

### Pairing

Open only when needed.

### Permissions and Ownership

- roles
- transfer ownership
- leave household

### Subscription

- current plan
- View Premium
- manage billing

## Household name

Edit in a focused modal:

**Edit household name**

- Cancel
- Save

Do not expand inline.

## Adult invitations

Do not permanently expose invite codes as the main content.

Use:

**Invite an adult**

Explain:

**This code gives another adult access to the household.**

Actions:

- Copy invite code
- Share invite
- Create new code

Show expiry.

Before replacing code:

**Create a new invite code?**
The current code will stop working.

## Child pairing

Replace “KC code” in UI with:

**Child pairing code**

Explain steps:

1. Open HomeThread on the child’s device.
2. Choose Join as child.
3. Enter this code.
4. Keep this screen open until pairing completes.

Show clear expiry and expired states.

Use:

**Create pairing code**

not ambiguous Pair Device when the action only generates a code.

## Child profiles vs devices

Clearly distinguish:

- child profile
- paired device

Example:

**Rayyan**
Child profile
No device paired

Action:

**Pair a device**

or:

**1 device paired**
**Manage devices**

Move Rename and Remove into overflow.

Confirm removal and explain data effects.

## Roles

Verify Owner, Admin, Adult, and Caregiver behavior against backend permissions.

Explain role meaning in UI.

## Leaving household

Verify rules before enabling action.

If the user is the only owner, require ownership transfer first and disable Leave Household until valid.

Explain effects on child profiles, billing, and shared data.

## Subscription UI

Remove unfinished text:

- No payment in this build
- Billing preview
- Preview
- Planned tiers

Use a real current-plan state and real premium entitlement checks.

---

# 17. Insights

Insights should be a calm, family-safe summary of what needs attention. It must not rank, judge, or surveil household members.

## Remove or replace

- Top helper
- Most involved
- Best performer
- Least active
- Schedule load
- engagement ranking
- activity competition

These labels can create guilt, sibling comparison, co-parent conflict, and misleading conclusions.

## Better purpose

Answer:

> What needs attention this week?

## Recommended structure

### This Week

- upcoming plans
- chores remaining
- meals planned
- unread updates

### Needs Attention

- plans without an owner
- days without meals
- unpaired child devices
- overdue chores
- pending imported items

### Household Activity

Use neutral facts only:

- Rayyan completed 1 chore
- Kumer completed 1 chore

No ranking.

### Coming Up

- Wednesday is the busiest day
- 1 event scheduled

## Minimum-data thresholds

Do not generate strong conclusions from tiny datasets.

When insufficient:

**More household activity is needed before trends are available.**

## Premium policy

Define whether Insights is:

- Free
- Premium
- partially Premium

Possible safe model:

- Free: simple weekly counts
- Premium: AI-generated weekly recap and deeper trends

Enforce server-side.

## Remove technical copy

Remove:

- Counts refresh each time you open Insights
- Preview labels unless genuinely beta and explained

---

# 18. Cross-Module Save Destination Rules

Implement explicit routing rules and verify actual persistence.

## Assistant recipe

Assistant preview → Save to Meals → Meals/Recipes

Optional separate action → Add ingredients to selected Grocery list

## Weather

Assistant informational result only

No Plan item unless explicitly requested

## Plan request

Assistant reviewable draft → Add to Plan

## Chore request

Assistant reviewable draft → Add to Chores

## Grocery request

Assistant reviewable draft → selected list in Lists

## Family update

Assistant or imported text → review → Post to Family Board

## Meal suggestion

Assistant preview → Save to Recipes or Add to Week Plan after explicit user choice

Every destination must be named in the action and confirmation.

---

# 19. Timestamps and Timezones Across the App

Audit all timestamps, not only Family Board.

Verify:

- events
- chores
- board posts
- alerts
- imported messages
- recipe creation
- household invitations
- pairing codes
- notification times

Requirements:

- store exact timestamps
- use correct server timezone
- convert to user-local timezone
- separate event time from creation time
- use relative time only when appropriate
- never default missing timestamp to Now
- ensure date/time formatting is consistent across iOS and Android

---

# 20. Destructive Action Safety

Audit every destructive action:

- delete plan
- delete chore
- delete list
- delete recipe
- remove child
- leave household
- regenerate invite code
- delete account

Requirements:

- do not permanently expose Delete beside the primary action
- move secondary destructive actions to overflow where appropriate
- use confirmation dialog or sheet
- name the affected item
- explain consequences
- disable while processing
- provide Undo where safely possible
- do not use vague labels such as Keep when Cancel is clearer

---

# 21. Loading, Empty, Offline, and Failure States

Every module must support:

- initial loading
- pull-to-refresh
- mutation loading
- success
- empty state
- offline state
- partial failure
- permission failure
- server failure
- expired code
- subscription denied
- role denied

Do not show blank screens or raw errors.

Use user-safe language and clear next actions.

---

# 22. Final Implementation Priorities

Work in this order.

## Priority 1 — Trust-critical logic

- Fix weather becoming a Plan item.
- Fix recipe save-state contradictions.
- Define and verify recipe destinations.
- Fix Family Board summary behavior.
- Remove Save to Household wording.
- Fix repeated Now timestamps.
- Enforce Premium Assistant access frontend and backend.
- Remove technical production copy.
- Fix invite and account safety flows.

## Priority 2 — App-wide navigation and layout

- Implement global scroll policy.
- Fix keyboard-safe behavior.
- Hide bottom navigation during focused flows.
- Replace unstable inline forms.
- Ensure new screens and entities open at top.

## Priority 3 — Screen hierarchy and density

- Compress cards.
- Reduce duplicate content.
- Remove unnecessary sync status.
- Improve typography and contrast.
- Standardize actions and selected states.

## Priority 4 — Polish and accessibility

- Dynamic type
- tap targets
- focus states
- screen reader labels
- contrast
- long-text behavior
- animations and transitions

---

# 23. Required Deliverables From Codex

Before making broad changes, produce:

1. A concise audit of actual existing behavior versus intended behavior.
2. A list of trust-critical defects.
3. A list of shared components and utilities that should be fixed once and reused.
4. A file-by-file implementation plan.
5. A list of backend or schema changes that are truly required.
6. A list of changes that can remain frontend-only.
7. A subscription and role authorization matrix.
8. A save-destination matrix for Assistant and cross-module actions.
9. A timestamp and timezone audit.
10. A test plan for small devices, keyboard states, offline states, free users, premium users, owners, adults, caregivers, and child devices.

Then implement in small, reviewable stages.

Do not perform a single uncontrolled visual rewrite.

After each stage:

- run the app
- verify current working flows
- test on small-screen dimensions
- check keyboard behavior
- check back navigation
- check scroll reset/restoration
- confirm save destination
- confirm success message
- confirm premium and role enforcement
- confirm no technical copy leaks to users

---

# 24. Definition of Done

The work is complete only when:

- every primary screen opens at a logical position
- switching entities starts at the top
- Back returns to the previous context correctly
- forms fit on small screens
- keyboard never hides primary actions
- bottom navigation never obstructs focused workflows
- every save confirmation names the object and destination
- weather never becomes a Plan item without explicit user intent
- recipes save to Meals and ingredients can be reviewed before grocery insertion
- Family Board has a clear purpose and usable summaries
- SMS is removed from Family Board
- timestamps are real and correctly formatted
- Premium Assistant is enforced in frontend and backend
- standard users retain complete non-AI functionality
- technical and developer copy is absent from production UI
- destructive actions are protected
- role and ownership rules are enforced before action
- UI uses consistent spacing, typography, cards, buttons, status, and contrast
- the app feels calm, family-friendly, trustworthy, and easy to scan

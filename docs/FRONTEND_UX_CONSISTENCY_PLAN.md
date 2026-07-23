# HomeThread Frontend UX Consistency Plan

This document is the working source of truth for the final frontend consistency pass.

The app is close to ready. Test coverage and core flows exist, and broad security hardening can come later. The current priority is user experience, usability engineering, and visual consistency across every mobile screen.

## Owner Concern And Goal

This file must stay centered on the owner's main product concern: HomeThread works, but the user experience and user interaction are not yet consistent, easy, calm, polished, and obvious screen by screen.

The goal is to improve the app 10/10 by 10/10:

- Take every screen from "functional but inconsistent" to "clear, polished, and user-safe."
- Treat tiny details as real user experience quality: spacing, button weight, header behavior, app bar behavior, copy, icon choice, widget density, and content alignment.
- Fix root causes through shared chrome and shared primitives before repeating one-off screen fixes.
- Preserve working functionality while making the interface feel trustworthy for normal families.
- Judge every change by whether a busy parent, caregiver, second adult, or child can understand what to do without explanation.

## Source Owner Prompt

This plan is based on the owner's second prompt to Codex:

```text
This app is almost ready. The test cases for its working, and security is a later thing. Right now I am fixing inconsistencies.

There are too many widgets and modules within modules. The app has changing buttons, introduced emojis and color changes, spacing issues within each module and widget, and even in the content inside it. Now it is about figuring out the smallest details.

A big inconsistency is the fixed headers for each screen. Similarly, at the bottom of the screen the app bar shows for some screens and not for others.

Now it is the entire app, screen by screen. I am trying to make the app easy for users to use, with high priority on user experience, user interaction, and usability engineering principles.

I want a discussion on this with Claude, with prompts and a special document, so we can fix this frontend work once and for all.
```

## Main Concerns To Improve To 10/10

Use this list as the north star for Claude reviews and implementation work.

1. Header consistency: every screen needs a predictable title, back/close behavior, and pinned-header rule.
2. Bottom app bar consistency: users should understand when app navigation is available and never have it interfere with forms or focused tasks.
3. User interaction clarity: buttons, controls, tabs, chips, forms, and navigation should behave consistently and make the next action obvious.
4. Module and widget density: remove the feeling of widgets inside widgets and cards inside cards.
5. Button hierarchy: primary, secondary, tertiary, destructive, and status controls must look different.
6. Emoji and icon discipline: avoid random emoji-driven controls; use consistent icons and keep warmth without visual noise.
7. Color consistency: keep the warm HomeThread feel, but make contrast, selected states, success, error, and warning states consistent.
8. Spacing and alignment: every card, row, header, pill, input, and section should feel measured and intentional.
9. Content inside widgets: text should wrap, breathe, and prioritize the information users need first.
10. Screen-by-screen usability: every primary and nested screen should be easy to scan, safe to act on, and comfortable on small phones.

## Current Problem

HomeThread has accumulated inconsistent screen patterns:

- Some screens use `ScreenHeader`; others build custom local headers.
- Some screens rely on fixed pinned headers from `apps/mobile/App.tsx`; others render their own header inside scroll content.
- The bottom app bar appears for primary tab screens, but not consistently for nested screens, focused workflows, keyboard entry, or modal-like flows.
- Buttons, pills, emojis, colors, spacing, cards, and widget density vary by screen.
- Some modules contain too many modules inside modules, creating stacked rounded cards and weak hierarchy.
- Content inside widgets often has inconsistent padding, type size, wrapping, and action placement.
- Production-facing copy sometimes feels technical, vague, or unfinished.
- Users need the app to feel calm, obvious, and easy to use without learning the structure.

## Product Principle

HomeThread should feel like a calm shared family thread, not a project-management dashboard.

Every screen should answer:

- What is this screen for?
- What matters most right now?
- What can I safely do next?
- Did my action work, and where did it go?

## Non-Goals For This Pass

- Do not start broad backend/security hardening unless a frontend flow is impossible to make honest without it.
- Do not redesign the product from scratch.
- Do not introduce a new design framework.
- Do not add new dependencies for ordinary layout, spacing, icons, or buttons.
- Do not rewrite working data flows just to polish UI.

## App-Wide UX Contract

### Headers

Create one explicit screen-header policy before changing individual screens.

Recommended rule:

- Primary tabs use one compact top header pattern.
- Pinned headers are used only when the screen genuinely benefits from persistent context while scrolling.
- Nested screens use a consistent `ScreenHeader` back/close pattern.
- A screen should not have both a pinned app-level header and a large duplicate in-content title.
- Header titles should be literal and stable: `Home`, `This week`, `Chores`, `Lists`, `Meals`, `Family Board`, `Settings`, `Household`, `Insights`.
- Header metadata should be short and useful, such as `3 chores left`, not sync explanations.

Immediate audit targets:

- `apps/mobile/App.tsx`
- `apps/mobile/src/components/ScreenHeader.tsx`
- `apps/mobile/src/screens/HomeScreen.tsx`
- `apps/mobile/src/screens/ChoresScreen.tsx`
- `apps/mobile/src/screens/FamilyScreen.tsx`
- `apps/mobile/src/screens/ThreadScreen.tsx`
- `apps/mobile/src/screens/MealsScreen.tsx`
- `apps/mobile/src/screens/PlanScreen.tsx`
- `apps/mobile/src/screens/ListsScreen.tsx`

### Bottom App Bar

Create one bottom-bar visibility policy.

Recommended rule:

- Show the bottom app bar only on primary browsing screens.
- Hide it during focused creation/edit flows.
- Hide it while the keyboard is open if it reduces available space or risks accidental navigation.
- Hide it for child device mode, onboarding, pairing, full-screen nested flows, destructive confirmations, and review flows.
- Never let the bottom app bar cover content or primary actions.

Primary browsing screens:

- Home
- Plan
- Chores
- Lists
- More hub

Nested or focused screens where bottom bar should usually be hidden:

- Meals
- Family Board
- Assistant
- Settings
- Household
- Insights
- Calendar sync
- Child device setup
- Kids mode
- Any create/edit/review form

### Buttons And Actions

Every screen should have a clear action hierarchy:

- One primary action per screen state.
- Secondary actions should be visually quieter.
- Destructive actions should be separated and confirmed.
- Status badges must not look tappable.
- Icon-only controls need accessible labels and conventional icons.
- Avoid using emoji as buttons where Ionicons already provides a clear icon.

Preferred labels:

- `Add plan`, not `Add event`, if the action is family-facing.
- `Post update`, not `Send with SMS`, for Family Board.
- `Create pairing code`, not `Pair device`, if the action generates a code.
- `Try again`, not `Refresh push token`.
- `Saved to Recipes`, `Added to Grocery Shopping`, `Posted to Family Board`, not `Saved to household`.

### Cards, Widgets, And Modules

Use fewer nested cards.

Recommended rule:

- Page sections do not need card backgrounds.
- Cards are for individual repeated content: event, chore, list item, recipe, member, board post.
- Forms should not expand inline inside long pages when the keyboard is involved.
- Replace multi-card modules with clear rows, dividers, compact controls, and focused sheets/screens.
- Keep card radius, padding, border, and shadow consistent through `Primitives.tsx`.

### Spacing And Content Density

Use a predictable spacing rhythm:

- Screen section gap: `spacing.lg` or `spacing.xl`.
- Card internal padding: usually `spacing.md`.
- Row gap: `spacing.sm` or `spacing.md`.
- Keep text aligned to a consistent left edge.
- Avoid stacking tiny pills above dense body copy.
- Keep touch targets at least 44px.
- Long names, recipe titles, list names, and household names must wrap without breaking layout.

### Color And Emoji

Use color for meaning, not decoration.

Recommended rule:

- Keep the warm HomeThread palette, but improve contrast.
- Use colors consistently: primary action, success, warning, destructive, selected, neutral.
- Do not make each module invent its own color language.
- Replace scattered emoji controls with shared icon components when possible.
- Emoji can remain as friendly decorative accents only when consistent, non-critical, and not doing interaction work.

### Copy

Normal users should not see technical or unfinished product language.

Remove or hide production copy like:

- `Cloud AI`
- `device token`
- `Refresh push token`
- `build diagnostics`
- `billing preview`
- `planned tiers`
- `no payment in this build`
- `KC code`
- raw backend errors
- permanent live sync explanations

Every success message must name the object and destination.

Examples:

- `Soccer practice added to Plan`
- `Laundry assigned to Rayyan`
- `Brownies saved to Recipes`
- `8 ingredients added to Grocery Shopping`
- `Summary posted to Family Board`

## Screen-By-Screen Pass Order

Work in this order to fix shared patterns before tiny screen details.

1. Shared chrome: `App.tsx`, `ScreenHeader`, `Primitives`, keyboard/bottom-bar rules.
2. Home: first impression, bottom nav, attention hierarchy, quick actions.
3. Plan: header consistency, add/edit form, event cards, calendar sync placement.
4. Chores: card density, completed/open split, assignment clarity.
5. Lists: list selector, scroll reset, quick add, empty states.
6. More hub: make it a clean launcher instead of another dashboard.
7. Meals: split Week Plan and Recipes, reduce long inline forms.
8. Family Board: define feed-first purpose, clean import/review flow.
9. Assistant: Premium-only presentation, one composer, clear result types.
10. Settings: group account, notifications, household, subscription, support, danger zone.
11. Household: adults, children, pairing, permissions, subscription, leave flow.
12. Insights: remove ranking tone, focus on needs-attention summary.
13. Child/Kids flows: verify simple, safe, context-specific chrome.

## Acceptance Checklist Per Screen

- Screen opens at the logical top.
- Header matches the global header policy.
- Bottom app bar visibility matches the global bottom-bar policy.
- Primary action is obvious.
- Secondary actions are quieter.
- Destructive actions are not casually exposed.
- Forms are keyboard-safe.
- No app bar or keyboard covers the primary action.
- Text wraps cleanly with long names and long titles.
- Empty, loading, success, failure, offline, permission denied, and subscription denied states are present where relevant.
- Cards and widgets use consistent radius, padding, spacing, and border.
- Status pills do not look like buttons.
- No raw technical copy is visible in production UI.
- Save confirmation says exactly what changed and where it went.
- Dynamic font and small phone layout remain usable.

## Claude Discussion Workflow

Use Claude as an outside reviewer, not as the implementer. Ask Claude to challenge structure, hierarchy, and usability risks. Bring the response back here, then we will merge Claude's strongest points into this plan before editing.

### Prompt 1: Outside UX Diagnosis

```text
You are Claude acting as an independent senior mobile UX reviewer.

Review this HomeThread frontend cleanup plan and challenge it.

Context:
- HomeThread is an Expo React Native family coordination app.
- The app is nearly ready and many tests already exist.
- Security hardening is a later phase unless a frontend flow is dishonest or unsafe without it.
- Current priority: remove inconsistencies across screens, headers, bottom app bar, widgets, cards, spacing, buttons, colors, emojis, and user-facing copy.
- Product goal: calm, trustworthy, easy-to-use family app for busy households, not a project manager, developer dashboard, or childish toy.

Please review the plan in docs/FRONTEND_UX_CONSISTENCY_PLAN.md and inspect the relevant files read-only:
- apps/mobile/App.tsx
- apps/mobile/src/components/ScreenHeader.tsx
- apps/mobile/src/components/Primitives.tsx
- apps/mobile/src/constants/theme.ts
- apps/mobile/src/screens/*.tsx
- DESIGN.md
- final corrections/FINAL_TODO.md

Give:
1. The top 10 UX inconsistencies we must fix first.
2. Any wrong assumptions in the plan.
3. The best global header policy.
4. The best bottom app bar visibility policy.
5. The smallest shared component changes that would reduce inconsistency most.
6. Screen-by-screen risks where a local redesign could break usability.
7. A recommended implementation order.

Do not suggest a total rewrite. Prioritize small, high-leverage frontend changes.
```

### Prompt 2: Header And Bottom Navigation Deep Dive

```text
You are Claude reviewing only HomeThread's screen chrome.

Focus on fixed headers, in-content headers, Back/Close behavior, nested screens, and bottom app bar visibility.

Inspect read-only:
- apps/mobile/App.tsx
- apps/mobile/src/components/ScreenHeader.tsx
- apps/mobile/src/screens/*.tsx

Questions:
1. Which screens currently have duplicate or inconsistent headers?
2. Which screens should use a pinned header, normal header, compact nested header, or no header?
3. When exactly should the bottom app bar show or hide?
4. What is the smallest implementation pattern that makes this consistent?
5. What edge cases should be tested on a small phone and with the keyboard open?

Return a concrete policy table by screen:
- screen
- header type
- bottom bar visible?
- reason
- implementation note
```

### Prompt 3: Component System Cleanup

```text
You are Claude reviewing HomeThread's shared frontend components.

Focus only on reducing visual inconsistency through small shared component changes.

Inspect read-only:
- apps/mobile/src/components/Primitives.tsx
- apps/mobile/src/components/ScreenHeader.tsx
- apps/mobile/src/components/DateField.tsx
- apps/mobile/src/components/TimeField.tsx
- apps/mobile/src/constants/theme.ts
- apps/mobile/src/screens/*.tsx

Find:
1. Which components should become the source of truth for cards, buttons, pills, rows, section headings, form fields, and icon actions.
2. Where screens are bypassing shared primitives and creating one-off styles.
3. Which emoji controls should be replaced with Ionicons.
4. Which style tokens need adjustment for spacing, radius, contrast, and typography.
5. The minimum shared changes that will improve the whole app without breaking flows.

Return a file-by-file plan, but keep it frontend-only unless absolutely necessary.
```

### Prompt 4: Screen-By-Screen Usability Audit

```text
You are Claude auditing HomeThread screen by screen for usability.

Product context:
- Family coordination app.
- Busy parents and caregivers.
- Phone-first, one-handed use.
- Warm, calm, trustworthy.
- No developer copy, no corporate productivity tone, no childish decoration.

Inspect all mobile screens read-only.

For each screen, report:
1. What the user is trying to do.
2. What currently gets in the way.
3. Header/bottom-bar problems.
4. Spacing/widget/card density problems.
5. Button hierarchy problems.
6. Emoji/color inconsistency problems.
7. Copy problems.
8. Smallest safe fix.
9. What to test after the fix.

Screens:
- Welcome
- Home
- Plan
- Chores
- Lists
- More
- Meals
- Family Board / Thread
- Assistant
- Settings
- Household / Family
- Insights
- Kids Mode
- Child Device Setup
- Child Device Shell
- Calendar Sync

Do not recommend broad backend rewrites. Keep the focus on frontend consistency and user confidence.
```

### Prompt 5: Adversarial Challenge Before Implementation

```text
You are Claude acting as an adversarial product/UX reviewer.

Try to break this proposed HomeThread frontend cleanup before we implement it.

Look for:
- places where a global header rule could make a screen worse
- places where hiding the bottom app bar could trap users
- places where removing inline forms could slow down common tasks
- places where reducing cards could hurt scanability
- places where replacing emoji with icons could make the app feel colder
- places where copy changes could become less clear
- places where screen-by-screen polish could accidentally create new inconsistency
- places where we are ignoring accessibility, dynamic type, keyboard behavior, or small-phone constraints

Return:
1. The strongest objections.
2. The plan changes you recommend.
3. What should be decided before implementation.
4. What can safely be implemented immediately.
```

## Claude Response Log

Paste Claude responses below this line as they come back.

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

## Initial Codex Recommendation

Do not start by editing every screen. Start with the app shell and shared primitives:

1. Define header and bottom-bar policies in `App.tsx`.
2. Normalize `ScreenHeader` so nested screens have one predictable title/action layout.
3. Normalize `Primitives.tsx` for card spacing, button hierarchy, pill behavior, and icon button behavior.
4. Replace the most visible emoji-as-control cases with Ionicons.
5. Then move screen by screen, starting with Home, Plan, Chores, and Lists because those establish the daily-use patterns.

The likely highest-leverage first code change is a shared chrome pass: consistent pinned header use, bottom-bar hiding during focused flows, and a smaller set of reusable action styles. That should make the rest of the screen-by-screen polish much less chaotic.

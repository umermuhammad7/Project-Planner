# HomeThread Design System

## Product

HomeThread is a family coordination app for busy U.S. households in 2026. The experience should feel closer to a calm shared text thread than a corporate project manager: fast to scan, forgiving, and useful while someone is standing in a school pickup line or grocery aisle.

## Aesthetic

Warm utility. Clean enough for repeated daily use, soft enough for parents, kids, caregivers, and co-parents to trust it. The app should avoid productivity-tool severity and avoid childish decoration. Use clear hierarchy, friendly copy, and visible ownership cues.

## Name And Voice

- App name: HomeThread
- Tagline: Keep the day moving together.
- Voice: concise, reassuring, plainspoken
- Avoid: guilt, surveillance language, novelty AI language, and anything that makes chores feel punitive

## Typography

- Primary app font: system font by default for fast Expo startup
- Production target font: DM Sans
- Headings: 700 weight, compact line height
- Body: 400 to 500 weight
- Captions: 500 weight, high contrast enough for outdoor phone use

## Color

```ts
export const colors = {
  ink: "#172033",
  muted: "#667085",
  canvas: "#F7F4EF",
  surface: "#FFFFFF",
  line: "#E7E0D6",
  primary: "#3157D5",
  primarySoft: "#E7ECFF",
  coral: "#F9735B",
  coralSoft: "#FFE8E2",
  mint: "#2DAA84",
  mintSoft: "#DFF7EE",
  gold: "#F4B740",
  goldSoft: "#FFF3CF",
  berry: "#A85576",
  sky: "#3A91C9"
};
```

## Layout

- Use full-width mobile sections, not nested cards
- Cards are for individual pieces of family information only
- Use 8px spacing increments
- Minimum touch target: 44px
- Primary actions should be thumb-reachable
- Text must remain readable on small phones and in bright environments

## Components

- Today rail: a compact sequence of time-sensitive family items
- Member chips: avatar initials plus color dot
- Digest card: generated text that can be sent by SMS
- Quick add: one field that accepts natural family language
- Status strips: offline, pending sync, invite copied, or text ready states
- Empty states: one practical CTA, not illustration-heavy filler

## Texting Experience

Texting is a first-class interaction. Families should be able to:

- Send a daily digest to a family SMS thread
- Paste a text such as "soccer at 5 Friday" and turn it into a plan item
- Share grocery list updates without forcing every relative to install the app immediately
- Keep app notifications and human text updates consistent in tone

## Accessibility

- Never communicate ownership through color alone
- Keep body text at 15px or larger
- Use strong contrast for time, assignee, and due status
- Avoid tiny icon-only controls unless the icon is conventional and labeled for accessibility

## Change Log

| Date | Change | Reason |
|---|---|---|
| 2026-05-26 | Initial design system created | Derived from the FamilySync handoff and adjusted for a texting-first family MVP |

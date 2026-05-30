# HomeThread Deployment Checklist

This checklist covers the remaining work needed to turn the current repo into a real deployed product.

It is intentionally honest:
- many core product features are implemented
- several launch-critical steps still require external setup
- some foundations in the repo are not the same thing as a live production integration

Use this file as the launch runbook.

## 1. What Is Already Ready In The Repo

These are already implemented in code:

- Auth/session foundation
- Family creation, join, invite, and household management
- Home / Plan / Chores / Lists / Meals / Thread / Kids mode / Insights screens
- AI assistant, meal suggestions, recipe import foundation
- Google connect foundation and manual calendar import/sync
- Offline queue + replay foundation
- Realtime subscription foundation
- Notification registration/preferences foundation
- Notifications inbox foundation
- Daily digest foundation
- Subscription / RevenueCat backend foundation
- EAS config foundation

What is **not** fully live just because code exists:

- Real push delivery
- Real app-store purchases
- Real hosted Realtime events
- Real widget extensions
- Final app store submission

## 2. Recommended Execution Order

Do these in this order:

1. Deploy the backend to a real reachable host
2. Create/set production environment variables
3. Point mobile builds at the real backend URL
4. Verify Supabase auth + Realtime on the hosted stack
5. Verify Google OAuth callback on deployed backend
6. Set up push credentials
7. Set up RevenueCat/store products
8. Run preview/internal builds
9. Run device QA
10. Submit to TestFlight / Play internal

## 3. Backend Hosting

You need one real backend host for `apps/backend`.

Examples:
- Railway
- Render
- Fly.io
- VPS / Docker if you prefer

Requirements:
- public HTTPS URL
- Postgres database
- environment variable support
- outbound internet access

You will eventually need a live API URL like:

```text
https://api.your-domain.com/api/v1
```

## 4. Production Backend Environment Variables

Set these on the deployed backend host.

### Required for core app

```env
DATABASE_URL=
NODE_ENV=production
PORT=3000
FRONTEND_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Notes:
- `FRONTEND_URL` should point to your final app/web entry if you use it for callbacks or future links
- `SUPABASE_SERVICE_ROLE_KEY` is backend-only

### Required for AI features

```env
OPENAI_API_KEY=
GROQ_API_KEY_1=
GROQ_API_KEY_2=
GROQ_API_KEY_3=
OPENAI_MODEL=gpt-4o-mini
GROQ_MODEL=llama-3.3-70b-versatile
```

### Required for calendar connect/import

```env
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=https://your-api-host/api/v1/calendar-sync/google/callback
GOOGLE_CALENDAR_SCOPES=https://www.googleapis.com/auth/calendar.readonly
```

### Required for jobs / digest / delivery foundation

```env
JOBS_ENABLED=true
```

### Required for Expo push delivery

```env
EXPO_PUSH_ACCESS_TOKEN=
```

### Optional but needed for full digest email sending

```env
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

### Optional but needed for real travel reminders

```env
GOOGLE_MAPS_API_KEY=
TRAVEL_HOME_LATITUDE=
TRAVEL_HOME_LONGITUDE=
```

### Required for RevenueCat webhook handling

```env
REVENUECAT_WEBHOOK_SECRET=
REVENUECAT_ENTITLEMENT_ID=family_plus
```

## 5. Mobile Environment Variables

### Local development

`apps/mobile/.env` should contain:

```env
EXPO_PUBLIC_API_URL=http://localhost:3001/api/v1
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_DEV_AUTH_TOKEN=homethread-dev-token
EXPO_PUBLIC_EAS_PROJECT_ID=
EXPO_PUBLIC_REVENUECAT_API_KEY=
```

### EAS preview / production

For actual builds, `EXPO_PUBLIC_API_URL` must point to a real reachable backend.

Do **not** leave it on `localhost` for physical devices.

Examples:

```env
EXPO_PUBLIC_API_URL=https://api-staging.example.com/api/v1
EXPO_PUBLIC_API_URL=https://api.example.com/api/v1
```

You also need:

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_EAS_PROJECT_ID=
EXPO_PUBLIC_REVENUECAT_API_KEY=
```

## 6. EAS Build Setup

Current repo status:
- `eas.json` exists
- `app.json` is wired for `expo-notifications`

You still need to do:

1. Log into Expo/EAS
2. Link the project to the correct Expo account/project
3. Set EAS env vars for:
   - `preview`
   - `production`
4. Ensure `EXPO_PUBLIC_API_URL` is real for non-local builds

Commands already available in the repo:

```bash
npm run eas:build:development
npm run eas:build:preview
npm run eas:build:production
npm run eas:submit:production
```

## 7. Supabase Production Setup

You already have the code-side foundation. You still need the hosted project configured correctly.

Checklist:

1. Confirm production Supabase project URL and anon key
2. Confirm service role key on backend
3. Confirm auth works for real accounts
4. Confirm the right tables/policies exist
5. Enable/publish Realtime for the family-scoped tables used in the app

Realtime is only truly live if your hosted Supabase project publishes changes for the expected tables.

## 8. Google OAuth Production Setup

Local credentials are not enough by themselves.

In Google Cloud:

1. Enable Google Calendar API
2. Use the production OAuth client
3. Add the deployed redirect URI exactly:

```text
https://your-api-host/api/v1/calendar-sync/google/callback
```

4. Ensure the OAuth consent screen is valid for your release mode
5. Confirm test users / publishing state as needed

## 9. Push Notifications Setup

The repo can request permission and register/store push tokens.

What is still needed:

### Expo side

- `EXPO_PUBLIC_EAS_PROJECT_ID`
- Expo project correctly linked
- `EXPO_PUSH_ACCESS_TOKEN` on backend

### iOS side

- Apple Developer account
- APNs key / credentials configured through Expo/EAS

### Android side

- Firebase project
- FCM server credentials configured for Expo/EAS

Without these, notification UI may work, but actual delivery is not truly launch-ready.

## 10. RevenueCat / Family Plus Setup

The repo has subscription status and webhook foundations.

Still required:

1. Create RevenueCat project
2. Create the `family_plus` entitlement (or match your chosen ID)
3. Create products in App Store Connect / Google Play
4. Attach products in RevenueCat
5. Set:
   - `EXPO_PUBLIC_REVENUECAT_API_KEY` in mobile build env
   - `REVENUECAT_WEBHOOK_SECRET` on backend
6. Point RevenueCat webhook to the deployed backend webhook route

Important:
- backend foundation is present
- purchase/restore/store behavior still depends on store-side setup

## 11. Widgets

Current repo status:
- widget snapshot foundation exists
- no native iOS/Android widget extension is shipped

So for launch planning:
- do not promise real widgets yet unless you build/test native widgets

## 12. Travel Reminders

Current repo status:
- backend truth/status foundation exists
- real routing intelligence is incomplete without Maps config

To make it real:

```env
GOOGLE_MAPS_API_KEY=
TRAVEL_HOME_LATITUDE=
TRAVEL_HOME_LONGITUDE=
```

Without these, keep the feature framed as unavailable or limited.

## 13. Device QA Checklist

Before any store submission, verify on real devices:

### Auth / family
- create account
- sign in
- create family
- join family by code
- sign out

### Core household flows
- create event
- create chore
- create list
- add meal
- save recipe
- kids mode entry/exit

### Reliability
- offline queue behavior
- replay after reconnect
- realtime update behavior across two devices if possible

### Calendar
- Google connect
- iCal connection
- manual sync now

### Notifications
- permission request
- token registration
- notification settings state

### Family/account
- rename family
- add child profile
- leave family
- delete account (Supabase path)

## 14. Store / Release Execution

Still needed outside the repo:

### Apple
- Apple Developer account
- bundle ID ownership
- TestFlight build upload
- screenshots
- privacy details
- review metadata

### Google
- Play Console app
- internal testing release
- screenshots
- content declarations
- privacy policy / data safety info

### Common
- app icon / splash review
- support email / site
- release notes

## 15. Final Go/No-Go Questions

Before launch, answer these honestly:

1. Does the app point to a real backend from physical devices?
2. Does auth work for brand-new real users?
3. Can a new family complete setup without developer help?
4. Are push credentials real and tested?
5. Are subscriptions either fully ready or clearly withheld from release?
6. Are Google calendar callbacks working on the deployed host?
7. Is Realtime actually enabled on the hosted Supabase project?
8. Are all “foundation only” features still labeled truthfully in the UI?

## 16. Suggested Immediate Next Steps

If you want the fastest path forward:

1. Deploy backend to staging
2. Set real staging `EXPO_PUBLIC_API_URL`
3. Run an EAS preview build
4. Test auth + family setup on a physical device
5. Test Google connect + calendar sync
6. Test push permission/token registration
7. Only then move to store submission work

---

If you want, the next step after this file is:
- I can build you a **staging-first launch checklist**
- or a **fill-in-the-blanks env matrix** with exact values/owners/status columns

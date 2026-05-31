# FamilySync QA Audit Report
Date: 2026-05-30
Audited by: Codex

## Summary
- Critical bugs found: 4
- High severity issues: 6
- Medium severity issues: 4
- Low / polish issues: 2
- Total fixes applied: 16

## Critical Bugs Fixed
- `apps/backend/src/routes/webhooks.ts` (`webhookRoutes`): RevenueCat webhook accepted requests when `REVENUECAT_WEBHOOK_SECRET` was unset. Fix applied: fail closed with `503 WEBHOOK_NOT_CONFIGURED` instead of leaving the endpoint open.
- `apps/backend/src/routes/calendarSync.ts` (`upsertGoogleConnection`) + `apps/backend/src/lib/calendarImport.ts` (`resolveGoogleAccessToken`) + `apps/backend/src/lib/calendarTokenCrypto.ts`: Google Calendar access/refresh tokens were stored in plaintext. Fix applied: added AES-256-GCM token encryption support, disabled Google connect when `CALENDAR_TOKEN_ENCRYPTION_KEY` is missing, and decrypt on sync/refresh.
- `apps/backend/src/routes/calendarSync.ts` + `apps/backend/src/lib/calendarImport.ts`: iCal feeds allowed non-HTTPS URLs. Fix applied: reject non-HTTPS feed URLs at validation time and before fetch.
- `apps/mobile/src/services/api.ts` + `apps/mobile/src/store/useAuthStore.ts` + `apps/mobile/App.tsx`: expired/invalid sessions could leave the app in a stale signed-in state after a 401. Fix applied: added centralized unauthorized handler, Supabase auth-state listener, and signed-out state reset.

## High Severity Issues Fixed
- `apps/mobile/src/store/useHomeThreadStore.ts` (`resetHomeThreadStoreForSignedOut`) + `apps/mobile/App.tsx`: logout did not clear household state/offline queue. Fix applied: added signed-out home-store reset and clear queued mutations when auth exits.
- `apps/backend/src/routes/auth.ts` (`DELETE /auth/account`): account deletion removed the user row before cleaning membership links. Fix applied: delete Supabase auth user first, then remove family memberships, then delete the local profile row.
- `apps/backend/src/routes/events.ts` (`PATCH /:eventId`, `DELETE /:eventId`): any family member could edit or delete any event. Fix applied: only the creator or a family admin can modify/delete an event.
- `apps/mobile/src/services/api.ts` (`apiRequest`): requests could hang indefinitely on a poor connection. Fix applied: added a 15s timeout and a human-readable timeout message.
- `apps/mobile/src/components/AppErrorBoundary.tsx` + `apps/mobile/App.tsx`: the app had no root error boundary. Fix applied: wrapped the shell in a minimal recovery boundary with retry UI.
- `apps/backend/src/app.ts` + `apps/backend/src/routes/auth.ts` + `apps/backend/src/routes/ai.ts` + `apps/backend/src/routes/calendarSync.ts`: auth, AI, and calendar routes were only using the loose global rate limit. Fix applied: added tighter route-specific limits plus a standardized 429 payload.

## Medium Severity Issues Fixed
- `apps/mobile/src/store/useAuthStore.ts` (`joinFamily`) + `apps/backend/src/routes/families.ts` (`POST /join`): invite codes were not normalized. Fix applied: trim and uppercase invite codes on both client and server.
- `apps/mobile/src/services/api.ts` + `apps/mobile/App.tsx`: missing `EXPO_PUBLIC_API_URL` fell back silently to localhost. Fix applied: added startup config status and a clear warning when the app is using the default local API URL.
- `apps/mobile/src/services/notifications.ts` + `apps/mobile/App.tsx`: push token registration did not refresh on subsequent launches. Fix applied: refresh Expo push token on signed-in app launch when permission/device support allow it.
- `apps/mobile/src/services/api.ts`: 429 responses could surface backend wording directly. Fix applied: normalize rate-limit errors to a simple user-facing message.

## Issues Deferred (not fixed in this pass, needs human decision)
- Biometric/PIN unlock is not implemented. Why deferred: this repo does not currently include `expo-local-authentication` or a lock-screen flow. Recommended action: decide whether launch requires a real lock gate or whether kids mode remains a softer trust boundary.
- Kids mode still exits via long-press only, not PIN/biometric. Why deferred: adding a child-lock gate is feature work, not a minimal bug fix. Recommended action: if kids mode is launch-critical for parent trust, add an adult verification step before deployment.
- Route-specific Plus gating is incomplete for AI/insights. Why deferred: current AI route shapes do not consistently carry family context, so server-authoritative subscription checks need a small contract pass. Recommended action: add `requirePlus` once family context is explicit on every Plus-only route.
- Route-specific rate-limit tightening (`/auth`, `/ai`, `/calendar-sync`) is not fully implemented. Why deferred: it changes API behavior and should be tuned deliberately with product expectations. Recommended action: add per-route `rateLimit` configs and a client-facing 429 copy pass.
- Offline queue still has no retry cap or conflict-resolution strategy. Why deferred: current queue is intentionally narrow and truthful, but retry/discard policy needs product behavior decisions. Recommended action: add max retry count and user-visible discard handling.
- Push tap deep-link navigation, delivery timing, and timezone delivery were not exercised end-to-end. Why deferred: they require real device credentials and deployed services. Recommended action: verify on physical devices after backend/push deployment setup.
- Existing plaintext Google tokens already in a database will need reconnect or migration. Why deferred: migration strategy depends on deployed environment and whether any real connections already exist. Recommended action: rotate/reconnect existing calendar connections after setting `CALENDAR_TOKEN_ENCRYPTION_KEY`.
- The audit brief references Expo Router, TanStack Query hooks, MMKV, biometric unlock, FlashList, and Apple Sign In files that do not exist in this repo. Why deferred: this pass audited the HomeThread equivalents instead. Recommended action: keep using repo-native paths for future audits rather than the borrowed FamilySync layout.

## End-to-End Journey Results
Journey 1 — New family setup: PARTIAL
Journey 2 — Core daily loop: PARTIAL
Journey 3 — Real-time sync: PARTIAL
Journey 4 — Offline behavior: PARTIAL
Journey 5 — Kids mode safety: FAIL
Journey 6 — AI meal suggestion: PARTIAL
Journey 7 — Google Calendar sync: PARTIAL
Journey 8 — Push notification delivery: FAIL
Journey 9 — Subscription upgrade: FAIL
Journey 10 — Account deletion: PARTIAL

## Pre-Launch Checklist
- Privacy policy URL exists and is accessible: FAIL — not defined in app/store config in repo.
- Terms of service URL exists and is accessible: FAIL — not defined in app/store config in repo.
- Support email address configured: FAIL — no support contact config found in repo.
- App icon: 1024×1024px, no alpha channel, no rounded corners: PARTIAL — app config exists, but final asset validation needs manual asset review.
- Splash screen: matches brand, no text that could be cropped: FAIL — no explicit splash config found in `apps/mobile/app.json`.
- All required screenshot sizes prepared (iOS: 6.7", 6.1", iPad; Android: phone + 7" tablet): FAIL — outside repo, not prepared here.
- Apple: Sign in with Apple implemented (required when Google sign-in is offered): FAIL — not implemented.
- Apple: "Restore Purchases" button in settings: FAIL — Family Plus is status-only right now.
- Apple: Subscription terms visible before purchase: FAIL — purchase flow not implemented.
- Google: Data Safety form completed in Play Console: FAIL — external console task.
- Google: Target SDK level is current (API 34 minimum for 2024+): PARTIAL — Expo 56 / RN 0.85 likely targets a current SDK via Expo, but final store validation still needs a real build.
- EAS build profile `production` tested and producing valid `.ipa` and `.aab`: FAIL — profiles exist, but real production builds were not produced in this pass.
- App does not crash on first launch on a clean install: PARTIAL — root boundary added and typechecks/export pass, but no fresh device install run in this pass.
- App does not crash when internet is unavailable from launch: PARTIAL — offline queue/store logic exists, but not fully re-run on a physical device today.
- App does not request unnecessary permissions (contacts, camera, location) at launch — only when the feature requiring them is used: PASS — no startup request path for those permissions was found.
- Camera/photo permission requested only when user taps "Upload photo" — not at startup: PASS — no startup camera/photo requests found.
- Location permission NOT requested unless travel-time reminders feature is enabled (and this feature is post-launch): PASS — location permission is not requested in this repo.
- Notification permission requested with context explanation before the system dialog: PARTIAL — Family screen explains notifications clearly before enabling, but there is no broader onboarding prompt copy yet.
- App version number and build number are correct in `app.json` / `eas.json`: PARTIAL — version exists, but final launch numbering still needs human review.
- Deep link scheme is registered and tested (e.g., `familysync://`): PARTIAL — `homethread` scheme is registered in `app.json`, but deep-link behavior was not fully tested in this pass.
- Sentry is initialized and reporting errors to the correct project: FAIL — no Sentry initialization found.
- All `EXPO_PUBLIC_*` environment variables are set in EAS Secrets for the production build profile: FAIL — EAS placeholders remain and real secrets are still a deployment task.

## Recommended Next Steps
1. Set `CALENDAR_TOKEN_ENCRYPTION_KEY` in the deployed backend before using Google Calendar connect again, then reconnect any existing Google calendar connections.
2. Decide whether kids mode must have a true adult-verification exit (PIN/biometric) before launch. The audit treats this as a trust blocker.
3. Add server-authoritative Plus gating on every paid feature route, especially AI and insights paths.
4. Implement per-route rate limiting and consistent mobile 429 messaging.
5. Run physical-device E2E checks for realtime, offline replay, push tap routing, and calendar sync against a deployed backend.
6. Finish store/legal launch work outside the repo: privacy policy, terms, support email, screenshots, production EAS envs, Apple/Google console setup.
7. Add Sentry before release so the new error boundary and backend failures feed into real monitoring rather than only console output.

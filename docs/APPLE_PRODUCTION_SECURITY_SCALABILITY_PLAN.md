# HomeThread Apple Production, Security, And Scalability Plan

This document is the separate production-level release gate for HomeThread.

The UI/UX consistency work lives in `docs/FRONTEND_UX_CONSISTENCY_PLAN.md`. This file is for the next serious question: can we hand this app to Apple and real users without getting rejected, breaking under real usage, leaking family data, or being unable to diagnose production failures?

## Owner Concern And Goal

The owner concern is serious production readiness:

- The app should not be returned by Apple for avoidable App Review issues.
- The app should not ship with placeholder, preview, or unfinished production behavior.
- The backend and mobile app must protect the entire household data surface.
- Scalability must be included before real families depend on the app.
- Security must cover the entire system, not only individual screens.
- Prior audits exist, so this plan must carry forward resolved work and focus on remaining launch gates.

The goal is not "pass a demo." The goal is a production-grade Apple submission candidate.

## Sources And Grounding

Repo documents reviewed:

- `HOMETHREAD_QA_AUDIT_REPORT.md`
- `PRODUCTION_READINESS_PHASES.md`
- `DEPLOYMENT_CHECKLIST.md`
- `FINAL_RUNTIME_CHECKLIST.md`
- `LAUNCH_AUDIT_TRACKER.md`
- `docs/APP_WIDE_TEST_CASES.md`
- `docs/FRONTEND_UX_CONSISTENCY_PLAN.md`

Current code areas checked:

- `apps/mobile/app.json`
- `eas.json`
- `apps/mobile/src/utils/buildReadiness.ts`
- `apps/mobile/src/services/api.ts`
- `apps/mobile/src/services/sentry.ts`
- `apps/mobile/src/services/billing.ts`
- `apps/mobile/src/store/useAuthStore.ts`
- `apps/backend/src/app.ts`
- `apps/backend/src/env.ts`
- `apps/backend/src/db/client.ts`
- `apps/backend/src/routes/health.ts`
- `apps/backend/src/plugins/auth.ts`
- `apps/backend/src/plugins/familyAccess.ts`
- `apps/backend/src/plugins/requirePlus.ts`
- `apps/backend/src/routes/ai.ts`
- `apps/backend/src/routes/calendarSync.ts`
- `apps/backend/src/routes/webhooks.ts`

Apple official references checked:

- App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- App Review preparation: https://developer.apple.com/distribute/app-review/
- App privacy details: https://developer.apple.com/app-store/app-privacy-details/
- App Store Connect privacy management: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/
- User privacy and data use: https://developer.apple.com/app-store/user-privacy-and-data-use/
- Privacy manifest files: https://developer.apple.com/documentation/bundleresources/privacy-manifest-files
- Required reason APIs: https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api

Important Apple review facts from those sources:

- Apple asks teams to test for crashes and bugs, complete metadata, provide review access, keep backend services live, and explain non-obvious features and in-app purchases in review notes.
- Apps with account-based features must provide a valid demo account, full demo mode, or the resources Apple needs to review the app.
- App privacy responses must identify data collected by the app and third-party SDKs, and must stay accurate as practices change.
- iOS apps require a privacy policy URL in App Store Connect.
- Apps using third-party/social login for primary accounts must offer an equivalent privacy-preserving login option, which for HomeThread means Sign in with Apple or a compliant equivalent.
- Digital feature unlocks and subscriptions must use in-app purchase, include restore behavior where applicable, and communicate subscription value and terms clearly before purchase.
- Apps for or used by kids require special care around age-appropriate experience, parental controls, contact information, and child data.

## Current Production Baseline

What appears improved since the older audit:

- Backend has a DB-aware health route in `apps/backend/src/routes/health.ts`.
- Backend has explicit body size limit in `apps/backend/src/app.ts`.
- Backend has DB pool limits and timeouts in `apps/backend/src/db/client.ts`.
- Backend production env validation now rejects localhost DB and dev auth in production in `apps/backend/src/env.ts`.
- AI routes now have `requirePlus` support behind `REQUIRE_PLUS`.
- Mobile has Sentry initialization path in `apps/mobile/src/services/sentry.ts`.
- Mobile production API misconfiguration guard exists in `apps/mobile/src/services/api.ts`.
- RevenueCat billing service and restore paths exist in `apps/mobile/src/services/billing.ts`.
- Prior audit blockers around household creation, child pairing, leave household, role promotion, and pairing-code persistence are marked resolved in `LAUNCH_AUDIT_TRACKER.md`.

Still not proven production-ready:

- A final TestFlight build has not been proven on a clean iPhone install against final production services.
- App Store Connect metadata, screenshots, privacy policy URL, privacy labels, age rating, support URL, and review notes are external and not verified in repo.
- Sign in with Apple appears not implemented in the mobile auth UI, while Google sign-in exists.
- Store checkout copy still includes preview/disabled language in Household billing UI.
- Production Sentry DSNs and source map upload are not confirmed.
- Push delivery, notification tap handling, Google OAuth handoff, RevenueCat purchases, restore purchases, and Supabase storage policy are not proven on real iPhone/TestFlight.
- `npm audit --omit=dev` currently reports `32` production dependency advisories: `3 high`, `29 moderate`, `0 critical`. These need triage before release.

## Apple Rejection Shield

These are no-go gates before App Review.

### A. App Completeness

Apple can reject if the app crashes, has placeholder content, incomplete flows, disabled production features presented as live, dead buttons, broken login, or unavailable backend services.

Gate:

- [ ] Clean TestFlight install launches without crash.
- [ ] Signed-out flow works.
- [ ] New user can create a household.
- [ ] Second adult can join a household.
- [ ] Child pairing works or is hidden if not ready.
- [ ] Backend is live and reachable for the full review window.
- [ ] No `preview`, `not live`, `planned tiers`, `build diagnostics`, or developer-only copy appears in production UI.
- [ ] Any feature that is intentionally unavailable is hidden or described honestly without looking broken.

### B. Review Access

Apple must be able to exercise the app.

Gate:

- [ ] Create App Review demo account for Adult A.
- [ ] Create App Review demo account for Adult B.
- [ ] Create demo household with realistic sample data.
- [ ] Provide adult invite code in review notes, or a flow for reviewer to create their own.
- [ ] Provide child pairing instructions and a test pairing code if child mode is visible.
- [ ] Provide exact notes for Google sign-in, calendar sync, notifications, purchases, and any hard-to-trigger state.
- [ ] Backend and Supabase project remain live during review.
- [ ] Contact phone/email in App Store Connect is accurate.

### C. Sign In With Apple

Current risk:

- HomeThread offers Google sign-in.
- Apple guidelines require an equivalent privacy-preserving login option when a third-party/social login is used for the user's primary account.
- `apps/mobile/src/utils/buildReadiness.ts` already flags Sign in with Apple as required.

Gate:

- [ ] Implement Sign in with Apple in mobile auth, or remove Google/social login from the submitted build and use only first-party email/password.
- [ ] Confirm Supabase Apple provider setup.
- [ ] Confirm iOS entitlement/capability via EAS/App Store Connect.
- [ ] Verify first-run, cancel, retry, existing-account, no-household, create-household, and join-household paths.
- [ ] Make Apple and Google auth copy equal in prominence if both are shipped.

### D. Subscriptions And Purchases

Current risk:

- Billing code exists, but Household UI still says store checkout/subscriptions are not live in preview.
- Apple can reject incomplete or misleading in-app purchase/subscription flows.
- If Assistant/Plus is gated as a paid digital feature, iOS must use IAP/RevenueCat correctly.

Decision gate:

- Option 1: Ship without paid purchase UI. Hide upgrade/checkout buttons, keep Assistant free or disable paid-gated claims, and remove all subscription promises from production UI.
- Option 2: Ship with real subscriptions. Configure App Store products, RevenueCat entitlement, backend webhook, restore purchases, subscription terms, and review notes.

No-go unless one option is fully chosen and implemented.

Subscription checklist if Option 2:

- [ ] App Store Connect subscription group and product IDs created.
- [ ] RevenueCat project, iOS app, entitlement, offerings, and webhook configured.
- [ ] `EXPO_PUBLIC_REVENUECAT_API_KEY` set in EAS production.
- [ ] `REVENUECAT_WEBHOOK_SECRET` set in backend production.
- [ ] `REQUIRE_PLUS=true` only when purchase/restore/entitlement sync works.
- [ ] Purchase succeeds on TestFlight.
- [ ] Restore succeeds on TestFlight.
- [ ] Subscription terms are visible before purchase.
- [ ] Free users retain non-AI core app functionality.
- [ ] App Review notes explain subscription value and test instructions.

### E. Privacy Policy And Privacy Nutrition Label

Current risk:

- Old audit marked privacy policy URL as missing.
- HomeThread collects or processes names, emails, household data, child profile data, photos, push tokens, purchase status, diagnostics, calendar data, AI prompts, and user-generated family content.

Gate:

- [ ] Public privacy policy URL exists and is entered in App Store Connect.
- [ ] Terms/support URLs exist and work.
- [ ] Data inventory completed for Apple privacy labels.
- [ ] Third-party SDK data practices included: Supabase, Sentry, RevenueCat, Expo push, Google OAuth/Calendar, AI providers, any analytics if added.
- [ ] Privacy label marks data linked to user where account-linked.
- [ ] Child profile and family data treatment is described clearly.
- [ ] AI prompt/context handling is disclosed.
- [ ] Photo upload and calendar import handling are disclosed.
- [ ] Tracking is explicitly reviewed; if no tracking/ads, do not add ATT prompt.

Likely data categories to review for labels:

- Contact info: name, email.
- User content: plans, chores, lists, meals, recipes, board posts, AI prompts, photos.
- Identifiers: user ID, family ID, push token, RevenueCat app user ID.
- Purchases: subscription status and purchase history if IAP is live.
- Diagnostics: crash/error data via Sentry.
- Usage data: only if analytics or diagnostic breadcrumbs are collected.
- Location: event locations and optional travel-reminder coordinates if sent to backend or Google Maps.

### F. Privacy Manifest And Required Reason APIs

Gate:

- [ ] Produce an iOS build and generate/inspect the Xcode privacy report.
- [ ] Confirm included SDK privacy manifests for required third-party SDKs.
- [ ] Confirm any required-reason API usage has approved reasons in privacy manifests.
- [ ] Confirm Expo/Sentry/RevenueCat/Supabase dependencies do not trigger unresolved App Store Connect privacy warnings.
- [ ] Archive any Apple upload warning emails and resolve before review.

### G. Kids And Family Safety

HomeThread is not necessarily a Kids Category app, but child-device mode and child profiles create child-data expectations.

Gate:

- [ ] Decide App Store age rating and whether the app is submitted to Kids Category. Recommended: do not choose Kids Category unless fully designed for it.
- [ ] Adult controls protect child pairing, child profile management, and leave/remove flows.
- [ ] Child device shell cannot access adult tabs or household admin.
- [ ] Child device token revocation works.
- [ ] Kids mode exit behavior is acceptable for launch, or adult verification is added.
- [ ] Privacy policy explains child profile/device data and parent-controlled use.
- [ ] No ads or tracking SDKs are added.
- [ ] Support contact is present for family safety concerns.

## Security Protection Gate

This is the app-wide security checklist. It is not a substitute for a professional security audit.

Security must be treated as a complete system gate, not a feature-by-feature polish task. The app handles private household data, child-related data, photos, calendars, notifications, purchases, AI prompts, and family membership boundaries. Every layer must fail closed.

Main owner concerns that must be explicitly covered:

- Rate limiting for appropriate modules, not only one global limit.
- API keys and provider secrets stay server-side.
- Environment variables are never committed to the repo.
- Row Level Security exists for every Supabase/Postgres table that could be reachable through Supabase APIs.
- No database table is public by default.
- User input is validated, normalized, bounded, and sanitized before persistence or provider calls.
- Public routes are intentionally public; all other routes require authentication.
- User-facing messages never leak stack traces, SQL errors, provider raw errors, secrets, tokens, or internal file paths.
- Admin, debug, diagnostics, seed, and development endpoints are locked down or absent from production.
- Logging exists, but logs are redacted and useful for incident response.
- Security coverage includes auth, roles, child devices, invites, pairing codes, uploads, webhooks, AI, calendar sync, purchases, notifications, offline queue, realtime, and storage.

### 0. Security Release Audit Required

Before App Store submission, run a dedicated security release audit and produce a short report with evidence.

Required report sections:

- Route inventory: every API route, auth requirement, role requirement, rate limit, and whether it is intentionally public.
- Database inventory: every table, RLS status, public/anon access status, policies, indexes, retention notes.
- Secret inventory: every API key, where it lives, whether it is client-safe or server-only, rotation owner.
- Input validation inventory: every write endpoint and the schema/sanitization path protecting it.
- Error/logging inventory: examples proving users get safe errors while logs retain enough internal detail.
- Abuse inventory: auth brute force, invite brute force, child pairing brute force, AI cost abuse, calendar sync abuse, purchase webhook abuse, push notification fanout abuse.
- Admin/debug inventory: every diagnostic, seed, dev-token, build-readiness, internal test, and support path.

No production submission until this audit is complete or every uncovered item is intentionally removed from the submitted build.

### 1. Secrets And Environment

- [ ] No real secrets committed in repo or git history.
- [ ] `.env` files remain ignored.
- [ ] `.env.example` files contain placeholders only.
- [ ] Repo scan confirms no provider secrets in `AGENTS.md`, `CLAUDE.md`, docs, logs, screenshots, generated artifacts, or committed patches.
- [ ] Production backend fails closed if required env is missing.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is backend-only.
- [ ] Supabase anon key is treated as public, but every exposed table/storage bucket still relies on RLS/policies.
- [ ] `CALENDAR_TOKEN_ENCRYPTION_KEY` is set before Google Calendar connect is enabled.
- [ ] `REVENUECAT_WEBHOOK_SECRET` is required before RevenueCat webhook accepts production events.
- [ ] `EXPO_PUSH_ACCESS_TOKEN` is backend-only.
- [ ] AI provider keys are backend-only.
- [ ] Google OAuth client secret is backend-only.
- [ ] Apple Sign in secret/client-secret JWT is never shipped in mobile JS.
- [ ] Sentry auth token, upload token, and DSN ownership are documented; DSN may be public, auth/upload token must not be.
- [ ] Rotate any secrets that ever appeared in local files shared outside the machine.
- [ ] Add or verify secret scanning: gitleaks, GitHub secret scanning, or equivalent.
- [ ] Create a rotation calendar for Apple OAuth secret JWT, Google OAuth secret, Supabase service role, RevenueCat webhook secret, AI keys, Expo push token, and Sentry auth tokens.

### 2. Authentication And Session

- [ ] Supabase auth is configured in production.
- [ ] Dev auth is disabled in production.
- [ ] 401 clears stale client state safely.
- [ ] Session restore tested after kill/reopen.
- [ ] Sign out clears household state, offline queue, child state, and assistant/board data where appropriate.
- [ ] Account deletion is protected, clear, and tested.
- [ ] Apple and Google auth cannot create duplicate ambiguous accounts for the same reviewer/user without recovery.
- [ ] Every route is classified as public, authenticated-user, family-member, family-admin, child-device, webhook, or internal-only.
- [ ] Public routes are limited to health, OAuth callback, explicitly public child-pairing steps, and webhooks with signature/secret verification.
- [ ] Public routes never return household data without an independent token/code verification path.
- [ ] OAuth callback routes validate state and never trust unverified redirect targets.

### 3. Authorization And Household Boundaries

- [ ] Every family route requires auth.
- [ ] Every family route checks membership for `familyId`.
- [ ] Admin routes require admin membership.
- [ ] Child device routes reject adult bearer tokens.
- [ ] Adult routes reject child device tokens.
- [ ] Cross-family access tests exist for families, members, events, chores, lists, meals, recipes, insights, notifications, child devices, and subscriptions.
- [ ] User cannot edit/delete another user's restricted content unless admin rules allow it.
- [ ] Leaving/rejoining cannot leak old household data.
- [ ] Every admin-only mutation is protected on the backend, not only hidden in the mobile UI.
- [ ] Every route using `familyId`, `memberId`, `eventId`, `choreId`, `listId`, `recipeId`, `notificationId`, or `deviceId` proves ownership/family membership before acting.
- [ ] Supabase service-role backend code does not accidentally bypass application-level membership checks.

### 3A. Row Level Security And Public Table Lockdown

Even if the app normally reaches data through the backend, Supabase/Postgres must not leave tables exposed by default. Service-role access can bypass RLS, so application checks still matter, but RLS prevents accidental direct client/anon exposure.

Gate:

- [ ] Every table in the public schema has RLS enabled unless there is a written reason it is not exposed to Supabase APIs.
- [ ] No table has broad `anon` read/write access.
- [ ] No table has broad `authenticated` read/write access without `family_id` / `user_id` policy checks.
- [ ] Storage buckets have explicit policies; avatar/photo buckets are not public-write.
- [ ] Tables containing child data, family membership, invite codes, pairing codes, device tokens, push tokens, calendar tokens, subscriptions, AI conversations, and notifications are locked down.
- [ ] RLS policies are tested with anon key and authenticated non-member users.
- [ ] Backend service-role bypass is documented and compensated with route-level authorization tests.
- [ ] Database migrations do not create new public tables without RLS/policy review.

Suggested Supabase SQL checks:

```sql
-- Tables without RLS enabled.
select schemaname, tablename
from pg_tables
where schemaname = 'public'
  and rowsecurity = false
order by tablename;

-- Policies currently defined.
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- Grants that may expose tables broadly.
select table_schema, table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'public')
order by table_name, grantee, privilege_type;
```

### 4. Child Device Security

- [ ] Pairing codes expire.
- [ ] Pairing attempts are rate-limited in durable storage or behind edge rate limiting.
- [ ] Pairing preview confirms household and child before final pairing.
- [ ] Old device is revoked when new device pairs if one-device policy is intended.
- [ ] Device token stored with SecureStore where available.
- [ ] Child photo upload enforces content type and storage policy.
- [ ] Revoke device invalidates access on next API call.

### 5. Input Validation And Injection

- [ ] All write bodies use Zod or equivalent validation.
- [ ] All strings are trimmed, length-bounded, and normalized where appropriate.
- [ ] User-facing text is escaped by React/React Native and never rendered through unsafe HTML.
- [ ] User input is never concatenated into SQL.
- [ ] Provider URLs are parsed with URL APIs, not ad hoc string checks.
- [ ] IDs are scoped through membership checks, not trusted from client.
- [ ] Calendar iCal URLs are HTTPS-only and protected against SSRF.
- [ ] Google calendar token exchange errors are sanitized.
- [ ] AI prompt inputs are bounded by size and do not expose secrets/system instructions.
- [ ] Recipe import and text parsing have safe size limits.
- [ ] Uploads enforce MIME type, size, and bucket policy.
- [ ] File names/paths are generated server-side and never trusted directly from user input.
- [ ] Calendar event locations and optional coordinates are validated and cannot trigger internal network calls.
- [ ] Error responses never expose tokens, SQL details, provider raw payloads, or stack traces.

### 6. API Abuse And Cost Protection

- [ ] Global rate limit exists as a fallback only.
- [ ] Auth routes have stricter per-IP and per-identifier limits.
- [ ] Create/join household and invite-code routes have brute-force limits.
- [ ] Public child pairing routes have stricter durable limits.
- [ ] AI routes have stricter per-user/family limits, body limits, and server-side Plus gating when paid.
- [ ] Calendar sync has safe limits to avoid provider/API abuse.
- [ ] Recipe import and external URL parsing have limits.
- [ ] Avatar/photo upload routes have size and frequency limits.
- [ ] Push notification send path has recipient scoping and rate limits.
- [ ] RevenueCat webhook is signature/secret protected and should tolerate retries without duplicate side effects.
- [ ] Health route is public but cheap and not verbose.
- [ ] AI provider spending caps and alerts exist outside the repo.
- [ ] Backend logs rate-limit and abuse signals without leaking PII.

Required rate-limit matrix:

| Module | Required Limit Type | Reason |
| --- | --- | --- |
| Auth sign-in/session | per-IP and per-user/email where possible | Prevent credential stuffing and noisy login loops. |
| Household join/invite code | per-IP, per-user, per-code window | Prevent invite-code guessing. |
| Child pairing | durable per-code and per-IP window | Prevent child-code brute force across processes. |
| AI assistant/meal/recipe routes | per-user/family, low burst, daily budget | Prevent cost abuse and prompt spam. |
| Calendar connect/sync/iCal import | per-user/family, URL fetch timeout | Prevent provider abuse and SSRF pressure. |
| Photo/avatar upload | per-user/device, file size limit | Prevent storage abuse and large payloads. |
| Notifications/push registration | per-user/device | Prevent token churn and spam. |
| RevenueCat webhook | provider secret plus idempotency | Prevent fake purchase events and duplicate processing. |
| Account deletion/leave household | authenticated, confirmation, low rate | Prevent accidental or automated destructive actions. |
| Health/status | public, cheap, tight payload | Allow monitoring without exposing internals. |

### 6A. Public, Admin, Debug, And Diagnostic Route Lockdown

- [ ] No admin endpoint is available without backend auth and admin authorization.
- [ ] No seed/dev/test endpoint is mounted in production.
- [ ] `DEV_AUTH_ENABLED` is impossible in production.
- [ ] Debug diagnostics in mobile are hidden in production or show only safe readiness labels.
- [ ] Build readiness screens do not reveal secrets, raw env values, internal hostnames, stack traces, or provider payloads.
- [ ] Health/status endpoints return only safe readiness data.
- [ ] Webhooks are public only at the network layer; every webhook verifies provider secret/signature before acting.
- [ ] OAuth callbacks are public only because providers call them; they validate state and do not reveal private data.

### 7. Data Protection And Retention

- [ ] Calendar tokens encrypted at rest.
- [ ] Push tokens scoped to user/child device and removable.
- [ ] Avatar/photo storage bucket permissions verified.
- [ ] Account deletion removes or anonymizes user data according to policy.
- [ ] Leave household behavior is documented and consistent.
- [ ] Board/assistant local storage is family-scoped and cleared when needed.
- [ ] Backups are enabled and tested, with restore drill documented.
- [ ] Retention rules exist for logs, Sentry events, AI prompts, calendar tokens, pairing attempts, and deleted accounts.

### 8. Dependency And Supply Chain

Current signal:

- `npm audit --omit=dev --json` returned `32` production advisories: `3 high`, `29 moderate`, `0 critical`.
- High advisories include `brace-expansion`, `fast-uri`, and `find-my-way`.
- Moderate advisories include Expo/Sentry/OpenTelemetry related packages.

Gate:

- [ ] Triage each audit advisory as exploitable, build-tool-only, framework-internal, or fixed by upgrade.
- [ ] Upgrade safe direct dependencies first.
- [ ] Avoid npm audit force fixes that downgrade Expo or break the managed build.
- [ ] Record accepted risks with reason and review date.
- [ ] Confirm `package-lock.json` is committed.
- [ ] Run production install in CI or release build path.
- [ ] Check third-party SDK privacy manifests and signatures in the final iOS archive.

### 9. Logging, Monitoring, And Incident Response

- [ ] Backend Sentry initialized and verified.
- [ ] Mobile Sentry initialized and verified in TestFlight.
- [ ] Source maps are uploaded or intentionally disabled with a debugging alternative.
- [ ] Logs redact auth headers, tokens, codes, calendar tokens, emails where possible, and request bodies containing family content.
- [ ] Logs include request IDs/correlation IDs so support can trace issues without exposing family content.
- [ ] Server logs capture internal errors while user responses remain safe and generic.
- [ ] Stack traces never return to mobile clients in production.
- [ ] Rate-limit events, auth failures, webhook failures, and suspicious child-pairing attempts are visible to operators.
- [ ] Log retention and access controls are documented.
- [ ] Health check is monitored.
- [ ] Uptime monitoring exists.
- [ ] Alert contacts are configured.
- [ ] Incident playbook exists for leaked secrets, broken auth, data bleed, payment failure, and backend outage.

### 10. Professional Audit Disclaimer

This file is an AI-assisted production hardening plan. It is not a substitute for a professional security audit or penetration test. For production systems handling family data, child-related data, payment entitlements, private calendars, photos, and AI prompts, engage a qualified security professional before broad public launch.

## Scalability Gate

Scalability here means the app remains reliable as real households, devices, jobs, notifications, AI calls, and calendar imports increase.

### Backend And Database

- [ ] DB pool max, idle timeout, and connection timeout are configured per production DB limits.
- [ ] Health route checks DB and returns 503 when DB is unavailable.
- [ ] Missing indexes from prior audits are confirmed via schema/migrations.
- [ ] Slow queries are measured under household-size test data.
- [ ] Pagination or limits exist for board history, notifications, recipes, calendar events, logs, and insights.
- [ ] Write routes avoid N+1 patterns when hydrating full household state.
- [ ] Migrations have rollback or recovery plan.
- [ ] DB backups and restore test are documented.

### Mobile Performance

- [ ] Cold start time measured on a real iPhone.
- [ ] First household hydrate measured on cellular and Wi-Fi.
- [ ] Large household data set tested: many members, plans, chores, lists, recipes, board posts, notifications.
- [ ] Long Assistant conversation tested.
- [ ] Large recipe/list text tested.
- [ ] Offline queue replay tested with multiple queued actions.
- [ ] Memory/crash behavior observed through Sentry/TestFlight.

### Jobs, Push, And Realtime

- [ ] Job worker concurrency is configured.
- [ ] Daily digest job cannot duplicate-send after restart.
- [ ] Push notification failures are logged and do not crash jobs.
- [ ] Supabase Realtime tables/channels are enabled and tested across two devices.
- [ ] Realtime reconnect behavior is tested after app background/foreground.
- [ ] Notification preferences are respected at send time.

### AI And Cost Scaling

- [ ] AI route input size limits exist.
- [ ] AI response errors are safe and user-friendly.
- [ ] AI provider fallback behavior is tested.
- [ ] AI spending caps/alerts configured.
- [ ] Premium gating cannot be bypassed when `REQUIRE_PLUS=true`.
- [ ] Family data sent to AI is minimized to what the feature needs.
- [ ] App Review notes explain AI behavior if Assistant is visible.

## App Store Connect Submission Pack

Create this pack before upload:

- [ ] App name: HomeThread.
- [ ] Subtitle and description final.
- [ ] Keywords final.
- [ ] Category final.
- [ ] Age rating questionnaire complete.
- [ ] Privacy policy URL.
- [ ] Terms URL.
- [ ] Support URL and support email.
- [ ] Marketing URL if available.
- [ ] Screenshots for required iPhone sizes.
- [ ] iPad screenshots or iPad support decision. Current `supportsTablet: true` means iPad review matters.
- [ ] App icon inspected for App Store requirements.
- [ ] Splash screen inspected on real device.
- [ ] Review notes with login/demo setup.
- [ ] Export compliance answer verified. Current `ITSAppUsesNonExemptEncryption:false` must match actual encryption usage and Apple policy.
- [ ] In-app purchase/subscription products submitted with the app if used.
- [ ] Privacy labels completed.
- [ ] Build number/version number final.
- [ ] Release notes final.

## Production Environment Matrix

Fill this before TestFlight submission.

| Area | Required Value | Owner | Status | Evidence |
| --- | --- | --- | --- | --- |
| API URL | `EXPO_PUBLIC_API_URL` |  |  |  |
| Supabase URL | `EXPO_PUBLIC_SUPABASE_URL` |  |  |  |
| Supabase anon key | `EXPO_PUBLIC_SUPABASE_ANON_KEY` |  |  |  |
| Supabase service role | backend only |  |  |  |
| Database URL | backend only |  |  |  |
| Calendar encryption key | backend only |  |  |  |
| Google OAuth client | backend/dashboard |  |  |  |
| Apple auth provider | Supabase/Apple |  |  |  |
| Expo push access token | backend only |  |  |  |
| EAS project ID | mobile |  |  |  |
| RevenueCat public key | mobile |  |  |  |
| RevenueCat webhook secret | backend only |  |  |  |
| Sentry mobile DSN | mobile |  |  |  |
| Sentry backend DSN | backend |  |  |  |
| AI provider keys | backend only |  |  |  |
| Backend health URL | public monitor |  |  |  |
| Privacy policy URL | App Store Connect |  |  |  |
| Terms URL | App Store Connect/app |  |  |  |
| Support URL/email | App Store Connect/app |  |  |  |

## Final Device Test Matrix

No App Review submission until this matrix has evidence.

| Flow | Fresh Install | Existing Install Upgrade | Offline | Slow Network | Two Adults | Child Device | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cold launch |  |  |  |  |  |  |  |
| Google sign-in |  |  |  |  |  |  |  |
| Apple sign-in |  |  |  |  |  |  |  |
| Create household |  |  |  |  |  |  |  |
| Join household |  |  |  |  |  |  |  |
| Pair child device |  |  |  |  |  |  |  |
| Revoke child device |  |  |  |  |  |  |  |
| Plan create/edit/delete |  |  |  |  |  |  |  |
| Chore create/edit/delete/complete |  |  |  |  |  |  |  |
| Lists create/add/check/clear |  |  |  |  |  |  |  |
| Meals and recipes |  |  |  |  |  |  |  |
| Family Board |  |  |  |  |  |  |  |
| Assistant |  |  |  |  |  |  |  |
| Calendar connect/sync |  |  |  |  |  |  |  |
| Notifications permission/token/delivery |  |  |  |  |  |  |  |
| Purchase |  |  |  |  |  |  |  |
| Restore purchase |  |  |  |  |  |  |  |
| Leave household |  |  |  |  |  |  |  |
| Delete account |  |  |  |  |  |  |  |

## Recommended Execution Order

### Phase 1: Apple Rejection Blockers

1. Decide subscription mode for first App Store submission.
2. Implement or remove third-party/social login risk by handling Sign in with Apple.
3. Remove preview/unfinished billing and diagnostic production copy.
4. Create privacy policy, terms, support URL/email.
5. Prepare App Review demo accounts and notes.

Exit:

- A reviewer can install, sign in, use the app, and understand every visible feature.

### Phase 2: Security And Privacy Hardening

1. Run a fresh comprehensive security review.
2. Triage `npm audit --omit=dev` advisories.
3. Verify secrets, envs, auth boundaries, child device boundaries, AI gating, calendar token encryption, RevenueCat webhook, storage buckets, and log redaction.
4. Complete Apple privacy label data inventory.
5. Generate/inspect iOS privacy report.

Exit:

- No known high-confidence data boundary or privacy disclosure gaps remain.

### Phase 3: Scalability And Observability

1. Load test backend with realistic household data.
2. Confirm DB indexes and query behavior.
3. Verify Sentry mobile/backend events.
4. Verify uptime monitor and alerting.
5. Verify backups and restore drill.

Exit:

- We can see, diagnose, and recover from production failures.

### Phase 4: TestFlight Evidence Run

1. EAS production-like build.
2. Install through TestFlight.
3. Run final device matrix.
4. Capture screenshots/video for App Review notes when needed.
5. Fix any crash, broken login, payment, privacy, or unsupported feature issue.

Exit:

- App is a real App Review candidate.

### Phase 5: Submission

1. Submit build and IAP products together if subscriptions are live.
2. Include full review notes.
3. Keep backend live and monitored.
4. Watch App Review messages and crash logs.
5. Prepare fast response for rejection notes.

## Claude Discussion Prompts

Use Claude as an outside reviewer before implementation.

### Prompt 1: Apple Rejection Risk Review

```text
You are Claude acting as an independent App Store production reviewer.

Review docs/APPLE_PRODUCTION_SECURITY_SCALABILITY_PLAN.md and the HomeThread repo read-only.

Focus on what Apple could reject:
- broken login or no demo access
- Google sign-in without Sign in with Apple or equivalent
- incomplete purchases/subscriptions/restore
- privacy policy and privacy label gaps
- child/family data handling
- placeholder or preview production copy
- unavailable backend services
- crash/performance issues
- misleading feature claims
- iPad support if supportsTablet is true

Return:
1. Top Apple rejection risks ranked P0/P1/P2.
2. What is already covered in code.
3. What must be changed before submission.
4. What must be handled in App Store Connect.
5. Exact review notes Apple should receive.
```

### Prompt 2: Security And Privacy Threat Model

```text
You are Claude acting as a security reviewer for HomeThread.

Review the full app read-only with focus on:
- auth/session trust boundaries
- family membership isolation
- child device token boundaries
- invite and pairing code abuse
- calendar token storage
- RevenueCat webhook verification
- AI route data leakage and cost abuse
- push token handling
- photo/avatar uploads
- offline queue cross-household bleed
- logs/Sentry privacy
- secrets and production env handling

Return:
1. Concrete verified vulnerabilities only.
2. High-risk unverified concerns separately.
3. Data classification for HomeThread.
4. Abuse scenarios by attacker type.
5. Must-fix before App Store vs after first release.
```

### Prompt 3: Scalability Readiness Review

```text
You are Claude acting as a backend/mobile scalability reviewer.

Review HomeThread read-only for production scale readiness.

Focus on:
- DB indexes and query growth
- API hydration cost
- list/board/recipe/notification pagination
- job worker reliability
- push notification fanout
- Supabase Realtime reconnect behavior
- offline queue replay
- AI provider cost and latency
- mobile performance on large households
- observability and rollback

Return:
1. Top scale risks before real users.
2. Minimal code changes that reduce the most risk.
3. Load-test scenarios and target thresholds.
4. Data sizes to seed for testing.
5. What can wait until after first App Store approval.
```

## Final Go / No-Go Rules

Do not submit to Apple if any of these are true:

- Google sign-in is visible and no compliant Apple/equivalent login exists.
- Paid subscription UI is visible but purchases/restore/terms are not real.
- Backend is not live and reachable during review.
- Reviewer cannot access a full working demo account.
- Privacy policy URL is missing.
- Privacy labels are incomplete or not matched to actual SDK/data usage.
- App crashes on clean TestFlight install.
- App has placeholder, preview, or developer diagnostic copy in production.
- Child device mode can expose adult household/admin functionality.
- Family data can bleed across sign-out, leave household, or account switch.
- Push/calendar/AI/billing features claim success while unsupported by env.
- Production errors cannot be observed through logs/Sentry/monitoring.

Only submit when every no-go item is cleared or the visible feature is removed from the submission build.

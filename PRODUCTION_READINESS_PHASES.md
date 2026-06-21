# HomeThread Production Readiness Phases

Date: 2026-06-21

This is the grounded launch-hardening plan for HomeThread based on the current repo, current deployment history, and the production-readiness audit brief. It separates:

- what already looks solid
- what is a real launch blocker
- what can be fixed safely in code
- what still needs human/external setup

This is for taking the app from "working" to "production-grade for first real users" without rewriting the product.

## Pass 1 - Current Verified Baseline

These are confirmed from the repo and a fresh verification run:

- `npm run typecheck` - PASS
- `npm test` - PASS (`23 files, 101 tests`)

Backend strengths already present:

- App listens on `env.PORT` in [apps/backend/src/server.ts](./apps/backend/src/server.ts)
- Fastify has a global error handler in [apps/backend/src/app.ts](./apps/backend/src/app.ts)
- CORS is allowlist-based from `FRONTEND_URL`, not wildcard
- Helmet is enabled
- Global rate limiting is enabled, with specific tighter limits on some routes
- Auth derives the current user from a verified bearer token in [apps/backend/src/plugins/auth.ts](./apps/backend/src/plugins/auth.ts)
- Family membership and admin checks are centralized in [apps/backend/src/plugins/familyAccess.ts](./apps/backend/src/plugins/familyAccess.ts)
- Most write routes use Zod schemas from shared/backend route files
- Mobile has a root error boundary in [apps/mobile/src/components/AppErrorBoundary.tsx](./apps/mobile/src/components/AppErrorBoundary.tsx)
- Mobile API base URL comes from env in [apps/mobile/src/services/api.ts](./apps/mobile/src/services/api.ts)
- EAS profiles already point production/preview builds at the Railway API and Supabase public config in [eas.json](./eas.json)
- Deep-link scheme is registered as `homethread://` in [app.json](./app.json)

## Pass 2 - Real Gaps, Ranked by Severity

### P0 - Launch Blockers

These should be fixed before we call the build production-ready.

1. Health check is only a process liveness check.
   - Current state: [apps/backend/src/routes/health.ts](./apps/backend/src/routes/health.ts) returns `{ ok: true, service: "homethread-backend" }` only.
   - Risk: Railway can think the backend is healthy while DB connectivity is broken.
   - Fix: add a small DB ping and return a stable health shape.

2. Database pool is not explicitly bounded.
   - Current state: [apps/backend/src/db/client.ts](./apps/backend/src/db/client.ts) creates `new Pool({ connectionString })` with defaults only.
   - Risk: under load or reconnect churn, Postgres/Railway can get noisy or saturated.
   - Fix: set explicit pool max, idle timeout, connection timeout, and app name.

3. Production-unsafe env defaults still exist in backend code.
   - Current state: [apps/backend/src/env.ts](./apps/backend/src/env.ts) defaults `DATABASE_URL` to localhost and `DEV_AUTH_TOKEN` to a real fallback string.
   - Risk: misconfigured production can boot into a misleading or unsafe fallback posture.
   - Fix: remove unsafe prod defaults, or fail fast in production if required env is missing.

4. Several foreign-key and lookup columns still lack indexes.
   - Confirmed schema gaps include likely missing indexes on:
     - `event_members.member_id`
     - `chores.assigned_to`
     - `reward_prizes.family_id`
     - `recipes.family_id`
     - `meal_plan_items.plan_id`
     - `notifications.family_id`
     - `calendar_connections.user_id`
     - `calendar_connections.family_id`
     - `ai_conversations.user_id`
     - `ai_conversations.family_id`
   - Risk: slow queries as households and activity history grow.
   - Fix: add a targeted Drizzle migration with missing indexes only.

5. Sentry or equivalent crash reporting is not wired up.
   - Current state: repo search found no active Sentry initialization in backend or mobile.
   - Risk: crashes in TestFlight/App Store builds become guesswork.
   - Fix: add Sentry on backend + Expo/React Native, gated by env.

6. Some calendar-sync routes still leak upstream/internal error text.
   - Current state: [apps/backend/src/routes/calendarSync.ts](./apps/backend/src/routes/calendarSync.ts) returns `error.message` in several paths.
   - Risk: external/provider details leak to users and error copy becomes inconsistent.
   - Fix: normalize to clean user-facing messages, log internal detail server-side only.

7. No explicit body-size policy is configured at the backend edge.
   - Current state: Fastify app does not set an explicit `bodyLimit`.
   - Risk: oversized payload handling is implicit instead of deliberate.
   - Fix: set a safe default body limit and document exceptions.

8. `requirePlus` / entitlement enforcement does not exist server-side yet.
   - Current state: repo search found no `requirePlus` middleware or equivalent gate.
   - Risk: if paid-only AI or premium flows are exposed later, backend enforcement is missing.
   - Fix: add server-side entitlement middleware now, even if purchase flow comes later.

### P1 - High Priority Hardening

1. `/health` path shape does not match the ideal production contract yet.
   - Prefer a stable payload like `{ status: "ok", service, db: "ok" }`.

2. Logging exists, but not in a structured/redacted production posture.
   - Current state: Fastify logger is enabled by boolean only; no explicit redaction policy.
   - Fix: redact auth headers/tokens and sensitive payload fields.

3. Backup strategy is not verifiable from the repo.
   - Needs explicit ops confirmation.

4. No load-test harness/report exists in the repo yet.
   - Fix: add a minimal k6 or Artillery script and capture results.

5. Mobile still falls back to localhost if `EXPO_PUBLIC_API_URL` is absent.
   - Current state: fallback is intentional for local dev in [apps/mobile/src/services/api.ts](./apps/mobile/src/services/api.ts).
   - Risk: safe enough for dev, but production builds must loudly reject missing API config.
   - Fix: keep dev fallback, but hard-fail or prominent-block in production builds if missing.

6. Avatar upload safety needs one final policy pass.
   - Current state: [apps/mobile/src/services/avatarUpload.ts](./apps/mobile/src/services/avatarUpload.ts) uses timestamped paths and `upsert: true`.
   - Risk: not a major exploit by itself, but not ideal final posture.
   - Fix: move to no-overwrite uploads and verify bucket privacy policy.

### P2 - Product/Launch Readiness Gaps

These are not infra blockers, but they matter before wider release:

1. Final real-device QA still needs to be completed after the next build.
2. Push notifications reaching iPhone still need end-to-end verification.
3. Kids on their own phones is still a product-model decision, not a finished production flow.
4. Subscription purchase flow is intentionally deferred and should stay deferred until after initial user validation.

## Pass 3 - Repo Work vs Human/External Work

## Work We Can Safely Handle In-Repo

These are fair game for Codex/Cursor now:

1. Harden backend env validation
2. Add DB-backed health check
3. Add explicit pool settings
4. Add missing indexes via Drizzle migration
5. Add body size limits
6. Normalize backend error leakage, especially calendar sync
7. Add server-side entitlement middleware for future paid AI gating
8. Add structured log redaction
9. Add a minimal load-test script and results template
10. Add mobile production-config guardrails
11. Wire Sentry code paths, leaving DSNs/env secrets to human config

## Work That Needs Human or External Dashboard Access

These should be flagged, not guessed:

1. Railway variable verification against the intended production DB
2. Confirming Railway health-check path and staging/production split
3. Enabling database backups or documenting the gap
4. Creating Sentry projects and DSNs
5. Adding uptime monitor
6. APNs/FCM credentials for push delivery
7. Google OAuth console redirect URIs
8. Supabase storage bucket policy verification
9. Paid API spending limits and alerting
10. App Store / Play Console release setup

## Subscription Direction (Important Product Constraint)

Per current product direction:

- We are not turning on real subscription billing yet.
- We should keep the billing area/tabs/plan language in place, but not depend on live IAP for the production validation phase.
- AI gating should eventually be enforced by entitlement on the backend.
- That means:
  - UI can still expose Assistant
  - backend should support a future `requirePlus` gate
  - for now, paid gating behavior should be implemented in a way that can be enabled later without redesigning the app

## Execution Phases

### Phase 1 - Backend Hardening

Goal: make the API and deployment posture safe enough for real users.

Tasks:

1. Tighten env validation for production
2. Add DB-aware health route
3. Add explicit pg pool configuration
4. Add missing indexes in schema + migration
5. Add explicit body limit
6. Redact sensitive logging
7. Normalize leaked error messages

Exit criteria:

- backend boots cleanly
- `/api/v1/health` checks DB and returns stable payload
- migrations remain green
- tests still pass

### Phase 2 - Auth, Entitlement, and Abuse Controls

Goal: make trust boundaries real, not implied.

Tasks:

1. Audit all family-scoped routes for auth + membership enforcement
2. Add or finish abuse-path tests for cross-family access
3. Add future-facing `requirePlus` middleware and use it on AI/premium routes
4. Confirm 429 handling stays clean in mobile UX

Exit criteria:

- auth boundary is directly tested
- no free path can hit future paid AI routes once gating is enabled

### Phase 3 - Observability and Release Guardrails

Goal: make failures visible and recoverable.

Tasks:

1. Wire Sentry in backend and mobile
2. Add startup config assertions for production builds
3. Add minimal load-test harness
4. Add release checklist updates documenting rollback and monitoring gaps

Exit criteria:

- one intentional test event reaches Sentry
- one load-test script exists and runs
- release checklist is explicit, not tribal knowledge

### Phase 4 - Final Device QA and Submission Readiness

Goal: produce the build we can trust for TestFlight/App Store review.

Tasks:

1. Rebuild after Phases 1-3
2. Test core user journeys on iPhone
3. Verify push, auth, calendar sync, household join, chores/stars, lists, meals, assistant
4. Only then cut the submission build

Exit criteria:

- no crash on cold start
- no broken core journey
- no blank or silently failing action on primary screens

## Recommended Immediate Order

1. Phase 1 in-repo hardening
2. Phase 2 auth/entitlement hardening
3. Phase 3 observability/load-test guardrails
4. Human ops pass on Railway/Sentry/Google/Supabase dashboards
5. New TestFlight build
6. Final real-device QA

## Cursor Supervisor Prompt

Use this prompt with Cursor for the next coding pass:

```text
You are doing a production-hardening pass on HomeThread. Do not rewrite the app. Do not change product direction. Do not touch subscription rollout beyond future-safe backend gating.

Read and follow:
- PRODUCTION_READINESS_PHASES.md

Scope for this pass:
- Phase 1 - Backend Hardening
- Phase 2 - Auth, Entitlement, and Abuse Controls

Rules:
1. Make minimal, targeted changes only.
2. Do not guess production secrets or dashboard values.
3. Do not remove working UX polish already done on mobile.
4. Prefer explicit tests for every security or auth boundary you touch.
5. Any task requiring Railway, Supabase dashboard, Sentry dashboard, App Store Connect, Google Cloud, or paid account setup must be reported as external, not faked.

Required deliverables:
1. Implement code fixes for Phase 1 and Phase 2 only.
2. Add or update tests for each changed trust boundary.
3. Run:
   - npm run typecheck
   - npm test
4. Produce a report in this format:

# HomeThread Phase 1-2 Hardening Report
## Fixed
- [file] [issue] [fix]

## Still External / Human Required
- [item] [why]

## Verification
- typecheck: PASS/FAIL
- tests: PASS/FAIL

## Risks Left
- [risk]

Current known priorities:
- Add DB-aware health route
- Add explicit Pool limits/timeouts
- Remove or harden unsafe production env defaults
- Add missing DB indexes with a migration
- Add explicit body size limit
- Stop leaking raw calendar/provider error text to clients
- Add future-facing requirePlus middleware for AI/premium routes
- Add auth-abuse tests for family boundary enforcement
```

## Codex Ownership

What Codex should handle directly next:

1. Review Cursor's Phase 1-2 diff before any build
2. Run the full verification suite
3. Then move into Phase 3 ourselves if Cursor did not already handle it cleanly

What we should not do yet:

1. Turn on live subscriptions
2. Depend on paid entitlements for the launch build
3. Broaden infrastructure beyond current Railway/Postgres/Supabase shape

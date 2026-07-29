# Final Tests by Umer

This file is the engineering proof plan for HomeThread. The goal is simple: prove the backend, database, integrations, and mobile API contract are not broken, then prove the system can grow to a large number of families without becoming slow or unsafe.

This is not a visual QA checklist. Existing broad UAT lives in `docs/APP_WIDE_TEST_CASES.md` and `docs/REAL_USER_JOURNEY_TEST_CASES.md`. This file is the tighter backend/database/scale gate that can be run from a development machine or CI without needing an iPhone.

## Agent-Only Rule

This plan is designed for Claude and Codex agents to execute from the repo, terminal, backend, database, Supabase dashboard/API, and HTTP test harnesses. A test does not belong in this file if its only proof path is "tap it on a physical phone."

Allowed proof sources:

- Terminal commands: typecheck, Vitest, seed, migration, DB check, backend verification, route probes, and load tests.
- Backend injection tests using Fastify `app.inject`.
- HTTP/API probes against local or staging backend.
- Database assertions using SQL, Drizzle queries, migrations, constraints, and `EXPLAIN ANALYZE`.
- Supabase configuration checks for auth, storage bucket, policies, and service-role behavior.
- Mobile logic tests that run as TypeScript/store/API-wrapper tests without native iOS hardware.
- Agent-read evidence: source files, route files, schema files, test output, logs, and staging responses.

Not allowed as required proof:

- "Open it on my iPhone."
- "Check the native permission popup manually."
- "See if a physical push notification appears."
- "Visually confirm the real app UI on a device."

Those can still be useful launch checks, but they are not required for this backend/database confidence gate.

## What We Are Proving

- The backend routes still work across auth, families, members, child devices, events, chores, lists, meals, recipes, assistant, calendar sync, notifications, subscriptions, and health.
- The database stores the right data, rejects bad relationships, keeps households isolated, and does not create duplicates under retry or concurrency.
- Supabase-dependent paths are configured correctly, including auth shadow users, service-role operations, and the `avatars` storage bucket.
- Background jobs and push notification routing behave honestly when enabled and when disabled.
- The mobile app contract is still valid: stores, API wrappers, offline queue, realtime sync, and response shapes match the backend.
- The app can handle many users efficiently by measuring latency, database query plans, connection pool behavior, rate limits, and job backlog.

## Test Strategy: Two Goes

### Go 1: Correctness and Regression Proof

Run this every time before declaring the backend safe. This proves "nothing is broken."

```powershell
npm run typecheck
npm --workspace apps/backend run db:check
npm --workspace apps/backend run test
npm --workspace apps/backend run verify:dev
```

Expected result:

- TypeScript passes for all workspaces.
- Database connection succeeds.
- Backend Vitest suite passes.
- Dev verification returns valid family, members, events, chores, lists, meals, recipes, and grocery bridge output.

### Go 2: Scale, Efficiency, and Failure Proof

Run this before production launch, after major backend changes, and after database/index changes. This proves "it still works when many families use it."

```powershell
npm run typecheck
npm --workspace apps/backend run test
npm --workspace apps/backend run db:check
npm --workspace apps/backend run verify:dev
```

Then run load tests against a staging backend and staging database, not production:

```powershell
npx autocannon -c 50 -d 60 http://localhost:3000/api/v1/health
npx autocannon -c 50 -d 60 -H "Authorization=Bearer homethread-dev-token" http://localhost:3000/api/v1/families/00000000-0000-4000-8000-000000000201
```

Pass threshold:

- Health endpoint p95 under 150 ms locally or staging.
- Read-heavy family/home endpoints p95 under 500 ms with 50 concurrent clients.
- Write endpoints p95 under 800 ms with 25 concurrent clients.
- Error rate under 1 percent, excluding intentional 401, 403, 404, 409, and 429 cases.
- Database CPU stays below 70 percent during the test window.
- Pg connection pool does not exhaust.
- Job queue backlog returns to zero after the burst.

## Environments

| Environment | Purpose | Rules |
| --- | --- | --- |
| Local dev database | Fast regression and route proof | Can use `DEV_AUTH_ENABLED=true`; never use production data. |
| Staging Supabase project | Storage, auth, jobs, and scale proof | Must mirror production env names and bucket/policy setup. |
| Production | Final smoke only | No destructive load tests, no seed scripts, no fake mass data. |

## Required Configuration Checks

| ID | Check | Command or Action | Expected Result |
| --- | --- | --- | --- |
| CFG-001 | Backend env parses | Start backend with `npm run backend:dev` | Server starts without env validation errors. |
| CFG-002 | Production env safety | Start with `NODE_ENV=production` in staging | Fails if `DATABASE_URL` is localhost, dev auth is enabled, or Supabase service role is missing. |
| CFG-003 | Database reachable | `npm --workspace apps/backend run db:check` | Prints successful connection to the intended database. |
| CFG-004 | Migrations applied | `npm run db:migrate` on disposable/staging DB | Schema creates/updates without manual SQL patches. |
| CFG-005 | Seed data valid | `npm --workspace apps/backend run db:seed` then `verify:dev` | Seeded household supports route smoke checks. |
| CFG-006 | Avatar bucket exists | Supabase Storage dashboard | Bucket named `avatars`, max 5 MB, allowed MIME: `image/jpeg`, `image/png`, `image/webp`. |
| CFG-007 | Adult avatar RLS policies exist | Supabase Storage policies | Authenticated users can insert/select/update only inside folder matching `auth.uid()`. |
| CFG-008 | Child avatar backend path works | `PUT /api/v1/child-devices/me/avatar` with child token | Backend service role uploads and stores `family_members.avatar_url`. |
| CFG-009 | Jobs disabled truthfulness | `JOBS_ENABLED=false` then `GET /notifications/jobs/status` | Returns enabled false, started false, and queue actions do not fake worker success. |
| CFG-010 | Jobs enabled truthfulness | `JOBS_ENABLED=true` with real DB | PgBoss starts, queues exist, and status returns enabled true, started true. |
| CFG-011 | Push token env | Check `EXPO_PUSH_ACCESS_TOKEN` in backend env | Missing token is reported truthfully; present token is used only by backend push delivery. |
| CFG-012 | Calendar env | `GET /calendar-sync/status` | Message matches actual Google OAuth and token encryption config. |

## Backend Route Contract Tests

Every route group needs four categories: success, validation failure, auth failure, and household isolation.

| ID | Area | Test Case | Expected Result |
| --- | --- | --- | --- |
| API-001 | Health | `GET /api/v1/health` with DB healthy | 200 with service ok and DB status. |
| API-002 | Global error handling | Send invalid JSON to any JSON route | 400 validation/content error, not 500. |
| API-003 | Rate limiting | Burst above configured limit | 429 with `RATE_LIMITED`, no process crash. |
| API-004 | CORS | Request from allowed and disallowed origins | Allowed frontend origins pass; unexpected origins are blocked in non-test env. |
| API-005 | Auth status | `GET /api/v1/auth/status` with Supabase configured/unconfigured | Truthful mode: `supabase`, `dev_token`, or `unconfigured`. |
| API-006 | Auth me | Valid adult bearer calls `GET /auth/me` | Returns user, profile, household state, and notification prefs. |
| API-007 | Auth profile update | `POST /auth/profile` with new name/avatar | Persists to `users` and returns updated profile. |
| API-008 | Account delete | `DELETE /auth/account` | Removes user shadow/member links and returns a truthful result. |
| API-009 | Family create | `POST /families` | Creates family and admin membership in one consistent result. |
| API-010 | Family join | `POST /families/join` with normalized invite code | Joins exactly one family and rejects unknown codes. |
| API-011 | Last admin guard | Last admin tries to leave/remove self | 409 with remediation; household is not orphaned. |
| API-012 | Members | Create, edit, delete virtual child | Child member persists, updates, and deletes without affecting adults. |
| API-013 | Members | Promote adult member to admin | Signed-in adult can be promoted; virtual child cannot. |
| API-014 | Child pairing preview | Good `KC-` code | Returns correct child name and household preview before pairing. |
| API-015 | Child pairing preview | Bad/reused/expired code | Fails safely and increments/repects pairing attempt guard. |
| API-016 | Child pairing | Pair valid child device | Returns child device token and revokes prior active device for same child. |
| API-017 | Child auth boundary | Adult token on child route, child token on adult route | Both rejected with the correct auth error. |
| API-018 | Child me | `GET /child-devices/me` | Returns child name, family, member id, avatar URL, and active device state. |
| API-019 | Child avatar | `PUT /child-devices/me/avatar` valid base64 image | Uploads to `avatars/{memberId}/avatar-*`, updates `family_members.avatar_url`, returns URL. |
| API-020 | Child avatar validation | Bad MIME, bad base64, oversized body | 400 or 413; no storage object and no DB avatar update. |
| API-021 | Child chores today | Assigned child calls `GET /chores/today` | Returns only that child's active due chores. |
| API-022 | Child chore complete | Child completes assigned chore once | Creates completion and reward once. Duplicate completion does not double-credit. |
| API-023 | Events | Create event with valid family members | Event and `event_members` persist together. |
| API-024 | Events | Cross-family member id | Rejects and does not create partial event rows. |
| API-025 | Events | Update/delete permission | Creator/admin can edit; non-admin non-creator cannot. |
| API-026 | Events | Upcoming/countdowns/single lookup | Ordering, filtering, 404, and family isolation are correct. |
| API-027 | Chores | Create/update/delete active chore | Persists changes and respects assigned member relationship. |
| API-028 | Chores | Completion history filters | Member/date filters return correct rows only. |
| API-029 | Chores | Cross-family completion | Rejects and does not create reward. |
| API-030 | Lists | Create list, add item, update item | List/item data persists with correct selected list semantics. |
| API-031 | Lists | Clear checked and delete single item | Only checked/current item rows are deleted. |
| API-032 | Lists | Missing list/item | 404 with specific code, not silent success. |
| API-033 | Meals | Create weekly meal plan item | One plan per family/week; items render with recipe/custom title. |
| API-034 | Meals | Recipe to grocery bridge | Creates or targets grocery list and avoids uncontrolled duplicates. |
| API-035 | Recipes | Create, edit, link to meal, delete | Linked meal survives recipe delete with graceful fallback title. |
| API-036 | AI status | Providers configured/unconfigured | Truthful local/provider status. |
| API-037 | AI assistant | Valid prompt with family context | Returns structured response or truthful local fallback. |
| API-038 | AI imports | Recipe/import text/meal suggest | Outputs validated drafts; provider failure falls back or reports honestly. |
| API-039 | Calendar status | Google/iCal config matrix | Status text matches env capabilities. |
| API-040 | Calendar connect | Google connect when configured | Returns auth URL with expected redirect URI. |
| API-041 | Calendar callback | Invalid state or missing config | Rejects safely, stores no connection. |
| API-042 | iCal | Safe HTTPS feed | Saves connection, manual sync imports future events, skips duplicates. |
| API-043 | iCal security | localhost/private/internal URL | Rejects to prevent SSRF-style misuse. |
| API-044 | Insights | Weekly, chores, busyness | Counts match real household data and never cross families. |
| API-045 | Notifications | List and mark read | User sees only their notifications; mark-read updates only their rows. |
| API-046 | Notifications | Daily digest preview | Preview content matches family data. |
| API-047 | Notifications jobs | Queue and send-now with jobs disabled/enabled | Disabled is truthful; enabled creates delivery work. |
| API-048 | Subscriptions | Family status | Returns current family subscription and entitlement state. |
| API-049 | Webhooks | RevenueCat webhook secret | Accepts valid secret, rejects missing/wrong secret. |
| API-050 | Security | Plus-gated routes | Missing entitlement returns 403 when `REQUIRE_PLUS=true`. |

## Database Integrity Tests

| ID | Area | Test Case | Expected Result |
| --- | --- | --- | --- |
| DB-001 | Schema drift | Compare Drizzle schema and applied migrations | No missing table/column/index needed by code. |
| DB-002 | Foreign keys | Delete family in disposable DB | Cascades household-owned rows; user auth rows stay according to intended ownership. |
| DB-003 | User/member uniqueness | Same adult joins same family twice | One membership only, no duplicate active member identity. |
| DB-004 | Invite codes | Generate many families | Invite codes remain unique and normalized join still works. |
| DB-005 | Event members | Delete event | `event_members` rows are removed. |
| DB-006 | Chore completion | Complete same chore twice concurrently | At most one reward for the same chore/member/date. If this fails, add DB-level uniqueness. |
| DB-007 | List item ordering | Add 100 items to one list | Sort order remains stable and query stays indexed by list. |
| DB-008 | Meal plan uniqueness | Concurrent create same family/week | One meal plan row for the week; no duplicate plans. |
| DB-009 | Notifications | Mark read under heavy inbox | Uses user/family indexes and does not scan unrelated families. |
| DB-010 | Child device uniqueness | Pair same child on replacement device | Old active device is revoked; new token is unique. |
| DB-011 | Child attempts | Repeated bad pairing attempts | Attempts are counted and reset window works. |
| DB-012 | Avatar persistence | Adult and child avatar updates | Correct DB column updates: adults use `users.avatar_url`, children use `family_members.avatar_url`. |
| DB-013 | Calendar imports | Sync same iCal feed twice | No duplicate imported events for the same external calendar identity. |
| DB-014 | Query plans | Run `EXPLAIN ANALYZE` for home/family/events/chores/lists | Uses family/user/member indexes, no avoidable sequential scans on large tables. |
| DB-015 | Pool pressure | 50 concurrent read requests | No connection timeout; pool recovers after burst. |

## Supabase Storage and Avatar Tests

| ID | Area | Test Case | Expected Result |
| --- | --- | --- | --- |
| STOR-001 | Bucket config | Inspect `avatars` bucket | Public/private choice is intentional; 5 MB limit and MIME allowlist are correct. |
| STOR-002 | Adult upload | Adult uploads JPEG/PNG/WebP from Settings | Object path starts with adult auth user id; `users.avatar_url` updates. |
| STOR-003 | Adult RLS deny | Adult A tries to upload into Adult B folder | Supabase rejects the write. |
| STOR-004 | Adult RLS read | Adult profile photo renders after upload | URL is readable by intended app path. |
| STOR-005 | Child upload | Paired child uploads avatar through backend | Backend service role writes storage and updates `family_members.avatar_url`. |
| STOR-006 | Child no Supabase session | Child upload without adult auth session | Works only through backend child token, never direct Supabase client upload. |
| STOR-007 | Bad MIME | Upload `text/plain` or unsupported image MIME | Rejected before storage/DB update. |
| STOR-008 | Oversized payload | Upload image over backend `bodyLimit` or bucket size | 413/400, no partial DB update. |
| STOR-009 | Missing bucket | Temporarily point staging to project without bucket | App/backend reports upload failure honestly. |

## Mobile Contract Tests Without an iPhone

These tests prove the mobile logic that talks to the backend without needing native hardware.

| ID | Area | Test Case | Expected Result |
| --- | --- | --- | --- |
| MOB-001 | API wrapper | Request without body | Does not send JSON content type. |
| MOB-002 | API wrapper | Request with JSON body | Sends JSON content type and stringified body. |
| MOB-003 | Store hydrate | Load backend household with lists/events/meals | Store preserves selected list and renders backend state. |
| MOB-004 | Store failure | Refresh fails after prior API state | Keeps last known good state; no fake wipe. |
| MOB-005 | Offline queue | Queue event/list mutations offline | Pending mutations are honest and replay only after success. |
| MOB-006 | Realtime sync | Subscribe, debounce, cleanup | Current family subscription only; cleanup on sign-out/switch. |
| MOB-007 | Assistant storage | Save/reload messages web/native variants | Household-scoped conversation history does not leak. |
| MOB-008 | Board storage | Save/reload board history web/native variants | Household-scoped board history is stable. |
| MOB-009 | Child device store | Pair, persist token, reload child shell | Child token restores only validated child session. |
| MOB-010 | Child avatar action | Mock image picker base64 and backend response | Store updates avatar URL after `PUT /me/avatar`. |

## Claude and Codex Execution Split

Use this split so one agent does not trust its own story.

| Role | Responsibility | Evidence Required |
| --- | --- | --- |
| Codex executor | Adds or runs the smallest needed tests, commands, seed checks, route probes, and load scripts. | Terminal output, changed files if any, and exact commands run. |
| Claude supervisor | Independently reads the diff, checks the route/schema/test files, and verifies outputs. | File references, command outputs, and pass/fail notes. |
| Either agent | May run read-only SQL, route probes, and Supabase config checks. | Captured response/status and expected-vs-actual result. |
| Neither agent | May mark phone-only behavior as passed without device evidence. | If phone-only, label it out of scope for this file. |

The pass condition is not "Codex said done." The pass condition is: code or config was inspected, tests were run, database behavior was checked, and the supervisor can point to evidence.

## Load and Scale Test Cases

Use staging data shaped like real households. Do not test scale with one giant fake family only; test many normal families plus a few heavy families.

### Scale Dataset

| Dataset | Families | Adults per Family | Children per Family | Events | Chores | List Items | Notifications |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| S1 smoke | 10 | 2 | 2 | 20 per family | 20 per family | 50 per family | 30 per user |
| S2 launch | 1,000 | 2 | 2 | 50 per family | 50 per family | 150 per family | 100 per user |
| S3 stress | 10,000 | 2 | 3 | 100 per family | 100 per family | 300 per family | 500 per user |
| S4 heavy household | 10 | 4 | 6 | 2,000 per family | 1,000 per family | 5,000 per family | 10,000 per family |

### Load Cases

| ID | Load Case | Pattern | Pass Threshold |
| --- | --- | --- | --- |
| LOAD-001 | Health burst | 100 concurrent for 2 minutes | p95 under 150 ms, zero 5xx. |
| LOAD-002 | Home hydrate mix | Family, events, chores, lists, meals reads | p95 under 500 ms, DB pool stable. |
| LOAD-003 | Planner writes | Create events, chores, list items at 25 concurrent | p95 under 800 ms, no duplicate/partial writes. |
| LOAD-004 | Child morning rush | 500 child devices fetch `/chores/today` | p95 under 400 ms, no adult data returned. |
| LOAD-005 | Chore completion race | Same chore completion submitted concurrently | One durable completion/reward only. |
| LOAD-006 | Grocery bridge | Many recipe/week-to-grocery requests | No runaway duplicates; list query remains fast. |
| LOAD-007 | Notifications inbox | Users with 500 to 10,000 notifications | List and mark-read remain indexed and under 500 ms p95. |
| LOAD-008 | Daily digest queue | Queue digest for 1,000 families | Worker backlog drains; failures are retried/logged, not lost. |
| LOAD-009 | Event reminder queue | Schedule/update/delete many events | Singleton keys prevent duplicate reminder jobs. |
| LOAD-010 | Calendar import | Sync large iCal feeds for many families | Future events imported, duplicates skipped, unsafe feeds rejected. |
| LOAD-011 | Avatar upload burst | 100 adult/child uploads in 5 minutes | Storage writes succeed or fail honestly; DB URLs match uploaded objects. |
| LOAD-012 | AI degradation | AI providers timeout/fail during assistant requests | API falls back or returns truthful degraded response, no thread crash. |

## Failure and Chaos Tests

These are high-value because real users hit messy conditions.

| ID | Failure Mode | How To Simulate | Expected Result |
| --- | --- | --- | --- |
| FAIL-001 | Database unavailable | Point staging backend at stopped DB | `/health` reports DB problem; app does not claim sync healthy. |
| FAIL-002 | DB slow query | Add latency/proxy or run heavy staging query | Requests time out gracefully; no process-wide lockup. |
| FAIL-003 | Supabase auth unavailable | Mock Supabase user lookup failure | Auth route rejects clearly; no dev-token fallback in production. |
| FAIL-004 | Supabase storage unavailable | Break bucket name or service role in staging | Avatar upload fails honestly, DB avatar URL not updated. |
| FAIL-005 | Expo push rejects token | Mock `DeviceNotRegistered` | Backend clears stale push token. |
| FAIL-006 | Jobs disabled | `JOBS_ENABLED=false` | Queue routes report disabled/unavailable truthfully. |
| FAIL-007 | Jobs worker crash | Kill worker during queued jobs | Status shows not started after restart gap; jobs are not marked complete falsely. |
| FAIL-008 | AI provider timeout | Mock OpenAI/Groq timeout | Assistant returns fallback/degraded response within timeout budget. |
| FAIL-009 | Google OAuth mismatch | Wrong redirect URI in staging | Calendar connect/callback fails with clear safe error. |
| FAIL-010 | Bad client JSON | Malformed body to every write group | 400, never masked 500. |
| FAIL-011 | Huge payload | More than Fastify `bodyLimit` | 413 or safe 4xx; process remains healthy. |
| FAIL-012 | DNS/backend outage | Backend hostname fails to resolve | Mobile shows truthful sign-in/connectivity message and does not erase cached state. |

## Security and Isolation Tests

| ID | Security Case | Expected Result |
| --- | --- |
| SEC-001 | No bearer token on protected adult route | 401 `AUTH_REQUIRED`. |
| SEC-002 | Invalid adult token | 401 `AUTH_INVALID`. |
| SEC-003 | Dev token in production | Rejected; production env refuses unsafe setup. |
| SEC-004 | Adult from Family A reads Family B | 403/404; no data leaked. |
| SEC-005 | Cross-family member id on event/chore/list/meal | Rejected and no partial write. |
| SEC-006 | Child token on adult route | Rejected. |
| SEC-007 | Adult token on child-device route | Rejected. |
| SEC-008 | Revoked child device token | Rejected after unpair/replacement. |
| SEC-009 | Child completes other child's chore | Rejected. |
| SEC-010 | Non-admin edits admin-only household data | Rejected. |
| SEC-011 | Last admin delete/leave | Blocked. |
| SEC-012 | RevenueCat webhook wrong secret | 401/503. |
| SEC-013 | iCal local/private URL | Rejected. |
| SEC-014 | Storage path traversal in avatar path/payload | Rejected; server controls object path. |
| SEC-015 | Logs with secrets/tokens | Logs redact bearer tokens, push tokens, OAuth tokens, and service-role secrets. |

## Performance Budgets

| Surface | Budget |
| --- | --- |
| `/health` | p95 under 150 ms. |
| `/auth/me` | p95 under 400 ms. |
| `/families/:id` | p95 under 500 ms for normal family, under 900 ms for heavy family. |
| `/events`, `/chores/today`, `/lists` | p95 under 500 ms for normal family. |
| Write routes | p95 under 800 ms under launch load. |
| Avatar upload | p95 under 2 seconds for images under 1 MB. |
| Daily digest preview | p95 under 1 second for normal family. |
| Job queue drain | 1,000 digest jobs drain within 10 minutes on staging worker size. |
| DB pool | No connection timeout under approved load test. |
| 5xx rate | Under 0.1 percent for non-chaos load tests. |

## CI Gate

Minimum CI should block merges on:

```powershell
npm run typecheck
npm --workspace apps/backend run test
```

Recommended staging pre-release gate:

```powershell
npm run typecheck
npm --workspace apps/backend run db:check
npm --workspace apps/backend run test
npm --workspace apps/backend run verify:dev
```

Manual approval is required if:

- Any P0 route test fails.
- Any cross-family isolation test fails.
- Any DB migration requires manual repair.
- Any avatar/storage test writes DB URL without a real object.
- Any jobs test creates duplicate reminders or duplicate rewards.
- Any load test causes DB pool exhaustion.

## P0 Must-Pass List

Do not call the backend ready for many users unless these pass:

- `CFG-003`, `CFG-006`, `CFG-007`, `CFG-008`
- `API-001` through `API-022`
- `API-023` through `API-035`
- `API-045` through `API-050`
- `DB-001` through `DB-015`
- `STOR-001` through `STOR-009`
- `MOB-001` through `MOB-010`
- `LOAD-001` through `LOAD-005`
- `SEC-001` through `SEC-015`

## Out Of Scope For This Agent-Only Plan

The backend, database, storage, route contracts, jobs, and mobile API/store logic can be proven without an iPhone. The items below are not required for this file to pass because Claude/Codex cannot honestly prove them from terminal-only execution:

- Native photo permission prompt and image picker UX.
- Real push permission prompt and receipt of an actual Expo push notification.
- App foreground/background lifecycle.
- TestFlight or production build upgrade over an existing install.
- OAuth browser handoff returning into the installed app.

Those belong in a separate release-device checklist. They should not block this backend/database confidence gate.

## Final Definition of Done

The app is backend-ready for a large user count when:

- Go 1 passes cleanly.
- Go 2 passes against staging with launch-sized data.
- Every P0 test has evidence, not guesses.
- No cross-family, adult/child, or storage boundary test fails.
- Database query plans for hot routes use indexes.
- Jobs can be enabled without duplicate reminders or stuck backlog.
- Avatar uploads work for adult and child paths.
- Failure states are truthful instead of fake success.

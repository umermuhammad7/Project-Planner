# HomeThread Final Runtime Checklist

Use this checklist on physical iPhone builds only. Code changes stay paused until failures are logged with evidence.

## Prep

- Install the current iPhone build (`dev client` or `TestFlight`) pointed at the real backend and Supabase environment.
- Confirm network is stable and the `EXPO_PUBLIC_API_URL` host is reachable from the phone.
- Use two accounts for adult flows:
  - `Adult A` creates the household
  - `Adult B` joins it
- Use a third device or a fresh install for child pairing.

## A. App Startup and Session

| ID | Step | Expected Result |
| --- | --- | --- |
| A1 | Cold launch app (kill + reopen) | Splash -> "Checking your session" briefly; no crash; no wrong-tab flash |
| A2 | Launch while signed out | Welcome screen with HomeThread branding |
| A3 | Launch while signed in with household | Passes session check -> "Connecting to HomeThread" -> Home tab with household name and sync pill |
| A4 | Background app 30s, foreground | Same household; no forced sign-out; no duplicate loading loop |
| A5 | Toggle airplane mode on/off while in app | Offline banner may appear; Refresh on Home recovers when network returns |

## B. Welcome and Sign-In

| ID | Step | Expected Result |
| --- | --- | --- |
| B1 | Welcome -> Continue with Google (new user path) | iOS/Google prompt -> returns to app -> family-setup (create/join), not main tabs yet |
| B2 | Welcome -> email/password Register | Account created or clear error; if no household, lands on family-setup |
| B3 | Welcome -> email/password Sign in (existing user with household) | Enters app -> Home after sync |
| B4 | Welcome -> Set up child's device | Child device setup screen (KC- code entry), not adult shell |
| B5 | Sign out from Settings -> relaunch | Back to Welcome; no stale household data on Home |

## C. Create Household (Adult A)

| ID | Step | Expected Result |
| --- | --- | --- |
| C1 | After sign-in, Create household tab -> enter name -> create | Success; adult invite code shown (not KC-) |
| C2 | Copy invite code | Copy feedback; code pasteable |
| C3 | Tap through to enter app | Home loads; sync pill shows connected state |
| C4 | More -> Household (or Home -> Quick access -> Household) | Household screen opens; Adult A shows Owner or Admin truthfully |
| C5 | Regenerate adult invite code (admin) | New code; confirmation copy warns old code stops working |

## D. Join Household (Adult B)

| ID | Step | Expected Result |
| --- | --- | --- |
| D1 | Adult B: Google sign-in -> Join household | Join form visible |
| D2 | Enter adult invite code (not KC-) | Join succeeds; enters app |
| D3 | Adult B: More -> Household | Sees household; label Admin or Member (not Owner unless creator) |
| D4 | Adult B: try KC- code in join field | Rejected with adult-invite-required style message |

## E. Child Profile and KC Pairing

| ID | Step | Expected Result |
| --- | --- | --- |
| E1 | Adult A: Household -> Add child profile | Child appears under Child profiles |
| E2 | Generate pairing code for child | KC- code shown with expiry; survives leaving and reopening Household |
| E3 | Child phone: Welcome -> Set up child's device -> enter KC- -> Continue | Confirm pairing shows correct household name and child name |
| E4 | Confirm pair on child device | Child shell opens (chores-focused); not adult tabs |
| E5 | Adult A: Household shows active paired device for that child | Device listed as active |
| E6 | Generate new KC- for same child -> pair on child phone again | New pair succeeds; old device loses access on next check-in |
| E7 | Adult A: Revoke device in Household | Child device gets unpaired/auth invalid on next use |
| E8 | Wrong KC- on child device | Clear error; no partial pair |

## F. Home

| ID | Step | Expected Result |
| --- | --- | --- |
| F1 | Home header | Home eyebrow, greeting, household name, today date, member pill |
| F2 | Avatar tap | Settings opens |
| F3 | Quick access -> Household / Insights (preview) | Correct overlay screens |
| F4 | Ask assistant / hero actions | Routes to Assistant (More -> Assistant) |
| F5 | Refresh | Sync message updates; no stuck "Refreshing..." |

## G. Plan

| ID | Step | Expected Result |
| --- | --- | --- |
| G1 | Plan tab -> create event (title, date, time, member) | Saves; appears in list |
| G2 | Expand event -> Details | Metadata visible; member names (not raw parent/kid) |
| G3 | Edit event | Changes persist after refresh |
| G4 | Delete event | Removed; stays gone after refresh |
| G5 | Household member pills on Plan | Show Child / Adult / Adult admin, not internal role strings |

## H. Chores

| ID | Step | Expected Result |
| --- | --- | --- |
| H1 | Chores -> Add chore | Form opens; save succeeds |
| H2 | New chore label | "Daily - anytime" or "Daily - by {time}" |
| H3 | Mark done | Moves to Finished; stars update for assigned child if applicable |
| H4 | Edit chore (title, time, assignee) | Updates persist after refresh |
| H5 | Delete chore (confirm) | Removed for all adults after refresh |
| H6 | Child device: see assigned chore -> complete | Completes on child; reflects on parent after refresh |

## I. Lists

| ID | Step | Expected Result |
| --- | --- | --- |
| I1 | Lists tab -> New list (top) | Create form prominent; first list creates successfully |
| I2 | Switch list pills | Items scope to selected list |
| I3 | Add item | Item appears; brief check/uncheck feedback |
| I4 | Check/uncheck items | State persists after refresh |
| I5 | Clear checked | Checked items removed |

## J. Meals

| ID | Step | Expected Result |
| --- | --- | --- |
| J1 | More -> Meals | Week plan visible |
| J2 | Add meal (day, type, title) | Saves with success feedback |
| J3 | Paste/import recipe text -> save recipe with ingredients | Ingredients listed |
| J4 | Add to grocery / week-to-grocery if shown | Items land on Lists/grocery |

## K. Family Board

| ID | Step | Expected Result |
| --- | --- | --- |
| K1 | More -> Family board | Board history loads (device-local + server activity) |
| K2 | Add summary to board | Entry appears in board feed |
| K3 | Import/paste family text -> save draft to household | Success feedback; plan/chore/list created as expected |
| K4 | Leave board and return | Thread/history still visible (not wiped) |

## L. Assistant

| ID | Step | Expected Result |
| --- | --- | --- |
| L1 | More -> Assistant | Welcome message; composer pinned at bottom on long thread |
| L2 | Ask actionable prompt (e.g. "Add milk and eggs") | Draft card appears |
| L3 | Save to HomeThread on draft | Saves; feedback scoped to Assistant |
| L4 | Meal-plan prompt -> Add to meals on suggestion | Meal appears under Meals |
| L5 | Scroll up in long thread, wait for new reply | Does not yank scroll to bottom while reading |
| L6 | Leave Assistant -> return | Conversation persists on same device/household |

## M. Settings and Notifications

| ID | Step | Expected Result |
| --- | --- | --- |
| M1 | More -> Settings or Home avatar | Settings opens |
| M2 | Change display name -> Save profile | Persists after close/reopen |
| M3 | Change photo (Supabase user) | Upload succeeds; avatar on Home updates |
| M4 | Enable notifications / Refresh push token | Button shows "Working..." and is disabled while in flight; permission prompt if needed |
| M5 | Toggle notification prefs (event/chore/daily) | Saves when online |
| M6 | Delete account while offline | Button disabled + explanatory copy |

## N. Leave Household and Rejoin

| ID | Step | Expected Result |
| --- | --- | --- |
| N1 | Non-sole admin: Household -> Leave household -> Confirm | Returns to Welcome/family-setup explicitly |
| N2 | Sole admin: leave blocked | Warning: promote another admin first |
| N3 | Rejoin with adult invite code | Household data returns after sync |
| N4 | Adult who left: prior device-local assistant/board history | Does not leak into new household (scoped by familyId) |

## O. Sign Out and Sign Back In

| ID | Step | Expected Result |
| --- | --- | --- |
| O1 | Settings -> Sign out | Welcome screen; tabs hidden |
| O2 | Sign back in same account | Correct household restores |
| O3 | Sign in different account | No cross-household data bleed |

## Highest-Risk Runtime Areas

- Google sign-in on real iPhone: redirect URI, Safari/ASWebAuthenticationSession, return-to-app handoff
- Child device bootstrap: must not flash adult shell; paired vs unpaired detection after kill/reopen
- KC pairing confirm + revoke/re-pair: wrong-child prevention, expiry, old device logout timing
- Session refresh (`TOKEN_REFRESHED`): long session without full re-bootstrap breaking API calls
- Hydration race: "Connecting to HomeThread" stuck, empty lists/chores despite connected pill
- Push notifications: permission + token save on physical device
- Leave household transition: must land on Welcome/family-setup, not ghost adult UI
- Offline/flaky network: create actions queue vs fail; refresh recovery; delete-account disabled offline
- Assistant on device: sticky composer + scroll behavior with iOS keyboard
- `P2-09` known ops gap: rapid repeated wrong KC attempts may rate-limit per server process, not globally

## If a Step Fails, Collect This Evidence

Always capture:

- device model
- iOS version
- build type (`dev client` or `TestFlight`)
- timestamp
- Adult A and Adult B account emails
- household name
- whether the sync pill said connected

| Area | Screen | Action | Symptom to Note | Evidence |
| --- | --- | --- | --- | --- |
| Startup | Welcome / Connecting | Cold launch | Infinite spinner, wrong shell, crash | Screen recording; time stuck on each screen; Metro/device logs if dev build |
| Google auth | Welcome | Continue with Google | No return, error toast | Exact message; iOS URL-scheme error; Supabase auth logs |
| Create/join | Welcome family-setup | Create or join | 4xx/5xx, stuck on setup | Invite code shown or not; API error body; account familyId state |
| Adult invite | Household | Copy/regenerate/join | Wrong code type accepted | Code string; whether KC- vs adult code; backend response |
| KC pair | Child setup -> Confirm | Enter KC-, confirm | Wrong household/child, expiry | Preview screen text; code used; expiry shown on parent Household |
| Child shell | Child device | Reopen after pair | Adult tabs flash | Recording of first 3 seconds after launch |
| Revoke/re-pair | Household + child | Revoke then re-pair | Old device still active | Device list before/after; child `/me` behavior |
| Plan | Plan | Create/edit/delete | Validation stuck, data loss | Field values; inline errors; after Refresh still wrong |
| Chores | Chores | Edit/delete/complete | 404, UI revert | Chore id; whether second adult sees change |
| Lists | Lists | New list top flow | Form buried / create fails | Screenshot of list order; selected list id |
| Board | More -> Family board | Import/save | Draft not committed | Import text; save outcome message |
| Assistant | More -> Assistant | Long thread + save | Scroll jump, wrong save text | Thread length screenshot; save message source |
| Settings | Settings | Photo/notifications/delete | Silent fail, double tap | Button disabled state; permission status in iOS Settings |
| Leave/rejoin | Household -> Leave | Confirm leave | Empty Home, no setup | Whether Welcome appeared; need family-setup |
| Sign out/in | Settings | Sign out -> sign in | Wrong household | Which account email; member list screenshot |

## Stop Conditions - Do Not Build Yet If

- Cannot complete core onboarding: Google sign-in, create household, or join with adult invite code fails reliably
- Child pairing is broken: KC- preview/confirm wrong, pair fails for valid code, or child opens adult shell
- Session instability: cold-start loops, random sign-out, or hydrate never completes on good network
- Data trust failures: cross-household bleed after leave/rejoin/sign-out; wrong child paired without user override
- Critical planner regressions: Plan create/save completely broken; chore edit/delete API errors for all users on connected sync
- Leave-household trap: user stuck on empty Home with no path to family-setup/Welcome
- Auth/account safety failure: delete account works online but deletes wrong user; or offline delete appears to succeed silently

## Non-Blocking - Log and Track

- `P2-09` scaled rate-limit hardening
- Insights partial section failures
- Assistant device-local-only thread sync
- Chores being daily (not calendar-dated) by design
- Billing preview tiers non-functional
- Cosmetic copy/spacing issues with a clear workaround

## Suggested Test Order

Use one iPhone session in this order:

`A -> B -> C -> D -> E -> F -> G -> H -> I -> J -> K -> L -> M -> N -> O`

Use a second phone only for:

- `D` second-adult join
- `E6-E7` child re-pair and revoke behavior

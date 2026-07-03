# HomeThread Phone-Only Full App UAT

This is the practical, phone-in-hand release test runbook for a single tester using one mobile phone.

It is written for the exact situation where you want to validate the entire app as a real user, including:

- first adult setup
- wife/second-adult join
- child profile setup
- child device pairing
- planning flows
- settings and profile
- calendar sync
- recovery and relaunch behavior

It is intentionally sequential and release-focused.

## Goal

Use one phone to test as much of the real product as possible before shipping.

This file covers the entire app surface. Where one-phone testing cannot fully prove a scenario, the limitation is called out explicitly so you can mark it as `PARTIAL` instead of guessing.

## Result Labels

Use these exact labels while testing:

- `PASS` - you saw the expected behavior
- `FAIL` - you saw broken behavior
- `BLOCKED` - you could not continue because of account, build, env, or device limitations
- `PARTIAL` - one-phone testing covered the flow sequentially, but not simultaneous multi-device behavior

## Before You Start

Record these first:

- build number
- app version
- backend environment URL
- test date
- device model
- iOS version

Prepare these accounts and inputs:

- `Adult A` email with mailbox access
- `Adult B` email with mailbox access
- one Google account if you want to test Google sign-in
- one valid photo in the phone library
- one valid HTTPS iCal feed URL if you want calendar import coverage

Important one-phone rule:

- Do **not** test child pairing until all adult and household tests are finished.
- Pairing the phone as a child device will take over the app shell.
- Child pairing should be one of the last steps.

## One-Phone Limits You Should Expect

These items can still be tested, but only sequentially, not simultaneously:

- Adult A creates data, signs out, Adult B signs in, verifies shared data
- Adult B changes data, signs out, Adult A signs in, verifies it persisted
- Child completes a chore, then the phone is reset back to adult mode to verify parent-visible result

These items are only `PARTIAL` on one phone:

- live simultaneous realtime sync between two active adult sessions
- push delivery to two active devices at the same time
- old child device versus replacement child device side-by-side

## Required Test Order

Follow this order exactly. It minimizes resets and avoids losing the adult shell before you finish the core release checks.

### Phase 1 - Install, Launch, and Welcome

1. Fresh install the build on the phone.
2. Launch the app.
3. Confirm startup does not crash.
4. Confirm Welcome shows:
   - create household
   - join household
   - child device entry
5. Switch between create and join from Welcome.
6. Confirm email/password fields clear across create <-> join switching.

Expected:

- app launches cleanly
- Welcome is coherent
- create/join switching does not leak values

Capture:

- screenshot of Welcome
- screenshot/video of create/join switching

### Phase 2 - Adult A Sign-Up / Sign-In

Choose one path and then optionally test the other later:

- email/password sign-up
- email/password sign-in
- Google sign-in

Test:

1. Sign in as `Adult A`.
2. If using email sign-up, confirm mailbox flow works.
3. If using Google, confirm the app returns to the correct post-auth state.
4. Test invalid password once.
5. Test unknown account once.

Expected:

- valid auth reaches household setup or shell
- invalid auth fails clearly
- Google flow returns safely or fails truthfully

Capture:

- screenshot of successful auth landing
- screenshot of invalid password message

### Phase 3 - Adult A Creates Household

1. Choose `Create household`.
2. Enter household name.
3. Finish setup.
4. Confirm `Adult A` becomes admin.
5. Confirm adult invite code is visible.
6. Copy the invite code and paste it somewhere safe.

Expected:

- household is created
- correct household name is shown
- invite code is visible and copyable

Capture:

- screenshot of household shell
- screenshot of invite code

### Phase 4 - Adult A Core Personalization

1. Open Settings from the adult shell.
2. Change display name.
3. Upload a profile photo.
4. Test photo permission flow if prompted.
5. Enable notifications if supported.
6. Toggle notification preferences.
7. Return to Home.

Expected:

- display name persists
- avatar updates truthfully
- notification state is truthful
- shell remains stable

Capture:

- screenshot before and after profile photo
- screenshot of notification settings state

### Phase 5 - Household Management As Adult A

1. Open Household / Family management.
2. Rename the household.
3. Verify rename persists after leaving and returning.
4. Regenerate the adult invite code.
5. Confirm old code is no longer considered current.
6. Add at least one child profile.
7. Edit the child profile name once.
8. Review member roster and role labels.

Expected:

- rename persists
- new invite code replaces old one
- child profile appears correctly
- labels and roles are accurate

Capture:

- screenshot of renamed household
- screenshot of new invite code
- screenshot of child profile list

### Phase 6 - Adult B (Wife) Join Flow On The Same Phone

1. Sign out of `Adult A`.
2. Sign in as `Adult B` on the same phone.
3. Choose `Join household`.
4. Paste the current adult invite code.
5. Finish join.
6. Confirm the same household name appears.
7. Review shared data already created by `Adult A`.

Expected:

- join succeeds
- Adult B enters the same household
- shared data is visible

This is a one-phone sequential verification, so mark it:

- `PASS` for persistence/share correctness
- `PARTIAL` for live simultaneous sync proof

Capture:

- screenshot of Adult B in the same household

### Phase 7 - Shared Household Verification By Switching Accounts

Test sequential shared-state behavior:

1. As `Adult B`, add or edit:
   - one event
   - one chore
   - one list item
2. Sign out.
3. Sign back in as `Adult A`.
4. Verify all three changes are present.
5. As `Adult A`, add:
   - one meal
   - one board/family thread update
6. Sign out.
7. Sign in again as `Adult B`.
8. Verify the meal and board update are present.

Expected:

- household data is shared correctly between adults
- no cross-user corruption

Capture:

- one screenshot per account showing the same household data

### Phase 8 - Core Planner Coverage

As an adult in the household, test all primary creation flows:

#### Events

1. Create an event.
2. Edit the event.
3. Delete an event you do not need.
4. Confirm event ordering/upcoming view makes sense.

#### Chores

1. Create a chore.
2. Create one assigned chore and one unassigned chore.
3. Edit a chore.
4. Complete a chore from adult side if that path exists.
5. Open chore history and confirm filters look correct.

#### Lists / Grocery

1. Create a custom list.
2. Add several items.
3. Check and uncheck an item.
4. Delete a single item.
5. Clear checked items.
6. Confirm selected list stays correct after navigating away and back.

#### Meals / Recipes

1. Add a meal to the week.
2. Create a saved recipe.
3. Edit the recipe.
4. Link the recipe to a meal.
5. Delete the recipe.
6. Confirm the linked meal still has a stable title.
7. Send recipe ingredients to grocery.
8. Send week ingredients to grocery.

#### Assistant

1. Ask the assistant for:
   - a chore
   - a list
   - a plan item
2. Save at least one returned draft.
3. Ask for meal suggestions if available.
4. Save one assistant-derived meal if supported.

#### Family Board / Thread

1. Add a board update.
2. Leave and return.
3. Confirm history still exists.

Expected:

- every major planning surface can be used without fake success
- deleted or edited items behave truthfully
- recipe deletion does not break linked meal title

Capture:

- screenshot of one completed example per surface

### Phase 9 - Home, More, Insights, Notifications

1. Open Home.
2. Confirm greeting, household name, and summary cards look coherent.
3. Open More and enter:
   - Meals
   - Family Board
   - Assistant
   - Household
   - Insights
   - Settings
4. Open Insights and review:
   - weekly summary
   - chore-related insights
   - busyness view
5. Open/inspect notifications if available.
6. Mark at least one notification read.

Expected:

- navigation works
- back navigation is safe
- insights and notifications feel internally consistent with your created data

Capture:

- screenshot of Home
- screenshot of Insights
- screenshot of notification state

### Phase 10 - Calendar Sync

Test whichever path is available:

#### Google Calendar

1. Open Calendar Sync.
2. Start Google connect.
3. Confirm browser/provider handoff works.
4. Return to app.
5. Refresh status.

#### iCal

1. Paste a valid HTTPS iCal URL.
2. Save it.
3. Run sync.
4. Confirm imported events appear truthfully.

Expected:

- sync path works end to end, or
- the app truthfully tells you what is blocked

Capture:

- screenshot of sync status
- screenshot of connected calendar or honest error

### Phase 11 - Recovery, Relaunch, and Sign-In Safety

1. Kill the app.
2. Reopen it while signed in as an adult.
3. Confirm the same household loads.
4. Background and foreground the app several times.
5. Sign out.
6. Sign back in as the same user.
7. Confirm no household data is lost.
8. If possible, briefly disable network and relaunch to see whether the app behaves honestly.

Expected:

- no random sign-out
- no broken empty shell
- no fake save state while offline

Capture:

- screenshot after relaunch
- note any stale or missing data

### Phase 12 - Child Pairing (Do This Near The End)

Important:

- This should be done after adult validation because the same phone will become the child device.

Steps:

1. As `Adult A`, make sure a child profile exists.
2. Generate a `KC-...` pairing code.
3. Sign out or reinstall if needed so the phone can return to Welcome.
4. Choose `Set up child's device`.
5. Enter the valid `KC-...` code.
6. Confirm preview shows the correct household and child.
7. Complete pairing.
8. Confirm child shell opens.
9. Complete one assigned chore from the child shell.
10. Confirm star/reward state updates on child side.

Expected:

- preview is correct
- child shell is correct
- no adult-shell flash
- chore completion persists

Capture:

- screenshot of preview
- screenshot of child shell
- screenshot after chore completion

### Phase 13 - Return From Child Back To Adult Verification

Because you only have one phone, you now need to get back to adult mode and verify the parent sees the child result.

Steps:

1. Unpair the child device from the child shell if that path is available.
2. If needed, reinstall or relaunch the app.
3. Sign back in as `Adult A`.
4. Open the chore/reward history.
5. Confirm the completed child chore is visible on the adult side.

Expected:

- child completion is visible to adult
- stale child session does not keep reopening incorrectly

Capture:

- screenshot of adult view showing child completion

### Phase 14 - Destructive / End-of-Test Safety Paths

Do these only after everything else:

1. Password update
2. Password reset request
3. Last-admin leave protection
4. Admin promotion and leave-after-promotion
5. Account deletion path

Expected:

- destructive actions are explicit and truthful
- unsupported paths explain why

## Full-App Coverage Checklist

Mark each line while testing:

- [ ] Fresh install and first launch
- [ ] Welcome create/join switching
- [ ] Email auth success
- [ ] Invalid login handling
- [ ] Google sign-in path or truthful block
- [ ] Adult A household creation
- [ ] Adult invite copy/regenerate
- [ ] Household rename
- [ ] Adult B join on same phone
- [ ] Shared household persistence across account switching
- [ ] Child profile create/edit
- [ ] Event create/edit/delete
- [ ] Chore create/edit/complete/history
- [ ] List create/item add/check/delete/clear
- [ ] Meal create
- [ ] Recipe create/edit/link/delete
- [ ] Recipe-to-grocery
- [ ] Week-to-grocery
- [ ] Assistant draft/save
- [ ] Family Board save/history
- [ ] Home and More navigation
- [ ] Insights weekly/chore/busyness
- [ ] Notifications read state
- [ ] Settings display name
- [ ] Profile photo upload
- [ ] Notification permissions / prefs
- [ ] Calendar sync
- [ ] App relaunch while signed in
- [ ] Background/foreground stability
- [ ] Offline honesty check
- [ ] Child pairing preview
- [ ] Child shell
- [ ] Child chore completion
- [ ] Adult sees child completion afterward
- [ ] Password / account safety flows

## One-Phone Items To Mark As Partial

If you only have one phone, these are usually `PARTIAL` rather than fully proven:

- true live simultaneous adult-to-adult sync while both devices are open
- true simultaneous parent and child push delivery
- child replacement-phone takeover versus old phone revocation at the same time
- full real-time subscription attach/cleanup behavior across two live sessions

## Fail-Fast Release Blockers

Do not call the app shippable if any of these fail:

- Adult A cannot create a household
- Adult B cannot join the same household
- valid `KC-...` code does not pair cleanly
- event/chore/list/meal saves claim success but disappear
- profile photo path is untruthful
- relaunch breaks the shell
- calendar sync lies about connected state
- switching accounts leaks old household data

## Final Verdict Line

When you finish, write one line for yourself:

`READY TO SHIP`

or

`NOT READY TO SHIP - blockers: ...`

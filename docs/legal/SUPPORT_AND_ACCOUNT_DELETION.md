# HomeThread Support And Account Deletion

Status: Draft for website, app Settings, and App Review notes
Last updated: July 25, 2026

## Public Support Information

Support email: `trendygrovee@gmail.com`

Privacy email: `trendygrovee@gmail.com`

Support URL: `https://vocal-malabi-9e6f2f.netlify.app/support/`

Privacy Policy URL: `https://vocal-malabi-9e6f2f.netlify.app/privacy/`

Terms URL: `https://vocal-malabi-9e6f2f.netlify.app/terms/`

Account deletion URL: `https://vocal-malabi-9e6f2f.netlify.app/account-deletion/`

Expected response time: within 3 business days

## In-App Support Copy

Title: Help and support

Body:

If something is not working, contact HomeThread support. Include the email address you use for HomeThread, your household name if relevant, your device type, and a short description of what happened.

Button label:

Contact support

## Account Deletion Path

Current in-app path:

Settings -> Delete account

Current behavior in the app/backend:

- The user must be signed in with a real Supabase-backed account.
- Developer sessions cannot delete accounts from the app.
- The backend calls Supabase admin deletion for the authenticated user.
- The backend removes the user's `family_members` rows.
- The backend removes the user's `users` profile row.
- The app signs the user out after deletion succeeds.

Important product/legal note:

The current deletion flow removes the adult account and adult membership links. It does not necessarily delete every piece of shared household content the adult created, because household events, chores, recipes, lists, and child data may belong to a shared household with other members.

## Public Account Deletion Copy

Title: Delete your HomeThread account

Body:

You can delete your signed-in HomeThread account from inside the app.

Steps:

1. Open HomeThread.
2. Go to Settings.
3. Scroll to Delete account.
4. Tap Delete account.
5. Confirm the action if prompted.

Deleting your account removes your HomeThread profile and adult membership access. Some shared household content may remain if it belongs to a household with other members, is needed for security, or must be retained for legal, tax, audit, backup, or fraud prevention reasons.

If you cannot access the app, contact `trendygrovee@gmail.com` from the email address connected to your HomeThread account and ask for account deletion.

## Child Data Deletion

Parents, guardians, or authorized household admins can request deletion of child profile data.

Recommended support copy:

To delete a child profile or child device information, contact `trendygrovee@gmail.com` with the household name, the adult account email, and the child profile name. We may ask you to verify that you are an authorized adult for that household.

## App Review Notes Draft

Use this in App Store Connect review notes after replacing placeholders:

HomeThread is a family coordination app. Adults create or join a household using their own Apple, Google, or email account. Adults can invite other adults with an adult invite code. Child profiles are created by adults, and child devices are paired using a separate child pairing code.

Account deletion is available in the app at Settings -> Delete account for signed-in production accounts.

Privacy Policy: `https://vocal-malabi-9e6f2f.netlify.app/privacy/`

Terms: `https://vocal-malabi-9e6f2f.netlify.app/terms/`

Support: `https://vocal-malabi-9e6f2f.netlify.app/support/`

Demo access:

- Demo adult account: `{{APP_REVIEW_DEMO_EMAIL}}`
- Demo password or sign-in notes: `{{APP_REVIEW_DEMO_PASSWORD_OR_NOTES}}`
- Demo household/invite notes: `{{APP_REVIEW_DEMO_HOUSEHOLD_NOTES}}`
- Child pairing notes: `{{APP_REVIEW_CHILD_PAIRING_NOTES}}`

If reviewing Sign in with Apple or Google sign-in, please use the normal sign-in buttons. If backend services are required, they are live during review at `{{PRODUCTION_API_URL}}`.

## App Store Metadata Support Fields

Use these values in App Store Connect after placeholders are finalized:

- Support URL: `https://vocal-malabi-9e6f2f.netlify.app/support/`
- Marketing URL: `{{MARKETING_URL}}`
- Privacy Policy URL: `https://vocal-malabi-9e6f2f.netlify.app/privacy/`
- Privacy Choices URL: `https://vocal-malabi-9e6f2f.netlify.app/account-deletion/`
- Copyright: Trendygrovee
- Contact email: `trendygrovee@gmail.com`
- Contact phone: `{{SUPPORT_PHONE}}`

## Final Checks Before Submission

- Confirm the Support URL is public and not behind sign-in.
- Confirm the Privacy Policy URL is public and not behind sign-in.
- Confirm the Terms URL is public and not behind sign-in.
- Confirm account deletion works on the production backend.
- Confirm deletion does not show stack traces or raw backend errors.
- Confirm App Review can access a demo account or full demo mode.
- Confirm the backend is live for the entire review window.
- Confirm the privacy policy names all third parties actually included in the app build.

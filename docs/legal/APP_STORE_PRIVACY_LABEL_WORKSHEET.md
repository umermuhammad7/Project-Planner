# HomeThread App Store Privacy Label Worksheet

Status: Draft for App Store Connect
Last updated: July 25, 2026
Operator: Trendygrovee
Support/privacy email: `trendygrovee@gmail.com`

This worksheet translates HomeThread's current product and codebase into the privacy answers Apple asks for in App Store Connect.

Important: App Store Connect answers must match the app build actually submitted. If a feature is hidden or disabled at launch, update this worksheet before entering final answers.

## Public URL Launch Blocker

Trendygrovee has public legal URLs available for Apple submission:

- Privacy Policy: `https://vocal-malabi-9e6f2f.netlify.app/privacy/`
- Terms of Service: `https://vocal-malabi-9e6f2f.netlify.app/terms/`
- Support: `https://vocal-malabi-9e6f2f.netlify.app/support/`
- Account deletion/help: `https://vocal-malabi-9e6f2f.netlify.app/account-deletion/`

Use the Privacy Policy URL above in App Store Connect.

## Apple Requirements To Remember

Apple requires a privacy policy URL for iOS apps and requires developers to explain app data handling practices in App Store Connect. Apple also says privacy answers must include data collected by third-party partners integrated into the app.

Apple's App Review Guidelines require a privacy policy link in App Store Connect metadata and inside the app in an easily accessible place. The policy must identify collected data, explain usage, identify third-party sharing, and explain retention/deletion.

## Tracking

Recommended answer:

No, HomeThread does not track users across apps or websites owned by other companies for targeted advertising or advertising measurement.

Use this only if true at submission:

- No advertising SDK.
- No IDFA usage.
- No third-party data broker sharing.
- No cross-app behavioral advertising.

If any ad network, attribution SDK, retargeting SDK, or data broker sharing is added later, this answer must be revisited.

## Children, Kids Category, And Age Positioning

Recommended positioning:

HomeThread is a family coordination app for adults managing household life. It includes adult-managed child profiles and paired child device features, but children should not create adult accounts.

Recommended App Store category stance unless you intentionally choose otherwise:

- Do not submit as an Apple Kids Category app by default.
- Do not use metadata like `for kids`, `for children`, or `kids app` unless you are intentionally complying with Kids Category expectations.
- Use wording like `for families`, `for households`, `adult-managed child profiles`, and `paired child device`.

Why this matters:

The app handles child-related data, so the privacy policy and privacy labels must disclose child profile/device data. But that does not automatically mean the whole app should be marketed as primarily child-directed.

## Data Categories Likely Collected

### Contact Info

Likely selected:

- Email Address.
- Name, if display name is entered or provided by auth provider.
- Phone Number, only if the profile phone field is enabled and used.

Purpose:

- App Functionality.
- Account Management.
- Customer Support.

Linked to user:

Yes.

Tracking:

No.

Notes:

Adult accounts use email sign-in, Apple, or Google. Display name is stored in the user profile.

### User Content

Likely selected:

- Photos or Videos, if avatars, recipe images, or chore completion photos are uploaded.
- Customer Support, if support requests are collected through email or a form.
- Other User Content, for chores, events, lists, meals, recipes, notes, assistant prompts, household names, child profile names, rewards, and shared family content.

Purpose:

- App Functionality.
- Customer Support.

Linked to user:

Yes.

Tracking:

No.

Notes:

Most HomeThread content is intentionally shared with members of the same household.

### Identifiers

Likely selected:

- User ID.
- Device ID, if child device tokens, push tokens, or diagnostic identifiers are considered device identifiers.

Purpose:

- App Functionality.
- Developer Advertising or Marketing: No, unless a marketing SDK is added.
- Analytics: only if diagnostics/analytics are used for product analytics.
- Fraud Prevention, Security, and Compliance.

Linked to user:

Yes.

Tracking:

No.

Notes:

Supabase user ID, child device token, Expo push token, and RevenueCat app user ID may be used.

### Purchases

Likely selected if subscriptions are enabled:

- Purchase History.

Purpose:

- App Functionality.
- Account Management.

Linked to user:

Yes.

Tracking:

No.

Notes:

The app has RevenueCat integration and subscription status fields. If paid features are not enabled at launch, confirm whether RevenueCat still collects purchase/subscription identifiers in the submitted build.

### Location

Likely selected if event locations or travel reminders are enabled:

- Precise Location: only if the app requests live device location or stores precise coordinates.
- Coarse Location: only if the app requests approximate live location.

Recommended current answer if no live device location permission is requested:

Do not select Location for device location collection.

But consider:

HomeThread stores event locations and optional event coordinates entered/imported as user content. If App Store Connect asks where location-like user-entered event data belongs, classify it consistently as User Content or Location according to Apple's current questionnaire wording.

Purpose:

- App Functionality.

Linked to user:

Yes if stored with the household.

Tracking:

No.

### Contacts

Recommended answer:

Do not select Contacts unless the app asks for the device contacts permission or uploads address book data.

Notes:

Adult invite codes do not require uploading contacts.

### Search History

Recommended answer:

Do not select unless the app stores user search queries.

### Browsing History

Recommended answer:

Do not select unless the app tracks websites viewed by users.

Notes:

Recipe source URLs or iCal URLs entered by users are better treated as User Content unless the app collects browsing history.

### Usage Data

Likely selected if analytics or Sentry performance/session tracking is enabled:

- Product Interaction.
- Other Usage Data.

Purpose:

- App Functionality.
- Analytics, only if used for product analytics.
- Fraud Prevention, Security, and Compliance.

Linked to user:

Possibly yes, unless deliberately de-identified before collection and not linked later.

Tracking:

No.

Notes:

If Sentry only collects crashes/errors, Apple's questionnaire may place it under Diagnostics instead. Confirm the exact Sentry configuration in the submitted build.

### Diagnostics

Likely selected:

- Crash Data.
- Performance Data.
- Other Diagnostic Data.

Purpose:

- App Functionality.
- Analytics, if used to improve app performance.

Linked to user:

Possibly yes, depending on Sentry user context and logs.

Tracking:

No.

Notes:

The app includes `@sentry/react-native` and backend `@sentry/node`.

### Sensitive Info

Recommended answer:

Do not select unless the app intentionally collects sensitive categories such as health, racial/ethnic data, political opinions, religious beliefs, sexual orientation, biometric data, or similar protected data.

Important:

Families may voluntarily enter sensitive information into notes, chores, events, recipes, or assistant prompts. The privacy policy should warn users not to enter sensitive information unless they are comfortable with it being processed.

### Financial Info

Recommended answer:

Do not select payment card info if payments are only handled by Apple in-app purchase and HomeThread does not receive card details.

Select purchase history if subscriptions are enabled.

### Health And Fitness

Recommended answer:

Do not select unless health or fitness data is intentionally collected.

Notes:

Meal planning and recipes are not automatically health data, but do not position the app as medical, nutrition, or health advice without a deeper legal/privacy review.

## Third-Party Partners To Mention

Mention only partners actually active in the production build:

- Supabase: authentication, database, storage, realtime, backend support.
- Apple: Sign in with Apple, App Store distribution, in-app purchases if enabled.
- Google: Google sign-in and Google Calendar sync if enabled.
- Expo: push notification delivery.
- Sentry: crash/error monitoring.
- RevenueCat: subscription entitlement handling if enabled.
- OpenAI and/or Groq: AI assistant if enabled.
- Resend: transactional email if enabled.

## Purposes Matrix

Use this to choose purposes in App Store Connect:

| Data | App Functionality | Analytics | Account Management | Support | Security |
| --- | --- | --- | --- | --- | --- |
| Email, name, auth ID | Yes | No | Yes | Yes | Yes |
| Household/member data | Yes | No | Yes | Yes | Yes |
| Child profiles/devices | Yes | No | Yes | Yes | Yes |
| Chores/events/lists/meals | Yes | No | No | Yes | Yes |
| AI prompts/conversations | Yes | Possibly no | No | Yes | Yes |
| Calendar tokens/events | Yes | No | No | Yes | Yes |
| Push tokens | Yes | No | No | Yes | Yes |
| Photos/uploads | Yes | No | No | Yes | Yes |
| Purchase history | Yes | No | Yes | Yes | Yes |
| Crash/error diagnostics | Yes | Yes if used for product improvement | No | Yes | Yes |
| Server logs/IP | Yes | No | No | Yes | Yes |

## High-Risk Accuracy Checks

Before entering final answers:

- Confirm whether Sentry is active in production.
- Confirm whether AI assistant is active in production.
- Confirm whether Google Calendar sync is active in production.
- Confirm whether recipe/source URL import is active in production.
- Confirm whether profile photos, household avatars, chore photos, or recipe images are active in production.
- Confirm whether push notifications are active in production.
- Confirm whether RevenueCat/subscriptions are active in production.
- Confirm whether any analytics SDK is active besides Sentry.
- Confirm there is no ad SDK and no IDFA access.
- Confirm children do not create adult accounts.

## Suggested Plain-English App Privacy Summary

HomeThread collects the information needed to run a shared family household: adult account details, household members, child profiles, child device pairing data, chores, events, lists, meals, recipes, notifications, and optional photos. If enabled, HomeThread also processes calendar sync data, AI assistant prompts, subscription entitlement data, push notification tokens, and crash/error diagnostics. HomeThread does not sell personal information or use it for third-party targeted advertising.

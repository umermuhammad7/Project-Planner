# HomeThread Legal And App Store Readiness Pack

Status: Draft for production review
Last updated: July 25, 2026
Bundle ID: `com.homethread.app`
Operator: Trendygrovee
Support and privacy email: `trendygrovee@gmail.com`

This folder contains the legal and App Store support documents HomeThread needs before public Apple review and production launch.

These documents are written to match the current HomeThread product shape: family households, adult accounts, child profiles, child device pairing, chores, calendar events, meals, lists, AI assistance, push notifications, profile photos, subscriptions, Supabase auth/storage, and account deletion.

Important: these are product-ready drafts, not legal advice. Before publishing, replace the remaining launch blockers and have the final policy reviewed by a qualified lawyer for the countries where HomeThread will be available.

## Current Launch Positioning

- HomeThread is a family coordination app for adults managing a household.
- Children should not create adult accounts.
- Child access is through adult-created child profiles and paired child devices.
- Adult invite codes and child pairing codes are separate.
- Shared household content is visible to household members according to their role.
- HomeThread should not be positioned as emergency, medical, childcare, nutrition, legal, financial, or professional advice.
- Unless you intentionally choose the Apple Kids Category later, do not market the app as mainly `for kids` or `for children`; describe it as for families/households with adult-managed child features.

## Files

- `PRIVACY_POLICY.md`: public privacy policy draft for the website and in-app legal page.
- `TERMS_OF_SERVICE.md`: public terms draft for the website and in-app legal page.
- `SUPPORT_AND_ACCOUNT_DELETION.md`: support, contact, deletion, and App Review notes.
- `APP_STORE_PRIVACY_LABEL_WORKSHEET.md`: answers to prepare App Store Connect privacy labels.
- `IN_APP_LEGAL_COPY.md`: short legal copy for Settings, onboarding, deletion dialogs, and App Review notes.

## App-Ready Copy

The mobile app also has an import-ready constants file:

`apps/mobile/src/constants/legalContent.ts`

Use that file when wiring a Legal section into Settings. It intentionally contains short user-facing copy, not the full legal policy.

## Must Fill Before Publishing

Known values already filled:

- Company/operator name: `Trendygrovee`
- Support email: `trendygrovee@gmail.com`
- Privacy email: `trendygrovee@gmail.com`

Public URLs now available:

- Privacy Policy URL: `https://vocal-malabi-9e6f2f.netlify.app/privacy/`
- Terms URL: `https://vocal-malabi-9e6f2f.netlify.app/terms/`
- Support URL: `https://vocal-malabi-9e6f2f.netlify.app/support/`
- Account deletion URL: `https://vocal-malabi-9e6f2f.netlify.app/account-deletion/`

Still required before final legal publication:

- `{{COMPANY_ADDRESS}}`
- `{{JURISDICTION}}`

Apple will not accept `mailto:` as the public Privacy Policy URL. The Netlify Privacy Policy URL above should be used in App Store Connect.

## Apple Review Checklist

- Add the privacy policy URL in App Store Connect.
- Add the privacy policy link inside the app Settings screen.
- Add Terms and Support links inside Settings.
- Confirm account deletion works from inside the app for signed-in accounts.
- Provide App Review with a demo account or complete demo mode.
- Keep the backend live and reachable during review.
- Complete App Store privacy labels using the worksheet in this folder.
- Confirm whether subscriptions are live at launch; if yes, explain Plus in App Review notes.
- Confirm whether AI, calendar sync, photo uploads, and push notifications are live at launch; privacy labels must match only what is actually shipped.

## Apple Sources Used

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple App Privacy Details: https://developer.apple.com/app-store/app-privacy-details/
- Apple App Store Connect privacy setup: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/

export const legalLinks = {
  privacyPolicyUrl: "https://vocal-malabi-9e6f2f.netlify.app/privacy/",
  termsOfServiceUrl: "https://vocal-malabi-9e6f2f.netlify.app/terms/",
  supportUrl: "https://vocal-malabi-9e6f2f.netlify.app/support/",
  accountDeletionUrl: "https://vocal-malabi-9e6f2f.netlify.app/account-deletion/",
  supportEmail: "trendygrovee@gmail.com",
  privacyEmail: "trendygrovee@gmail.com"
} as const;

export const legalCopy = {
  settingsCard: {
    title: "Legal and privacy",
    body: "Review how HomeThread handles household data, child profiles, account deletion, subscriptions, and support.",
    actions: {
      privacy: "Privacy Policy",
      terms: "Terms of Service",
      support: "Support",
      deleteAccount: "Delete account"
    }
  },
  privacySummary: [
    "HomeThread stores the information needed to run your household: adult accounts, household members, child profiles, paired child devices, chores, events, meals, recipes, lists, reminders, and optional photos.",
    "Adults should use their own sign-in account. Kids should use a paired child device controlled by an adult, not an adult account.",
    "We do not sell your personal information or use it for third-party targeted advertising."
  ],
  onboardingPrivacyNote:
    "HomeThread is shared household software. Adults in the same household may see shared chores, events, lists, meals, child profiles, rewards, and activity. Invite only people who should have household access.",
  childPairingPrivacyNote:
    "Child pairing codes are only for a child's device. They are not adult invite codes. A household adult controls the child profile and can unpair the device.",
  aiAssistantNotice:
    "AI suggestions can be wrong. Review anything HomeThread drafts before saving or relying on it. Do not enter sensitive information unless you are comfortable with it being processed for the assistant feature.",
  calendarSyncNotice:
    "Calendar sync imports events you choose to connect. You can disconnect calendar sync if you no longer want HomeThread to access that calendar.",
  notificationsNotice:
    "Notifications are optional. HomeThread uses them for reminders, family activity, chores, events, and daily digests when enabled.",
  deleteAccountDialog: {
    title: "Delete your account?",
    body: "This removes your HomeThread profile and adult membership access. Some shared household content may remain if other household members still need it, or if we must keep limited records for security, legal, backup, or fraud prevention reasons.",
    confirmLabel: "Delete account",
    cancelLabel: "Keep account"
  },
  support: {
    title: "Need help?",
    body: "Contact HomeThread support with the email you use for the app, your household name if relevant, your device type, and what happened.",
    buttonLabel: "Contact support"
  },
  appReviewNotes:
    "HomeThread is a family coordination app. Adults create or join households with their own Apple, Google, or email account. Adults can invite other adults with an adult invite code. Child profiles are created by adults, and child devices use a separate child pairing code. Account deletion is available at Settings -> Delete account."
} as const;

export type LegalCopy = typeof legalCopy;

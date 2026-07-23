import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { ActionFeedback } from "../components/ActionFeedback";
import { Card, PrimaryButton } from "../components/Primitives";
import { ScreenHeader } from "../components/ScreenHeader";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { pickAndUploadAvatar } from "../services/avatarUpload";
import {
  getNotificationCapability,
  requestNotificationPermissionAndToken
} from "../services/notifications";
import { useAuthStore } from "../store/useAuthStore";
import { useHomeThreadStore } from "../store/useHomeThreadStore";

function buildInitials(displayName: string | null, email: string | null) {
  const source = (displayName?.trim() || email?.split("@")[0] || "Home").trim();
  return source
    .split(/\s+/u)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function GroupCaption({ icon, title, tone = "muted" }: { icon: string; title: string; tone?: "muted" | "danger" }) {
  return (
    <View style={styles.groupCaption}>
      <Text style={styles.groupCaptionGlyph}>{icon}</Text>
      <Text style={[styles.groupCaptionText, tone === "danger" && styles.groupCaptionTextDanger]}>{title}</Text>
    </View>
  );
}

function feedbackTone(message: string): "success" | "error" | "info" {
  if (/(fail|error|required|could not|unable|not available|not ready|need|allow)/i.test(message)) {
    return "error";
  }

  if (/(working|uploading|sending|refresh|register)/i.test(message)) {
    return "info";
  }

  return "success";
}

export function SettingsScreen({
  onClose,
  onOpenFamilySettings,
  onOpenInsights
}: {
  onClose: () => void;
  onOpenFamilySettings: () => void;
  onOpenInsights?: () => void;
}) {
  const authMode = useAuthStore((state) => state.mode);
  const userId = useAuthStore((state) => state.userId);
  const email = useAuthStore((state) => state.email);
  const displayName = useAuthStore((state) => state.displayName);
  const avatarUrl = useAuthStore((state) => state.avatarUrl);
  const authProvider = useAuthStore((state) => state.authProvider);
  const notificationPrefs = useAuthStore((state) => state.notificationPrefs);
  const notificationPermission = useAuthStore((state) => state.notificationPermission);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const updatePassword = useAuthStore((state) => state.updatePassword);
  const requestPasswordReset = useAuthStore((state) => state.requestPasswordReset);
  const savePushToken = useAuthStore((state) => state.savePushToken);
  const updateNotificationPrefs = useAuthStore((state) => state.updateNotificationPrefs);
  const setNotificationPermission = useAuthStore((state) => state.setNotificationPermission);
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const signOut = useAuthStore((state) => state.signOut);
  const syncSource = useHomeThreadStore((state) => state.syncSource);

  const [editedDisplayName, setEditedDisplayName] = useState(displayName ?? "");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [isRegisteringNotifications, setIsRegisteringNotifications] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(avatarUrl);
  const [avatarImageFailed, setAvatarImageFailed] = useState(false);

  const backendConnected = syncSource === "api";
  const initials = useMemo(() => buildInitials(displayName, email), [displayName, email]);
  const avatarSource = useMemo(
    () => (avatarPreviewUrl ? { uri: avatarPreviewUrl, cache: "reload" as const } : null),
    [avatarPreviewUrl]
  );

  useEffect(() => {
    setEditedDisplayName(displayName ?? "");
  }, [displayName]);

  useEffect(() => {
    if (!profileMessage) {
      return;
    }

    const timer = setTimeout(() => setProfileMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [profileMessage]);

  useEffect(() => {
    setAvatarPreviewUrl(avatarUrl ?? null);
    setAvatarImageFailed(false);
  }, [avatarUrl]);

  useEffect(() => {
    void (async () => {
      const capability = await getNotificationCapability();
      setNotificationPermission(capability.permission);
    })();
  }, [setNotificationPermission]);

  async function handleSaveProfile() {
    setFormMessage(null);
    setProfileMessage(null);
    setIsSavingProfile(true);
    try {
      const result = await updateProfile({ displayName: editedDisplayName });
      if (!result.ok) {
        setProfileMessage(result.message ?? "Could not update your profile.");
        return;
      }

      setEditedDisplayName(useAuthStore.getState().displayName ?? editedDisplayName.trim());
      setProfileMessage("Profile saved.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleUploadPhoto() {
    if (!userId || authMode !== "supabase") {
      setProfileMessage("Profile photo upload is only available for signed-in accounts.");
      return;
    }

    setFormMessage(null);
    setProfileMessage(null);
    setIsUploadingPhoto(true);

    try {
      const upload = await pickAndUploadAvatar(userId);
      if (!upload.ok) {
        if (!upload.cancelled) {
          setProfileMessage(upload.message ?? "Could not upload that photo.");
        }
        return;
      }

      setAvatarPreviewUrl(upload.localPreviewUrl ?? upload.avatarUrl);
      setAvatarImageFailed(false);

      const result = await updateProfile({
        displayName: editedDisplayName || displayName || "HomeThread member",
        avatarUrl: upload.avatarUrl
      });

      if (!result.ok) {
        setProfileMessage(result.message ?? "Photo uploaded, but the profile could not be updated.");
        return;
      }

      setProfileMessage("Profile photo updated.");
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function handlePasswordReset() {
    setFormMessage(null);
    setIsSendingReset(true);
    try {
      const result = await requestPasswordReset();
      setFormMessage(result.message ?? null);
    } finally {
      setIsSendingReset(false);
    }
  }

  async function handleChangePassword() {
    setFormMessage(null);
    if (newPassword.trim().length < 8) {
      setFormMessage("Use at least 8 characters for the new password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormMessage("The new password confirmation does not match.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const result = await updatePassword(newPassword);
      setFormMessage(result.message ?? null);

      if (result.ok) {
        setNewPassword("");
        setConfirmPassword("");
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  }

  async function handleToggleNotificationPref(
    key: keyof typeof notificationPrefs,
    value: boolean
  ) {
    setNotificationMessage(null);
    const result = await updateNotificationPrefs({
      ...notificationPrefs,
      [key]: value
    });

    if (!result.ok) {
      setNotificationMessage(result.message ?? "Could not update notification settings.");
      return;
    }

    setNotificationMessage("Notification settings updated.");
  }

  async function handleToggleNotificationsEnabled(value: boolean) {
    setNotificationMessage(null);

    if (value) {
      setIsRegisteringNotifications(true);
      try {
        const result = await requestNotificationPermissionAndToken();
        setNotificationPermission(result.permission);

        if (!result.ok) {
          setNotificationMessage(result.message);
          return;
        }

        if (result.pushToken) {
          const saved = await savePushToken(result.pushToken);
          if (!saved.ok) {
            setNotificationMessage(saved.message ?? "Permission was granted, but the token could not be saved.");
            return;
          }
        }
      } finally {
        setIsRegisteringNotifications(false);
      }
    }

    const result = await updateNotificationPrefs({
      ...notificationPrefs,
      notifications_enabled: value
    });

    if (!result.ok) {
      setNotificationMessage(result.message ?? "Could not update notification settings.");
      return;
    }

    setNotificationMessage(value ? "Notifications enabled." : "Notifications turned off.");
  }

  async function handleDeleteAccount() {
    setFormMessage(null);
    setIsDeletingAccount(true);
    try {
      const result = await deleteAccount();
      if (!result.ok) {
        setFormMessage(result.message ?? "Could not delete this account.");
        return;
      }
      onClose();
    } finally {
      setIsDeletingAccount(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    onClose();
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        eyebrow="Settings"
        title="Your account"
        subtitle="Profile, notifications, and household links."
        variant="admin"
        actionLabel="Back"
        onActionPress={onClose}
        badgeLabel={backendConnected ? "Synced" : "Offline"}
        badgeTone={backendConnected ? "mint" : "coral"}
      />

      <Card>
        <View style={styles.profileHero}>
          <View style={styles.avatarShell}>
            {avatarSource && !avatarImageFailed ? (
              <Image
                source={avatarSource}
                style={styles.avatarImage}
                onError={() => setAvatarImageFailed(true)}
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isUploadingPhoto ? "Uploading profile photo" : avatarSource ? "Change photo" : "Add photo"}
              accessibilityState={{ busy: isUploadingPhoto, disabled: isUploadingPhoto }}
              disabled={isUploadingPhoto}
              onPress={() => {
                if (isUploadingPhoto) return;
                void handleUploadPhoto();
              }}
              style={({ pressed }) => [
                styles.avatarEditBadge,
                pressed && !isUploadingPhoto ? styles.avatarEditBadgePressed : null
              ]}
            >
              {isUploadingPhoto ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="camera" size={15} color="#FFFFFF" />
              )}
            </Pressable>
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>{displayName ?? "Your profile"}</Text>
            <View style={styles.profileEmailTag}>
              <Text style={styles.profileEmail}>{email ?? "No email on file"}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.label}>Display name</Text>
        <TextInput
          style={styles.input}
          placeholder="Your name"
          placeholderTextColor={colors.muted}
          value={editedDisplayName}
          onChangeText={setEditedDisplayName}
        />
        <Text style={styles.label}>Email</Text>
        <View style={styles.readOnlyField}>
          <Text style={styles.readOnlyValue}>{email ?? "No email on file"}</Text>
        </View>
        <View style={styles.cardActions}>
          <PrimaryButton
            label={isSavingProfile ? "Saving..." : "Save profile"}
            icon="checkmark"
            loading={isSavingProfile}
            disabled={isSavingProfile || !backendConnected}
            onPress={() => {
              if (isSavingProfile) return;
              if (!backendConnected) {
                setProfileMessage("Profile changes need a connected household. Refresh and try again.");
                return;
              }
              void handleSaveProfile();
            }}
          />
        </View>
        <ActionFeedback
          message={profileMessage ?? ""}
          tone={feedbackTone(profileMessage ?? "")}
          visible={Boolean(profileMessage)}
        />
        <View style={styles.cardActions}>
          <PrimaryButton label="Sign out" icon="log-out" tone="ghost" onPress={() => void handleSignOut()} />
        </View>
      </Card>

      <ActionFeedback message={formMessage ?? ""} tone={feedbackTone(formMessage ?? "")} visible={Boolean(formMessage)} />

      <Card>
        <View style={styles.groupBlockFirst}>
          <GroupCaption icon="🏡" title="Household" />
          <View style={styles.householdGrid}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Manage household"
              onPress={onOpenFamilySettings}
              style={({ pressed }) => [
                styles.householdTile,
                styles.householdTilePrimary,
                pressed && styles.householdTilePressed
              ]}
            >
              <Text style={styles.householdTileGlyph}>🧑‍🤝‍🧑</Text>
              <Text style={[styles.householdTileLabel, styles.householdTileLabelPrimary]}>Manage household</Text>
            </Pressable>
            {onOpenInsights ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open insights"
                onPress={onOpenInsights}
                style={({ pressed }) => [
                  styles.householdTile,
                  styles.householdTileGhost,
                  pressed && styles.householdTilePressed
                ]}
              >
                <Text style={styles.householdTileGlyph}>📊</Text>
                <Text style={styles.householdTileLabel}>Open insights</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.groupBlockDivider}>
          <GroupCaption icon="🔐" title="Security" />
          {authMode === "dev_token" ? (
            <Text style={styles.cardText}>Developer session — password controls are unavailable.</Text>
          ) : authProvider === "google" ? (
            <View style={styles.providerCard}>
              <View style={styles.providerIconBadge}>
                <Ionicons name="logo-google" size={16} color={colors.primary} />
              </View>
              <View style={styles.providerCopy}>
                <Text style={styles.providerTitle}>Signed in with Google</Text>
                <Text style={styles.providerSubtitle}>Password changes stay with your Google account.</Text>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.label}>New password</Text>
              <TextInput
                style={styles.input}
                secureTextEntry
                placeholder="At least 8 characters"
                placeholderTextColor={colors.muted}
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <Text style={styles.label}>Confirm password</Text>
              <TextInput
                style={styles.input}
                secureTextEntry
                placeholder="Re-enter the new password"
                placeholderTextColor={colors.muted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <View style={styles.cardActions}>
                <PrimaryButton
                  label={isUpdatingPassword ? "Updating..." : "Update password"}
                  icon="lock-closed"
                  loading={isUpdatingPassword}
                  disabled={!backendConnected || isUpdatingPassword || isSendingReset}
                  onPress={() => {
                    if (!backendConnected) {
                      setFormMessage("Password changes need a connected session. Refresh and try again.");
                      return;
                    }
                    if (isUpdatingPassword || isSendingReset) return;
                    void handleChangePassword();
                  }}
                />
                <PrimaryButton
                  label={isSendingReset ? "Sending..." : "Send reset email"}
                  icon="mail"
                  tone="ghost"
                  loading={isSendingReset}
                  disabled={!backendConnected || isUpdatingPassword || isSendingReset}
                  onPress={() => {
                    if (!backendConnected) {
                      setFormMessage("Password reset needs a connected session. Refresh and try again.");
                      return;
                    }
                    if (isUpdatingPassword || isSendingReset) return;
                    void handlePasswordReset();
                  }}
                />
              </View>
            </>
          )}
        </View>

        <View style={styles.groupBlockDivider}>
          <GroupCaption icon="🔔" title="Notifications" />
          {notificationPermission === "unsupported" ? (
            <View style={styles.notifUnsupportedRow}>
              <Text style={styles.notifUnsupportedGlyph}>📵</Text>
              <Text style={styles.notifUnsupportedText}>Notifications aren&apos;t available on this device.</Text>
            </View>
          ) : (
            <>
              <View style={styles.preferenceRow}>
                <View style={styles.preferenceLead}>
                  <Text style={styles.preferenceIcon}>🔔</Text>
                  <Text style={styles.preferenceLabel}>
                    {isRegisteringNotifications ? "Working..." : "Enable notifications"}
                  </Text>
                </View>
                <Switch
                  value={notificationPrefs.notifications_enabled}
                  onValueChange={(value) => void handleToggleNotificationsEnabled(value)}
                  disabled={isRegisteringNotifications || !backendConnected}
                  trackColor={{ false: colors.line, true: colors.primarySoft }}
                  thumbColor={notificationPrefs.notifications_enabled ? colors.primary : "#FFFFFF"}
                />
              </View>
              <ActionFeedback
                message={notificationMessage ?? ""}
                tone={feedbackTone(notificationMessage ?? "")}
                visible={Boolean(notificationMessage)}
              />
              <View style={styles.preferenceStack}>
                <NotificationPrefRow
                  icon="📅"
                  label="Event reminders"
                  value={notificationPrefs.event_reminders}
                  disabled={!backendConnected || !notificationPrefs.notifications_enabled}
                  onValueChange={(value) => void handleToggleNotificationPref("event_reminders", value)}
                />
                <NotificationPrefRow
                  icon="🧹"
                  label="Chore reminders"
                  value={notificationPrefs.chore_reminders}
                  disabled={!backendConnected || !notificationPrefs.notifications_enabled}
                  onValueChange={(value) => void handleToggleNotificationPref("chore_reminders", value)}
                />
                <NotificationPrefRow
                  icon="👨‍👩‍👧"
                  label="Family activity"
                  value={notificationPrefs.family_activity}
                  disabled={!backendConnected || !notificationPrefs.notifications_enabled}
                  onValueChange={(value) => void handleToggleNotificationPref("family_activity", value)}
                />
                <NotificationPrefRow
                  icon="☀️"
                  label="Daily digest"
                  value={notificationPrefs.daily_digest}
                  disabled={!backendConnected || !notificationPrefs.notifications_enabled}
                  onValueChange={(value) => void handleToggleNotificationPref("daily_digest", value)}
                />
              </View>
            </>
          )}
        </View>
      </Card>

      <Card>
        <GroupCaption icon="⚠️" title="Delete account" tone="danger" />
        <View style={styles.dangerPanel}>
          {authMode === "supabase" ? (
            <>
              <Text style={styles.cardText}>This permanently removes your HomeThread profile. Only use it if the account is no longer needed.</Text>
              {!backendConnected ? (
                <Text style={styles.helperText}>Account deletion requires a connected session. Refresh and try again when sync is back.</Text>
              ) : null}
              <Text style={styles.dangerText}>This action is destructive and cannot be undone from the app.</Text>
              <View style={styles.cardActions}>
                <PrimaryButton
                  label={isDeletingAccount ? "Deleting..." : "Delete account"}
                  icon="trash"
                  tone="dark"
                  loading={isDeletingAccount}
                  disabled={!backendConnected || isDeletingAccount}
                  onPress={() => {
                    if (isDeletingAccount || !backendConnected) return;
                    void handleDeleteAccount();
                  }}
                />
              </View>
            </>
          ) : (
            <Text style={styles.helperText}>Developer sessions cannot delete accounts from here.</Text>
          )}
        </View>
      </Card>
    </View>
  );
}

function NotificationPrefRow({
  icon,
  label,
  value,
  disabled = false,
  onValueChange
}: {
  icon: string;
  label: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.preferenceRow}>
      <View style={styles.preferenceLead}>
        <Text style={styles.preferenceIcon}>{icon}</Text>
        <Text style={[styles.preferenceLabel, disabled ? styles.preferenceLabelDisabled : null]}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.line, true: colors.primarySoft }}
        thumbColor={value ? colors.primary : "#FFFFFF"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.sm
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs
  },
  kicker: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 34,
    fontWeight: "700",
    lineHeight: 40
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.md
  },
  closeLabel: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "700"
  },
  profileSummary: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  profileHero: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.xl,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  avatarShell: {
    position: "relative"
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 72,
    justifyContent: "center",
    width: 72
  },
  avatarImage: {
    borderColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 72,
    width: 72
  },
  avatarEditBadge: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 2,
    bottom: -2,
    height: 28,
    justifyContent: "center",
    position: "absolute",
    right: -2,
    width: 28
  },
  avatarEditBadgePressed: {
    backgroundColor: colors.primaryPressed
  },
  avatarText: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: "900"
  },
  profileCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0
  },
  profileName: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 32
  },
  profileEmailTag: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6
  },
  profileEmail: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16
  },
  groupBlockFirst: {
    paddingBottom: spacing.md
  },
  groupBlockDivider: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    paddingBottom: spacing.md,
    paddingTop: spacing.md
  },
  groupCaption: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.sm
  },
  groupCaptionGlyph: {
    fontSize: 13,
    lineHeight: 16
  },
  groupCaptionText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  groupCaptionTextDanger: {
    color: colors.danger
  },
  cardText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm
  },
  helperText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    marginTop: spacing.md
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: spacing.xs,
    marginTop: spacing.sm
  },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: spacing.md
  },
  readOnlyField: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  readOnlyValue: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "600"
  },
  cardActions: {
    gap: spacing.sm,
    marginTop: spacing.md
  },
  householdGrid: {
    flexDirection: "row",
    gap: spacing.sm
  },
  householdTile: {
    alignItems: "center",
    borderRadius: radii.lg,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 84,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md
  },
  householdTilePrimary: {
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(139,107,74,0.18)"
  },
  householdTileGhost: {
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong
  },
  householdTilePressed: {
    opacity: 0.85
  },
  householdTileGlyph: {
    fontSize: 22,
    lineHeight: 26
  },
  householdTileLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center"
  },
  householdTileLabelPrimary: {
    color: colors.primary
  },
  providerCard: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  providerIconBadge: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  providerCopy: {
    flex: 1,
    gap: 2
  },
  providerTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800"
  },
  providerSubtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17
  },
  notifUnsupportedRow: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  notifUnsupportedGlyph: {
    fontSize: 18
  },
  notifUnsupportedText: {
    color: colors.muted,
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19
  },
  preferenceStack: {
    gap: spacing.sm,
    marginTop: spacing.md
  },
  preferenceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  preferenceLead: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minWidth: 0
  },
  preferenceIcon: {
    fontSize: 18,
    lineHeight: 22
  },
  preferenceLabel: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
    paddingRight: spacing.md
  },
  preferenceLabelDisabled: {
    color: colors.muted
  },
  formMessage: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19
  },
  saveMessage: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: spacing.md
  },
  dangerPanel: {
    backgroundColor: "rgba(160,73,59,0.08)",
    borderColor: "rgba(160,73,59,0.18)",
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md
  },
  dangerText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: spacing.md
  },
});

import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { Card, Pill, PrimaryButton, SectionTitle } from "../components/Primitives";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { apiRequest } from "../services/api";
import { pickAndUploadAvatar } from "../services/avatarUpload";
import { getClientBuildReadiness } from "../utils/buildReadiness";
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

export function SettingsScreen({
  onClose,
  onOpenFamilySettings
}: {
  onClose: () => void;
  onOpenFamilySettings: () => void;
}) {
  const authMode = useAuthStore((state) => state.mode);
  const userId = useAuthStore((state) => state.userId);
  const email = useAuthStore((state) => state.email);
  const displayName = useAuthStore((state) => state.displayName);
  const avatarUrl = useAuthStore((state) => state.avatarUrl);
  const authProvider = useAuthStore((state) => state.authProvider);
  const pushToken = useAuthStore((state) => state.pushToken);
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
  const isSaving = useHomeThreadStore((state) => state.isSaving);

  const [editedDisplayName, setEditedDisplayName] = useState(displayName ?? "");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [notificationCapabilityMessage, setNotificationCapabilityMessage] = useState<string | null>(null);
  const [isRegisteringNotifications, setIsRegisteringNotifications] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [cloudAiReady, setCloudAiReady] = useState<boolean | null>(null);

  const backendConnected = syncSource === "api";
  const initials = useMemo(() => buildInitials(displayName, email), [displayName, email]);
  const buildReadiness = useMemo(() => getClientBuildReadiness(), []);

  useEffect(() => {
    setEditedDisplayName(displayName ?? "");
  }, [displayName]);

  useEffect(() => {
    void (async () => {
      const capability = await getNotificationCapability();
      setNotificationPermission(capability.permission);
      setNotificationCapabilityMessage(capability.message);
    })();
  }, [setNotificationPermission]);

  useEffect(() => {
    if (!backendConnected) {
      setCloudAiReady(null);
      return;
    }

    void (async () => {
      const result = await apiRequest<{ configured: boolean }>("/ai/status");
      setCloudAiReady(result.data?.configured ?? false);
    })();
  }, [backendConnected]);

  async function handleSaveProfile() {
    setFormMessage(null);
    const result = await updateProfile({ displayName: editedDisplayName });
    if (!result.ok) {
      setFormMessage(result.message ?? "Could not update your profile.");
      return;
    }

    setEditedDisplayName(useAuthStore.getState().displayName ?? editedDisplayName.trim());
    setFormMessage("Profile saved.");
  }

  async function handleUploadPhoto() {
    if (!userId || authMode !== "supabase") {
      setFormMessage("Profile photo upload is only available for signed-in accounts.");
      return;
    }

    setFormMessage(null);
    setIsUploadingPhoto(true);

    try {
      const upload = await pickAndUploadAvatar(userId);
      if (!upload.ok) {
        if (!upload.cancelled) {
          setFormMessage(upload.message ?? "Could not upload that photo.");
        }
        return;
      }

      const result = await updateProfile({
        displayName: editedDisplayName || displayName || "HomeThread member",
        avatarUrl: upload.avatarUrl
      });

      if (!result.ok) {
        setFormMessage(result.message ?? "Photo uploaded, but the profile could not be updated.");
        return;
      }

      setFormMessage("Profile photo updated.");
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function handlePasswordReset() {
    setFormMessage(null);
    const result = await requestPasswordReset();
    setFormMessage(result.message ?? null);
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

    const result = await updatePassword(newPassword);
    setFormMessage(result.message ?? null);

    if (result.ok) {
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  async function handleEnableNotifications() {
    setNotificationMessage(null);
    setIsRegisteringNotifications(true);

    try {
      const result = await requestNotificationPermissionAndToken();
      setNotificationPermission(result.permission);
      setNotificationMessage(result.message);

      if (result.ok && result.pushToken) {
        const saved = await savePushToken(result.pushToken);
        if (!saved.ok) {
          setNotificationMessage(saved.message ?? "Push setup was granted, but the token could not be saved.");
        } else {
          setNotificationMessage("Notifications are ready on this device.");
        }
      }
    } finally {
      setIsRegisteringNotifications(false);
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
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Settings</Text>
          <Text style={styles.title}>Your account</Text>
        </View>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeLabel}>Close</Text>
        </Pressable>
      </View>

      <Card>
        <View style={styles.profileSummary}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>{displayName ?? "Your profile"}</Text>
            <Text style={styles.profileEmail}>{email ?? "No email on file"}</Text>
          </View>
        </View>
        <View style={styles.summaryActions}>
          <PrimaryButton
            label={isUploadingPhoto ? "Uploading..." : avatarUrl ? "Change photo" : "Add photo"}
            icon="image"
            tone="ghost"
            onPress={() => {
              if (isUploadingPhoto) return;
              void handleUploadPhoto();
            }}
          />
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
            label={isSaving ? "Working..." : "Save profile"}
            icon="person-circle"
            onPress={() => {
              if (isSaving || !backendConnected) return;
              void handleSaveProfile();
            }}
          />
        </View>
      </Card>

      <SectionTitle title="Security" />
      <Card>
        <Text style={styles.cardTitle}>Password and sign-in</Text>
        {authMode === "dev_token" ? (
          <Text style={styles.cardText}>This device is using a developer session, so password controls are unavailable here.</Text>
        ) : authProvider === "google" ? (
          <Text style={styles.cardText}>You signed in with Google, so password changes stay with your Google account.</Text>
        ) : (
          <>
            <Text style={styles.cardText}>Change your password while signed in, or send a reset email.</Text>
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
                label="Update password"
                icon="lock-closed"
                onPress={() => {
                  if (!backendConnected) return;
                  void handleChangePassword();
                }}
              />
              <PrimaryButton
                label="Send reset email"
                icon="mail"
                tone="ghost"
                onPress={() => {
                  if (!backendConnected) return;
                  void handlePasswordReset();
                }}
              />
            </View>
          </>
        )}
      </Card>

      <SectionTitle title="Notifications" />
      <Card>
        <Text style={styles.cardTitle}>This device</Text>
        <Text style={styles.helperText}>
          {pushToken ? "This device is registered." : "Enable notifications to register this device."}
        </Text>
        {notificationCapabilityMessage ? <Text style={styles.helperText}>{notificationCapabilityMessage}</Text> : null}
        {notificationMessage ? <Text style={styles.saveMessage}>{notificationMessage}</Text> : null}
        <View style={styles.cardActions}>
          <PrimaryButton
            label={isRegisteringNotifications ? "Working..." : pushToken ? "Refresh notification setup" : "Enable notifications"}
            icon="notifications"
            tone="soft"
            onPress={() => {
              if (isRegisteringNotifications) return;
              void handleEnableNotifications();
            }}
          />
        </View>
        <View style={styles.preferenceStack}>
          <NotificationPrefRow
            label="Event reminders"
            value={notificationPrefs.event_reminders}
            disabled={!backendConnected}
            onValueChange={(value) => void handleToggleNotificationPref("event_reminders", value)}
          />
          <NotificationPrefRow
            label="Chore reminders"
            value={notificationPrefs.chore_reminders}
            disabled={!backendConnected}
            onValueChange={(value) => void handleToggleNotificationPref("chore_reminders", value)}
          />
          <NotificationPrefRow
            label="Family activity"
            value={notificationPrefs.family_activity}
            disabled={!backendConnected}
            onValueChange={(value) => void handleToggleNotificationPref("family_activity", value)}
          />
          <NotificationPrefRow
            label="Daily digest"
            value={notificationPrefs.daily_digest}
            disabled={!backendConnected}
            onValueChange={(value) => void handleToggleNotificationPref("daily_digest", value)}
          />
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Household</Text>
        <View style={styles.cardActions}>
          <PrimaryButton label="Manage household" icon="people" tone="soft" onPress={onOpenFamilySettings} />
        </View>
      </Card>

      {formMessage ? <Text style={styles.formMessage}>{formMessage}</Text> : null}

      <SectionTitle title="Test build status" />
      <Card>
        <Text style={styles.cardText}>What this install can actually do during TestFlight QA.</Text>
        <View style={styles.readinessStack}>
          {buildReadiness.map((item) => (
            <View key={item.key} style={styles.readinessRow}>
              <View style={styles.readinessCopy}>
                <Text style={styles.readinessLabel}>{item.label}</Text>
                <Text style={styles.readinessDetail}>{item.detail}</Text>
              </View>
              <Pill label={item.ready ? "Ready" : "Not ready"} tone={item.ready ? "mint" : "neutral"} />
            </View>
          ))}
          {backendConnected ? (
            <View style={styles.readinessRow}>
              <View style={styles.readinessCopy}>
                <Text style={styles.readinessLabel}>Cloud AI on server</Text>
                <Text style={styles.readinessDetail}>
                  {cloudAiReady === null
                    ? "Checking server AI configuration..."
                    : cloudAiReady
                      ? "Cloud AI is available for signed-in households."
                      : "Server AI is not configured yet. Text parsing still works."}
                </Text>
              </View>
              <Pill
                label={cloudAiReady ? "Ready" : cloudAiReady === null ? "Checking" : "Not ready"}
                tone={cloudAiReady ? "mint" : "neutral"}
              />
            </View>
          ) : null}
        </View>
      </Card>

      <Card>
        <View style={styles.cardActions}>
          <PrimaryButton label="Sign out" icon="log-out" tone="soft" onPress={() => void handleSignOut()} />
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Delete account</Text>
        {authMode === "supabase" ? (
          <>
            <Text style={styles.cardText}>This permanently removes your HomeThread profile. Only use it if the account is no longer needed.</Text>
            <Text style={styles.dangerText}>This action is destructive and cannot be undone from the app.</Text>
            <View style={styles.cardActions}>
              <PrimaryButton
                label={isDeletingAccount ? "Deleting..." : "Delete account"}
                icon="trash"
                tone="dark"
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
      </Card>
    </View>
  );
}

function NotificationPrefRow({
  label,
  value,
  disabled = false,
  onValueChange
}: {
  label: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.preferenceRow}>
      <Text style={[styles.preferenceLabel, disabled ? styles.preferenceLabelDisabled : null]}>{label}</Text>
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
    gap: spacing.md
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
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.sm
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
  avatar: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    height: 54,
    justifyContent: "center",
    width: 54
  },
  avatarImage: {
    borderRadius: radii.pill,
    height: 54,
    width: 54
  },
  avatarText: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "900"
  },
  profileCopy: {
    flex: 1,
    gap: 2
  },
  profileName: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700"
  },
  profileEmail: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700"
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
    marginTop: spacing.md
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
    gap: spacing.md,
    marginTop: spacing.lg
  },
  summaryActions: {
    marginTop: spacing.md
  },
  preferenceStack: {
    gap: spacing.md,
    marginTop: spacing.lg
  },
  preferenceRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
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
  dangerText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: spacing.lg
  },
  readinessStack: {
    gap: spacing.md,
    marginTop: spacing.md
  },
  readinessRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  readinessCopy: {
    flex: 1,
    gap: 2
  },
  readinessLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800"
  },
  readinessDetail: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18
  }
});

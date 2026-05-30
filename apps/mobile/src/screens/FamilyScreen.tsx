import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { Card, MemberAvatar, Pill, PrimaryButton, Row, SectionTitle } from "../components/Primitives";
import { colors, radii, spacing } from "../constants/theme";
import { apiRequest } from "../services/api";
import {
  getNotificationCapability,
  requestNotificationPermissionAndToken
} from "../services/notifications";
import { useAuthStore } from "../store/useAuthStore";
import { useHomeThreadStore } from "../store/useHomeThreadStore";
import { MobileSubscriptionStatus } from "../types";

function roleLabel(role: string) {
  if (role === "kid") return "Child profile";
  if (role === "parent") return "Admin";
  return "Member";
}

export function FamilyScreen({ onClose }: { onClose: () => void }) {
  const authMode = useAuthStore((state) => state.mode);
  const email = useAuthStore((state) => state.email);
  const displayName = useAuthStore((state) => state.displayName);
  const pushToken = useAuthStore((state) => state.pushToken);
  const notificationPrefs = useAuthStore((state) => state.notificationPrefs);
  const notificationPermission = useAuthStore((state) => state.notificationPermission);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const savePushToken = useAuthStore((state) => state.savePushToken);
  const updateNotificationPrefs = useAuthStore((state) => state.updateNotificationPrefs);
  const setNotificationPermission = useAuthStore((state) => state.setNotificationPermission);
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const signOut = useAuthStore((state) => state.signOut);
  const {
    familyName,
    inviteCode,
    isFamilyAdmin,
    members,
    syncSource,
    isSaving,
    saveMessage,
    regenerateInviteCode,
    updateFamilyName,
    leaveFamily,
    createVirtualMember,
    updateVirtualMember,
    removeVirtualMember
  } = useHomeThreadStore();
  const [childName, setChildName] = useState("");
  const [editedFamilyName, setEditedFamilyName] = useState(familyName);
  const [editedDisplayName, setEditedDisplayName] = useState(displayName ?? "");
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingMemberName, setEditingMemberName] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [notificationCapabilityMessage, setNotificationCapabilityMessage] = useState<string | null>(null);
  const [isRegisteringNotifications, setIsRegisteringNotifications] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<MobileSubscriptionStatus | null>(null);
  const [subscriptionMessage, setSubscriptionMessage] = useState<string | null>(null);

  async function handleSaveFamilyName() {
    setFormMessage(null);
    const result = await updateFamilyName(editedFamilyName);
    if (!result.ok) {
      setFormMessage(result.message ?? "Could not update family name.");
      return;
    }
    setEditedFamilyName(useHomeThreadStore.getState().familyName);
  }

  async function handleLeaveFamily() {
    setFormMessage(null);
    const result = await leaveFamily();
    if (!result.ok) {
      setFormMessage(result.message ?? "Could not leave this household.");
      return;
    }
    onClose();
  }

  async function handleRegenerateInvite() {
    setFormMessage(null);
    const result = await regenerateInviteCode();
    if (!result.ok) {
      setFormMessage(result.message ?? "Could not regenerate invite code.");
    }
  }

  async function handleAddChild() {
    setFormMessage(null);
    const result = await createVirtualMember({ displayName: childName, role: "child" });
    if (!result.ok) {
      setFormMessage(result.message ?? "Could not add child profile.");
      return;
    }
    setChildName("");
  }

  async function handleSaveMember() {
    if (!editingMemberId) {
      return;
    }

    setFormMessage(null);
    const result = await updateVirtualMember({
      memberId: editingMemberId,
      displayName: editingMemberName
    });
    if (!result.ok) {
      setFormMessage(result.message ?? "Could not update child profile.");
      return;
    }

    setEditingMemberId(null);
    setEditingMemberName("");
  }

  async function handleRemoveMember(memberId: string) {
    setFormMessage(null);
    const result = await removeVirtualMember(memberId);
    if (!result.ok) {
      setFormMessage(result.message ?? "Could not remove child profile.");
      return;
    }

    if (editingMemberId === memberId) {
      setEditingMemberId(null);
      setEditingMemberName("");
    }
  }

  async function handleSignOut() {
    await signOut();
    onClose();
  }

  async function handleSaveProfile() {
    setFormMessage(null);
    const result = await updateProfile({ displayName: editedDisplayName });
    if (!result.ok) {
      setFormMessage(result.message ?? "Could not update your profile.");
      return;
    }
    setEditedDisplayName(useAuthStore.getState().displayName ?? editedDisplayName.trim());
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

  async function loadNotificationCapability() {
    const capability = await getNotificationCapability();
    setNotificationPermission(capability.permission);
    setNotificationCapabilityMessage(capability.message);
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
          setNotificationMessage(saved.message ?? "Push token could not be saved to your profile.");
        } else {
          setNotificationMessage("Push permission granted and token saved to your HomeThread profile.");
        }
      }
    } finally {
      setIsRegisteringNotifications(false);
    }
  }

  async function loadSubscriptionStatus() {
    if (!backendConnected) {
      setSubscriptionStatus(null);
      setSubscriptionMessage("Subscription status needs the local API connected.");
      return;
    }

    const familyId = useHomeThreadStore.getState().familyId;
    if (!familyId) {
      setSubscriptionStatus(null);
      setSubscriptionMessage("Join or create a household before checking plan status.");
      return;
    }

    const result = await apiRequest<MobileSubscriptionStatus>(`/subscriptions/status?familyId=${familyId}`);
    if (!result.data) {
      setSubscriptionStatus(null);
      setSubscriptionMessage(result.error?.message ?? "Could not load subscription status.");
      return;
    }

    setSubscriptionStatus(result.data);
    setSubscriptionMessage(result.data.message);
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

  const backendConnected = syncSource === "api";

  useEffect(() => {
    setEditedFamilyName(familyName);
  }, [familyName]);

  useEffect(() => {
    setEditedDisplayName(displayName ?? "");
  }, [displayName]);

  useEffect(() => {
    void loadNotificationCapability();
  }, []);

  useEffect(() => {
    void loadSubscriptionStatus();
  }, [backendConnected, familyName]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Household</Text>
          <Text style={styles.title}>{familyName}</Text>
          <Text style={styles.subtitle}>
            {backendConnected
              ? "Manage invite codes and child profiles for this family."
              : "Family settings need the local backend connected."}
          </Text>
        </View>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeLabel}>Close</Text>
        </Pressable>
      </View>

      {isFamilyAdmin ? (
        <Card>
          <Text style={styles.cardTitle}>Household name</Text>
          <Text style={styles.cardText}>Admins can rename the family. Avatar uploads are not wired in this build.</Text>
          <TextInput
            style={styles.input}
            placeholder="Family name"
            placeholderTextColor={colors.muted}
            value={editedFamilyName}
            onChangeText={setEditedFamilyName}
          />
          <View style={styles.cardActions}>
            <PrimaryButton
              label={isSaving ? "Working..." : "Save name"}
              icon="create"
              onPress={() => {
                if (isSaving || !backendConnected) return;
                void handleSaveFamilyName();
              }}
            />
          </View>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.cardTitle}>Invite code</Text>
        <Text style={styles.cardText}>
          Share this code with another adult so they can join this household. Email invites are not wired in this
          build.
        </Text>
        <Text style={styles.inviteCode}>{inviteCode ?? "Unavailable"}</Text>
        {isFamilyAdmin ? (
          <View style={styles.cardActions}>
            <PrimaryButton
              label={isSaving ? "Working..." : "Regenerate code"}
              icon="refresh"
              tone="dark"
              onPress={() => {
                if (isSaving || !backendConnected) return;
                void handleRegenerateInvite();
              }}
            />
          </View>
        ) : (
          <Text style={styles.helperText}>Only admins can regenerate invite codes.</Text>
        )}
      </Card>

      <SectionTitle title="Members" action={`${members.length} total`} />
      <View style={styles.stack}>
        {members.map((member) => (
          <Card key={member.id}>
            <Row>
              <MemberAvatar member={member} size={40} />
              <View style={styles.memberCopy}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberMeta}>
                  {roleLabel(member.role)}
                  {member.userId ? " - signed-in account" : " - no login"}
                </Text>
              </View>
              {member.role === "kid" ? <Pill label="Kids mode" tone="gold" /> : null}
            </Row>
            {isFamilyAdmin && member.isVirtual ? (
              <View style={styles.memberActions}>
                {editingMemberId === member.id ? (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder="Child name"
                      placeholderTextColor={colors.muted}
                      value={editingMemberName}
                      onChangeText={setEditingMemberName}
                    />
                    <View style={styles.memberButtonRow}>
                      <PrimaryButton
                        label={isSaving ? "Working..." : "Save child"}
                        icon="checkmark"
                        onPress={() => {
                          if (isSaving || !backendConnected) return;
                          void handleSaveMember();
                        }}
                      />
                      <PrimaryButton
                        label="Cancel"
                        icon="close"
                        tone="dark"
                        onPress={() => {
                          setEditingMemberId(null);
                          setEditingMemberName("");
                        }}
                      />
                    </View>
                  </>
                ) : (
                  <View style={styles.memberButtonRow}>
                    <PrimaryButton
                      label="Rename"
                      icon="create"
                      onPress={() => {
                        setEditingMemberId(member.id);
                        setEditingMemberName(member.name);
                      }}
                    />
                    <PrimaryButton
                      label={isSaving ? "Working..." : "Remove"}
                      icon="trash"
                      tone="dark"
                      onPress={() => {
                        if (isSaving || !backendConnected) return;
                        void handleRemoveMember(member.id);
                      }}
                    />
                  </View>
                )}
              </View>
            ) : null}
          </Card>
        ))}
      </View>

      {isFamilyAdmin ? (
        <>
          <SectionTitle title="Add child profile" />
          <Card>
            <Text style={styles.cardText}>
              Child profiles are virtual members for chores and kids mode. They do not get their own login.
            </Text>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Noah"
              placeholderTextColor={colors.muted}
              value={childName}
              onChangeText={setChildName}
            />
            <View style={styles.cardActions}>
              <PrimaryButton
                label={isSaving ? "Working..." : "Add child profile"}
                icon="person-add"
                onPress={() => {
                  if (isSaving || !backendConnected) return;
                  void handleAddChild();
                }}
              />
            </View>
          </Card>
        </>
      ) : null}

      {formMessage ? <Text style={styles.formMessage}>{formMessage}</Text> : null}
      {saveMessage ? <Text style={styles.saveMessage}>{saveMessage}</Text> : null}

      <Card>
        <Text style={styles.cardTitle}>Family Plus</Text>
        <Text style={styles.cardText}>
          Subscription plumbing is wired on the backend. Purchases and restore flows still need RevenueCat keys and app-store setup.
        </Text>
        <Text style={styles.helperText}>
          Plan: {subscriptionStatus?.subscriptionStatus ?? "free"}
          {subscriptionStatus?.subscriptionExpiresAt
            ? ` - expires ${new Date(subscriptionStatus.subscriptionExpiresAt).toLocaleDateString()}`
            : ""}
        </Text>
        {subscriptionMessage ? <Text style={styles.helperText}>{subscriptionMessage}</Text> : null}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Account</Text>
        <Text style={styles.cardText}>
          Keep your profile name current so invites, notifications, and family activity stay readable.
        </Text>
        <Text style={styles.label}>Display name</Text>
        <TextInput
          style={styles.input}
          placeholder="Your name"
          placeholderTextColor={colors.muted}
          value={editedDisplayName}
          onChangeText={setEditedDisplayName}
        />
        <Text style={styles.helperText}>{email ?? "No email on file for this session."}</Text>
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

      <Card>
        <Text style={styles.cardTitle}>Notifications</Text>
        <Text style={styles.cardText}>
          HomeThread can request notification permission and register this device token. Reminder delivery itself is
          not implemented yet.
        </Text>
        <Text style={styles.helperText}>
          Permission: {notificationPermission}
          {pushToken ? " - push token saved" : " - no push token saved"}
        </Text>
        {notificationCapabilityMessage ? <Text style={styles.helperText}>{notificationCapabilityMessage}</Text> : null}
        {notificationMessage ? <Text style={styles.saveMessage}>{notificationMessage}</Text> : null}
        <View style={styles.cardActions}>
          <PrimaryButton
            label={
              isRegisteringNotifications
                ? "Working..."
                : pushToken
                  ? "Refresh notification setup"
                  : "Enable notifications"
            }
            icon="notifications"
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
        <Text style={styles.cardTitle}>Leave household</Text>
        <Text style={styles.cardText}>
          Leave removes your membership from this family on the server. You can join again with an invite code or create
          a new household.
        </Text>
        <View style={styles.cardActions}>
          <PrimaryButton
            label={isSaving ? "Working..." : "Leave household"}
            icon="exit"
            tone="dark"
            onPress={() => {
              if (isSaving || !backendConnected) return;
              void handleLeaveFamily();
            }}
          />
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Session</Text>
        <Text style={styles.cardText}>
          {authMode === "dev_token"
            ? "Signed in with the local dev token for seeded Parker Home data."
            : "Signed in with Supabase. Sign out to switch accounts or return to setup."}
        </Text>
        <View style={styles.cardActions}>
          <PrimaryButton label="Sign out" icon="log-out" tone="dark" onPress={() => void handleSignOut()} />
        </View>
        {authMode === "supabase" ? (
          <>
            <Text style={styles.dangerText}>
              Delete account removes this signed-in profile from HomeThread. It does not preserve family membership or
              settings in this build.
            </Text>
            <View style={styles.cardActions}>
              <PrimaryButton
                label={isDeletingAccount ? "Deleting..." : "Delete account"}
                icon="trash"
                tone="dark"
                onPress={() => {
                  if (isDeletingAccount || isSaving || !backendConnected) return;
                  void handleDeleteAccount();
                }}
              />
            </View>
          </>
        ) : (
          <Text style={styles.helperText}>The dev-token session is seeded locally, so account deletion is disabled.</Text>
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
    fontWeight: "900",
    textTransform: "uppercase"
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 34
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22
  },
  closeButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.sm
  },
  closeLabel: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "900"
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  cardText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm
  },
  inviteCode: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 2,
    marginTop: spacing.md
  },
  helperText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: spacing.md
  },
  cardActions: {
    marginTop: spacing.lg
  },
  stack: {
    gap: spacing.sm
  },
  memberActions: {
    gap: spacing.md,
    marginTop: spacing.md
  },
  memberButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
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
  memberCopy: {
    flex: 1,
    gap: 2
  },
  memberName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  memberMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: spacing.xs,
    marginTop: spacing.md
  },
  input: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: spacing.md
  },
  formMessage: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19
  },
  saveMessage: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19
  },
  dangerText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    marginTop: spacing.lg
  }
});

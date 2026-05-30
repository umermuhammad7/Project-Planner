import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Card, MemberAvatar, Pill, PrimaryButton, Row, SectionTitle } from "../components/Primitives";
import { colors, radii, spacing } from "../constants/theme";
import { useAuthStore } from "../store/useAuthStore";
import { useHomeThreadStore } from "../store/useHomeThreadStore";

function roleLabel(role: string) {
  if (role === "kid") return "Child profile";
  if (role === "parent") return "Admin";
  return "Member";
}

export function FamilyScreen({ onClose }: { onClose: () => void }) {
  const authMode = useAuthStore((state) => state.mode);
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
    createVirtualMember
  } = useHomeThreadStore();
  const [childName, setChildName] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);

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

  async function handleSignOut() {
    await signOut();
    onClose();
  }

  const backendConnected = syncSource === "api";

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
        <Text style={styles.cardTitle}>Session</Text>
        <Text style={styles.cardText}>
          {authMode === "dev_token"
            ? "Signed in with the local dev token for seeded Parker Home data."
            : "Signed in with Supabase. Sign out to switch accounts or return to setup."}
        </Text>
        <View style={styles.cardActions}>
          <PrimaryButton label="Sign out" icon="log-out" tone="dark" onPress={() => void handleSignOut()} />
        </View>
      </Card>
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
  }
});

import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";

import { Card, MemberAvatar, Pill, PrimaryButton, Row, SectionTitle } from "../components/Primitives";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { apiRequest } from "../services/api";
import {
  type BillingPackageSummary,
  getBillingCustomerInfo,
  getBillingPackages,
  getBillingStatus,
  purchaseBillingPackage,
  restoreBillingPurchases
} from "../services/billing";
import { useHomeThreadStore } from "../store/useHomeThreadStore";
import { MobileSubscriptionStatus } from "../types";

function roleLabel(role: string) {
  if (role === "kid") return "Child profile";
  if (role === "parent") return "Admin";
  return "Member";
}

export function FamilyScreen({ onClose }: { onClose: () => void }) {
  const {
    familyId,
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
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingMemberName, setEditingMemberName] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<MobileSubscriptionStatus | null>(null);
  const [subscriptionMessage, setSubscriptionMessage] = useState<string | null>(null);
  const [billingMessage, setBillingMessage] = useState<string | null>(null);
  const [billingPackages, setBillingPackages] = useState<PurchasesPackage[]>([]);
  const [billingSummaries, setBillingSummaries] = useState<BillingPackageSummary[]>([]);
  const [billingManagementUrl, setBillingManagementUrl] = useState<string | null>(null);
  const [isLoadingBilling, setIsLoadingBilling] = useState(false);
  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);
  const [activePurchaseId, setActivePurchaseId] = useState<string | null>(null);
  const [showBillingPlans, setShowBillingPlans] = useState(false);
  const planRows = [
    {
      name: "Parents",
      price: "$5/mo",
      detail: "2 adults in one home",
      note: "Start with the parents and add structure before the house gets noisy."
    },
    {
      name: "Parents + 2 kids",
      price: "$10/mo",
      detail: "2 adults and up to 2 child profiles",
      note: "The strongest default for a typical household."
    },
    {
      name: "Parents + 4 kids",
      price: "$15/mo",
      detail: "2 adults and up to 4 child profiles",
      note: "More room for larger families without custom pricing math."
    },
    {
      name: "Unlimited + AI",
      price: "$50/mo",
      detail: "Unlimited child profiles with AI planning",
      note: "For large homes that want the assistant fully switched on."
    }
  ];

  const backendConnected = syncSource === "api";
  const billingStatus = getBillingStatus();
  const childProfiles = members.filter((member) => member.role === "kid");

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

  async function loadSubscriptionStatus() {
    if (!backendConnected) {
      setSubscriptionStatus(null);
      setSubscriptionMessage("Sign in to check subscription status.");
      return;
    }

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

  async function loadBillingOptions() {
    if (!familyId) {
      setBillingPackages([]);
      setBillingSummaries([]);
      setBillingManagementUrl(null);
      setBillingMessage("Create or join a household before loading store plans.");
      return;
    }

    if (!isFamilyAdmin) {
      setBillingPackages([]);
      setBillingSummaries([]);
      setBillingManagementUrl(null);
      setBillingMessage("Only the household admin manages billing. Everyone else joins by invite code.");
      return;
    }

    setIsLoadingBilling(true);
    try {
      const packagesResult = await getBillingPackages(familyId);
      if (!packagesResult.ok) {
        setBillingPackages([]);
        setBillingSummaries([]);
        setBillingManagementUrl(null);
        setBillingMessage(packagesResult.message);
        return;
      }

      setBillingPackages(packagesResult.packages);
      setBillingSummaries(packagesResult.summaries);
      setBillingMessage(
        packagesResult.summaries.length > 0
          ? "Store plans are loaded for this household."
          : billingStatus.keyPresent
            ? "Billing is connected, but no store packages are available in the current offering yet."
            : billingStatus.message
      );

      const customerInfo = await getBillingCustomerInfo(familyId);
      if (customerInfo.ok) {
        setBillingManagementUrl(customerInfo.customerInfo.managementURL);
      }
    } finally {
      setIsLoadingBilling(false);
    }
  }

  async function handlePurchasePlan(aPackage: PurchasesPackage) {
    if (!familyId) {
      setBillingMessage("Create or join a household before starting checkout.");
      return;
    }

    setActivePurchaseId(aPackage.identifier);
    setBillingMessage(null);

    try {
      const result = await purchaseBillingPackage(familyId, aPackage);
      setBillingMessage(
        result.ok
          ? "Purchase completed. Household status may take a moment to refresh after the store confirms it."
          : result.message ?? "Purchase could not be completed."
      );
      if (result.ok) {
        await loadSubscriptionStatus();
        await loadBillingOptions();
      }
    } finally {
      setActivePurchaseId(null);
    }
  }

  async function handleRestorePurchases() {
    if (!familyId) {
      setBillingMessage("Create or join a household before restoring purchases.");
      return;
    }

    setIsRestoringPurchases(true);
    setBillingMessage(null);

    try {
      const result = await restoreBillingPurchases(familyId);
      setBillingMessage(result.message ?? (result.ok ? "Restore finished." : "Could not restore purchases."));
      if (result.ok) {
        await loadSubscriptionStatus();
        await loadBillingOptions();
      }
    } finally {
      setIsRestoringPurchases(false);
    }
  }

  useEffect(() => {
    setEditedFamilyName(familyName);
  }, [familyName]);

  useEffect(() => {
    void loadSubscriptionStatus();
  }, [backendConnected, familyId]);

  useEffect(() => {
    if (!backendConnected) {
      setBillingPackages([]);
      setBillingSummaries([]);
      setBillingManagementUrl(null);
      setBillingMessage("Sign in to load store billing.");
      return;
    }

    void loadBillingOptions();
  }, [backendConnected, familyId, isFamilyAdmin]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Household</Text>
          <Text style={styles.title}>{familyName}</Text>
          <Text style={styles.subtitle}>
            {backendConnected ? "Invites and child profiles." : "Sign in to manage your household."}
          </Text>
        </View>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeLabel}>Close</Text>
        </Pressable>
      </View>

      <Card>
        <View style={styles.summaryTop}>
          <Pill label={isFamilyAdmin ? "Admin access" : "Member access"} tone={isFamilyAdmin ? "primary" : "neutral"} />
          <Pill label={backendConnected ? "Connected" : "Local-only"} tone={backendConnected ? "mint" : "neutral"} />
        </View>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryValue}>{members.length}</Text>
            <Text style={styles.summaryLabel}>members</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryValue}>{childProfiles.length}</Text>
            <Text style={styles.summaryLabel}>child profiles</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryValue}>{inviteCode ? "Ready" : "None"}</Text>
            <Text style={styles.summaryLabel}>invite code</Text>
          </View>
        </View>
      </Card>

      <SectionTitle title="Family access" />
      <Card>
        <Text style={styles.cardTitle}>Invite code</Text>
        <Text style={styles.cardText}>Give this to the second parent so they can join the same home.</Text>
        <Text style={styles.inviteCode}>{inviteCode ?? "Unavailable"}</Text>
        {isFamilyAdmin ? (
          <View style={styles.cardActions}>
            <PrimaryButton
              label={isSaving ? "Working..." : "Regenerate code"}
              icon="refresh"
              tone="soft"
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

      {isFamilyAdmin ? (
        <Card>
          <Text style={styles.cardTitle}>Household name</Text>
          <Text style={styles.label}>Family name</Text>
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
            <Text style={styles.helperTextCompact}>No login - for chores, stars, and kids mode.</Text>
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
        <Text style={styles.cardTitle}>Household plan</Text>
        <Text style={styles.helperText}>
          Plan: {subscriptionStatus?.subscriptionStatus ?? "free"}
          {subscriptionStatus?.subscriptionExpiresAt
            ? ` - expires ${new Date(subscriptionStatus.subscriptionExpiresAt).toLocaleDateString()}`
            : ""}
        </Text>
        {subscriptionMessage ? <Text style={styles.helperText}>{subscriptionMessage}</Text> : null}
        {!billingStatus.keyPresent ? <Text style={styles.helperText}>{billingStatus.message}</Text> : null}
        <View style={styles.cardActions}>
          <PrimaryButton
            label={showBillingPlans ? "Hide plans" : "View plans and billing"}
            icon="card"
            tone="soft"
            onPress={() => setShowBillingPlans((value) => !value)}
          />
        </View>
        {showBillingPlans ? (
          <>
        <View style={styles.planToolbar}>
          <PrimaryButton
            label={isLoadingBilling ? "Refreshing..." : "Refresh plans"}
            icon="refresh"
            tone="ghost"
            onPress={() => {
              if (isLoadingBilling) return;
              void loadBillingOptions();
            }}
          />
          {isFamilyAdmin ? (
            <PrimaryButton
              label={isRestoringPurchases ? "Restoring..." : "Restore purchases"}
              icon="download"
              tone="soft"
              onPress={() => {
                if (isRestoringPurchases) return;
                void handleRestorePurchases();
              }}
            />
          ) : null}
        </View>
        <View style={styles.planStack}>
          {planRows.map((plan) => (
            <View key={plan.name} style={styles.planRow}>
              <View style={styles.planCopy}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planDetail}>{plan.detail}</Text>
                <Text style={styles.planNote}>{plan.note}</Text>
              </View>
              <Text style={styles.planPrice}>{plan.price}</Text>
            </View>
          ))}
        </View>
        <View style={styles.inlineSectionHeader}>
          <Text style={styles.inlineSectionTitle}>Store checkout</Text>
          <Text style={styles.inlineSectionMeta}>{billingStatus.platform}</Text>
        </View>
        {!billingStatus.keyPresent ? (
          <Text style={styles.helperText}>{billingStatus.message}</Text>
        ) : billingMessage ? (
          <Text style={styles.helperText}>{billingMessage}</Text>
        ) : null}

        {billingSummaries.length > 0 ? (
          <View style={styles.storePlanStack}>
            {billingSummaries.map((summary, index) => (
              <View key={summary.id} style={styles.storePlanRow}>
                <View style={styles.planCopy}>
                  <Text style={styles.planName}>{summary.title}</Text>
                  <Text style={styles.planDetail}>{summary.description || "Household subscription"}</Text>
                  {summary.periodLabel ? <Text style={styles.planNote}>Billed {summary.periodLabel}</Text> : null}
                </View>
                <View style={styles.storePlanAside}>
                  <Text style={styles.planPrice}>{summary.priceLabel}</Text>
                  {isFamilyAdmin ? (
                    <PrimaryButton
                      label={activePurchaseId === summary.id ? "Starting..." : "Choose"}
                      icon="card"
                      onPress={() => {
                        if (activePurchaseId) return;
                        void handlePurchasePlan(billingPackages[index]!);
                      }}
                    />
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {billingManagementUrl ? (
          <View style={styles.cardActions}>
            <PrimaryButton
              label="Manage in store"
              icon="open-outline"
              tone="ghost"
              onPress={() => {
                void Linking.openURL(billingManagementUrl);
              }}
            />
          </View>
        ) : null}
          </>
        ) : null}
      </Card>

      <SectionTitle title="Leave household" />
      <Card>
        <Text style={styles.cardTitle}>Leave household</Text>
        <Text style={styles.cardText}>
          Leaving removes your membership from this household. You can rejoin later with an invite code.
        </Text>
        <View style={styles.cardActions}>
          <PrimaryButton
            label={isSaving ? "Working..." : "Leave household"}
            icon="exit"
            tone="soft"
            onPress={() => {
              if (isSaving || !backendConnected) return;
              void handleLeaveFamily();
            }}
          />
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
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.sm
  },
  closeLabel: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "700"
  },
  summaryTop: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  summaryGrid: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg
  },
  summaryStat: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    padding: spacing.md
  },
  summaryValue: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: "700"
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: spacing.xs,
    textTransform: "uppercase"
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
    fontWeight: "600",
    lineHeight: 19,
    marginTop: spacing.md
  },
  helperTextCompact: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: spacing.sm
  },
  inlineSectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xl
  },
  inlineSectionTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "700"
  },
  inlineSectionMeta: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  planToolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.md
  },
  planStack: {
    gap: spacing.sm,
    marginTop: spacing.md
  },
  planRow: {
    alignItems: "flex-start",
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  planCopy: {
    flex: 1,
    gap: 2
  },
  planName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800"
  },
  planDetail: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  planNote: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17
  },
  planPrice: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "900"
  },
  storePlanStack: {
    gap: spacing.sm,
    marginTop: spacing.md
  },
  storePlanRow: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md
  },
  storePlanAside: {
    alignItems: "flex-start",
    gap: spacing.sm
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
  memberCopy: {
    flex: 1,
    gap: 2
  },
  memberName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800"
  },
  memberMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18
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
  formMessage: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19
  },
  saveMessage: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19
  }
});

import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";

import { ActionFeedback } from "../components/ActionFeedback";
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

function feedbackTone(message: string): "success" | "error" | "info" {
  if (/(fail|error|required|could not|unable|unavailable|only|sign in)/i.test(message)) {
    return "error";
  }

  if (/(saving|adding|removing|loading|refreshing|restoring|regenerating|leaving)/i.test(message)) {
    return "info";
  }

  return "success";
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
  const [showHouseholdDetails, setShowHouseholdDetails] = useState(false);
  const [showAddChildForm, setShowAddChildForm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
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
  const adultMembers = members.filter((member) => member.role !== "kid");
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
            {backendConnected
              ? "Invite the second parent, manage child profiles, and keep the home organized."
              : "Sign in to manage the household from one shared place."}
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
            <Text style={styles.summaryValue}>{adultMembers.length}</Text>
            <Text style={styles.summaryLabel}>adults</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryValue}>{childProfiles.length}</Text>
            <Text style={styles.summaryLabel}>kids</Text>
          </View>
          <View style={[styles.summaryStat, styles.summaryStatWide]}>
            <Text style={styles.summaryValue}>{inviteCode ? "Ready" : "Missing"}</Text>
            <Text style={styles.summaryLabel}>invite</Text>
          </View>
        </View>
      </Card>

      <SectionTitle title="Family access" />
      <Card>
        <Text style={styles.cardTitle}>Invite a second parent</Text>
        <Text style={styles.cardText}>Share this code so the other adult can join the same household.</Text>
        <Text style={styles.inviteCode}>{inviteCode ?? "Unavailable"}</Text>
        <Text style={styles.helperText}>On the other phone: sign in first, then choose Join with code during household setup.</Text>
        {isFamilyAdmin ? (
          <View style={styles.cardActions}>
            <PrimaryButton
              label="Regenerate code"
              icon="refresh"
              tone="soft"
              loading={isSaving}
              disabled={isSaving || !backendConnected}
              onPress={() => {
                if (isSaving || !backendConnected) return;
                void handleRegenerateInvite();
              }}
            />
          </View>
        ) : (
          <Text style={styles.helperText}>Only the household admin can regenerate the invite code.</Text>
        )}
      </Card>

      {isFamilyAdmin ? (
        <Card>
          <View style={styles.cardActions}>
            <PrimaryButton
              label={showHouseholdDetails ? "Hide household details" : "Edit household details"}
              icon={showHouseholdDetails ? "chevron-up" : "create"}
              tone="ghost"
              onPress={() => setShowHouseholdDetails((value) => !value)}
            />
          </View>
          {showHouseholdDetails ? (
            <>
              <Text style={styles.cardTitle}>Household name</Text>
              <Text style={styles.cardText}>Use the name everyone in the home will recognize at a glance.</Text>
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
                  label="Save name"
                  icon="checkmark"
                  loading={isSaving}
                  disabled={isSaving || !backendConnected}
                  onPress={() => {
                    if (isSaving || !backendConnected) return;
                    void handleSaveFamilyName();
                  }}
                />
              </View>
            </>
          ) : null}
        </Card>
      ) : null}

      <ActionFeedback message={formMessage ?? ""} tone={feedbackTone(formMessage ?? "")} visible={Boolean(formMessage)} />
      <ActionFeedback message={saveMessage ?? ""} tone={feedbackTone(saveMessage ?? "")} visible={Boolean(saveMessage)} />

      <SectionTitle title="Adults" action={`${adultMembers.length} total`} />
      <View style={styles.stack}>
        {adultMembers.map((member) => (
          <Card key={member.id}>
            <Row>
              <MemberAvatar member={member} size={40} />
              <View style={styles.memberCopy}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberMeta}>
                  {roleLabel(member.role)}
                  {member.userId ? " - signed-in account" : " - invite pending"}
                </Text>
              </View>
              <Pill label={member.userId ? "Connected" : "Pending"} tone={member.userId ? "mint" : "neutral"} />
            </Row>
          </Card>
        ))}
      </View>

      <SectionTitle title="Child profiles" action={`${childProfiles.length} total`} />
      {isFamilyAdmin ? (
        <Card>
          <Text style={styles.cardTitle}>Kids mode profiles</Text>
          <Text style={styles.cardText}>Create child profiles for chores, stars, and the kid-friendly view.</Text>
          <Text style={styles.helperText}>Child profiles stay inside Kids mode on a signed-in household device in this build.</Text>
          <View style={styles.cardActions}>
            <PrimaryButton
              label={showAddChildForm ? "Hide child form" : "Add child profile"}
              icon={showAddChildForm ? "chevron-up" : "person-add"}
              tone="soft"
              onPress={() => setShowAddChildForm((value) => !value)}
            />
          </View>
          {showAddChildForm ? (
            <>
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
                  label="Save child profile"
                  icon="checkmark"
                  loading={isSaving}
                  disabled={isSaving || !backendConnected}
                  onPress={() => {
                    if (isSaving || !backendConnected) return;
                    void handleAddChild();
                  }}
                />
              </View>
            </>
          ) : null}
        </Card>
      ) : null}
      <View style={styles.stack}>
        {childProfiles.length === 0 ? (
          <Card>
            <Text style={styles.emptyTitle}>No child profiles yet.</Text>
            <Text style={styles.emptyText}>Add the first child when you are ready to assign chores and track stars.</Text>
          </Card>
        ) : null}
        {childProfiles.map((member) => (
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
              <Pill label="Kids mode" tone="gold" />
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
                        label="Save child"
                        icon="checkmark"
                        loading={isSaving}
                        disabled={isSaving || !backendConnected}
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
                      label="Remove"
                      icon="trash"
                      tone="dark"
                      loading={isSaving}
                      disabled={isSaving || !backendConnected}
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

      <Card>
        <Text style={styles.cardTitle}>Household plan</Text>
        <Text style={styles.cardText}>One plan covers the home. The admin handles billing and everyone else joins with the invite code.</Text>
        <Text style={styles.helperText}>
          Plan: {subscriptionStatus?.subscriptionStatus ?? "free"}
          {subscriptionStatus?.subscriptionExpiresAt
            ? ` - expires ${new Date(subscriptionStatus.subscriptionExpiresAt).toLocaleDateString()}`
            : ""}
        </Text>
        <ActionFeedback
          message={subscriptionMessage ?? ""}
          tone={feedbackTone(subscriptionMessage ?? "")}
          visible={Boolean(subscriptionMessage)}
        />
        <ActionFeedback
          message={(billingMessage ?? (!billingStatus.keyPresent ? billingStatus.message : "")) || ""}
          tone={feedbackTone((billingMessage ?? (!billingStatus.keyPresent ? billingStatus.message : "")) || "")}
          visible={Boolean(billingMessage || !billingStatus.keyPresent)}
        />
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
                label="Refresh plans"
                icon="refresh"
                tone="ghost"
                loading={isLoadingBilling}
                disabled={isLoadingBilling}
                onPress={() => {
                  if (isLoadingBilling) return;
                  void loadBillingOptions();
                }}
              />
              {isFamilyAdmin ? (
                <PrimaryButton
                  label="Restore purchases"
                  icon="download"
                  tone="soft"
                  loading={isRestoringPurchases}
                  disabled={isRestoringPurchases}
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
                          label="Choose"
                          icon="card"
                          loading={activePurchaseId === summary.id}
                          disabled={Boolean(activePurchaseId)}
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
        {!showLeaveConfirm ? (
          <View style={styles.cardActions}>
            <PrimaryButton
              label="Leave household"
              icon="exit"
              tone="ghost"
              loading={isSaving}
              disabled={isSaving || !backendConnected}
              onPress={() => {
                if (isSaving || !backendConnected) return;
                setShowLeaveConfirm(true);
              }}
            />
          </View>
        ) : (
          <>
            <Text style={styles.warningText}>
              This removes your access to the shared home until you join again with a fresh invite code.
            </Text>
            <View style={styles.memberButtonRow}>
              <PrimaryButton
                label="Keep me here"
                icon="close"
                tone="soft"
                onPress={() => setShowLeaveConfirm(false)}
              />
              <PrimaryButton
                label="Confirm leave"
                icon="exit"
                tone="dark"
                loading={isSaving}
                disabled={isSaving || !backendConnected}
                onPress={() => {
                  if (isSaving || !backendConnected) return;
                  void handleLeaveFamily();
                }}
              />
            </View>
          </>
        )}
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
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.md
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
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.lg
  },
  summaryStat: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexBasis: "47%",
    flexGrow: 1,
    padding: spacing.md
  },
  summaryStatWide: {
    flexBasis: "100%"
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
  emptyTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "700"
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    marginTop: spacing.xs
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
  warningText: {
    color: colors.coral,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: spacing.md
  },
  formMessage: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19
  }
});

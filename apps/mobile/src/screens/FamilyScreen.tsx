import type { ChildDeviceRecord } from "@homethread/shared";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";

import { ActionFeedback } from "../components/ActionFeedback";
import { Card, MemberAvatar, Pill, PrimaryButton, Row, SectionTitle } from "../components/Primitives";
import { ScreenHeader } from "../components/ScreenHeader";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { apiRequest } from "../services/api";
import { createChildPairingCode, listActiveChildPairingCodes, listChildDevices, revokeChildDevice } from "../services/childDeviceApi";
import {
  type BillingPackageSummary,
  getBillingCustomerInfo,
  getBillingPackages,
  getBillingStatus,
  purchaseBillingPackage,
  restoreBillingPurchases
} from "../services/billing";
import { useHomeThreadStore, isHomeThreadSavingScope } from "../store/useHomeThreadStore";
import { safeText } from "../utils/safeRender";
import { MobileSubscriptionStatus, FamilyMember } from "../types";
import { getAdultMemberAccountLabel, getCurrentUserAccessLabel, getEffectiveFamilyCreatorId, getMemberAccessKind, getMemberAccessLabel } from "../utils/memberAccessLabel";
import { copyText } from "../utils/copyText";
import { useAuthStore } from "../store/useAuthStore";

function formatPairingExpiry(expiresAt: string) {
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) {
    return "Expiry unknown";
  }

  const minutesLeft = Math.max(0, Math.round((expiry.getTime() - Date.now()) / 60000));
  if (minutesLeft <= 0) {
    return "Expired";
  }

  const timeLabel = expiry.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (minutesLeft < 60) {
    return `Expires in about ${minutesLeft} min (${timeLabel})`;
  }

  return `Expires ${expiry.toLocaleString([], { dateStyle: "short", timeStyle: "short" })}`;
}

function roleLabel(
  member: Pick<FamilyMember, "role" | "userId">,
  effectiveFamilyCreatedBy: string | null
) {
  return getMemberAccessLabel(member, effectiveFamilyCreatedBy);
}

function formatChildDeviceStatus(device: ChildDeviceRecord) {
  if (device.revokedAt) {
    return "Revoked - phone signed out on next use";
  }

  if (device.pushToken) {
    return "Active - notifications on";
  }

  return "Active - paired";
}

function accessPillTone(kind: ReturnType<typeof getMemberAccessKind>) {
  if (kind === "owner") return "gold" as const;
  if (kind === "admin") return "primary" as const;
  if (kind === "child") return "gold" as const;
  return "neutral" as const;
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

export function FamilyScreen({
  onClose,
  onLeaveComplete
}: {
  onClose: () => void;
  onLeaveComplete?: (result: { needsFamilySetup: boolean }) => void;
}) {
  const {
    familyId,
    familyName,
    inviteCode,
    familyCreatedBy,
    isFamilyAdmin,
    members,
    syncSource,
    saveMessage,
    regenerateInviteCode,
    updateFamilyName,
    leaveFamily,
    createVirtualMember,
    updateVirtualMember,
    removeVirtualMember,
    promoteMemberToAdmin
  } = useHomeThreadStore();
  const isSavingFamily = useHomeThreadStore(isHomeThreadSavingScope("family"));
  const currentUserId = useAuthStore((state) => state.userId);
  const [childName, setChildName] = useState("");
  const [editedFamilyName, setEditedFamilyName] = useState(familyName);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingMemberName, setEditingMemberName] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);
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
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [pendingRemoveMemberId, setPendingRemoveMemberId] = useState<string | null>(null);
  const [promotingMemberId, setPromotingMemberId] = useState<string | null>(null);
  const [activePairingCodes, setActivePairingCodes] = useState<
    Record<string, { code: string; expiresAt: string; memberName: string }>
  >({});
  const [childDevices, setChildDevices] = useState<ChildDeviceRecord[]>([]);
  const [pairingFeedback, setPairingFeedback] = useState<string | null>(null);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [isRegeneratingInvite, setIsRegeneratingInvite] = useState(false);
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [pairingMemberId, setPairingMemberId] = useState<string | null>(null);
  const [childFormMessage, setChildFormMessage] = useState<string | null>(null);
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
  const effectiveFamilyCreatedBy = getEffectiveFamilyCreatorId(familyCreatedBy, members);
  const householdAdminCount = members.filter((member) => member.role === "parent").length;
  const isSoleAdmin = isFamilyAdmin && householdAdminCount <= 1;
  const pendingRemoveDeviceCount = pendingRemoveMemberId
    ? childDevices.filter(
        (device) => device.memberId === pendingRemoveMemberId && !device.revokedAt
      ).length
    : 0;
  const currentAccessLabel = getCurrentUserAccessLabel({
    isFamilyAdmin,
    currentUserId,
    familyCreatedBy: effectiveFamilyCreatedBy
  });

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
      setShowLeaveConfirm(false);
      return;
    }

    setShowLeaveConfirm(false);
    if (onLeaveComplete) {
      onLeaveComplete({ needsFamilySetup: result.needsFamilySetup ?? false });
      return;
    }

    onClose();
  }

  async function handleRegenerateInvite() {
    setFormMessage(null);
    setInviteFeedback(null);
    setIsRegeneratingInvite(true);
    const result = await regenerateInviteCode();
    setIsRegeneratingInvite(false);
    setShowRegenerateConfirm(false);
    if (!result.ok) {
      setInviteFeedback(result.message ?? "Could not regenerate invite code.");
      return;
    }

    const updatedCode = useHomeThreadStore.getState().inviteCode;
    setInviteFeedback(updatedCode ? `New adult code ready: ${updatedCode}` : "Adult invite code updated.");
  }

  async function handlePromoteMember(memberId: string) {
    setFormMessage(null);
    setPromotingMemberId(memberId);
    const result = await promoteMemberToAdmin(memberId);
    setPromotingMemberId(null);
    if (!result.ok) {
      setFormMessage(result.message ?? "Could not promote that adult.");
    }
  }

  async function loadActivePairingCodes() {
    if (!familyId || !backendConnected) {
      setActivePairingCodes({});
      return;
    }

    const result = await listActiveChildPairingCodes(familyId);
    if (!result.data) {
      return;
    }

    const next: Record<string, { code: string; expiresAt: string; memberName: string }> = {};
    for (const entry of result.data.pairingCodes) {
      next[entry.memberId] = {
        code: entry.pairingCode,
        expiresAt: entry.expiresAt,
        memberName: entry.memberName
      };
    }
    setActivePairingCodes(next);
  }

  async function loadChildDevices() {
    if (!familyId || !backendConnected) {
      setChildDevices([]);
      return;
    }

    setIsLoadingDevices(true);
    const result = await listChildDevices(familyId);
    setIsLoadingDevices(false);

    if (result.data) {
      setChildDevices(result.data.devices);
    }
  }

  async function handleGeneratePairingCode(memberId: string, memberName: string) {
    if (!familyId || !backendConnected) {
      setPairingFeedback("Sign in to generate a child pairing code.");
      return;
    }

    setPairingFeedback(null);
    setPairingMemberId(memberId);
    const result = await createChildPairingCode(familyId, memberId);
    setPairingMemberId(null);
    if (!result.data) {
      setPairingFeedback(result.error?.message ?? "Could not create a pairing code.");
      return;
    }

    setActivePairingCodes((current) => ({
      ...current,
      [memberId]: {
        code: result.data!.pairingCode,
        expiresAt: result.data!.expiresAt,
        memberName: result.data!.memberName || memberName
      }
    }));
    setPairingFeedback(`Pairing code ready for ${memberName}. One phone per child - a new pairing replaces the old device.`);
    void loadChildDevices();
    void loadActivePairingCodes();
  }

  async function handleCopyPairingCode(code: string) {
    const result = await copyText(code);
    setPairingFeedback(result.ok ? "Pairing code copied." : (result.message ?? "Could not copy automatically."));
  }

  async function handleRevokeChildDevice(deviceId: string) {
    if (!familyId || !backendConnected) {
      return;
    }

    setPairingFeedback(null);
    const result = await revokeChildDevice(familyId, deviceId);
    if (!result.data?.revoked) {
      setPairingFeedback(result.error?.message ?? "Could not revoke that device.");
      return;
    }

    setPairingFeedback("Device revoked. That phone loses access on its next check-in.");
    void loadChildDevices();
  }

  async function handleCopyInvite() {
    if (!inviteCode) {
      setInviteFeedback("No invite code available yet.");
      return;
    }

    const result = await copyText(inviteCode);
    setInviteFeedback(result.ok ? "Adult invite code copied." : (result.message ?? "Could not copy automatically."));
  }

  async function handleAddChild() {
    setFormMessage(null);
    setChildFormMessage(null);
    const trimmedName = childName.trim();
    if (!trimmedName) {
      setChildFormMessage("Enter a name for the child profile.");
      return;
    }

    setIsAddingChild(true);
    const result = await createVirtualMember({ displayName: trimmedName, role: "child" });
    setIsAddingChild(false);
    if (!result.ok) {
      setChildFormMessage(result.message ?? "Could not add that child profile.");
      return;
    }

    setChildName("");
    setShowAddChildForm(false);
    setChildFormMessage(result.message ?? `${trimmedName} added.`);
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
      setFormMessage(result.message ?? "Could not update that profile.");
      return;
    }

    setEditingMemberId(null);
    setEditingMemberName("");
  }

  async function handleRemoveMember(memberId: string) {
    setFormMessage(null);
    const result = await removeVirtualMember(memberId);
    if (!result.ok) {
      setFormMessage(result.message ?? "Could not remove that profile.");
      return;
    }

    setPendingRemoveMemberId(null);
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
      setBillingMessage("Only the household admin manages billing. Other adults join with the adult invite code.");
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
    if (!formMessage && !saveMessage) {
      return;
    }

    const timer = setTimeout(() => {
      setFormMessage(null);
      if (saveMessage) {
        useHomeThreadStore.setState({ saveMessage: "" });
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [formMessage, saveMessage]);

  useEffect(() => {
    if (!inviteFeedback) {
      return;
    }

    const timer = setTimeout(() => setInviteFeedback(null), 3500);
    return () => clearTimeout(timer);
  }, [inviteFeedback]);

  useEffect(() => {
    if (!pairingFeedback) {
      return;
    }

    const timer = setTimeout(() => setPairingFeedback(null), 4500);
    return () => clearTimeout(timer);
  }, [pairingFeedback]);

  useEffect(() => {
    void loadChildDevices();
    void loadActivePairingCodes();
  }, [familyId, backendConnected]);

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
      <ScreenHeader
        eyebrow="Household"
        title={safeText(familyName, "Your household")}
        subtitle={
          backendConnected
            ? "Invite adults, pair child devices, manage profiles."
            : "Sign in to manage the household."
        }
        variant="admin"
        actionLabel="Close"
        onActionPress={onClose}
      />

      <View style={styles.inviteHero}>
        <View style={styles.inviteHeroHeader}>
          <Text style={styles.inviteHeroTitle}>Adult invite code</Text>
          <Pill label="Adults only" tone="primary" />
        </View>
        <Text style={styles.inviteHeroText}>Second parent signs in, then joins with this code. Kids never use it.</Text>
        <Text style={styles.inviteHeroText}>
          Regenerating creates a new code immediately. Any older adult code that is still being shared stops working.
        </Text>
        <Text selectable style={styles.inviteCode} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
          {inviteCode ?? "Unavailable"}
        </Text>
        <View style={styles.inviteActionRow}>
          <PrimaryButton
            label="Copy code"
            icon="copy"
            tone="soft"
            disabled={!inviteCode}
            onPress={() => {
              void handleCopyInvite();
            }}
          />
          {isFamilyAdmin && !showRegenerateConfirm ? (
            <PrimaryButton
              label="Regenerate"
              icon="refresh"
              loading={isRegeneratingInvite}
              disabled={isRegeneratingInvite || !backendConnected}
              onPress={() => {
                if (isRegeneratingInvite || !backendConnected) return;
                setShowRegenerateConfirm(true);
              }}
            />
          ) : null}
        </View>
        {isFamilyAdmin && showRegenerateConfirm ? (
          <View style={styles.inlineConfirm}>
            <Text style={styles.warningText}>
              This replaces the current adult invite code. Anyone still trying the old code will not be able to join.
            </Text>
            <View style={styles.memberButtonRow}>
              <PrimaryButton
                label="Keep current code"
                icon="close"
                tone="soft"
                onPress={() => setShowRegenerateConfirm(false)}
              />
              <PrimaryButton
                label="Regenerate now"
                icon="refresh"
                tone="dark"
                loading={isRegeneratingInvite}
                disabled={isRegeneratingInvite || !backendConnected}
                onPress={() => {
                  if (isRegeneratingInvite || !backendConnected) return;
                  void handleRegenerateInvite();
                }}
              />
            </View>
          </View>
        ) : null}
        {inviteFeedback ? <Text style={styles.inviteFeedback}>{inviteFeedback}</Text> : null}
      </View>

      <View style={styles.futurePairingPanel}>
        <View style={styles.futurePairingHeader}>
          <Text style={styles.futurePairingTitle}>Child device pairing</Text>
          <Pill label="KC- codes" tone="gold" icon="key" />
        </View>
        <Text style={styles.futurePairingText}>
          Each child gets a KC- code on their own phone or tablet. One active device per child - a new code replaces the old phone.
        </Text>
        <View style={styles.futurePairingPlaceholders}>
          <View style={styles.futurePairingSlot}>
            <Text style={styles.futurePairingSlotLabel}>Paired devices</Text>
            <Text style={styles.futurePairingSlotValue}>
              {isLoadingDevices ? "Loading..." : `${childDevices.filter((device) => !device.revokedAt).length} active`}
            </Text>
          </View>
        </View>
        {pairingFeedback ? <Text style={styles.pairingFeedback}>{pairingFeedback}</Text> : null}
        {childDevices.length > 0 ? (
          <View style={styles.deviceList}>
            {[...childDevices]
              .sort((left, right) => Number(Boolean(left.revokedAt)) - Number(Boolean(right.revokedAt)))
              .map((device) => (
              <View key={device.id} style={styles.deviceRow}>
                <View style={styles.deviceCopy}>
                  <Text style={styles.deviceName}>{device.memberName}</Text>
                  <Text style={styles.deviceMeta}>{formatChildDeviceStatus(device)}</Text>
                </View>
                {isFamilyAdmin && !device.revokedAt ? (
                  <PrimaryButton
                    label="Revoke"
                    icon="close-circle"
                    tone="ghost"
                    onPress={() => {
                      void handleRevokeChildDevice(device.id);
                    }}
                  />
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.summaryStrip}>
        <View style={styles.summaryTop}>
          <Pill label={`${currentAccessLabel} access`} tone={accessPillTone(
            currentAccessLabel === "Owner" ? "owner" : currentAccessLabel === "Admin" ? "admin" : "member"
          )} />
          <Pill label={backendConnected ? "Connected" : "Local-only"} tone={backendConnected ? "mint" : "neutral"} />
        </View>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {adultMembers.length}
            </Text>
            <Text style={styles.summaryLabel} numberOfLines={1}>
              Adults
            </Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {childProfiles.length}
            </Text>
            <Text style={styles.summaryLabel} numberOfLines={1}>
              Child profiles
            </Text>
          </View>
        </View>
      </View>

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
                  loading={isSavingFamily}
                  disabled={isSavingFamily || !backendConnected}
                  onPress={() => {
                    if (isSavingFamily || !backendConnected) return;
                    void handleSaveFamilyName();
                  }}
                />
              </View>
            </>
          ) : null}
        </Card>
      ) : null}

      <ActionFeedback
        message={formMessage ?? saveMessage ?? ""}
        tone={feedbackTone(formMessage ?? saveMessage ?? "")}
        visible={Boolean(formMessage ?? saveMessage)}
      />

      <SectionTitle title="Adults" action={`${adultMembers.length} total`} />
      <View style={styles.memberList}>
        {adultMembers.map((member) => (
          <View key={member.id} style={styles.memberRow}>
            <Row>
              <MemberAvatar member={member} size={40} />
              <View style={styles.memberCopy}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberMeta}>
                  {roleLabel(member, effectiveFamilyCreatedBy)} · {getAdultMemberAccountLabel(member)}
                </Text>
              </View>
              <View style={styles.accessPillWrap}>
                <Pill
                  label={getMemberAccessLabel(member, effectiveFamilyCreatedBy)}
                  tone={accessPillTone(getMemberAccessKind(member, effectiveFamilyCreatedBy))}
                />
              </View>
            </Row>
            {isFamilyAdmin &&
            member.role === "caregiver" &&
            member.userId &&
            !member.isVirtual ? (
              <View style={styles.memberActions}>
                <PrimaryButton
                  label={promotingMemberId === member.id ? "Promoting..." : "Make admin"}
                  icon="shield"
                  tone="soft"
                  loading={promotingMemberId === member.id}
                  disabled={isSavingFamily || promotingMemberId === member.id || !backendConnected}
                  onPress={() => {
                    if (isSavingFamily || promotingMemberId === member.id || !backendConnected) return;
                    void handlePromoteMember(member.id);
                  }}
                />
              </View>
            ) : null}
          </View>
        ))}
      </View>

      <SectionTitle title="Child profiles" action={`${childProfiles.length} total`} />
      {isFamilyAdmin ? (
        <View style={styles.addChildPanel}>
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
                  label={isAddingChild ? "Saving..." : "Save child profile"}
                  icon="checkmark"
                  loading={isAddingChild}
                  disabled={isAddingChild || !backendConnected}
                  onPress={() => {
                    if (isAddingChild || !backendConnected) return;
                    void handleAddChild();
                  }}
                />
              </View>
              <ActionFeedback
                message={childFormMessage ?? ""}
                tone={feedbackTone(childFormMessage ?? "")}
                visible={Boolean(childFormMessage)}
              />
            </>
          ) : null}
        </View>
      ) : null}
      <View style={styles.memberList}>
        {childProfiles.length === 0 ? (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyTitle}>No child profiles yet.</Text>
            <Text style={styles.emptyText}>Add the first child when you are ready to assign chores and track stars.</Text>
          </View>
        ) : null}
        {childProfiles.map((member) => (
          <View key={member.id} style={styles.memberRow}>
            <Row>
              <MemberAvatar member={member} size={40} />
              <View style={styles.memberCopy}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberMeta}>
                  {roleLabel(member, effectiveFamilyCreatedBy)} · {member.userId ? "Signed in" : "Profile only"}
                </Text>
              </View>
              <View style={styles.accessPillWrap}>
                <Pill label="Child profile" tone="gold" />
              </View>
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
                        loading={isSavingFamily}
                        disabled={isSavingFamily || !backendConnected}
                        onPress={() => {
                          if (isSavingFamily || !backendConnected) return;
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
                      label={pairingMemberId === member.id ? "Generating..." : "Pair device"}
                      icon="phone-portrait"
                      tone="soft"
                      loading={pairingMemberId === member.id}
                      disabled={!backendConnected || pairingMemberId === member.id}
                      onPress={() => {
                        void handleGeneratePairingCode(member.id, member.name);
                      }}
                    />
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
                      loading={isSavingFamily}
                      disabled={isSavingFamily || !backendConnected}
                      onPress={() => {
                        if (isSavingFamily || !backendConnected) return;
                        setPendingRemoveMemberId(member.id);
                      }}
                    />
                  </View>
                )}
                {pendingRemoveMemberId === member.id ? (
                  <View style={styles.inlineConfirm}>
                    <Text style={styles.warningText}>
                      Removing {member.name} deletes this child profile. Any paired phone for this child loses access on
                      its next use
                      {pendingRemoveDeviceCount > 0
                        ? ` (${pendingRemoveDeviceCount} active device${pendingRemoveDeviceCount === 1 ? "" : "s"} paired now).`
                        : "."}
                    </Text>
                    <View style={styles.memberButtonRow}>
                      <PrimaryButton
                        label="Keep profile"
                        icon="close"
                        tone="soft"
                        onPress={() => setPendingRemoveMemberId(null)}
                      />
                      <PrimaryButton
                        label="Remove profile"
                        icon="trash"
                        tone="dark"
                        loading={isSavingFamily}
                        disabled={isSavingFamily || !backendConnected}
                        onPress={() => {
                          if (isSavingFamily || !backendConnected) return;
                          void handleRemoveMember(member.id);
                        }}
                      />
                    </View>
                  </View>
                ) : null}
                {activePairingCodes[member.id] ? (
                  <View style={styles.pairingCodeCard}>
                    <Text style={styles.pairingCodeLabel}>Child pairing code for {member.name}</Text>
                    <Text selectable style={styles.pairingCodeValue}>
                      {activePairingCodes[member.id]?.code}
                    </Text>
                    <Text style={styles.pairingCodeHint}>
                      {formatPairingExpiry(activePairingCodes[member.id]?.expiresAt ?? "")}
                    </Text>
                    <Text style={styles.pairingCodeHint}>
                      Child enters this on Welcome → Set up child's device. One phone per child.
                    </Text>
                    <PrimaryButton
                      label="Copy pairing code"
                      icon="copy"
                      tone="ghost"
                      onPress={() => {
                        const code = activePairingCodes[member.id]?.code;
                        if (code) {
                          void handleCopyPairingCode(code);
                        }
                      }}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ))}
      </View>

      <SectionTitle title="Future plans" action="Preview" />
      <Card>
        <View style={styles.previewBillingHeader}>
          <Text style={styles.cardTitle}>Plan and billing</Text>
          <Pill label="Preview" tone="gold" icon="card" />
        </View>
        <Text style={styles.cardText}>
          Preview build - billing coming soon. No payment is required or collected in this build.
        </Text>
        <Text style={styles.helperText}>
          Current plan: {subscriptionStatus?.subscriptionStatus ?? "free preview"}
        </Text>
        <ActionFeedback
          message={subscriptionMessage ?? ""}
          tone={feedbackTone(subscriptionMessage ?? "")}
          visible={Boolean(subscriptionMessage)}
        />
        <View style={styles.cardActions}>
          <PrimaryButton
            label={showBillingPlans ? "Hide planned tiers" : "View planned tiers"}
            icon="card"
            tone="soft"
            onPress={() => setShowBillingPlans((value) => !value)}
          />
        </View>
        {showBillingPlans ? (
          <>
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
            <Text style={styles.previewBillingNote}>
              Store checkout and subscriptions are not live in this preview. Purchases and restore are disabled.
            </Text>
          </>
        ) : null}
      </Card>

      <SectionTitle title="Leave household" />
      <Card>
        <Text style={styles.cardTitle}>Leave household</Text>
        <Text style={styles.cardText}>
          Leaving removes your membership from this household. You can rejoin later with an adult invite code.
        </Text>
        {isSoleAdmin ? (
          <Text style={styles.warningText}>
            You are the only admin right now. Promote another signed-in adult to admin before leaving, or the household
            would lose admin access.
          </Text>
        ) : null}
        {!showLeaveConfirm ? (
          <View style={styles.cardActions}>
            <PrimaryButton
              label="Leave household"
              icon="exit"
              tone="ghost"
              loading={isSavingFamily}
              disabled={isSavingFamily || !backendConnected || isSoleAdmin}
              onPress={() => {
                if (isSavingFamily || !backendConnected || isSoleAdmin) return;
                setShowLeaveConfirm(true);
              }}
            />
          </View>
        ) : (
          <>
            <Text style={styles.warningText}>
              This removes your access to the shared home until you join again with a fresh adult invite code.
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
                loading={isSavingFamily}
                disabled={isSavingFamily || !backendConnected}
                onPress={() => {
                  if (isSavingFamily || !backendConnected) return;
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
  summaryStrip: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    gap: spacing.md,
    paddingBottom: spacing.md
  },
  summaryTop: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  summaryStat: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexBasis: "30%",
    flexGrow: 1,
    minWidth: 96,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  inviteHero: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.lineStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.lg
  },
  inviteHeroHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between"
  },
  previewBillingHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
    marginBottom: spacing.xs
  },
  previewBillingNote: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    marginTop: spacing.md
  },
  inviteHeroTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 30
  },
  inviteHeroText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20
  },
  secondaryPanel: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md
  },
  secondaryTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800"
  },
  secondaryText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19
  },
  addChildPanel: {
    gap: spacing.sm
  },
  memberList: {
    gap: spacing.xs
  },
  memberRow: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    paddingVertical: spacing.sm
  },
  emptyRow: {
    gap: spacing.xs,
    paddingVertical: spacing.sm
  },
  summaryValue: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 26
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
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 1.5,
    lineHeight: 32,
    marginTop: spacing.sm
  },
  inviteCodeHint: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    marginTop: spacing.xs
  },
  inviteActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md
  },
  inviteFeedback: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
    marginTop: spacing.sm
  },
  futurePairingPanel: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md
  },
  futurePairingHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between"
  },
  futurePairingTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800"
  },
  futurePairingText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19
  },
  futurePairingPlaceholders: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs
  },
  futurePairingSlot: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexGrow: 1,
    gap: 2,
    minWidth: 128,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  futurePairingSlotLabel: {
    color: colors.tertiary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  futurePairingSlotValue: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700"
  },
  pairingFeedback: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
    marginTop: spacing.sm
  },
  deviceList: {
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  deviceRow: {
    alignItems: "center",
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.sm
  },
  deviceCopy: {
    flex: 1,
    gap: 2
  },
  deviceName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800"
  },
  deviceMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600"
  },
  pairingCodeCard: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: spacing.sm
  },
  pairingCodeLabel: {
    color: colors.tertiary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  pairingCodeValue: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1.2
  },
  pairingCodeHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18
  },
  helperText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    marginTop: spacing.md
  },
  comingSoonTitle: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "800",
    marginTop: spacing.sm,
    textTransform: "uppercase"
  },
  comingSoonText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19
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
    gap: 2,
    minWidth: 0
  },
  accessPillWrap: {
    flexShrink: 0
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
  inlineConfirm: {
    gap: spacing.sm,
    marginTop: spacing.md
  },
  formMessage: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19
  }
});

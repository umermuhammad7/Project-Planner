import Ionicons from "@expo/vector-icons/Ionicons";
import type { ChildDeviceRecord } from "@homethread/shared";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, LayoutAnimation, Platform, Pressable, StyleSheet, Text, TextInput, UIManager, View } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";

import { ActionFeedback } from "../components/ActionFeedback";
import { useScrollAssist } from "../context/ScrollAssistContext";
import { Card, MemberAvatar, Pill, PrimaryButton, Row } from "../components/Primitives";
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

type CardHeaderTone = "primary" | "mint" | "gold" | "coral";
type CardHeaderIconName = keyof typeof Ionicons.glyphMap;

const cardHeaderToneStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primarySoft },
  mint: { backgroundColor: "rgba(95, 168, 136, 0.14)" },
  gold: { backgroundColor: "rgba(214, 168, 74, 0.16)" },
  coral: { backgroundColor: "rgba(224, 122, 95, 0.14)" }
});

const cardHeaderToneIconColors: Record<CardHeaderTone, string> = {
  primary: colors.primary,
  mint: colors.mint,
  gold: "#996A00",
  coral: colors.coral
};

function CardHeader({
  icon,
  emoji,
  tone,
  title,
  meta,
  right
}: {
  icon?: CardHeaderIconName;
  emoji?: string;
  tone: CardHeaderTone;
  title: string;
  meta?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.cardHeaderRow}>
      <View style={[styles.cardHeaderIcon, cardHeaderToneStyles[tone]]}>
        {emoji ? (
          <Text style={styles.cardHeaderEmoji}>{emoji}</Text>
        ) : icon ? (
          <Ionicons name={icon} size={17} color={cardHeaderToneIconColors[tone]} />
        ) : null}
      </View>
      <Text style={styles.cardHeaderTitle}>{title}</Text>
      {meta ? <Text style={styles.cardHeaderMeta}>{meta}</Text> : null}
      {right}
    </View>
  );
}

function WidgetTile({
  emoji,
  tone,
  label,
  meta,
  active,
  onPress
}: {
  emoji: string;
  tone: CardHeaderTone;
  label: string;
  meta: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: active }}
      accessibilityLabel={`${label}. ${meta}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.widgetTile,
        cardHeaderToneStyles[tone],
        active && { borderColor: cardHeaderToneIconColors[tone], borderWidth: 2 },
        pressed && !active && styles.widgetTilePressed
      ]}
    >
      <View style={[styles.widgetTileIconBadge, active ? { backgroundColor: cardHeaderToneIconColors[tone] } : styles.widgetTileIconBadgeIdle]}>
        <Text style={styles.widgetTileEmoji}>{emoji}</Text>
      </View>
      <Text style={[styles.widgetTileLabel, active && styles.widgetTileLabelActive]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.widgetTileMeta} numberOfLines={1}>
        {meta}
      </Text>
    </Pressable>
  );
}

function ActionButton({
  emoji,
  label,
  tone,
  solid = false,
  align = "center",
  fill = true,
  loading = false,
  disabled = false,
  onPress
}: {
  emoji: string;
  label: string;
  tone: CardHeaderTone;
  solid?: boolean;
  align?: "center" | "flex-start";
  fill?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const toneColor = cardHeaderToneIconColors[tone];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        { justifyContent: align, flex: fill ? 1 : 0 },
        solid ? { backgroundColor: toneColor, borderColor: toneColor } : cardHeaderToneStyles[tone],
        isDisabled && styles.actionButtonDisabled,
        pressed && !isDisabled && styles.actionButtonPressed
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={solid ? "#FFFFFF" : toneColor} />
      ) : (
        <Text style={styles.actionButtonEmoji}>{emoji}</Text>
      )}
      <Text style={[styles.actionButtonLabel, { color: solid ? "#FFFFFF" : colors.ink }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function FamilyScreen({
  onClose,
  onLeaveComplete,
  pinnedHeader = false
}: {
  onClose: () => void;
  onLeaveComplete?: (result: { needsFamilySetup: boolean }) => void;
  pinnedHeader?: boolean;
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
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const memberRowRefs = useRef<Record<string, View | null>>({});
  const scrollAssist = useScrollAssist();
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
  const [activeWidget, setActiveWidget] = useState<"invite" | "devices" | "people" | null>(null);
  const [activeAccountWidget, setActiveAccountWidget] = useState<"billing" | "leave" | null>(null);
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
  const activeDeviceCount = childDevices.filter((device) => !device.revokedAt).length;
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
  const heroStackMembers = members.slice(0, 4);
  const heroStackOverflow = members.length - heroStackMembers.length;

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
      setBillingMessage("This needs admin access. Ask a household admin to promote you from People.");
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
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

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
      {pinnedHeader ? null : (
        <ScreenHeader
          eyebrow="Household"
          title={safeText(familyName, "Your household")}
          subtitle={
            backendConnected
              ? `${currentAccessLabel} · ${adultMembers.length} adults · ${childProfiles.length} child profiles`
              : "Sign in to manage the household."
          }
          variant="admin"
          actionLabel="Close"
          onActionPress={onClose}
        />
      )}

      <View style={styles.heroWidgetGroup}>
      <Card>
        <View style={styles.householdHeroPanel}>
          <View style={styles.householdHero}>
            {heroStackMembers.length > 0 ? (
              <View style={styles.memberStackRow}>
                {heroStackMembers.map((member, index) => (
                  <View
                    key={member.id}
                    style={[styles.memberStackAvatar, index > 0 && styles.memberStackAvatarOverlap]}
                  >
                    <MemberAvatar member={member} size={40} />
                  </View>
                ))}
                {heroStackOverflow > 0 ? (
                  <View style={[styles.memberStackAvatar, styles.memberStackAvatarOverlap, styles.memberStackMore]}>
                    <Text style={styles.memberStackMoreText}>+{heroStackOverflow}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            <View style={styles.householdHeroCopy}>
              <View style={styles.summaryTop}>
                <Pill
                  label={currentAccessLabel}
                  tone={accessPillTone(
                    currentAccessLabel === "Owner" ? "owner" : currentAccessLabel === "Admin" ? "admin" : "member"
                  )}
                />
                <View style={styles.syncStatusRow}>
                  <View style={[styles.syncDot, backendConnected ? styles.syncDotOn : styles.syncDotOff]} />
                  <Text style={styles.syncStatusText}>{backendConnected ? "Connected" : "Local-only"}</Text>
                </View>
              </View>
              <Text style={styles.householdHeroMeta} numberOfLines={1}>
                {adultMembers.length} adult{adultMembers.length === 1 ? "" : "s"} · {childProfiles.length} child profile
                {childProfiles.length === 1 ? "" : "s"}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showHouseholdDetails ? "Close name editor" : "Edit household name"}
              hitSlop={8}
              onPress={() => setShowHouseholdDetails((value) => !value)}
              style={({ pressed }) => [styles.householdEditBadge, pressed && styles.householdEditBadgePressed]}
            >
              <Ionicons name={showHouseholdDetails ? "close" : "create"} size={15} color={colors.primary} />
            </Pressable>
          </View>
          {showHouseholdDetails ? (
            <View style={styles.householdEditRow}>
              <TextInput
                style={styles.householdEditInput}
                placeholder="Household name"
                placeholderTextColor={colors.muted}
                value={editedFamilyName}
                onChangeText={setEditedFamilyName}
                autoFocus
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save household name"
                accessibilityState={{ disabled: isSavingFamily || !backendConnected, busy: isSavingFamily }}
                disabled={isSavingFamily || !backendConnected}
                onPress={() => {
                  if (isSavingFamily || !backendConnected) return;
                  void handleSaveFamilyName();
                }}
                style={({ pressed }) => [
                  styles.householdEditSave,
                  (isSavingFamily || !backendConnected) && styles.householdEditSaveDisabled,
                  pressed && !(isSavingFamily || !backendConnected) && styles.householdEditSavePressed
                ]}
              >
                {isSavingFamily ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="checkmark" size={19} color="#FFFFFF" />
                )}
              </Pressable>
            </View>
          ) : null}
        </View>
      </Card>

      <Card>
        <CardHeader emoji="🛠️" tone="primary" title="Quick actions" />
        <View style={styles.widgetRow}>
          <WidgetTile
            emoji="🔑"
            tone="primary"
            label="Invite"
            meta={inviteCode ? "Adults only" : "Unavailable"}
            active={activeWidget === "invite"}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setActiveWidget((current) => (current === "invite" ? null : "invite"));
            }}
          />
          <WidgetTile
            emoji="📱"
            tone="mint"
            label="Child devices"
            meta={isLoadingDevices ? "Loading" : activeDeviceCount > 0 ? `${activeDeviceCount} active` : "Pair a device"}
            active={activeWidget === "devices"}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setActiveWidget((current) => (current === "devices" ? null : "devices"));
            }}
          />
          <WidgetTile
            emoji="🧑‍🤝‍🧑"
            tone="gold"
            label="People"
            meta={`${adultMembers.length + childProfiles.length} total`}
            active={activeWidget === "people"}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setActiveWidget((current) => (current === "people" ? null : "people"));
            }}
          />
        </View>
      </Card>

      {activeWidget === "invite" ? (
      <Card>
      <View style={styles.groupBlockFirst}>
        <CardHeader emoji="🔑" tone="primary" title="Adult invite" meta="Adults only" />
        <View style={styles.pairingCodeCard}>
          <Text style={styles.pairingCodeLabel}>Adult invite code</Text>
          <Text
            selectable
            style={styles.inviteCode}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
          >
            {inviteCode ?? "Unavailable"}
          </Text>
          <Text style={styles.pairingCodeHint}>Share this with adults joining the household.</Text>
        </View>
        <View style={styles.inviteActionRow}>
          <View style={styles.invitePrimaryAction}>
            <ActionButton
              emoji="📋"
              label="Copy code"
              tone="primary"
              solid
              disabled={!inviteCode}
              onPress={() => {
                void handleCopyInvite();
              }}
            />
          </View>
          {!showRegenerateConfirm ? (
            <ActionButton
              emoji="🔄"
              label="Regenerate"
              tone="gold"
              loading={isRegeneratingInvite}
              disabled={isRegeneratingInvite || !backendConnected}
              onPress={() => {
                if (isRegeneratingInvite || !backendConnected) return;
                if (!isFamilyAdmin) {
                  setInviteFeedback("This needs admin access. Ask a household admin to promote you from People.");
                  return;
                }
                setShowRegenerateConfirm(true);
              }}
            />
          ) : null}
        </View>
        {showRegenerateConfirm ? (
          <View style={styles.inlineConfirm}>
            <Text style={styles.warningText}>Replaces the current code immediately.</Text>
            <View style={styles.memberButtonRow}>
              <ActionButton
                emoji="🛡️"
                label="Keep current"
                tone="mint"
                onPress={() => setShowRegenerateConfirm(false)}
              />
              <ActionButton
                emoji="🔄"
                label="Regenerate"
                tone="coral"
                solid
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
      </Card>
      ) : null}

      {activeWidget === "devices" ? (
      <Card>
      <View style={styles.groupBlockFirst}>
        <CardHeader emoji="📱" tone="mint" title="Child device pairing" meta="KC- codes" />
        <Text style={styles.pairingStat}>
          {isLoadingDevices
            ? "Loading paired devices..."
            : `${childDevices.filter((device) => !device.revokedAt).length} active device${
                childDevices.filter((device) => !device.revokedAt).length === 1 ? "" : "s"
              }`}
        </Text>
        {pairingFeedback ? <Text style={styles.pairingFeedback}>{pairingFeedback}</Text> : null}
        {Object.keys(activePairingCodes).length > 0 ? (
          <View style={styles.deviceList}>
            {Object.entries(activePairingCodes).map(([memberId, entry]) => (
              <View key={memberId} style={[styles.pairingCodeCard, styles.pairingCodeCardInGroup]}>
                <Text style={styles.pairingCodeLabel}>Pairing code · {entry.memberName}</Text>
                <Text
                  selectable
                  style={styles.pairingCodeValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {entry.code}
                </Text>
                <Text style={styles.pairingCodeHint}>
                  {formatPairingExpiry(entry.expiresAt)} · Enter on Welcome → Set up child's device
                </Text>
                <ActionButton
                  emoji="📋"
                  label="Copy code"
                  tone="primary"
                  onPress={() => {
                    void handleCopyPairingCode(entry.code);
                  }}
                />
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.pairingStat}>No active codes yet — open a child's profile in People to generate one.</Text>
        )}
        {childDevices.length > 0 ? (
          <View style={styles.deviceList}>
            {[...childDevices]
              .sort((left, right) => Number(Boolean(left.revokedAt)) - Number(Boolean(right.revokedAt)))
              .map((device) => (
                <View key={device.id} style={styles.deviceRow}>
                  <View style={styles.deviceCopy}>
                    <Text style={styles.deviceName} numberOfLines={1}>
                      {device.memberName}
                    </Text>
                    <Text style={styles.deviceMeta} numberOfLines={1}>
                      {formatChildDeviceStatus(device)}
                    </Text>
                  </View>
                  {!device.revokedAt ? (
                    <ActionButton
                      emoji="🔌"
                      label="Revoke"
                      tone="coral"
                      fill={false}
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
      </Card>
      ) : null}

      {activeWidget === "people" ? (
      <Card>
      <View style={styles.groupBlockFirst}>
        <CardHeader
          emoji="🧑‍🤝‍🧑"
          tone="gold"
          title="People"
          meta={`${adultMembers.length + childProfiles.length}`}
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showAddChildForm ? "Hide add child form" : "Add child profile"}
              hitSlop={8}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setShowAddChildForm((value) => !value);
              }}
              style={styles.cardHeaderAction}
            >
              <Ionicons
                color={colors.primary}
                name={showAddChildForm ? "close" : "person-add"}
                size={16}
              />
            </Pressable>
          }
        />

        {showAddChildForm ? (
          <View style={styles.addChildPanel}>
            <View style={styles.compactFormRow}>
              <TextInput
                style={styles.householdEditInput}
                placeholder="Child's name"
                placeholderTextColor={colors.muted}
                value={childName}
                onChangeText={setChildName}
                autoFocus
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save child profile"
                accessibilityState={{ disabled: isAddingChild || !backendConnected, busy: isAddingChild }}
                disabled={isAddingChild || !backendConnected}
                onPress={() => {
                  if (isAddingChild || !backendConnected) return;
                  void handleAddChild();
                }}
                style={({ pressed }) => [
                  styles.householdEditSave,
                  (isAddingChild || !backendConnected) && styles.householdEditSaveDisabled,
                  pressed && !(isAddingChild || !backendConnected) && styles.householdEditSavePressed
                ]}
              >
                {isAddingChild ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="checkmark" size={19} color="#FFFFFF" />
                )}
              </Pressable>
            </View>
            <ActionFeedback
              message={childFormMessage ?? ""}
              tone={feedbackTone(childFormMessage ?? "")}
              visible={Boolean(childFormMessage)}
            />
          </View>
        ) : null}

        <Text style={styles.peopleGroupLabel}>Adults · {adultMembers.length}</Text>
        <View style={styles.memberList}>
          {adultMembers.map((member) => {
            const canPromote =
              isFamilyAdmin && member.role === "caregiver" && member.userId && !member.isVirtual;
            const isExpanded = expandedMemberId === member.id;

            return (
              <View
                key={member.id}
                style={styles.memberRow}
                ref={(node) => {
                  memberRowRefs.current[member.id] = node;
                }}
              >
                <Pressable
                  accessibilityRole={canPromote ? "button" : undefined}
                  accessibilityState={canPromote ? { expanded: isExpanded } : undefined}
                  accessibilityLabel={canPromote ? `${member.name}. ${isExpanded ? "Hide" : "Show"} actions` : member.name}
                  disabled={!canPromote}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    const willExpand = expandedMemberId !== member.id;
                    setExpandedMemberId((current) => (current === member.id ? null : member.id));
                    if (willExpand) {
                      setTimeout(() => scrollAssist.scrollIntoView(memberRowRefs.current[member.id]), 260);
                    }
                  }}
                  style={({ pressed }) => [styles.memberRowMain, pressed && canPromote && styles.memberRowMainPressed]}
                >
                  <Row>
                    <MemberAvatar member={member} size={40} />
                    <View style={styles.memberCopy}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <Text style={styles.memberMeta}>{getAdultMemberAccountLabel(member)}</Text>
                    </View>
                    <View style={styles.accessPillWrap}>
                      <Pill
                        label={getMemberAccessLabel(member, effectiveFamilyCreatedBy)}
                        tone={accessPillTone(getMemberAccessKind(member, effectiveFamilyCreatedBy))}
                      />
                    </View>
                    {canPromote ? (
                      <Ionicons
                        color={colors.tertiary}
                        name={isExpanded ? "chevron-up" : "chevron-forward"}
                        size={14}
                      />
                    ) : null}
                  </Row>
                </Pressable>
                {canPromote && isExpanded ? (
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
            );
          })}
        </View>

        <Text style={styles.peopleGroupLabel}>Children · {childProfiles.length}</Text>
        <View style={styles.memberList}>
          {childProfiles.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyTitle}>No child profiles yet.</Text>
            </View>
          ) : null}
          {childProfiles.map((member) => {
            const canManage = member.isVirtual;
            const isExpanded = expandedMemberId === member.id;

            return (
              <View
                key={member.id}
                style={styles.memberRow}
                ref={(node) => {
                  memberRowRefs.current[member.id] = node;
                }}
              >
                <Pressable
                  accessibilityRole={canManage ? "button" : undefined}
                  accessibilityState={canManage ? { expanded: isExpanded } : undefined}
                  accessibilityLabel={canManage ? `${member.name}. ${isExpanded ? "Hide" : "Show"} actions` : member.name}
                  disabled={!canManage}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    const willExpand = expandedMemberId !== member.id;
                    setExpandedMemberId((current) => (current === member.id ? null : member.id));
                    setPendingRemoveMemberId(null);
                    if (willExpand) {
                      setTimeout(() => scrollAssist.scrollIntoView(memberRowRefs.current[member.id]), 260);
                    }
                  }}
                  style={({ pressed }) => [styles.memberRowMain, pressed && canManage && styles.memberRowMainPressed]}
                >
                  <Row>
                    <MemberAvatar member={member} size={40} />
                    <View style={styles.memberCopy}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <Text style={styles.memberMeta}>{member.userId ? "Signed in" : "Profile only"}</Text>
                    </View>
                    <View style={styles.accessPillWrap}>
                      <Pill label="Child profile" tone="gold" />
                    </View>
                    {canManage ? (
                      <Ionicons
                        color={colors.tertiary}
                        name={isExpanded ? "chevron-up" : "chevron-forward"}
                        size={14}
                      />
                    ) : null}
                  </Row>
                </Pressable>
                {canManage && isExpanded ? (
                  <View style={styles.memberActions}>
                    {editingMemberId === member.id ? (
                      <>
                        <TextInput
                          style={styles.input}
                          placeholder="Child name"
                          placeholderTextColor={colors.muted}
                          value={editingMemberName}
                          onChangeText={setEditingMemberName}
                          autoFocus
                        />
                        <View style={styles.memberButtonRow}>
                          <ActionButton
                            emoji="✅"
                            label="Save child"
                            tone="mint"
                            solid
                            loading={isSavingFamily}
                            disabled={isSavingFamily || !backendConnected}
                            onPress={() => {
                              if (isSavingFamily || !backendConnected) return;
                              void handleSaveMember();
                            }}
                          />
                          <ActionButton
                            emoji="✖️"
                            label="Cancel"
                            tone="coral"
                            onPress={() => {
                              setEditingMemberId(null);
                              setEditingMemberName("");
                            }}
                          />
                        </View>
                      </>
                    ) : (
                      <>
                        <View style={styles.memberButtonRow}>
                          <ActionButton
                            emoji="✏️"
                            label="Rename"
                            tone="gold"
                            align="flex-start"
                            onPress={() => {
                              setEditingMemberId(member.id);
                              setEditingMemberName(member.name);
                            }}
                          />
                          <ActionButton
                            emoji="🗑️"
                            label="Remove"
                            tone="coral"
                            align="flex-start"
                            loading={isSavingFamily}
                            disabled={isSavingFamily || !backendConnected}
                            onPress={() => {
                              if (isSavingFamily || !backendConnected) return;
                              setPendingRemoveMemberId(member.id);
                            }}
                          />
                        </View>
                        <View style={styles.memberButtonRow}>
                          <View style={styles.memberPrimaryAction}>
                            <ActionButton
                              emoji="📱"
                              label={pairingMemberId === member.id ? "Generating..." : "Pair device"}
                              tone="primary"
                              solid
                              loading={pairingMemberId === member.id}
                              disabled={!backendConnected || pairingMemberId === member.id}
                              onPress={() => {
                                void handleGeneratePairingCode(member.id, member.name);
                              }}
                            />
                          </View>
                        </View>
                        {activePairingCodes[member.id] ? (
                          <View style={[styles.pairingCodeCard, styles.pairingCodeCardInGroup]}>
                            <Text style={styles.pairingCodeLabel}>Pairing code · {member.name}</Text>
                            <Text
                              selectable
                              style={styles.pairingCodeValue}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.7}
                            >
                              {activePairingCodes[member.id]?.code}
                            </Text>
                            <Text style={styles.pairingCodeHint}>
                              {formatPairingExpiry(activePairingCodes[member.id]?.expiresAt ?? "")} · Enter on
                              Welcome → Set up child's device
                            </Text>
                            <ActionButton
                              emoji="📋"
                              label="Copy code"
                              tone="primary"
                              onPress={() => {
                                const code = activePairingCodes[member.id]?.code;
                                if (code) {
                                  void handleCopyPairingCode(code);
                                }
                              }}
                            />
                          </View>
                        ) : null}
                      </>
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
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
      </Card>
      ) : null}

      <ActionFeedback
        message={formMessage ?? saveMessage ?? ""}
        tone={feedbackTone(formMessage ?? saveMessage ?? "")}
        visible={Boolean(formMessage ?? saveMessage)}
      />

      <Card>
        <CardHeader emoji="⚙️" tone="primary" title="Account" />
        <View style={styles.widgetRow}>
          <WidgetTile
            emoji="💳"
            tone="gold"
            label="Billing"
            meta="Preview"
            active={activeAccountWidget === "billing"}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setActiveAccountWidget((current) => (current === "billing" ? null : "billing"));
            }}
          />
          <WidgetTile
            emoji="🚪"
            tone="coral"
            label="Leave"
            meta={isSoleAdmin ? "Only admin" : "Household"}
            active={activeAccountWidget === "leave"}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setActiveAccountWidget((current) => (current === "leave" ? null : "leave"));
            }}
          />
        </View>
      </Card>

      {activeAccountWidget === "billing" ? (
      <Card>
      <View style={styles.groupBlockFirst}>
        <CardHeader icon="card" tone="gold" title="Plans and billing" meta="Preview" />
        <Text style={styles.helperText}>
          Plan: {subscriptionStatus?.subscriptionStatus ?? "free preview"} · No payment in this build
        </Text>
        <ActionFeedback
          message={subscriptionMessage ?? ""}
          tone="info"
          visible={Boolean(subscriptionMessage)}
        />
        <View style={styles.cardActions}>
          <ActionButton
            emoji="💳"
            label={showBillingPlans ? "Hide planned tiers" : "View planned tiers"}
            tone="gold"
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
      </View>
      </Card>
      ) : null}

      {activeAccountWidget === "leave" ? (
      <Card>
      <View style={styles.groupBlockFirst}>
        <CardHeader icon="exit" tone="coral" title="Leave household" />
        {isSoleAdmin ? (
          <Text style={styles.warningText}>
            Promote another adult to admin before leaving — you are the only admin.
          </Text>
        ) : null}
        {!showLeaveConfirm ? (
          <View style={styles.cardActions}>
            <ActionButton
              emoji="🚪"
              label="Leave household"
              tone="coral"
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
            <Text style={styles.warningText}>You can rejoin later with an adult invite code.</Text>
            <View style={styles.memberButtonRow}>
              <ActionButton
                emoji="🛡️"
                label="Keep me here"
                tone="mint"
                onPress={() => setShowLeaveConfirm(false)}
              />
              <ActionButton
                emoji="🚪"
                label="Confirm leave"
                tone="coral"
                solid
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
      </View>
      </Card>
      ) : null}
      </View>
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
  householdHeroPanel: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.xl,
    padding: spacing.md
  },
  householdHero: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  compactFormRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  householdEditRow: {
    alignItems: "center",
    borderTopColor: "rgba(139,107,74,0.16)",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md
  },
  householdEditInput: {
    backgroundColor: colors.surface,
    borderColor: "rgba(139,107,74,0.2)",
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: spacing.md
  },
  householdEditSave: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  householdEditSavePressed: {
    backgroundColor: colors.primaryPressed
  },
  householdEditSaveDisabled: {
    opacity: 0.6
  },
  memberStackRow: {
    flexDirection: "row"
  },
  memberStackAvatar: {
    borderRadius: radii.pill
  },
  memberStackAvatarOverlap: {
    marginLeft: -12
  },
  memberStackMore: {
    alignItems: "center",
    backgroundColor: colors.surfaceRaised,
    borderColor: "rgba(255,255,255,0.9)",
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  memberStackMoreText: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "800"
  },
  syncStatusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6
  },
  syncDot: {
    borderRadius: radii.pill,
    height: 8,
    width: 8
  },
  syncDotOn: {
    backgroundColor: colors.mint
  },
  syncDotOff: {
    backgroundColor: colors.tertiary
  },
  syncStatusText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  householdHeroMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600"
  },
  householdHeroCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0
  },
  householdEditBadge: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  householdEditBadgePressed: {
    backgroundColor: colors.line
  },
  heroWidgetGroup: {
    gap: spacing.sm
  },
  widgetRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  widgetTileIconBadge: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 36,
    justifyContent: "center",
    marginBottom: 2,
    width: 36
  },
  widgetTileIconBadgeIdle: {
    backgroundColor: colors.surface
  },
  widgetTileEmoji: {
    fontSize: 16,
    lineHeight: 19
  },
  widgetTile: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: radii.lg,
    borderWidth: 2,
    flex: 1,
    gap: 3,
    minHeight: 76,
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm
  },
  widgetTilePressed: {
    opacity: 0.85
  },
  widgetTileLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2
  },
  widgetTileLabelActive: {
    color: colors.primary
  },
  widgetTileMeta: {
    color: colors.tertiary,
    fontSize: 11,
    fontWeight: "600"
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
  cardHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  cardHeaderIcon: {
    alignItems: "center",
    borderRadius: radii.md,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  cardHeaderEmoji: {
    fontSize: 17,
    lineHeight: 20
  },
  cardHeaderTitle: {
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: "700"
  },
  cardHeaderMeta: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  previewBillingNote: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    marginTop: spacing.md
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
    paddingVertical: spacing.xs
  },
  memberRowMain: {
    borderRadius: radii.md,
    paddingVertical: spacing.xs
  },
  memberRowMainPressed: {
    backgroundColor: colors.canvas
  },
  peopleGroupLabel: {
    color: colors.tertiary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
    textTransform: "uppercase"
  },
  cardHeaderAction: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    height: 28,
    justifyContent: "center",
    marginLeft: spacing.xs,
    width: 28
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
  cardText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm
  },
  inviteCode: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 1.2,
    lineHeight: 30
  },
  inviteCodeHint: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    marginTop: spacing.xs
  },
  inviteActionRow: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  invitePrimaryAction: {
    flex: 1
  },
  inviteFeedback: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
    marginTop: spacing.sm
  },
  pairingStat: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600"
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
  pairingCodeCardInGroup: {
    marginTop: 0
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
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1
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
    gap: spacing.sm,
    marginTop: spacing.md
  },
  memberButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  memberPrimaryAction: {
    flex: 1,
    minWidth: 140
  },
  actionButton: {
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "transparent",
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: spacing.lg
  },
  actionButtonPressed: {
    opacity: 0.85
  },
  actionButtonDisabled: {
    opacity: 0.6
  },
  actionButtonEmoji: {
    fontSize: 16,
    lineHeight: 19
  },
  actionButtonLabel: {
    fontSize: 15,
    fontWeight: "700"
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

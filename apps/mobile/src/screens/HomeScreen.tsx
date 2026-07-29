import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";

import { MemberAvatar } from "../components/Primitives";
import { ScreenHeader } from "../components/ScreenHeader";
import { HOW_IT_WORKS_SLIDES } from "../constants/howItWorks";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { listChildDevices } from "../services/childDeviceApi";
import { useAuthStore } from "../store/useAuthStore";
import { useHomeThreadStore } from "../store/useHomeThreadStore";
import { ScreenDestination } from "../types";
import { compareEventsByStartAt, getEventUrgency } from "../utils/eventUrgency";
import { formatNotificationType } from "../utils/notificationLabels";
import { safeText } from "../utils/safeRender";

type HomeHighlight = {
  key: string;
  icon: string;
  label: string;
  value: string;
  tone: "primary" | "mint" | "gold" | "coral" | "neutral";
  tab?: ScreenDestination;
};

export function HomeScreen({
  goTo,
  onEnterKidsMode,
  onOpenFamilySettings,
  onOpenInsights,
  onOpenSettings,
  pinnedHeader = false,
  scrollY
}: {
  goTo: (destination: ScreenDestination) => void;
  onEnterKidsMode?: () => void;
  onOpenFamilySettings?: () => void;
  onOpenInsights?: () => void;
  onOpenSettings?: () => void;
  pinnedHeader?: boolean;
  scrollY?: Animated.Value;
}) {
  const displayName = useAuthStore((state) => state.displayName);
  const email = useAuthStore((state) => state.email);
  const avatarUrl = useAuthStore((state) => state.avatarUrl);
  const authMode = useAuthStore((state) => state.mode);
  const {
    familyName,
    familyId,
    members,
    events,
    meals,
    chores,
    notifications,
    markNotificationsRead,
    refreshFromBackend,
    syncSource,
    syncMessage,
    isHydrating
  } = useHomeThreadStore();
  const listItemsByListId = useHomeThreadStore((state) => state.listItemsByListId);

  const todayDateParts = useMemo(() => formatDateParts(new Date()), []);
  // Large-title avatar starts bigger at rest and shrinks to the pinned-bar avatar's
  // actual size (30px, vs. this avatar's 52px) as the title scrolls out of view.
  const largeAvatarScale = useMemo(
    () =>
      scrollY
        ? scrollY.interpolate({
            inputRange: [0, 40],
            outputRange: [1, 30 / 52],
            extrapolate: "clamp"
          })
        : 1,
    [scrollY]
  );
  const backendConnected = syncSource === "api";
  const isSignedIn = authMode === "supabase" || authMode === "dev_token";
  const openChores = useMemo(() => chores.filter((chore) => !chore.completed), [chores]);
  const openItems = useMemo(
    () => Object.values(listItemsByListId).flat().filter((item) => !item.checked),
    [listItemsByListId]
  );
  const unreadNotifications = useMemo(
    () => notifications.filter((item) => !item.readAt),
    [notifications]
  );
  const nextEvent = useMemo(
    () =>
      [...events]
        .sort(compareEventsByStartAt)
        .find((event) => getEventUrgency(event)?.label !== "Past") ?? null,
    [events]
  );
  const nextUrgency = nextEvent ? getEventUrgency(nextEvent) : null;
  const allDinners = useMemo(() => meals.filter((meal) => meal.mealType === "dinner"), [meals]);
  const todayDinner = useMemo(() => {
    const day = new Date().getDay();
    const normalized = day === 0 ? 6 : day - 1;
    return allDinners.find((meal) => meal.dayOfWeek === normalized) ?? null;
  }, [allDinners]);
  const kidMembers = useMemo(() => members.filter((member) => member.role === "kid"), [members]);
  const adultMembers = useMemo(() => members.filter((member) => member.role !== "kid"), [members]);
  const kidStarTotal = useMemo(
    () => kidMembers.reduce((sum, member) => sum + member.starBalance, 0),
    [kidMembers]
  );
  const kidsWithOpenChores = useMemo(
    () =>
      kidMembers
        .map((member) => ({
          member,
          openCount: openChores.filter((chore) => chore.assignedTo === member.id).length
        }))
        .filter((entry) => entry.openCount > 0),
    [kidMembers, openChores]
  );
  const recentNotifications = useMemo(() => notifications.slice(0, 3), [notifications]);
  const kidMemberIdsKey = useMemo(() => kidMembers.map((member) => member.id).sort().join(","), [kidMembers]);
  const [activeChildDeviceMemberIds, setActiveChildDeviceMemberIds] = useState<Set<string>>(() => new Set());
  const [childDeviceStatus, setChildDeviceStatus] = useState<"idle" | "loading" | "error">("idle");
  const profileLabel = useMemo(() => displayName?.trim() || email?.split("@")[0] || "there", [displayName, email]);
  const profileInitials = useMemo(
    () =>
      profileLabel
        .split(/\s+/u)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    [profileLabel]
  );
  const avatarSource = useMemo(
    () => (avatarUrl ? { uri: avatarUrl, cache: "reload" as const } : null),
    [avatarUrl]
  );
  const [avatarImageFailed, setAvatarImageFailed] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const guideScrollRef = useRef<ScrollView>(null);
  const { width: windowWidth } = useWindowDimensions();
  const guidePageWidth = Math.min(windowWidth - spacing.xl * 2, 360);

  useEffect(() => {
    setAvatarImageFailed(false);
  }, [avatarUrl]);

  useEffect(() => {
    let cancelled = false;

    if (!backendConnected || !familyId || kidMembers.length === 0) {
      setActiveChildDeviceMemberIds(new Set());
      setChildDeviceStatus("idle");
      return () => {
        cancelled = true;
      };
    }

    setChildDeviceStatus("loading");
    void listChildDevices(familyId).then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.data) {
        setActiveChildDeviceMemberIds(new Set());
        setChildDeviceStatus("error");
        return;
      }

      setActiveChildDeviceMemberIds(
        new Set(result.data.devices.filter((device) => !device.revokedAt).map((device) => device.memberId))
      );
      setChildDeviceStatus("idle");
    });

    return () => {
      cancelled = true;
    };
  }, [backendConnected, familyId, kidMembers.length, kidMemberIdsKey]);

  function openHowItWorks() {
    setGuideStep(0);
    setShowHowItWorks(true);
    requestAnimationFrame(() => {
      guideScrollRef.current?.scrollTo({ x: 0, animated: false });
    });
  }

  function closeHowItWorks() {
    setShowHowItWorks(false);
    setGuideStep(0);
  }

  function handleGuideScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / Math.max(guidePageWidth, 1));
    if (nextIndex !== guideStep && nextIndex >= 0 && nextIndex < HOW_IT_WORKS_SLIDES.length) {
      setGuideStep(nextIndex);
    }
  }
  const householdSummaryLabel = useMemo(() => {
    const adults = adultMembers.length;
    const kids = kidMembers.length;
    const householdName = safeText(familyName, "").trim();

    if (householdName) {
      const members =
        adults > 0 && kids > 0
          ? `${adults} adult${adults === 1 ? "" : "s"}, ${kids} kid${kids === 1 ? "" : "s"}`
          : adults > 0
            ? `${adults} adult${adults === 1 ? "" : "s"}`
            : kids > 0
              ? `${kids} kid${kids === 1 ? "" : "s"}`
              : null;
      return members ? `${householdName} · ${members}` : householdName;
    }

    if (adults > 0 && kids > 0) {
      return `${adults} adult${adults === 1 ? "" : "s"}, ${kids} kid${kids === 1 ? "" : "s"}`;
    }

    if (adults > 0) {
      return `${adults} adult${adults === 1 ? "" : "s"}`;
    }

    if (kids > 0) {
      return `${kids} kid${kids === 1 ? "" : "s"}`;
    }

    return "Your household";
  }, [adultMembers.length, familyName, kidMembers.length]);

  const attentionCount = useMemo(() => {
    let count = 0;
    if (openChores.length > 0) count += 1;
    if (unreadNotifications.length > 0) count += 1;
    if (openItems.length > 0) count += 1;
    if (kidsWithOpenChores.length > 0) count += 1;
    if (nextEvent && nextUrgency?.label !== "Past") count += 1;
    return count;
  }, [
    kidsWithOpenChores.length,
    nextEvent,
    nextUrgency?.label,
    openChores.length,
    openItems.length,
    unreadNotifications.length
  ]);

  const attentionHeadline = useMemo(() => {
    if (unreadNotifications.length > 0) {
      return `${unreadNotifications.length} unread update${unreadNotifications.length === 1 ? "" : "s"}`;
    }
    if (openChores.length > 0) {
      return `${openChores.length} open chore${openChores.length === 1 ? "" : "s"}`;
    }
    if (nextEvent) {
      return `Next up: ${nextEvent.title}`;
    }
    if (openItems.length > 0) {
      return `${openItems.length} item${openItems.length === 1 ? "" : "s"} to pick up`;
    }
    if (kidsWithOpenChores.length > 0) {
      return `${kidsWithOpenChores.length} kid${kidsWithOpenChores.length === 1 ? "" : "s"} to check in on`;
    }
    return "You're all caught up";
  }, [
    kidsWithOpenChores.length,
    nextEvent,
    openChores.length,
    openItems.length,
    unreadNotifications.length
  ]);

  const attentionDetail = useMemo(() => {
    if (unreadNotifications.length > 0) {
      return "Tap Updates below to see what's new.";
    }
    if (openChores.length > 0) {
      return "Tap Open chores below to knock it out.";
    }
    if (nextEvent) {
      return `${nextUrgency?.label ?? "Coming up"} at ${nextEvent.time}${nextEvent.location ? ` · ${nextEvent.location}` : ""}`;
    }
    if (openItems.length > 0) {
      return "Tap Shopping below to check off the list.";
    }
    if (kidsWithOpenChores.length > 0) {
      return "Tap a card below to check in on them.";
    }
    if (todayDinner) {
      return `Tonight: ${todayDinner.title}`;
    }
    return "Nothing urgent is waiting right now.";
  }, [
    kidsWithOpenChores.length,
    nextEvent,
    nextUrgency?.label,
    openChores.length,
    openItems.length,
    todayDinner,
    unreadNotifications.length
  ]);

  const showSyncNotice = !backendConnected || isHydrating;
  const unpairedKidMembers = useMemo(
    () => kidMembers.filter((member) => !activeChildDeviceMemberIds.has(member.id)),
    [activeChildDeviceMemberIds, kidMembers]
  );
  const pairedKidMembers = useMemo(
    () => kidMembers.filter((member) => activeChildDeviceMemberIds.has(member.id)),
    [activeChildDeviceMemberIds, kidMembers]
  );
  const familySetupItems = useMemo(() => {
    const items: Array<{
      key: string;
      icon: string;
      title: string;
      meta: string;
      action?: () => void;
      tone?: "primary" | "mint" | "sky";
    }> = [];

    if (!backendConnected || !isSignedIn) {
      items.push({
        key: "offline",
        icon: "👪",
        title: "Family setup",
        meta: "Sign in and sync to invite adults or pair child devices.",
        tone: "sky"
      });
      return items;
    }

    if (adultMembers.length <= 1) {
      items.push({
        key: "invite-adult",
        icon: "🤝",
        title: "Invite another adult",
        meta: "Share the adult invite code. They use their own account.",
        action: onOpenFamilySettings,
        tone: "primary"
      });
    }

    if (kidMembers.length === 0) {
      items.push({
        key: "add-child",
        icon: "🧒",
        title: "Add child profile",
        meta: "Create a kid profile before pairing a child phone.",
        action: onOpenFamilySettings,
        tone: "mint"
      });
    } else if (childDeviceStatus === "loading") {
      items.push({
        key: "checking-devices",
        icon: "📱",
        title: "Checking child devices",
        meta: "Making sure pairing status is up to date.",
        tone: "sky"
      });
    } else if (childDeviceStatus === "error") {
      items.push({
        key: "check-pairing",
        icon: "📱",
        title: "Confirm child pairing",
        meta: "Open Household to check which child devices are paired.",
        action: onOpenFamilySettings,
        tone: "sky"
      });
    } else if (unpairedKidMembers.length > 0) {
      const firstName = safeText(unpairedKidMembers[0]?.name, "A child");
      items.push({
        key: "pair-child",
        icon: "📱",
        title: "Pair child device",
        meta:
          unpairedKidMembers.length === 1
            ? `${firstName} needs a child pairing code.`
            : `${unpairedKidMembers.length} kids need child pairing codes.`,
        action: onOpenFamilySettings,
        tone: "primary"
      });
    } else if (pairedKidMembers.length > 0) {
      const firstName = safeText(pairedKidMembers[0]?.name, "Child");
      items.push({
        key: "paired",
        icon: "✅",
        title: "Child devices paired",
        meta:
          pairedKidMembers.length === 1
            ? `${firstName}'s device is paired.`
            : `${pairedKidMembers.length} child devices are paired.`,
        action: onOpenFamilySettings,
        tone: "mint"
      });
    }

    if (items.length === 0) {
      items.push({
        key: "complete",
        icon: "✅",
        title: "Family setup looks good",
        meta: "Adults and child setup are ready for daily planning.",
        action: onOpenFamilySettings,
        tone: "mint"
      });
    }

    return items.slice(0, 3);
  }, [
    adultMembers.length,
    backendConnected,
    childDeviceStatus,
    isSignedIn,
    kidMembers.length,
    onOpenFamilySettings,
    pairedKidMembers,
    unpairedKidMembers
  ]);

  const homeHighlights = useMemo<HomeHighlight[]>(() => {
    const entries: HomeHighlight[] = [];

    if (unreadNotifications.length > 0) {
      entries.push({
        key: "notifications",
        icon: "🔔",
        label: "Updates",
        value: `${unreadNotifications.length} unread`,
        tone: "primary",
        tab: "thread"
      });
    }

    if (openChores.length > 0) {
      entries.push({
        key: "chores",
        icon: "🧹",
        label: "Open chores",
        value: `${openChores.length} open`,
        tone: "gold",
        tab: "chores"
      });
    }

    if (openItems.length > 0) {
      entries.push({
        key: "shopping",
        icon: "🛒",
        label: "Shopping",
        value: `${openItems.length} to pick up`,
        tone: "mint",
        tab: "lists"
      });
    }

    if (nextEvent) {
      entries.push({
        key: "next-event",
        icon: "🗓️",
        label: "Next plan",
        value: `${nextEvent.title} at ${nextEvent.time}`,
        tone: nextUrgency?.tone ?? "primary",
        tab: "plan"
      });
    }

    if (todayDinner) {
      entries.push({
        key: "dinner",
        icon: "🍽️",
        label: "Tonight",
        value: todayDinner.title,
        tone: "coral",
        tab: "meals"
      });
    }

    return entries.slice(0, 4);
  }, [nextEvent, nextUrgency?.tone, openChores.length, todayDinner, openItems.length, unreadNotifications.length]);

  return (
    <View>
      {pinnedHeader ? (
        <View style={styles.largeTitleRow}>
          <Animated.View style={{ transform: [{ scale: largeAvatarScale }] }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open settings for ${profileLabel}`}
              disabled={!onOpenSettings}
              onPress={onOpenSettings}
              style={styles.largeTitleAvatar}
            >
              {avatarSource && !avatarImageFailed ? (
                <Image
                  accessibilityLabel={`${profileLabel} profile photo`}
                  onError={() => setAvatarImageFailed(true)}
                  source={avatarSource}
                  style={styles.largeTitleAvatarImage}
                />
              ) : (
                <Text style={styles.largeTitleAvatarText}>{profileInitials}</Text>
              )}
            </Pressable>
          </Animated.View>
          <Text style={styles.largeTitleText}>Hi, {profileLabel}</Text>
        </View>
      ) : (
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <ScreenHeader
              eyebrow="Home"
              title={`Hi, ${profileLabel}`}
              subtitle={todayDateParts.compact}
              density="compact"
            />
          </View>
          <View style={styles.headerRail}>
            {onOpenSettings ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open settings for ${profileLabel}`}
                onPress={onOpenSettings}
                style={styles.profileButton}
              >
                {avatarSource && !avatarImageFailed ? (
                  <Image
                    accessibilityLabel={`${profileLabel} profile photo`}
                    onError={() => setAvatarImageFailed(true)}
                    source={avatarSource}
                    style={styles.profileImage}
                  />
                ) : (
                  <Text style={styles.profileInitials}>{profileInitials}</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>
      )}

      <View style={styles.summaryCard}>
        <View style={styles.summaryHouseholdRow}>
          <View style={styles.summaryHouseholdIcon}>
            <Ionicons name="people" size={16} color={colors.primary} />
          </View>
          <Text style={styles.summaryHouseholdText} numberOfLines={1}>
            {householdSummaryLabel}
          </Text>
        </View>

        <View style={styles.summaryAttention}>
          <Text style={styles.summaryEyebrow}>
            {attentionCount > 0 ? "Needs attention today" : "Today"}
          </Text>
          <Text style={styles.summaryHeadline}>{attentionHeadline}</Text>
          <Text style={styles.summaryDetail}>{attentionDetail}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="How it works"
          onPress={openHowItWorks}
          style={({ pressed }) => [styles.summaryGuideRow, pressed && styles.summaryGuideRowPressed]}
        >
          <View style={styles.summaryGuideIcon}>
            <Ionicons name="book-outline" size={15} color={colors.primary} />
          </View>
          <Text style={styles.summaryGuideText}>How it works</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>
      </View>

      <View style={styles.heroShell}>
        <LinearGradient
          colors={[colors.surface, "#F4EEE6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroPanel}
        >
          <View style={styles.actionCluster}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add something quickly"
              onPress={() => goTo("add")}
              style={({ pressed }) => [styles.clusterPrimaryCta, pressed && styles.clusterPrimaryCtaPressed]}
            >
              <Ionicons name="add-circle-outline" size={17} color={colors.surface} />
              <Text style={styles.clusterPrimaryCtaText}>Add something quickly</Text>
            </Pressable>
          </View>

          {homeHighlights.length > 0 ? (
            <View style={styles.highlightGrid}>
              {homeHighlights.map((item) => {
                const content = (
                  <>
                    <View style={[styles.highlightIcon, highlightToneStyles[item.tone]]}>
                      <Text style={styles.highlightIconGlyph}>{item.icon}</Text>
                    </View>
                    <Text style={styles.highlightLabel}>{item.label}</Text>
                    <Text style={styles.highlightValue} numberOfLines={2}>
                      {item.value}
                    </Text>
                  </>
                );

                if (!item.tab) {
                  return (
                    <View key={item.key} style={styles.highlightCard}>
                      {content}
                    </View>
                  );
                }

                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${item.label}: ${item.value}`}
                    onPress={() => goTo(item.tab!)}
                    style={({ pressed }) => [styles.highlightCard, styles.highlightCardPressable, pressed && styles.highlightCardPressed]}
                  >
                    {content}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyPanelTitle}>A quiet day</Text>
              <Text style={styles.emptyPanelText}>
                Nothing urgent is waiting. Add a plan or chore when something comes up.
              </Text>
            </View>
          )}

          <View style={styles.secondaryActionPair}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open family board"
                onPress={() => goTo("thread")}
                style={({ pressed }) => [
                  styles.secondaryActionTile,
                  styles.secondaryActionTileBoard,
                  pressed && styles.secondaryActionTilePressed
                ]}
              >
                <View style={[styles.secondaryActionIcon, styles.secondaryActionIconBoard]}>
                  <Ionicons name="chatbubbles-outline" size={16} color={colors.primary} />
                </View>
                <View style={styles.secondaryActionCopy}>
                  <Text style={styles.secondaryActionTitle}>Family board</Text>
                  <Text style={styles.secondaryActionMeta} numberOfLines={1}>
                    Household updates
                  </Text>
                </View>
              </Pressable>

              {onEnterKidsMode && kidMembers.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Switch to Kid Mode"
                  onPress={onEnterKidsMode}
                  style={({ pressed }) => [
                    styles.secondaryActionTile,
                    styles.secondaryActionTileKids,
                    pressed && styles.secondaryActionTilePressed
                  ]}
                >
                  <View style={[styles.secondaryActionIcon, styles.secondaryActionIconKids]}>
                    <Ionicons name="happy-outline" size={16} color={colors.coral} />
                  </View>
                  <View style={styles.secondaryActionCopy}>
                    <Text style={styles.secondaryActionTitle}>Kid Mode</Text>
                    <Text style={styles.secondaryActionMeta} numberOfLines={1}>
                      Hand to a child
                    </Text>
                  </View>
                </Pressable>
              ) : onEnterKidsMode ? (
                <View
                  style={[
                    styles.secondaryActionTile,
                    styles.secondaryActionTileKids,
                    styles.secondaryActionTileMuted
                  ]}
                >
                  <View style={[styles.secondaryActionIcon, styles.secondaryActionIconKids]}>
                    <Ionicons name="happy-outline" size={16} color={colors.muted} />
                  </View>
                  <View style={styles.secondaryActionCopy}>
                    <Text style={styles.secondaryActionTitleMuted}>Kid Mode</Text>
                    <Text style={styles.secondaryActionMeta} numberOfLines={2}>
                      Add a child in Household
                    </Text>
                  </View>
                </View>
              ) : null}
          </View>

          {showSyncNotice ? (
            <View style={styles.syncRow}>
              <Text style={styles.syncText}>
                {isHydrating
                  ? "Refreshing household data..."
                  : isSignedIn && syncMessage?.trim()
                    ? syncMessage
                    : "Preview data on this device. Sign in to share with your household."}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Refresh household page"
                onPress={() => {
                  if (isHydrating) return;
                  void refreshFromBackend();
                }}
                style={({ pressed }) => [styles.refreshLink, pressed && styles.refreshLinkPressed]}
              >
                <Ionicons name="sync" size={14} color={colors.primary} />
                <Text style={styles.refreshLinkText}>{isHydrating ? "Refreshing" : "Retry"}</Text>
              </Pressable>
            </View>
          ) : null}
        </LinearGradient>
      </View>

      <View style={styles.familyDesk}>
        <View style={styles.familyDeskHeader}>
          <Text style={styles.familyDeskTitle}>Family desk</Text>
          <Text style={styles.familyDeskMeta}>
            {kidsWithOpenChores.length > 0
              ? `${kidStarTotal} stars earned`
              : unreadNotifications.length > 0
                ? `${unreadNotifications.length} unread`
                : "All caught up"}
          </Text>
        </View>

        {kidsWithOpenChores.length > 0 ? (
          <View style={styles.deskZone}>
            <Text style={styles.deskZoneLabel}>Check in</Text>
            <View style={styles.deskFeatureStack}>
              {kidsWithOpenChores.map(({ member, openCount }) => (
                <Pressable
                  key={member.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open chores for ${member.name}`}
                  onPress={() => goTo("chores")}
                  style={({ pressed }) => [styles.deskFeatureTile, pressed && styles.deskPressed]}
                >
                  <MemberAvatar member={member} size={34} />
                  <View style={styles.fill}>
                    <Text style={styles.deskItemTitle}>{member.name}</Text>
                    <Text style={styles.deskItemMeta}>
                      {openCount} open chore{openCount === 1 ? "" : "s"} · {member.starBalance} stars
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {onOpenFamilySettings || onOpenInsights ? (
          <View style={styles.deskZone}>
            <Text style={styles.deskZoneLabel}>Shortcuts</Text>
            <View style={styles.deskShortcutRow}>
              {onOpenFamilySettings ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open Household"
                  onPress={onOpenFamilySettings}
                  style={({ pressed }) => [styles.deskShortcutTile, pressed && styles.deskPressed]}
                >
                  <View style={styles.deskShortcutTop}>
                    <View style={[styles.deskIconTile, styles.deskIconPrimary]}>
                      <Text style={styles.deskIconGlyph}>🏠</Text>
                    </View>
                    <Ionicons color={colors.muted} name="arrow-forward" size={13} />
                  </View>
                  <Text style={styles.deskItemTitle}>Household</Text>
                  <Text style={styles.deskItemMeta} numberOfLines={1}>
                    Invite & pair
                  </Text>
                </Pressable>
              ) : null}
              {onOpenInsights ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open Insights"
                  onPress={onOpenInsights}
                  style={({ pressed }) => [styles.deskShortcutTile, pressed && styles.deskPressed]}
                >
                  <View style={styles.deskShortcutTop}>
                    <View style={[styles.deskIconTile, styles.deskIconSky]}>
                      <Text style={styles.deskIconGlyph}>📊</Text>
                    </View>
                    <Ionicons color={colors.muted} name="arrow-forward" size={13} />
                  </View>
                  <Text style={styles.deskItemTitle}>Insights</Text>
                  <Text style={styles.deskItemMeta} numberOfLines={1}>
                    Weekly summary
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {familySetupItems.length > 0 ? (
          <View style={styles.deskZone}>
            <Text style={styles.deskZoneLabel}>Set up</Text>
            <View style={styles.deskFeatureStack}>
              {familySetupItems.map((item) => {
                const iconStyle =
                  item.tone === "primary"
                    ? styles.deskIconPrimary
                    : item.tone === "mint"
                      ? styles.deskIconMint
                      : styles.deskIconSky;
                const content = (
                  <>
                    <View style={[styles.deskIconTile, iconStyle]}>
                      <Text style={styles.deskIconGlyph}>{item.icon}</Text>
                    </View>
                    <View style={styles.fill}>
                      <Text style={styles.deskItemTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.deskItemMeta} numberOfLines={2}>
                        {item.meta}
                      </Text>
                    </View>
                    {item.action ? <Ionicons name="chevron-forward" size={16} color={colors.muted} /> : null}
                  </>
                );

                if (!item.action) {
                  return (
                    <View key={item.key} style={styles.deskStatusStrip}>
                      {content}
                    </View>
                  );
                }

                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title}. ${item.meta}`}
                    onPress={item.action}
                    style={({ pressed }) => [styles.deskStatusStrip, pressed && styles.deskPressed]}
                  >
                    {content}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.deskZone}>
          <Text style={styles.deskZoneLabel}>Alerts</Text>
          {recentNotifications.length > 0 ? (
            <View style={styles.deskAlertStack}>
              {recentNotifications.map((notification) => (
                <View key={notification.id} style={styles.deskStatusStrip}>
                  <View style={styles.deskIconTile}>
                    <Ionicons
                      name={notification.readAt ? "notifications-outline" : "notifications"}
                      size={14}
                      color={notification.readAt ? colors.muted : colors.primary}
                    />
                  </View>
                  <View style={styles.fill}>
                    <Text style={styles.deskItemTitle} numberOfLines={1}>
                      {notification.title}
                    </Text>
                    <Text style={styles.deskItemMeta} numberOfLines={1}>
                      {notification.body}
                    </Text>
                  </View>
                  {!notification.readAt ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Mark notification read"
                      hitSlop={8}
                      onPress={() => {
                        void markNotificationsRead([notification.id]);
                      }}
                      style={styles.markReadButton}
                    >
                      <Text style={styles.markReadLabel}>Read</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.deskStatusStrip}>
              <View style={[styles.deskIconTile, styles.deskIconMint]}>
                <Ionicons name="checkmark-circle" size={14} color={colors.mint} />
              </View>
              <View style={styles.fill}>
                <Text style={styles.deskItemTitle}>All quiet</Text>
                <Text style={styles.deskItemMeta}>No household alerts right now.</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={showHowItWorks}
        onRequestClose={closeHowItWorks}
      >
        <View style={styles.guideOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss how it works"
            onPress={closeHowItWorks}
            style={styles.guideBackdrop}
          />
          <View style={[styles.guideSheet, { width: guidePageWidth + spacing.lg * 2 }]}>
            <View style={styles.guideHeader}>
              <View style={styles.guideHeaderCopy}>
                <Text style={styles.guideTitle}>How it works</Text>
                <Text style={styles.guideProgress}>
                  {guideStep + 1} of {HOW_IT_WORKS_SLIDES.length}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close how it works"
                hitSlop={8}
                onPress={closeHowItWorks}
                style={({ pressed }) => [styles.guideClose, pressed && styles.guideClosePressed]}
              >
                <Text style={styles.guideCloseText}>Close</Text>
              </Pressable>
            </View>

            <ScrollView
              ref={guideScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleGuideScroll}
              decelerationRate="fast"
              style={{ width: guidePageWidth }}
              contentContainerStyle={styles.guideScrollContent}
            >
              {HOW_IT_WORKS_SLIDES.map((step) => (
                <View key={step.title} style={[styles.guidePage, { width: guidePageWidth }]}>
                  <View style={[styles.guideSlideCard, { backgroundColor: step.accentSoft }]}>
                    <View style={[styles.guideIconWrap, { borderColor: step.accent }]}>
                      <Ionicons name={step.icon} size={24} color={step.accent} />
                    </View>
                    <View style={styles.guideSlideCopy}>
                      <Text style={styles.guideStepTitle} numberOfLines={1}>
                        {step.title}
                      </Text>
                      <Text style={styles.guideStepBody} numberOfLines={3}>
                        {step.body}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.guideFooter}>
              <View style={styles.guideSwipeLane}>
                <View style={styles.guideSwipeTrack}>
                  <View
                    style={[
                      styles.guideSwipeThumb,
                      {
                        width: `${100 / HOW_IT_WORKS_SLIDES.length}%`,
                        left: `${(guideStep / HOW_IT_WORKS_SLIDES.length) * 100}%`,
                        backgroundColor: HOW_IT_WORKS_SLIDES[guideStep]?.accent ?? colors.primary
                      }
                    ]}
                  />
                </View>
              </View>
              <View style={styles.guideFooterMeta}>
                <View style={styles.guideDots}>
                  {HOW_IT_WORKS_SLIDES.map((step, index) => (
                    <View
                      key={step.title}
                      style={[
                        styles.guideDot,
                        index === guideStep && [styles.guideDotActive, { backgroundColor: step.accent }]
                      ]}
                    />
                  ))}
                </View>
                <Text style={styles.guideHint}>Swipe</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function formatDateParts(date: Date) {
  return {
    weekday: date.toLocaleDateString(undefined, {
      weekday: "long"
    }),
    monthDay: date.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric"
    }),
    compact: date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric"
    })
  };
}

const highlightToneStyles = {
  primary: { backgroundColor: colors.primarySoft },
  mint: { backgroundColor: colors.mintSoft },
  gold: { backgroundColor: colors.goldSoft },
  coral: { backgroundColor: colors.coralSoft },
  neutral: { backgroundColor: "#F1ECE5" }
} as const;

const styles = StyleSheet.create({
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0
  },
  // Large title (collapses into the pinned bar on scroll)
  largeTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginBottom: spacing.md
  },
  largeTitleAvatar: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    height: 52,
    justifyContent: "center",
    overflow: "hidden",
    width: 52
  },
  largeTitleAvatarImage: {
    height: "100%",
    width: "100%"
  },
  largeTitleAvatarText: {
    color: colors.primary,
    fontSize: 19,
    fontWeight: "800"
  },
  largeTitleText: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.3
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 4,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  summaryHouseholdRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  summaryHouseholdIcon: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.sm,
    height: 24,
    justifyContent: "center",
    width: 24
  },
  summaryHouseholdText: {
    color: colors.muted,
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 16
  },
  summaryAttention: {
    gap: 0
  },
  summaryEyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  summaryHeadline: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 24,
    marginTop: 1
  },
  summaryDetail: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: 1
  },
  summaryGuideRow: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 34,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4
  },
  summaryGuideRowPressed: {
    opacity: 0.82
  },
  summaryGuideIcon: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.sm,
    height: 22,
    justifyContent: "center",
    width: 22
  },
  summaryGuideText: {
    color: colors.primary,
    flex: 1,
    fontSize: 13,
    fontWeight: "700"
  },
  householdMeta: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    marginTop: -spacing.xs
  },
  howItWorksEntry: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
    minHeight: 32,
    paddingVertical: spacing.xs
  },
  howItWorksEntryPressed: {
    opacity: 0.72
  },
  howItWorksEntryText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700"
  },
  guideOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(44,36,22,0.42)",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg
  },
  guideBackdrop: {
    ...StyleSheet.absoluteFill
  },
  guideSheet: {
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    maxWidth: 400,
    padding: spacing.lg
  },
  guideHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  guideHeaderCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
    paddingRight: spacing.sm
  },
  guideTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 28
  },
  guideProgress: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  guideClose: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.xs
  },
  guideClosePressed: {
    opacity: 0.72
  },
  guideCloseText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "800"
  },
  guidePage: {
    justifyContent: "flex-start"
  },
  guideScrollContent: {
    alignItems: "stretch"
  },
  guideSlideCard: {
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    height: 168,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  guideIconWrap: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1.5,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  guideSlideCopy: {
    flex: 1,
    gap: spacing.xs,
    justifyContent: "flex-start",
    minHeight: 90
  },
  guideStepTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 26,
    minHeight: 26
  },
  guideStepBody: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
    minHeight: 63
  },
  guideFooter: {
    gap: spacing.sm
  },
  guideSwipeLane: {
    paddingTop: 2
  },
  guideSwipeTrack: {
    backgroundColor: colors.line,
    borderRadius: radii.pill,
    height: 5,
    overflow: "hidden",
    position: "relative",
    width: "100%"
  },
  guideSwipeThumb: {
    borderRadius: radii.pill,
    height: 5,
    position: "absolute",
    top: 0
  },
  guideFooterMeta: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  guideDots: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs
  },
  guideDot: {
    backgroundColor: colors.lineStrong,
    borderRadius: radii.pill,
    height: 7,
    width: 7
  },
  guideDotActive: {
    width: 16
  },
  guideHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase"
  },
  headerRail: {
    alignItems: "flex-start",
    marginLeft: spacing.md,
    paddingTop: spacing.xs
  },
  memberStack: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingTop: spacing.xs
  },
  profileButton: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(139,107,74,0.16)",
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    overflow: "hidden",
    width: 44
  },
  profileImage: {
    height: 44,
    width: 44
  },
  profileInitials: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900"
  },
  heroShell: {
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
    overflow: "hidden"
  },
  heroPanel: {
    borderRadius: radii.md,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  heroAttention: {
    gap: spacing.xs
  },
  heroEyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  heroTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 30,
    fontWeight: "700",
    lineHeight: 36
  },
  heroText: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 23,
    marginTop: spacing.xs
  },
  highlightGrid: {
    columnGap: spacing.sm,
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: spacing.xs
  },
  highlightCard: {
    backgroundColor: "rgba(255,252,248,0.86)",
    borderColor: "rgba(215,205,188,0.7)",
    borderRadius: radii.md,
    borderWidth: 1,
    flexGrow: 1,
    gap: spacing.xs,
    minWidth: "46%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  highlightIcon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  highlightIconGlyph: {
    fontSize: 16,
    lineHeight: 20
  },
  highlightLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
    marginTop: 2,
    textTransform: "uppercase"
  },
  highlightValue: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22
  },
  emptyPanel: {
    backgroundColor: "rgba(255,252,248,0.82)",
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md
  },
  emptyPanelTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 24
  },
  emptyPanelText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21
  },
  actionCluster: {
    gap: spacing.sm
  },
  clusterPrimaryCta: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: colors.gold,
    borderColor: colors.gold,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  clusterPrimaryCtaPressed: {
    opacity: 0.85
  },
  clusterPrimaryCtaText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "800"
  },
  secondaryActionPair: {
    flexDirection: "row",
    gap: spacing.sm
  },
  secondaryActionTile: {
    alignItems: "flex-start",
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 64,
    minWidth: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  secondaryActionTileBoard: {
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(139,107,74,0.18)"
  },
  secondaryActionTileKids: {
    backgroundColor: colors.coralSoft,
    borderColor: "rgba(160,73,59,0.16)"
  },
  secondaryActionTileMuted: {
    opacity: 0.78
  },
  secondaryActionTilePressed: {
    opacity: 0.9
  },
  secondaryActionIcon: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.sm,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  secondaryActionIconBoard: {
    backgroundColor: colors.surface,
    borderColor: "rgba(139,107,74,0.18)"
  },
  secondaryActionIconKids: {
    backgroundColor: colors.surface,
    borderColor: "rgba(160,73,59,0.16)"
  },
  secondaryActionCopy: {
    flex: 1,
    gap: 2,
    justifyContent: "center",
    minWidth: 0
  },
  secondaryActionTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18
  },
  secondaryActionTitleMuted: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18
  },
  secondaryActionMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16
  },
  highlightCardPressable: {},
  highlightCardPressed: {
    opacity: 0.88
  },
  syncText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    flex: 1
  },
  syncRow: {
    alignItems: "center",
    backgroundColor: "rgba(255,252,248,0.72)",
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  refreshLink: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    paddingVertical: spacing.xs
  },
  refreshLinkPressed: {
    opacity: 0.76
  },
  refreshLinkText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700"
  },
  stack: {
    gap: spacing.md
  },
  familyDesk: {
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md
  },
  familyDeskHeader: {
    alignItems: "baseline",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  familyDeskTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 24
  },
  familyDeskMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  deskZone: {
    gap: spacing.xs
  },
  deskZoneLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  deskFeatureStack: {
    gap: spacing.xs
  },
  deskFeatureTile: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  deskShortcutRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  deskShortcutTile: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    minWidth: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  deskShortcutTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2
  },
  deskAlertStack: {
    gap: spacing.xs
  },
  deskStatusStrip: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  deskIconGlyph: {
    fontSize: 13,
    lineHeight: 16
  },
  deskIconTile: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.sm,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  deskIconPrimary: {
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(139,107,74,0.14)"
  },
  deskIconSky: {
    backgroundColor: colors.skySoft,
    borderColor: "rgba(107,127,173,0.18)"
  },
  deskIconMint: {
    backgroundColor: colors.mintSoft,
    borderColor: "rgba(92,122,90,0.16)"
  },
  deskItemTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18
  },
  deskItemMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
    marginTop: 1
  },
  deskPressed: {
    opacity: 0.92
  },
  snapshotRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  snapshotColumn: {
    flex: 1,
    gap: spacing.xs
  },
  snapshotLabel: {
    color: colors.tertiary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  snapshotValue: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 28
  },
  snapshotMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19
  },
  boardRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.sm
  },
  boardRowMain: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.md,
    minWidth: 0
  },
  boardRowPressed: {
    opacity: 0.84
  },
  boardMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: 2
  },
  boardTypeCue: {
    color: colors.tertiary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase"
  },
  boardUnreadCue: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2
  },
  boardUnreadCueText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  boardEmpty: {
    gap: spacing.xs,
    paddingVertical: spacing.sm
  },
  boardLink: {
    alignSelf: "flex-start",
    minHeight: 36,
    justifyContent: "center"
  },
  boardLinkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700"
  },
  markReadButton: {
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: spacing.xs
  },
  markReadLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800"
  },
  fill: {
    flex: 1
  },
  itemTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21
  },
  itemMeta: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    marginTop: 2
  },
  notificationIcon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  notificationIconUnread: {
    backgroundColor: colors.primarySoft
  },
  notificationIconMuted: {
    backgroundColor: "#F1ECE5"
  },
  notificationMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: spacing.sm
  },
  boardActionRow: {
    marginBottom: spacing.sm
  },
  notificationTapArea: {
    alignItems: "flex-start",
    flex: 1,
    flexDirection: "row",
    gap: spacing.md
  },

});

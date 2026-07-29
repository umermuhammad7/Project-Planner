import Ionicons from "@expo/vector-icons/Ionicons";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  findNodeHandle,
  useWindowDimensions,
  View
} from "react-native";

import { IconButton, Pill, PrimaryButton } from "./src/components/Primitives";
import { AppErrorBoundary } from "./src/components/AppErrorBoundary";
import { colors, fonts, radii, spacing } from "./src/constants/theme";
import { ScrollAssistContext } from "./src/context/ScrollAssistContext";
import { OfflineBanner } from "./src/components/OfflineBanner";
import { AssistantScreen } from "./src/screens/AssistantScreen";
import { CalendarSyncScreen } from "./src/screens/CalendarSyncScreen";
import { ChildDeviceSetupScreen } from "./src/screens/ChildDeviceSetupScreen";
import { ChildDeviceShellScreen } from "./src/screens/ChildDeviceShellScreen";
import { ChoresScreen } from "./src/screens/ChoresScreen";
import { FamilyScreen } from "./src/screens/FamilyScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { InsightsScreen } from "./src/screens/InsightsScreen";
import { KidsModePickerScreen } from "./src/screens/KidsModePickerScreen";
import { KidsModeScreen } from "./src/screens/KidsModeScreen";
import { ListsScreen } from "./src/screens/ListsScreen";
import { MealsScreen } from "./src/screens/MealsScreen";
import { MoreScreen } from "./src/screens/MoreScreen";
import { PlanScreen } from "./src/screens/PlanScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { ThreadScreen } from "./src/screens/ThreadScreen";
import { WelcomeScreen } from "./src/screens/WelcomeScreen";
import { getApiConfigurationStatus, isProductionApiMisconfigured } from "./src/services/api";
import { initMobileSentry } from "./src/services/sentry";
import { refreshPushTokenIfAvailable } from "./src/services/notifications";
import { useAuthStore } from "./src/store/useAuthStore";
import { useChildDeviceStore } from "./src/store/useChildDeviceStore";
import { useHomeThreadStore, resetHomeThreadStoreForSignedOut } from "./src/store/useHomeThreadStore";
import { startFamilyRealtimeSync, stopFamilyRealtimeSync } from "./src/services/familyRealtimeSync";
import { isSupabaseConfigured, supabaseClient } from "./src/services/supabase";
import { TabKey, MoreDestination, ScreenDestination } from "./src/types";
import { safeMemberInitials, safeText } from "./src/utils/safeRender";

const tabs: {
  key: TabKey;
  label: string;
  icon: string;
  tone: "primary" | "mint" | "coral" | "gold" | "sky";
}[] = [
  { key: "home", label: "Home", icon: "🏠", tone: "mint" },
  { key: "plan", label: "Plan", icon: "🗓️", tone: "coral" },
  { key: "chores", label: "Chores", icon: "🧹", tone: "gold" },
  { key: "lists", label: "Lists", icon: "🛍️", tone: "sky" },
  { key: "more", label: "More", icon: "🧭", tone: "primary" }
];

function resolveNavigation(destination: ScreenDestination): { tab: TabKey; more: MoreDestination } {
  if (destination === "meals") {
    return { tab: "more", more: "meals" };
  }

  if (destination === "thread") {
    return { tab: "more", more: "board" };
  }

  if (destination === "assistant" || destination === "add") {
    return { tab: "more", more: "assistant" };
  }

  return { tab: destination, more: "hub" };
}

function getWebPreviewMode() {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return null;
  }

  return new URLSearchParams(window.location.search).get("preview");
}

function isChildDevicePreviewHost() {
  return Platform.OS === "web" && typeof window !== "undefined" && window.location?.port === "8082" && getWebPreviewMode() !== "calendar";
}

function isCalendarPreviewHost() {
  return Platform.OS === "web" && typeof window !== "undefined" && window.location?.port === "8082" && getWebPreviewMode() === "calendar";
}

const childDevicePreviewSession = {
  familyName: "The Parker Home",
  memberId: "child-preview-member",
  memberName: "Jules",
  avatarUrl: null,
  starBalance: 18
};

const childDevicePreviewChores = [
  {
    id: "preview-chore-1",
    title: "Put backpack by the door",
    dueTime: "7:30 AM",
    stars: 2,
    completed: false
  },
  {
    id: "preview-chore-2",
    title: "Feed Luna",
    dueTime: "5:00 PM",
    stars: 3,
    completed: false
  },
  {
    id: "preview-chore-3",
    title: "Clear dinner plate",
    dueTime: null,
    stars: 1,
    completed: true
  }
];

function AppShell() {
  const [enteredApp, setEnteredApp] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [moreDestination, setMoreDestination] = useState<MoreDestination>("hub");
  const [planShowCalendarSync, setPlanShowCalendarSync] = useState(false);
  const [planFormOpen, setPlanFormOpen] = useState(false);
  const [kidsMode, setKidsMode] = useState(false);
  const [kidsModeMemberId, setKidsModeMemberId] = useState<string | null>(null);
  const [kidsSessionExitHintVisible, setKidsSessionExitHintVisible] = useState(false);
  const [showKidsModePicker, setShowKidsModePicker] = useState(false);
  const [familySettingsOpen, setFamilySettingsOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showChildDeviceSetup, setShowChildDeviceSetup] = useState(false);
  const { width: viewportWidth } = useWindowDimensions();
  const screenWidth = Math.max(288, Math.min(viewportWidth - spacing.lg * 2, 520));
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenTranslateY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const handleScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: false
      }),
    [scrollY]
  );
  const pinnedHeaderElevation = scrollY.interpolate({
    inputRange: [0, 28],
    outputRange: [0, 1],
    extrapolate: "clamp"
  });
  const titleOpacity = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [0, 1],
    extrapolate: "clamp"
  });
  const titleScale = scrollY.interpolate({
    inputRange: [0, 24, 40],
    outputRange: [0.8, 1.05, 1],
    extrapolate: "clamp"
  });
  const titleTranslateY = scrollY.interpolate({
    inputRange: [0, 24, 40],
    outputRange: [8, -1, 0],
    extrapolate: "clamp"
  });
  const chores = useHomeThreadStore((state) => state.chores);
  const completedChoreCount = useMemo(() => chores.filter((chore) => chore.completed).length, [chores]);
  const meals = useHomeThreadStore((state) => state.meals);
  const mealsCoveredDays = useMemo(() => new Set(meals.map((meal) => meal.dayOfWeek)).size, [meals]);
  const homeNotifications = useHomeThreadStore((state) => state.notifications);
  const homeUnreadCount = useMemo(
    () => homeNotifications.filter((item) => !item.readAt).length,
    [homeNotifications]
  );
  const homeTodayLabel = useMemo(
    () => new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
    []
  );
  const homeDisplayName = useAuthStore((state) => state.displayName);
  const homeEmail = useAuthStore((state) => state.email);
  const homeAvatarUrl = useAuthStore((state) => state.avatarUrl);
  const homeProfileLabel = useMemo(
    () => homeDisplayName?.trim() || homeEmail?.split("@")[0] || "there",
    [homeDisplayName, homeEmail]
  );
  const homeProfileInitials = useMemo(
    () =>
      homeProfileLabel
        .split(/\s+/u)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    [homeProfileLabel]
  );
  const homeAvatarSource = useMemo(
    () => (homeAvatarUrl ? { uri: homeAvatarUrl, cache: "reload" as const } : null),
    [homeAvatarUrl]
  );
  const [homeAvatarImageFailed, setHomeAvatarImageFailed] = useState(false);
  useEffect(() => {
    setHomeAvatarImageFailed(false);
  }, [homeAvatarUrl]);
  const entryHydrateSettled = useRef(false);
  const wasHydratingForEntry = useRef(false);
  const scrollAssist = useMemo(
    () => ({
      scrollToTop: () => scrollRef.current?.scrollTo({ y: 0, animated: true }),
      scrollToOffset: (offset: number) => scrollRef.current?.scrollTo({ y: offset, animated: true }),
      scrollToBottom: () => scrollRef.current?.scrollToEnd({ animated: true }),
      scrollIntoView: (node: unknown, extraOffset = 24) => {
        const scrollView = scrollRef.current;
        if (!scrollView || !node) return;
        const scrollHandle = findNodeHandle(scrollView);
        const targetHandle = findNodeHandle(node as never);
        if (!scrollHandle || !targetHandle) return;
        UIManager.measureLayout(
          targetHandle,
          scrollHandle,
          () => {},
          (_x: number, y: number) => {
            scrollView.scrollTo({ y: Math.max(0, y - extraOffset), animated: true });
          }
        );
      }
    }),
    []
  );
  const authMode = useAuthStore((state) => state.mode);
  const authFamilyId = useAuthStore((state) => state.familyId);
  const bootstrapAuth = useAuthStore((state) => state.bootstrap);
  const savePushToken = useAuthStore((state) => state.savePushToken);
  const childDeviceMode = useChildDeviceStore((state) => state.mode);
  const childDeviceBootstrapComplete = useChildDeviceStore((state) => state.bootstrapComplete);
  const isChildDeviceLoading = useChildDeviceStore((state) => state.isLoading);
  const childDeviceStatusMessage = useChildDeviceStore((state) => state.statusMessage);
  const clearChildDeviceStatusMessage = useChildDeviceStore((state) => state.clearStatusMessage);
  const bootstrapChildDevice = useChildDeviceStore((state) => state.bootstrap);
  const childDeviceSession = useChildDeviceStore((state) => state.session);
  const childDeviceUnpair = useChildDeviceStore((state) => state.unpair);
  const [childDeviceAvatarImageFailed, setChildDeviceAvatarImageFailed] = useState(false);
  const [childDeviceExitHintVisible, setChildDeviceExitHintVisible] = useState(false);
  useEffect(() => {
    setChildDeviceAvatarImageFailed(false);
  }, [childDeviceSession?.avatarUrl]);
  const hydrateFromBackend = useHomeThreadStore((state) => state.hydrateFromBackend);
  const isHydrating = useHomeThreadStore((state) => state.isHydrating);
  const syncMessage = useHomeThreadStore((state) => state.syncMessage);
  const syncSource = useHomeThreadStore((state) => state.syncSource);
  const familyId = useHomeThreadStore((state) => state.familyId);
  const familyName = useHomeThreadStore((state) => state.familyName);
  const lists = useHomeThreadStore((state) => state.lists);
  const listIdsKey = useMemo(
    () =>
      lists
        .map((list) => list.id)
        .slice()
        .sort()
        .join(","),
    [lists]
  );
  const pendingOfflineCount = useHomeThreadStore((state) =>
    state.offlineQueue.filter((item) => item.status === "pending").length
  );
  const failedOfflineCount = useHomeThreadStore((state) =>
    state.offlineQueue.filter((item) => item.status === "failed").length
  );
  const members = useHomeThreadStore((state) => state.members);
  const kidMembers = useMemo(() => members.filter((member) => member.role === "kid"), [members]);
  const offlineReplayMessage = useHomeThreadStore((state) => state.offlineReplayMessage);
  const isReplayingOffline = useHomeThreadStore((state) => state.isReplayingOffline);
  const replayPendingOfflineMutations = useHomeThreadStore((state) => state.replayPendingOfflineMutations);

  useEffect(() => {
    void bootstrapAuth();
    void bootstrapChildDevice();
  }, [bootstrapAuth, bootstrapChildDevice]);

  useEffect(() => {
    initMobileSentry();
  }, []);

  useEffect(() => {
    const apiConfig = getApiConfigurationStatus();
    if (apiConfig.message) {
      console.error(apiConfig.message);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabaseClient) {
      return;
    }

    const subscription = supabaseClient.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        void useAuthStore.getState().handleExternalSignedOut();
        return;
      }

      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        void useAuthStore.getState().bootstrap();
        return;
      }

      if (event === "TOKEN_REFRESHED") {
        void useAuthStore.getState().syncAccessTokenFromSession();
      }
    });

    return () => {
      subscription.data.subscription.unsubscribe();
    };
  }, []);

  const priorAuthMode = useRef(authMode);

  useEffect(() => {
    const previous = priorAuthMode.current;
    priorAuthMode.current = authMode;

    if (authMode === "signed_out") {
      setEnteredApp(false);
      setKidsMode(false);
      setKidsModeMemberId(null);
      setShowKidsModePicker(false);
      setFamilySettingsOpen(false);
      setInsightsOpen(false);
      setSettingsOpen(false);
      resetHomeThreadStoreForSignedOut();
      return;
    }

    // Session restore only: do not auto-enter when familyId is assigned mid-onboarding (create/join).
    if (previous === "loading" && authMode !== "loading" && authFamilyId) {
      setEnteredApp(true);
    }
  }, [authFamilyId, authMode]);

  useEffect(() => {
    if (enteredApp && authMode !== "loading" && authMode !== "signed_out") {
      void hydrateFromBackend();
    }
  }, [enteredApp, authMode, hydrateFromBackend]);

  useEffect(() => {
    if (!enteredApp) {
      entryHydrateSettled.current = false;
      wasHydratingForEntry.current = false;
      return;
    }

    if (wasHydratingForEntry.current && !isHydrating) {
      entryHydrateSettled.current = true;
    }

    if (isHydrating) {
      wasHydratingForEntry.current = true;
    }
  }, [enteredApp, isHydrating]);

  useEffect(() => {
    if (!enteredApp || authMode === "signed_out" || authMode === "loading") {
      return;
    }

    void (async () => {
      const refreshed = await refreshPushTokenIfAvailable();
      if (refreshed.ok && refreshed.pushToken) {
        await savePushToken(refreshed.pushToken);
      }
    })();
  }, [authMode, enteredApp, savePushToken]);

  useEffect(() => {
    if (!enteredApp || authMode === "loading" || authMode === "signed_out") {
      stopFamilyRealtimeSync();
      useHomeThreadStore.setState({
        realtimeStatus: "inactive",
        realtimeMessage: ""
      });
      return;
    }

    // Wait for first API hydrate before connecting; refresh cycles keep syncSource "api".
    if (isHydrating && syncSource !== "api") {
      stopFamilyRealtimeSync();
      useHomeThreadStore.setState({
        realtimeStatus: "inactive",
        realtimeMessage: ""
      });
      return;
    }

    const listIds = listIdsKey ? listIdsKey.split(",") : [];
    const enabled = authMode === "supabase" && syncSource === "api" && Boolean(familyId);

    startFamilyRealtimeSync({
      familyId: familyId ?? "",
      listIds,
      enabled,
      onStatus: (realtimeStatus, realtimeMessage) => {
        useHomeThreadStore.setState({ realtimeStatus, realtimeMessage });
      },
      onRefreshRequested: () => {
        void useHomeThreadStore.getState().refreshFromBackend({ skipOfflineReplay: true });
      }
    });
  }, [authMode, enteredApp, familyId, listIdsKey, syncSource]);

  useEffect(() => {
    return () => {
      stopFamilyRealtimeSync();
    };
  }, []);

  const navigateTo = useCallback((destination: ScreenDestination) => {
    const resolved = resolveNavigation(destination);
    setActiveTab(resolved.tab);
    setMoreDestination(resolved.more);
  }, []);

  const handleEnterKidsMode = useCallback(() => {
    if (kidMembers.length === 0) {
      return;
    }

    if (kidMembers.length === 1) {
      setKidsModeMemberId(kidMembers[0]!.id);
      setShowKidsModePicker(false);
      setKidsMode(true);
      return;
    }

    setShowKidsModePicker(true);
  }, [kidMembers]);

  const handleExitKidsMode = useCallback(() => {
    setKidsMode(false);
    setKidsModeMemberId(null);
    setShowKidsModePicker(false);
  }, []);

  // Mirrors the priority the render tree below checks each layer in, so a left-edge swipe
  // closes whatever's currently on top the same way its own visible Back/Close button would.
  const goBack = useCallback(() => {
    if (showKidsModePicker || (kidsMode && kidsModeMemberId)) {
      handleExitKidsMode();
      return;
    }

    if (insightsOpen) {
      setInsightsOpen(false);
      return;
    }

    if (settingsOpen) {
      setSettingsOpen(false);
      return;
    }

    if (familySettingsOpen) {
      setFamilySettingsOpen(false);
      return;
    }

    if (activeTab === "more" && moreDestination !== "hub") {
      setMoreDestination("hub");
    }
  }, [
    activeTab,
    familySettingsOpen,
    handleExitKidsMode,
    insightsOpen,
    kidsMode,
    kidsModeMemberId,
    moreDestination,
    settingsOpen,
    showKidsModePicker
  ]);

  const goBackRef = useRef(goBack);
  useEffect(() => {
    goBackRef.current = goBack;
  }, [goBack]);

  // Left-edge swipe-to-go-back: additive to the existing visible Back buttons, not a
  // replacement. Edge-only detection keeps it from hijacking horizontal scroll content
  // (chip rows, etc.) that starts away from the screen's left edge.
  const edgeSwipeBackResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event) => event.nativeEvent.pageX < 24,
        onMoveShouldSetPanResponder: (event, gesture) =>
          event.nativeEvent.pageX - gesture.dx < 24 &&
          gesture.dx > 10 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx > 60 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5) {
            goBackRef.current();
          }
        }
      }),
    []
  );

  const content = useMemo(() => {
    if (activeTab === "plan") {
      return (
        <PlanScreen
          pinnedHeader
          showCalendarSync={planShowCalendarSync}
          onOpenCalendarSync={() => setPlanShowCalendarSync(true)}
          onCloseCalendarSync={() => setPlanShowCalendarSync(false)}
          onFormVisibleChange={setPlanFormOpen}
        />
      );
    }
    if (activeTab === "chores") return <ChoresScreen pinnedHeader />;
    if (activeTab === "lists") return <ListsScreen pinnedHeader />;
    if (activeTab === "more") {
      if (moreDestination === "meals") {
        return <MealsScreen onBack={() => setMoreDestination("hub")} pinnedHeader />;
      }

      if (moreDestination === "board") {
        return <ThreadScreen onBack={() => setMoreDestination("hub")} pinnedHeader />;
      }

      if (moreDestination === "assistant") {
        return <AssistantScreen onBack={() => setMoreDestination("hub")} />;
      }

      return (
        <MoreScreen
          onOpen={setMoreDestination}
          onOpenFamilySettings={() => setFamilySettingsOpen(true)}
          onOpenInsights={() => setInsightsOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          pinnedHeader
        />
      );
    }

    return (
      <HomeScreen
        goTo={navigateTo}
        onEnterKidsMode={handleEnterKidsMode}
        onOpenFamilySettings={() => setFamilySettingsOpen(true)}
        onOpenInsights={() => setInsightsOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        pinnedHeader
        scrollY={scrollY}
      />
    );
  }, [activeTab, handleEnterKidsMode, moreDestination, navigateTo, planShowCalendarSync]);

  const showConnecting =
    enteredApp &&
    authMode !== "loading" &&
    authMode !== "signed_out" &&
    isHydrating &&
    !entryHydrateSettled.current;
  const showWelcome = authMode === "loading" || authMode === "signed_out" || !enteredApp;
  const screenKey = [
    activeTab,
    moreDestination,
    kidsMode ? "kids" : "adult",
    showKidsModePicker ? "kids-picker" : "kids-picker-closed",
    kidsModeMemberId ?? "no-kid",
    familySettingsOpen ? "family" : "family-closed",
    insightsOpen ? "insights" : "insights-closed",
    settingsOpen ? "settings" : "settings-closed",
    showWelcome ? "welcome" : "app",
    showConnecting ? "connecting" : "ready"
  ].join(":");

  useEffect(() => {
    scrollAssist.scrollToTop();
  }, [activeTab, familySettingsOpen, insightsOpen, moreDestination, settingsOpen, kidsMode, showKidsModePicker, scrollAssist]);

  useEffect(() => {
    screenOpacity.setValue(0.9);
    screenTranslateY.setValue(8);
    const canUseNativeDriver = Platform.OS !== "web";
    Animated.parallel([
      Animated.timing(screenOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: canUseNativeDriver
      }),
      Animated.spring(screenTranslateY, {
        toValue: 0,
        stiffness: 240,
        damping: 24,
        mass: 1,
        useNativeDriver: canUseNativeDriver
      })
    ]).start();
  }, [screenKey, screenOpacity, screenTranslateY]);

  function renderChildDevicePinnedBar(name: string, avatarUrl: string | null, onLongPressUnpair: () => void) {
    const avatarSource = avatarUrl ? { uri: avatarUrl, cache: "reload" as const } : null;
    return (
      <View style={styles.pinnedHeaderBar}>
        <View style={styles.pinnedHeaderRow}>
          <Animated.View
            style={{
              opacity: titleOpacity,
              transform: [{ scale: titleScale }, { translateY: titleTranslateY }]
            }}
          >
            <View style={styles.pinnedHeaderChildRow}>
              <View style={styles.pinnedHeaderAvatarSmall}>
                {avatarSource && !childDeviceAvatarImageFailed ? (
                  <Image
                    accessibilityLabel={`${name} profile photo`}
                    onError={() => setChildDeviceAvatarImageFailed(true)}
                    source={avatarSource}
                    style={styles.pinnedHeaderAvatarSmallImage}
                  />
                ) : (
                  <Text style={styles.pinnedHeaderAvatarSmallText}>{safeMemberInitials(name)}</Text>
                )}
              </View>
              <Text numberOfLines={1} style={styles.pinnedHeaderTitle}>
                {name}
              </Text>
            </View>
          </Animated.View>
          <View style={styles.pinnedHeaderSpacer} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hold to unpair this device"
            delayLongPress={900}
            onLongPress={onLongPressUnpair}
            onPress={() => setChildDeviceExitHintVisible(true)}
            style={({ pressed }) => [styles.kidsSessionExitChip, pressed && styles.kidsSessionExitChipPressed]}
          >
            <Ionicons name="lock-closed" size={14} color={colors.ink} />
            <Text style={styles.kidsSessionExitChipText}>Hold to unpair</Text>
          </Pressable>
        </View>
        <Animated.View
          pointerEvents="none"
          style={[styles.pinnedHeaderElevation, { opacity: pinnedHeaderElevation }]}
        />
      </View>
    );
  }

  if (isChildDevicePreviewHost()) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        {renderChildDevicePinnedBar(childDevicePreviewSession.memberName, childDevicePreviewSession.avatarUrl, () => {})}
        <ScrollView
          contentContainerStyle={styles.content}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.screenContainer, { width: screenWidth, alignSelf: "center" }]}>
            <ChildDeviceShellScreen
              previewMode
              previewSession={childDevicePreviewSession}
              previewChores={childDevicePreviewChores}
              exitHintVisible={childDeviceExitHintVisible}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isCalendarPreviewHost()) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <ScrollView
          contentContainerStyle={styles.content}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.screenContainer, { width: screenWidth, alignSelf: "center" }]}>
            <CalendarSyncScreen pinnedHeader onBack={() => {}} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isProductionApiMisconfigured()) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.configBlockWrap}>
          <View style={styles.connectingWrap}>
            <View style={styles.connecting}>
              <Text style={styles.connectingEyebrow}>Build configuration</Text>
              <Text style={styles.connectingTitle}>Household server not configured</Text>
              <Text style={styles.connectingSubtitle}>
                This production build is missing a reachable EXPO_PUBLIC_API_URL. Configure the Railway API host in
                EAS secrets before installing on a phone.
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!childDeviceBootstrapComplete || childDeviceMode === "unknown" || isChildDeviceLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.configBlockWrap}>
          <View style={styles.connectingWrap}>
            <View style={styles.connectingMarkWrap}>
              <Image source={require("./assets/icon.png")} style={styles.connectingMark} />
            </View>
            <View style={styles.connecting}>
              <Text style={styles.connectingEyebrow}>HomeThread</Text>
              <Text style={styles.connectingTitle}>Checking this device</Text>
              <Text style={styles.connectingSubtitle}>
                Making sure we open the right child or adult experience before showing anything else.
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (childDeviceMode === "paired") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        {childDeviceSession
          ? renderChildDevicePinnedBar(childDeviceSession.memberName, childDeviceSession.avatarUrl, () => {
              void childDeviceUnpair();
            })
          : null}
        <ScrollView
          contentContainerStyle={styles.content}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.screenContainer, { width: screenWidth, alignSelf: "center" }]}>
            <ChildDeviceShellScreen exitHintVisible={childDeviceExitHintVisible} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (childDeviceMode === "unpaired" && childDeviceStatusMessage) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.configBlockWrap}>
          <View style={styles.connectingWrap}>
            <View style={styles.connectingMarkWrap}>
              <Image source={require("./assets/icon.png")} style={styles.connectingMark} />
            </View>
            <View style={styles.connecting}>
              <Text style={styles.connectingEyebrow}>Child device</Text>
              <Text style={styles.connectingTitle}>This device was disconnected</Text>
              <Text style={styles.connectingSubtitle}>{childDeviceStatusMessage}</Text>
            </View>
            <View style={styles.childDeviceActionWrap}>
              <PrimaryButton
                label="Pair this device again"
                icon="link"
                onPress={() => {
                  clearChildDeviceStatusMessage();
                  setShowChildDeviceSetup(true);
                }}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue without pairing"
              onPress={clearChildDeviceStatusMessage}
              style={styles.childDeviceDismiss}
            >
              <Text style={styles.childDeviceDismissLabel}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (showChildDeviceSetup) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.screenContainer, { width: screenWidth, alignSelf: "center" }]}>
            <ChildDeviceSetupScreen
              onBack={() => setShowChildDeviceSetup(false)}
              onPaired={() => setShowChildDeviceSetup(false)}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const canShowPinnedBar =
    enteredApp &&
    authMode !== "signed_out" &&
    !kidsMode &&
    !showKidsModePicker &&
    !familySettingsOpen &&
    !insightsOpen &&
    !settingsOpen;
  const showPlanPinnedBar = canShowPinnedBar && activeTab === "plan" && !planShowCalendarSync;
  const showCalendarSyncPinnedBar =
    enteredApp && authMode !== "signed_out" && activeTab === "plan" && planShowCalendarSync;
  const showChoresPinnedBar = canShowPinnedBar && activeTab === "chores";
  const showListsPinnedBar = canShowPinnedBar && activeTab === "lists";
  const showHomePinnedBar = canShowPinnedBar && activeTab === "home";
  const showMealsPinnedBar = canShowPinnedBar && activeTab === "more" && moreDestination === "meals";
  const showBoardPinnedBar = canShowPinnedBar && activeTab === "more" && moreDestination === "board";
  const showMoreHubPinnedBar = canShowPinnedBar && activeTab === "more" && moreDestination === "hub";
  const showFamilyPinnedBar = enteredApp && authMode !== "signed_out" && familySettingsOpen;
  const showInsightsPinnedBar = enteredApp && authMode !== "signed_out" && insightsOpen;
  const showSettingsPinnedBar = enteredApp && authMode !== "signed_out" && settingsOpen;
  const showKidsPickerPinnedBar = enteredApp && authMode !== "signed_out" && showKidsModePicker;
  const showKidsSessionPinnedBar =
    enteredApp && authMode !== "signed_out" && kidsMode && Boolean(kidsModeMemberId);
  // Meals/Board/Assistant are nested "more" destinations, not primary browsing screens —
  // the bottom bar should hide there the same way it already hides for Settings/Insights/Household.
  const showTabBar =
    canShowPinnedBar &&
    !(activeTab === "more" && moreDestination !== "hub") &&
    !(activeTab === "plan" && (planShowCalendarSync || planFormOpen));

  return (
    <SafeAreaView style={styles.safeArea} {...edgeSwipeBackResponder.panHandlers}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        {showPlanPinnedBar ? (
          <View style={styles.pinnedHeaderBar}>
            <View style={styles.pinnedHeaderRow}>
              <Animated.View
                style={[
                  styles.pinnedHeaderRow,
                  {
                    opacity: titleOpacity,
                    transform: [{ scale: titleScale }, { translateY: titleTranslateY }]
                  }
                ]}
              >
                <View style={styles.pinnedHeaderIcon}>
                  <Text style={styles.pinnedHeaderGlyph}>🗓️</Text>
                </View>
                <Text numberOfLines={1} style={styles.pinnedHeaderTitle}>
                  This week
                </Text>
              </Animated.View>
              <View style={styles.pinnedHeaderSpacer} />
            </View>
            <Animated.View
              pointerEvents="none"
              style={[styles.pinnedHeaderElevation, { opacity: pinnedHeaderElevation }]}
            />
          </View>
        ) : null}
        {showCalendarSyncPinnedBar ? (
          <View style={styles.pinnedHeaderBar}>
            <View style={styles.pinnedHeaderRow}>
              <Animated.View
                style={[
                  styles.pinnedHeaderRow,
                  {
                    opacity: titleOpacity,
                    transform: [{ scale: titleScale }, { translateY: titleTranslateY }]
                  }
                ]}
              >
                <View style={styles.pinnedHeaderIcon}>
                  <Text style={styles.pinnedHeaderGlyph}>📅</Text>
                </View>
                <Text numberOfLines={1} style={styles.pinnedHeaderTitle}>
                  Google Calendar
                </Text>
              </Animated.View>
              <View style={styles.pinnedHeaderSpacer} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={8}
                onPress={() => setPlanShowCalendarSync(false)}
                style={styles.pinnedHeaderClose}
              >
                <Ionicons color={colors.primary} name="chevron-back" size={18} />
                <Text style={styles.pinnedHeaderCloseLabel}>Back</Text>
              </Pressable>
            </View>
            <Animated.View
              pointerEvents="none"
              style={[styles.pinnedHeaderElevation, { opacity: pinnedHeaderElevation }]}
            />
          </View>
        ) : null}
        {showChoresPinnedBar ? (
          <View style={styles.pinnedHeaderBar}>
            <View style={styles.pinnedHeaderRow}>
              <Animated.View
                style={[
                  styles.pinnedHeaderRow,
                  {
                    opacity: titleOpacity,
                    transform: [{ scale: titleScale }, { translateY: titleTranslateY }]
                  }
                ]}
              >
                <View style={styles.pinnedHeaderIcon}>
                  <Text style={styles.pinnedHeaderGlyph}>🧹</Text>
                </View>
                <Text numberOfLines={1} style={styles.pinnedHeaderTitle}>
                  Chores
                </Text>
              </Animated.View>
              <View style={styles.pinnedHeaderSpacer} />
              <Pill label={`${completedChoreCount}/${chores.length}`} tone="primary" />
            </View>
            <Animated.View
              pointerEvents="none"
              style={[styles.pinnedHeaderElevation, { opacity: pinnedHeaderElevation }]}
            />
          </View>
        ) : null}
        {showListsPinnedBar ? (
          <View style={styles.pinnedHeaderBar}>
            <View style={styles.pinnedHeaderRow}>
              <Animated.View
                style={[
                  styles.pinnedHeaderRow,
                  {
                    opacity: titleOpacity,
                    transform: [{ scale: titleScale }, { translateY: titleTranslateY }]
                  }
                ]}
              >
                <View style={styles.pinnedHeaderIcon}>
                  <Text style={styles.pinnedHeaderGlyph}>🛍️</Text>
                </View>
                <Text numberOfLines={1} style={styles.pinnedHeaderTitle}>
                  Lists
                </Text>
              </Animated.View>
              <View style={styles.pinnedHeaderSpacer} />
            </View>
            <Animated.View
              pointerEvents="none"
              style={[styles.pinnedHeaderElevation, { opacity: pinnedHeaderElevation }]}
            />
          </View>
        ) : null}
        {showHomePinnedBar ? (
          <View style={styles.pinnedHeaderBar}>
            <View style={styles.pinnedHeaderRow}>
              <Animated.View
                style={[
                  styles.pinnedHeaderRow,
                  {
                    opacity: titleOpacity,
                    transform: [{ scale: titleScale }, { translateY: titleTranslateY }]
                  }
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open settings for ${homeProfileLabel}`}
                  hitSlop={6}
                  onPress={() => setSettingsOpen(true)}
                  style={styles.pinnedHeaderAvatar}
                >
                  {homeAvatarSource && !homeAvatarImageFailed ? (
                    <Image
                      accessibilityLabel={`${homeProfileLabel} profile photo`}
                      onError={() => setHomeAvatarImageFailed(true)}
                      source={homeAvatarSource}
                      style={styles.pinnedHeaderAvatarImage}
                    />
                  ) : (
                    <Text style={styles.pinnedHeaderAvatarText}>{homeProfileInitials}</Text>
                  )}
                </Pressable>
                <Text numberOfLines={1} style={styles.pinnedHeaderTitle}>
                  Hi, {homeProfileLabel}
                </Text>
              </Animated.View>
              <View style={styles.pinnedHeaderSpacer} />
              <View style={styles.pinnedHeaderDateChip}>
                <Ionicons name="calendar-outline" size={12} color={colors.gold} />
                <Text style={styles.pinnedHeaderDateChipText}>{homeTodayLabel}</Text>
              </View>
              {homeUnreadCount > 0 ? (
                <Pill label={`${homeUnreadCount} new`} tone="coral" icon="notifications" />
              ) : null}
            </View>
            <Animated.View
              pointerEvents="none"
              style={[styles.pinnedHeaderElevation, { opacity: pinnedHeaderElevation }]}
            />
          </View>
        ) : null}
        {showFamilyPinnedBar ? (
          <View style={styles.pinnedHeaderBar}>
            <View style={styles.pinnedHeaderRow}>
              <View style={styles.pinnedHeaderIcon}>
                <Text style={styles.pinnedHeaderGlyph}>🏠</Text>
              </View>
              <Text numberOfLines={1} style={styles.pinnedHeaderTitle}>
                {safeText(familyName, "Household")}
              </Text>
              <View style={styles.pinnedHeaderSpacer} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close household settings"
                hitSlop={8}
                onPress={() => setFamilySettingsOpen(false)}
                style={styles.pinnedHeaderClose}
              >
                <Ionicons color={colors.primary} name="close" size={18} />
                <Text style={styles.pinnedHeaderCloseLabel}>Close</Text>
              </Pressable>
            </View>
            <Animated.View
              pointerEvents="none"
              style={[styles.pinnedHeaderElevation, { opacity: pinnedHeaderElevation }]}
            />
          </View>
        ) : null}
        {showInsightsPinnedBar ? (
          <View style={styles.pinnedHeaderBar}>
            <View style={styles.pinnedHeaderRow}>
              <Animated.View
                style={[
                  styles.pinnedHeaderRow,
                  {
                    opacity: titleOpacity,
                    transform: [{ scale: titleScale }, { translateY: titleTranslateY }]
                  }
                ]}
              >
                <View style={styles.pinnedHeaderIcon}>
                  <Text style={styles.pinnedHeaderGlyph}>📊</Text>
                </View>
                <Text numberOfLines={1} style={styles.pinnedHeaderTitle}>
                  Insights
                </Text>
              </Animated.View>
              <View style={styles.pinnedHeaderSpacer} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={8}
                onPress={() => setInsightsOpen(false)}
                style={styles.pinnedHeaderClose}
              >
                <Ionicons color={colors.primary} name="chevron-back" size={18} />
                <Text style={styles.pinnedHeaderCloseLabel}>Back</Text>
              </Pressable>
            </View>
            <Animated.View
              pointerEvents="none"
              style={[styles.pinnedHeaderElevation, { opacity: pinnedHeaderElevation }]}
            />
          </View>
        ) : null}
        {showSettingsPinnedBar ? (
          <View style={styles.pinnedHeaderBar}>
            <View style={styles.pinnedHeaderRow}>
              <Animated.View
                style={[
                  styles.pinnedHeaderRow,
                  {
                    opacity: titleOpacity,
                    transform: [{ scale: titleScale }, { translateY: titleTranslateY }]
                  }
                ]}
              >
                <View style={styles.pinnedHeaderIcon}>
                  <Text style={styles.pinnedHeaderGlyph}>⚙️</Text>
                </View>
                <Text numberOfLines={1} style={styles.pinnedHeaderTitle}>
                  Settings
                </Text>
              </Animated.View>
              <View style={styles.pinnedHeaderSpacer} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={8}
                onPress={() => setSettingsOpen(false)}
                style={styles.pinnedHeaderClose}
              >
                <Ionicons color={colors.primary} name="chevron-back" size={18} />
                <Text style={styles.pinnedHeaderCloseLabel}>Back</Text>
              </Pressable>
            </View>
            <Animated.View
              pointerEvents="none"
              style={[styles.pinnedHeaderElevation, { opacity: pinnedHeaderElevation }]}
            />
          </View>
        ) : null}
        {showKidsPickerPinnedBar ? (
          <View style={styles.pinnedHeaderBar}>
            <View style={styles.pinnedHeaderRow}>
              <Animated.View
                style={[
                  styles.pinnedHeaderRow,
                  {
                    opacity: titleOpacity,
                    transform: [{ scale: titleScale }, { translateY: titleTranslateY }]
                  }
                ]}
              >
                <View style={styles.pinnedHeaderIcon}>
                  <Text style={styles.pinnedHeaderGlyph}>🧒</Text>
                </View>
                <Text numberOfLines={1} style={styles.pinnedHeaderTitle}>
                  Kids mode
                </Text>
              </Animated.View>
              <View style={styles.pinnedHeaderSpacer} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel kids mode setup"
                hitSlop={8}
                onPress={handleExitKidsMode}
                style={styles.pinnedHeaderClose}
              >
                <Ionicons color={colors.primary} name="close" size={18} />
                <Text style={styles.pinnedHeaderCloseLabel}>Cancel</Text>
              </Pressable>
            </View>
            <Animated.View
              pointerEvents="none"
              style={[styles.pinnedHeaderElevation, { opacity: pinnedHeaderElevation }]}
            />
          </View>
        ) : null}
        {showMealsPinnedBar ? (
          <View style={styles.pinnedHeaderBar}>
            <View style={styles.pinnedHeaderRow}>
              <Animated.View
                style={[
                  styles.pinnedHeaderRow,
                  {
                    opacity: titleOpacity,
                    transform: [{ scale: titleScale }, { translateY: titleTranslateY }]
                  }
                ]}
              >
                <View style={styles.pinnedHeaderIcon}>
                  <Text style={styles.pinnedHeaderGlyph}>🍽️</Text>
                </View>
                <Text numberOfLines={1} style={styles.pinnedHeaderTitle}>
                  Meals
                </Text>
              </Animated.View>
              <View style={styles.pinnedHeaderSpacer} />
              <Pill label={`${mealsCoveredDays}/7`} tone="primary" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={8}
                onPress={() => setMoreDestination("hub")}
                style={styles.pinnedHeaderClose}
              >
                <Ionicons color={colors.primary} name="chevron-back" size={18} />
                <Text style={styles.pinnedHeaderCloseLabel}>Back</Text>
              </Pressable>
            </View>
            <Animated.View
              pointerEvents="none"
              style={[styles.pinnedHeaderElevation, { opacity: pinnedHeaderElevation }]}
            />
          </View>
        ) : null}
        {showBoardPinnedBar ? (
          <View style={styles.pinnedHeaderBar}>
            <View style={styles.pinnedHeaderRow}>
              <Animated.View
                style={[
                  styles.pinnedHeaderRow,
                  {
                    opacity: titleOpacity,
                    transform: [{ scale: titleScale }, { translateY: titleTranslateY }]
                  }
                ]}
              >
                <View style={styles.pinnedHeaderIcon}>
                  <Text style={styles.pinnedHeaderGlyph}>📋</Text>
                </View>
                <Text numberOfLines={1} style={styles.pinnedHeaderTitle}>
                  Family board
                </Text>
              </Animated.View>
              <View style={styles.pinnedHeaderSpacer} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={8}
                onPress={() => setMoreDestination("hub")}
                style={styles.pinnedHeaderClose}
              >
                <Ionicons color={colors.primary} name="chevron-back" size={18} />
                <Text style={styles.pinnedHeaderCloseLabel}>Back</Text>
              </Pressable>
            </View>
            <Animated.View
              pointerEvents="none"
              style={[styles.pinnedHeaderElevation, { opacity: pinnedHeaderElevation }]}
            />
          </View>
        ) : null}
        {showMoreHubPinnedBar ? (
          <View style={styles.pinnedHeaderBar}>
            <View style={styles.pinnedHeaderRow}>
              <Animated.View
                style={[
                  styles.pinnedHeaderRow,
                  {
                    opacity: titleOpacity,
                    transform: [{ scale: titleScale }, { translateY: titleTranslateY }]
                  }
                ]}
              >
                <View style={styles.pinnedHeaderIcon}>
                  <Text style={styles.pinnedHeaderGlyph}>🧭</Text>
                </View>
                <Text numberOfLines={1} style={styles.pinnedHeaderTitle}>
                  More hub
                </Text>
              </Animated.View>
              <View style={styles.pinnedHeaderSpacer} />
            </View>
            <Animated.View
              pointerEvents="none"
              style={[styles.pinnedHeaderElevation, { opacity: pinnedHeaderElevation }]}
            />
          </View>
        ) : null}
        {showKidsSessionPinnedBar ? (
          <View style={styles.pinnedHeaderBar}>
            <View style={styles.pinnedHeaderRow}>
              <Animated.View
                style={{
                  opacity: titleOpacity,
                  transform: [{ scale: titleScale }, { translateY: titleTranslateY }]
                }}
              >
                <Pill label="Kids mode" tone="mint" icon="happy" />
              </Animated.View>
              <View style={styles.pinnedHeaderSpacer} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Hold to exit kids mode"
                delayLongPress={900}
                onLongPress={handleExitKidsMode}
                onPress={() => setKidsSessionExitHintVisible(true)}
                style={({ pressed }) => [styles.kidsSessionExitChip, pressed && styles.kidsSessionExitChipPressed]}
              >
                <Ionicons name="lock-closed" size={14} color={colors.ink} />
                <Text style={styles.kidsSessionExitChipText}>Hold to exit</Text>
              </Pressable>
            </View>
            <Animated.View
              pointerEvents="none"
              style={[styles.pinnedHeaderElevation, { opacity: pinnedHeaderElevation }]}
            />
          </View>
        ) : null}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, showTabBar && styles.contentWithTabBar]}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <ScrollAssistContext.Provider value={scrollAssist}>
          <OfflineBanner
            pendingCount={enteredApp ? pendingOfflineCount : 0}
            failedCount={enteredApp ? failedOfflineCount : 0}
            replayMessage={enteredApp ? offlineReplayMessage : null}
            isReplaying={enteredApp ? isReplayingOffline : false}
            onRetryReplay={
              enteredApp && syncSource === "api"
                ? () => {
                    void replayPendingOfflineMutations();
                  }
                : undefined
            }
          />
          <Animated.View
            style={[
              styles.screenContainer,
              {
                width: screenWidth,
                opacity: screenOpacity,
                transform: [{ translateY: screenTranslateY }]
              }
            ]}
          >
            {showWelcome ? (
              authMode === "loading" ? (
                <View style={styles.connectingWrap}>
                  <View style={styles.connectingMarkWrap}>
                    <Image source={require("./assets/icon.png")} style={styles.connectingMark} />
                  </View>
                  <View style={styles.connecting}>
                    <Text style={styles.connectingEyebrow}>HomeThread</Text>
                    <Text style={styles.connectingTitle}>Checking your session</Text>
                    <Text style={styles.connectingSubtitle}>Making sure we open the right household and not the wrong screen.</Text>
                  </View>
                </View>
              ) : (
                <WelcomeScreen
                  onSignedIn={() => {
                    setEnteredApp(true);
                  }}
                  onSetupChildDevice={() => setShowChildDeviceSetup(true)}
                />
              )
            ) : showConnecting ? (
              <View style={styles.connectingWrap}>
                <View style={styles.connectingMarkWrap}>
                  <Image source={require("./assets/icon.png")} style={styles.connectingMark} />
                </View>
                <View style={styles.connecting}>
                  <Text style={styles.connectingEyebrow}>Household sync</Text>
                  <Text style={styles.connectingTitle}>Connecting to HomeThread</Text>
                  <Text style={styles.connectingSubtitle}>{syncMessage}</Text>
                </View>
              </View>
            ) : showKidsModePicker ? (
              <KidsModePickerScreen
                pinnedHeader
                kidMembers={kidMembers}
                onSelect={(memberId) => {
                  setKidsModeMemberId(memberId);
                  setShowKidsModePicker(false);
                  setKidsMode(true);
                }}
                onCancel={handleExitKidsMode}
              />
            ) : kidsMode && kidsModeMemberId ? (
              <KidsModeScreen
                activeKidMemberId={kidsModeMemberId}
                onExit={handleExitKidsMode}
                pinnedHeader
                exitHintVisible={kidsSessionExitHintVisible}
              />
            ) : insightsOpen ? (
              <InsightsScreen onClose={() => setInsightsOpen(false)} pinnedHeader />
            ) : settingsOpen ? (
              <SettingsScreen
                pinnedHeader
                onClose={() => setSettingsOpen(false)}
                onOpenFamilySettings={() => {
                  setSettingsOpen(false);
                  setFamilySettingsOpen(true);
                }}
                onOpenInsights={() => {
                  setSettingsOpen(false);
                  setInsightsOpen(true);
                }}
              />
            ) : familySettingsOpen ? (
              <FamilyScreen
                pinnedHeader
                onClose={() => setFamilySettingsOpen(false)}
                onLeaveComplete={({ needsFamilySetup }) => {
                  setFamilySettingsOpen(false);
                  setSettingsOpen(false);
                  setInsightsOpen(false);
                  setKidsMode(false);
                  setShowKidsModePicker(false);
                  setKidsModeMemberId(null);
                  if (needsFamilySetup) {
                    setEnteredApp(false);
                    setActiveTab("home");
                  }
                }}
              />
            ) : (
              content
            )}
          </Animated.View>
          </ScrollAssistContext.Provider>
        </ScrollView>
        {showTabBar ? (
          <View style={styles.tabBar}>
            {activeTab === "home" ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ask HomeThread Assistant"
                hitSlop={8}
                onPress={() => navigateTo("assistant")}
                style={styles.assistantShortcut}
              >
                <Text style={styles.assistantShortcutGlyph}>✨</Text>
              </Pressable>
            ) : null}
            {tabs.map((tab) => (
              <IconButton
                key={tab.key}
                icon={tab.icon}
                label={tab.label}
                tone={tab.tone}
                onPress={() => {
                  if (tab.key === "more") {
                    setMoreDestination("hub");
                  }
                  setActiveTab(tab.key);
                }}
                selected={activeTab === tab.key}
              />
            ))}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppShell />
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.canvas,
    flex: 1
  },
  keyboardView: {
    flex: 1
  },
  configBlockWrap: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg
  },
  content: {
    alignItems: "stretch",
    paddingVertical: spacing.lg
  },
  contentWithTabBar: {
    flexGrow: 1,
    paddingBottom: 168
  },
  pinnedHeaderBar: {
    backgroundColor: colors.canvas,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs
  },
  pinnedHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  pinnedHeaderIcon: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  pinnedHeaderGlyph: {
    fontSize: 15
  },
  pinnedHeaderDateChip: {
    alignItems: "center",
    backgroundColor: colors.goldSoft,
    borderColor: "rgba(193,125,60,0.24)",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3
  },
  pinnedHeaderDateChipText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2
  },
  pinnedHeaderTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 19,
    fontWeight: "700"
  },
  pinnedHeaderSpacer: {
    flex: 1
  },
  pinnedHeaderClose: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 30,
    paddingHorizontal: spacing.xs
  },
  pinnedHeaderCloseLabel: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700"
  },
  kidsSessionExitChip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  kidsSessionExitChipPressed: {
    opacity: 0.84
  },
  kidsSessionExitChipText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800"
  },
  pinnedHeaderAvatar: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    height: 30,
    justifyContent: "center",
    overflow: "hidden",
    width: 30
  },
  pinnedHeaderAvatarImage: {
    height: "100%",
    width: "100%"
  },
  pinnedHeaderAvatarText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800"
  },
  pinnedHeaderChildRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  pinnedHeaderAvatarSmall: {
    alignItems: "center",
    backgroundColor: colors.goldSoft,
    borderRadius: radii.pill,
    height: 28,
    justifyContent: "center",
    overflow: "hidden",
    width: 28
  },
  pinnedHeaderAvatarSmallImage: {
    height: "100%",
    width: "100%"
  },
  pinnedHeaderAvatarSmallText: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800"
  },
  pinnedHeaderElevation: {
    backgroundColor: colors.canvas,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    bottom: 0,
    elevation: 3,
    height: "100%",
    left: 0,
    position: "absolute",
    right: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    top: 0,
    zIndex: -1
  },
  screenContainer: {
    alignSelf: "center",
    maxWidth: 520,
    minWidth: 0
  },
  connectingWrap: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 520
  },
  connectingMarkWrap: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    height: 82,
    justifyContent: "center",
    marginBottom: spacing.lg,
    width: 82
  },
  connectingMark: {
    height: 64,
    width: 64
  },
  connecting: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    maxWidth: 420,
    padding: spacing.xl,
    width: "100%"
  },
  connectingEyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: spacing.xs,
    textTransform: "uppercase"
  },
  connectingTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34
  },
  connectingSubtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm
  },
  childDeviceActionWrap: {
    marginTop: spacing.lg,
    maxWidth: 420,
    width: "100%"
  },
  childDeviceDismiss: {
    alignItems: "center",
    marginTop: spacing.md,
    paddingVertical: spacing.sm
  },
  childDeviceDismissLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  assistantShortcut: {
    alignItems: "center",
    backgroundColor: "transparent",
    height: 44,
    justifyContent: "center",
    position: "absolute",
    right: 18,
    top: -48,
    width: 44,
    zIndex: 20
  },
  assistantShortcutGlyph: {
    fontSize: 30,
    textShadowColor: "rgba(0,0,0,0.18)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4
  },
  tabBar: {
    backgroundColor: "rgba(255,252,248,0.96)",
    borderColor: colors.lineStrong,
    borderRadius: 22,
    borderWidth: 1,
    bottom: spacing.md,
    flexDirection: "row",
    gap: 0,
    left: spacing.md,
    paddingHorizontal: 4,
    paddingVertical: 5,
    position: "absolute",
    right: spacing.md,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }
  }
});

import Ionicons from "@expo/vector-icons/Ionicons";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";

import { IconButton } from "./src/components/Primitives";
import { AppErrorBoundary } from "./src/components/AppErrorBoundary";
import { colors, fonts, radii, spacing } from "./src/constants/theme";
import { ScrollAssistContext } from "./src/context/ScrollAssistContext";
import { OfflineBanner } from "./src/components/OfflineBanner";
import { AssistantScreen } from "./src/screens/AssistantScreen";
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

type IconName = keyof typeof Ionicons.glyphMap;

const tabs: { key: TabKey; label: string; icon: IconName }[] = [
  { key: "home", label: "Home", icon: "home" },
  { key: "plan", label: "Plan", icon: "calendar" },
  { key: "chores", label: "Chores", icon: "star" },
  { key: "lists", label: "Lists", icon: "bag" },
  { key: "more", label: "More", icon: "grid" }
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

function AppShell() {
  const [enteredApp, setEnteredApp] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [moreDestination, setMoreDestination] = useState<MoreDestination>("hub");
  const [kidsMode, setKidsMode] = useState(false);
  const [kidsModeMemberId, setKidsModeMemberId] = useState<string | null>(null);
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
  const scrollAssist = useMemo(
    () => ({
      scrollToTop: () => scrollRef.current?.scrollTo({ y: 0, animated: true }),
      scrollToOffset: (offset: number) => scrollRef.current?.scrollTo({ y: offset, animated: true }),
      scrollToBottom: () => scrollRef.current?.scrollToEnd({ animated: true })
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
  const bootstrapChildDevice = useChildDeviceStore((state) => state.bootstrap);
  const hydrateFromBackend = useHomeThreadStore((state) => state.hydrateFromBackend);
  const isHydrating = useHomeThreadStore((state) => state.isHydrating);
  const syncMessage = useHomeThreadStore((state) => state.syncMessage);
  const syncSource = useHomeThreadStore((state) => state.syncSource);
  const familyId = useHomeThreadStore((state) => state.familyId);
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

  const content = useMemo(() => {
    if (activeTab === "plan") return <PlanScreen />;
    if (activeTab === "chores") return <ChoresScreen />;
    if (activeTab === "lists") return <ListsScreen />;
    if (activeTab === "more") {
      if (moreDestination === "meals") {
        return <MealsScreen onBack={() => setMoreDestination("hub")} />;
      }

      if (moreDestination === "board") {
        return <ThreadScreen onBack={() => setMoreDestination("hub")} />;
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
      />
    );
  }, [activeTab, handleEnterKidsMode, moreDestination, navigateTo]);

  const showConnecting = enteredApp && authMode !== "loading" && authMode !== "signed_out" && isHydrating;
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
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.screenContainer, { width: screenWidth, alignSelf: "center" }]}>
            <ChildDeviceShellScreen />
          </View>
        </ScrollView>
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
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
                kidMembers={kidMembers}
                onSelect={(memberId) => {
                  setKidsModeMemberId(memberId);
                  setShowKidsModePicker(false);
                  setKidsMode(true);
                }}
                onCancel={handleExitKidsMode}
              />
            ) : kidsMode && kidsModeMemberId ? (
              <KidsModeScreen activeKidMemberId={kidsModeMemberId} onExit={handleExitKidsMode} />
            ) : insightsOpen ? (
              <InsightsScreen onClose={() => setInsightsOpen(false)} />
            ) : settingsOpen ? (
              <SettingsScreen
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
        {enteredApp && authMode !== "signed_out" && !kidsMode && !showKidsModePicker && !familySettingsOpen && !insightsOpen && !settingsOpen ? (
          <View style={styles.tabBar}>
            {tabs.map((tab) => (
              <IconButton
                key={tab.key}
                icon={tab.icon}
                label={tab.label}
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
    flexGrow: 1,
    paddingVertical: spacing.lg,
    paddingBottom: 168
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

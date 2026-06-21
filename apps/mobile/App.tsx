import Ionicons from "@expo/vector-icons/Ionicons";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { ChoresScreen } from "./src/screens/ChoresScreen";
import { FamilyScreen } from "./src/screens/FamilyScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { InsightsScreen } from "./src/screens/InsightsScreen";
import { KidsModeScreen } from "./src/screens/KidsModeScreen";
import { ListsScreen } from "./src/screens/ListsScreen";
import { MealsScreen } from "./src/screens/MealsScreen";
import { PlanScreen } from "./src/screens/PlanScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { ThreadScreen } from "./src/screens/ThreadScreen";
import { WelcomeScreen } from "./src/screens/WelcomeScreen";
import { getApiConfigurationStatus, isProductionApiMisconfigured } from "./src/services/api";
import { initMobileSentry } from "./src/services/sentry";
import { refreshPushTokenIfAvailable } from "./src/services/notifications";
import { useAuthStore } from "./src/store/useAuthStore";
import { useHomeThreadStore, resetHomeThreadStoreForSignedOut } from "./src/store/useHomeThreadStore";
import { startFamilyRealtimeSync, stopFamilyRealtimeSync } from "./src/services/familyRealtimeSync";
import { isSupabaseConfigured, supabaseClient } from "./src/services/supabase";
import { TabKey } from "./src/types";

type IconName = keyof typeof Ionicons.glyphMap;

const tabs: { key: TabKey; label: string; icon: IconName }[] = [
  { key: "home", label: "Home", icon: "home" },
  { key: "plan", label: "Plan", icon: "calendar" },
  { key: "chores", label: "Chores", icon: "star" },
  { key: "lists", label: "Lists", icon: "bag" },
  { key: "meals", label: "Meals", icon: "restaurant" },
  { key: "thread", label: "Board", icon: "chatbubbles" },
  { key: "add", label: "Assistant", icon: "sparkles" }
];

function AppShell() {
  const [enteredApp, setEnteredApp] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [kidsMode, setKidsMode] = useState(false);
  const [familySettingsOpen, setFamilySettingsOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { width: viewportWidth } = useWindowDimensions();
  const screenWidth = Math.max(288, Math.min(viewportWidth - spacing.lg * 2, 520));
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenTranslateY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const scrollAssist = useMemo(
    () => ({
      scrollToTop: () => scrollRef.current?.scrollTo({ y: 0, animated: true }),
      scrollToOffset: (offset: number) => scrollRef.current?.scrollTo({ y: offset, animated: true })
    }),
    []
  );
  const authMode = useAuthStore((state) => state.mode);
  const authFamilyId = useAuthStore((state) => state.familyId);
  const bootstrapAuth = useAuthStore((state) => state.bootstrap);
  const savePushToken = useAuthStore((state) => state.savePushToken);
  const hydrateFromBackend = useHomeThreadStore((state) => state.hydrateFromBackend);
  const isHydrating = useHomeThreadStore((state) => state.isHydrating);
  const syncMessage = useHomeThreadStore((state) => state.syncMessage);
  const syncSource = useHomeThreadStore((state) => state.syncSource);
  const familyId = useHomeThreadStore((state) => state.familyId);
  const listIdsKey = useHomeThreadStore((state) =>
    state.lists
      .map((list) => list.id)
      .slice()
      .sort()
      .join(",")
  );
  const pendingOfflineCount = useHomeThreadStore((state) =>
    state.offlineQueue.filter((item) => item.status === "pending").length
  );
  const failedOfflineCount = useHomeThreadStore((state) =>
    state.offlineQueue.filter((item) => item.status === "failed").length
  );
  const offlineReplayMessage = useHomeThreadStore((state) => state.offlineReplayMessage);
  const isReplayingOffline = useHomeThreadStore((state) => state.isReplayingOffline);
  const replayPendingOfflineMutations = useHomeThreadStore((state) => state.replayPendingOfflineMutations);

  useEffect(() => {
    void bootstrapAuth();
  }, [bootstrapAuth]);

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

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        void useAuthStore.getState().bootstrap();
      }
    });

    return () => {
      subscription.data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authMode === "dev_token" || authMode === "supabase") {
      setEnteredApp(Boolean(authFamilyId));
    } else if (authMode === "signed_out") {
      setEnteredApp(false);
      setKidsMode(false);
      setFamilySettingsOpen(false);
      setInsightsOpen(false);
      setSettingsOpen(false);
      resetHomeThreadStoreForSignedOut();
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

    return () => {
      stopFamilyRealtimeSync();
    };
  }, [authMode, enteredApp, familyId, listIdsKey, syncSource]);

  const content = useMemo(() => {
    if (activeTab === "plan") return <PlanScreen />;
    if (activeTab === "chores") return <ChoresScreen />;
    if (activeTab === "lists") return <ListsScreen />;
    if (activeTab === "meals") return <MealsScreen />;
    if (activeTab === "thread") return <ThreadScreen />;
    if (activeTab === "add") return <AssistantScreen />;
    return (
      <HomeScreen
        goTo={setActiveTab}
        onEnterKidsMode={() => setKidsMode(true)}
        onOpenFamilySettings={() => setFamilySettingsOpen(true)}
        onOpenInsights={() => setInsightsOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
    );
  }, [activeTab]);

  const showConnecting = enteredApp && authMode !== "loading" && authMode !== "signed_out" && isHydrating;
  const showWelcome = authMode === "loading" || authMode === "signed_out" || !enteredApp;
  const screenKey = [
    activeTab,
    kidsMode ? "kids" : "adult",
    familySettingsOpen ? "family" : "family-closed",
    insightsOpen ? "insights" : "insights-closed",
    settingsOpen ? "settings" : "settings-closed",
    showWelcome ? "welcome" : "app",
    showConnecting ? "connecting" : "ready"
  ].join(":");

  useEffect(() => {
    scrollAssist.scrollToTop();
  }, [activeTab, familySettingsOpen, insightsOpen, settingsOpen, kidsMode, scrollAssist]);

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
            ) : kidsMode ? (
              <KidsModeScreen onExit={() => setKidsMode(false)} />
            ) : insightsOpen ? (
              <InsightsScreen onClose={() => setInsightsOpen(false)} />
            ) : settingsOpen ? (
              <SettingsScreen
                onClose={() => setSettingsOpen(false)}
                onOpenFamilySettings={() => {
                  setSettingsOpen(false);
                  setFamilySettingsOpen(true);
                }}
              />
            ) : familySettingsOpen ? (
              <FamilyScreen onClose={() => setFamilySettingsOpen(false)} />
            ) : (
              content
            )}
          </Animated.View>
          </ScrollAssistContext.Provider>
        </ScrollView>
        {enteredApp && authMode !== "signed_out" && !kidsMode && !familySettingsOpen && !insightsOpen && !settingsOpen ? (
          <View style={styles.tabBar}>
            {tabs.map((tab) => (
              <IconButton
                key={tab.key}
                icon={tab.icon}
                label={tab.label}
                onPress={() => {
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

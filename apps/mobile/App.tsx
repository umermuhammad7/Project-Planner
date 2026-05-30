import Ionicons from "@expo/vector-icons/Ionicons";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import { IconButton } from "./src/components/Primitives";
import { colors, spacing } from "./src/constants/theme";
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
import { ThreadScreen } from "./src/screens/ThreadScreen";
import { WelcomeScreen } from "./src/screens/WelcomeScreen";
import { useAuthStore } from "./src/store/useAuthStore";
import { useHomeThreadStore } from "./src/store/useHomeThreadStore";
import { startFamilyRealtimeSync, stopFamilyRealtimeSync } from "./src/services/familyRealtimeSync";
import { TabKey } from "./src/types";

type IconName = keyof typeof Ionicons.glyphMap;

const tabs: { key: TabKey; label: string; icon: IconName }[] = [
  { key: "home", label: "Home", icon: "home" },
  { key: "plan", label: "Plan", icon: "calendar" },
  { key: "chores", label: "Chores", icon: "star" },
  { key: "lists", label: "Lists", icon: "bag" },
  { key: "meals", label: "Meals", icon: "restaurant" },
  { key: "thread", label: "Texts", icon: "chatbubbles" },
  { key: "add", label: "Add", icon: "add-circle" }
];

export default function App() {
  const [enteredApp, setEnteredApp] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [kidsMode, setKidsMode] = useState(false);
  const [familySettingsOpen, setFamilySettingsOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const authMode = useAuthStore((state) => state.mode);
  const authFamilyId = useAuthStore((state) => state.familyId);
  const bootstrapAuth = useAuthStore((state) => state.bootstrap);
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
    if (authMode === "dev_token" || authMode === "supabase") {
      setEnteredApp(Boolean(authFamilyId));
    } else if (authMode === "signed_out") {
      setEnteredApp(false);
    }
  }, [authFamilyId, authMode]);

  useEffect(() => {
    if (enteredApp && authMode !== "loading" && authMode !== "signed_out") {
      void hydrateFromBackend();
    }
  }, [enteredApp, authMode, hydrateFromBackend]);

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
      />
    );
  }, [activeTab]);

  const showConnecting = enteredApp && authMode !== "loading" && authMode !== "signed_out" && isHydrating;
  const showWelcome = authMode === "loading" || authMode === "signed_out" || !enteredApp;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <OfflineBanner
            visible={
              enteredApp &&
              !isHydrating &&
              (syncSource !== "api" || pendingOfflineCount > 0 || failedOfflineCount > 0)
            }
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
          {showWelcome ? (
            authMode === "loading" ? (
              <View style={styles.connecting}>
                <Text style={styles.connectingTitle}>Checking session...</Text>
                <Text style={styles.connectingSubtitle}>Restoring Supabase auth when configured.</Text>
              </View>
            ) : (
              <WelcomeScreen
                onSignedIn={() => {
                  setEnteredApp(true);
                }}
              />
            )
          ) : showConnecting ? (
            <View style={styles.connecting}>
              <Text style={styles.connectingTitle}>Connecting to HomeThread...</Text>
              <Text style={styles.connectingSubtitle}>{syncMessage}</Text>
            </View>
          ) : kidsMode ? (
            <KidsModeScreen onExit={() => setKidsMode(false)} />
          ) : insightsOpen ? (
            <InsightsScreen onClose={() => setInsightsOpen(false)} />
          ) : familySettingsOpen ? (
            <FamilyScreen onClose={() => setFamilySettingsOpen(false)} />
          ) : (
            content
          )}
        </ScrollView>
        {enteredApp && authMode !== "signed_out" && !kidsMode && !familySettingsOpen && !insightsOpen ? (
          <View style={styles.tabBar}>
            {tabs.map((tab) => (
              <IconButton
                key={tab.key}
                icon={tab.icon}
                label={tab.label}
                onPress={() => setActiveTab(tab.key)}
                selected={activeTab === tab.key}
              />
            ))}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  content: {
    padding: spacing.lg,
    paddingBottom: 118
  },
  connecting: {
    paddingTop: spacing.lg
  },
  connectingTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28
  },
  connectingSubtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm
  },
  tabBar: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    bottom: spacing.md,
    flexDirection: "row",
    gap: 2,
    left: spacing.md,
    padding: spacing.sm,
    position: "absolute",
    right: spacing.md
  }
});

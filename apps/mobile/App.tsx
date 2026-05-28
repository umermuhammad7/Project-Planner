import Ionicons from "@expo/vector-icons/Ionicons";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import { IconButton } from "./src/components/Primitives";
import { colors, spacing } from "./src/constants/theme";
import { OfflineBanner } from "./src/components/OfflineBanner";
import { AssistantScreen } from "./src/screens/AssistantScreen";
import { ChoresScreen } from "./src/screens/ChoresScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { ListsScreen } from "./src/screens/ListsScreen";
import { PlanScreen } from "./src/screens/PlanScreen";
import { ThreadScreen } from "./src/screens/ThreadScreen";
import { WelcomeScreen } from "./src/screens/WelcomeScreen";
import { useHomeThreadStore } from "./src/store/useHomeThreadStore";
import { TabKey } from "./src/types";

type IconName = keyof typeof Ionicons.glyphMap;

const tabs: { key: TabKey; label: string; icon: IconName }[] = [
  { key: "home", label: "Home", icon: "home" },
  { key: "plan", label: "Plan", icon: "calendar" },
  { key: "chores", label: "Chores", icon: "star" },
  { key: "lists", label: "Lists", icon: "bag" },
  { key: "thread", label: "Texts", icon: "chatbubbles" },
  { key: "add", label: "Add", icon: "add-circle" }
];

export default function App() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const hydrateFromBackend = useHomeThreadStore((state) => state.hydrateFromBackend);
  const isHydrating = useHomeThreadStore((state) => state.isHydrating);
  const syncMessage = useHomeThreadStore((state) => state.syncMessage);
  const syncSource = useHomeThreadStore((state) => state.syncSource);

  useEffect(() => {
    if (hasCompletedOnboarding) {
      void hydrateFromBackend();
    }
  }, [hasCompletedOnboarding, hydrateFromBackend]);

  const content = useMemo(() => {
    if (activeTab === "plan") return <PlanScreen />;
    if (activeTab === "chores") return <ChoresScreen />;
    if (activeTab === "lists") return <ListsScreen />;
    if (activeTab === "thread") return <ThreadScreen />;
    if (activeTab === "add") return <AssistantScreen />;
    return <HomeScreen goTo={setActiveTab} />;
  }, [activeTab]);

  const showConnecting = hasCompletedOnboarding && isHydrating;

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
          <OfflineBanner visible={hasCompletedOnboarding && !isHydrating && syncSource !== "api"} />
          {hasCompletedOnboarding ? (
            showConnecting ? (
              <View style={styles.connecting}>
                <Text style={styles.connectingTitle}>Connecting to HomeThread…</Text>
                <Text style={styles.connectingSubtitle}>{syncMessage}</Text>
              </View>
            ) : (
              content
            )
          ) : (
            <WelcomeScreen onComplete={() => setHasCompletedOnboarding(true)} />
          )}
        </ScrollView>
        {hasCompletedOnboarding ? (
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

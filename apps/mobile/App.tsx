import Ionicons from "@expo/vector-icons/Ionicons";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";

import { IconButton } from "./src/components/Primitives";
import { colors, spacing } from "./src/constants/theme";
import { AssistantScreen } from "./src/screens/AssistantScreen";
import { ChoresScreen } from "./src/screens/ChoresScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { ListsScreen } from "./src/screens/ListsScreen";
import { PlanScreen } from "./src/screens/PlanScreen";
import { ThreadScreen } from "./src/screens/ThreadScreen";
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
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const content = useMemo(() => {
    if (activeTab === "plan") return <PlanScreen />;
    if (activeTab === "chores") return <ChoresScreen />;
    if (activeTab === "lists") return <ListsScreen />;
    if (activeTab === "thread") return <ThreadScreen />;
    if (activeTab === "add") return <AssistantScreen />;
    return <HomeScreen goTo={setActiveTab} />;
  }, [activeTab]);

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
          {content}
        </ScrollView>
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

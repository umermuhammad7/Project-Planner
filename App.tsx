import { ComponentType } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

type LoadedApp = ComponentType | null;

let LoadedMobileApp: LoadedApp = null;
let startupImportError: string | null = null;

try {
  const module = require("./apps/mobile/App");
  LoadedMobileApp = (module?.default ?? module) as LoadedApp;
  if (!LoadedMobileApp) {
    startupImportError = "HomeThread loaded the mobile bundle, but no default app component was exported.";
  }
} catch (error) {
  startupImportError =
    error instanceof Error ? `${error.name}: ${error.message}` : "Unknown startup import error";
  console.error("HomeThread failed while importing the mobile app bundle.", error);
}

function StartupFallback() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>HomeThread could not start.</Text>
          <Text style={styles.body}>
            The app failed before the normal UI could render. This usually means a startup import or module-load
            problem, which is much narrower than a random white screen.
          </Text>
          <Text style={styles.label}>Startup error</Text>
          <Text selectable style={styles.code}>
            {startupImportError ?? "No startup error details were captured."}
          </Text>
          <Pressable accessibilityRole="button" style={styles.button}>
            <Text style={styles.buttonLabel}>Reinstall the next TestFlight build after this is fixed</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function RootApp() {
  if (!LoadedMobileApp || startupImportError) {
    return <StartupFallback />;
  }

  return <LoadedMobileApp />;
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#F7F4EF",
    flex: 1
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E4DDD4",
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 20
  },
  title: {
    color: "#1F2A44",
    fontSize: 24,
    fontWeight: "900"
  },
  body: {
    color: "#5E6B84",
    fontSize: 15,
    lineHeight: 22
  },
  label: {
    color: "#1F2A44",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  code: {
    backgroundColor: "#F4F6FA",
    borderRadius: 16,
    color: "#1F2A44",
    fontSize: 13,
    lineHeight: 20,
    padding: 14
  },
  button: {
    alignItems: "center",
    backgroundColor: "#3765E5",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16
  },
  buttonLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center"
  }
});

import { Component, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing } from "../constants/theme";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  errorMessage: string | null;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    errorMessage: null
  };

  static getDerivedStateFromError(error: unknown) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return {
      hasError: true,
      errorMessage: message.slice(0, 220)
    };
  }

  componentDidCatch(error: unknown) {
    console.error("HomeThread render error", error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.screen}>
        <View style={styles.card}>
          <Text style={styles.title}>HomeThread hit a screen error.</Text>
          <Text style={styles.body}>
            Your household data is still safe. Try reopening this screen or restarting the app.
          </Text>
          {this.state.errorMessage ? (
            <Text selectable style={styles.detail}>
              {this.state.errorMessage}
            </Text>
          ) : null}
          <Pressable
            accessibilityLabel="Try HomeThread again"
            onPress={() => this.setState({ hasError: false, errorMessage: null })}
            style={styles.button}
          >
            <Text style={styles.buttonLabel}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    maxWidth: 480,
    padding: spacing.lg,
    width: "100%"
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22
  },
  detail: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    padding: spacing.sm
  },
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.lg
  },
  buttonLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900"
  }
});

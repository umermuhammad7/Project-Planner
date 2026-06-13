import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing } from "../constants/theme";

type FeedbackTone = "success" | "error" | "info";

export function ActionFeedback({
  message,
  tone = "success",
  visible
}: {
  message: string;
  tone?: FeedbackTone;
  visible: boolean;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-6)).current;

  useEffect(() => {
    if (!visible || !message) {
      opacity.setValue(0);
      translateY.setValue(-6);
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: Platform.OS !== "web"
      }),
      Animated.spring(translateY, {
        toValue: 0,
        stiffness: 260,
        damping: 22,
        mass: 1,
        useNativeDriver: Platform.OS !== "web"
      })
    ]).start();
  }, [message, opacity, translateY, visible]);

  if (!visible || !message) {
    return null;
  }

  const iconName =
    tone === "success" ? "checkmark-circle" : tone === "error" ? "alert-circle" : "information-circle";

  return (
    <Animated.View
      style={[
        styles.banner,
        toneStyles[tone],
        {
          opacity,
          transform: [{ translateY }]
        }
      ]}
    >
      <Ionicons name={iconName} size={18} color={toneColors[tone]} />
      <Text style={[styles.text, { color: toneColors[tone] }]}>{message}</Text>
    </Animated.View>
  );
}

const toneColors: Record<FeedbackTone, string> = {
  success: colors.mint,
  error: colors.coral,
  info: colors.primary
};

const toneStyles = StyleSheet.create({
  success: {
    backgroundColor: colors.mintSoft,
    borderColor: "rgba(74, 124, 89, 0.18)"
  },
  error: {
    backgroundColor: colors.coralSoft,
    borderColor: "rgba(180, 92, 72, 0.18)"
  },
  info: {
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(139, 107, 74, 0.18)"
  }
});

const styles = StyleSheet.create({
  banner: {
    alignItems: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  }
});

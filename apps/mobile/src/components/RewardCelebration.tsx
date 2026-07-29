import { useRef, useState } from "react";
import { Animated, LayoutAnimation, StyleSheet, Text } from "react-native";

import { colors, fonts, radii, spacing } from "../constants/theme";

export function useRewardCelebration() {
  const [celebration, setCelebration] = useState<{ stars: number } | null>(null);
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  function triggerCelebration(stars: number) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCelebration({ stars });
    scale.setValue(0.6);
    opacity.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.08, friction: 4, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true })
      ]),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true })
    ]).start();

    setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCelebration(null);
      });
    }, 1600);
  }

  return { celebration, scale, opacity, triggerCelebration };
}

export function RewardCelebrationBanner({
  celebration,
  scale,
  opacity
}: {
  celebration: { stars: number } | null;
  scale: Animated.Value;
  opacity: Animated.Value;
}) {
  if (!celebration) {
    return null;
  }

  return (
    <Animated.View style={[styles.banner, { opacity, transform: [{ scale }] }]}>
      <Text style={styles.emoji}>🎉</Text>
      <Text style={styles.text}>
        +{celebration.stars} star{celebration.stars === 1 ? "" : "s"}!
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: "center",
    backgroundColor: colors.goldSoft,
    borderColor: "rgba(193,125,60,0.28)",
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    paddingVertical: spacing.md
  },
  emoji: {
    fontSize: 22
  },
  text: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "800"
  }
});

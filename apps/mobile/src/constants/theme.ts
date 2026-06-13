import { Platform, StyleSheet } from "react-native";

export const colors = {
  ink: "#2C2416",
  muted: "#7A6E5F",
  tertiary: "#A89F92",
  canvas: "#F7F3EE",
  surface: "#FFFCF8",
  surfaceRaised: "#EFEBE4",
  line: "#E8E2D9",
  lineStrong: "#D7CDBC",
  primary: "#8B6B4A",
  primaryPressed: "#6D5238",
  primarySoft: "#F2E7DA",
  coral: "#A0493B",
  coralSoft: "#F6E6E2",
  mint: "#5C7A5A",
  mintSoft: "#E6EEE2",
  gold: "#C17D3C",
  goldSoft: "#F6E8D3",
  berry: "#9B6B8A",
  sky: "#6B7FAD",
  skySoft: "#E8ECF5",
  danger: "#A0493B"
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48
};

export const radii = {
  sm: 6,
  md: 12,
  lg: 14,
  xl: 18,
  pill: 999
};

export const fonts = {
  display: Platform.select({
    ios: "Georgia",
    android: "serif",
    default: "Georgia"
  }),
  body: Platform.select({
    ios: "System",
    android: "sans-serif",
    default: "System"
  })
};

export const shadow = StyleSheet.create({
  card: {
    ...Platform.select({
      ios: {
        shadowColor: colors.ink,
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 }
      },
      android: {
        elevation: 2
      },
      default: {
        shadowColor: "rgba(44,36,22,0.08)",
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 }
      }
    })
  }
});

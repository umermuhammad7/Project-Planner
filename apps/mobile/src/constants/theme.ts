import { Platform, StyleSheet } from "react-native";

export const colors = {
  ink: "#172033",
  muted: "#667085",
  canvas: "#F7F4EF",
  surface: "#FFFFFF",
  line: "#E7E0D6",
  primary: "#3157D5",
  primarySoft: "#E7ECFF",
  coral: "#F9735B",
  coralSoft: "#FFE8E2",
  mint: "#2DAA84",
  mintSoft: "#DFF7EE",
  gold: "#F4B740",
  goldSoft: "#FFF3CF",
  berry: "#A85576",
  sky: "#3A91C9",
  skySoft: "#E5F4FF",
  danger: "#D83F31"
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
};

export const radii = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999
};

export const shadow = StyleSheet.create({
  card: {
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 }
      },
      android: {
        elevation: 2
      },
      default: {
        shadowColor: "rgba(0,0,0,0.08)",
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 }
      }
    })
  }
});

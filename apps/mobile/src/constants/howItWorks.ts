import type { ComponentProps } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "./theme";

type HowItWorksIcon = ComponentProps<typeof Ionicons>["name"];

export type HowItWorksSlide = {
  title: string;
  body: string;
  icon: HowItWorksIcon;
  accent: string;
  accentSoft: string;
};

/** Shared How it works slides for Welcome + Home. */
export const HOW_IT_WORKS_SLIDES: HowItWorksSlide[] = [
  {
    title: "Start a household",
    body: "The first adult starts the home for everyone.",
    icon: "home",
    accent: colors.primary,
    accentSoft: colors.primarySoft
  },
  {
    title: "Invite another adult",
    body: "After sign-in, open Household and use Invite adult with the adult invite code.",
    icon: "key",
    accent: colors.mint,
    accentSoft: colors.mintSoft
  },
  {
    title: "Add children safely",
    body: "In Household, add the child profile, then pair their phone with the child pairing code.",
    icon: "happy",
    accent: colors.coral,
    accentSoft: colors.coralSoft
  },
  {
    title: "Coordinate daily life",
    body: "Home, Plan, Chores, Lists, Meals, and Family Board keep the household updated.",
    icon: "calendar",
    accent: colors.sky,
    accentSoft: colors.skySoft
  }
];

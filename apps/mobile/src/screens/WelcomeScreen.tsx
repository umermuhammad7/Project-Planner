import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Card, Pill, PrimaryButton, SectionTitle } from "../components/Primitives";
import { colors, radii, spacing } from "../constants/theme";

type Mode = "welcome" | "login" | "register" | "onboarding";

const onboardingSteps = [
  {
    title: "Create your home",
    body: "Name the household and set the default timezone for everyone."
  },
  {
    title: "Add family members",
    body: "Invite adults or add child profiles that do not need their own login yet."
  },
  {
    title: "Connect calendars",
    body: "Start without sync, or connect Google and Apple calendars when credentials are ready."
  },
  {
    title: "Choose the plan",
    body: "Use the generous free tier first; Plus gates stay feature-flagged from day one."
  }
];

export function WelcomeScreen({ onComplete }: { onComplete: () => void }) {
  const [mode, setMode] = useState<Mode>("welcome");
  const [step, setStep] = useState(0);

  if (mode === "onboarding") {
    const current = onboardingSteps[step];
    return (
      <View style={styles.screen}>
        <Pill label={`Step ${step + 1} of ${onboardingSteps.length}`} tone="primary" />
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.subtitle}>{current.body}</Text>
        <Card>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${((step + 1) / onboardingSteps.length) * 100}%` }]} />
          </View>
          <Text style={styles.cardText}>
            This is a lightweight, local-dev onboarding flow to get you into the family workspace quickly.
          </Text>
        </Card>
        <View style={styles.actions}>
          <PrimaryButton
            label={step === onboardingSteps.length - 1 ? "Enter HomeThread" : "Continue"}
            icon={step === onboardingSteps.length - 1 ? "home" : "arrow-forward"}
            onPress={() => {
              if (step === onboardingSteps.length - 1) {
                onComplete();
              } else {
                setStep((value) => value + 1);
              }
            }}
          />
        </View>
      </View>
    );
  }

  if (mode === "login" || mode === "register") {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>{mode === "login" ? "Welcome back" : "Create your HomeThread"}</Text>
        <Text style={styles.subtitle}>
          Local-dev bootstrap: continue to onboarding, then the app connects to your local HomeThread backend if available.
        </Text>
        <Card>
          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
          <Text style={styles.label}>Password</Text>
          <TextInput style={styles.input} secureTextEntry placeholder="Minimum 8 characters" />
          <View style={styles.formActions}>
            <PrimaryButton
              label={mode === "login" ? "Continue" : "Continue"}
              icon="arrow-forward"
              onPress={() => setMode("onboarding")}
            />
          </View>
        </Card>
        <Pressable onPress={() => setMode(mode === "login" ? "register" : "login")} style={styles.linkButton}>
          <Text style={styles.link}>{mode === "login" ? "Need an account?" : "Already have an account?"}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.kicker}>HomeThread</Text>
      <Text style={styles.title}>Keep the day moving together.</Text>
      <Text style={styles.subtitle}>
        A shared family plan for events, chores, and lists — backed by your local HomeThread database in dev.
      </Text>
      <SectionTitle title="Built for real households" />
      <Card>
        <Text style={styles.cardTitle}>Calendar, chores, lists, and the shared thread.</Text>
        <Text style={styles.cardText}>
          Everyone can see what changed without hunting through separate apps — and you can refresh from the local backend when it’s running.
        </Text>
      </Card>
      <View style={styles.actions}>
        <PrimaryButton label="Create account" icon="person-add" onPress={() => setMode("register")} />
        <PrimaryButton label="Log in" icon="log-in" tone="dark" onPress={() => setMode("login")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.md
  },
  kicker: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  title: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 39
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 23
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 25
  },
  cardText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: spacing.xs,
    marginTop: spacing.md
  },
  input: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: spacing.md
  },
  formActions: {
    marginTop: spacing.lg
  },
  linkButton: {
    minHeight: 44,
    justifyContent: "center"
  },
  link: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center"
  },
  progressTrack: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    height: 10,
    overflow: "hidden"
  },
  progressFill: {
    backgroundColor: colors.primary,
    height: "100%"
  }
});

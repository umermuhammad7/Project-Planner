import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Card, Pill, PrimaryButton, SectionTitle } from "../components/Primitives";
import { colors, radii, spacing } from "../constants/theme";
import { useAuthStore } from "../store/useAuthStore";

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
    body: "Start without sync, or connect Google calendars when credentials are ready."
  },
  {
    title: "Choose the plan",
    body: "Use the generous free tier first; Plus gates stay feature-flagged from day one."
  }
];

export function WelcomeScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const {
    mode: authMode,
    authMessage,
    backendAuthMode,
    devTokenAvailable,
    supabaseConfiguredOnClient,
    familyId,
    signInWithPassword,
    signUpWithPassword,
    signInWithDevToken,
    signOut
  } = useAuthStore();
  const [mode, setMode] = useState<Mode>("welcome");
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function completeAuthFlow() {
    const liveFamilyId = useAuthStore.getState().familyId;

    if (liveFamilyId) {
      onSignedIn();
      return;
    }

    setMode("onboarding");
    setStep(0);
  }

  async function handlePasswordAuth(kind: "login" | "register") {
    setIsSubmitting(true);
    setFormMessage(null);

    const result =
      kind === "login"
        ? await signInWithPassword(email, password)
        : await signUpWithPassword(email, password);

    setIsSubmitting(false);

    if (!result.ok) {
      setFormMessage(result.message ?? "Authentication failed.");
      return;
    }

    await completeAuthFlow();
  }

  async function handleDevTokenSignIn() {
    setIsSubmitting(true);
    setFormMessage(null);
    const result = await signInWithDevToken();
    setIsSubmitting(false);

    if (!result.ok) {
      setFormMessage(result.message ?? "Dev token sign-in failed.");
      return;
    }

    onSignedIn();
  }

  if (mode === "onboarding") {
    const current = onboardingSteps[step];
    const hasFamily = Boolean(familyId);
    const isLastStep = step === onboardingSteps.length - 1;

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
            {hasFamily
              ? "Your account is linked to a family. Continue into HomeThread."
              : "You are signed in, but this account is not linked to a family yet. HomeThread will keep you in setup until family creation or invite flow is implemented."}
          </Text>
        </Card>
        <View style={styles.actions}>
          <PrimaryButton
            label={isLastStep ? (hasFamily ? "Enter HomeThread" : "Sign out") : "Continue"}
            icon={isLastStep ? (hasFamily ? "home" : "log-out") : "arrow-forward"}
            onPress={() => {
              if (!isLastStep) {
                setStep((value) => value + 1);
                return;
              }

              if (hasFamily) {
                onSignedIn();
                return;
              }

              void signOut().then(() => {
                setMode("welcome");
                setStep(0);
                setFormMessage("Family setup is not available yet in this build.");
              });
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
          {supabaseConfiguredOnClient
            ? "Sign in with Supabase email and password. HomeThread uses your real session token for API calls."
            : "Supabase is not configured in this app build. Use the local dev token instead."}
        </Text>
        <Card>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder="Minimum 8 characters"
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={setPassword}
          />
          {formMessage ? <Text style={styles.formMessage}>{formMessage}</Text> : null}
          <View style={styles.formActions}>
            <PrimaryButton
              label={isSubmitting ? "Working..." : mode === "login" ? "Sign in" : "Create account"}
              icon="arrow-forward"
              onPress={() => {
                if (isSubmitting || !supabaseConfiguredOnClient) return;
                void handlePasswordAuth(mode);
              }}
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
        Sign in with Supabase when configured, or use the explicit local dev token for seeded backend data.
      </Text>
      {backendAuthMode ? (
        <Text style={styles.meta}>
          Backend auth mode: {backendAuthMode}
          {supabaseConfiguredOnClient ? " - Supabase client configured" : " - Supabase client missing"}
        </Text>
      ) : null}
      {authMessage ? <Text style={styles.formMessage}>{authMessage}</Text> : null}
      {formMessage ? <Text style={styles.formMessage}>{formMessage}</Text> : null}
      <SectionTitle title="Built for real households" />
      <Card>
        <Text style={styles.cardTitle}>Calendar, chores, lists, and the shared thread.</Text>
        <Text style={styles.cardText}>
          HomeThread only enters the main app after a real session or an explicit dev-token sign in. It does not
          pretend you are logged in.
        </Text>
      </Card>
      <View style={styles.actions}>
        {authMode === "supabase" && !familyId ? (
          <PrimaryButton
            label="Sign out"
            icon="log-out"
            tone="dark"
            onPress={() => {
              if (isSubmitting) return;
              void signOut().then(() => {
                setMode("welcome");
                setFormMessage("Family setup is not available yet in this build.");
              });
            }}
          />
        ) : null}
        {supabaseConfiguredOnClient && authMode !== "supabase" ? (
          <>
            <PrimaryButton label="Create account" icon="person-add" onPress={() => setMode("register")} />
            <PrimaryButton label="Log in" icon="log-in" tone="dark" onPress={() => setMode("login")} />
          </>
        ) : null}
        {devTokenAvailable ? (
          <PrimaryButton
            label={isSubmitting ? "Working..." : "Use local dev token"}
            icon="key"
            tone="dark"
            onPress={() => {
              if (isSubmitting) return;
              void handleDevTokenSignIn();
            }}
          />
        ) : null}
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
  meta: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800"
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
    flexWrap: "wrap",
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
  formMessage: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    marginTop: spacing.md
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

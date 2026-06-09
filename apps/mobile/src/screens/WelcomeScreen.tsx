import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Card, Pill, PrimaryButton, SectionTitle } from "../components/Primitives";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { useAuthStore } from "../store/useAuthStore";

type Mode = "welcome" | "login" | "register" | "family-setup";
type SetupTab = "create" | "join";

export function WelcomeScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const {
    mode: authMode,
    authMessage,
    devTokenAvailable,
    supabaseConfiguredOnClient,
    familyId,
    signInWithPassword,
    signUpWithPassword,
    signInWithGoogle,
    signInWithDevToken,
    createFamily,
    joinFamily,
    signOut
  } = useAuthStore();
  const [mode, setMode] = useState<Mode>("welcome");
  const [setupTab, setSetupTab] = useState<SetupTab>("create");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const configurationWarning =
    !supabaseConfiguredOnClient && authMode !== "loading"
      ? "This build is still missing its secure sign-in setup. Install the next build after configuration is updated."
      : null;

  useEffect(() => {
    if (authMode === "supabase" && !familyId && mode === "welcome") {
      setMode("family-setup");
    }
  }, [authMode, familyId, mode]);

  async function completeAuthFlow() {
    const liveFamilyId = useAuthStore.getState().familyId;

    if (liveFamilyId) {
      onSignedIn();
      return;
    }

    setMode("family-setup");
    setSetupTab("create");
    setCreatedInviteCode(null);
    setFormMessage(null);
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

  async function handleGoogleSignIn() {
    setIsSubmitting(true);
    setFormMessage(null);
    const result = await signInWithGoogle();
    setIsSubmitting(false);

    if (!result.ok) {
      setFormMessage(result.message ?? "Google sign-in could not start.");
    }
  }

  async function handleCreateFamily() {
    setIsSubmitting(true);
    setFormMessage(null);

    const result = await createFamily(familyName);
    setIsSubmitting(false);

    if (!result.ok) {
      setFormMessage(result.message ?? "Could not create your family.");
      return;
    }

    if (result.inviteCode) {
      setCreatedInviteCode(result.inviteCode);
      return;
    }

    onSignedIn();
  }

  async function handleJoinFamily() {
    setIsSubmitting(true);
    setFormMessage(null);

    const result = await joinFamily(inviteCode);
    setIsSubmitting(false);

    if (!result.ok) {
      setFormMessage(result.message ?? "Could not join that family.");
      return;
    }

    onSignedIn();
  }

  if (mode === "family-setup") {
    if (createdInviteCode) {
      return (
        <View style={styles.screen}>
          <Pill label="Household created" tone="primary" icon="home" />
          <Text style={styles.title}>Your family is ready.</Text>
          <Text style={styles.subtitle}>
            HomeThread can start with just you, then grow when another adult joins with this code.
          </Text>

          <Card>
            <Text style={styles.cardTitle}>Invite code</Text>
            <Text style={styles.inviteCode}>{createdInviteCode}</Text>
            <Text style={styles.cardText}>
              You are the first admin. Share this code later from Household whenever another adult needs access.
            </Text>
          </Card>

          <Card>
            <Text style={styles.cardTitle}>What happens next</Text>
            <View style={styles.bulletStack}>
              <Text style={styles.bulletText}>Start with one event, one list, or one chore so the home screen feels useful right away.</Text>
              <Text style={styles.bulletText}>Add child profiles later from Household when you want stars and kids mode to feel personal.</Text>
            </View>
          </Card>

          <View style={styles.actions}>
            <PrimaryButton label="Enter HomeThread" icon="home" onPress={onSignedIn} />
          </View>
        </View>
      );
    }

    return (
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable onPress={() => setMode("welcome")} style={styles.backButton}>
            <Text style={styles.backLabel}>Back</Text>
          </Pressable>
        </View>
        <Pill label="Household setup" tone="primary" icon="people" />
        <Text style={styles.title}>Create or join a family</Text>
        <Text style={styles.subtitle}>
          Your account is ready. The last step is linking it to a real household so HomeThread can load the right family data.
        </Text>

        <Card>
          <View style={styles.setupTabs}>
            <Pressable
              onPress={() => {
                setSetupTab("create");
                setFormMessage(null);
              }}
              style={[styles.setupTab, setupTab === "create" ? styles.setupTabActive : null]}
            >
              <Text style={[styles.setupTabLabel, setupTab === "create" ? styles.setupTabLabelActive : null]}>
                Create family
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setSetupTab("join");
                setFormMessage(null);
              }}
              style={[styles.setupTab, setupTab === "join" ? styles.setupTabActive : null]}
            >
              <Text style={[styles.setupTabLabel, setupTab === "join" ? styles.setupTabLabelActive : null]}>
                Join with code
              </Text>
            </Pressable>
          </View>

          {setupTab === "create" ? (
            <>
              <Text style={styles.label}>Family name</Text>
              <TextInput
                style={styles.input}
                placeholder="The Parker Home"
                placeholderTextColor={colors.muted}
                value={familyName}
                onChangeText={setFamilyName}
              />
              <Text style={styles.cardText}>You will become the first admin member and get a shareable invite code.</Text>
            </>
          ) : (
            <>
              <Text style={styles.label}>Invite code</Text>
              <TextInput
                style={styles.input}
                autoCapitalize="characters"
                placeholder="HT2026"
                placeholderTextColor={colors.muted}
                value={inviteCode}
                onChangeText={setInviteCode}
              />
              <Text style={styles.cardText}>
                Ask a family admin for their code. Joining links this account to the same plans, chores, and lists.
              </Text>
            </>
          )}

          {formMessage ? <Text style={styles.formMessage}>{formMessage}</Text> : null}
          <View style={styles.formActions}>
            <PrimaryButton
              label={isSubmitting ? "Working..." : setupTab === "create" ? "Create family" : "Join family"}
              icon={setupTab === "create" ? "home" : "enter"}
              onPress={() => {
                if (isSubmitting) return;
                void (setupTab === "create" ? handleCreateFamily() : handleJoinFamily());
              }}
            />
          </View>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Before you continue</Text>
          <View style={styles.bulletStack}>
            <Text style={styles.bulletText}>HomeThread will not show seeded or fake household data for signed-in accounts.</Text>
            <Text style={styles.bulletText}>You can always sign out and come back with another account later.</Text>
          </View>
        </Card>

        <Pressable
          onPress={() => {
            if (isSubmitting) return;
            void signOut().then(() => {
              setMode("welcome");
              setFamilyName("");
              setInviteCode("");
              setCreatedInviteCode(null);
              setFormMessage(null);
            });
          }}
          style={styles.linkButton}
        >
          <Text style={styles.link}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  if (mode === "login" || mode === "register") {
    const isRegister = mode === "register";

    return (
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => {
              setFormMessage(null);
              setMode("welcome");
            }}
            style={styles.backButton}
          >
            <Text style={styles.backLabel}>Back</Text>
          </Pressable>
        </View>
        <Pill label={isRegister ? "Create account" : "Welcome back"} tone="primary" icon="person-circle" />
        <Text style={styles.title}>{isRegister ? "Set up your HomeThread account" : "Sign in to your household"}</Text>
        <Text style={styles.subtitle}>
          {supabaseConfiguredOnClient
            ? "Use your real email and password. HomeThread will restore this session on the next app open."
            : "Supabase is not configured in this build, so real account sign-in is unavailable here."}
        </Text>

        <Card>
          {supabaseConfiguredOnClient ? (
            <>
              <PrimaryButton
                label={isSubmitting ? "Working..." : "Continue with Google"}
                icon="logo-google"
                tone="soft"
                onPress={() => {
                  if (isSubmitting) return;
                  void handleGoogleSignIn();
                }}
              />
              <Text style={styles.orLabel}>Or use email</Text>
            </>
          ) : null}
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
              label={isSubmitting ? "Working..." : isRegister ? "Create account" : "Sign in"}
              icon="arrow-forward"
              onPress={() => {
                if (isSubmitting || !supabaseConfiguredOnClient) return;
                void handlePasswordAuth(mode);
              }}
            />
          </View>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>What happens after sign-in</Text>
          <Text style={styles.cardText}>
            If your account is already linked to a family, HomeThread opens it right away. If not, you will create or join one next.
          </Text>
        </Card>

        <Pressable onPress={() => setMode(isRegister ? "login" : "register")} style={styles.linkButton}>
          <Text style={styles.link}>{isRegister ? "Already have an account?" : "Need an account?"}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[colors.surface, "#F2ECE3"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroRow}>
          <View style={styles.markWrap}>
            <Image source={require("../../assets/icon.png")} style={styles.mark} />
          </View>
          <View style={styles.heroCopy}>
            <Pill label="Built for real households" tone="primary" icon="home" />
            <Text style={styles.kicker}>HomeThread</Text>
            <Text style={styles.title}>A calm center for the home.</Text>
            <Text style={styles.subtitle}>
              Plans, chores, lists, meals, and family updates stay in one warm place instead of being scattered across texts.
            </Text>
          </View>
        </View>
      </LinearGradient>

      <Card>
        <Text style={styles.cardTitle}>What this should feel like</Text>
        <View style={styles.bulletStack}>
          <Text style={styles.bulletText}>A shared picture of today, next, and later without one person carrying the whole week in their head.</Text>
          <Text style={styles.bulletText}>Meal plans, errands, and chores that flow together naturally instead of getting copied between apps.</Text>
          <Text style={styles.bulletText}>A kid-friendly chore system that still feels grown-up when an adult is holding the phone.</Text>
        </View>
      </Card>

      {configurationWarning ? (
        <Card>
          <Text style={styles.warningTitle}>This build still needs secure sign-in</Text>
          <Text style={styles.configurationWarning}>{configurationWarning}</Text>
        </Card>
      ) : null}
      {authMessage && !configurationWarning ? <Text style={styles.formMessage}>{authMessage}</Text> : null}
      {formMessage ? <Text style={styles.formMessage}>{formMessage}</Text> : null}

      <SectionTitle title="Enter your household" />
      <Card>
        <View style={styles.entryStack}>
          {supabaseConfiguredOnClient && authMode !== "supabase" ? (
            <>
              <PrimaryButton
                label={isSubmitting ? "Working..." : "Continue with Google"}
                icon="logo-google"
                onPress={() => {
                  if (isSubmitting) return;
                  void handleGoogleSignIn();
                }}
              />
              <View style={styles.secondaryActions}>
                <PrimaryButton label="Create account" icon="person-add" tone="soft" onPress={() => setMode("register")} />
                <PrimaryButton label="Log in" icon="log-in" tone="ghost" onPress={() => setMode("login")} />
              </View>
            </>
          ) : null}
          {devTokenAvailable ? (
            <PrimaryButton
              label={isSubmitting ? "Working..." : "Use local dev token"}
              icon="key"
              tone="ghost"
              onPress={() => {
                if (isSubmitting) return;
                void handleDevTokenSignIn();
              }}
            />
          ) : null}
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Trust first</Text>
        <Text style={styles.cardText}>
          HomeThread only enters the main app after a real session or an explicit local dev-token sign-in. It does not pretend you are logged in.
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.md
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-start"
  },
  backButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: spacing.md
  },
  backLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700"
  },
  heroCard: {
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: "hidden",
    padding: spacing.md
  },
  heroRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  markWrap: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: radii.xl,
    height: 96,
    justifyContent: "center",
    width: 96
  },
  mark: {
    height: 76,
    width: 76
  },
  heroCopy: {
    flex: 1,
    gap: spacing.xs
  },
  kicker: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 38,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 44
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 30
  },
  cardText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm
  },
  bulletStack: {
    gap: spacing.md,
    marginTop: spacing.sm
  },
  bulletText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22
  },
  warningTitle: {
    color: colors.coral,
    fontFamily: fonts.display,
    fontSize: 21,
    fontWeight: "700",
    lineHeight: 26
  },
  inviteCode: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 2,
    marginTop: spacing.xs
  },
  setupTabs: {
    flexDirection: "row",
    gap: spacing.sm
  },
  setupTab: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  setupTabActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary
  },
  setupTabLabel: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center"
  },
  setupTabLabelActive: {
    color: colors.primary
  },
  entryStack: {
    gap: spacing.md,
    marginTop: spacing.sm
  },
  secondaryActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
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
    fontWeight: "700",
    marginBottom: spacing.xs,
    marginTop: spacing.md
  },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.lineStrong,
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
  orLabel: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: spacing.md,
    textAlign: "center",
    textTransform: "uppercase"
  },
  formMessage: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: spacing.md
  },
  configurationWarning: {
    color: colors.coral,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: spacing.sm
  },
  linkButton: {
    minHeight: 44,
    justifyContent: "center"
  },
  link: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center"
  }
});

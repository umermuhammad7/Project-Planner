import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Card, Pill, PrimaryButton } from "../components/Primitives";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { useAuthStore } from "../store/useAuthStore";
import { useScrollAssist } from "../context/ScrollAssistContext";
import { copyText } from "../utils/copyText";
import {
  clearHouseholdSetupIntent,
  readHouseholdSetupIntent,
  writeHouseholdSetupIntent,
  type HouseholdSetupIntent
} from "../utils/householdSetupIntent";

type Mode = "welcome" | "login" | "register" | "family-setup";
type SetupTab = "create" | "join";

export function WelcomeScreen({
  onSignedIn,
  onSetupChildDevice
}: {
  onSignedIn: () => void;
  onSetupChildDevice?: () => void;
}) {
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
  const scrollAssist = useScrollAssist();
  const [mode, setMode] = useState<Mode>("welcome");
  const [setupTab, setSetupTab] = useState<SetupTab>("create");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);
  const [preferredSetupTab, setPreferredSetupTab] = useState<SetupTab | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [createdInviteFeedback, setCreatedInviteFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWelcomeDetails, setShowWelcomeDetails] = useState(false);
  const [hasLeftFamilySetup, setHasLeftFamilySetup] = useState(false);
  const howItWorks = [
    {
      step: "1",
      title: "Start the household",
      text: "One adult creates the home and becomes the first admin."
    },
    {
      step: "2",
      title: "Choose the family tier",
      text: "One adult manages billing, and the rest of the household joins the same home."
    },
    {
      step: "3",
      title: "Add adults, then child profiles",
      text: "Other adults join with the adult invite code after signing in. Child profiles are added separately - kids never use that code."
    }
  ];
  const planRows = [
    {
      name: "Parents",
      price: "$5/mo",
      detail: "2 adults in one home",
      note: "Best for a couple or co-parents getting started."
    },
    {
      name: "Parents + 2 kids",
      price: "$10/mo",
      detail: "2 adults and up to 2 child profiles",
      note: "A clean fit for the most common family shape."
    },
    {
      name: "Parents + 4 kids",
      price: "$15/mo",
      detail: "2 adults and up to 4 child profiles",
      note: "A bigger household without turning pricing into custom math."
    },
    {
      name: "Unlimited + AI",
      price: "$50/mo",
      detail: "Unlimited child profiles with AI planning",
      note: "For large homes that want the full assistant experience."
    }
  ];
  const configurationWarning =
    !supabaseConfiguredOnClient && authMode !== "loading"
      ? "Account sign-in is not configured in this build yet."
      : null;
  const welcomeMessage = formMessage ?? (configurationWarning ? null : authMessage);
  const isSignedInNeedsHousehold =
    (authMode === "supabase" || authMode === "dev_token") && !familyId;

  function continueHouseholdSetup() {
    setHasLeftFamilySetup(false);
    setFormMessage(null);
    setMode("family-setup");
    if (preferredSetupTab) {
      setSetupTab(preferredSetupTab);
    }
  }

  async function handleWelcomeSignOut() {
    if (isSubmitting) {
      return;
    }

    await signOut();
    await clearHouseholdSetupIntent();
    setHasLeftFamilySetup(false);
    setMode("welcome");
    setPreferredSetupTab(null);
    setSetupTab("create");
    setFamilyName("");
    setInviteCode("");
    setCreatedInviteCode(null);
    setFormMessage(null);
  }

  useEffect(() => {
    scrollAssist.scrollToTop();
  }, [mode, scrollAssist]);

  useEffect(() => {
    void readHouseholdSetupIntent().then((intent) => {
      if (!intent) {
        return;
      }

      setPreferredSetupTab(intent);
      setSetupTab(intent);
    });
  }, []);

  useEffect(() => {
    const needsHousehold = authMode === "supabase" || authMode === "dev_token";
    if (needsHousehold && !familyId && mode === "welcome" && !hasLeftFamilySetup) {
      setMode("family-setup");
      if (preferredSetupTab) {
        setSetupTab(preferredSetupTab);
      }
    }
  }, [authMode, familyId, hasLeftFamilySetup, mode, preferredSetupTab]);

  async function applySetupIntent(intent: HouseholdSetupIntent) {
    setPreferredSetupTab(intent);
    setSetupTab(intent);
    await writeHouseholdSetupIntent(intent);
  }

  async function completeAuthFlow() {
    const liveFamilyId = useAuthStore.getState().familyId;

    if (liveFamilyId) {
      onSignedIn();
      return;
    }

    setHasLeftFamilySetup(false);
    setMode("family-setup");
    if (preferredSetupTab) {
      setSetupTab(preferredSetupTab);
    }
    setCreatedInviteCode(null);
    setFormMessage(null);
  }

  async function handlePasswordAuth(kind: "login" | "register") {
    if (!email.trim()) {
      setFormMessage("Enter your email.");
      return;
    }

    if (!password.trim()) {
      setFormMessage("Enter your password.");
      return;
    }

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

    await completeAuthFlow();
  }

  async function handleGoogleSignIn(intent?: HouseholdSetupIntent) {
    if (intent) {
      await applySetupIntent(intent);
    }

    setIsSubmitting(true);
    setFormMessage(null);
    const result = await signInWithGoogle();
    if (result.ok && Platform.OS === "web") {
      setFormMessage("Redirecting to Google sign-in...");
      return;
    }
    setIsSubmitting(false);

    if (!result.ok) {
      setFormMessage(result.message ?? "Google sign-in could not start.");
      return;
    }

    if (Platform.OS !== "web") {
      await completeAuthFlow();
    }
  }

  function beginJoinJourney() {
    setFormMessage(null);
    setEmail("");
    setPassword("");
    void applySetupIntent("join");
    if ((authMode === "supabase" || authMode === "dev_token") && !familyId) {
      setHasLeftFamilySetup(false);
      setSetupTab("join");
      setMode("family-setup");
      return;
    }
    setMode("login");
  }

  function beginCreateJourney() {
    setFormMessage(null);
    setEmail("");
    setPassword("");
    void applySetupIntent("create");
    if ((authMode === "supabase" || authMode === "dev_token") && !familyId) {
      setHasLeftFamilySetup(false);
      setSetupTab("create");
      setMode("family-setup");
      return;
    }
    setMode("register");
  }

  function beginLogin() {
    setFormMessage(null);
    setMode("login");
  }

  async function handleCopyCreatedInvite() {
    if (!createdInviteCode) {
      return;
    }

    const result = await copyText(createdInviteCode);
    setCreatedInviteFeedback(result.ok ? "Adult invite code copied." : (result.message ?? "Could not copy automatically."));
  }

  async function handleCreateFamily() {
    if (!familyName.trim()) {
      setFormMessage("Enter a household name.");
      return;
    }

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

    await clearHouseholdSetupIntent();
    onSignedIn();
  }

  async function handleJoinFamily() {
    if (!inviteCode.trim()) {
      setFormMessage("Enter the adult invite code.");
      return;
    }

    setIsSubmitting(true);
    setFormMessage(null);

    const result = await joinFamily(inviteCode);
    setIsSubmitting(false);

    if (!result.ok) {
      setFormMessage(result.message ?? "Could not join that family.");
      return;
    }

    await clearHouseholdSetupIntent();
    onSignedIn();
  }

  if (mode === "family-setup") {
    if (createdInviteCode) {
      return (
        <View style={styles.screen}>
          <Pill label="Household created" tone="primary" icon="home" />
          <Text style={styles.title}>Your family is ready.</Text>
          <Text style={styles.subtitle}>Share this adult invite code when the second parent is ready to join.</Text>

          <Card>
            <Text style={styles.cardTitle}>Adult invite code</Text>
            <Text selectable style={styles.inviteCode}>
              {createdInviteCode}
            </Text>
            <Text style={styles.cardText}>
              The second parent signs in, chooses Join with adult invite code, and enters this code. Kids never use it.
            </Text>
            <View style={styles.formActions}>
              <PrimaryButton label="Copy code" icon="copy" tone="soft" onPress={() => void handleCopyCreatedInvite()} />
            </View>
            {createdInviteFeedback ? <Text style={styles.formMessage}>{createdInviteFeedback}</Text> : null}
          </Card>

          <View style={styles.actions}>
            <PrimaryButton
              label="Enter HomeThread"
              icon="home"
              onPress={() => {
                void clearHouseholdSetupIntent();
                onSignedIn();
              }}
            />
          </View>
        </View>
      );
    }

    return (
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => {
              setHasLeftFamilySetup(true);
              setMode("welcome");
            }}
            style={styles.backButton}
          >
            <Text style={styles.backLabel}>Back</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>Set up your household</Text>
        <Text style={styles.subtitle}>
          {preferredSetupTab === "create" || (!preferredSetupTab && setupTab === "create")
            ? "Name your home. You become admin and get an adult invite code for the second adult."
            : preferredSetupTab === "join" || setupTab === "join"
              ? "Enter the adult invite code from the household owner."
              : "Create a new home or join with an adult invite code."}
        </Text>

        <Card>
          <View style={styles.setupTabs}>
            <Pressable
              onPress={() => {
                void applySetupIntent("create");
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
                void applySetupIntent("join");
                setFormMessage(null);
              }}
              style={[styles.setupTab, setupTab === "join" ? styles.setupTabActive : null]}
            >
              <Text style={[styles.setupTabLabel, setupTab === "join" ? styles.setupTabLabelActive : null]}>
                Join household
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
              <Text style={styles.helperTextCompact}>
                You become the admin and get an adult invite code for the second parent.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.label}>Adult invite code</Text>
              <TextInput
                style={styles.input}
                autoCapitalize="characters"
                placeholder="HT2026"
                placeholderTextColor={colors.muted}
                value={inviteCode}
                onChangeText={setInviteCode}
              />
              <Text style={styles.helperTextCompact}>Ask the household admin for their adult invite code. Kids never join this way.</Text>
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

        <Pressable
          onPress={() => {
            if (isSubmitting) return;
            void signOut().then(() => {
              void clearHouseholdSetupIntent();
              setHasLeftFamilySetup(false);
              setMode("welcome");
              setPreferredSetupTab(null);
              setSetupTab("create");
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
    const joiningHousehold = preferredSetupTab === "join";
    const creatingHousehold = preferredSetupTab === "create";
    const googleLabel = isSubmitting ? "Working..." : "Continue with Google";

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
        {joiningHousehold ? <Pill label="Joining a household" tone="mint" icon="key" /> : null}
        {creatingHousehold && isRegister ? <Pill label="Creating a household" tone="primary" icon="home" /> : null}
        <Text style={styles.title}>{isRegister ? "Create your account" : "Welcome back"}</Text>
        <Text style={styles.subtitle}>
          {isRegister
            ? creatingHousehold
              ? "Sign in first. On the next screen you will name the household and get an adult invite code."
              : "Start with your own sign-in, then create or join the household."
            : joiningHousehold
              ? "Sign in first. On the next screen, enter the adult invite code."
              : "Sign in and pick up where the household left off."}
        </Text>

        <Card>
          {supabaseConfiguredOnClient ? (
            <>
              <PrimaryButton
                label={googleLabel}
                icon="logo-google"
                onPress={() => {
                  if (isSubmitting) return;
                  if (joiningHousehold) {
                    void handleGoogleSignIn("join");
                    return;
                  }
                  if (creatingHousehold && isRegister) {
                    void handleGoogleSignIn("create");
                    return;
                  }
                  void handleGoogleSignIn();
                }}
              />
              {joiningHousehold ? (
                <Text style={styles.helperTextCompact}>
                  After Google sign-in, you will enter the adult invite code - not a child profile.
                </Text>
              ) : creatingHousehold && isRegister ? (
                <Text style={styles.helperTextCompact}>
                  After Google sign-in, you will create the household and receive an adult invite code.
                </Text>
              ) : null}
              <Text style={styles.helperTextCompact}>iPhone may show a secure sign-in prompt before the Google account chooser opens.</Text>
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

        <Pressable onPress={() => setMode(isRegister ? "login" : "register")} style={styles.linkButton}>
          <Text style={styles.link}>{isRegister ? "Already have an account?" : "Need an account?"}</Text>
        </Pressable>
        {!isRegister ? (
          <Pressable onPress={beginJoinJourney} style={styles.linkButton}>
            <Text style={styles.link}>Joining with an adult invite code?</Text>
          </Pressable>
        ) : null}
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
            <Text style={styles.kicker}>HomeThread</Text>
            <Text style={styles.welcomeTitle}>Keep the day moving together.</Text>
            <Text style={styles.welcomeSubtitle}>Plans, chores, meals, and AI in one calm home.</Text>
          </View>
        </View>
      </LinearGradient>

      {configurationWarning ? (
        <Card>
          <Text style={styles.warningTitle}>Sign-in is not ready yet</Text>
          <Text style={styles.configurationWarning}>{configurationWarning}</Text>
        </Card>
      ) : null}
      {welcomeMessage ? <Text style={styles.formMessage}>{welcomeMessage}</Text> : null}

      <Card>
        <Text style={styles.cardTitle}>{isSignedInNeedsHousehold ? "Finish household setup" : "Get started"}</Text>
        <View style={styles.entryStack}>
          {isSignedInNeedsHousehold ? (
            <>
              <Text style={styles.helperTextCompact}>
                You are signed in. Create or join a household to open the planner.
              </Text>
              <PrimaryButton
                label="Continue household setup"
                icon="home"
                tone="primary"
                onPress={continueHouseholdSetup}
              />
              {onSetupChildDevice ? (
                <PrimaryButton
                  label="Set up child's device"
                  icon="phone-portrait"
                  tone="ghost"
                  onPress={onSetupChildDevice}
                />
              ) : null}
              <Pressable onPress={() => void handleWelcomeSignOut()} style={styles.linkButton}>
                <Text style={styles.link}>Sign out</Text>
              </Pressable>
            </>
          ) : supabaseConfiguredOnClient && authMode !== "supabase" && authMode !== "dev_token" ? (
            <>
              <PrimaryButton label="Create household" icon="home" tone="primary" onPress={beginCreateJourney} />
              <PrimaryButton label="Join household" icon="key" tone="soft" onPress={beginJoinJourney} />
              {onSetupChildDevice ? (
                <PrimaryButton
                  label="Set up child's device"
                  icon="phone-portrait"
                  tone="ghost"
                  onPress={onSetupChildDevice}
                />
              ) : null}
              <Text style={styles.helperTextCompact}>
                Adults use an invite code. Kids pair with KC- on their own phone.
              </Text>
              <Pressable onPress={beginLogin} style={styles.loginLinkButton}>
                <Text style={styles.loginLead}>Already have an account?</Text>
                <Text style={styles.loginLink}>Log in</Text>
              </Pressable>
            </>
          ) : null}
          {devTokenAvailable ? (
            <View style={styles.devSection}>
              <Text style={styles.devLabel}>Developer access</Text>
              <PrimaryButton
                label={isSubmitting ? "Working..." : "Use dev token"}
                icon="key"
                tone="ghost"
                onPress={() => {
                  if (isSubmitting) return;
                  void handleDevTokenSignIn();
                }}
              />
            </View>
          ) : null}
        </View>
      </Card>

      <Pressable
        accessibilityRole="button"
        onPress={() => setShowWelcomeDetails((value) => !value)}
        style={styles.detailsToggle}
      >
        <Text style={styles.detailsToggleLabel}>
          {showWelcomeDetails ? "Hide details" : "How it works"}
        </Text>
      </Pressable>

      {showWelcomeDetails ? (
        <>
          <Text style={styles.helperTextCompact}>
            Second adult? Sign in, then choose Join with adult invite code. Child profiles are added later in Household - kids never use that code.
          </Text>
          <Card>
            <Text style={styles.cardTitle}>How it works</Text>
            <View style={styles.stepStack}>
              {howItWorks.map((item) => (
                <View key={item.step} style={styles.stepRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{item.step}</Text>
                  </View>
                  <View style={styles.stepCopy}>
                    <Text style={styles.stepTitle}>{item.title}</Text>
                    <Text style={styles.stepText}>{item.text}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>

          <Card>
            <View style={styles.pricingHeader}>
              <Text style={styles.cardTitle}>Future household plans</Text>
              <Pill label="Preview" tone="gold" icon="card" />
            </View>
            <Text style={styles.helperTextCompact}>
              Preview build - billing coming soon. No payment is required or collected in this build.
            </Text>
            <View style={styles.planStack}>
              {planRows.map((plan) => (
                <View key={plan.name} style={styles.planRow}>
                  <View style={styles.planMeta}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <Text style={styles.planDetail}>{plan.detail}</Text>
                  </View>
                  <Text style={styles.planPrice}>{plan.price}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.helperFootnote}>Planned tiers for launch. Purchases are not live in this preview.</Text>
          </Card>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.md,
    minWidth: 0,
    width: "100%"
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
    maxWidth: "100%",
    overflow: "hidden",
    padding: spacing.md
  },
  heroRow: {
    alignItems: "flex-start",
    gap: spacing.sm
  },
  heroFeatureRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.lg
  },
  heroFeature: {
    backgroundColor: "rgba(255,255,255,0.55)",
    borderColor: "rgba(139,107,74,0.12)",
    borderRadius: radii.lg,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: 96,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  heroFeatureValue: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800"
  },
  heroFeatureLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 2
  },
  markWrap: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: radii.lg,
    height: 64,
    justifyContent: "center",
    width: 64
  },
  mark: {
    height: 52,
    width: 52
  },
  heroCopy: {
    flexShrink: 1,
    gap: spacing.xs,
    minWidth: 0
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
  welcomeTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 32
  },
  welcomeSubtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22
  },
  trustNote: {
    color: colors.tertiary,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    marginTop: spacing.md
  },
  detailsToggle: {
    gap: spacing.xs,
    minHeight: 44,
    justifyContent: "center"
  },
  detailsToggleLabel: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700"
  },
  detailsToggleMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18
  },
  devSection: {
    borderColor: colors.line,
    borderTopWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.md
  },
  devLabel: {
    color: colors.tertiary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase"
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
  helperTextCompact: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: spacing.sm
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
  pathBlock: {
    gap: spacing.xs
  },
  pathLabel: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  secondaryActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  loginLinkButton: {
    alignItems: "center",
    gap: 4,
    minHeight: 44,
    justifyContent: "center"
  },
  loginLead: {
    color: colors.tertiary,
    fontSize: 13,
    fontWeight: "600"
  },
  loginLink: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "800"
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
  pricingHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  pricingCopy: {
    flex: 1
  },
  planStack: {
    gap: spacing.sm,
    marginTop: spacing.md
  },
  stepStack: {
    gap: spacing.md,
    marginTop: spacing.md
  },
  stepRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md
  },
  stepBadge: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  stepBadgeText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900"
  },
  stepCopy: {
    flex: 1,
    gap: 2
  },
  stepTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800"
  },
  stepText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19
  },
  planRow: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  planMeta: {
    flex: 1,
    gap: 2
  },
  planName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800"
  },
  planDetail: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18
  },
  planPrice: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "900"
  },
  helperFootnote: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: spacing.md
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

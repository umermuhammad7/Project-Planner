import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";

import { Card, Pill, PrimaryButton } from "../components/Primitives";
import { ScreenHeader } from "../components/ScreenHeader";
import { HOW_IT_WORKS_SLIDES } from "../constants/howItWorks";
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

type Mode = "welcome" | "auth" | "family-setup";
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
    signInWithGoogle,
    signInWithApple,
    signInWithDevToken,
    createFamily,
    joinFamily,
    signOut
  } = useAuthStore();
  const scrollAssist = useScrollAssist();
  const [mode, setMode] = useState<Mode>("welcome");
  const [setupTab, setSetupTab] = useState<SetupTab>("create");
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);
  const [preferredSetupTab, setPreferredSetupTab] = useState<SetupTab | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [createdInviteFeedback, setCreatedInviteFeedback] = useState<string | null>(null);
  const [createdHadExistingHousehold, setCreatedHadExistingHousehold] = useState(false);
  const [joinedExistingMemberOf, setJoinedExistingMemberOf] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(true);
  const [howItWorksStep, setHowItWorksStep] = useState(0);
  const [hasLeftFamilySetup, setHasLeftFamilySetup] = useState(false);
  const [howItWorksRailWidth, setHowItWorksRailWidth] = useState(0);
  const howItWorksScrollRef = useRef<ScrollView>(null);
  const howItWorksAnim = useRef(new Animated.Value(0)).current;
  const { width: windowWidth } = useWindowDimensions();
  const howItWorksPageWidth = Math.max(
    howItWorksRailWidth > 0
      ? howItWorksRailWidth
      : windowWidth - spacing.xl * 2 - spacing.md * 2 - spacing.sm * 2,
    220
  );
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

  function playHowItWorksEntrance() {
    howItWorksAnim.setValue(0);
    Animated.timing(howItWorksAnim, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true
    }).start();
  }

  function handleHowItWorksScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextIndex = Math.round(
      event.nativeEvent.contentOffset.x / Math.max(howItWorksPageWidth, 1)
    );
    if (
      nextIndex !== howItWorksStep &&
      nextIndex >= 0 &&
      nextIndex < HOW_IT_WORKS_SLIDES.length
    ) {
      setHowItWorksStep(nextIndex);
    }
  }

  function revealHowItWorks() {
    setShowHowItWorks(true);
    setHowItWorksStep(0);
    playHowItWorksEntrance();
    requestAnimationFrame(() => {
      howItWorksScrollRef.current?.scrollTo({ x: 0, animated: false });
    });
  }

  useEffect(() => {
    if (showHowItWorks) {
      playHowItWorksEntrance();
    }
  }, []);

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
    setCreatedHadExistingHousehold(false);
    setJoinedExistingMemberOf(null);
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
    setCreatedHadExistingHousehold(false);
    setJoinedExistingMemberOf(null);
    setFormMessage(null);
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

  async function handleAppleSignIn(intent?: HouseholdSetupIntent) {
    if (intent) {
      await applySetupIntent(intent);
    }

    setIsSubmitting(true);
    setFormMessage(null);
    const result = await signInWithApple();
    setIsSubmitting(false);

    if (!result.ok) {
      if (result.message) {
        setFormMessage(result.message);
      }
      return;
    }

    await completeAuthFlow();
  }

  function beginJoinJourney() {
    setFormMessage(null);
    void applySetupIntent("join");
    if ((authMode === "supabase" || authMode === "dev_token") && !familyId) {
      setHasLeftFamilySetup(false);
      setSetupTab("join");
      setMode("family-setup");
      return;
    }
    setMode("auth");
  }

  function beginCreateJourney() {
    setFormMessage(null);
    void applySetupIntent("create");
    if ((authMode === "supabase" || authMode === "dev_token") && !familyId) {
      setHasLeftFamilySetup(false);
      setSetupTab("create");
      setMode("family-setup");
      return;
    }
    setMode("auth");
  }

  function beginLogin() {
    setFormMessage(null);
    setPreferredSetupTab(null);
    void clearHouseholdSetupIntent();
    setMode("auth");
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
      setCreatedHadExistingHousehold(Boolean(result.hadExistingHousehold));
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

    if (result.alreadyMember) {
      setJoinedExistingMemberOf(result.familyName ?? "this household");
      return;
    }

    await clearHouseholdSetupIntent();
    onSignedIn();
  }

  if (mode === "family-setup") {
    if (joinedExistingMemberOf) {
      return (
        <View style={styles.screen}>
          <Pill label="Already a member" tone="mint" icon="key" />
          <Text style={styles.title}>You're already in.</Text>
          <Text style={styles.subtitle}>
            This sign-in is already an adult member of {joinedExistingMemberOf}.
          </Text>

          <Card>
            <Text style={styles.cardText}>
              Each adult should use their own Google, Apple, or email account — that's how HomeThread keeps chores,
              plans, and reminders attributed to the right person. If you meant to join as a different adult, sign
              out and sign back in with that person's own account instead.
            </Text>
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

    if (createdInviteCode) {
      return (
        <View style={styles.screen}>
          <Pill label="Household created" tone="primary" icon="home" />
          <Text style={styles.title}>
            {createdHadExistingHousehold ? "You're now connected to two households." : "Your family is ready."}
          </Text>
          <Text style={styles.subtitle}>
            {createdHadExistingHousehold
              ? "This sign-in was already an adult member of another household. HomeThread allows this for caregivers, co-parents, and family helpers. Make sure each other adult still joins with their own Google, Apple, or email account."
              : "Share this adult invite code when the second parent is ready to join."}
          </Text>

          <Card>
            <Text style={styles.cardTitle}>Adult invite code</Text>
            <Text selectable style={styles.inviteCode}>
              {createdInviteCode}
            </Text>
            <Text style={styles.cardText}>
              The second parent signs in with their own Google, Apple, or email account, then enters this code. Kids
              never use this code — they pair their own device with a separate child pairing code instead.
            </Text>
            {createdHadExistingHousehold ? (
              <Text style={styles.helperTextCompact}>
                You're now admin of this new household and still a member of your other household.
              </Text>
            ) : null}
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

  if (mode === "auth") {
    const joiningHousehold = preferredSetupTab === "join";
    const creatingHousehold = preferredSetupTab === "create";
    const googleLabel = isSubmitting ? "Working..." : "Continue with Google";

    return (
      <View style={styles.screen}>
        <ScreenHeader
          badgeLabel={joiningHousehold ? "🔑 Joining a household" : creatingHousehold ? "🏠 Creating a household" : undefined}
          badgeTone={joiningHousehold ? "mint" : "primary"}
          title={creatingHousehold ? "Create account" : "Welcome back"}
          subtitle={
            creatingHousehold
              ? "Sign in first. On the next screen you will name the household and get an adult invite code."
              : joiningHousehold
                ? "Sign in first. On the next screen, enter the adult invite code."
                : "Sign in and pick up where the household left off."
          }
          subtitleLines={3}
          actionLabel="Back"
          actionIcon="chevron-back"
          onActionPress={() => {
            setFormMessage(null);
            setMode("welcome");
          }}
          density="compact"
        />

        <Card>
          {supabaseConfiguredOnClient ? (
            <>
              <View style={styles.authButtonStack}>
                <PrimaryButton
                  label={googleLabel}
                  icon="logo-google"
                  tone="sky"
                  onPress={() => {
                    if (isSubmitting) return;
                    if (joiningHousehold) {
                      void handleGoogleSignIn("join");
                      return;
                    }
                    if (creatingHousehold) {
                      void handleGoogleSignIn("create");
                      return;
                    }
                    void handleGoogleSignIn();
                  }}
                />
                {Platform.OS === "ios" ? (
                  <PrimaryButton
                    label={isSubmitting ? "Working..." : "Continue with Apple"}
                    icon="logo-apple"
                    tone="dark"
                    onPress={() => {
                      if (isSubmitting) return;
                      if (joiningHousehold) {
                        void handleAppleSignIn("join");
                        return;
                      }
                      if (creatingHousehold) {
                        void handleAppleSignIn("create");
                        return;
                      }
                      void handleAppleSignIn();
                    }}
                  />
                ) : null}
              </View>
              {joiningHousehold ? (
                <Text style={styles.helperTextCompact}>
                  After signing in, you'll enter the adult invite code from the household admin. Use your own
                  account here, not someone else's — kids never sign in this way, they pair a device with a
                  separate child pairing code.
                </Text>
              ) : creatingHousehold ? (
                <Text style={styles.helperTextCompact}>
                  After signing in, you'll create the household and receive an adult invite code to share. Each
                  adult should sign in with their own account, not this same one, so chores and plans stay
                  attributed to the right person.
                </Text>
              ) : null}
              <Text style={styles.helperTextCompact}>iPhone may show a secure sign-in prompt before the Google account chooser opens.</Text>
            </>
          ) : (
            <Text style={styles.helperTextCompact}>Account sign-in is not configured in this build yet.</Text>
          )}
          {formMessage ? <Text style={styles.formMessage}>{formMessage}</Text> : null}
        </Card>

        {joiningHousehold ? (
          <Pressable onPress={beginCreateJourney} style={styles.linkButton}>
            <Text style={styles.link}>Setting up a brand new household instead?</Text>
          </Pressable>
        ) : !creatingHousehold ? (
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
            <Text style={styles.welcomeTitle} numberOfLines={1} adjustsFontSizeToFit>
              Keep the day moving together.
            </Text>
            <Text style={styles.welcomeSubtitle}>Plans, chores, meals, and AI in one calm home.</Text>
          </View>
        </View>

        {showHowItWorks ? (
          <Animated.View
            style={[
              styles.howItWorksShell,
              {
                opacity: howItWorksAnim,
                transform: [
                  {
                    translateY: howItWorksAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0]
                    })
                  }
                ]
              }
            ]}
          >
            <View style={styles.howItWorksHeader}>
              <View style={styles.howItWorksHeaderCopy}>
                <Text style={styles.howItWorksLabel}>How it works</Text>
                <Text style={styles.howItWorksHint}>Swipe to see how HomeThread works.</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Hide how it works"
                hitSlop={8}
                onPress={() => setShowHowItWorks(false)}
                style={({ pressed }) => [styles.howItWorksHide, pressed && styles.howItWorksHidePressed]}
              >
                <Text style={styles.howItWorksHideText}>Hide</Text>
                <Ionicons name="chevron-up" size={14} color={colors.muted} />
              </Pressable>
            </View>
            <View
              onLayout={(event) => {
                const nextWidth = Math.round(event.nativeEvent.layout.width);
                if (nextWidth > 0 && nextWidth !== howItWorksRailWidth) {
                  setHowItWorksRailWidth(nextWidth);
                }
              }}
              style={styles.howItWorksTrack}
            >
              <ScrollView
                ref={howItWorksScrollRef}
                horizontal
                pagingEnabled
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleHowItWorksScroll}
                style={{ width: howItWorksPageWidth }}
              >
                {HOW_IT_WORKS_SLIDES.map((slide) => (
                  <View
                    key={slide.title}
                    style={[
                      styles.howItWorksSlide,
                      { width: howItWorksPageWidth, backgroundColor: slide.accentSoft }
                    ]}
                  >
                    <View style={[styles.howItWorksIconTile, { backgroundColor: colors.surface }]}>
                      <Ionicons name={slide.icon} size={20} color={slide.accent} />
                    </View>
                    <View style={styles.howItWorksSlideCopy}>
                      <Text style={styles.howItWorksSlideTitle}>{slide.title}</Text>
                      <Text style={styles.howItWorksSlideBody} numberOfLines={2}>
                        {slide.body}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
            <View style={styles.howItWorksFooter}>
              <View style={styles.howItWorksDots}>
                {HOW_IT_WORKS_SLIDES.map((slide, index) => (
                  <View
                    key={slide.title}
                    style={[styles.howItWorksDot, index === howItWorksStep && styles.howItWorksDotActive]}
                  />
                ))}
              </View>
              <Text style={styles.howItWorksStepIndex}>
                {howItWorksStep + 1}/{HOW_IT_WORKS_SLIDES.length}
              </Text>
            </View>
          </Animated.View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show how it works"
            onPress={revealHowItWorks}
            style={({ pressed }) => [styles.howItWorksReveal, pressed && styles.howItWorksRevealPressed]}
          >
            <Text style={styles.howItWorksRevealText}>How it works</Text>
            <Text style={styles.howItWorksRevealMeta}>Quick tour</Text>
          </Pressable>
        )}
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
              <View style={styles.quickActionsGrid}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Create household"
                  onPress={beginCreateJourney}
                  style={({ pressed }) => [
                    styles.quickActionTile,
                    styles.quickActionTilePrimary,
                    pressed && styles.quickActionTilePressed
                  ]}
                >
                  <View style={styles.quickActionEmojiWrap}>
                    <Text style={styles.quickActionEmoji}>🏠</Text>
                  </View>
                  <Text style={styles.quickActionTitle}>Create household</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Join household"
                  onPress={beginJoinJourney}
                  style={({ pressed }) => [
                    styles.quickActionTile,
                    styles.quickActionTileSoft,
                    pressed && styles.quickActionTilePressed
                  ]}
                >
                  <View style={styles.quickActionEmojiWrap}>
                    <Text style={styles.quickActionEmoji}>🔑</Text>
                  </View>
                  <Text style={styles.quickActionTitle}>Join household</Text>
                </Pressable>
              </View>
              {onSetupChildDevice ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Set up child's device"
                  onPress={onSetupChildDevice}
                  style={({ pressed }) => [styles.quickActionWide, pressed && styles.quickActionTilePressed]}
                >
                  <View style={styles.quickActionEmojiWrap}>
                    <Text style={styles.quickActionEmoji}>📱</Text>
                  </View>
                  <Text style={styles.quickActionTitle}>Set up child's device</Text>
                  <View style={styles.quickActionSpacer} />
                  <Ionicons color={colors.tertiary} name="chevron-forward" size={18} />
                </Pressable>
              ) : null}
              <Text style={styles.helperTextCompact}>
                Adults use an invite code. Kids pair with a child pairing code on their own phone.
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

      <Text style={styles.helperFootnote}>Private and invite-only — built for one household at a time.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.sm,
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
    gap: spacing.sm,
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
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: radii.lg,
    height: 80,
    justifyContent: "center",
    width: 80
  },
  mark: {
    height: 64,
    width: 64
  },
  heroCopy: {
    alignItems: "center",
    alignSelf: "stretch",
    flexShrink: 1,
    gap: spacing.xs,
    minWidth: 0
  },
  kicker: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
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
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 25,
    textAlign: "center"
  },
  welcomeSubtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center"
  },
  trustNote: {
    color: colors.tertiary,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    marginTop: spacing.md
  },
  howItWorksShell: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    gap: spacing.xs,
    marginTop: spacing.xs,
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  howItWorksTrack: {
    alignSelf: "stretch",
    width: "100%"
  },
  howItWorksHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between"
  },
  howItWorksHeaderCopy: {
    flex: 1,
    gap: 1,
    minWidth: 0
  },
  howItWorksLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  howItWorksHide: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 28,
    justifyContent: "center",
    paddingHorizontal: spacing.xs
  },
  howItWorksHidePressed: {
    opacity: 0.72
  },
  howItWorksHideText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  howItWorksHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16
  },
  howItWorksSlide: {
    alignItems: "center",
    borderRadius: radii.sm,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 64,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  howItWorksIconTile: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  howItWorksSlideCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  howItWorksStepIndex: {
    color: colors.tertiary,
    fontSize: 11,
    fontWeight: "700"
  },
  howItWorksSlideTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20
  },
  howItWorksSlideBody: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17
  },
  howItWorksFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2
  },
  howItWorksDots: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs
  },
  howItWorksDot: {
    backgroundColor: "rgba(139,107,74,0.22)",
    borderRadius: radii.pill,
    height: 6,
    width: 6
  },
  howItWorksDotActive: {
    backgroundColor: colors.primary,
    width: 14
  },
  howItWorksReveal: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  howItWorksRevealPressed: {
    opacity: 0.72
  },
  howItWorksRevealText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700"
  },
  howItWorksRevealMeta: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "600"
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
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  authButtonStack: {
    gap: spacing.sm
  },
  quickActionsGrid: {
    flexDirection: "row",
    gap: spacing.sm
  },
  quickActionTile: {
    alignItems: "center",
    borderRadius: radii.lg,
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  quickActionTilePrimary: {
    backgroundColor: colors.primarySoft
  },
  quickActionTileSoft: {
    backgroundColor: colors.mintSoft
  },
  quickActionTilePressed: {
    opacity: 0.88
  },
  quickActionEmojiWrap: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  quickActionEmoji: {
    fontSize: 19
  },
  quickActionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20
  },
  quickActionWide: {
    alignItems: "center",
    backgroundColor: colors.coralSoft,
    borderRadius: radii.lg,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  quickActionSpacer: {
    flex: 1
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
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    textAlign: "center"
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

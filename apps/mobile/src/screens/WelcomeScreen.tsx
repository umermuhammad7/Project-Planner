import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Card, Pill, PrimaryButton, SectionTitle } from "../components/Primitives";
import { colors, radii, spacing } from "../constants/theme";
import { useAuthStore } from "../store/useAuthStore";

type Mode = "welcome" | "login" | "register" | "family-setup";
type SetupTab = "create" | "join";

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
          <Pill label="Family created" tone="primary" />
          <Text style={styles.title}>Share your invite code</Text>
          <Text style={styles.subtitle}>
            Other adults can join this household with the code below. Email invites are not wired in this build.
          </Text>
          <Card>
            <Text style={styles.label}>Invite code</Text>
            <Text style={styles.inviteCode}>{createdInviteCode}</Text>
            <Text style={styles.cardText}>
              You are the first admin member. HomeThread will load your new household after you continue.
            </Text>
          </Card>
          <View style={styles.actions}>
            <PrimaryButton label="Enter HomeThread" icon="home" onPress={onSignedIn} />
          </View>
        </View>
      );
    }

    return (
      <View style={styles.screen}>
        <Pill label="Household setup" tone="primary" />
        <Text style={styles.title}>Create or join a family</Text>
        <Text style={styles.subtitle}>
          Signed-in accounts need a real family membership before HomeThread can load household data.
        </Text>
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
        <Card>
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
              <Text style={styles.cardText}>
                You will become the first admin member of this household.
              </Text>
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
                Ask a family admin for their invite code. Joining links your account to that household.
              </Text>
            </>
          )}
          {formMessage ? <Text style={styles.formMessage}>{formMessage}</Text> : null}
          <View style={styles.formActions}>
            <PrimaryButton
              label={
                isSubmitting
                  ? "Working..."
                  : setupTab === "create"
                    ? "Create family"
                    : "Join family"
              }
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
          {supabaseConfiguredOnClient ? " · Supabase client configured" : " · Supabase client missing"}
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
  }
});

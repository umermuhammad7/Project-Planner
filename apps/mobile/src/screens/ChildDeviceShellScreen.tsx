import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View
} from "react-native";

import { ActionFeedback } from "../components/ActionFeedback";
import { Card, ModuleTile, Pill } from "../components/Primitives";
import { RewardCelebrationBanner, useRewardCelebration } from "../components/RewardCelebration";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { useChildDeviceStore } from "../store/useChildDeviceStore";
import { FamilyMember } from "../types";
import { computeRewardProgress } from "../utils/rewardProgress";
import { safeMemberInitials } from "../utils/safeRender";

type ChildDeviceShellPreviewSession = {
  familyName: string;
  memberId: string;
  memberName: string;
  avatarUrl: string | null;
  starBalance: number;
};

type ChildDeviceShellPreviewChore = {
  id: string;
  title: string;
  dueTime: string | null;
  stars: number;
  completed: boolean;
};

type ChildDeviceShellScreenProps = {
  previewSession?: ChildDeviceShellPreviewSession;
  previewChores?: ChildDeviceShellPreviewChore[];
  previewMode?: boolean;
  exitHintVisible?: boolean;
};

export function ChildDeviceShellScreen({
  previewSession,
  previewChores,
  previewMode = false,
  exitHintVisible = false
}: ChildDeviceShellScreenProps = {}) {
  const storedSession = useChildDeviceStore((state) => state.session);
  const storedChores = useChildDeviceStore((state) => state.chores);
  const storedIsSaving = useChildDeviceStore((state) => state.isSaving);
  const completeChore = useChildDeviceStore((state) => state.completeChore);
  const uploadAvatar = useChildDeviceStore((state) => state.uploadAvatar);
  const refresh = useChildDeviceStore((state) => state.refresh);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "error">("success");
  const [avatarImageFailed, setAvatarImageFailed] = useState(false);
  const [previewCompletedIds, setPreviewCompletedIds] = useState<Set<string>>(() => new Set());
  const [activeModule, setActiveModule] = useState<"stars" | "chores" | null>("chores");
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);
  const { celebration, scale: celebrationScale, opacity: celebrationOpacity, triggerCelebration } =
    useRewardCelebration();
  const session = previewSession ?? storedSession;
  const chores = useMemo(
    () =>
      (previewChores ?? storedChores).map((chore) =>
        previewCompletedIds.has(chore.id) ? { ...chore, completed: true } : chore
      ),
    [previewChores, previewCompletedIds, storedChores]
  );
  const isSaving = previewMode ? false : storedIsSaving;
  const rewardProgress = useMemo(() => computeRewardProgress(session?.starBalance ?? 0), [session?.starBalance]);

  const member = useMemo<FamilyMember | null>(() => {
    if (!session) {
      return null;
    }

    return {
      id: session.memberId,
      name: session.memberName,
      initials: safeMemberInitials(session.memberName),
      role: "kid",
      color: colors.gold,
      starBalance: session.starBalance
    };
  }, [session]);
  const avatarSource = useMemo(
    () => (session?.avatarUrl ? { uri: session.avatarUrl, cache: "reload" as const } : null),
    [session?.avatarUrl]
  );

  const openChores = useMemo(() => chores.filter((chore) => !chore.completed), [chores]);
  const doneChores = useMemo(() => chores.filter((chore) => chore.completed), [chores]);

  useEffect(() => {
    if (!previewMode) {
      void refresh();
    }
  }, [previewMode, refresh]);

  useEffect(() => {
    if (!statusMessage) {
      return;
    }

    const timer = setTimeout(() => setStatusMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    setAvatarImageFailed(false);
  }, [session?.avatarUrl]);

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  function toggleModule(module: "stars" | "chores") {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveModule((current) => (current === module ? null : module));
  }

  if (!session || !member) {
    return null;
  }

  async function handleChangePhoto() {
    if (previewMode) {
      setStatusTone("success");
      setStatusMessage("Photo upload is disabled in this local preview.");
      return;
    }

    if (isPickingPhoto) {
      return;
    }

    setIsPickingPhoto(true);
    try {
      const ImagePicker = await import("expo-image-picker");
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setStatusTone("error");
        setStatusMessage("Allow photo library access before choosing a profile photo.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.78,
        base64: true
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.base64) {
        setStatusTone("error");
        setStatusMessage("HomeThread could not read that photo for upload.");
        return;
      }

      const uploadResult = await uploadAvatar(asset.base64, asset.mimeType ?? "image/jpeg");
      setStatusTone(uploadResult.ok ? "success" : "error");
      setStatusMessage(uploadResult.message);
    } catch {
      setStatusTone("error");
      setStatusMessage("Could not open your photo library right now. Try again in a moment.");
    } finally {
      setIsPickingPhoto(false);
    }
  }

  async function handleCompleteChore(choreId: string, stars: number) {
    if (previewMode) {
      setPreviewCompletedIds((current) => new Set(current).add(choreId));
      setStatusTone("success");
      setStatusMessage("Preview chore completed.");
      triggerCelebration(stars);
      return;
    }

    const result = await completeChore(choreId);
    setStatusTone(result.ok ? "success" : "error");
    setStatusMessage(result.message);
    if (result.ok) {
      triggerCelebration(stars);
    }
  }

  return (
    <View style={styles.root}>
      <Card>
        <View style={styles.heroPanel}>
          <View style={styles.heroCopy}>
            <Text style={styles.greeting}>{member.name}</Text>
            <Text style={styles.heroNote}>{session.familyName} · kids mode only</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change your profile photo"
              disabled={isSaving || isPickingPhoto}
              onPress={() => {
                void handleChangePhoto();
              }}
              style={({ pressed }) =>
                [styles.photoAction, pressed && !isSaving && !isPickingPhoto ? styles.photoActionPressed : null]
              }
            >
              <Text style={styles.photoActionEmoji}>📷</Text>
              <Text style={styles.photoActionText}>
                {isSaving ? "Uploading..." : isPickingPhoto ? "Opening..." : "Change your photo"}
              </Text>
            </Pressable>
            {exitHintVisible ? (
              <Text style={styles.exitHint}>Keep holding the lock to unpair this device. Ask a parent for a new KC- code to pair again.</Text>
            ) : null}
          </View>
          <View style={styles.avatarShell}>
            {avatarSource && !avatarImageFailed ? (
              <Image source={avatarSource} style={styles.avatarImage} onError={() => setAvatarImageFailed(true)} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>{safeMemberInitials(member.name)}</Text>
              </View>
            )}
            <View style={styles.avatarBadge}>
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              )}
            </View>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, styles.summaryCardGold]}>
            <Text style={styles.summaryLabel}>Stars</Text>
            <Text style={styles.summaryValue}>{session.starBalance}</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryCardPrimary]}>
            <Text style={styles.summaryLabel}>Open chores</Text>
            <Text style={styles.summaryValue}>{openChores.length}</Text>
          </View>
        </View>

        <View style={styles.moduleRow}>
          <ModuleTile
            emoji="⭐"
            tone="gold"
            label="Stars"
            meta={`${session.starBalance} earned`}
            active={activeModule === "stars"}
            onPress={() => toggleModule("stars")}
          />
          <ModuleTile
            emoji="✅"
            tone="mint"
            label="Chores"
            meta={`${openChores.length} open`}
            active={activeModule === "chores"}
            onPress={() => toggleModule("chores")}
          />
        </View>
      </Card>

      <RewardCelebrationBanner celebration={celebration} scale={celebrationScale} opacity={celebrationOpacity} />

      <ActionFeedback message={statusMessage ?? ""} tone={statusTone} visible={Boolean(statusMessage)} />

      {activeModule === "stars" ? (
        <Card>
          <View style={styles.moduleCardHeader}>
            <Text style={styles.moduleCardTitle}>Stars</Text>
            <Text style={styles.moduleCardMeta}>{session.starBalance} total</Text>
          </View>
          <LinearGradient
            colors={rewardProgress.distance === 0 ? ["#FFE8B0", "#FFD37A"] : [colors.goldSoft, "#FFF6E4"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.rewardPanel}
          >
            <Text style={styles.rewardEmoji}>{rewardProgress.distance === 0 ? "🏆" : "⭐"}</Text>
            <Text style={styles.rewardHeadline}>
              {rewardProgress.distance === 0
                ? "Reward ready!"
                : `${rewardProgress.distance} more star${rewardProgress.distance === 1 ? "" : "s"} to go`}
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${rewardProgress.progress}%` }]} />
            </View>
            <View style={styles.progressLabels}>
              <Text style={styles.progressLabel}>Now</Text>
              <Text style={styles.progressLabel}>Next reward at {rewardProgress.nextTarget}</Text>
            </View>
          </LinearGradient>
        </Card>
      ) : null}

      {activeModule === "chores" ? (
        <Card>
          <View style={styles.moduleCardHeader}>
            <Text style={styles.moduleCardTitle}>Chores to do</Text>
            <Text style={styles.moduleCardMeta}>{openChores.length} left</Text>
          </View>
          <View style={styles.choreStack}>
            {openChores.length > 0 ? (
              openChores.map((chore) => (
                <View key={chore.id} style={styles.choreCard}>
                  <View style={styles.choreHeader}>
                    <View style={styles.choreCopy}>
                      <Text style={styles.choreTitle}>{chore.title}</Text>
                      <Text style={styles.choreMeta}>{chore.dueTime ? `Due ${chore.dueTime}` : "Today"}</Text>
                    </View>
                    <Pill label={`+${chore.stars} stars`} tone="gold" icon="star" />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Mark ${chore.title} done`}
                    disabled={isSaving}
                    onPress={() => {
                      void handleCompleteChore(chore.id, chore.stars);
                    }}
                    style={({ pressed }) => [styles.doneButton, pressed && styles.doneButtonPressed]}
                  >
                    <Ionicons name="checkmark-circle" size={26} color="#FFFFFF" />
                    <Text style={styles.doneButtonText}>{isSaving ? "Saving..." : "Done!"}</Text>
                  </Pressable>
                </View>
              ))
            ) : (
              <View>
                <Text style={styles.emptyTitle}>All done for now</Text>
                <Text style={styles.emptyText}>Nice work. Check back if a grown-up adds more chores.</Text>
              </View>
            )}
          </View>

          {doneChores.length > 0 ? (
            <>
              <View style={[styles.moduleCardHeader, styles.moduleSubHeader]}>
                <Text style={styles.moduleCardTitle}>Finished today</Text>
                <Text style={styles.moduleCardMeta}>{doneChores.length} done</Text>
              </View>
              <View style={styles.doneStack}>
                {doneChores.map((chore) => (
                  <View key={chore.id} style={styles.doneRow}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.mint} />
                    <Text style={styles.doneChoreTitle}>{chore.title}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm
  },
  heroPanel: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  heroCopy: {
    flex: 1,
    gap: spacing.xs
  },
  photoAction: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  photoActionPressed: {
    opacity: 0.84
  },
  photoActionEmoji: {
    fontSize: 13
  },
  photoActionText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800"
  },
  greeting: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 30,
    fontWeight: "700",
    lineHeight: 36
  },
  heroNote: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21
  },
  exitHint: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    marginTop: spacing.xs
  },
  avatarShell: {
    position: "relative"
  },
  avatarImage: {
    borderColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 72,
    width: 72
  },
  avatarFallback: {
    alignItems: "center",
    backgroundColor: colors.goldSoft,
    borderColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 72,
    justifyContent: "center",
    width: 72
  },
  avatarFallbackText: {
    color: colors.gold,
    fontSize: 24,
    fontWeight: "900"
  },
  avatarBadge: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 2,
    bottom: -2,
    height: 28,
    justifyContent: "center",
    position: "absolute",
    right: -2,
    width: 28
  },
  summaryGrid: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg
  },
  summaryCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    padding: spacing.md
  },
  summaryCardGold: {
    backgroundColor: colors.goldSoft,
    borderColor: "rgba(193,125,60,0.24)"
  },
  summaryCardPrimary: {
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(139,107,74,0.16)"
  },
  moduleRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  moduleCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md
  },
  moduleSubHeader: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.md
  },
  moduleCardTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "700"
  },
  moduleCardMeta: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  rewardPanel: {
    alignItems: "center",
    borderRadius: radii.lg,
    padding: spacing.lg
  },
  rewardEmoji: {
    fontSize: 36,
    marginBottom: spacing.xs
  },
  rewardHeadline: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center"
  },
  progressTrack: {
    alignSelf: "stretch",
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: radii.pill,
    height: 10,
    marginTop: spacing.md,
    overflow: "hidden"
  },
  progressFill: {
    backgroundColor: colors.gold,
    borderRadius: radii.pill,
    height: "100%"
  },
  progressLabels: {
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm
  },
  progressLabel: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "700"
  },
  summaryLabel: {
    color: colors.tertiary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  summaryValue: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34
  },
  choreStack: {
    gap: spacing.md
  },
  choreCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg
  },
  choreHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  choreCopy: {
    flex: 1
  },
  choreTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 24
  },
  choreMeta: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2
  },
  doneButton: {
    alignItems: "center",
    backgroundColor: colors.mint,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 56,
    paddingVertical: spacing.md
  },
  doneButtonPressed: {
    opacity: 0.9
  },
  doneButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900"
  },
  doneStack: {
    gap: spacing.xs
  },
  doneRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    opacity: 0.75,
    paddingVertical: spacing.sm
  },
  doneChoreTitle: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "800",
    textDecorationLine: "line-through"
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: spacing.sm
  }
});

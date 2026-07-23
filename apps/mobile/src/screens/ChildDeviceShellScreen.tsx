import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { ActionFeedback } from "../components/ActionFeedback";
import { Card, Pill, SectionTitle } from "../components/Primitives";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { useChildDeviceStore } from "../store/useChildDeviceStore";
import { FamilyMember } from "../types";
import { safeMemberInitials } from "../utils/safeRender";

export function ChildDeviceShellScreen() {
  const session = useChildDeviceStore((state) => state.session);
  const chores = useChildDeviceStore((state) => state.chores);
  const isSaving = useChildDeviceStore((state) => state.isSaving);
  const completeChore = useChildDeviceStore((state) => state.completeChore);
  const uploadAvatar = useChildDeviceStore((state) => state.uploadAvatar);
  const unpair = useChildDeviceStore((state) => state.unpair);
  const refresh = useChildDeviceStore((state) => state.refresh);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "error">("success");
  const [exitHintVisible, setExitHintVisible] = useState(false);
  const [avatarImageFailed, setAvatarImageFailed] = useState(false);

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
    void refresh();
  }, [refresh]);

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

  if (!session || !member) {
    return null;
  }

  async function handleChangePhoto() {
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
  }

  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
        <Pill label="Child device" tone="gold" icon="phone-portrait" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hold to unpair this device"
          delayLongPress={900}
          onLongPress={() => {
            void unpair();
          }}
          onPress={() => setExitHintVisible(true)}
          style={({ pressed }) => [styles.exitChip, pressed && styles.exitChipPressed]}
        >
          <Ionicons name="lock-closed" size={14} color={colors.ink} />
          <Text style={styles.exitChipText}>Hold to unpair</Text>
        </Pressable>
      </View>

      <Card>
        <View style={styles.heroPanel}>
          <View style={styles.heroCopy}>
            <Text style={styles.greeting}>{member.name}</Text>
            <Text style={styles.heroNote}>{session.familyName} · kids mode only</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change your profile photo"
              disabled={isSaving}
              onPress={() => {
                void handleChangePhoto();
              }}
              style={({ pressed }) => [styles.photoAction, pressed && !isSaving ? styles.photoActionPressed : null]}
            >
              <Ionicons name="camera" size={14} color={colors.primary} />
              <Text style={styles.photoActionText}>{isSaving ? "Uploading..." : "Change your photo"}</Text>
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
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Stars</Text>
            <Text style={styles.summaryValue}>{session.starBalance}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Open chores</Text>
            <Text style={styles.summaryValue}>{openChores.length}</Text>
          </View>
        </View>
      </Card>

      <SectionTitle title="Chores to do" action={`${openChores.length} left`} />
      <ActionFeedback message={statusMessage ?? ""} tone={statusTone} visible={Boolean(statusMessage)} />
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
                  void (async () => {
                    const result = await completeChore(chore.id);
                    setStatusTone(result.ok ? "success" : "error");
                    setStatusMessage(result.message);
                  })();
                }}
                style={({ pressed }) => [styles.doneButton, pressed && styles.doneButtonPressed]}
              >
                <Ionicons name="checkmark-circle" size={26} color="#FFFFFF" />
                <Text style={styles.doneButtonText}>{isSaving ? "Saving..." : "Done!"}</Text>
              </Pressable>
            </View>
          ))
        ) : (
          <Card>
            <Text style={styles.emptyTitle}>All done for now</Text>
            <Text style={styles.emptyText}>Nice work. Check back if a grown-up adds more chores.</Text>
          </Card>
        )}
      </View>

      {doneChores.length > 0 ? (
        <>
          <SectionTitle title="Finished today" action={`${doneChores.length} done`} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.lg
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  exitChip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  exitChipPressed: {
    opacity: 0.84
  },
  exitChipText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800"
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
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    padding: spacing.md
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

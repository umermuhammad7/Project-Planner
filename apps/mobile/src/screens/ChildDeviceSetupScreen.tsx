import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionFeedback } from "../components/ActionFeedback";
import { Card, Pill, PrimaryButton } from "../components/Primitives";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { useChildDeviceStore } from "../store/useChildDeviceStore";

type PairingPreview = {
  pairingCode: string;
  expiresAt: string;
  family: { id: string; name: string };
  member: { id: string; displayName: string };
};

function formatPairingExpiry(expiresAt: string) {
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) {
    return "Expiry unknown";
  }

  const minutesLeft = Math.max(0, Math.round((expiry.getTime() - Date.now()) / 60000));
  if (minutesLeft <= 0) {
    return "This code has expired. Ask a parent for a fresh KC- code.";
  }

  const timeLabel = expiry.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return minutesLeft < 60
    ? `Code expires in about ${minutesLeft} min (${timeLabel})`
    : `Code expires ${expiry.toLocaleString([], { dateStyle: "short", timeStyle: "short" })}`;
}

export function ChildDeviceSetupScreen({ onPaired, onBack }: { onPaired: () => void; onBack: () => void }) {
  const previewPairingCode = useChildDeviceStore((state) => state.previewPairingCode);
  const pairWithCode = useChildDeviceStore((state) => state.pairWithCode);
  const isSaving = useChildDeviceStore((state) => state.isSaving);
  const [pairingCode, setPairingCode] = useState("");
  const [preview, setPreview] = useState<PairingPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            if (preview) {
              setPreview(null);
              setErrorMessage(null);
              return;
            }
            onBack();
          }}
          style={styles.backButton}
        >
          <Text style={styles.backLabel}>{preview ? "Edit code" : "Back"}</Text>
        </Pressable>
      </View>

      <Pill label="Child device" tone="gold" icon="phone-portrait" />
      <Text style={styles.title}>{preview ? "Confirm pairing" : "Pair this device"}</Text>
      <Text style={styles.subtitle}>
        {preview
          ? "Check the household and child profile before pairing this phone."
          : "Enter the KC- code from Household. One phone per child - pairing again replaces the old device."}
      </Text>

      {!preview ? (
        <Card>
          <Text style={styles.label}>Child pairing code</Text>
          <TextInput
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="KC-ABC123"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={pairingCode}
            onChangeText={(value) => {
              setPairingCode(value.toUpperCase());
              setErrorMessage(null);
            }}
          />
          <Text style={styles.helper}>
            Codes expire in about 15 minutes. If this phone was replaced, ask a parent for a fresh code.
          </Text>
          <View style={styles.actions}>
            <PrimaryButton
              label={isSaving ? "Checking..." : "Continue"}
              icon="arrow-forward"
              loading={isSaving}
              disabled={isSaving || pairingCode.trim().length < 4}
              onPress={() => {
                void (async () => {
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  const result = await previewPairingCode(pairingCode);
                  if (!result.ok || !result.preview) {
                    setErrorMessage(result.message ?? "Could not look up that pairing code.");
                    return;
                  }

                  setPreview(result.preview);
                })();
              }}
            />
          </View>
        </Card>
      ) : (
        <Card>
          <Text style={styles.confirmTitle}>Pair this phone to:</Text>
          <Text style={styles.confirmHousehold}>{preview.family.name}</Text>
          <Text style={styles.confirmChild}>{preview.member.displayName}</Text>
          <Text style={styles.helper}>{formatPairingExpiry(preview.expiresAt)}</Text>
          <Text style={styles.helper}>
            If this is not the right child, go back and ask a parent for the correct KC- code.
          </Text>
          <View style={styles.confirmActions}>
            <PrimaryButton
              label="Go back"
              icon="arrow-back"
              tone="soft"
              disabled={isSaving}
              onPress={() => {
                setPreview(null);
                setErrorMessage(null);
              }}
            />
            <PrimaryButton
              label={isSaving ? "Pairing..." : "Pair this device"}
              icon="link"
              loading={isSaving}
              disabled={isSaving}
              onPress={() => {
                void (async () => {
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  const result = await pairWithCode(preview.pairingCode);
                  if (!result.ok) {
                    setErrorMessage(result.message ?? "Could not pair this device.");
                    return;
                  }

                  setSuccessMessage("Device paired. Opening child view...");
                  onPaired();
                })();
              }}
            />
          </View>
        </Card>
      )}

      <ActionFeedback message={successMessage ?? ""} tone="success" visible={Boolean(successMessage)} />
      <ActionFeedback message={errorMessage ?? ""} tone="error" visible={Boolean(errorMessage)} />

      {!preview ? (
        <Card>
          <Text style={styles.noticeTitle}>QR scan</Text>
          <Text style={styles.noticeText}>QR pairing is planned. Enter the KC- code manually for now.</Text>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.md
  },
  topBar: {
    flexDirection: "row"
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
  title: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 34,
    fontWeight: "700",
    lineHeight: 40
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: spacing.xs
  },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1,
    minHeight: 52,
    paddingHorizontal: spacing.md
  },
  helper: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: spacing.sm
  },
  actions: {
    marginTop: spacing.lg
  },
  confirmTitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  confirmHousehold: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
    marginTop: spacing.xs
  },
  confirmChild: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: "800",
    marginTop: spacing.xs
  },
  confirmActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg
  },
  noticeTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800"
  },
  noticeText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    marginTop: spacing.xs
  }
});

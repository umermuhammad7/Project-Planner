import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionFeedback } from "../components/ActionFeedback";
import { Card, Pill, PrimaryButton } from "../components/Primitives";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { useChildDeviceStore } from "../store/useChildDeviceStore";

export function ChildDeviceSetupScreen({ onPaired, onBack }: { onPaired: () => void; onBack: () => void }) {
  const pairWithCode = useChildDeviceStore((state) => state.pairWithCode);
  const isSaving = useChildDeviceStore((state) => state.isSaving);
  const [pairingCode, setPairingCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
      </View>

      <Pill label="Child device" tone="gold" icon="phone-portrait" />
      <Text style={styles.title}>Pair this device</Text>
      <Text style={styles.subtitle}>
        Enter the KC- code from Household. One phone per child - pairing again replaces the old device.
      </Text>

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
            label={isSaving ? "Pairing..." : "Pair device"}
            icon="link"
            loading={isSaving}
            disabled={isSaving}
            onPress={() => {
              void (async () => {
                setErrorMessage(null);
                setSuccessMessage(null);
                const result = await pairWithCode(pairingCode);
                if (!result.ok) {
                  setErrorMessage(result.message ?? "Could not pair this device.");
                  return;
                }

                setSuccessMessage("Device paired. Opening Kids mode...");
                onPaired();
              })();
            }}
          />
        </View>
      </Card>

      <ActionFeedback message={successMessage ?? ""} tone="success" visible={Boolean(successMessage)} />
      <ActionFeedback message={errorMessage ?? ""} tone="error" visible={Boolean(errorMessage)} />

      <Card>
        <Text style={styles.noticeTitle}>QR scan</Text>
        <Text style={styles.noticeText}>QR pairing is planned. Enter the KC- code manually for now.</Text>
      </Card>
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

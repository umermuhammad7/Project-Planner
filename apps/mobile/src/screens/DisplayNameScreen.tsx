import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { Card, PrimaryButton } from "../components/Primitives";
import { ScreenHeader } from "../components/ScreenHeader";
import { colors, radii, spacing } from "../constants/theme";
import { useAuthStore } from "../store/useAuthStore";

export function DisplayNameScreen() {
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleContinue() {
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMessage("Enter the name you'd like your household to see.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    const result = await updateProfile({ displayName: trimmed });
    setIsSubmitting(false);

    if (!result.ok) {
      setErrorMessage(result.message ?? "Could not save your name. Try again.");
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        eyebrow="One last thing"
        title="What should we call you?"
        subtitle="This is the name your household will see on greetings, chores, and plans."
        icon="person-circle-outline"
      />

      <Card>
        <Text style={styles.label}>Your name</Text>
        <TextInput
          autoFocus
          maxLength={80}
          onChangeText={(value) => {
            setName(value);
            if (errorMessage) {
              setErrorMessage(null);
            }
          }}
          onSubmitEditing={() => void handleContinue()}
          placeholder="e.g. Umar"
          placeholderTextColor={colors.muted}
          returnKeyType="done"
          style={styles.input}
          value={name}
        />
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        <View style={styles.formActions}>
          <PrimaryButton
            label={isSubmitting ? "Saving..." : "Continue"}
            icon="checkmark"
            loading={isSubmitting}
            onPress={() => void handleContinue()}
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.sm,
    minWidth: 0,
    width: "100%"
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
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: spacing.md
  },
  errorText: {
    color: colors.coral,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: spacing.sm
  },
  formActions: {
    marginTop: spacing.lg
  }
});

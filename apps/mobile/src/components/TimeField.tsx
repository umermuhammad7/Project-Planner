import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radii, spacing } from "../constants/theme";

function parseTimeValue(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/u.exec(value.trim());
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function formatTimeValue(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatDisplayTime(value: string) {
  const parsed = parseTimeValue(value);
  if (!parsed) {
    return value;
  }

  return parsed.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

const webInputStyle = {
  backgroundColor: colors.surfaceRaised,
  border: `1px solid ${colors.lineStrong}`,
  borderRadius: radii.md,
  color: colors.ink,
  fontSize: 16,
  marginTop: spacing.sm,
  minHeight: 52,
  padding: `${spacing.md}px`
};

export function TimeField({
  label,
  value,
  onChange,
  placeholder = "Choose a time"
}: {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerValue = useMemo(() => parseTimeValue(value) ?? new Date(), [value]);

  if (Platform.OS === "web") {
    return (
      <View>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <input
          aria-label={label ?? "Time"}
          type="time"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          style={webInputStyle}
        />
        <Text style={styles.helper}>Use the picker or type a 24-hour time like 17:30.</Text>
      </View>
    );
  }

  function handlePickerChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === "android") {
      setShowPicker(false);
    }

    if (event.type === "dismissed" || !date) {
      if (Platform.OS === "ios") {
        setShowPicker(false);
      }
      return;
    }

    onChange(formatTimeValue(date));
    if (Platform.OS === "ios") {
      setShowPicker(false);
    }
  }

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ?? "Select time"}
        onPress={() => setShowPicker(true)}
        style={styles.trigger}
      >
        <Text style={[styles.triggerText, !value && styles.placeholderText]}>
          {value ? formatDisplayTime(value) : placeholder}
        </Text>
      </Pressable>
      <Text style={styles.helper}>Tap to choose a time.</Text>
      {showPicker ? (
        <DateTimePicker mode="time" value={pickerValue} onChange={handlePickerChange} display="default" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: spacing.sm
  },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    marginTop: spacing.sm,
    padding: spacing.md
  },
  trigger: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    padding: spacing.md
  },
  triggerText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "600"
  },
  placeholderText: {
    color: colors.muted,
    fontWeight: "500"
  },
  helper: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: spacing.xs
  }
});

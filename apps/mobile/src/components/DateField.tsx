import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing } from "../constants/theme";

function parseDateValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value.trim());
  if (!match) {
    return null;
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: string) {
  const parsed = parseDateValue(value);
  if (!parsed) {
    return value;
  }

  return parsed.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric"
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

export function DateField({
  label,
  value,
  onChange
}: {
  label?: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerValue = useMemo(() => parseDateValue(value) ?? new Date(), [value]);

  if (Platform.OS === "web") {
    return (
      <View>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <input
          aria-label={label ?? "Date"}
          type="date"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          style={webInputStyle}
        />
        <Text style={styles.helper}>Tap to open a calendar and pick the day.</Text>
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

    onChange(formatDateValue(date));
    if (Platform.OS === "ios") {
      setShowPicker(false);
    }
  }

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ?? "Select date"}
        onPress={() => setShowPicker(true)}
        style={styles.trigger}
      >
        <Text style={[styles.triggerText, !value && styles.placeholderText]}>
          {value ? formatDisplayDate(value) : "Choose a day"}
        </Text>
      </Pressable>
      <Text style={styles.helper}>Tap to open the date picker.</Text>
      {showPicker ? (
        <DateTimePicker mode="date" value={pickerValue} onChange={handlePickerChange} display="default" />
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

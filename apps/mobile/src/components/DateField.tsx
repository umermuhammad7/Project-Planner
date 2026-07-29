import Ionicons from "@expo/vector-icons/Ionicons";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useMemo, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";

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
  backgroundColor: colors.canvas,
  border: `1px solid ${colors.lineStrong}`,
  borderRadius: radii.md,
  boxSizing: "border-box" as const,
  color: colors.ink,
  fontSize: 14,
  fontWeight: "500",
  marginTop: 0,
  minHeight: 40,
  padding: "8px 12px",
  width: "100%"
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
  const [draftDate, setDraftDate] = useState(() => parseDateValue(value) ?? new Date());
  const pickerValue = useMemo(() => parseDateValue(value) ?? new Date(), [value]);

  if (Platform.OS === "web") {
    return (
      <View style={styles.field}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <input
          aria-label={label ?? "Date"}
          type="date"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          style={webInputStyle}
        />
      </View>
    );
  }

  function openPicker() {
    setDraftDate(parseDateValue(value) ?? new Date());
    setShowPicker(true);
  }

  function handlePickerChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === "android") {
      setShowPicker(false);
      if (event.type === "dismissed" || !date) {
        return;
      }
      onChange(formatDateValue(date));
      return;
    }

    if (event.type === "dismissed" || !date) {
      return;
    }

    setDraftDate(date);
  }

  const trigger = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? "Select date"}
      onPress={openPicker}
      style={({ pressed }) => [
        styles.trigger,
        value ? styles.triggerFilled : null,
        pressed && styles.triggerPressed
      ]}
    >
      <Text style={[styles.triggerText, !value && styles.placeholderText]} numberOfLines={1}>
        {value ? formatDisplayDate(value) : "Choose a date"}
      </Text>
      <Ionicons name="calendar-outline" size={16} color={value ? colors.primary : colors.tertiary} />
    </Pressable>
  );

  if (Platform.OS === "ios") {
    return (
      <View style={styles.field}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        {trigger}
        <Modal animationType="fade" transparent visible={showPicker} onRequestClose={() => setShowPicker(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Choose a date</Text>
              <DateTimePicker mode="date" value={draftDate} onChange={handlePickerChange} display="inline" />
              <View style={styles.modalActions}>
                <Pressable onPress={() => setShowPicker(false)} style={styles.modalButtonGhost}>
                  <Text style={styles.modalButtonGhostLabel}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    onChange(formatDateValue(draftDate));
                    setShowPicker(false);
                  }}
                  style={styles.modalButton}
                >
                  <Text style={styles.modalButtonLabel}>Done</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {trigger}
      {showPicker ? (
        <DateTimePicker mode="date" value={pickerValue} onChange={handlePickerChange} display="default" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 6
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.1
  },
  trigger: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  triggerFilled: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary
  },
  triggerPressed: {
    opacity: 0.85
  },
  triggerText: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: "600"
  },
  placeholderText: {
    color: colors.muted,
    fontWeight: "500"
  },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(22, 18, 12, 0.28)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: radii.lg,
    padding: spacing.md,
    width: "100%"
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: spacing.sm
  },
  modalActions: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.md
  },
  modalButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  modalButtonLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800"
  },
  modalButtonGhost: {
    borderRadius: radii.pill,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  modalButtonGhostLabel: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700"
  }
});

import Ionicons from "@expo/vector-icons/Ionicons";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useMemo, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";

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
  backgroundColor: colors.canvas,
  border: `1px solid ${colors.lineStrong}`,
  borderRadius: radii.md,
  boxSizing: "border-box" as const,
  color: colors.ink,
  fontSize: 15,
  fontWeight: "500",
  marginTop: 0,
  minHeight: 44,
  padding: "10px 14px",
  width: "100%"
};

export function TimeField({
  label,
  value,
  onChange,
  placeholder = "Anytime"
}: {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [draftTime, setDraftTime] = useState(() => parseTimeValue(value) ?? new Date());
  const pickerValue = useMemo(() => parseTimeValue(value) ?? new Date(), [value]);

  if (Platform.OS === "web") {
    return (
      <View style={styles.field}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <input
          aria-label={label ?? "Time"}
          type="time"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          style={webInputStyle}
        />
      </View>
    );
  }

  function openPicker() {
    setDraftTime(parseTimeValue(value) ?? new Date());
    setShowPicker(true);
  }

  function handlePickerChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === "android") {
      setShowPicker(false);
      if (event.type === "dismissed" || !date) {
        return;
      }
      onChange(formatTimeValue(date));
      return;
    }

    if (event.type === "dismissed" || !date) {
      return;
    }

    setDraftTime(date);
  }

  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ?? "Select time"}
        onPress={openPicker}
        style={({ pressed }) => [
          styles.trigger,
          value ? styles.triggerFilled : null,
          pressed && styles.triggerPressed
        ]}
      >
        <Text style={[styles.triggerText, !value && styles.placeholderText]} numberOfLines={1}>
          {value ? formatDisplayTime(value) : placeholder}
        </Text>
        <Ionicons name="time-outline" size={16} color={value ? colors.primary : colors.tertiary} />
      </Pressable>
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear time"
          onPress={() => onChange("")}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          style={({ pressed }) => [styles.clearHit, pressed && styles.clearHitPressed]}
        >
          <Text style={styles.clearText}>Clear time</Text>
        </Pressable>
      ) : null}
      {Platform.OS === "ios" ? (
        <Modal animationType="fade" transparent visible={showPicker} onRequestClose={() => setShowPicker(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Choose a time</Text>
              <DateTimePicker mode="time" value={draftTime} onChange={handlePickerChange} display="spinner" />
              <View style={styles.modalActions}>
                <Pressable onPress={() => setShowPicker(false)} style={styles.modalButtonGhost}>
                  <Text style={styles.modalButtonGhostLabel}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    onChange(formatTimeValue(draftTime));
                    setShowPicker(false);
                  }}
                  style={styles.modalButton}
                >
                  <Text style={styles.modalButtonLabel}>Set time</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : showPicker ? (
        <DateTimePicker mode="time" value={pickerValue} onChange={handlePickerChange} display="default" />
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
  clearHit: {
    alignSelf: "flex-start",
    paddingVertical: 2
  },
  clearHitPressed: {
    opacity: 0.65
  },
  clearText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600"
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

import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Card, Pill, PrimaryButton, Row, SectionTitle } from "../components/Primitives";
import { colors, radii, spacing } from "../constants/theme";
import { useHomeThreadStore } from "../store/useHomeThreadStore";
import { MealType } from "../types";

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const mealTypes: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export function MealsScreen() {
  const { meals, mealWeekStart, createMeal, isSaving, saveMessage, syncSource, syncMessage } = useHomeThreadStore();
  const [title, setTitle] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [mealType, setMealType] = useState<MealType>("dinner");
  const canSave = useMemo(() => title.trim().length > 0, [title]);

  const grouped = useMemo(() => {
    return dayLabels.map((label, index) => ({
      label,
      items: meals.filter((meal) => meal.dayOfWeek === index)
    }));
  }, [meals]);

  return (
    <View>
      <Text style={styles.title}>Meals</Text>
      <Text style={styles.subtitle}>Keep the week visible so dinner stops turning into a 5 p.m. surprise.</Text>

      <View style={styles.statusRow}>
        <Pill
          label={syncSource === "api" ? "Local backend connected" : "Prototype mode"}
          tone={syncSource === "api" ? "primary" : "neutral"}
        />
        <Text style={styles.syncNote}>Week of {mealWeekStart} â€¢ {syncMessage}</Text>
      </View>
      <Text style={styles.statusText}>{isSaving ? "Saving..." : saveMessage}</Text>

      <Card>
        <Text style={styles.formTitle}>Add meal</Text>
        <TextInput
          accessibilityLabel="Meal title"
          placeholder="e.g. Turkey tacos"
          placeholderTextColor={colors.muted}
          value={title}
          onChangeText={setTitle}
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (!canSave || isSaving) return;
            void createMeal({ dayOfWeek, mealType, title }).then((ok) => {
              if (ok) setTitle("");
            });
          }}
        />
        <Text style={styles.pickerLabel}>Day</Text>
        <View style={styles.pickerRow}>
          {dayLabels.map((label, index) => {
            const selected = index === dayOfWeek;
            return (
              <Pressable key={label} accessibilityRole="button" onPress={() => setDayOfWeek(index)}>
                <Pill label={label} tone={selected ? "primary" : "neutral"} />
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.pickerLabel}>Meal type</Text>
        <View style={styles.pickerRow}>
          {mealTypes.map((type) => {
            const selected = type === mealType;
            return (
              <Pressable key={type} accessibilityRole="button" onPress={() => setMealType(type)}>
                <Pill label={type} tone={selected ? "mint" : "neutral"} />
              </Pressable>
            );
          })}
        </View>
        <View style={styles.formActions}>
          <PrimaryButton
            label={isSaving ? "Saving..." : "Save meal"}
            icon="restaurant"
            onPress={() => {
              if (!canSave || isSaving) return;
              void createMeal({ dayOfWeek, mealType, title }).then((ok) => {
                if (ok) setTitle("");
              });
            }}
          />
        </View>
      </Card>

      {grouped.map((group) => (
        <View key={group.label}>
          <SectionTitle title={group.label} action={`${group.items.length} planned`} />
          {group.items.length === 0 ? (
            <Card>
              <Text style={styles.emptyText}>Nothing planned yet.</Text>
            </Card>
          ) : (
            <View style={styles.stack}>
              {group.items.map((item) => (
                <Card key={item.id}>
                  <Row align="flex-start">
                    <View style={styles.badgeWrap}>
                      <Pill label={item.mealType} tone="gold" />
                    </View>
                    <View style={styles.fill}>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      <Text style={styles.itemMeta}>{item.notes ?? "Ready for the week"}</Text>
                    </View>
                  </Row>
                </Card>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md
  },
  syncNote: {
    color: colors.muted,
    flex: 1,
    fontSize: 12,
    fontWeight: "800"
  },
  statusText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    marginTop: spacing.sm
  },
  formTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: spacing.md
  },
  input: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    padding: spacing.md
  },
  pickerLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
    marginTop: spacing.md
  },
  pickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  formActions: {
    marginTop: spacing.lg
  },
  stack: {
    gap: spacing.md
  },
  badgeWrap: {
    paddingTop: 2
  },
  fill: {
    flex: 1
  },
  itemTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  itemMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700"
  }
});

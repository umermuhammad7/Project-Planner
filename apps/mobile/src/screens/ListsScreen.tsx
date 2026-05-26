import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card, Pill, Row, SectionTitle } from "../components/Primitives";
import { colors, spacing } from "../constants/theme";
import { useHomeThreadStore } from "../store/useHomeThreadStore";

export function ListsScreen() {
  const { shoppingItems, members, toggleShoppingItem } = useHomeThreadStore();
  const grouped = shoppingItems.reduce<Record<string, typeof shoppingItems>>((groups, item) => {
    groups[item.category] = [...(groups[item.category] ?? []), item];
    return groups;
  }, {});

  return (
    <View>
      <Text style={styles.title}>Lists</Text>
      <Text style={styles.subtitle}>Groceries and errands that survive the jump between app and family texts.</Text>

      {Object.entries(grouped).map(([category, items]) => (
        <View key={category}>
          <SectionTitle title={category} />
          <View style={styles.stack}>
            {items.map((item) => {
              const addedBy = members.find((member) => member.id === item.addedBy)?.name ?? "Family";
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: item.checked }}
                  accessibilityLabel={`${item.checked ? "Uncheck" : "Check"} ${item.title}`}
                  onPress={() => toggleShoppingItem(item.id)}
                >
                  <Card>
                    <Row>
                      <View style={[styles.box, item.checked && styles.boxDone]}>
                        {item.checked ? <Ionicons name="checkmark" size={18} color="#FFFFFF" /> : null}
                      </View>
                      <View style={styles.fill}>
                        <Text style={[styles.itemTitle, item.checked && styles.doneText]}>{item.title}</Text>
                        <Text style={styles.meta}>Added by {addedBy}</Text>
                      </View>
                      {item.category === "Inbox" ? <Pill label="from text" tone="coral" /> : null}
                    </Row>
                  </Card>
                </Pressable>
              );
            })}
          </View>
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
  stack: {
    gap: spacing.md
  },
  fill: {
    flex: 1
  },
  box: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 2,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  boxDone: {
    backgroundColor: colors.mint,
    borderColor: colors.mint
  },
  itemTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  doneText: {
    color: colors.muted,
    textDecorationLine: "line-through"
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2
  }
});

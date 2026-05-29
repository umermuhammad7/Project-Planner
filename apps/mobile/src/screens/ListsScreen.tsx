import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Card, Pill, PrimaryButton, Row, SectionTitle } from "../components/Primitives";
import { colors, radii, spacing } from "../constants/theme";
import { useHomeThreadStore } from "../store/useHomeThreadStore";

export function ListsScreen() {
  const {
    lists,
    selectedListId,
    selectList,
    createList,
    shoppingItems,
    members,
    toggleShoppingItem,
    clearCheckedShoppingItems,
    refreshFromBackend,
    isHydrating,
    isSaving,
    saveMessage,
    createShoppingItem,
    syncSource,
    syncMessage
  } = useHomeThreadStore();
  const [newItem, setNewItem] = useState("");
  const [newListTitle, setNewListTitle] = useState("");
  const [newListType, setNewListType] = useState<"grocery" | "todo" | "packing" | "custom">("grocery");
  const canAdd = useMemo(() => newItem.trim().length > 0, [newItem]);
  const canCreateList = useMemo(() => newListTitle.trim().length > 0, [newListTitle]);
  const activeList = lists.find((list) => list.id === selectedListId) ?? lists[0] ?? null;
  const checkedCount = shoppingItems.filter((item) => item.checked).length;
  const grouped = shoppingItems.reduce<Record<string, typeof shoppingItems>>((groups, item) => {
    groups[item.category] = [...(groups[item.category] ?? []), item];
    return groups;
  }, {});

  return (
    <View>
      <Text style={styles.title}>Lists</Text>
      <Text style={styles.subtitle}>Groceries and errands that survive the jump between app and family texts.</Text>
      <Text style={styles.realtimeNote}>
        Live multi-device list sync needs Supabase Realtime, which is not wired in this build. Use Refresh to pull the
        latest lists from the backend.
      </Text>

      <View style={styles.statusRow}>
        <Pill
          label={syncSource === "api" ? "Local backend connected" : "Prototype mode"}
          tone={syncSource === "api" ? "primary" : "neutral"}
          icon={syncSource === "api" ? "sparkles" : "information-circle"}
        />
        <Text style={styles.syncNote}>{isHydrating ? "Refreshing..." : syncMessage}</Text>
      </View>

      <View style={styles.actionRow}>
        <PrimaryButton label={isHydrating ? "Refreshing..." : "Refresh"} icon="sync" onPress={() => void refreshFromBackend()} />
        {checkedCount > 0 ? (
          <PrimaryButton
            label={isSaving ? "Clearing..." : `Clear checked (${checkedCount})`}
            icon="trash"
            tone="dark"
            onPress={() => {
              if (isSaving) return;
              void clearCheckedShoppingItems();
            }}
          />
        ) : null}
      </View>
      <Text style={styles.statusText}>{isSaving ? "Saving..." : saveMessage}</Text>

      <Card>
        <Text style={styles.formTitle}>Create list</Text>
        <TextInput
          accessibilityLabel="New list title"
          placeholder="e.g. Camping weekend"
          placeholderTextColor={colors.muted}
          value={newListTitle}
          onChangeText={setNewListTitle}
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (!canCreateList || isSaving) return;
            void createList({ title: newListTitle, type: newListType }).then((ok) => {
              if (ok) {
                setNewListTitle("");
                setNewListType("grocery");
              }
            });
          }}
        />
        <Text style={styles.pickerLabel}>Type</Text>
        <View style={styles.pickerRow}>
          {(["grocery", "todo", "packing", "custom"] as const).map((type) => {
            const selected = type === newListType;
            return (
              <Pressable
                key={type}
                accessibilityRole="button"
                accessibilityLabel={`${selected ? "Selected" : "Select"} ${type} list type`}
                onPress={() => setNewListType(type)}
              >
                <Pill label={type === "todo" ? "to-do" : type} tone={selected ? "primary" : "neutral"} />
              </Pressable>
            );
          })}
        </View>
        <View style={styles.formActions}>
          <PrimaryButton
            label={isSaving ? "Creating..." : "Create list"}
            icon="add-circle"
            onPress={() => {
              if (!canCreateList || isSaving) return;
              void createList({ title: newListTitle, type: newListType }).then((ok) => {
                if (ok) {
                  setNewListTitle("");
                  setNewListType("grocery");
                }
              });
            }}
          />
        </View>
      </Card>

      {lists.length > 0 ? (
        <>
          <Text style={styles.pickerLabel}>List</Text>
          <View style={styles.pickerRow}>
            {lists.map((list) => {
              const selected = list.id === selectedListId;
              return (
                <Pressable
                  key={list.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${selected ? "Selected" : "Select"} ${list.title} list`}
                  onPress={() => selectList(list.id)}
                >
                  <Pill label={list.title} tone={selected ? "primary" : "neutral"} />
                </Pressable>
              );
            })}
          </View>
          {activeList ? (
            <Text style={styles.listHint}>
              {activeList.type === "grocery" ? "Grocery list" : activeList.type} - {shoppingItems.length} items shown
            </Text>
          ) : null}
        </>
      ) : null}

      <Card>
        <Text style={styles.formTitle}>Add item{activeList ? ` to ${activeList.title}` : ""}</Text>
        <TextInput
          accessibilityLabel="New list item"
          placeholder="e.g. Oat milk"
          placeholderTextColor={colors.muted}
          value={newItem}
          onChangeText={setNewItem}
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (!canAdd || isSaving) return;
            void createShoppingItem({ title: newItem }).then((ok) => {
              if (ok) setNewItem("");
            });
          }}
        />
        <View style={styles.formActions}>
          <PrimaryButton
            label={isSaving ? "Adding..." : "Add"}
            icon="add"
            onPress={() => {
              if (!canAdd || isSaving) return;
              void createShoppingItem({ title: newItem }).then((ok) => {
                if (ok) setNewItem("");
              });
            }}
          />
        </View>
      </Card>

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
  realtimeNote: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: spacing.md
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg
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
    padding: spacing.md,
    marginTop: spacing.sm
  },
  formActions: {
    marginTop: spacing.lg
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
  listHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
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

import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useState } from "react";
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, TextInput, UIManager, View } from "react-native";

import { ActionFeedback } from "../components/ActionFeedback";
import { Card, Pill, PrimaryButton, Row, SectionTitle } from "../components/Primitives";
import { SyncStatusRow } from "../components/SyncStatusRow";
import { colors, fonts, radii, spacing } from "../constants/theme";
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
    createShoppingItem,
    syncSource,
    syncMessage,
    realtimeStatus,
    realtimeMessage
  } = useHomeThreadStore();
  const [newItem, setNewItem] = useState("");
  const [newListTitle, setNewListTitle] = useState("");
  const [newListType, setNewListType] = useState<"grocery" | "todo" | "packing" | "custom">("grocery");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canAdd = useMemo(() => newItem.trim().length > 0, [newItem]);
  const canCreateList = useMemo(() => newListTitle.trim().length > 0, [newListTitle]);
  const activeList = lists.find((list) => list.id === selectedListId) ?? lists[0] ?? null;
  const checkedCount = shoppingItems.filter((item) => item.checked).length;
  const grouped = shoppingItems.reduce<Record<string, typeof shoppingItems>>((groups, item) => {
    groups[item.category] = [...(groups[item.category] ?? []), item];
    return groups;
  }, {});

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    if (!successMessage && !infoMessage) {
      return;
    }

    const timer = setTimeout(() => {
      setSuccessMessage(null);
      setInfoMessage(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [successMessage, infoMessage]);

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    const timer = setTimeout(() => setErrorMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  function clearFeedback() {
    setSuccessMessage(null);
    setInfoMessage(null);
    setErrorMessage(null);
  }

  function applyOutcome(
    outcome: { kind: string; message: string },
    onSaved?: () => void
  ) {
    if (outcome.kind === "saved") {
      onSaved?.();
      setSuccessMessage(outcome.message);
      setInfoMessage(null);
      setErrorMessage(null);
      return;
    }

    if (outcome.kind === "queued" || outcome.kind === "local") {
      setInfoMessage(outcome.message);
      setSuccessMessage(null);
      setErrorMessage(null);
      return;
    }

    setErrorMessage(outcome.message || "Something went wrong.");
    setSuccessMessage(null);
    setInfoMessage(null);
  }

  async function handleCreateList() {
    if (!canCreateList || isSaving) {
      return;
    }

    clearFeedback();
    const outcome = await createList({ title: newListTitle, type: newListType });
    applyOutcome(outcome, () => {
      setNewListTitle("");
      setNewListType("grocery");
    });
  }

  async function handleAddItem() {
    if (!canAdd || isSaving) {
      return;
    }

    clearFeedback();
    const savedTitle = newItem.trim();
    const outcome = await createShoppingItem({ title: savedTitle });
    applyOutcome(outcome, () => setNewItem(""));
  }

  async function handleClearChecked() {
    if (isSaving || checkedCount === 0) {
      return;
    }

    clearFeedback();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const outcome = await clearCheckedShoppingItems();
    if (!outcome) {
      return;
    }

    applyOutcome(outcome);
  }

  async function handleToggleItem(itemId: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const outcome = await toggleShoppingItem(itemId);
    if (outcome?.kind === "failed") {
      setErrorMessage(outcome.message);
      setSuccessMessage(null);
      setInfoMessage(null);
    }
  }

  return (
    <View>
      <Text style={styles.title}>Shared lists</Text>
      <Text style={styles.subtitle}>Groceries and errands that survive the jump between the app, the store, and family texts.</Text>

      <SyncStatusRow
        syncSource={syncSource}
        syncMessage={syncMessage}
        isHydrating={isHydrating}
        realtimeStatus={realtimeStatus}
        realtimeMessage={realtimeMessage}
        showLiveNote
      />

      <View style={styles.actionRow}>
        <PrimaryButton
          label={isHydrating ? "Refreshing..." : "Refresh"}
          icon="sync"
          tone="ghost"
          loading={isHydrating}
          disabled={isHydrating}
          onPress={() => void refreshFromBackend()}
        />
        {checkedCount > 0 ? (
          <PrimaryButton
            label={isSaving ? "Clearing..." : `Clear checked (${checkedCount})`}
            icon="trash"
            tone="soft"
            loading={isSaving}
            disabled={isSaving}
            onPress={() => {
              void handleClearChecked();
            }}
          />
        ) : null}
      </View>

      <ActionFeedback message={successMessage ?? ""} tone="success" visible={Boolean(successMessage)} />
      <ActionFeedback message={infoMessage ?? ""} tone="info" visible={Boolean(infoMessage)} />
      <ActionFeedback message={errorMessage ?? ""} tone="error" visible={Boolean(errorMessage)} />

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
            void handleCreateList();
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
            loading={isSaving}
            disabled={!canCreateList || isSaving}
            onPress={() => {
              void handleCreateList();
            }}
          />
        </View>
      </Card>

      {lists.length > 0 ? (
        <>
          <Card>
            <Text style={styles.formTitle}>{activeList ? activeList.title : "Shared list"}</Text>
            <Text style={styles.cardHint}>
              {shoppingItems.length} items visible, {checkedCount} checked off. Keep the quick-add box live so the list stays useful in the aisle.
            </Text>
          </Card>
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

      {activeList ? (
        <Card>
          <Text style={styles.formTitle}>Add item to {activeList.title}</Text>
          <TextInput
            accessibilityLabel="New list item"
            placeholder="e.g. Oat milk"
            placeholderTextColor={colors.muted}
            value={newItem}
            onChangeText={setNewItem}
            style={styles.input}
            returnKeyType="done"
            onSubmitEditing={() => {
              void handleAddItem();
            }}
          />
          <View style={styles.formActions}>
            <PrimaryButton
              label={isSaving ? "Adding..." : "Add"}
              icon="add"
              loading={isSaving}
              disabled={!canAdd || isSaving}
              onPress={() => {
                void handleAddItem();
              }}
            />
          </View>
        </Card>
      ) : (
        <Card>
          <Text style={styles.emptyTitle}>Start with one shared list.</Text>
          <Text style={styles.emptyText}>
            A grocery list is usually the best first move. Once the first list exists, everyone can add items from here.
          </Text>
        </Card>
      )}

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
                  onPress={() => {
                    void handleToggleItem(item.id);
                  }}
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
      {activeList && shoppingItems.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>Nothing in {activeList.title} yet.</Text>
          <Text style={styles.emptyText}>
            Add the first item now so this list becomes useful the next time someone is in a store aisle.
          </Text>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 40
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
    marginTop: spacing.sm
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg
  },
  formTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: spacing.md
  },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.lineStrong,
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
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "700",
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
  cardHint: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20
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
    fontWeight: "800"
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
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700"
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    marginTop: spacing.sm
  }
});

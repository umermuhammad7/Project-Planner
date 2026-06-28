import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useState } from "react";
import { Keyboard, LayoutAnimation, Platform, Pressable, StyleSheet, Text, TextInput, UIManager, View } from "react-native";

import { ActionFeedback } from "../components/ActionFeedback";
import { Card, FieldError, Pill, PrimaryButton, Row, SectionTitle } from "../components/Primitives";
import { ScreenHeader } from "../components/ScreenHeader";
import { SyncStatusRow } from "../components/SyncStatusRow";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { useScrollAssist } from "../context/ScrollAssistContext";
import { useHomeThreadStore, isHomeThreadSavingScope } from "../store/useHomeThreadStore";

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
    createShoppingItem,
    syncSource,
    syncMessage,
    realtimeStatus,
    realtimeMessage
  } = useHomeThreadStore();
  const isSavingLists = useHomeThreadStore(isHomeThreadSavingScope("lists"));
  const { scrollToTop } = useScrollAssist();
  const [newItem, setNewItem] = useState("");
  const [newListTitle, setNewListTitle] = useState("");
  const [newListType, setNewListType] = useState<"grocery" | "todo" | "packing" | "custom">("grocery");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [listTitleError, setListTitleError] = useState<string | null>(null);
  const [itemTitleError, setItemTitleError] = useState<string | null>(null);
  const [showCreateListForm, setShowCreateListForm] = useState(false);
  const [toggleFeedback, setToggleFeedback] = useState<string | null>(null);
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

  useEffect(() => {
    if (!toggleFeedback) {
      return;
    }

    const timer = setTimeout(() => setToggleFeedback(null), 2200);
    return () => clearTimeout(timer);
  }, [toggleFeedback]);

  useEffect(() => {
    if (lists.length === 0) {
      setShowCreateListForm(true);
    }
  }, [lists.length]);

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
    if (isSavingLists) {
      return;
    }

    if (!newListTitle.trim()) {
      setListTitleError("List name is required.");
      setErrorMessage(null);
      setSuccessMessage(null);
      setInfoMessage(null);
      return;
    }

    setListTitleError(null);
    clearFeedback();
    const outcome = await createList({ title: newListTitle, type: newListType });
    applyOutcome(outcome, () => {
      Keyboard.dismiss();
      scrollToTop();
      setNewListTitle("");
      setNewListType("grocery");
      setShowCreateListForm(false);
    });
  }

  async function handleAddItem() {
    if (isSavingLists) {
      return;
    }

    if (!newItem.trim()) {
      setItemTitleError("Item name is required.");
      setErrorMessage(null);
      setSuccessMessage(null);
      setInfoMessage(null);
      return;
    }

    setItemTitleError(null);
    clearFeedback();
    const savedTitle = newItem.trim();
    const outcome = await createShoppingItem({ title: savedTitle });
    applyOutcome(outcome, () => {
      Keyboard.dismiss();
      scrollToTop();
      setNewItem("");
    });
  }

  async function handleClearChecked() {
    if (isSavingLists || checkedCount === 0) {
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
    const item = shoppingItems.find((entry) => entry.id === itemId);
    if (!item) {
      return;
    }

    const nextChecked = !item.checked;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const outcome = await toggleShoppingItem(itemId);
    if (outcome?.kind === "failed") {
      setErrorMessage(outcome.message);
      setSuccessMessage(null);
      setInfoMessage(null);
      setToggleFeedback(null);
      return;
    }

    setToggleFeedback(nextChecked ? `Checked off ${item.title}` : `Reopened ${item.title}`);
    setErrorMessage(null);
  }

  return (
    <View>
      <ScreenHeader
        eyebrow="Lists"
        title="Capture and check off"
        subtitle="Groceries, errands, and packing stay in one shared place."
        icon="list-outline"
        density="compact"
      />

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
          label={showCreateListForm ? "Hide new list" : "New list"}
          icon={showCreateListForm ? "chevron-up" : "add-circle"}
          tone={lists.length === 0 ? "primary" : "soft"}
          onPress={() => setShowCreateListForm((value) => !value)}
        />
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
            label={isSavingLists ? "Clearing..." : `Clear checked (${checkedCount})`}
            icon="trash"
            tone="ghost"
            loading={isSavingLists}
            disabled={isSavingLists}
            onPress={() => {
              void handleClearChecked();
            }}
          />
        ) : null}
      </View>

      <ActionFeedback message={successMessage ?? ""} tone="success" visible={Boolean(successMessage)} />
      <ActionFeedback message={infoMessage ?? ""} tone="info" visible={Boolean(infoMessage)} />
      <ActionFeedback message={errorMessage ?? ""} tone="error" visible={Boolean(errorMessage)} />

      <ActionFeedback message={toggleFeedback ?? ""} tone="success" visible={Boolean(toggleFeedback)} />

      {showCreateListForm || lists.length === 0 ? (
        <View style={styles.createListShell}>
          <Card>
            <Text style={styles.formTitle}>{lists.length === 0 ? "Create your first list" : "New list"}</Text>
            <Text style={styles.createListLead}>
              {lists.length === 0
                ? "Start with groceries, errands, or packing. Lists live here for the whole household."
                : "Add another shared list for errands, packing, or anything else."}
            </Text>
            <TextInput
              accessibilityLabel="New list title"
              placeholder="e.g. Camping weekend"
              placeholderTextColor={colors.muted}
              value={newListTitle}
              onChangeText={(value) => {
                setNewListTitle(value);
                if (listTitleError) {
                  setListTitleError(null);
                }
              }}
              style={[styles.input, listTitleError ? styles.inputInvalid : null]}
              returnKeyType="done"
              onSubmitEditing={() => {
                void handleCreateList();
              }}
            />
            <FieldError message={listTitleError} />
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
                label={isSavingLists ? "Creating..." : "Create list"}
                icon="add-circle"
                loading={isSavingLists}
                disabled={isSavingLists}
                onPress={() => {
                  void handleCreateList();
                }}
              />
            </View>
          </Card>
        </View>
      ) : null}

      {lists.length > 0 ? (
        <>
          <SectionTitle
            title={activeList ? activeList.title : "Shared list"}
            action={`${shoppingItems.length} items · ${checkedCount} checked`}
          />
          <Text style={styles.pickerLabel}>Switch list</Text>
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
        </>
      ) : null}

      {activeList ? (
        <Card>
          <Text style={styles.formTitle}>Add to {activeList.title}</Text>
          <TextInput
            accessibilityLabel="New list item"
            placeholder="e.g. Oat milk"
            placeholderTextColor={colors.muted}
            value={newItem}
            onChangeText={(value) => {
              setNewItem(value);
              if (itemTitleError) {
                setItemTitleError(null);
              }
            }}
            style={[styles.input, itemTitleError ? styles.inputInvalid : null]}
            returnKeyType="done"
            onSubmitEditing={() => {
              void handleAddItem();
            }}
          />
          <FieldError message={itemTitleError} />
          <View style={styles.formActions}>
            <PrimaryButton
              label={isSavingLists ? "Adding..." : "Add item"}
              icon="add"
              loading={isSavingLists}
              disabled={isSavingLists}
              onPress={() => {
                void handleAddItem();
              }}
            />
          </View>
        </Card>
      ) : (
        <Card>
          <Text style={styles.emptyTitle}>Add a list to start capturing items.</Text>
          <Text style={styles.emptyText}>
            Use the new list form above to create groceries, errands, or packing lists for the household.
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
    marginBottom: spacing.xs
  },
  createListLead: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    marginBottom: spacing.md
  },
  createListShell: {
    marginBottom: spacing.xl
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
  inputInvalid: {
    borderColor: colors.coral
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

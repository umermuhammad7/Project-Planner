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

const listTypeOptions = ["grocery", "todo", "packing", "custom"] as const;

function formatListTypeLabel(type: (typeof listTypeOptions)[number]) {
  if (type === "todo") {
    return "To-do";
  }

  return type.charAt(0).toUpperCase() + type.slice(1);
}

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
  const [newListType, setNewListType] = useState<(typeof listTypeOptions)[number]>("grocery");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [listTitleError, setListTitleError] = useState<string | null>(null);
  const [itemTitleError, setItemTitleError] = useState<string | null>(null);
  const [showCreateListForm, setShowCreateListForm] = useState(false);
  const [toggleFeedback, setToggleFeedback] = useState<string | null>(null);
  const activeList = lists.find((list) => list.id === selectedListId) ?? lists[0] ?? null;
  const checkedCount = shoppingItems.filter((item) => item.checked).length;
  const uncheckedCount = shoppingItems.length - checkedCount;
  const grouped = useMemo(
    () =>
      shoppingItems.reduce<Record<string, typeof shoppingItems>>((groups, item) => {
        groups[item.category] = [...(groups[item.category] ?? []), item];
        return groups;
      }, {}),
    [shoppingItems]
  );
  const listStatsLabel = useMemo(() => {
    if (!activeList) {
      return null;
    }

    if (shoppingItems.length === 0) {
      return "No items yet";
    }

    if (checkedCount === 0) {
      return `${shoppingItems.length} to check off`;
    }

    if (uncheckedCount === 0) {
      return `All ${shoppingItems.length} checked`;
    }

    return `${uncheckedCount} left · ${checkedCount} done`;
  }, [activeList, checkedCount, shoppingItems.length, uncheckedCount]);

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
        title={activeList ? activeList.title : "Shared lists"}
        subtitle={
          activeList
            ? "Add items and check them off together."
            : "Groceries, errands, and packing stay in one shared place."
        }
        icon="list-outline"
        badgeLabel={listStatsLabel ?? undefined}
        badgeTone={checkedCount > 0 && uncheckedCount === 0 ? "mint" : "neutral"}
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

      <View style={styles.feedbackShell}>
        <ActionFeedback message={successMessage ?? ""} tone="success" visible={Boolean(successMessage)} />
        <ActionFeedback message={infoMessage ?? ""} tone="info" visible={Boolean(infoMessage)} />
        <ActionFeedback message={errorMessage ?? ""} tone="error" visible={Boolean(errorMessage)} />
        <ActionFeedback message={toggleFeedback ?? ""} tone="success" visible={Boolean(toggleFeedback)} />
      </View>

      {lists.length > 0 ? (
        <Card>
          <Text style={styles.fieldLabel}>Your lists</Text>
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
        </Card>
      ) : null}

      {activeList ? (
        <Card>
          <Text style={styles.formTitle}>Add an item</Text>
          <Text style={styles.formHint}>Tap return or Add item when you are ready.</Text>
          <Text style={styles.fieldLabel}>Item</Text>
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
      ) : null}

      <View style={styles.actionRow}>
        <View style={styles.primaryAction}>
          <PrimaryButton
            label={showCreateListForm ? "Close new list" : "New list"}
            icon={showCreateListForm ? "close" : "add-circle"}
            tone={lists.length === 0 ? "primary" : "soft"}
            onPress={() => setShowCreateListForm((value) => !value)}
          />
        </View>
        <PrimaryButton
          label={isHydrating ? "Refreshing..." : "Refresh"}
          icon="sync"
          tone="ghost"
          loading={isHydrating}
          disabled={isHydrating}
          onPress={() => void refreshFromBackend()}
        />
      </View>

      {checkedCount > 0 ? (
        <View style={styles.clearRow}>
          <PrimaryButton
            label={isSavingLists ? "Clearing..." : `Clear ${checkedCount} checked`}
            icon="trash"
            tone="ghost"
            loading={isSavingLists}
            disabled={isSavingLists}
            onPress={() => {
              void handleClearChecked();
            }}
          />
        </View>
      ) : null}

      {showCreateListForm || lists.length === 0 ? (
        <View style={styles.createListShell}>
          <Card>
            <Text style={styles.formTitle}>{lists.length === 0 ? "Create your first list" : "New list"}</Text>
            <Text style={styles.formHint}>
              {lists.length === 0
                ? "Start with groceries, errands, or packing for the whole household."
                : "Add another shared list for errands, packing, or anything else."}
            </Text>
            <Text style={styles.fieldLabel}>List name</Text>
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
            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.pickerRow}>
              {listTypeOptions.map((type) => {
                const selected = type === newListType;
                return (
                  <Pressable
                    key={type}
                    accessibilityRole="button"
                    accessibilityLabel={`${selected ? "Selected" : "Select"} ${formatListTypeLabel(type)} list type`}
                    onPress={() => setNewListType(type)}
                  >
                    <Pill label={formatListTypeLabel(type)} tone={selected ? "primary" : "neutral"} />
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

      {!activeList ? (
        <Card>
          <Text style={styles.emptyTitle}>Add a list to start capturing items.</Text>
          <Text style={styles.emptyText}>
            Open the new list form above to create groceries, errands, or packing lists for the household.
          </Text>
        </Card>
      ) : null}

      {activeList && shoppingItems.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>Nothing in {activeList.title} yet.</Text>
          <Text style={styles.emptyText}>
            Add the first item above so this list is ready the next time someone is shopping.
          </Text>
        </Card>
      ) : null}

      {Object.entries(grouped).map(([category, items]) => (
        <View key={category} style={styles.categoryBlock}>
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
                  style={({ pressed }) => [styles.itemRow, item.checked ? styles.itemRowDone : null, pressed ? styles.itemRowPressed : null]}
                >
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
  feedbackShell: {
    gap: spacing.xs,
    marginTop: spacing.sm
  },
  actionRow: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg
  },
  primaryAction: {
    flex: 1
  },
  clearRow: {
    marginTop: spacing.sm
  },
  formTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: spacing.xs
  },
  formHint: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    marginBottom: spacing.md
  },
  createListShell: {
    marginTop: spacing.md
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: spacing.xs,
    marginTop: spacing.md
  },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    padding: spacing.md
  },
  inputInvalid: {
    borderColor: colors.coral
  },
  formActions: {
    marginTop: spacing.lg
  },
  pickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  categoryBlock: {
    marginTop: spacing.md
  },
  stack: {
    gap: spacing.sm
  },
  itemRow: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  itemRowDone: {
    backgroundColor: colors.surfaceRaised
  },
  itemRowPressed: {
    opacity: 0.92
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
    fontWeight: "600",
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

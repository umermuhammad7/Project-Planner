import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View
} from "react-native";

import { ActionFeedback } from "../components/ActionFeedback";
import { FieldError, PrimaryButton } from "../components/Primitives";
import { colors, fonts, radii, shadow, spacing } from "../constants/theme";
import { useHomeThreadStore, isHomeThreadSavingScope } from "../store/useHomeThreadStore";

const listTypeOptions = ["grocery", "todo", "packing", "custom"] as const;

const listTypeMeta: Record<
  (typeof listTypeOptions)[number],
  { icon: string; color: string; soft: string; placeholder: string; description: string }
> = {
  grocery: {
    icon: "🛒",
    color: colors.mint,
    soft: colors.mintSoft,
    placeholder: "Add an item to buy...",
    description: "Items group by aisle as you add them."
  },
  todo: {
    icon: "✅",
    color: colors.sky,
    soft: colors.skySoft,
    placeholder: "Add a task...",
    description: "A simple shared to-do list."
  },
  packing: {
    icon: "🧳",
    color: colors.gold,
    soft: colors.goldSoft,
    placeholder: "Add something to pack...",
    description: "Items group by clothing, toiletries, documents, and gear."
  },
  custom: {
    icon: "✨",
    color: colors.coral,
    soft: colors.coralSoft,
    placeholder: "Add an item...",
    description: "A flexible list for anything else."
  }
};

function getListTypeMeta(type: string) {
  return listTypeMeta[type as (typeof listTypeOptions)[number]] ?? listTypeMeta.custom;
}

function formatListTypeLabel(type: string) {
  if (type === "todo") {
    return "To-do";
  }

  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function ListsScreen({ pinnedHeader = false }: { pinnedHeader?: boolean } = {}) {
  const {
    lists,
    selectedListId,
    selectList,
    createList,
    deleteList,
    shoppingItems,
    members,
    toggleShoppingItem,
    clearCheckedShoppingItems,
    refreshFromBackend,
    isHydrating,
    createShoppingItem
  } = useHomeThreadStore();
  const isSavingLists = useHomeThreadStore(isHomeThreadSavingScope("lists"));
  const [newItem, setNewItem] = useState("");
  const [newListTitle, setNewListTitle] = useState("");
  const [newListType, setNewListType] = useState<(typeof listTypeOptions)[number]>("grocery");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [listTitleError, setListTitleError] = useState<string | null>(null);
  const [itemTitleError, setItemTitleError] = useState<string | null>(null);
  const [showCreateListForm, setShowCreateListForm] = useState(false);
  const [showManageLists, setShowManageLists] = useState(false);
  const [pendingDeleteListId, setPendingDeleteListId] = useState<string | null>(null);
  const [manageSearch, setManageSearch] = useState("");
  const [toggleFeedback, setToggleFeedback] = useState<string | null>(null);

  const activeList = lists.find((list) => list.id === selectedListId) ?? lists[0] ?? null;
  const activeListMeta = getListTypeMeta(activeList?.type ?? "custom");
  const checkedCount = shoppingItems.filter((item) => item.checked).length;
  const uncheckedCount = shoppingItems.length - checkedCount;
  const allChecked = shoppingItems.length > 0 && uncheckedCount === 0;
  const progressRatio = shoppingItems.length > 0 ? checkedCount / shoppingItems.length : 0;

  const openItems = useMemo(() => shoppingItems.filter((item) => !item.checked), [shoppingItems]);
  const checkedItems = useMemo(() => shoppingItems.filter((item) => item.checked), [shoppingItems]);

  const visibleTabLists = useMemo(() => {
    const maxTabs = 6;
    if (lists.length <= maxTabs) {
      return lists;
    }

    const head = lists.slice(0, maxTabs);
    if (activeList && !head.some((list) => list.id === activeList.id)) {
      return [...head.slice(0, maxTabs - 1), activeList];
    }

    return head;
  }, [lists, activeList]);
  const overflowListCount = lists.length - visibleTabLists.length;

  const filteredManageLists = useMemo(() => {
    const query = manageSearch.trim().toLowerCase();
    if (!query) {
      return lists;
    }

    return lists.filter((list) => list.title.toLowerCase().includes(query));
  }, [lists, manageSearch]);

  const groupedOpen = useMemo(
    () =>
      openItems.reduce<Record<string, typeof shoppingItems>>((groups, item) => {
        groups[item.category] = [...(groups[item.category] ?? []), item];
        return groups;
      }, {}),
    [openItems]
  );

  const listStatusPhrase = useMemo(() => {
    if (!activeList) {
      return "";
    }

    if (shoppingItems.length === 0) {
      return "no items yet";
    }

    if (checkedCount === 0) {
      return `${shoppingItems.length} to check off`;
    }

    if (uncheckedCount === 0) {
      return `all ${shoppingItems.length} checked`;
    }

    return `${uncheckedCount} left, ${checkedCount} done`;
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

  function clearFeedback() {
    setSuccessMessage(null);
    setInfoMessage(null);
    setErrorMessage(null);
  }

  function applyOutcome(outcome: { kind: string; message: string }, onSaved?: () => void) {
    if (outcome.kind === "saved") {
      onSaved?.();
      setSuccessMessage(outcome.message);
      setInfoMessage(null);
      setErrorMessage(null);
      return;
    }

    if (outcome.kind === "queued" || outcome.kind === "local") {
      onSaved?.();
      setInfoMessage(outcome.message);
      setSuccessMessage(null);
      setErrorMessage(null);
      return;
    }

    setErrorMessage(outcome.message || "Something went wrong.");
    setSuccessMessage(null);
    setInfoMessage(null);
  }

  function closeListForm() {
    if (isSavingLists) return;
    setShowCreateListForm(false);
    setNewListTitle("");
    setNewListType("grocery");
    setListTitleError(null);
  }

  function closeManageLists() {
    if (isSavingLists) return;
    setShowManageLists(false);
    setPendingDeleteListId(null);
    setManageSearch("");
  }

  async function handleDeleteList(listId: string) {
    if (isSavingLists) {
      return;
    }

    clearFeedback();
    const outcome = await deleteList(listId);
    setPendingDeleteListId(null);
    applyOutcome(outcome);
  }

  async function handleCreateList() {
    if (isSavingLists) {
      return;
    }

    if (!newListTitle.trim()) {
      setListTitleError("List name is required.");
      return;
    }

    setListTitleError(null);
    clearFeedback();
    const outcome = await createList({ title: newListTitle, type: newListType });
    applyOutcome(outcome, () => {
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
      return;
    }

    setItemTitleError(null);
    clearFeedback();
    const outcome = await createShoppingItem({ title: newItem.trim() });
    applyOutcome(outcome, () => {
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
    <View style={styles.screen}>
      {pinnedHeader ? (
        <View style={styles.largeTitleRow}>
          <View style={styles.largeTitleIcon}>
            <Text style={styles.largeTitleGlyph}>🛍️</Text>
          </View>
          <Text style={styles.largeTitleText}>Lists</Text>
        </View>
      ) : null}
      {/* Header card */}
      <View style={styles.plannerCard}>
        <View style={styles.header}>
          {activeList ? (
            <View style={[styles.headerTypeIcon, { backgroundColor: activeListMeta.soft }]}>
              <Text style={styles.headerTypeIconGlyph}>{activeListMeta.icon}</Text>
            </View>
          ) : null}
          <View style={styles.headerCopy}>
            {pinnedHeader ? null : <Text style={styles.headerTitle}>Lists</Text>}
            <Text style={styles.headerMeta} numberOfLines={1}>
              {activeList ? `${activeList.title} · ${listStatusPhrase}` : "Shared with everyone in the household"}
            </Text>
            {shoppingItems.length > 0 ? (
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.round(progressRatio * 100)}%` as `${number}%`,
                      backgroundColor: allChecked ? colors.mint : activeListMeta.color
                    }
                  ]}
                />
              </View>
            ) : null}
          </View>
          <View style={styles.headerActions}>
            {lists.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Manage lists"
                onPress={() => setShowManageLists(true)}
                style={({ pressed }) => [styles.manageButton, pressed && styles.manageButtonPressed]}
              >
                <Ionicons name="options-outline" size={18} color={colors.ink} />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create a new list"
              onPress={() => setShowCreateListForm(true)}
              style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
            >
              <Ionicons name="add" size={17} color="#FFFFFF" />
              <Text style={styles.addButtonText}>New list</Text>
            </Pressable>
          </View>
        </View>

        {lists.length > 1 ? (
          <FlatList
            horizontal
            data={visibleTabLists}
            keyExtractor={(list) => list.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.listTabsContent}
            style={styles.listTabs}
            renderItem={({ item: list }) => {
              const selected = list.id === selectedListId;
              const meta = getListTypeMeta(list.type);
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${selected ? "Selected" : "Select"} ${list.title} list`}
                  onPress={() => selectList(list.id)}
                  style={[
                    styles.listTab,
                    selected && { backgroundColor: meta.soft, borderColor: meta.color }
                  ]}
                >
                  <Text style={styles.listTabGlyph}>{meta.icon}</Text>
                  <Text style={[styles.listTabText, selected && { color: meta.color }]} numberOfLines={1}>
                    {list.title}
                  </Text>
                </Pressable>
              );
            }}
            ListFooterComponent={
              overflowListCount > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`See ${overflowListCount} more lists`}
                  onPress={() => setShowManageLists(true)}
                  style={styles.listTabMore}
                >
                  <Text style={styles.listTabMoreText}>+{overflowListCount} more</Text>
                </Pressable>
              ) : null
            }
          />
        ) : null}
      </View>

      <ActionFeedback message={successMessage ?? ""} tone="success" visible={Boolean(successMessage)} />
      <ActionFeedback message={infoMessage ?? ""} tone="info" visible={Boolean(infoMessage)} />
      <ActionFeedback message={errorMessage ?? ""} tone="error" visible={Boolean(errorMessage)} />
      <ActionFeedback message={toggleFeedback ?? ""} tone="success" visible={Boolean(toggleFeedback)} />

      {activeList ? (
        <View style={styles.quickAddRow}>
          <TextInput
            accessibilityLabel="New list item"
            placeholder={activeListMeta.placeholder}
            placeholderTextColor={colors.muted}
            value={newItem}
            onChangeText={(value) => {
              setNewItem(value);
              if (itemTitleError) {
                setItemTitleError(null);
              }
            }}
            style={[styles.quickAddInput, itemTitleError ? styles.inputInvalid : null]}
            returnKeyType="done"
            onSubmitEditing={() => {
              void handleAddItem();
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add item"
            disabled={isSavingLists}
            onPress={() => {
              void handleAddItem();
            }}
            style={({ pressed }) => [
              styles.quickAddButton,
              pressed && styles.quickAddButtonPressed,
              isSavingLists && styles.quickAddButtonDisabled
            ]}
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      ) : null}
      <FieldError message={itemTitleError} />

      {!activeList ? (
        <View style={styles.emptyHero}>
          <View style={styles.emptyHeroIcon}>
            <Ionicons name="list-outline" size={28} color={colors.primary} />
          </View>
          <Text style={styles.emptyHeroTitle}>No lists yet</Text>
          <Text style={styles.emptyHeroText}>
            Start a shared list for groceries, errands, or packing — everyone in the household can add and check
            off items.
          </Text>
          <View style={styles.emptyHeroAction}>
            <PrimaryButton label="Create your first list" icon="add-circle" onPress={() => setShowCreateListForm(true)} />
          </View>
        </View>
      ) : shoppingItems.length === 0 ? (
        <View style={styles.emptyBlock}>
          <Text style={styles.emptyTitle}>Nothing in {activeList.title} yet.</Text>
          <Text style={styles.emptyText}>Add the first item above so it's ready next time.</Text>
        </View>
      ) : (
        <>
          {openItems.length > 0 ? (
            <View style={styles.agendaArea}>
              {Object.entries(groupedOpen).map(([category, items]) => (
                <View key={category} style={styles.categoryBlock}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{category}</Text>
                    <View style={styles.sectionHeaderRule} />
                    <Text style={styles.sectionCount}>{items.length}</Text>
                  </View>
                  <View style={styles.itemList}>
                    {items.map((item) => {
                      const addedBy = members.find((member) => member.id === item.addedBy)?.name ?? "Family";
                      return (
                        <Pressable
                          key={item.id}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: false }}
                          accessibilityLabel={`Check ${item.title}`}
                          onPress={() => {
                            void handleToggleItem(item.id);
                          }}
                          style={({ pressed }) => [styles.itemRow, pressed && styles.itemRowPressed]}
                        >
                          <View style={styles.checkCircle}>
                            <Ionicons name="ellipse-outline" size={22} color={colors.muted} />
                          </View>
                          <View style={styles.itemCopy}>
                            <Text style={styles.itemTitle}>{item.title}</Text>
                            <Text style={styles.itemMeta}>Added by {addedBy}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.allDoneBlock}>
              <View style={styles.allDoneIcon}>
                <Ionicons name="checkmark-circle" size={32} color={colors.mint} />
              </View>
              <Text style={styles.allDoneTitle}>All checked off!</Text>
              <Text style={styles.allDoneText}>
                {checkedItems.length === 1
                  ? "1 item done. Nice work."
                  : `${checkedItems.length} items done. Nice work.`}
              </Text>
            </View>
          )}

          {checkedItems.length > 0 ? (
            <View style={styles.agendaArea}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Checked</Text>
                <View style={styles.sectionHeaderRule} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Clear ${checkedCount} checked items`}
                  disabled={isSavingLists}
                  onPress={() => {
                    void handleClearChecked();
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                >
                  <Text style={styles.clearLink}>{isSavingLists ? "Clearing..." : "Clear"}</Text>
                </Pressable>
              </View>
              <View style={styles.itemList}>
                {checkedItems.map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: true }}
                    accessibilityLabel={`Uncheck ${item.title}`}
                    onPress={() => {
                      void handleToggleItem(item.id);
                    }}
                    style={({ pressed }) => [styles.completedRow, pressed && styles.itemRowPressed]}
                  >
                    <View style={styles.checkDone}>
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    </View>
                    <Text style={styles.doneTitleText}>{item.title}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </>
      )}

      {activeList ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh lists"
          disabled={isHydrating}
          onPress={() => void refreshFromBackend()}
          style={({ pressed }) => [styles.refreshRow, pressed && styles.refreshRowPressed]}
        >
          <Ionicons name="sync" size={14} color={colors.muted} />
          <Text style={styles.refreshText}>{isHydrating ? "Refreshing..." : "Refresh"}</Text>
        </Pressable>
      ) : null}

      {/* New list modal */}
      <Modal
        visible={showCreateListForm}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeListForm}
      >
        <SafeAreaView style={styles.composeSafe}>
          <KeyboardAvoidingView style={styles.composeRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.composeStage}>
              <View style={styles.composePanel}>
                <View style={styles.composeHeader}>
                  <View style={styles.composeHeaderMark}>
                    <Ionicons name="list-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.composeHeaderCopy}>
                    <Text style={styles.composeTitle}>New list</Text>
                    <Text style={styles.composeHint}>Groceries, errands, packing, or anything else.</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cancel"
                    disabled={isSavingLists}
                    onPress={closeListForm}
                    style={styles.composeCancelHit}
                  >
                    <Text style={styles.composeCancelText}>Cancel</Text>
                  </Pressable>
                </View>

                <ScrollView
                  style={styles.composeScroll}
                  contentContainerStyle={styles.composeScrollContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.formField}>
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
                  </View>

                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Type</Text>
                    <View style={styles.typeOptionStack}>
                      {listTypeOptions.map((type) => {
                        const selected = type === newListType;
                        const meta = listTypeMeta[type];
                        return (
                          <Pressable
                            key={type}
                            accessibilityRole="button"
                            accessibilityLabel={`${selected ? "Selected" : "Select"} ${formatListTypeLabel(type)} list type`}
                            onPress={() => setNewListType(type)}
                            style={[
                              styles.typeOption,
                              selected && { backgroundColor: meta.soft, borderColor: meta.color }
                            ]}
                          >
                            <View style={[styles.typeOptionIcon, { backgroundColor: selected ? colors.surface : colors.canvas }]}>
                              <Text style={styles.typeOptionIconGlyph}>{meta.icon}</Text>
                            </View>
                            <View style={styles.typeOptionCopy}>
                              <Text style={[styles.typeOptionTitle, selected && { color: meta.color }]}>
                                {formatListTypeLabel(type)}
                              </Text>
                              <Text style={styles.typeOptionDescription}>{meta.description}</Text>
                            </View>
                            {selected ? <Ionicons name="checkmark-circle" size={18} color={meta.color} /> : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </ScrollView>

                <View style={styles.composeFooter}>
                  <PrimaryButton
                    label={isSavingLists ? "Creating..." : "Create list"}
                    icon="checkmark"
                    loading={isSavingLists}
                    disabled={isSavingLists}
                    onPress={() => void handleCreateList()}
                  />
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Manage lists modal */}
      <Modal
        visible={showManageLists}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeManageLists}
      >
        <SafeAreaView style={styles.composeSafe}>
        <KeyboardAvoidingView style={styles.composeRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.composeStage}>
            <View style={styles.composePanel}>
              <View style={styles.composeHeader}>
                <View style={styles.composeHeaderMark}>
                  <Ionicons name="options-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.composeHeaderCopy}>
                  <Text style={styles.composeTitle}>Manage lists</Text>
                  <Text style={styles.composeHint}>Switch between lists or remove ones you no longer need.</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Done"
                  onPress={closeManageLists}
                  style={styles.composeCancelHit}
                >
                  <Text style={styles.composeCancelText}>Done</Text>
                </Pressable>
              </View>

              {lists.length > 5 ? (
                <View style={styles.manageSearchWrap}>
                  <Ionicons name="search" size={16} color={colors.muted} />
                  <TextInput
                    accessibilityLabel="Search your lists"
                    placeholder="Search lists..."
                    placeholderTextColor={colors.muted}
                    value={manageSearch}
                    onChangeText={setManageSearch}
                    style={styles.manageSearchInput}
                    returnKeyType="search"
                  />
                  {manageSearch ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setManageSearch("")}>
                      <Ionicons name="close-circle" size={16} color={colors.muted} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <FlatList
                style={styles.composeScroll}
                contentContainerStyle={styles.composeScrollContent}
                showsVerticalScrollIndicator={false}
                data={filteredManageLists}
                keyExtractor={(list) => list.id}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={12}
                windowSize={7}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    {lists.length === 0
                      ? 'No lists yet. Close this and tap "New list" to create one.'
                      : `No lists match "${manageSearch}".`}
                  </Text>
                }
                renderItem={({ item: list }) => {
                  const selected = list.id === selectedListId;
                  const itemCount = list.id === activeList?.id ? shoppingItems.length : undefined;
                  const isPendingDelete = pendingDeleteListId === list.id;
                  const meta = getListTypeMeta(list.type);
                  return (
                    <View style={styles.manageRow}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${selected ? "Selected" : "Select"} ${list.title} list`}
                        onPress={() => selectList(list.id)}
                        style={styles.manageRowMain}
                      >
                        <View style={[styles.manageRowIcon, { backgroundColor: meta.soft }]}>
                          <Text style={styles.manageRowIconGlyph}>{meta.icon}</Text>
                        </View>
                        <View style={styles.manageRowCopy}>
                          <Text style={styles.manageRowTitle}>{list.title}</Text>
                          <Text style={styles.manageRowMeta}>
                            {formatListTypeLabel(list.type)}
                            {typeof itemCount === "number" ? ` · ${itemCount} item${itemCount === 1 ? "" : "s"}` : ""}
                          </Text>
                        </View>
                        {selected ? <Ionicons name="checkmark-circle" size={18} color={meta.color} /> : null}
                      </Pressable>

                      {isPendingDelete ? (
                        <View style={styles.deleteConfirm}>
                          <Text style={styles.deleteConfirmText}>Remove "{list.title}" and all its items?</Text>
                          <View style={styles.deleteConfirmActions}>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Keep list"
                              onPress={() => setPendingDeleteListId(null)}
                              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                              style={({ pressed }) => [styles.actionLink, pressed && styles.actionLinkPressed]}
                            >
                              <Text style={styles.actionLinkText}>Keep</Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Confirm remove "${list.title}"`}
                              disabled={isSavingLists}
                              onPress={() => void handleDeleteList(list.id)}
                              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                              style={({ pressed }) => [styles.actionLink, pressed && styles.actionLinkPressed]}
                            >
                              <Text style={[styles.actionLinkText, styles.deleteText]}>
                                {isSavingLists ? "Removing..." : "Remove"}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Delete "${list.title}"`}
                          onPress={() => setPendingDeleteListId(list.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                          style={styles.manageDeleteHit}
                        >
                          <Ionicons name="trash-outline" size={15} color={colors.coral} />
                          <Text style={[styles.actionLinkText, styles.deleteText]}>Delete list</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                }}
              />

              <View style={styles.composeFooter}>
                <PrimaryButton
                  label="Add another list"
                  icon="add-circle"
                  tone="soft"
                  onPress={() => {
                    setShowManageLists(false);
                    setShowCreateListForm(true);
                  }}
                />
                <ActionFeedback message={errorMessage ?? ""} tone="error" visible={Boolean(errorMessage)} />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 0,
    paddingBottom: 96
  },
  largeTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginBottom: spacing.md
  },
  largeTitleIcon: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  largeTitleGlyph: {
    fontSize: 20
  },
  largeTitleText: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.3
  },
  // Header card
  plannerCard: {
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    overflow: "hidden",
    ...shadow.card
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingBottom: 10,
    paddingHorizontal: spacing.md,
    paddingTop: 12
  },
  headerTypeIcon: {
    alignItems: "center",
    borderRadius: radii.md,
    height: 36,
    justifyContent: "center",
    marginTop: 1,
    width: 36
  },
  headerTypeIconGlyph: {
    fontSize: 17,
    lineHeight: 21
  },
  headerCopy: {
    flex: 1,
    minWidth: 0
  },
  headerTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
    lineHeight: 26
  },
  headerMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 17,
    marginTop: 2
  },
  progressTrack: {
    backgroundColor: colors.line,
    borderRadius: radii.pill,
    height: 4,
    marginTop: 8,
    overflow: "hidden",
    width: "100%"
  },
  progressFill: {
    borderRadius: radii.pill,
    height: 4
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs
  },
  addButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 3,
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  addButtonPressed: {
    backgroundColor: colors.primaryPressed
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700"
  },
  manageButton: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderColor: colors.lineStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  manageButtonPressed: {
    backgroundColor: colors.surfaceRaised
  },
  // List switcher tabs
  listTabs: {
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  listTabsContent: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  listTabGlyph: {
    fontSize: 13,
    lineHeight: 16
  },
  listTab: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderColor: colors.lineStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  listTabText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  listTabMore: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderColor: colors.lineStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  listTabMoreText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700"
  },
  // Quick add
  quickAddRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  quickAddInput: {
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    minHeight: 46,
    paddingHorizontal: spacing.md
  },
  inputInvalid: {
    borderColor: colors.coral
  },
  quickAddButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    height: 46,
    justifyContent: "center",
    width: 46
  },
  quickAddButtonPressed: {
    backgroundColor: colors.primaryPressed
  },
  quickAddButtonDisabled: {
    opacity: 0.6
  },
  // Sections
  agendaArea: {
    gap: spacing.sm,
    marginBottom: spacing.lg
  },
  categoryBlock: {
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: 2
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.1,
    lineHeight: 18
  },
  sectionHeaderRule: {
    backgroundColor: colors.line,
    flex: 1,
    height: StyleSheet.hairlineWidth
  },
  sectionCount: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  clearLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700"
  },
  itemList: {
    gap: 8
  },
  itemRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  itemRowPressed: {
    opacity: 0.7
  },
  checkCircle: {
    alignItems: "center",
    height: 28,
    justifyContent: "center",
    width: 28
  },
  itemCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  itemTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
    lineHeight: 19
  },
  itemMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 15
  },
  // Completed rows
  completedRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 44,
    opacity: 0.72,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  checkDone: {
    alignItems: "center",
    backgroundColor: colors.mint,
    borderRadius: 14,
    height: 22,
    justifyContent: "center",
    width: 22
  },
  doneTitleText: {
    color: colors.muted,
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    textDecorationLine: "line-through"
  },
  // All done state
  allDoneBlock: {
    alignItems: "center",
    backgroundColor: colors.mintSoft,
    borderColor: "rgba(92,122,90,0.18)",
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg
  },
  allDoneIcon: {
    marginBottom: 4
  },
  allDoneTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center"
  },
  allDoneText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
    textAlign: "center"
  },
  // Empty state
  emptyHero: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl
  },
  emptyHeroIcon: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    height: 56,
    justifyContent: "center",
    marginBottom: spacing.sm,
    width: 56
  },
  emptyHeroTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center"
  },
  emptyHeroText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    marginTop: spacing.xs,
    textAlign: "center"
  },
  emptyHeroAction: {
    marginTop: spacing.lg,
    width: "100%"
  },
  emptyBlock: {
    paddingHorizontal: 2,
    paddingVertical: 12
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: "700"
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
    marginTop: 4
  },
  // Refresh
  refreshRow: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    gap: 6,
    paddingVertical: spacing.sm
  },
  refreshRowPressed: {
    opacity: 0.6
  },
  refreshText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600"
  },
  // Form modal
  composeSafe: {
    backgroundColor: "#EDE4D6",
    flex: 1
  },
  composeRoot: {
    flex: 1
  },
  composeStage: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  composePanel: {
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    borderRadius: radii.xl,
    borderWidth: 1,
    flex: 1,
    maxWidth: 440,
    overflow: "hidden",
    width: "100%",
    ...shadow.card
  },
  composeHeader: {
    alignItems: "flex-start",
    backgroundColor: colors.goldSoft,
    borderBottomColor: "rgba(153,106,0,0.14)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    paddingBottom: 14,
    paddingHorizontal: spacing.md,
    paddingTop: 14
  },
  composeHeaderMark: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "rgba(153,106,0,0.18)",
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    height: 36,
    justifyContent: "center",
    marginTop: 2,
    width: 36
  },
  composeHeaderCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.xs
  },
  composeTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
    lineHeight: 26
  },
  composeHint: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 17,
    marginTop: 3
  },
  composeCancelHit: {
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 2,
    paddingVertical: 4
  },
  composeCancelText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "700"
  },
  composeScroll: {
    backgroundColor: colors.surface,
    flex: 1
  },
  composeScrollContent: {
    gap: 12,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: 12
  },
  composeFooter: {
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    paddingBottom: Platform.OS === "ios" ? spacing.md : spacing.lg,
    paddingHorizontal: spacing.md,
    paddingTop: 12
  },
  formField: {
    gap: 6
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.1
  },
  input: {
    backgroundColor: colors.canvas,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.ink,
    fontSize: 16,
    fontWeight: "500",
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  pickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  typeOptionStack: {
    gap: spacing.sm
  },
  typeOption: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  typeOptionIcon: {
    alignItems: "center",
    borderRadius: radii.sm,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  typeOptionIconGlyph: {
    fontSize: 17,
    lineHeight: 21
  },
  typeOptionCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  typeOptionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700"
  },
  typeOptionDescription: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16
  },
  // Manage lists modal
  manageSearchWrap: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  manageSearchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    paddingVertical: 4
  },
  manageRow: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    marginBottom: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  manageRowMain: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 40
  },
  manageRowIcon: {
    alignItems: "center",
    borderRadius: radii.sm,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  manageRowIconGlyph: {
    fontSize: 15,
    lineHeight: 19
  },
  manageRowCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  manageRowTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: "700"
  },
  manageRowMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "500"
  },
  manageDeleteHit: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 5,
    paddingVertical: 2
  },
  actionLink: {
    justifyContent: "center",
    minHeight: 28,
    paddingVertical: 2
  },
  actionLinkPressed: {
    opacity: 0.65
  },
  actionLinkText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700"
  },
  deleteText: {
    color: colors.coral
  },
  deleteConfirm: {
    gap: spacing.xs
  },
  deleteConfirmText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18
  },
  deleteConfirmActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  }
});

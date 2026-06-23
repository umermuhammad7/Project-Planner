type WidgetSnapshot = {
  familyName: string;
  nextEvents: Array<{
    title: string;
    time: string;
    dateLabel: string;
  }>;
  openChores: number;
  openShoppingItems: number;
  updatedAt: string;
};

const storageKey = "homethread:widget-snapshot";

export function saveWidgetSnapshot(snapshot: WidgetSnapshot) {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify(snapshot));
  } catch {
    // No native widget extension reads this yet - snapshot is best-effort for future widget work.
  }
}

export function buildWidgetSnapshot(input: {
  familyName: string;
  events: Array<{ title: string; time: string; dateLabel: string }>;
  openChores: number;
  openShoppingItems: number;
}) {
  return {
    familyName: input.familyName,
    nextEvents: input.events.slice(0, 3),
    openChores: input.openChores,
    openShoppingItems: input.openShoppingItems,
    updatedAt: new Date().toISOString()
  };
}

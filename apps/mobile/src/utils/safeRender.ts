export function safeMemberInitials(name?: string | null) {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) {
    return "??";
  }

  return trimmed.slice(0, 2).toUpperCase();
}

export function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export function safeText(value: string | null | undefined, fallback = "") {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

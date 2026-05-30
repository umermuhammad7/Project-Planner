export function formatNotificationType(type: string): string {
  const normalized = type.trim().toLowerCase();
  const labels: Record<string, string> = {
    daily_digest: "Daily digest",
    chore_due: "Chore reminder",
    chore_reminder: "Chore reminder",
    event_reminder: "Event reminder",
    family_activity: "Family activity",
    calendar_sync: "Calendar sync",
    invite: "Invite",
    system: "System"
  };

  if (labels[normalized]) {
    return labels[normalized];
  }

  return normalized
    .split(/[_-]+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

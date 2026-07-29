import { useEffect, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";

import { Card, Pill, PrimaryButton, SectionTitle } from "../components/Primitives";
import { ScreenHeader } from "../components/ScreenHeader";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { apiRequest } from "../services/api";
import { useHomeThreadStore } from "../store/useHomeThreadStore";
import {
  CalendarConnectAttempt,
  CalendarConnection,
  CalendarSyncConnectionResult,
  CalendarSyncNowResponse,
  CalendarSyncStatus
} from "../types";

function formatProviderLabel(provider: CalendarConnection["provider"]) {
  if (provider === "google") return "Google Calendar";
  return provider;
}

function formatConnectionSyncResult(result: CalendarSyncConnectionResult) {
  const parts = [`+${result.added} added`, `${result.skipped} skipped`];
  if (result.failed > 0) {
    parts.push(`${result.failed} failed`);
  }
  return `${formatProviderLabel(result.provider)}: ${parts.join(", ")}. ${result.message}`;
}

function formatSyncSummary(result: CalendarSyncNowResponse) {
  if (result.results.length === 0) {
    return result.message;
  }

  const lines = result.results.map((item) => formatConnectionSyncResult(item));
  return `${result.message}\n${lines.join("\n")}`;
}

export function CalendarSyncScreen({
  onBack,
  pinnedHeader = false
}: {
  onBack: () => void;
  pinnedHeader?: boolean;
}) {
  const { familyId, syncSource, refreshFromBackend } = useHomeThreadStore();
  const [status, setStatus] = useState<CalendarSyncStatus | null>(null);
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncByConnectionId, setLastSyncByConnectionId] = useState<
    Record<string, CalendarSyncConnectionResult>
  >({});

  async function loadCalendarSync() {
    if (syncSource !== "api" || !familyId) {
      setStatus(null);
      setConnections([]);
      setNote("Calendar status needs a signed-in household.");
      return;
    }

    setIsLoading(true);
    setNote(null);

    const [statusResult, connectionsResult] = await Promise.all([
      apiRequest<CalendarSyncStatus>("/calendar-sync/status"),
      apiRequest<{ connections: CalendarConnection[] }>(`/calendar-sync/connections?familyId=${familyId}`)
    ]);

    setStatus(statusResult.data ?? null);
    setConnections(connectionsResult.data?.connections ?? []);
    setNote(statusResult.error?.message ?? connectionsResult.error?.message ?? null);
    setIsLoading(false);
  }

  useEffect(() => {
    void loadCalendarSync();
  }, [familyId, syncSource]);

  async function tryGoogleConnect() {
    if (!familyId) {
      return;
    }

    const result = await apiRequest<CalendarConnectAttempt>("/calendar-sync/google/connect", {
      method: "POST",
      body: JSON.stringify({ familyId })
    });

    const authUrl = result.data?.authUrl;
    const message =
      result.data?.message ??
      result.error?.message ??
      "Google Calendar is unavailable right now.";

    setNote(authUrl ? `${message} Finish in your browser, then return here and refresh status.` : message);

    if (authUrl) {
      await Linking.openURL(authUrl);
    }

    void loadCalendarSync();
  }

  async function syncNow(connectionId?: string) {
    if (!familyId || syncSource !== "api") {
      setNote("Sync now needs a signed-in household.");
      return;
    }

    setIsSyncing(true);
    setNote("Syncing connected calendars...");

    const result = await apiRequest<CalendarSyncNowResponse>("/calendar-sync/sync", {
      method: "POST",
      body: JSON.stringify({
        familyId,
        ...(connectionId ? { connectionId } : {})
      })
    });

    setIsSyncing(false);

    if (!result.data) {
      setNote(result.error?.message ?? "Calendar import failed.");
      return;
    }

    setLastSyncByConnectionId((current) => {
      const next = { ...current };
      for (const item of result.data!.results) {
        next[item.connectionId] = item;
      }
      return next;
    });
    setNote(formatSyncSummary(result.data));
    await Promise.all([loadCalendarSync(), refreshFromBackend()]);
  }

  return (
    <View>
      {pinnedHeader ? (
        <View style={styles.largeTitleRow}>
          <View style={styles.largeTitleIcon}>
            <Text style={styles.largeTitleGlyph}>📅</Text>
          </View>
          <Text style={styles.largeTitleText}>Google Calendar</Text>
        </View>
      ) : (
        <ScreenHeader
          eyebrow="Calendar"
          title="Google Calendar"
          subtitle="Connect Google Calendar when you want to pull outside events into HomeThread. Plans you create in HomeThread still stay inside your shared household even without a connected calendar."
          icon="calendar"
          subtitleLines={3}
          actionLabel="Back"
          actionIcon="arrow-back"
          onActionPress={onBack}
        />
      )}

      {isLoading ? <Text style={styles.note}>Loading calendar status...</Text> : null}
      {note ? <Text style={styles.note}>{note}</Text> : null}

      {status ? (
        <Card>
          <Pill
            label={status.googleOAuthConfigured ? "Ready to connect" : "Not set up yet"}
            tone={status.googleOAuthConfigured ? "mint" : "neutral"}
          />
          <Text style={styles.statusMessage}>{status.message}</Text>
          <Text style={styles.helper}>
            Google Calendar: {status.googleConnectImplemented ? "ready" : "not set up yet"}
          </Text>
        </Card>
      ) : null}

      <Card>
        <SectionTitle title="Connected calendars" action={`${connections.length}`} />

        {connections.length > 0 ? (
          <View style={styles.stack}>
            {connections.map((connection) => {
              const lastSync = lastSyncByConnectionId[connection.id];
              return (
                <View key={connection.id} style={styles.connectionRow}>
                  <View style={styles.connectionHead}>
                    <View style={styles.connectionIconChip}>
                      <Text style={styles.connectionIconGlyph}>📅</Text>
                    </View>
                    <View style={styles.connectionCopy}>
                      <Text style={styles.connectionTitle}>{formatProviderLabel(connection.provider)}</Text>
                      <Text style={styles.helper}>
                        {connection.lastSyncedAt
                          ? `Last synced ${new Date(connection.lastSyncedAt).toLocaleString()}`
                          : "Never synced"}
                      </Text>
                      {connection.externalCalendarId ? (
                        <Text style={styles.helper}>Connected account: {connection.externalCalendarId}</Text>
                      ) : null}
                    </View>
                  </View>
                  {lastSync ? (
                    <Text style={styles.syncResult}>
                      Last run: {lastSync.added} added, {lastSync.skipped} skipped
                      {lastSync.failed > 0 ? `, ${lastSync.failed} failed` : ""}. {lastSync.message}
                    </Text>
                  ) : null}
                  <View style={styles.cardActions}>
                    <PrimaryButton
                      label={isSyncing ? "Syncing..." : "Sync now"}
                      icon="sync"
                      onPress={() => {
                        if (isSyncing) return;
                        void syncNow(connection.id);
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyTitle}>No calendars connected yet.</Text>
            <Text style={styles.emptyText}>
              Connect Google Calendar when you want HomeThread to pull outside events in. Household plans you add in
              HomeThread still save here even without a connected calendar.
            </Text>
          </View>
        )}

        <View style={styles.cardDivider} />

        <View style={styles.actions}>
          <PrimaryButton
            label="Connect Google Calendar"
            icon="link"
            onPress={() => {
              void tryGoogleConnect();
            }}
          />
          <PrimaryButton
            label={isSyncing ? "Syncing..." : "Sync all connections"}
            icon="sync"
            tone="soft"
            onPress={() => {
              if (isSyncing) return;
              void syncNow();
            }}
          />
          <PrimaryButton label="Refresh status" icon="refresh" tone="soft" onPress={() => void loadCalendarSync()} />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  // Large title (collapses into the pinned bar on scroll)
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
  note: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    marginTop: spacing.md
  },
  statusMessage: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: spacing.md
  },
  helper: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: spacing.sm
  },
  emptyBlock: {
    marginTop: spacing.sm
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "700"
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: spacing.sm
  },
  syncResult: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: spacing.sm
  },
  stack: {
    gap: spacing.md,
    marginTop: spacing.sm
  },
  connectionRow: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md
  },
  connectionHead: {
    flexDirection: "row",
    gap: spacing.sm
  },
  connectionIconChip: {
    alignItems: "center",
    backgroundColor: colors.skySoft,
    borderRadius: radii.md,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  connectionIconGlyph: {
    fontSize: 17
  },
  connectionCopy: {
    flex: 1,
    minWidth: 0
  },
  connectionTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: "700"
  },
  cardActions: {
    marginTop: spacing.md
  },
  cardDivider: {
    backgroundColor: colors.line,
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.md
  },
  actions: {
    gap: spacing.md
  }
});

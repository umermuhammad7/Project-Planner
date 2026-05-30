import { useEffect, useState } from "react";
import { Linking, StyleSheet, Text, TextInput, View } from "react-native";

import { Card, Pill, PrimaryButton, SectionTitle } from "../components/Primitives";
import { colors, radii, spacing } from "../constants/theme";
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
  if (provider === "ical") return "iCal feed";
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

export function CalendarSyncScreen({ onBack }: { onBack: () => void }) {
  const { familyId, syncSource, refreshFromBackend } = useHomeThreadStore();
  const [status, setStatus] = useState<CalendarSyncStatus | null>(null);
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [icalUrl, setIcalUrl] = useState("");
  const [lastSyncByConnectionId, setLastSyncByConnectionId] = useState<
    Record<string, CalendarSyncConnectionResult>
  >({});

  async function loadCalendarSync() {
    if (syncSource !== "api" || !familyId) {
      setStatus(null);
      setConnections([]);
      setNote("Calendar sync status needs API mode and a loaded family.");
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
      "Google Calendar connect is unavailable.";

    setNote(authUrl ? `${message} Finish in your browser, then return here and refresh status.` : message);

    if (authUrl) {
      await Linking.openURL(authUrl);
    }

    void loadCalendarSync();
  }

  async function saveIcalFeed() {
    if (!familyId || !icalUrl.trim()) {
      setNote("Paste an iCal feed URL before saving it.");
      return;
    }

    const result = await apiRequest<CalendarConnectAttempt>("/calendar-sync/ical", {
      method: "POST",
      body: JSON.stringify({ familyId, icalUrl: icalUrl.trim() })
    });

    setNote(
      result.data?.message ??
        result.error?.message ??
        "iCal feed connect is unavailable right now."
    );

    if (result.data?.ok) {
      setIcalUrl("");
      await loadCalendarSync();
    }
  }

  async function syncNow(connectionId?: string) {
    if (!familyId || syncSource !== "api") {
      setNote("Sync now needs API mode and a loaded family.");
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
      setNote(result.error?.message ?? "Calendar sync failed.");
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
      <PrimaryButton label="Back to plan" icon="arrow-back" tone="dark" onPress={onBack} />

      <Text style={styles.title}>Calendar sync</Text>
      <Text style={styles.subtitle}>
        Connect Google or save an iCal feed, then use Sync now to import future events manually. Background sync and
        remote edit/delete reconciliation are not implemented yet.
      </Text>

      {isLoading ? <Text style={styles.note}>Loading calendar status...</Text> : null}
      {note ? <Text style={styles.note}>{note}</Text> : null}

      {status ? (
        <Card>
          <Pill
            label={status.googleOAuthConfigured ? "OAuth configured" : "OAuth not configured"}
            tone={status.googleOAuthConfigured ? "mint" : "neutral"}
          />
          <Text style={styles.statusMessage}>{status.message}</Text>
          <Text style={styles.helper}>
            Google connect: {status.googleConnectImplemented ? "available" : "not configured"} - Manual iCal import:{" "}
            {status.icalImportImplemented ? "available" : "not available"}
          </Text>
        </Card>
      ) : null}

      <SectionTitle title="Connected calendars" action={`${connections.length}`} />
      {connections.length > 0 ? (
        <View style={styles.stack}>
          {connections.map((connection) => {
            const lastSync = lastSyncByConnectionId[connection.id];
            return (
            <Card key={connection.id}>
              <Text style={styles.connectionTitle}>{formatProviderLabel(connection.provider)}</Text>
              <Text style={styles.helper}>
                {connection.lastSyncedAt
                  ? `Last synced ${new Date(connection.lastSyncedAt).toLocaleString()}`
                  : "Never synced"}
              </Text>
              {connection.externalCalendarId ? (
                <Text style={styles.helper}>Calendar id: {connection.externalCalendarId}</Text>
              ) : null}
              {connection.icalUrl ? (
                <Text style={styles.helper} numberOfLines={1}>
                  Feed: {connection.icalUrl}
                </Text>
              ) : null}
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
            </Card>
            );
          })}
        </View>
      ) : (
        <Card>
          <Text style={styles.helper}>No external calendars are connected for this family yet.</Text>
        </Card>
      )}

      <View style={styles.actions}>
        <PrimaryButton label="Refresh status" icon="refresh" onPress={() => void loadCalendarSync()} />
        <PrimaryButton
          label={isSyncing ? "Syncing..." : "Sync all connections"}
          icon="sync"
          tone="dark"
          onPress={() => {
            if (isSyncing) return;
            void syncNow();
          }}
        />
        <PrimaryButton
          label="Try Google connect"
          icon="link"
          tone="dark"
          onPress={() => {
            void tryGoogleConnect();
          }}
        />
      </View>

      <SectionTitle title="iCal feed" />
      <Card>
        <Text style={styles.helper}>
          Paste a public iCal feed URL to save the connection, then use Sync now to import future events from that feed.
        </Text>
        <TextInput
          accessibilityLabel="iCal feed URL"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://example.com/family.ics"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={icalUrl}
          onChangeText={setIcalUrl}
        />
        <View style={styles.actions}>
          <PrimaryButton
            label="Save iCal feed"
            icon="link"
            onPress={() => {
              void saveIcalFeed();
            }}
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900",
    marginTop: spacing.lg
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm
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
  syncResult: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: spacing.sm
  },
  input: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    marginTop: spacing.md,
    padding: spacing.md
  },
  stack: {
    gap: spacing.md
  },
  connectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    textTransform: "capitalize"
  },
  cardActions: {
    marginTop: spacing.md
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.lg
  }
});

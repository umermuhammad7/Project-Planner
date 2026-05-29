import { useEffect, useState } from "react";
import { Linking, StyleSheet, Text, TextInput, View } from "react-native";

import { Card, Pill, PrimaryButton, SectionTitle } from "../components/Primitives";
import { colors, radii, spacing } from "../constants/theme";
import { apiRequest } from "../services/api";
import { useHomeThreadStore } from "../store/useHomeThreadStore";
import { CalendarConnectAttempt, CalendarConnection, CalendarSyncStatus } from "../types";

export function CalendarSyncScreen({ onBack }: { onBack: () => void }) {
  const { familyId, syncSource } = useHomeThreadStore();
  const [status, setStatus] = useState<CalendarSyncStatus | null>(null);
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [icalUrl, setIcalUrl] = useState("");

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

  return (
    <View>
      <PrimaryButton label="Back to plan" icon="arrow-back" tone="dark" onPress={onBack} />

      <Text style={styles.title}>Calendar sync</Text>
      <Text style={styles.subtitle}>
        Connect external calendars when OAuth and sync jobs are configured. Nothing is faked in this build.
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
            Google connect: {status.googleConnectImplemented ? "available" : "not implemented"} - iCal import:{" "}
            {status.icalImportImplemented ? "available" : "not implemented"}
          </Text>
        </Card>
      ) : null}

      <SectionTitle title="Connected calendars" action={`${connections.length}`} />
      {connections.length > 0 ? (
        <View style={styles.stack}>
          {connections.map((connection) => (
            <Card key={connection.id}>
              <Text style={styles.connectionTitle}>{connection.provider}</Text>
              <Text style={styles.helper}>
                {connection.lastSyncedAt
                  ? `Last synced ${new Date(connection.lastSyncedAt).toLocaleString()}`
                  : "Never synced"}
              </Text>
            </Card>
          ))}
        </View>
      ) : (
        <Card>
          <Text style={styles.helper}>No external calendars are connected for this family yet.</Text>
        </Card>
      )}

      <View style={styles.actions}>
        <PrimaryButton label="Refresh status" icon="sync" onPress={() => void loadCalendarSync()} />
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
          Paste a public iCal feed URL to remember it for this family. HomeThread will save the connection, but automatic event import is not implemented yet.
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
  actions: {
    gap: spacing.md,
    marginTop: spacing.lg
  }
});

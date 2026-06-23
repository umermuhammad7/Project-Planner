import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card, MemberAvatar, Pill, PrimaryButton, Row } from "../components/Primitives";
import { ScreenHeader } from "../components/ScreenHeader";
import { colors, fonts, radii, spacing } from "../constants/theme";
import { FamilyMember } from "../types";

export function KidsModePickerScreen({
  kidMembers,
  onSelect,
  onCancel
}: {
  kidMembers: FamilyMember[];
  onSelect: (memberId: string) => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.screen}>
      <ScreenHeader
        eyebrow="Kids mode"
        title="Who is using this device?"
        subtitle="Parent handoff on a signed-in device - pick the child profile for this session."
        icon="happy"
        actionLabel="Cancel"
        actionIcon="close"
        onActionPress={onCancel}
        density="compact"
      />

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Parent handoff only</Text>
        <Text style={styles.noticeText}>
          Kids mode does not sign a child in on their own device. A parent stays signed in and hands off chores and stars.
        </Text>
      </View>

      <View style={styles.stack}>
        {kidMembers.map((member) => (
          <Pressable
            key={member.id}
            accessibilityRole="button"
            accessibilityLabel={`Open Kids mode for ${member.name}`}
            onPress={() => onSelect(member.id)}
          >
            <Card>
              <Row>
                <MemberAvatar member={member} size={48} />
                <View style={styles.copy}>
                  <Text style={styles.name}>{member.name}</Text>
                  <Text style={styles.meta}>Chores and stars for this child only</Text>
                </View>
                <Pill label={`${member.starBalance} stars`} tone="gold" icon="star" />
              </Row>
            </Card>
          </Pressable>
        ))}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.md
  },
  notice: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md
  },
  noticeTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800"
  },
  noticeText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19
  },
  stack: {
    gap: spacing.sm
  },
  copy: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  name: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700"
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19
  }
});

import { StyleSheet, Text, View } from "react-native";

import { THEME } from "@/constants/theme";
import { formatEventTime } from "@/services/schedule";
import type { ScheduleEvent } from "@/types/schedule";

interface ScheduleEventCardProps {
  readonly event: ScheduleEvent;
  readonly isOnAir: boolean;
}

export function ScheduleEventCard({ event, isOnAir }: ScheduleEventCardProps) {
  const time = formatEventTime(event);

  return (
    <View style={[styles.card, isOnAir && styles.onAirCard]}>
      <View style={styles.titleRow}>
        <Text accessibilityRole="header" style={styles.title}>{event.title}</Text>
        {isOnAir && (
          <View
            accessible
            accessibilityLabel="Currently on air"
            accessibilityLiveRegion="polite"
            style={styles.onAirBadge}
          >
            <View style={styles.onAirDot} />
            <Text style={styles.onAirText}>ON AIR</Text>
          </View>
        )}
      </View>
      <Text accessibilityLabel={time.accessibilityLabel} style={styles.time}>{time.display}</Text>
      {event.description && <Text style={styles.detail}>{event.description}</Text>}
      {event.location && <Text style={styles.detail}>Location: {event.location}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: THEME.spacing.lg,
    marginBottom: THEME.spacing.md,
    padding: THEME.spacing.lg,
    gap: THEME.spacing.sm,
    backgroundColor: THEME.colors.surface,
    borderColor: THEME.colors.border,
    borderWidth: 1,
    borderRadius: THEME.radius.lg,
    shadowColor: THEME.shadow.color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  onAirCard: {
    backgroundColor: THEME.colors.liveSurface,
    borderColor: THEME.colors.live,
    borderWidth: 2,
  },
  titleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: THEME.spacing.sm,
  },
  title: {
    flexGrow: 1,
    flexShrink: 1,
    color: THEME.colors.text,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700",
  },
  time: {
    color: THEME.colors.text,
    fontSize: THEME.fontSize.body,
    lineHeight: 24,
    fontWeight: "600",
  },
  detail: {
    color: THEME.colors.muted,
    fontSize: THEME.fontSize.body,
    lineHeight: 24,
  },
  onAirBadge: {
    minHeight: 32,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.pill,
  },
  onAirDot: {
    width: 8,
    height: 8,
    backgroundColor: THEME.colors.live,
    borderRadius: 4,
  },
  onAirText: {
    color: THEME.colors.live,
    fontSize: THEME.fontSize.caption,
    fontWeight: "800",
    letterSpacing: 1,
  },
});

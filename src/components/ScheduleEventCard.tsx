import { StyleSheet, Text, View } from "react-native";

import { createThemedStyles } from "@/hooks/useThemedStyles";
import { formatEventTime } from "@/services/schedule";
import type { ScheduleEvent } from "@/types/schedule";

interface ScheduleEventCardProps {
  readonly event: ScheduleEvent;
  readonly isOnAir: boolean;
}

export function ScheduleEventCard({ event, isOnAir }: ScheduleEventCardProps) {
  const { styles } = useStyles();
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

const useStyles = createThemedStyles((theme) => ({
  card: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    shadowColor: theme.shadow.color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  onAirCard: {
    backgroundColor: theme.colors.liveSurface,
    borderColor: theme.colors.live,
    borderWidth: 2,
  },
  titleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
  },
  title: {
    flexGrow: 1,
    flexShrink: 1,
    color: theme.colors.text,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700",
  },
  time: {
    color: theme.colors.text,
    fontSize: theme.fontSize.body,
    lineHeight: 24,
    fontWeight: "600",
  },
  detail: {
    color: theme.colors.muted,
    fontSize: theme.fontSize.body,
    lineHeight: 24,
  },
  onAirBadge: {
    minHeight: 32,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
  },
  onAirDot: {
    width: 8,
    height: 8,
    backgroundColor: theme.colors.live,
    borderRadius: 4,
  },
  onAirText: {
    color: theme.colors.live,
    fontSize: theme.fontSize.caption,
    fontWeight: "800",
    letterSpacing: 1,
  },
}));

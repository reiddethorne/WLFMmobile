import Ionicons from "@expo/vector-icons/Ionicons";
import { Text, View } from "react-native";

import { usePreferences } from "@/context/PreferencesContext";
import { createThemedStyles } from "@/hooks/useThemedStyles";
import { formatEventTime } from "@/services/schedule";
import type { ScheduleEvent } from "@/types/schedule";

interface ScheduleEventCardProps {
  readonly event: ScheduleEvent;
  readonly isOnAir: boolean;
  readonly isUpNext: boolean;
}

export function ScheduleEventCard({ event, isOnAir, isUpNext }: ScheduleEventCardProps) {
  const { scheduleTimeMode } = usePreferences();
  const { styles, theme } = useStyles();
  const time = formatEventTime(event, scheduleTimeMode);

  return (
    <View style={[
      styles.card,
      isOnAir && styles.onAirCard,
    ]}>
      <View style={styles.metaRow}>
        <Text
          accessibilityLabel={time.accessibilityLabel}
          style={[styles.time, isOnAir && styles.liveTime]}
        >
          {time.display}
        </Text>
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
        {!isOnAir && isUpNext && (
          <View accessible accessibilityLabel="Up next" style={styles.upNextBadge}>
            <Text style={styles.upNextText}>UP NEXT</Text>
          </View>
        )}
      </View>
      <Text accessibilityRole="header" style={styles.title}>{event.title}</Text>
      {event.description && <Text style={styles.detail}>{event.description}</Text>}
      {event.location && (
        <View style={styles.locationRow}>
          <Ionicons color={theme.colors.muted} name="location-outline" size={16} />
          <Text style={[styles.detail, styles.location]}>{event.location}</Text>
        </View>
      )}
    </View>
  );
}

const useStyles = createThemedStyles((theme) => ({
  card: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 10,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    shadowColor: theme.shadow.color,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: theme.scheme === "dark" ? 0.2 : 0.07,
    shadowRadius: 12,
    elevation: 2,
  },
  onAirCard: {
    backgroundColor: theme.colors.liveSurface,
    borderColor: theme.colors.live,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  title: {
    color: theme.colors.text,
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "800",
  },
  time: {
    color: theme.colors.muted,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  liveTime: {
    color: theme.colors.live,
  },
  detail: {
    color: theme.colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  locationRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  location: {
    flex: 1,
  },
  onAirBadge: {
    minHeight: 28,
    paddingHorizontal: 10,
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
  upNextBadge: {
    minHeight: 28,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.pill,
  },
  upNextText: {
    color: theme.colors.muted,
    fontSize: theme.fontSize.caption,
    fontWeight: "800",
    letterSpacing: 1,
  },
}));

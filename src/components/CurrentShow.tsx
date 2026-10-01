import { StyleSheet, Text, View } from "react-native";

import { THEME } from "@/constants/theme";
import { useSchedule } from "@/hooks/useSchedule";
import { formatEventDate, formatEventTime } from "@/services/schedule";

export function CurrentShow() {
  const { currentEvent, error, nextEvent, status } = useSchedule();

  if (currentEvent) {
    const date = formatEventDate(currentEvent);
    const time = formatEventTime(currentEvent);
    const schedule = `${date} · ${time.display}`;

    return (
      <View
        accessible
        accessibilityLabel={`Currently on air: ${currentEvent.title}. ${date}, ${time.accessibilityLabel}`}
        accessibilityLiveRegion="polite"
        style={[styles.container, styles.onAirContainer]}
      >
        <View style={styles.labelRow}>
          <View style={styles.liveDot} />
          <Text style={[styles.label, styles.onAirLabel]}>ON AIR</Text>
        </View>
        <Text numberOfLines={2} style={styles.title}>{currentEvent.title}</Text>
        <Text accessibilityLabel={`${date}, ${time.accessibilityLabel}`} style={styles.time}>{schedule}</Text>
      </View>
    );
  }

  if (nextEvent) {
    const date = formatEventDate(nextEvent);
    const time = formatEventTime(nextEvent);
    const schedule = `${date} · ${time.display}`;

    return (
      <View
        accessible
        accessibilityLabel={`Up next: ${nextEvent.title}. ${date}, ${time.accessibilityLabel}`}
        accessibilityLiveRegion="polite"
        style={styles.container}
      >
        <Text style={styles.label}>UP NEXT</Text>
        <Text numberOfLines={2} style={styles.title}>{nextEvent.title}</Text>
        <Text accessibilityLabel={`${date}, ${time.accessibilityLabel}`} style={styles.time}>{schedule}</Text>
      </View>
    );
  }

  const message = status === "loading"
    ? "Loading current show…"
    : error
      ? "Current show unavailable"
      : "No upcoming shows are scheduled";

  return (
    <View
      accessible
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
      style={styles.container}
    >
      <Text style={styles.label}>CURRENT SHOW</Text>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: THEME.spacing.lg,
    padding: THEME.spacing.md,
    gap: THEME.spacing.xs,
    backgroundColor: THEME.colors.surfaceMuted,
    borderColor: THEME.colors.border,


  },
  onAirContainer: {
    backgroundColor: THEME.colors.liveSurface,
    borderColor: THEME.colors.live,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    backgroundColor: THEME.colors.live,
    borderRadius: 4,
  },
  label: {
    color: THEME.colors.muted,
    fontSize: THEME.fontSize.caption,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  onAirLabel: {
    color: THEME.colors.live,
  },
  title: {
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
  emptyText: {
    color: THEME.colors.muted,
    fontSize: THEME.fontSize.body,
    lineHeight: 24,
  },
});

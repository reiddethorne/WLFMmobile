import { useRef, useState } from "react";
import {
  Animated,
  Easing,
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { THEME } from "@/constants/theme";
import { useSchedule } from "@/hooks/useSchedule";
import { formatEventDate, formatEventTime } from "@/services/schedule";
import type { TimedScheduleEvent } from "@/types/schedule";

interface ShowBannerProps {
  readonly accessibilityPrefix: string;
  readonly event: TimedScheduleEvent;
  readonly label: string;
  readonly onAir?: boolean;
}

function ShowBanner({ accessibilityPrefix, event, label, onAir = false }: ShowBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const disclosureProgress = useRef(new Animated.Value(0)).current;
  const textProgress = useRef(new Animated.Value(1)).current;
  const date = formatEventDate(event);
  const time = formatEventTime(event);
  const schedule = `${date} · ${time.display}`;
  const accessibilityLabel = [
    `${accessibilityPrefix}: ${event.title}`,
    `${date}, ${time.accessibilityLabel}`,
    event.description,
    event.location ? `Location: ${event.location}` : null,
  ].filter(Boolean).join(". ");

  const toggleExpanded = () => {
    const nextExpanded = !expanded;
    LayoutAnimation.configureNext(LayoutAnimation.create(
      260,
      LayoutAnimation.Types.easeInEaseOut,
      LayoutAnimation.Properties.opacity,
    ));
    Animated.timing(disclosureProgress, {
      toValue: nextExpanded ? 1 : 0,
      duration: 220,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
    textProgress.stopAnimation();
    textProgress.setValue(0);
    setExpanded(nextExpanded);
    Animated.timing(textProgress, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const disclosureScale = disclosureProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, -1],
  });
  const textOffset = textProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 0],
  });
  const textOpacity = textProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.78, 1],
  });

  return (
    <Pressable
      accessibilityHint={expanded ? "Collapses show details" : "Expands show details"}
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={toggleExpanded}
      style={({ pressed }) => [
        styles.container,
        styles.interactiveContainer,
        onAir && styles.onAirContainer,
        pressed && styles.pressedContainer,
      ]}
    >
      <View style={[styles.statusArea, styles.interactiveStatusArea]}>
        {onAir && <View style={styles.liveDot} />}
        <Text style={[styles.label, onAir && styles.onAirLabel]}>{label}</Text>
      </View>
      <Animated.View
        style={[
          styles.showDetails,
          { opacity: textOpacity, transform: [{ translateY: textOffset }] },
        ]}
      >
        <Text numberOfLines={expanded ? undefined : 1} style={styles.title}>{event.title}</Text>
        <Text
          accessibilityLabel={`${date}, ${time.accessibilityLabel}`}
          numberOfLines={expanded ? undefined : 1}
          style={styles.time}
        >
          {schedule}
        </Text>
        {expanded && (event.description || event.location) && (
          <View style={styles.extraDetails}>
            {event.description && <Text style={styles.detail}>{event.description}</Text>}
            {event.location && <Text style={styles.detail}>Location: {event.location}</Text>}
          </View>
        )}
      </Animated.View>
      <Animated.Text
        accessible={false}
        style={[styles.disclosure, { transform: [{ scaleY: disclosureScale }] }]}
      >
        ⌄
      </Animated.Text>
    </Pressable>
  );
}

export function CurrentShow() {
  const { currentEvent, error, nextEvent, status } = useSchedule();

  if (currentEvent) {
    return (
      <ShowBanner
        accessibilityPrefix="Currently on air"
        event={currentEvent}
        key={`current-${currentEvent.id}`}
        label="ON AIR"
        onAir
      />
    );
  }

  if (nextEvent) {
    return (
      <ShowBanner
        accessibilityPrefix="Up next"
        event={nextEvent}
        key={`next-${nextEvent.id}`}
        label="UP NEXT"
      />
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
      <View style={styles.statusArea}>
        <Text style={styles.label}>CURRENT</Text>
      </View>
      <Text numberOfLines={1} style={styles.emptyText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    minHeight: 64,
    marginBottom: THEME.spacing.lg,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.spacing.md,
    backgroundColor: THEME.colors.surfaceMuted,
    borderColor: THEME.colors.border,
    borderWidth: 1,
    borderTopWidth: 0,
    borderLeftColor: THEME.colors.accent,
    borderLeftWidth: 4,
    borderBottomLeftRadius: THEME.radius.md,
    borderBottomRightRadius: THEME.radius.md,
  },
  onAirContainer: {
    backgroundColor: THEME.colors.liveSurface,
    borderColor: THEME.colors.live,
    borderLeftColor: THEME.colors.live,
  },
  interactiveContainer: {
    alignItems: "flex-start",
  },
  pressedContainer: {
    opacity: 0.82,
  },
  statusArea: {
    width: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  interactiveStatusArea: {
    marginTop: 15,
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
  showDetails: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  disclosure: {
    width: 20,
    marginTop: 10,
    color: THEME.colors.muted,
    fontSize: 22,
    lineHeight: 24,
    textAlign: "center",
  },
  title: {
    color: THEME.colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
  },
  time: {
    color: THEME.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  extraDetails: {
    marginTop: THEME.spacing.sm,
    gap: THEME.spacing.xs,
  },
  detail: {
    color: THEME.colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyText: {
    flex: 1,
    color: THEME.colors.muted,
    fontSize: 15,
    lineHeight: 20,
  },
});

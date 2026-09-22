import { ActivityIndicator, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";

import { ScheduleEventCard } from "@/components/ScheduleEventCard";
import { ScheduleSectionHeader } from "@/components/ScheduleSectionHeader";
import { THEME } from "@/constants/theme";
import type { ScheduleLoadError, ScheduleStatus } from "@/hooks/useSchedule";
import { formatEventTime, formatScheduleDate, getStationDateKey, type ScheduleSection } from "@/services/schedule";
import type { ScheduleEvent, TimedScheduleEvent } from "@/types/schedule";

interface ScheduleListProps {
  readonly sections: readonly ScheduleSection[];
  readonly currentEvent: TimedScheduleEvent | null;
  readonly nextEvent: TimedScheduleEvent | null;
  readonly status: ScheduleStatus;
  readonly error: ScheduleLoadError | null;
  readonly isRefreshing: boolean;
  readonly onRefresh: () => void;
  readonly onRetry: () => void;
}

function Header({ currentEvent, nextEvent, error, onRetry }: Pick<
  ScheduleListProps,
  "currentEvent" | "nextEvent" | "error" | "onRetry"
>) {
  const nextTime = nextEvent ? formatEventTime(nextEvent) : null;
  return (
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.heading}>Schedule</Text>
      <Text style={styles.subheading}>WLFM programs for the next 14 days · Central Time</Text>
      {currentEvent ? (
        <View accessible accessibilityLabel={`On air now, ${currentEvent.title}`} style={[styles.highlight, styles.liveHighlight]}>
          <Text style={[styles.eyebrow, styles.liveText]}>ON AIR NOW</Text>
          <Text style={styles.highlightTitle}>{currentEvent.title}</Text>
        </View>
      ) : nextEvent && nextTime ? (
        <View
          accessible
          accessibilityLabel={`Up next, ${nextEvent.title}, ${formatScheduleDate(getStationDateKey(nextEvent))}, ${nextTime.accessibilityLabel}`}
          style={styles.highlight}
        >
          <Text style={styles.eyebrow}>UP NEXT</Text>
          <Text style={styles.highlightTitle}>{nextEvent.title}</Text>
          <Text style={styles.highlightDetail}>
            {formatScheduleDate(getStationDateKey(nextEvent))} · {nextTime.display}
          </Text>
        </View>
      ) : null}
      {error && (
        <View accessibilityLiveRegion="polite" style={styles.refreshWarning}>
          <View style={styles.warningText}>
            <Text style={styles.warningTitle}>Refresh failed</Text>
            <Text style={styles.warningMessage}>{error.message} Showing the last schedule.</Text>
          </View>
          <RetryButton label="Try again" onPress={onRetry} />
        </View>
      )}
    </View>
  );
}

function RetryButton({ label, onPress }: { readonly label: string; readonly onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={`${label} loading the schedule`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function ScreenHeading() {
  return (
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.heading}>Schedule</Text>
      <Text style={styles.subheading}>WLFM programs for the next 14 days · Central Time</Text>
    </View>
  );
}

export function ScheduleList({
  sections,
  currentEvent,
  nextEvent,
  status,
  error,
  isRefreshing,
  onRefresh,
  onRetry,
}: ScheduleListProps) {
  if (status === "loading") {
    return (
      <View style={styles.stateScreen}>
        <ScreenHeading />
        <View accessibilityLiveRegion="polite" style={styles.centeredState}>
          <ActivityIndicator accessibilityLabel="Loading schedule" color={THEME.colors.text} size="large" />
          <Text style={styles.stateTitle}>Loading the schedule…</Text>
        </View>
      </View>
    );
  }

  if (status === "error" && error) {
    return (
      <View style={styles.stateScreen}>
        <ScreenHeading />
        <View accessibilityLiveRegion="polite" style={styles.centeredState}>
          <Text accessibilityRole="header" style={styles.stateTitle}>{error.title}</Text>
          <Text style={styles.stateMessage}>{error.message}</Text>
          <RetryButton label="Retry" onPress={onRetry} />
        </View>
      </View>
    );
  }

  return (
    <SectionList<ScheduleEvent, ScheduleSection>
      contentContainerStyle={[styles.listContent, sections.length === 0 && styles.emptyListContent]}
      keyExtractor={(event) => event.id}
      ListEmptyComponent={(
        <View style={styles.emptyState}>
          <Text accessibilityRole="header" style={styles.stateTitle}>No programs scheduled</Text>
          <Text style={styles.stateMessage}>There are no WLFM programs listed for the next 14 days.</Text>
          <RetryButton label="Refresh" onPress={onRefresh} />
        </View>
      )}
      ListHeaderComponent={(
        <Header currentEvent={currentEvent} nextEvent={nextEvent} error={error} onRetry={onRetry} />
      )}
      refreshControl={(
        <RefreshControl
          accessibilityLabel="Refresh schedule"
          colors={[THEME.colors.text]}
          onRefresh={onRefresh}
          refreshing={isRefreshing}
          tintColor={THEME.colors.text}
        />
      )}
      renderItem={({ item }) => (
        <View style={styles.contentWidth}>
          <ScheduleEventCard event={item} isOnAir={currentEvent?.id === item.id} />
        </View>
      )}
      renderSectionHeader={({ section }) => <ScheduleSectionHeader title={section.title} />}
      sections={sections}
      stickySectionHeadersEnabled
    />
  );
}

const styles = StyleSheet.create({
  stateScreen: {
    flex: 1,
  },
  header: {
    width: "100%",
    maxWidth: THEME.contentMaxWidth,
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.xl,
    paddingBottom: THEME.spacing.lg,
    gap: THEME.spacing.sm,
    alignSelf: "center",
  },
  heading: {
    color: THEME.colors.text,
    fontSize: THEME.fontSize.heading,
    lineHeight: 44,
    fontWeight: "800",
  },
  subheading: {
    color: THEME.colors.muted,
    fontSize: THEME.fontSize.body,
    lineHeight: 24,
  },
  highlight: {
    marginTop: THEME.spacing.md,
    padding: THEME.spacing.lg,
    gap: THEME.spacing.xs,
    backgroundColor: THEME.colors.surfaceMuted,
    borderColor: THEME.colors.border,
    borderWidth: 1,
    borderRadius: THEME.radius.lg,
  },
  liveHighlight: {
    backgroundColor: THEME.colors.liveSurface,
    borderColor: THEME.colors.live,
  },
  eyebrow: {
    color: THEME.colors.muted,
    fontSize: THEME.fontSize.caption,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  liveText: {
    color: THEME.colors.live,
  },
  highlightTitle: {
    color: THEME.colors.text,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700",
  },
  highlightDetail: {
    color: THEME.colors.muted,
    fontSize: THEME.fontSize.body,
    lineHeight: 24,
  },
  refreshWarning: {
    marginTop: THEME.spacing.md,
    padding: THEME.spacing.md,
    gap: THEME.spacing.md,
    backgroundColor: THEME.colors.liveSurface,
    borderColor: THEME.colors.error,
    borderWidth: 1,
    borderRadius: THEME.radius.md,
  },
  warningText: {
    gap: THEME.spacing.xs,
  },
  warningTitle: {
    color: THEME.colors.error,
    fontSize: THEME.fontSize.body,
    lineHeight: 24,
    fontWeight: "700",
  },
  warningMessage: {
    color: THEME.colors.text,
    fontSize: THEME.fontSize.body,
    lineHeight: 24,
  },
  button: {
    minHeight: 52,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.md,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    backgroundColor: THEME.colors.text,
    borderRadius: THEME.radius.pill,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonText: {
    color: THEME.colors.surface,
    fontSize: THEME.fontSize.body,
    fontWeight: "700",
  },
  centeredState: {
    width: "100%",
    maxWidth: THEME.contentMaxWidth,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.xxl,
    alignItems: "flex-start",
    gap: THEME.spacing.md,
    alignSelf: "center",
  },
  emptyState: {
    width: "100%",
    maxWidth: THEME.contentMaxWidth,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.xl,
    gap: THEME.spacing.md,
    alignSelf: "center",
  },
  stateTitle: {
    color: THEME.colors.text,
    fontSize: THEME.fontSize.title,
    lineHeight: 36,
    fontWeight: "700",
  },
  stateMessage: {
    color: THEME.colors.muted,
    fontSize: THEME.fontSize.body,
    lineHeight: 24,
  },
  listContent: {
    paddingBottom: THEME.spacing.xxxl,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  contentWidth: {
    width: "100%",
    maxWidth: THEME.contentMaxWidth,
    alignSelf: "center",
  },
});

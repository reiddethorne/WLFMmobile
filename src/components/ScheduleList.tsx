import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, SectionList, StyleSheet, Text, TextInput, View } from "react-native";

import { ScheduleEventCard } from "@/components/ScheduleEventCard";
import { ScheduleFilters } from "@/components/ScheduleFilters";
import { ScheduleSectionHeader } from "@/components/ScheduleSectionHeader";
import { THEME } from "@/constants/theme";
import type { ScheduleLoadError, ScheduleStatus } from "@/hooks/useSchedule";
import {
  filterScheduleSections,
  formatEventTime,
  formatScheduleDate,
  formatShortScheduleDate,
  getStationDateKey,
  type ScheduleSection,
} from "@/services/schedule";
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

function Header({
  error,
  hasFilters,
  onClear,
  onRetry,
  onChangeQuery,
  onToggleSearch,
  query,
  searchVisible,
}: Pick<
  ScheduleListProps,
  "error" | "onRetry"
> & {
  readonly hasFilters: boolean;
  readonly onClear: () => void;
  readonly onChangeQuery: (query: string) => void;
  readonly onToggleSearch: () => void;
  readonly query: string;
  readonly searchVisible: boolean;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headingRow}>
        <Text accessibilityRole="header" style={styles.heading}>Schedule</Text>
        <View style={styles.headingActions}>
          {hasFilters && (
            <Pressable
              accessibilityLabel="Clear schedule filters"
              accessibilityRole="button"
              onPress={onClear}
              style={({ pressed }) => [styles.clearFiltersButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.clearFiltersText}>Clear filters</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityLabel={searchVisible ? "Close schedule search" : "Search schedule"}
            accessibilityRole="button"
            onPress={onToggleSearch}
            style={({ pressed }) => [styles.searchButton, pressed && styles.buttonPressed]}
          >
            <Ionicons
              color={THEME.colors.text}
              name={searchVisible ? "close" : "search"}
              size={24}
            />
          </Pressable>
        </View>
      </View>
      {searchVisible && (
        <TextInput
          accessibilityLabel="Search scheduled programs"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          clearButtonMode="while-editing"
          onChangeText={onChangeQuery}
          placeholder="Search programs..."
          placeholderTextColor={THEME.colors.muted}
          returnKeyType="search"
          style={styles.searchInput}
          value={query}
        />
      )}
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

function ScheduleHighlight({ currentEvent, nextEvent, sections }: Pick<
  ScheduleListProps,
  "currentEvent" | "nextEvent"
> & { readonly sections: readonly ScheduleSection[] }) {
  const includesEvent = (event: TimedScheduleEvent | null) => event !== null && sections.some(
    (section) => section.data.some((item) => item.id === event.id),
  );
  const visibleCurrentEvent = includesEvent(currentEvent) ? currentEvent : null;
  const visibleNextEvent = includesEvent(nextEvent) ? nextEvent : null;
  const nextTime = visibleNextEvent ? formatEventTime(visibleNextEvent) : null;

  if (!visibleCurrentEvent && (!visibleNextEvent || !nextTime)) return null;

  return (
    <View style={styles.highlightContainer}>
      {visibleCurrentEvent ? (
        <View accessible accessibilityLabel={`On air now, ${visibleCurrentEvent.title}`} style={[styles.highlight, styles.liveHighlight]}>
          <Text style={[styles.eyebrow, styles.liveText]}>ON AIR NOW</Text>
          <Text style={styles.highlightTitle}>{visibleCurrentEvent.title}</Text>
        </View>
      ) : visibleNextEvent && nextTime ? (
        <View
          accessible
          accessibilityLabel={`Up next, ${visibleNextEvent.title}, ${formatScheduleDate(getStationDateKey(visibleNextEvent))}, ${nextTime.accessibilityLabel}`}
          style={styles.highlight}
        >
          <Text style={styles.eyebrow}>UP NEXT</Text>
          <Text style={styles.highlightTitle}>{visibleNextEvent.title}</Text>
          <Text style={styles.highlightDetail}>
            {formatShortScheduleDate(getStationDateKey(visibleNextEvent))} · {nextTime.display}
          </Text>
        </View>
      ) : null}
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
  const [query, setQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const filterDates = useMemo(
    () => sections.map((section) => ({
      value: section.date,
      label: formatShortScheduleDate(section.date),
    })),
    [sections],
  );
  const filteredSections = useMemo(
    () => filterScheduleSections(sections, query, selectedDate),
    [query, sections, selectedDate],
  );
  const hasFilters = query.trim().length > 0 || selectedDate !== null;

  useEffect(() => {
    if (selectedDate !== null && !sections.some((section) => section.date === selectedDate)) {
      setSelectedDate(null);
    }
  }, [sections, selectedDate]);

  const clearFilters = () => {
    setQuery("");
    setSelectedDate(null);
  };

  const toggleSearch = () => {
    if (searchVisible) setQuery("");
    setSearchVisible((visible) => !visible);
  };

  if (status === "loading") {
    return (
      <View style={styles.stateScreen}>
        <ScreenHeading />
        <View accessibilityLiveRegion="polite" style={styles.centeredState}>
          <ActivityIndicator accessibilityLabel="Loading schedule" color={THEME.colors.text} size="large" />
          <Text style={styles.stateTitle}>Loading schedule…</Text>
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
      contentContainerStyle={[styles.listContent, filteredSections.length === 0 && styles.emptyListContent]}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      keyExtractor={(event) => event.id}
      ListEmptyComponent={(
        <View style={styles.emptyState}>
          <Text accessibilityRole="header" style={styles.stateTitle}>
            {hasFilters ? "No matching programs" : "No programs scheduled"}
          </Text>
          <Text style={styles.stateMessage}>
            {hasFilters
              ? "Try a different search or date."
              : "There are no WLFM programs listed for the next 14 days."}
          </Text>
          {hasFilters
            ? <RetryButton label="Clear filters" onPress={clearFilters} />
            : <RetryButton label="Refresh" onPress={onRefresh} />}
        </View>
      )}
      ListHeaderComponent={(
        <View>
          <Header
            error={error}
            hasFilters={hasFilters}
            onClear={clearFilters}
            onChangeQuery={setQuery}
            onRetry={onRetry}
            onToggleSearch={toggleSearch}
            query={query}
            searchVisible={searchVisible}
          />
          <ScheduleFilters
            dates={filterDates}
            onSelectDate={setSelectedDate}
            selectedDate={selectedDate}
          />
          <ScheduleHighlight
            currentEvent={currentEvent}
            nextEvent={nextEvent}
            sections={filteredSections}
          />
        </View>
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
      sections={filteredSections}
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
    paddingBottom: THEME.spacing.sm,
    gap: THEME.spacing.sm,
    alignSelf: "center",
  },
  heading: {
    color: THEME.colors.text,
    fontSize: THEME.fontSize.heading,
    lineHeight: 44,
    fontWeight: "800",
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: THEME.spacing.md,
  },
  headingActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.spacing.sm,
  },
  clearFiltersButton: {
    minHeight: 44,
    justifyContent: "center",
  },
  clearFiltersText: {
    color: THEME.colors.text,
    fontSize: 14,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  searchButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: THEME.colors.surface,
    borderColor: THEME.colors.border,
    borderWidth: 1,
    borderRadius: THEME.radius.pill,
  },
  searchInput: {
    width: "100%",
    maxWidth: 400,
    minHeight: 48,
    paddingHorizontal: THEME.spacing.md,
    alignSelf: "flex-end",
    color: THEME.colors.text,
    fontSize: THEME.fontSize.body,
    backgroundColor: THEME.colors.surface,
    borderColor: THEME.colors.border,
    borderWidth: 1,
    borderRadius: THEME.radius.md,
  },
  subheading: {
    color: THEME.colors.muted,
    fontSize: THEME.fontSize.body,
    lineHeight: 24,
  },
  highlight: {
    padding: THEME.spacing.lg,
    gap: THEME.spacing.xs,
    backgroundColor: THEME.colors.surfaceMuted,
    borderColor: THEME.colors.border,
    borderWidth: 1,
    borderRadius: THEME.radius.lg,
  },
  highlightContainer: {
    width: "100%",
    maxWidth: THEME.contentMaxWidth,
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.md,
    alignSelf: "center",
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

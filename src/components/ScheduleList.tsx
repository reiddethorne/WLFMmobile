import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, SectionList, StyleSheet, Text, TextInput, View } from "react-native";

import { ScheduleEventCard } from "@/components/ScheduleEventCard";
import { ScheduleFilters } from "@/components/ScheduleFilters";
import { ScheduleSectionHeader } from "@/components/ScheduleSectionHeader";
import { createThemedStyles } from "@/hooks/useThemedStyles";
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
  const { styles, theme } = useStyles();

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
              color={theme.colors.icon}
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
          placeholderTextColor={theme.colors.muted}
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
  const { styles } = useStyles();
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
  const { styles } = useStyles();

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
  const { styles } = useStyles();

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
  const { styles, theme } = useStyles();
  const [query, setQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [holdRefreshIndicator, setHoldRefreshIndicator] = useState(false);
  const isDragging = useRef(false);
  const releaseFrame = useRef<number | null>(null);
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

  const cancelIndicatorRelease = useCallback(() => {
    if (releaseFrame.current === null) return;
    cancelAnimationFrame(releaseFrame.current);
    releaseFrame.current = null;
  }, []);

  const releaseIndicator = useCallback(() => {
    if (releaseFrame.current !== null) return;
    releaseFrame.current = requestAnimationFrame(() => {
      releaseFrame.current = null;
      setHoldRefreshIndicator(false);
    });
  }, []);

  useEffect(() => {
    if (!isRefreshing && !isDragging.current) releaseIndicator();
  }, [isRefreshing, releaseIndicator]);

  useEffect(() => cancelIndicatorRelease, [cancelIndicatorRelease]);

  const handleRefresh = useCallback(() => {
    cancelIndicatorRelease();
    setHoldRefreshIndicator(true);
    onRefresh();
  }, [cancelIndicatorRelease, onRefresh]);

  const handleScrollBeginDrag = useCallback(() => {
    cancelIndicatorRelease();
    isDragging.current = true;
  }, [cancelIndicatorRelease]);

  const handleScrollEndDrag = useCallback(() => {
    isDragging.current = false;
    if (!isRefreshing) releaseIndicator();
  }, [isRefreshing, releaseIndicator]);

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
          <ActivityIndicator accessibilityLabel="Loading schedule" color={theme.colors.text} size="large" />
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
          colors={[theme.colors.text]}
          onRefresh={handleRefresh}
          refreshing={isRefreshing || holdRefreshIndicator}
          tintColor={theme.colors.text}
        />
      )}
      onScrollBeginDrag={handleScrollBeginDrag}
      onScrollEndDrag={handleScrollEndDrag}
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

const useStyles = createThemedStyles((theme) => ({
  stateScreen: {
    flex: 1,
  },
  header: {
    width: "100%",
    maxWidth: theme.contentMaxWidth,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
    alignSelf: "center",
  },
  heading: {
    color: theme.colors.text,
    fontSize: theme.fontSize.heading,
    lineHeight: 44,
    fontWeight: "800",
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  headingActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  clearFiltersButton: {
    minHeight: 44,
    justifyContent: "center",
  },
  clearFiltersText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  searchButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.pill,
  },
  searchInput: {
    width: "100%",
    maxWidth: 400,
    minHeight: 48,
    paddingHorizontal: theme.spacing.md,
    alignSelf: "flex-end",
    color: theme.colors.text,
    fontSize: theme.fontSize.body,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
  },
  subheading: {
    color: theme.colors.muted,
    fontSize: theme.fontSize.body,
    lineHeight: 24,
  },
  highlight: {
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
  },
  highlightContainer: {
    width: "100%",
    maxWidth: theme.contentMaxWidth,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    alignSelf: "center",
  },
  liveHighlight: {
    backgroundColor: theme.colors.liveSurface,
    borderColor: theme.colors.live,
  },
  eyebrow: {
    color: theme.colors.muted,
    fontSize: theme.fontSize.caption,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  liveText: {
    color: theme.colors.live,
  },
  highlightTitle: {
    color: theme.colors.text,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700",
  },
  highlightDetail: {
    color: theme.colors.muted,
    fontSize: theme.fontSize.body,
    lineHeight: 24,
  },
  refreshWarning: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.liveSurface,
    borderColor: theme.colors.error,
    borderWidth: 1,
    borderRadius: theme.radius.md,
  },
  warningText: {
    gap: theme.spacing.xs,
  },
  warningTitle: {
    color: theme.colors.error,
    fontSize: theme.fontSize.body,
    lineHeight: 24,
    fontWeight: "700",
  },
  warningMessage: {
    color: theme.colors.text,
    fontSize: theme.fontSize.body,
    lineHeight: 24,
  },
  button: {
    minHeight: 52,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    backgroundColor: theme.colors.text,
    borderRadius: theme.radius.pill,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonText: {
    color: theme.colors.surface,
    fontSize: theme.fontSize.body,
    fontWeight: "700",
  },
  centeredState: {
    width: "100%",
    maxWidth: theme.contentMaxWidth,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xxl,
    alignItems: "flex-start",
    gap: theme.spacing.md,
    alignSelf: "center",
  },
  emptyState: {
    width: "100%",
    maxWidth: theme.contentMaxWidth,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.md,
    alignSelf: "center",
  },
  stateTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.title,
    lineHeight: 36,
    fontWeight: "700",
  },
  stateMessage: {
    color: theme.colors.muted,
    fontSize: theme.fontSize.body,
    lineHeight: 24,
  },
  listContent: {
    paddingBottom: theme.spacing.xxxl,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  contentWidth: {
    width: "100%",
    maxWidth: theme.contentMaxWidth,
    alignSelf: "center",
  },
}));

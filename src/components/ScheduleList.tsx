import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, SectionList, Text, TextInput, View } from "react-native";

import { ScheduleEventCard } from "@/components/ScheduleEventCard";
import { ScheduleFilters } from "@/components/ScheduleFilters";
import { ScheduleSectionHeader } from "@/components/ScheduleSectionHeader";
import { usePreferences } from "@/context/PreferencesContext";
import type { ScheduleLoadError, ScheduleStatus } from "@/hooks/useSchedule";
import { createThemedStyles } from "@/hooks/useThemedStyles";
import {
  filterScheduleSections,
  formatShortScheduleDate,
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
  const { scheduleTimeMode } = usePreferences();
  const { styles, theme } = useStyles();

  return (
    <View style={styles.header}>
      <View style={styles.headingRow}>
        <View style={styles.headingBlock}>
          <Text
            accessibilityRole="header"
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            numberOfLines={1}
            style={styles.heading}
          >
            Schedule
          </Text>
        </View>
        <View style={styles.headingActions}>
          {hasFilters && (
            <RetryButton compact label="Clear filters" onPress={onClear} />
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
      <View style={styles.scheduleMeta}>
        <View style={styles.metaItem}>
          <Ionicons color={theme.colors.muted} name="calendar-outline" size={15} />
          <Text style={styles.metaText}>Next 14 days</Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaItem}>
          <Ionicons color={theme.colors.muted} name="time-outline" size={15} />
          <Text style={styles.metaText}>
            {scheduleTimeMode === "station" ? "Station time (Central)" : "Local time"}
          </Text>
        </View>
      </View>
      {searchVisible && (
        <View style={styles.searchField}>
          <Ionicons color={theme.colors.muted} name="search" size={20} />
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
        </View>
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

function RetryButton({
  compact = false,
  label,
  onPress,
}: {
  readonly compact?: boolean;
  readonly label: string;
  readonly onPress: () => void;
}) {
  const { styles } = useStyles();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compactButton,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text style={[styles.buttonText, compact && styles.compactButtonText]}>{label}</Text>
    </Pressable>
  );
}

function ScreenHeading() {
  const { styles } = useStyles();

  return (
    <View style={styles.header}>
      <View style={styles.eyebrowRow}>
        <View style={styles.eyebrowDot} />
        <Text style={styles.eyebrow}>PROGRAM GUIDE</Text>
      </View>
      <Text accessibilityRole="header" style={styles.heading}>Schedule</Text>
      <Text style={styles.subheading}>Discover what’s playing on WLFM over the next two weeks.</Text>
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
          <View style={styles.stateArtwork}>
            <ActivityIndicator accessibilityLabel="Loading schedule" color={theme.colors.text} size="large" />
          </View>
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
          <View style={styles.stateArtwork}>
            <Ionicons color={theme.colors.error} name="warning-outline" size={30} />
          </View>
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
          <ScheduleEventCard
            event={item}
            isOnAir={currentEvent?.id === item.id}
            isUpNext={nextEvent?.id === item.id}
          />
        </View>
      )}
      renderSectionHeader={({ section }) => (
        <ScheduleSectionHeader eventCount={section.data.length} title={section.title} />
      )}
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
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.lg,
    paddingBottom: 0,
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
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  headingBlock: {
    minWidth: 0,
    flex: 1,
    gap: 2,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  eyebrowDot: {
    width: 7,
    height: 7,
    backgroundColor: theme.colors.accent,
    borderRadius: 4,
  },
  eyebrow: {
    color: theme.colors.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: 1.7,
  },
  headingActions: {
    flexDirection: "row",
    flexShrink: 0,
    alignItems: "center",
    gap: theme.spacing.sm,
    marginLeft: "auto",
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
    shadowColor: theme.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: theme.scheme === "dark" ? 0.2 : 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  searchField: {
    width: "100%",
    minHeight: 52,
    marginTop: theme.spacing.sm,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
  },
  searchInput: {
    minWidth: 0,
    flex: 1,
    paddingVertical: 12,
    color: theme.colors.text,
    fontSize: 15,
  },
  subheading: {
    color: theme.colors.muted,
    fontSize: theme.fontSize.body,
    lineHeight: 24,
  },
  scheduleMeta: {
    minHeight: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",

    gap: theme.spacing.sm,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaText: {
    color: theme.colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  metaDivider: {
    width: 3,
    height: 3,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
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
  compactButton: {
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    alignSelf: "center",
  },
  compactButtonText: {
    fontSize: 14,
  },
  centeredState: {
    width: "100%",
    maxWidth: theme.contentMaxWidth,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xxl,
    alignItems: "flex-start",
    gap: theme.spacing.md,
    alignSelf: "center",
  },
  emptyState: {
    width: "100%",
    maxWidth: theme.contentMaxWidth,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.md,
    alignSelf: "center",
  },
  stateArtwork: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.pill,
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

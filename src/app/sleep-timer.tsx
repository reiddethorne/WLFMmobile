import Ionicons from "@expo/vector-icons/Ionicons";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useRadioPlayer } from "@/hooks/useRadioPlayer";
import { useRadioSleepTimer } from "@/hooks/useRadioSleepTimer";
import { useSchedule } from "@/hooks/useSchedule";
import { createThemedStyles } from "@/hooks/useThemedStyles";

const TIMER_OPTIONS = [15, 30, 60] as const;

function formatRemaining(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatDuration(minutes: number): string {
  return minutes >= 60
    ? `${minutes / 60} ${minutes === 60 ? "hour" : "hours"}`
    : `${minutes} minutes`;
}

export default function SleepTimer() {
  const player = useRadioPlayer();
  const sleepTimer = useRadioSleepTimer();
  const schedule = useSchedule();
  const { styles, theme } = useStyles();
  const hasTimer = sleepTimer.endsAt !== null;
  const canSetTimer = player.status === "playing" || player.status === "buffering" || player.status === "paused";
  const currentShowEndsAt = schedule.currentEvent === null ? null : Date.parse(schedule.currentEvent.end);
  const canUseCurrentShow = canSetTimer && currentShowEndsAt !== null && currentShowEndsAt > Date.now();
  const currentShowDescription = schedule.currentEvent
    ? schedule.currentEvent.title
    : schedule.status === "loading"
      ? "Loading the schedule…"
      : schedule.error
        ? "Current show unavailable"
        : "No show is currently on air";

  const startTimer = (minutes: number) => {
    if (sleepTimer.start(minutes)) return;
    Alert.alert("Start the radio first", "Play WLFM, then choose how long you want to listen.");
  };

  const stopAtEndOfCurrentShow = () => {
    if (currentShowEndsAt !== null && sleepTimer.startAt(currentShowEndsAt)) return;
    Alert.alert("Unable to set timer", "Make sure WLFM is playing and a show is currently on air.");
  };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View accessible style={styles.statusCard}>
          <View style={[styles.statusIcon, hasTimer && styles.activeStatusIcon]}>
            <Ionicons
              accessibilityElementsHidden
              color={hasTimer ? theme.colors.accentText : theme.colors.icon}
              importantForAccessibility="no-hide-descendants"
              name={hasTimer ? "moon" : "moon-outline"}
              size={30}
            />
          </View>
          <Text accessibilityRole="header" style={styles.statusTitle}>
            {hasTimer && sleepTimer.remainingSeconds !== null
              ? formatRemaining(sleepTimer.remainingSeconds)
              : "No timer set"}
          </Text>
          <Text style={styles.statusDescription}>
            {hasTimer
              ? "WLFM will pause when the countdown ends. The timer keeps counting if playback is paused."
              : canSetTimer
                ? "Choose when WLFM should stop playing."
                : "Start listening to WLFM before setting a sleep timer."}
          </Text>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Stop playing after</Text>
          <View style={styles.optionsCard}>
            <Pressable
              accessibilityHint="Stops playback at the scheduled end of the current show"
              accessibilityLabel={`End of current show. ${currentShowDescription}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canUseCurrentShow }}
              disabled={!canUseCurrentShow}
              onPress={stopAtEndOfCurrentShow}
              style={({ pressed }) => [
                styles.currentShowRow,
                styles.optionDivider,
                !canUseCurrentShow && styles.optionRowDisabled,
                pressed && styles.optionRowPressed,
              ]}
            >
              <View style={styles.optionText}>
                <Text style={styles.currentShowTitle}>End of current show</Text>
                <Text
                  numberOfLines={1}
                  style={styles.currentShowDescription}
                >
                  {currentShowDescription}
                </Text>
              </View>
              <Ionicons
                accessibilityElementsHidden
                color={canUseCurrentShow ? theme.colors.icon : theme.colors.disabled}
                importantForAccessibility="no-hide-descendants"
                name="radio-outline"
                size={21}
              />
            </Pressable>
            {TIMER_OPTIONS.map((minutes, index) => (
              <Pressable
                accessibilityHint="Starts or replaces the current sleep timer"
                accessibilityLabel={formatDuration(minutes)}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSetTimer }}
                disabled={!canSetTimer}
                key={minutes}
                onPress={() => startTimer(minutes)}
                style={({ pressed }) => [
                  styles.optionRow,
                  index < TIMER_OPTIONS.length - 1 && styles.optionDivider,
                  !canSetTimer && styles.optionRowDisabled,
                  pressed && styles.optionRowPressed,
                ]}
              >
                <Text style={styles.optionLabel}>{formatDuration(minutes)}</Text>
                <Ionicons
                  accessibilityElementsHidden
                  color={canSetTimer ? theme.colors.icon : theme.colors.disabled}
                  importantForAccessibility="no-hide-descendants"
                  name="timer-outline"
                  size={21}
                />
              </Pressable>
            ))}
          </View>
        </View>

        {hasTimer && (
          <Pressable
            accessibilityLabel="Cancel sleep timer"
            accessibilityRole="button"
            onPress={sleepTimer.cancel}
            style={({ pressed }) => [styles.cancelButton, pressed && styles.cancelButtonPressed]}
          >
            <Text style={styles.cancelButtonText}>Cancel timer</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    width: "100%",
    maxWidth: theme.contentMaxWidth,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.xl,
    alignSelf: "center",
  },
  statusCard: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: theme.radius.lg,
  },
  statusIcon: {
    width: 56,
    height: 56,
    marginBottom: theme.spacing.xs,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.pill,
  },
  activeStatusIcon: {
    backgroundColor: theme.colors.accent,
  },
  statusTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.title,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  statusDescription: {
    maxWidth: 360,
    color: theme.colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    paddingHorizontal: theme.spacing.xs,
    color: theme.colors.muted,
    fontSize: theme.fontSize.caption,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  optionsCard: {
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: theme.radius.lg,
  },
  optionRow: {
    minHeight: 58,
    paddingHorizontal: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  currentShowRow: {
    minHeight: 72,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  optionDivider: {
    borderBottomColor: theme.colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionRowPressed: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  optionRowDisabled: {
    opacity: 0.48,
  },
  optionLabel: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.fontSize.body,
    fontWeight: "700",
  },
  optionText: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: theme.spacing.xs,
  },
  currentShowTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.body,
    lineHeight: 21,
    fontWeight: "700",
  },
  currentShowDescription: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 18,
  },
  cancelButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.liveSurface,
    borderRadius: theme.radius.md,
  },
  cancelButtonPressed: {
    opacity: 0.72,
  },
  cancelButtonText: {
    color: theme.colors.error,
    fontSize: theme.fontSize.body,
    fontWeight: "800",
  },
}));

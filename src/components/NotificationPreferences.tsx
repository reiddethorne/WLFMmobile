import { router } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";

import { usePreferences } from "@/context/PreferencesContext";
import { useShowPreferences } from "@/context/ShowPreferencesContext";
import { createThemedStyles } from "@/hooks/useThemedStyles";
import { formatEventDate, formatEventTime } from "@/services/schedule";
import { favoriteProgramKey, REMINDER_LEAD_TIMES } from "@/services/showReminders";

export function NotificationPreferences() {
  const { programReminders, reminders, minutesBefore, ready, error, retry, remindersSupported, store } = useShowPreferences();
  const { scheduleTimeMode } = usePreferences();
  const { styles } = useStyles();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try { await action(); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "The change could not be saved. Please try again."); }
    finally { setBusy(false); }
  };
  const disabled = !ready || busy;
  const sortedReminders = [...reminders].sort((left, right) => Date.parse(left.event.start) - Date.parse(right.event.start));

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>Show reminders</Text>
      <View style={styles.card}>
        {error && (
          <View style={styles.block}>
            <Text accessibilityLiveRegion="polite" style={styles.message}>{error}</Text>
            <Action label="Try again" onPress={retry} />
          </View>
        )}
        {!ready && !error && <Text accessibilityLiveRegion="polite" style={styles.blockText}>Loading notification preferences…</Text>}
        <View style={styles.block}>
          <Text accessibilityRole="header" style={styles.title}>Remind me before a show</Text>
          <Text style={styles.detail}>Existing reminders keep their selected time.</Text>
          <View accessibilityLabel="Default reminder lead time" accessibilityRole="radiogroup" style={styles.options}>
            {REMINDER_LEAD_TIMES.map((minutes) => (
              <Pressable
                accessibilityLabel={`${minutes} ${minutes === 1 ? "minute" : "minutes"} before a show`}
                accessibilityRole="radio"
                accessibilityState={{ checked: minutesBefore === minutes, disabled }}
                disabled={disabled}
                key={minutes}
                onPress={() => { void run(() => store.setMinutesBefore(minutes)); }}
                style={({ pressed }) => [styles.option, minutesBefore === minutes && styles.selected, pressed && styles.pressed, disabled && styles.disabled]}
              >
                <Text style={[styles.optionText, minutesBefore === minutes && styles.selectedText]}>{minutes} min</Text>
              </Pressable>
            ))}
          </View>
          {remindersSupported && <Action label="Device notification settings" onPress={() => { void run(() => Linking.openSettings()); }} />}
        </View>

        <View style={styles.block}>
          <Text accessibilityRole="header" style={styles.title}>Program reminders ({programReminders.length})</Text>
          {ready && programReminders.length === 0 && <Text style={styles.detail}>Tap Remind me on an upcoming or live program in Schedule.</Text>}
          {programReminders.map((program) => {
            const pending = sortedReminders.filter((reminder) => favoriteProgramKey(reminder.event.title) === program.key);
            const next = pending[0];
            return (
            <View key={program.key} style={styles.entry}>
              <Text style={styles.title}>{program.title}</Text>
              <Text style={styles.detail}>{program.minutesBefore} min before every airing · {pending.length} queued</Text>
              {next ? (
                <Pressable
                  accessibilityLabel={`View the next ${program.title} airing in Schedule`}
                  accessibilityRole="button"
                  onPress={() => router.navigate({ pathname: "/(tabs)/schedule", params: { event: JSON.stringify(next.event) } })}
                  style={styles.entryLink}
                >
                  <Text style={styles.detail}>Next: {formatEventDate(next.event, new Date(), scheduleTimeMode)} · {formatEventTime(next.event, scheduleTimeMode).display} · {scheduleTimeMode === "station" ? "Central time" : "Local time"}</Text>
                </Pressable>
              ) : <Text style={styles.detail}>Enabled for future airings, including those added on the next schedule refresh.</Text>}
              <View style={styles.actions}>
                <Action disabled={disabled} label={`Cancel all reminders for ${program.title}`} text="Cancel all" onPress={() => { void run(() => store.cancelReminder(program.title)); }} />
                {program.minutesBefore !== minutesBefore && (
                  <Action disabled={disabled} label={`Change all ${program.title} reminders to ${minutesBefore} minutes before`} text={`Use ${minutesBefore} min`} onPress={() => { void run(() => store.setProgramMinutesBefore(program.title, minutesBefore)); }} />
                )}
              </View>
            </View>
            );
          })}
        </View>

        {message && <Text accessibilityLiveRegion="polite" style={styles.blockText}>{message}</Text>}
      </View>
    </View>
  );
}

function Action({ label, text = label, onPress, disabled = false }: {
  readonly label: string; readonly text?: string; readonly onPress: () => void; readonly disabled?: boolean;
}) {
  const { styles } = useStyles();
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed, disabled && styles.disabled]}>
      <Text style={styles.optionText}>{text}</Text>
    </Pressable>
  );
}

const useStyles = createThemedStyles((theme) => ({
  section: { gap: theme.spacing.sm },
  heading: { paddingHorizontal: theme.spacing.xs, color: theme.colors.muted, fontSize: theme.fontSize.caption, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  card: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.lg, overflow: "hidden" },
  block: { padding: theme.spacing.md, gap: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  blockText: { padding: theme.spacing.md, color: theme.colors.muted, lineHeight: 22 },
  title: { color: theme.colors.text, fontSize: 16, fontWeight: "700" },
  detail: { color: theme.colors.muted, fontSize: 14, lineHeight: 21 },
  message: { color: theme.colors.error, fontSize: 14, lineHeight: 21 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  option: { minHeight: 44, minWidth: 48, flexGrow: 1, paddingHorizontal: 8, paddingVertical: 10, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceMuted },
  selected: { backgroundColor: theme.colors.accent },
  optionText: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
  selectedText: { color: theme.colors.accentText },
  entry: { gap: 4, paddingVertical: theme.spacing.sm, borderTopColor: theme.colors.border, borderTopWidth: 1 },
  entryLink: { minHeight: 44, gap: 4, paddingVertical: 6 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  action: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, alignSelf: "flex-start", justifyContent: "center", borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceMuted },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
}));

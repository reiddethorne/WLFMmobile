import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useShowPreferences } from "@/context/ShowPreferencesContext";
import { createThemedStyles } from "@/hooks/useThemedStyles";
import { canSetProgramReminder, favoriteProgramKey } from "@/services/showReminders";
import type { ScheduleEvent } from "@/types/schedule";

export function ShowActions({ event }: { readonly event: ScheduleEvent }) {
  const { favorites, programReminders, minutesBefore, ready, store, remindersSupported } = useShowPreferences();
  const { styles, theme } = useStyles();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const favorite = favorites.some((item) => item.key === favoriteProgramKey(event.title));
  const reminder = programReminders.find((item) => item.key === favoriteProgramKey(event.title));
  const canRemind = canSetProgramReminder(event, Date.now());

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try { await action(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "The change could not be saved. Please try again."); }
    finally { setBusy(false); }
  };

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <Pressable
          accessibilityLabel={`${favorite ? "Unfavorite" : "Favorite"} ${event.title}`}
          accessibilityRole="button"
          accessibilityState={{ selected: favorite, disabled: !ready || busy }}
          disabled={!ready || busy}
          onPress={() => { void run(() => store.toggleFavorite(event.title)); }}
          style={({ pressed }) => [styles.button, pressed && styles.pressed, (!ready || busy) && styles.disabled]}
        >
          <Ionicons color={theme.colors.text} name={favorite ? "heart" : "heart-outline"} size={19} />
          <Text style={styles.label}>{favorite ? "Favorited" : "Favorite"}</Text>
        </Pressable>
        {(reminder || (canRemind && remindersSupported)) && (
          <Pressable
            accessibilityLabel={reminder ? `Cancel all reminders for ${event.title}` : `Remind me ${minutesBefore} minutes before every airing of ${event.title}`}
            accessibilityHint="Applies to all upcoming shows with this title"
            accessibilityRole="button"
            accessibilityState={{ selected: !!reminder, disabled: !ready || busy }}
            disabled={!ready || busy}
            onPress={() => { void run(
              () => reminder ? store.cancelReminder(event.title) : store.setReminder(event, minutesBefore),
            ); }}
            style={({ pressed }) => [styles.button, pressed && styles.pressed, (!ready || busy) && styles.disabled]}
          >
            <Ionicons color={theme.colors.text} name={reminder ? "notifications" : "notifications-outline"} size={19} />
            <Text style={styles.label}>{reminder ? `${reminder.minutesBefore} min · Cancel all` : "Remind me"}</Text>
          </Pressable>
        )}
      </View>
      {message && <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>}
    </View>
  );
}

const useStyles = createThemedStyles((theme) => ({
  container: { gap: theme.spacing.sm },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  button: {
    minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center",
    gap: 7, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceMuted,
  },
  label: { color: theme.colors.text, fontSize: 14, fontWeight: "700", flexShrink: 1 },
  message: { color: theme.colors.muted, fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
}));

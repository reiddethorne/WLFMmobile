import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { THEME } from "@/constants/theme";
import { useScheduleDiagnostics } from "@/hooks/useScheduleDiagnostics";

export function ScheduleDiagnostics() {
  const { state, refresh } = useScheduleDiagnostics();
  const loading = state.status === "loading";

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>Calendar development check</Text>
      <Text style={styles.text}>
        Configuration: {loading ? "Checking…" : state.status === "ready" ? "Ready" : "Needs attention"}
      </Text>
      <Text accessibilityLiveRegion="polite" style={[styles.text, state.status === "error" && styles.error]}>
        API: {loading ? "Loading…" : state.status === "ready" ? "Connected" : state.message}
      </Text>
      {state.status === "ready" && (
        <>
          <Text style={styles.text}>Events in the next 14 days: {state.eventCount}</Text>
          <Text style={styles.text}>First event: {state.firstEvent?.title ?? "None scheduled"}</Text>
          {state.firstEvent && <Text style={styles.text}>First start: {state.firstEvent.start}</Text>}
        </>
      )}
      {loading && <ActivityIndicator accessibilityLabel="Loading schedule" color={THEME.colors.accent} />}
      <Pressable
        accessibilityLabel="Retry Google Calendar development check"
        accessibilityRole="button"
        accessibilityState={{ busy: loading, disabled: loading }}
        disabled={loading}
        onPress={refresh}
        style={({ pressed }) => [styles.button, (pressed || loading) && styles.buttonMuted]}
      >
        <Text style={styles.buttonText}>{loading ? "Checking…" : "Retry"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: THEME.spacing.lg,
    gap: THEME.spacing.md,
    backgroundColor: THEME.colors.surface,
    borderColor: THEME.colors.border,
    borderWidth: 1,
    borderRadius: THEME.radius.lg,
  },
  heading: {
    color: THEME.colors.accent,
    fontSize: THEME.fontSize.body,
    fontWeight: "700",
  },
  text: {
    color: THEME.colors.text,
    fontSize: THEME.fontSize.body,
    lineHeight: 24,
  },
  error: {
    color: THEME.colors.error,
  },
  button: {
    minHeight: 52,
    padding: THEME.spacing.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: THEME.colors.accent,
    borderRadius: THEME.radius.md,
  },
  buttonMuted: {
    opacity: 0.6,
  },
  buttonText: {
    color: THEME.colors.surface,
    fontSize: THEME.fontSize.body,
    fontWeight: "700",
  },
});

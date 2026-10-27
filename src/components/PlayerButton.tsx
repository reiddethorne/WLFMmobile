import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { createThemedStyles } from "@/hooks/useThemedStyles";
import { useRadioPlayer } from "@/hooks/useRadioPlayer";
import type { RadioPlayerStatus } from "@/types/player";

const STATUS: Record<RadioPlayerStatus, string> = {
  idle: "Ready to listen",
  connecting: "Connecting to WLFM…",
  buffering: "Buffering live audio…",
  playing: "Playing live",
  paused: "Playback paused",
  error: "Station unavailable",
};

export function PlayerButton() {
  const { styles, theme } = useStyles();
  const { status, error, canPause, togglePlayback } = useRadioPlayer();
  const loading = status === "connecting" || status === "buffering";
  const mode = canPause ? "pause" : status === "error" ? "retry" : "play";
  const actionText = mode === "pause" ? "Pause" : mode === "retry" ? "Retry" : "Play";
  const label = mode === "pause" ? "Pause live radio" : mode === "retry" ? "Retry live radio" : "Play live radio";
  const unsupported = Platform.OS === "web";
  const statusText = STATUS[status];

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={loading ? "Pause cancels the pending connection." : undefined}
        accessibilityState={{ busy: loading, disabled: unsupported }}
        disabled={unsupported}
        onPress={togglePlayback}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          unsupported && styles.buttonDisabled,
        ]}
      >
        <View style={styles.iconSlot}>
          {loading ? (
            <ActivityIndicator color={theme.colors.surface} size="large" />
          ) : (
            <Ionicons
              accessibilityElementsHidden
              color={theme.colors.surface}
              importantForAccessibility="no-hide-descendants"
              name={mode === "pause" ? "pause-sharp" : mode === "retry" ? "refresh" : "play-sharp"}
              size={36}
              style={styles.transportIcon}
            />
          )}
        </View>
        <Text style={styles.buttonText}>{actionText}</Text>
      </Pressable>
      {/*<View style={styles.statusRow}> //this is the status text, I might want to add it back in later, but for now it's not needed
        <View style={styles.statusDot} />
        <Text accessibilityLiveRegion="polite" style={[styles.status, status === "error" && styles.errorText]}>
          {error ?? statusText}
        </Text>
      </View>*/}
    </View>
  );
}

const useStyles = createThemedStyles((theme) => ({
  container: { alignItems: "center", gap: theme.spacing.sm, paddingTop: theme.spacing.sm },
  button: {
    width: 176,
    minHeight: 64,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    shadowColor: theme.shadow.color,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonPressed: { backgroundColor: theme.colors.accentPressed, transform: [{ scale: 0.97 }] },
  buttonDisabled: { backgroundColor: theme.colors.disabled, shadowOpacity: 0 },
  iconSlot: {
    width: 36,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  transportIcon: {
    width: 36,
    textAlign: "center",
  },
  buttonText: {
    width: 52,
    color: theme.colors.surface,
    fontSize: theme.fontSize.body,
    lineHeight: 24,
    fontWeight: "700",
    textAlign: "left",
  },
  statusRow: {
    minHeight: 32,
    maxWidth: "100%",
    paddingHorizontal: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.muted },
  status: { flexShrink: 1, color: theme.colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center" },
  errorText: { color: theme.colors.error },
}));

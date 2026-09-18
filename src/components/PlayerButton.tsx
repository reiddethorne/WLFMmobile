import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { THEME } from "@/constants/theme";
import { useRadioPlayer } from "@/hooks/useRadioPlayer";
import type { RadioPlayerStatus } from "@/types/player";

const STATUS_TEXT: Record<RadioPlayerStatus, string> = {
  idle: "Ready to listen",
  connecting: "Connecting to WLFM…",
  buffering: "Buffering…",
  playing: "Playing live",
  paused: "Paused",
  error: "Unable to play",
};

export function PlayerButton() {
  const { status, error, canPause, togglePlayback } = useRadioPlayer();
  const loading = status === "connecting" || status === "buffering";
  const label = canPause ? "Pause" : status === "error" ? "Retry" : "Play live radio";
  const unsupported = Platform.OS === "web";

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={loading ? "Pause cancels the pending connection." : undefined}
        accessibilityState={{ disabled: unsupported }}
        disabled={unsupported}
        onPress={togglePlayback}
        style={({ pressed }) => [styles.button, { opacity: pressed || unsupported ? 0.6 : 1 }]}
      >
        {loading && <ActivityIndicator color={THEME.colors.surface} />}
        <Text style={styles.buttonText}>{label}</Text>
      </Pressable>
      <Text accessibilityLiveRegion="polite" style={styles.status}>{error ?? STATUS_TEXT[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: THEME.spacing.md },
  button: { minHeight: 56, padding: THEME.spacing.md, flexDirection: "row", gap: THEME.spacing.sm, alignItems: "center", justifyContent: "center", backgroundColor: THEME.colors.accent, borderRadius: THEME.radius.pill },
  buttonText: { color: THEME.colors.surface, fontSize: THEME.fontSize.body, fontWeight: "700" },
  status: { color: THEME.colors.muted, fontSize: THEME.fontSize.body, lineHeight: 24, textAlign: "center" },
});

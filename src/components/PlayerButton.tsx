import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { THEME } from "@/constants/theme";
import { useRadioPlayer } from "@/hooks/useRadioPlayer";
import type { RadioPlayerStatus } from "@/types/player";

const STATUS: Record<RadioPlayerStatus, { readonly label: string; readonly color: string }> = {
  idle: { label: "Ready to listen", color: THEME.colors.muted },
  connecting: { label: "Connecting to WLFM…", color: THEME.colors.warning },
  buffering: { label: "Buffering live audio…", color: THEME.colors.warning },
  playing: { label: "Playing live", color: THEME.colors.success },
  paused: { label: "Playback paused", color: THEME.colors.muted },
  error: { label: "Station unavailable", color: THEME.colors.error },
};

function TransportIcon({ mode }: { readonly mode: "play" | "pause" | "retry" }) {
  if (mode === "pause") {
    return (
      <View style={styles.pauseIcon}>
        <View style={styles.pauseBar} />
        <View style={styles.pauseBar} />
      </View>
    );
  }
  if (mode === "retry") return <Text style={styles.retryIcon}>↻</Text>;
  return <View style={styles.playIcon} />;
}

export function PlayerButton() {
  const { status, error, canPause, togglePlayback } = useRadioPlayer();
  const loading = status === "connecting" || status === "buffering";
  const mode = canPause ? "pause" : status === "error" ? "retry" : "play";
  const actionText = mode === "pause" ? "Pause" : mode === "retry" ? "Retry" : "Play";
  const label = mode === "pause" ? "Pause live radio" : mode === "retry" ? "Retry live radio" : "Play live radio";
  const unsupported = Platform.OS === "web";
  const statusInfo = STATUS[status];

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
        {loading ? <ActivityIndicator color={THEME.colors.surface} size="large" /> : <TransportIcon mode={mode} />}
        <Text style={styles.buttonText}>{actionText}</Text>
      </Pressable>
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
        <Text accessibilityLiveRegion="polite" style={[styles.status, status === "error" && styles.errorText]}>
          {error ?? statusInfo.label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: THEME.spacing.sm, paddingTop: THEME.spacing.sm },
  button: {
    width: 176,
    minHeight: 64,
    paddingHorizontal: THEME.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: THEME.spacing.md,
    backgroundColor: THEME.colors.accent,
    borderRadius: THEME.radius.pill,
    shadowColor: THEME.shadow.color,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonPressed: { backgroundColor: THEME.colors.accentPressed, transform: [{ scale: 0.97 }] },
  buttonDisabled: { backgroundColor: THEME.colors.disabled, shadowOpacity: 0 },
  playIcon: {
    width: 0,
    height: 0,
    marginLeft: 6,
    borderTopWidth: 14,
    borderBottomWidth: 14,
    borderLeftWidth: 22,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: THEME.colors.surface,
  },
  pauseIcon: { height: 28, flexDirection: "row", alignItems: "center", gap: 8 },
  pauseBar: { width: 8, height: 28, backgroundColor: THEME.colors.surface, borderRadius: 2 },
  retryIcon: { color: THEME.colors.surface, fontSize: 42, lineHeight: 48, fontWeight: "500" },
  buttonText: { color: THEME.colors.surface, fontSize: THEME.fontSize.body, lineHeight: 24, fontWeight: "700" },
  statusRow: {
    minHeight: 32,
    maxWidth: "100%",
    paddingHorizontal: THEME.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: THEME.spacing.sm,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  status: { flexShrink: 1, color: THEME.colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center" },
  errorText: { color: THEME.colors.error },
});

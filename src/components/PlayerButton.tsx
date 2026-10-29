import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";

import { createThemedStyles } from "@/hooks/useThemedStyles";
import { useRadioPlayer } from "@/hooks/useRadioPlayer";

export function PlayerButton() {
  const { styles, theme } = useStyles();
  const { status, canPause, togglePlayback } = useRadioPlayer();
  const loading = status === "connecting" || status === "buffering";
  const mode = canPause ? "pause" : status === "error" ? "retry" : "play";
  const actionText = mode === "pause" ? "Pause" : mode === "retry" ? "Retry" : "Play";
  const label = mode === "pause" ? "Pause live radio" : mode === "retry" ? "Retry live radio" : "Play live radio";
  const unsupported = Platform.OS === "web";

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
            <ActivityIndicator color={theme.colors.accentText} size="large" />
          ) : (
            <Ionicons
              accessibilityElementsHidden
              color={theme.colors.accentText}
              importantForAccessibility="no-hide-descendants"
              name={mode === "pause" ? "pause-sharp" : mode === "retry" ? "refresh" : "play-sharp"}
              size={36}
              style={styles.transportIcon}
            />
          )}
        </View>
        <Text style={styles.buttonText}>{actionText}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles((theme) => ({
  container: { alignItems: "center", paddingTop: theme.spacing.sm },
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
    color: theme.colors.accentText,
    fontSize: theme.fontSize.body,
    lineHeight: 24,
    fontWeight: "700",
    textAlign: "left",
  },
}));

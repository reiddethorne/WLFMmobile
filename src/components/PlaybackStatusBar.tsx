import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect } from "react";
import { AccessibilityInfo, ActivityIndicator, Platform, Text, View } from "react-native";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { createThemedStyles } from "@/hooks/useThemedStyles";
import type { RadioPlayerStatus } from "@/types/player";

const STATUS: Record<RadioPlayerStatus, string> = {
  idle: "Ready to listen",
  connecting: "Connecting to WLFM…",
  buffering: "Buffering live audio…",
  playing: "Playing live",
  paused: "Playback paused",
  error: "Station unavailable",
};

interface PlaybackStatusBarProps {
  readonly error: string | null;
  readonly status: RadioPlayerStatus;
}

export function PlaybackStatusBar({ error, status }: PlaybackStatusBarProps) {
  const placement = NativeTabs.BottomAccessory.usePlacement();
  const { styles, theme } = useStyles();
  const message = error ?? STATUS[status];
  const loading = status === "connecting" || status === "buffering";
  const iconName = status === "playing"
    ? "radio"
    : status === "paused"
      ? "pause-sharp"
      : status === "error"
        ? "alert-circle"
        : "play-sharp";

  useEffect(() => {
    if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  return (
    <View
      accessible
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
      style={placement === "inline" ? styles.inline : styles.regular}
    >
      <View style={styles.iconSlot}>
        {loading ? (
          <ActivityIndicator color={theme.colors.icon} size="small" />
        ) : (
          <Ionicons
            accessibilityElementsHidden
            color={theme.colors.icon}
            importantForAccessibility="no-hide-descendants"
            name={iconName}
            size={20}
          />
        )}
      </View>
      <Text numberOfLines={placement === "inline" ? 1 : 2} style={styles.message}>
        {message}
      </Text>
    </View>
  );
}

const useStyles = createThemedStyles((theme) => ({
  regular: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    paddingHorizontal: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
  },
  inline: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
  },
  iconSlot: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    flexShrink: 1,
    color: theme.colors.icon,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    textAlign: "center",
  },
}));

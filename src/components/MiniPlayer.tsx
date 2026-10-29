import Ionicons from "@expo/vector-icons/Ionicons";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";

import { STATION_ARTWORK } from "@/constants/assets";
import { createThemedStyles } from "@/hooks/useThemedStyles";
import type { RadioPlayerStatus } from "@/types/player";

interface MiniPlayerProps {
  readonly artist: string;
  readonly canPause: boolean;
  readonly onTogglePlayback: () => void;
  readonly status: RadioPlayerStatus;
  readonly title: string;
}

export function MiniPlayer({
  artist,
  canPause,
  onTogglePlayback,
  status,
  title,
}: MiniPlayerProps) {
  const placement = NativeTabs.BottomAccessory.usePlacement();
  const { styles, theme } = useStyles();
  const loading = status === "connecting" || status === "buffering";
  const mode = canPause ? "pause" : status === "error" ? "retry" : "play";
  const buttonLabel = mode === "pause"
    ? "Pause live radio"
    : mode === "retry"
      ? "Retry live radio"
      : "Play live radio";

  const control = (
    <Pressable
      accessibilityHint={loading ? "Cancels the pending connection" : undefined}
      accessibilityLabel={buttonLabel}
      accessibilityRole="button"
      accessibilityState={{ busy: loading }}
      hitSlop={8}
      onPress={onTogglePlayback}
      style={({ pressed }) => [
        styles.control,
        placement === "inline" && styles.inlineControl,
        pressed && styles.controlPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.icon} size="small" />
      ) : (
        <Ionicons
          accessibilityElementsHidden
          color={theme.colors.icon}
          importantForAccessibility="no-hide-descendants"
          name={mode === "pause" ? "pause-sharp" : mode === "retry" ? "refresh" : "play-sharp"}
          size={placement === "inline" ? 24 : 30}
          style={[
            styles.controlIcon,
            placement === "inline" && styles.inlineControlIcon,
          ]}
        />
      )}
    </Pressable>
  );

  if (placement === "inline") {
    return <View style={styles.inline}>{control}</View>;
  }

  return (
    <View style={styles.regular}>
      <Image
        accessibilityIgnoresInvertColors
        accessibilityLabel="WLFM station logo"
        resizeMode="cover"
        source={STATION_ARTWORK}
        style={styles.artwork}
      />
      <View
        accessible
        accessibilityLabel={`${title} by ${artist}`}
        accessibilityLiveRegion="polite"
        style={styles.metadata}
      >
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        <Text numberOfLines={1} style={[styles.artist, status === "error" && styles.error]}>
          {status === "error" ? "Station unavailable" : artist}
        </Text>
      </View>
      {control}
    </View>
  );
}

const useStyles = createThemedStyles((theme) => ({
  regular: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    paddingLeft: theme.spacing.md,
    paddingRight: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  inline: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
  },
  artwork: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
  },
  metadata: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: theme.colors.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
  },
  artist: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 19,
  },
  error: {
    color: theme.colors.error,
  },
  control: {
    width: 40,
    height: 40,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineControl: {
    width: 34,
    height: 34,
  },
  controlIcon: {
    width: 32,
    textAlign: "center",
  },
  inlineControlIcon: {
    width: 26,
  },
  controlPressed: {
    opacity: 0.65,
  },
}));

import { useEffect, useState } from "react";
import { usePathname } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { DynamicColorIOS, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MiniPlayer, MiniPlayerContent } from "@/components/MiniPlayer";
import { PlaybackStatusBar, PlaybackStatusBarContent } from "@/components/PlaybackStatusBar";
import { useAppTheme } from "@/context/ThemeContext";
import { useNowPlaying } from "@/hooks/useNowPlaying";
import { useRadioPlayer } from "@/hooks/useRadioPlayer";

const STATUS_DURATION_MS = 2_400;
const ANDROID_MATERIAL_TAB_BAR_HEIGHT = 80;

export default function TabLayout() {
  const theme = useAppTheme();
  const nowPlaying = useNowPlaying();
  const player = useRadioPlayer();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [showPlaybackStatus, setShowPlaybackStatus] = useState(false);
  const onRadioTab = pathname === "/";
  const showStatusBar = player.hasRequestedPlayback && onRadioTab && showPlaybackStatus;
  const showMiniPlayer = player.hasRequestedPlayback && !onRadioTab;
  const showAccessory = showStatusBar || showMiniPlayer;
  const accessoryContentStyle = {
    paddingBottom: theme.spacing.xxxl,
    backgroundColor: theme.colors.background,
  };
  const tabIconColor = Platform.OS === "ios"
    ? DynamicColorIOS({
        light: "#000000",
        dark: theme.colors.accent,
      })
    : theme.colors.icon;

  useEffect(() => {
    if (!player.hasRequestedPlayback) return;

    setShowPlaybackStatus(true);
    const persistent = player.status === "connecting" ||
      player.status === "buffering" ||
      player.status === "error";
    if (persistent) return;

    const timer = setTimeout(() => setShowPlaybackStatus(false), STATUS_DURATION_MS);
    return () => clearTimeout(timer);
  }, [player.error, player.hasRequestedPlayback, player.status]);

  return (
    <View style={styles.container}>
      <NativeTabs
        backgroundColor={theme.colors.surface}
        iconColor={tabIconColor}
        tintColor={tabIconColor}
      >
        {Platform.OS === "ios" && showAccessory && (
          <NativeTabs.BottomAccessory>
            {showMiniPlayer ? (
              <MiniPlayer
                artworkUrl={nowPlaying.artworkUrl}
                artist={nowPlaying.artist}
                canPause={player.canPause}
                errorKind={player.errorKind}
                onTogglePlayback={player.togglePlayback}
                status={player.status}
                title={nowPlaying.title}
              />
            ) : (
              <PlaybackStatusBar error={player.error} status={player.status} />
            )}
          </NativeTabs.BottomAccessory>
        )}

        <NativeTabs.Trigger
          name="index"
          accessibilityLabel="Radio tab"
        >
          <NativeTabs.Trigger.Icon
            sf={{ default: "radio", selected: "radio.fill" }}
            md="radio"
          />
          <NativeTabs.Trigger.Label>Radio</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger
          name="schedule"
          accessibilityLabel="Schedule tab"
          contentStyle={player.hasRequestedPlayback ? accessoryContentStyle : undefined}
        >
          <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
          <NativeTabs.Trigger.Label>Schedule</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger
          name="blog"
          accessibilityLabel="Blog tab"
          contentStyle={player.hasRequestedPlayback ? accessoryContentStyle : undefined}
        >
          <NativeTabs.Trigger.Icon
            sf={{ default: "newspaper", selected: "newspaper.fill" }}
            md="newspaper"
          />
          <NativeTabs.Trigger.Label>Blog</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger
          name="more"
          accessibilityLabel="More tab"
          contentStyle={player.hasRequestedPlayback ? accessoryContentStyle : undefined}
        >
          <NativeTabs.Trigger.Icon
            sf={{ default: "ellipsis.circle", selected: "ellipsis.circle.fill" }}
            md="more_horiz"
          />
          <NativeTabs.Trigger.Label>More</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>

      {Platform.OS === "android" && showAccessory && (
        <View
          style={[
            styles.androidAccessory,
            {
              bottom: ANDROID_MATERIAL_TAB_BAR_HEIGHT + insets.bottom,
              backgroundColor: theme.colors.background,
              borderTopColor: theme.colors.border,
              height: theme.spacing.xxxl,
            },
          ]}
        >
          {showMiniPlayer ? (
            <MiniPlayerContent
              artworkUrl={nowPlaying.artworkUrl}
              artist={nowPlaying.artist}
              canPause={player.canPause}
              errorKind={player.errorKind}
              onTogglePlayback={player.togglePlayback}
              placement="regular"
              status={player.status}
              title={nowPlaying.title}
            />
          ) : (
            <PlaybackStatusBarContent
              error={player.error}
              placement="regular"
              status={player.status}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  androidAccessory: {
    position: "absolute",
    right: 0,
    left: 0,
    zIndex: 1,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 8,
  },
});

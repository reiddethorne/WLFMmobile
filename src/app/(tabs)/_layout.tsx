import { usePathname } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { DynamicColorIOS, Platform } from "react-native";

import { MiniPlayer } from "@/components/MiniPlayer";
import { useAppTheme } from "@/context/ThemeContext";
import { useNowPlaying } from "@/hooks/useNowPlaying";
import { useRadioPlayer } from "@/hooks/useRadioPlayer";

export default function TabLayout() {
  const theme = useAppTheme();
  const nowPlaying = useNowPlaying();
  const player = useRadioPlayer();
  const pathname = usePathname();
  const showMiniPlayer = player.hasRequestedPlayback && pathname !== "/";
  const accessoryContentStyle = showMiniPlayer
    ? {
        paddingBottom: theme.spacing.xxxl,
        backgroundColor: theme.colors.background,
      }
    : undefined;
  const tabIconColor = Platform.OS === "ios"
    ? DynamicColorIOS({
        light: "#000000",
        dark: theme.colors.accent,
      })
    : theme.colors.icon;

  return (
    <NativeTabs
      backgroundColor={theme.colors.surface}
      iconColor={tabIconColor}
      tintColor={tabIconColor}
    >
      {showMiniPlayer && (
        <NativeTabs.BottomAccessory>
          <MiniPlayer
            artist={nowPlaying.artist}
            canPause={player.canPause}
            onTogglePlayback={player.togglePlayback}
            status={player.status}
            title={nowPlaying.title}
          />
        </NativeTabs.BottomAccessory>
      )}

      <NativeTabs.Trigger name="index" accessibilityLabel="Radio tab">
        <NativeTabs.Trigger.Icon
          sf={{ default: "radio", selected: "radio.fill" }}
          md="radio"
        />
        <NativeTabs.Trigger.Label>Radio</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger
        name="schedule"
        accessibilityLabel="Schedule tab"
        contentStyle={accessoryContentStyle}
      >
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
        <NativeTabs.Trigger.Label>Schedule</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger
        name="blog"
        accessibilityLabel="Blog tab"
        contentStyle={accessoryContentStyle}
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
        contentStyle={accessoryContentStyle}
      >
        <NativeTabs.Trigger.Icon
          sf={{ default: "ellipsis.circle", selected: "ellipsis.circle.fill" }}
          md="more_horiz"
        />
        <NativeTabs.Trigger.Label>More</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

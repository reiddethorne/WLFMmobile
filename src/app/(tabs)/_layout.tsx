import { NativeTabs } from "expo-router/unstable-native-tabs";
import { DynamicColorIOS, Platform } from "react-native";

import { useAppTheme } from "@/context/ThemeContext";

export default function TabLayout() {
  const theme = useAppTheme();
  const tabIconColor = Platform.OS === "ios"
    ? DynamicColorIOS({
        light: "#000000",
        dark: theme.colors.accent,
      })
    : theme.colors.icon;

  return (
    <NativeTabs
      iconColor={tabIconColor}
      tintColor={tabIconColor}
    >
      <NativeTabs.Trigger name="index" accessibilityLabel="Radio tab">
        <NativeTabs.Trigger.Icon
          sf={{ default: "radio", selected: "radio.fill" }}
          md="radio"
        />
        <NativeTabs.Trigger.Label>Radio</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="schedule" accessibilityLabel="Schedule tab">
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
        <NativeTabs.Trigger.Label>Schedule</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="blog" accessibilityLabel="Blog tab">
        <NativeTabs.Trigger.Icon
          sf={{ default: "newspaper", selected: "newspaper.fill" }}
          md="newspaper"
        />
        <NativeTabs.Trigger.Label>Blog</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="more" accessibilityLabel="More tab">
        <NativeTabs.Trigger.Icon
          sf={{ default: "ellipsis.circle", selected: "ellipsis.circle.fill" }}
          md="more_horiz"
        />
        <NativeTabs.Trigger.Label>More</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

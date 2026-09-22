import { Tabs } from "expo-router";
import { StyleSheet } from "react-native";

import { THEME } from "@/constants/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: styles.scene,
        tabBarActiveTintColor: THEME.colors.text,
        tabBarInactiveTintColor: THEME.colors.muted,
        tabBarActiveBackgroundColor: THEME.colors.surfaceMuted,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Radio",
          tabBarLabel: "Radio",
          tabBarAccessibilityLabel: "Radio tab",
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          tabBarLabel: "Schedule",
          tabBarAccessibilityLabel: "Schedule tab",
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  scene: {
    backgroundColor: THEME.colors.background,
  },
  tabBar: {
    minHeight: 56,
    backgroundColor: THEME.colors.surface,
    borderTopColor: THEME.colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabBarItem: {
    minHeight: 48,
  },
  tabBarLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
});

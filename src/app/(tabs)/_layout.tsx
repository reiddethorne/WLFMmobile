import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { StyleSheet } from "react-native";

import { createThemedStyles } from "@/hooks/useThemedStyles";

export default function TabLayout() {
  const { styles, theme } = useStyles();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: styles.scene,
        tabBarActiveTintColor: theme.colors.text,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarActiveBackgroundColor: theme.colors.surfaceMuted,
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
          tabBarIcon: ({ focused, size }) => (
            <Ionicons
              color={theme.colors.icon}
              name={focused ? "radio" : "radio-outline"}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          tabBarLabel: "Schedule",
          tabBarAccessibilityLabel: "Schedule tab",
          tabBarIcon: ({ focused, size }) => (
            <Ionicons
              color={theme.colors.icon}
              name={focused ? "calendar" : "calendar-outline"}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="blog"
        options={{
          title: "Blog",
          tabBarLabel: "Blog",
          tabBarAccessibilityLabel: "Blog tab",
          tabBarIcon: ({ focused, size }) => (
            <Ionicons
              color={theme.colors.icon}
              name={focused ? "newspaper" : "newspaper-outline"}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarLabel: "More",
          tabBarAccessibilityLabel: "More tab",
          tabBarIcon: ({ focused, size }) => (
            <Ionicons
              color={theme.colors.icon}
              name={focused ? "ellipsis-horizontal-circle" : "ellipsis-horizontal-circle-outline"}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const useStyles = createThemedStyles((theme) => ({
  scene: {
    backgroundColor: theme.colors.background,
  },
  tabBar: {
    minHeight: 56,
    backgroundColor: theme.colors.surface,
    borderTopColor: theme.colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabBarItem: {
    minHeight: 56,
  },
  tabBarLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
}));

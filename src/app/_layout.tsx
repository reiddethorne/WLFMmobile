import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { PreferencesProvider } from "@/context/PreferencesContext";
import { ShowPreferencesProvider } from "@/context/ShowPreferencesContext";
import { ThemeProvider, useAppTheme } from "@/context/ThemeContext";
import { useReminderNavigation } from "@/hooks/useReminderNavigation";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <PreferencesProvider>
        <ShowPreferencesProvider>
          <RootNavigator />
        </ShowPreferencesProvider>
      </PreferencesProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const theme = useAppTheme();
  useReminderNavigation();

  return (
    <>
      <StatusBar style={theme.scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="preferences"
          options={{
            headerBackTitle: "Back",
            headerShown: true,
            headerShadowVisible: false,
            headerStyle: { backgroundColor: theme.colors.background },
            headerTintColor: theme.colors.text,
            title: "Preferences",
          }}
        />
        <Stack.Screen
          name="sleep-timer"
          options={{
            headerBackTitle: "Back",
            headerShown: true,
            headerShadowVisible: false,
            headerStyle: { backgroundColor: theme.colors.background },
            headerTintColor: theme.colors.text,
            title: "Sleep Timer",
          }}
        />
      </Stack>
    </>
  );
}

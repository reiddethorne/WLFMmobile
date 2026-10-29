import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { PreferencesProvider } from "@/context/PreferencesContext";
import { ThemeProvider, useAppTheme } from "@/context/ThemeContext";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <PreferencesProvider>
        <RootNavigator />
      </PreferencesProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const theme = useAppTheme();

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
      </Stack>
    </>
  );
}

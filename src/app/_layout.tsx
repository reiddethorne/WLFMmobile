import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { THEME } from "@/constants/theme";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: THEME.colors.background } }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

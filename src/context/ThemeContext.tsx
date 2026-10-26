import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SystemUI from "expo-system-ui";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance, useColorScheme } from "react-native";

import { DARK_THEME, LIGHT_THEME, type AppTheme } from "@/constants/theme";

const THEME_PREFERENCE_KEY = "wlfm.theme-preference";
type ThemePreference = "light" | "dark" | null;

interface ThemeContextValue {
  readonly isDark: boolean;
  readonly setDarkMode: (enabled: boolean) => void;
  readonly theme: AppTheme;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>(null);

  useEffect(() => {
    let active = true;

    void AsyncStorage.getItem(THEME_PREFERENCE_KEY).then((storedPreference) => {
      if (!active) return;
      const nextPreference = storedPreference === "dark" || storedPreference === "light"
        ? storedPreference
        : null;
      setPreference(nextPreference);
      Appearance.setColorScheme(nextPreference ?? "unspecified");
    }).catch(() => {
      Appearance.setColorScheme("unspecified");
    });

    return () => {
      active = false;
    };
  }, []);

  const isDark = (preference ?? systemScheme) === "dark";
  const theme = isDark ? DARK_THEME : LIGHT_THEME;

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => undefined);
  }, [theme]);

  const setDarkMode = useCallback((enabled: boolean) => {
    const nextPreference = enabled ? "dark" : "light";
    setPreference(nextPreference);
    Appearance.setColorScheme(nextPreference);
    void AsyncStorage.setItem(THEME_PREFERENCE_KEY, nextPreference).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ isDark, setDarkMode, theme }), [isDark, setDarkMode, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useThemeContext must be used within ThemeProvider");
  return context;
}

export function useAppTheme() {
  return useThemeContext().theme;
}

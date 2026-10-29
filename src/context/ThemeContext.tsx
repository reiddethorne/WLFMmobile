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
export type AppearancePreference = "system" | "light" | "dark";

interface ThemeContextValue {
  readonly appearance: AppearancePreference;
  readonly isDark: boolean;
  readonly setAppearance: (appearance: AppearancePreference) => void;
  readonly theme: AppTheme;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [appearance, setAppearanceState] = useState<AppearancePreference>("system");

  useEffect(() => {
    let active = true;

    void AsyncStorage.getItem(THEME_PREFERENCE_KEY).then((storedPreference) => {
      if (!active) return;
      const nextPreference = storedPreference === "dark" || storedPreference === "light"
        ? storedPreference
        : "system";
      setAppearanceState(nextPreference);
      Appearance.setColorScheme(nextPreference === "system" ? "unspecified" : nextPreference);
    }).catch(() => {
      Appearance.setColorScheme("unspecified");
    });

    return () => {
      active = false;
    };
  }, []);

  const isDark = (appearance === "system" ? systemScheme : appearance) === "dark";
  const theme = isDark ? DARK_THEME : LIGHT_THEME;

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => undefined);
  }, [theme]);

  const setAppearance = useCallback((nextAppearance: AppearancePreference) => {
    setAppearanceState(nextAppearance);
    Appearance.setColorScheme(nextAppearance === "system" ? "unspecified" : nextAppearance);
    void AsyncStorage.setItem(THEME_PREFERENCE_KEY, nextAppearance).catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({ appearance, isDark, setAppearance, theme }),
    [appearance, isDark, setAppearance, theme],
  );

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

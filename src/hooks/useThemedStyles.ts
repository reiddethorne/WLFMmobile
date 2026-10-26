import { useMemo } from "react";
import { StyleSheet } from "react-native";

import type { AppTheme } from "@/constants/theme";
import { useAppTheme } from "@/context/ThemeContext";

export function createThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  createStyles: (theme: AppTheme) => T,
) {
  return function useThemedStyles() {
    const theme = useAppTheme();
    const styles = useMemo(() => StyleSheet.create(createStyles(theme)), [theme]);
    return { styles, theme };
  };
}

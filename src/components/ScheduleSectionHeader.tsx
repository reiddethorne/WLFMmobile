import { StyleSheet, Text, View } from "react-native";

import { THEME } from "@/constants/theme";

export function ScheduleSectionHeader({ title }: { readonly title: string }) {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.md,
    backgroundColor: THEME.colors.background,
    borderBottomColor: THEME.colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    width: "100%",
    maxWidth: THEME.contentMaxWidth,
    alignSelf: "center",
    color: THEME.colors.text,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "800",
  },
});

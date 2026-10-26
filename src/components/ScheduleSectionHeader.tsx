import { StyleSheet, Text, View } from "react-native";

import { createThemedStyles } from "@/hooks/useThemedStyles";

export function ScheduleSectionHeader({ title }: { readonly title: string }) {
  const { styles } = useStyles();

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    </View>
  );
}

const useStyles = createThemedStyles((theme) => ({
  container: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderBottomColor: theme.colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    width: "100%",
    maxWidth: theme.contentMaxWidth,
    alignSelf: "center",
    color: theme.colors.text,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "800",
  },
}));

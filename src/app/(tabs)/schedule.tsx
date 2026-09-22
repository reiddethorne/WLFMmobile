import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { THEME } from "@/constants/theme";

export default function Schedule() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.heading}>
          Schedule
        </Text>
        <Text style={styles.message}>
          The WLFM program schedule is coming in Stage 8.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  content: {
    width: "100%",
    maxWidth: THEME.contentMaxWidth,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.xxl,
    gap: THEME.spacing.md,
    alignSelf: "center",
  },
  heading: {
    color: THEME.colors.text,
    fontSize: THEME.fontSize.heading,
    lineHeight: 44,
    fontWeight: "800",
  },
  message: {
    color: THEME.colors.muted,
    fontSize: THEME.fontSize.body,
    lineHeight: 24,
  },
});

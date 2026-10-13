import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { THEME } from "@/constants/theme";

export default function More() {
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.headingGroup}>
          <Text accessibilityRole="header" style={styles.title}>More</Text>
          <Text style={styles.subtitle}>Settings and station information.</Text>
        </View>

        <View style={styles.placeholder}>
          <View style={styles.iconFrame}>
            <Ionicons
              accessibilityElementsHidden
              color={THEME.colors.accentPressed}
              importantForAccessibility="no-hide-descendants"
              name="settings-outline"
              size={36}
            />
          </View>
          <Text style={styles.placeholderTitle}>More options are coming</Text>
          <Text style={styles.placeholderText}>
            App settings, station details, and other helpful links will live here.
          </Text>
        </View>
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
    paddingHorizontal: THEME.spacing.md,
    paddingTop: THEME.spacing.xl,
    gap: THEME.spacing.xl,
    alignSelf: "center",
  },
  headingGroup: {
    gap: THEME.spacing.sm,
  },
  title: {
    color: THEME.colors.text,
    fontSize: THEME.fontSize.heading,
    fontWeight: "800",
  },
  subtitle: {
    color: THEME.colors.muted,
    fontSize: THEME.fontSize.body,
    lineHeight: 24,
  },
  placeholder: {
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.xl,
    alignItems: "center",
    gap: THEME.spacing.md,
    backgroundColor: THEME.colors.surface,
    borderColor: THEME.colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: THEME.radius.lg,
    shadowColor: THEME.shadow.color,
    shadowOffset: THEME.shadow.offset,
    shadowOpacity: THEME.shadow.opacity,
    shadowRadius: THEME.shadow.radius,
    elevation: THEME.shadow.elevation,
  },
  iconFrame: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: THEME.colors.surfaceMuted,
    borderRadius: THEME.radius.pill,
  },
  placeholderTitle: {
    color: THEME.colors.text,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  placeholderText: {
    maxWidth: 360,
    color: THEME.colors.muted,
    fontSize: THEME.fontSize.body,
    lineHeight: 24,
    textAlign: "center",
  },
});

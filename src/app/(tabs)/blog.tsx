import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { createThemedStyles } from "@/hooks/useThemedStyles";

export default function Blog() {
  const { styles, theme } = useStyles();

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.headingGroup}>
          <Text accessibilityRole="header" style={styles.title}>WLFM Blog</Text>
          <Text style={styles.subtitle}>News, artist spotlights, and stories from the station.</Text>
        </View>

        <View style={styles.placeholder}>
          <View style={styles.iconFrame}>
            <Ionicons
              accessibilityElementsHidden
              color={theme.colors.icon}
              importantForAccessibility="no-hide-descendants"
              name="newspaper-outline"
              size={36}
            />
          </View>
          <Text style={styles.placeholderTitle}>Stories are on the way</Text>
          <Text style={styles.placeholderText}>
            We’re getting the WLFM blog ready for the app. Check back soon for the latest posts.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    width: "100%",
    maxWidth: theme.contentMaxWidth,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xl,
    gap: theme.spacing.xl,
    alignSelf: "center",
  },
  headingGroup: {
    gap: theme.spacing.sm,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSize.heading,
    fontWeight: "800",
  },
  subtitle: {
    color: theme.colors.muted,
    fontSize: theme.fontSize.body,
    lineHeight: 24,
  },
  placeholder: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: theme.radius.lg,
    shadowColor: theme.shadow.color,
    shadowOffset: theme.shadow.offset,
    shadowOpacity: theme.shadow.opacity,
    shadowRadius: theme.shadow.radius,
    elevation: theme.shadow.elevation,
  },
  iconFrame: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.pill,
  },
  placeholderTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  placeholderText: {
    maxWidth: 360,
    color: theme.colors.muted,
    fontSize: theme.fontSize.body,
    lineHeight: 24,
    textAlign: "center",
  },
}));

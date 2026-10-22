import Ionicons from "@expo/vector-icons/Ionicons";
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { THEME } from "@/constants/theme";

const STATION_SHARE_URL = "https://solwlfm.lawrence.edu/live/";

const MORE_SECTIONS = [
  {
    title: "Station Information",
    options: [
      { label: "Get Involved", icon: "people-outline" },
      { label: "Contact Us", icon: "mail-outline" },
      { label: " Our History", icon: "book-outline" },

      {
        label: "Share Station link",
        icon: "share-social-outline",
        shareUrl: STATION_SHARE_URL,
      },
    ],
  },
  {
    title: "Settings",
    options: [
      { label: "Sleep timer", icon: "moon-outline" },
      { label: "Dark mode", icon: "contrast-outline" },
      { label: "Preferences", icon: "options-outline" },
    ],
  },
] as const;

export default function More() {
  const shareStation = async () => {
    try {
      await Share.share(
        {
          message: `Listen to WLFM live: ${STATION_SHARE_URL}`,
          title: "Listen to WLFM live",
          url: STATION_SHARE_URL,
        },
        { dialogTitle: "Share WLFM" },
      );
    } catch {
      Alert.alert("Unable to share", "Please try again.");
    }
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headingGroup}>
          <Text accessibilityRole="header" style={styles.title}>More</Text>
        </View>

        {MORE_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {section.title}
            </Text>
            <View style={styles.optionsCard}>
              {section.options.map((option, index) => {
                const isShareStation = "shareUrl" in option;

                return (
                  <Pressable
                    accessible
                    accessibilityHint={
                      isShareStation ? "Opens the system share sheet" : undefined
                    }
                    accessibilityLabel={option.label}
                    accessibilityRole={isShareStation ? "button" : undefined}
                    key={option.label}
                    onPress={isShareStation ? () => void shareStation() : undefined}
                    style={({ pressed }) => [
                      styles.optionRow,
                      index < section.options.length - 1 && styles.optionDivider,
                      isShareStation && pressed && styles.optionRowPressed,
                    ]}
                  >
                    <View style={styles.optionIcon}>
                      <Ionicons
                        accessibilityElementsHidden
                        color={THEME.colors.accentPressed}
                        importantForAccessibility="no-hide-descendants"
                        name={option.icon}
                        size={22}
                      />
                    </View>
                    <Text style={styles.optionLabel}>{option.label}</Text>
                    <Ionicons
                      accessibilityElementsHidden
                      color={THEME.colors.muted}
                      importantForAccessibility="no-hide-descendants"
                      name="chevron-forward"
                      size={20}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
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
    paddingBottom: THEME.spacing.xl,
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
  section: {
    gap: THEME.spacing.sm,
  },
  sectionTitle: {
    paddingHorizontal: THEME.spacing.xs,
    color: THEME.colors.muted,
    fontSize: THEME.fontSize.caption,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  optionsCard: {
    backgroundColor: THEME.colors.surface,
    borderColor: THEME.colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: THEME.radius.lg,
    shadowColor: THEME.shadow.color,
    shadowOffset: THEME.shadow.offset,
    shadowOpacity: THEME.shadow.opacity,
    shadowRadius: THEME.shadow.radius,
    elevation: THEME.shadow.elevation,
    overflow: "hidden",
  },
  optionRow: {
    minHeight: 64,
    paddingHorizontal: THEME.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.spacing.md,
  },
  optionDivider: {
    borderBottomColor: THEME.colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionRowPressed: {
    backgroundColor: THEME.colors.surfaceMuted,
  },
  optionIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: THEME.colors.surfaceMuted,
    borderRadius: THEME.radius.pill,
  },
  optionLabel: {
    flex: 1,
    color: THEME.colors.text,
    fontSize: THEME.fontSize.body,
    fontWeight: "700",
  },
});

import Ionicons from "@expo/vector-icons/Ionicons";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { createThemedStyles } from "@/hooks/useThemedStyles";

const APP_VERSION = Constants.expoConfig?.version ?? "Unknown";
const CONTACT_URL = "https://solwlfm.lawrence.edu/contact/";
const GET_INVOLVED_URL = "https://solwlfm.lawrence.edu/get-involved/";
const HISTORY_URL = "https://solwlfm.lawrence.edu/history/";
const STATION_SHARE_URL = "https://solwlfm.lawrence.edu/live/";

const MORE_SECTIONS = [
  {
    title: "Station Information",
    options: [
      {
        label: "Get Involved",
        icon: "people-outline",
        url: GET_INVOLVED_URL,
      },
      { label: "Contact Us", icon: "mail-outline", url: CONTACT_URL },
      { label: "Our History", icon: "book-outline", url: HISTORY_URL },

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
      { label: "Preferences", icon: "options-outline" },
    ],
  },
] as const;

export default function More() {
  const router = useRouter();
  const { styles, theme } = useStyles();

  const openExternalUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Unable to open link", "Please try again.");
    }
  };

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

        {MORE_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {section.title}
            </Text>
            <View style={styles.optionsCard}>
              {section.options.map((option, index) => {
                const isShareStation = "shareUrl" in option;
                const isExternalLink = "url" in option;
                const isPreferences = option.label === "Preferences";
                const isInteractive = isShareStation || isExternalLink || isPreferences;
                const onPress = isPreferences
                  ? () => router.push("/preferences")
                  : isShareStation
                  ? () => void shareStation()
                  : isExternalLink
                    ? () => void openExternalUrl(option.url)
                    : undefined;

                return (
                  <Pressable
                    accessible
                    accessibilityHint={
                      isPreferences
                        ? "Opens app preferences"
                        : isShareStation
                        ? "Opens the system share sheet"
                        : isExternalLink
                          ? "Opens in your browser"
                          : undefined
                    }
                    accessibilityLabel={option.label}
                    accessibilityRole={isInteractive ? "button" : undefined}
                    key={option.label}
                    onPress={onPress}
                    style={({ pressed }) => [
                      styles.optionRow,
                      index < section.options.length - 1 && styles.optionDivider,
                      isInteractive && pressed && styles.optionRowPressed,
                    ]}
                  >
                    <View style={styles.optionIcon}>
                      <Ionicons
                        accessibilityElementsHidden
                        color={theme.colors.icon}
                        importantForAccessibility="no-hide-descendants"
                        name={option.icon}
                        size={22}
                      />
                    </View>
                    <Text style={styles.optionLabel}>{option.label}</Text>
                    <Ionicons
                      accessibilityElementsHidden
                      color={theme.colors.icon}
                      importantForAccessibility="no-hide-descendants"
                      name="chevron-forward"
                      size={20}
                    />
                  </Pressable>
                );
              })}
            </View>
            {section.title === "Settings" && (
              <Text style={styles.versionText}>App version {APP_VERSION}</Text>
            )}
          </View>
        ))}
      </ScrollView>
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
    paddingBottom: theme.spacing.xl,
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
  section: {
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    paddingHorizontal: theme.spacing.xs,
    paddingBottom: theme.spacing.xs,
    color: theme.colors.text,
    fontSize: theme.fontSize.body,
    lineHeight: 22,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  versionText: {
    paddingTop: theme.spacing.xs,
    color: theme.colors.muted,
    textAlign: "center",
  },
  optionsCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: theme.radius.lg,
    shadowColor: theme.shadow.color,
    shadowOffset: theme.shadow.offset,
    shadowOpacity: theme.shadow.opacity,
    shadowRadius: theme.shadow.radius,
    elevation: theme.shadow.elevation,
    overflow: "hidden",
  },
  optionRow: {
    minHeight: 64,
    paddingHorizontal: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  optionDivider: {
    borderBottomColor: theme.colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionRowPressed: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  optionIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.pill,
  },
  optionLabel: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.fontSize.body,
    fontWeight: "700",
  },
}));

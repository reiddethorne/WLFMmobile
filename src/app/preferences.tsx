import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  type ScheduleTimeMode,
  usePreferences,
} from "@/context/PreferencesContext";
import {
  type AppearancePreference,
  useThemeContext,
} from "@/context/ThemeContext";
import { createThemedStyles } from "@/hooks/useThemedStyles";

const APPEARANCE_OPTIONS = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
] as const satisfies readonly { readonly label: string; readonly value: AppearancePreference }[];

const SCHEDULE_TIME_OPTIONS = [
  { label: "Station", value: "station" },
  { label: "Local", value: "local" },
] as const satisfies readonly { readonly label: string; readonly value: ScheduleTimeMode }[];

function PreferenceSelector<T extends string>({
  icon,
  label,
  onChange,
  options,
  value,
}: {
  readonly icon: React.ComponentProps<typeof Ionicons>["name"];
  readonly label: string;
  readonly onChange: (value: T) => void;
  readonly options: readonly { readonly label: string; readonly value: T }[];
  readonly value: T;
}) {
  const { styles, theme } = useStyles();

  return (
    <View style={styles.preferenceRow}>
      <View style={styles.preferenceHeading}>
        <View style={styles.optionIcon}>
          <Ionicons
            accessibilityElementsHidden
            color={theme.colors.icon}
            importantForAccessibility="no-hide-descendants"
            name={icon}
            size={22}
          />
        </View>
        <Text style={styles.optionLabel}>{label}</Text>
      </View>
      <View accessibilityLabel={label} accessibilityRole="radiogroup" style={styles.segmentedControl}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              accessibilityLabel={`${option.label} ${label.toLocaleLowerCase("en-US")}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.segment,
                selected && styles.selectedSegment,
                pressed && styles.segmentPressed,
              ]}
            >
              <Text style={[styles.segmentText, selected && styles.selectedSegmentText]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function Preferences() {
  const {
    scheduleTimeMode,
    setScheduleTimeMode,
    setShowDiagnostics,
    showDiagnostics,
  } = usePreferences();
  const { appearance, setAppearance } = useThemeContext();
  const { styles, theme } = useStyles();

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>General</Text>
          <View style={styles.optionsCard}>
            <PreferenceSelector
              icon="contrast-outline"
              label="Appearance"
              onChange={setAppearance}
              options={APPEARANCE_OPTIONS}
              value={appearance}
            />
            <View style={styles.optionDivider} />
            <PreferenceSelector
              icon="time-outline"
              label="Schedule times"
              onChange={setScheduleTimeMode}
              options={SCHEDULE_TIME_OPTIONS}
              value={scheduleTimeMode}
            />
          </View>
        </View>

        {__DEV__ && (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Developer</Text>
            <View style={styles.optionsCard}>
              <Pressable
                accessibilityHint="Shows or hides connection and playback diagnostics on the Home screen"
                accessibilityLabel="Show diagnostics"
                accessibilityRole="switch"
                accessibilityState={{ checked: showDiagnostics }}
                onPress={() => setShowDiagnostics(!showDiagnostics)}
                style={({ pressed }) => [styles.optionRow, pressed && styles.optionRowPressed]}
              >
                <View style={styles.optionIcon}>
                  <Ionicons
                    accessibilityElementsHidden
                    color={theme.colors.icon}
                    importantForAccessibility="no-hide-descendants"
                    name="bug-outline"
                    size={22}
                  />
                </View>
                <Text style={styles.optionLabel}>Show diagnostics</Text>
                <Switch
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  ios_backgroundColor={theme.colors.disabled}
                  onValueChange={setShowDiagnostics}
                  pointerEvents="none"
                  style={styles.settingSwitch}
                  thumbColor={theme.colors.surface}
                  trackColor={{ false: theme.colors.disabled, true: theme.colors.accent }}
                  value={showDiagnostics}
                />
              </Pressable>
            </View>
          </View>
        )}
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
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.xl,
    alignSelf: "center",
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    paddingHorizontal: theme.spacing.xs,
    color: theme.colors.muted,
    fontSize: theme.fontSize.caption,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
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
  settingSwitch: {
    alignSelf: "center",
  },
  preferenceRow: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  preferenceHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  segmentedControl: {
    minHeight: 44,
    padding: 3,
    flexDirection: "row",
    gap: 3,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.md,
  },
  segment: {
    minWidth: 0,
    minHeight: 38,
    paddingHorizontal: theme.spacing.sm,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.md,
  },
  selectedSegment: {
    backgroundColor: theme.colors.accent,
  },
  segmentPressed: {
    opacity: 0.72,
  },
  segmentText: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: "700",
  },
  selectedSegmentText: {
    color: theme.colors.accentText,
  },
}));

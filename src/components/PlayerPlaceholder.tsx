import { StyleSheet, Text, View } from "react-native";

import { PlayerButton } from "@/components/PlayerButton";
import { THEME } from "@/constants/theme";

export function PlayerPlaceholder() {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Lawrence University Student Radio</Text>
      <View style={styles.artwork} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={styles.artworkText}>WLFM
        </Text>
      </View>
      <Text accessibilityRole="header" style={styles.title}>Tap to Listen live</Text>
      <PlayerButton />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.surface,
    borderColor: THEME.colors.border,
    borderWidth: 1,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.lg,
    gap: THEME.spacing.md,
  },
  label: { color: THEME.colors.accent, fontSize: THEME.fontSize.caption, fontWeight: "700", letterSpacing: 1.5, alignSelf: "center" },
  artwork: {
    aspectRatio: 1,
    width: "100%",
    maxWidth: 220,
    height: 220,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: THEME.colors.background,
    borderColor: THEME.colors.border,
    borderWidth: 1,
    borderRadius: 0,
    marginVertical: THEME.spacing.md,
  },
  artworkText: { color: THEME.colors.accent, fontSize: THEME.fontSize.heading, fontWeight: "700", letterSpacing: 1 },
  title: { color: THEME.colors.text, fontSize: THEME.fontSize.title, fontWeight: "600", alignSelf: "center"},
  description: { color: THEME.colors.muted, fontSize: THEME.fontSize.body, lineHeight: 24 },
});

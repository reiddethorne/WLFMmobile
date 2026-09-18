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
      <Text accessibilityRole="header" style={styles.title}>Listen live</Text>
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
  label: { color: THEME.colors.accent, fontSize: THEME.fontSize.caption, fontWeight: "700", letterSpacing: 1.5 },
  artwork: {
    aspectRatio: 1,
    width: "100%",
    maxWidth: 240,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: THEME.colors.background,
    borderRadius: THEME.radius.md,
    marginVertical: THEME.spacing.md,
  },
  artworkText: { color: THEME.colors.accent, fontSize: THEME.fontSize.heading, fontWeight: "800", letterSpacing: 2 },
  title: { color: THEME.colors.text, fontSize: THEME.fontSize.title, fontWeight: "700" },
  description: { color: THEME.colors.muted, fontSize: THEME.fontSize.body, lineHeight: 24 },
});

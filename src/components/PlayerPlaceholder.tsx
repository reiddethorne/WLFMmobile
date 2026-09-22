import { StyleSheet, Text, View } from "react-native";

import { NowPlaying } from "@/components/NowPlaying";
import { PlayerButton } from "@/components/PlayerButton";
import { THEME } from "@/constants/theme";

export function PlayerPlaceholder() {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Lawrence University Student Radio</Text>
      <NowPlaying />
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
});

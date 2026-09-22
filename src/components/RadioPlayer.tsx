import { Image, StyleSheet, Text, View } from "react-native";

import { NowPlaying } from "@/components/NowPlaying";
import { PlayerButton } from "@/components/PlayerButton";
import { STATION } from "@/config/station";
import { STATION_ARTWORK } from "@/constants/assets";
import { THEME } from "@/constants/theme";

export function RadioPlayer() {
  return (
    <View style={styles.card}>
      <View style={styles.stationHeader}>
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={`${STATION.name} station logo`}
          source={STATION_ARTWORK}
          style={styles.logo}
        />
        <View style={styles.stationText}>
          <Text accessibilityRole="header" numberOfLines={1} style={styles.stationName}>
            {STATION.name}
          </Text>
          <Text numberOfLines={2} style={styles.slogan}>{STATION.slogan}</Text>
        </View>
        <View accessible accessibilityLabel="Live radio" accessibilityRole="text" style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>
      <NowPlaying />
      <PlayerButton />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    padding: THEME.spacing.lg,
    gap: THEME.spacing.lg,
    backgroundColor: THEME.colors.surface,
    borderColor: THEME.colors.border,
    borderWidth: 1,
    borderRadius: THEME.radius.lg,
    shadowColor: THEME.shadow.color,
    shadowOffset: THEME.shadow.offset,
    shadowOpacity: THEME.shadow.opacity,
    shadowRadius: THEME.shadow.radius,
    elevation: THEME.shadow.elevation,
  },
  stationHeader: { flexDirection: "row", alignItems: "center", gap: THEME.spacing.md },
  logo: { width: 56, height: 56, borderRadius: THEME.radius.md },
  stationText: { flex: 1, gap: THEME.spacing.xs },
  stationName: { color: THEME.colors.text, fontSize: 24, fontWeight: "800", letterSpacing: 0.5 },
  slogan: { color: THEME.colors.muted, fontSize: 14, lineHeight: 20 },
  liveBadge: {
    minHeight: 36,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: THEME.colors.liveSurface,
    borderRadius: THEME.radius.pill,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: THEME.colors.live },
  liveText: { color: THEME.colors.live, fontSize: THEME.fontSize.caption, fontWeight: "800", letterSpacing: 1 },
});

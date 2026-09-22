import { Image, StyleSheet, Text, View } from "react-native";

import { STATION } from "@/config/station";
import { STATION_ARTWORK } from "@/constants/assets";
import { THEME } from "@/constants/theme";

export function StationHeader() {
  return (
    <View style={styles.stationHeader}>
      <View style={styles.stationText}>
        <Text accessibilityRole="header" numberOfLines={1} style={styles.stationName}>
          {STATION.name}
        </Text>
      </View>
      <Image
        accessibilityIgnoresInvertColors
        accessibilityLabel={`${STATION.name} station logo`}
        resizeMode="contain"
        source={STATION_ARTWORK}
        style={styles.logo}
      />
      <View accessible accessibilityLabel="Live radio" accessibilityRole="text" style={styles.liveBadge}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>LIVE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stationHeader: {
    width: "100%",
    paddingHorizontal: THEME.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    gap: THEME.spacing.sm,
  },
  logo: { flex: 1, maxWidth: 100, height: 56, borderRadius: THEME.radius.md },
  stationText: {
    flex: 1,
    maxWidth: 100,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  stationName: {
    color: THEME.colors.text,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  liveBadge: {
    flex: 1,
    maxWidth: 100,
    height: 36,
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

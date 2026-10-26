import { Image, StyleSheet, Text, View } from "react-native";

import { STATION } from "@/config/station";
import { STATION_ARTWORK } from "@/constants/assets";
import { createThemedStyles } from "@/hooks/useThemedStyles";

export function StationHeader() {
  const { styles } = useStyles();

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

const useStyles = createThemedStyles((theme) => ({
  stationHeader: {
    width: "100%",
    paddingHorizontal: theme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    gap: theme.spacing.sm,
  },
  logo: { flex: 1, maxWidth: 100, height: 56, borderRadius: theme.radius.md },
  stationText: {
    flex: 1,
    maxWidth: 100,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  stationName: {
    color: theme.colors.text,
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
    backgroundColor: theme.colors.liveSurface,
    borderRadius: theme.radius.pill,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.live },
  liveText: { color: theme.colors.live, fontSize: theme.fontSize.caption, fontWeight: "800", letterSpacing: 1 },
}));

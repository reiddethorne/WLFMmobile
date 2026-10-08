import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { PlayerButton } from "@/components/PlayerButton";
import { STATION_ARTWORK } from "@/constants/assets";
import { THEME } from "@/constants/theme";
import { useNowPlaying } from "@/hooks/useNowPlaying";

export function NowPlaying() {
  const { title, artist, artworkUrl } = useNowPlaying();
  const [failedArtwork, setFailedArtwork] = useState<string | null>(null);
  const remoteArtwork = artworkUrl !== null && artworkUrl !== failedArtwork;

  return (
    <View style={styles.container}>
      <View style={styles.artworkArea}>
        <View style={styles.artworkFrame}>
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel={`${title} artwork`}
            onError={() => { if (artworkUrl) setFailedArtwork(artworkUrl); }}
            resizeMode="cover"
            source={remoteArtwork ? { uri: artworkUrl } : STATION_ARTWORK}
            style={styles.artwork}
          />
        </View>
        <View style={styles.playerButton}>
          <PlayerButton />
        </View>
      </View>

      <Text accessibilityRole="header" numberOfLines={2} style={styles.title}>{title}</Text>
      <Text numberOfLines={2} style={styles.artist}>{artist}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", alignItems: "center", gap: THEME.spacing.sm },
  artworkArea: {
    position: "relative",
    width: "100%",
    maxWidth: 320,
    paddingBottom: 36,
    alignItems: "center",
  },
  artworkFrame: {
    width: "100%",
    height: 320,
    maxWidth: 320,
    aspectRatio: 1,
    backgroundColor: THEME.colors.surfaceMuted,
    borderColor: THEME.colors.border,
    borderWidth: 1,
    borderRadius: THEME.radius.md,
    shadowColor: THEME.shadow.color,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 3,
  },
  playerButton: {
    position: "absolute",
    bottom: 0,
    zIndex: 1,
  },
  artwork: {
    width: "100%",
    height: "100%",
  },
  eyebrow: { color: THEME.colors.accent, fontSize: THEME.fontSize.caption, fontWeight: "800", letterSpacing: 1.8 },
  title: { color: THEME.colors.text, fontSize: THEME.fontSize.title, lineHeight: 34, fontWeight: "700", textAlign: "center" },
  artist: { color: THEME.colors.muted, fontSize: 18, lineHeight: 26, textAlign: "center" },
});

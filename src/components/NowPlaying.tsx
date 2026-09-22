import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { STATION_ARTWORK } from "@/constants/assets";
import { THEME } from "@/constants/theme";
import { useNowPlaying } from "@/hooks/useNowPlaying";

export function NowPlaying() {
  const { title, artist, artworkUrl } = useNowPlaying();
  const [failedArtwork, setFailedArtwork] = useState<string | null>(null);
  const remoteArtwork = artworkUrl !== null && artworkUrl !== failedArtwork;

  return (
    <View style={styles.container}>
      <Image
        accessibilityLabel={`${title} artwork`}
        onError={() => { if (artworkUrl) setFailedArtwork(artworkUrl); }}
        resizeMode="cover"
        source={remoteArtwork ? { uri: artworkUrl } : STATION_ARTWORK}
        style={styles.artwork}
      />
      <Text accessibilityRole="header" numberOfLines={2} style={styles.title}>{title}</Text>
      <Text numberOfLines={2} style={styles.artist}>{artist}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: THEME.spacing.sm },
  artwork: {
    aspectRatio: 1,
    width: "100%",
    maxWidth: 220,
    height: 220,
    borderColor: THEME.colors.border,
    borderWidth: 1,
    marginVertical: THEME.spacing.md,
  },
  title: { color: THEME.colors.text, fontSize: THEME.fontSize.title, fontWeight: "600", textAlign: "center" },
  artist: { color: THEME.colors.muted, fontSize: THEME.fontSize.body, textAlign: "center" },
});

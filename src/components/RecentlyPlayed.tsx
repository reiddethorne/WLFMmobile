import { useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";

import { STATION_ARTWORK } from "@/constants/assets";
import { createThemedStyles } from "@/hooks/useThemedStyles";
import { useRecentlyPlayed } from "@/hooks/useRecentlyPlayed";
import type { Live365RecentTrack } from "@/types/live365";

function TrackRow({ track, last }: { readonly track: Live365RecentTrack; readonly last: boolean }) {
  const { styles } = useStyles();
  const [failedArtwork, setFailedArtwork] = useState<string | null>(null);
  const remoteArtwork = track.artworkUrl !== null && track.artworkUrl !== failedArtwork;
  const title = track.title ?? "Untitled";
  const artist = track.artist ?? "WLFM";

  return (
    <View
      accessible
      accessibilityLabel={`${title} by ${artist}`}
      style={[styles.row, !last && styles.rowBorder]}
    >
      <Image
        accessibilityIgnoresInvertColors
        onError={() => { if (track.artworkUrl) setFailedArtwork(track.artworkUrl); }}
        resizeMode="cover"
        source={remoteArtwork ? { uri: track.artworkUrl } : STATION_ARTWORK}
        style={styles.artwork}
      />
      <View style={styles.trackText}>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        <Text numberOfLines={1} style={styles.artist}>{artist}</Text>
      </View>
    </View>
  );
}

export function RecentlyPlayed() {
  const { tracks, status } = useRecentlyPlayed();
  const { styles, theme } = useStyles();

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.heading}>RECENTLY PLAYED</Text>
      <View style={styles.list}>
        {tracks.map((track, index) => (
          <TrackRow
            key={`${track.startedAt ?? "unknown"}-${track.artist ?? ""}-${track.title ?? ""}-${index}`}
            last={index === tracks.length - 1}
            track={track}
          />
        ))}
        {tracks.length === 0 && status === "loading" && (
          <View accessibilityLabel="Loading recently played tracks" style={styles.message}>
            <ActivityIndicator color={theme.colors.accent} />
            <Text style={styles.messageText}>Loading recent tracks…</Text>
          </View>
        )}
        {tracks.length === 0 && status === "error" && (
          <Text accessibilityLiveRegion="polite" style={styles.messageText}>
            Recently played is temporarily unavailable.
          </Text>
        )}
        {tracks.length === 0 && status === "ready" && (
          <Text style={styles.messageText}>No recently played tracks are available.</Text>
        )}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((theme) => ({
  container: {
    width: "100%",
    marginTop: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  heading: {
    color: theme.colors.accent,
    fontSize: theme.fontSize.caption,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  list: {
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
  },
  row: {
    minHeight: 72,
    padding: theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  rowBorder: {
    borderBottomColor: theme.colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  artwork: {
    width: 56,
    height: 56,
    flexShrink: 0,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.md,
  },
  trackText: { flex: 1, minWidth: 0, gap: theme.spacing.xs },
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSize.body,
    lineHeight: 22,
    fontWeight: "700",
  },
  artist: { color: theme.colors.muted, fontSize: 14, lineHeight: 20 },
  message: {
    minHeight: 88,
    padding: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
  },
  messageText: {
    padding: theme.spacing.md,
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
}));

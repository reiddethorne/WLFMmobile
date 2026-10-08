import { useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";

import { STATION_ARTWORK } from "@/constants/assets";
import { THEME } from "@/constants/theme";
import { useRecentlyPlayed } from "@/hooks/useRecentlyPlayed";
import type { Live365RecentTrack } from "@/types/live365";

function TrackRow({ track, last }: { readonly track: Live365RecentTrack; readonly last: boolean }) {
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
            <ActivityIndicator color={THEME.colors.accent} />
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

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginTop: THEME.spacing.xl,
    gap: THEME.spacing.sm,
  },
  heading: {
    color: THEME.colors.accent,
    fontSize: THEME.fontSize.caption,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  list: {
    overflow: "hidden",
    backgroundColor: THEME.colors.surface,
    borderColor: THEME.colors.border,
    borderWidth: 1,
    borderRadius: THEME.radius.md,
  },
  row: {
    minHeight: 72,
    padding: THEME.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.spacing.md,
  },
  rowBorder: {
    borderBottomColor: THEME.colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  artwork: {
    width: 56,
    height: 56,
    flexShrink: 0,
    backgroundColor: THEME.colors.surfaceMuted,
    borderRadius: THEME.radius.md,
  },
  trackText: { flex: 1, minWidth: 0, gap: THEME.spacing.xs },
  title: {
    color: THEME.colors.text,
    fontSize: THEME.fontSize.body,
    lineHeight: 22,
    fontWeight: "700",
  },
  artist: { color: THEME.colors.muted, fontSize: 14, lineHeight: 20 },
  message: {
    minHeight: 88,
    padding: THEME.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: THEME.spacing.sm,
  },
  messageText: {
    padding: THEME.spacing.md,
    color: THEME.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});

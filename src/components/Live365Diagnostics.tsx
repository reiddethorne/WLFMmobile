import { Pressable, StyleSheet, Text, View } from "react-native";

import { STATION } from "@/config/station";
import { createThemedStyles } from "@/hooks/useThemedStyles";
import { useLive365Diagnostics } from "@/hooks/useLive365Diagnostics";

export function Live365Diagnostics() {
  const { state, refresh } = useLive365Diagnostics();
  const { styles } = useStyles();
  const station = state.status === "ready" ? state.station : null;

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>Live365 connection check</Text>
      <Text style={styles.text}>Station: {station?.name ?? STATION.name} ({STATION.id})</Text>
      <Text accessibilityLiveRegion="polite" style={styles.text}>
        API: {state.status === "loading" ? "Checking…" : state.status === "error" ? state.message : "Connected"}
      </Text>
      <Text style={styles.text}>
        Stream: {station ? station.preferredStream ? "URL available (not playing)" : "Unavailable" : "Not verified"}
      </Text>
      {station?.preferredStream && (
        <>
          <Text selectable style={styles.url}>{station.preferredStream.url}</Text>
          <Text style={styles.text}>
            {station.preferredStream.encoding.toUpperCase()}
            {station.preferredStream.bitrateKbps ? ` · ${station.preferredStream.bitrateKbps} kbps` : ""}
            {" · ICY stream"}
          </Text>
        </>
      )}
      <Text style={styles.text}>Title: {station?.nowPlaying?.title ?? "LIVE"}</Text>
      <Text style={styles.text}>Artist: {station?.nowPlaying?.artist ?? STATION.name}</Text>
      <Text style={styles.note}>Metadata is an API snapshot. Refresh to check again. Stream availability does not prove playback.</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Refresh Live365 connection check"
        accessibilityState={{ disabled: state.status === "loading" }}
        disabled={state.status === "loading"}
        onPress={refresh}
        style={({ pressed }) => [styles.button, { opacity: pressed || state.status === "loading" ? 0.6 : 1 }]}
      >
        <Text style={styles.buttonText}>{state.status === "loading" ? "Checking…" : "Refresh"}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles((theme) => ({
  card: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
  },
  heading: { color: theme.colors.accent, fontSize: theme.fontSize.body, fontWeight: "700" },
  text: { color: theme.colors.text, fontSize: theme.fontSize.body, lineHeight: 24 },
  url: { color: theme.colors.accent, fontSize: theme.fontSize.caption, lineHeight: 20 },
  note: { color: theme.colors.muted, fontSize: theme.fontSize.caption, lineHeight: 18 },
  button: { minHeight: 52, padding: theme.spacing.md, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.md, backgroundColor: theme.colors.accent },
  buttonText: { color: theme.colors.surface, fontSize: theme.fontSize.body, fontWeight: "700" },
}));

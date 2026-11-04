import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useShowPreferences } from "@/context/ShowPreferencesContext";
import { createThemedStyles } from "@/hooks/useThemedStyles";

export function ShowPreferences() {
  const { favorites, ready, error, retry, store } = useShowPreferences();
  const { styles } = useStyles();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const removeFavorite = async (title: string) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try { await store.toggleFavorite(title); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "The change could not be saved. Please try again."); }
    finally { setBusy(false); }
  };

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>Favorite programs ({favorites.length})</Text>
      <View style={styles.card}>
        {!ready && error ? (
          <>
            <Text accessibilityLiveRegion="polite" style={styles.message}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={retry} style={styles.action}>
              <Text style={styles.actionText}>Try again</Text>
            </Pressable>
          </>
        ) : !ready ? <Text accessibilityLiveRegion="polite" style={styles.detail}>Loading favorites…</Text>
          : favorites.length === 0 && <Text style={styles.detail}>Tap Favorite on a program in Schedule.</Text>}
        {favorites.map((favorite) => (
          <View key={favorite.key} style={styles.favoriteRow}>
            <Text style={styles.title}>{favorite.title}</Text>
            <Pressable
              accessibilityLabel={`Remove ${favorite.title} from favorites`}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy || !ready }}
              disabled={busy || !ready}
              onPress={() => { void removeFavorite(favorite.title); }}
              style={({ pressed }) => [styles.action, pressed && styles.pressed, (busy || !ready) && styles.disabled]}
            >
              <Text style={styles.actionText}>Remove</Text>
            </Pressable>
          </View>
        ))}
        {message && <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((theme) => ({
  section: { gap: theme.spacing.sm },
  heading: { paddingHorizontal: theme.spacing.xs, color: theme.colors.muted, fontSize: theme.fontSize.caption, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  card: { padding: theme.spacing.md, gap: theme.spacing.sm, backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.lg },
  favoriteRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: theme.spacing.sm },
  title: { flex: 1, minWidth: 100, color: theme.colors.text, fontSize: 16, fontWeight: "700" },
  detail: { color: theme.colors.muted, fontSize: 14, lineHeight: 21 },
  message: { color: theme.colors.error, fontSize: 14, lineHeight: 21 },
  action: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, alignSelf: "flex-start", justifyContent: "center", borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceMuted },
  actionText: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
}));

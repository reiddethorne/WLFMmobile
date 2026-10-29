import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Live365Diagnostics } from "@/components/Live365Diagnostics";
import { RadioPlayer } from "@/components/RadioPlayer";
import { StationHeader } from "@/components/StationHeader";
import { usePreferences } from "@/context/PreferencesContext";
import { createThemedStyles } from "@/hooks/useThemedStyles";

export default function Index() {
  const insets = useSafeAreaInsets();
  const { showDiagnostics } = usePreferences();
  const { styles } = useStyles();

  return (
    <View style={styles.screen}>
      <View
        pointerEvents="none"
        style={[styles.topBarSafeArea, { height: insets.top }]}
      />
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} stickyHeaderIndices={[0]}>
          <View style={styles.stickyHeader}>
            <View style={styles.headerContent}>
              <StationHeader />
            </View>
          </View>
          <View style={styles.content}>
            <RadioPlayer />
            {__DEV__ && showDiagnostics && <Live365Diagnostics />}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const useStyles = createThemedStyles((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  safeArea: {
    flex: 1,
  },
  topBarSafeArea: {
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
    backgroundColor: theme.colors.topBar,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: theme.spacing.xxxl + theme.spacing.xl,
  },
  stickyHeader: {
    zIndex: 1,
    width: "100%",
    paddingVertical: theme.spacing.sm,
    alignItems: "center",
    backgroundColor: theme.colors.topBar,
    borderBottomColor: theme.colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerContent: { width: "100%", paddingHorizontal: theme.spacing.md },
  content: {
    width: "100%",
    maxWidth: theme.contentMaxWidth,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.xl,
    alignSelf: "center",
  },
}));

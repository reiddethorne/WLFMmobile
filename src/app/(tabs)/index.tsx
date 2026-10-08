import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Live365Diagnostics } from "@/components/Live365Diagnostics";
import { RadioPlayer } from "@/components/RadioPlayer";
import { StationHeader } from "@/components/StationHeader";
import { THEME } from "@/constants/theme";

const TOP_BAR_BACKGROUND = "rgba(255, 248, 242, 0.94)";

export default function Index() {
  const insets = useSafeAreaInsets();

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
            {__DEV__ && <Live365Diagnostics />}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  safeArea: {
    flex: 1,
  },
  topBarSafeArea: {
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
    backgroundColor: TOP_BAR_BACKGROUND,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: THEME.spacing.xxxl,
  },
  stickyHeader: {
    zIndex: 1,
    width: "100%",
    paddingVertical: THEME.spacing.sm,
    alignItems: "center",
    backgroundColor: TOP_BAR_BACKGROUND,
    borderBottomColor: THEME.colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerContent: { width: "100%", paddingHorizontal: THEME.spacing.md },
  content: {
    width: "100%",
    maxWidth: THEME.contentMaxWidth,
    paddingHorizontal: THEME.spacing.md,
    gap: THEME.spacing.xl,
    alignSelf: "center",
  },
});

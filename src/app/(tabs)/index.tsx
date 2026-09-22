import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Live365Diagnostics } from "@/components/Live365Diagnostics";
import { RadioPlayer } from "@/components/RadioPlayer";
import { StationHeader } from "@/components/StationHeader";
import { THEME } from "@/constants/theme";

export default function Index() {
  return (
    <SafeAreaView style={styles.screen}>
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
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: THEME.spacing.xxxl,
  },
  stickyHeader: {
    zIndex: 1,
    width: "100%",
    paddingVertical: THEME.spacing.md,
    alignItems: "center",
    backgroundColor: THEME.colors.background,
    borderBottomColor: THEME.colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    shadowColor: THEME.shadow.color,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  headerContent: { width: "100%", paddingHorizontal: THEME.spacing.md },
  content: {
    width: "100%",
    maxWidth: THEME.contentMaxWidth,
    paddingHorizontal: THEME.spacing.md,
    paddingTop: THEME.spacing.xl,
    gap: THEME.spacing.xl,
    alignSelf: "center",
  },
});

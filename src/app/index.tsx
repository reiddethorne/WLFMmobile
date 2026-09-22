import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Live365Diagnostics } from "@/components/Live365Diagnostics";
import { RadioPlayer } from "@/components/RadioPlayer";
import { THEME } from "@/constants/theme";

export default function Index() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
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
    paddingHorizontal: THEME.spacing.md,
    paddingTop: THEME.spacing.xl,
    paddingBottom: THEME.spacing.xxxl,
    alignItems: "center",
  },
  content: { width: "100%", maxWidth: THEME.contentMaxWidth, gap: THEME.spacing.xl },
});

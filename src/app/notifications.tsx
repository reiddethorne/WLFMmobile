import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { NotificationPreferences } from "@/components/NotificationPreferences";
import { createThemedStyles } from "@/hooks/useThemedStyles";

export default function Notifications() {
  const { styles } = useStyles();

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <NotificationPreferences />
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    width: "100%",
    maxWidth: theme.contentMaxWidth,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    alignSelf: "center",
  },
}));

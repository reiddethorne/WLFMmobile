import { Text, View } from "react-native";

import { createThemedStyles } from "@/hooks/useThemedStyles";

export function ScheduleSectionHeader({
  eventCount,
  title,
}: {
  readonly eventCount: number;
  readonly title: string;
}) {
  const { styles } = useStyles();
  const [weekday, date] = title.split(", ");

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.titleGroup}>
          <Text style={styles.weekday}>{weekday?.toLocaleUpperCase("en-US")}</Text>
          <Text accessibilityRole="header" style={styles.title}>{date ?? title}</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{eventCount} {eventCount === 1 ? "show" : "shows"}</Text>
        </View>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((theme) => ({
  container: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: theme.colors.background,
  },
  content: {
    width: "100%",
    maxWidth: theme.contentMaxWidth,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    alignSelf: "center",
  },
  titleGroup: {
    flexShrink: 1,
    gap: 1,
  },
  weekday: {
    color: theme.colors.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  title: {
    color: theme.colors.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
  },
  countBadge: {
    marginBottom: 2,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  countText: {
    color: theme.colors.muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
  },
}));

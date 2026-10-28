import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, ScrollView, Text, View } from "react-native";

import { createThemedStyles } from "@/hooks/useThemedStyles";

interface ScheduleFilterDate {
  readonly value: string;
  readonly label: string;
}

interface ScheduleFiltersProps {
  readonly dates: readonly ScheduleFilterDate[];
  readonly selectedDate: string | null;
  readonly onSelectDate: (date: string | null) => void;
}

export function ScheduleFilters({
  dates,
  selectedDate,
  onSelectDate,
}: ScheduleFiltersProps) {
  const { styles } = useStyles();

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.dateList}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <DateChip
          label="All"
          onPress={() => onSelectDate(null)}
          selected={selectedDate === null}
        />
        {dates.map((date) => (
          <DateChip
            key={date.value}
            label={date.label}
            onPress={() => onSelectDate(date.value)}
            selected={selectedDate === date.value}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function DateChip({ label, selected, onPress }: {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
}) {
  const { styles, theme } = useStyles();
  const [weekday, date] = label.split(", ");
  const isAll = label === "All";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.dateChip,
        selected && styles.selectedDateChip,
        pressed && styles.pressed,
      ]}
    >
      {isAll ? (
        <>
          <Ionicons
            color={selected ? theme.colors.accentText : theme.colors.muted}
            name="apps-outline"
            size={20}
          />
          <Text style={[styles.dateChipText, selected && styles.selectedDateChipText]}>All</Text>
        </>
      ) : (
        <>
          <Text style={[styles.weekday, selected && styles.selectedDateChipText]}>
            {weekday?.toLocaleUpperCase("en-US")}
          </Text>
          <Text style={[styles.date, selected && styles.selectedDateChipText]}>{date}</Text>
        </>
      )}
    </Pressable>
  );
}

const useStyles = createThemedStyles((theme) => ({
  container: {
    width: "100%",
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.sm,
    alignSelf: "stretch",
  },
  labelRow: {
    width: "100%",
    maxWidth: theme.contentMaxWidth,
    paddingHorizontal: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
  },
  labelIcon: {
    color: theme.colors.muted,
  },
  label: {
    color: theme.colors.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  dateList: {
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  dateChip: {
    minWidth: 76,
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    shadowColor: theme.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: theme.scheme === "dark" ? 0.18 : 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  selectedDateChip: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
    shadowOpacity: 0.14,
    elevation: 2,
  },
  dateChipText: {
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  weekday: {
    color: theme.colors.muted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  date: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
  },
  selectedDateChipText: {
    color: theme.colors.accentText,
  },
  pressed: {
    opacity: 0.7,
  },
}));

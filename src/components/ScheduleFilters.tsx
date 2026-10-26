import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

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
  const { styles } = useStyles();

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
      <Text style={[styles.dateChipText, selected && styles.selectedDateChipText]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = createThemedStyles((theme) => ({
  container: {
    width: "100%",
    gap: theme.spacing.sm,
    alignSelf: "stretch",
  },
  dateList: {
    paddingLeft: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  dateChip: {
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.pill,
  },
  selectedDateChip: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  dateChipText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  selectedDateChipText: {
    color: theme.colors.accentText,
  },
  pressed: {
    opacity: 0.7,
  },
}));

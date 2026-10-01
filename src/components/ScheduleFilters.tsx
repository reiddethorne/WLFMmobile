import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { THEME } from "@/constants/theme";

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
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.dateList}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <DateChip
          label="All dates"
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

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: THEME.spacing.sm,
    alignSelf: "stretch",
  },
  dateList: {
    paddingLeft: THEME.spacing.lg,
    gap: THEME.spacing.sm,
  },
  dateChip: {
    minHeight: 44,
    paddingHorizontal: THEME.spacing.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: THEME.colors.surface,
    borderColor: THEME.colors.border,
    borderWidth: 1,
    borderRadius: THEME.radius.pill,
  },
  selectedDateChip: {
    backgroundColor: THEME.colors.text,
    borderColor: THEME.colors.text,
  },
  dateChipText: {
    color: THEME.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  selectedDateChipText: {
    color: THEME.colors.surface,
  },
  pressed: {
    opacity: 0.7,
  },
});

import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScheduleList } from "@/components/ScheduleList";
import { THEME } from "@/constants/theme";
import { useSchedule } from "@/hooks/useSchedule";

export default function Schedule() {
  const schedule = useSchedule();

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <ScheduleList
        currentEvent={schedule.currentEvent}
        error={schedule.error}
        isRefreshing={schedule.isRefreshing}
        nextEvent={schedule.nextEvent}
        onRefresh={schedule.refresh}
        onRetry={schedule.retry}
        sections={schedule.sections}
        status={schedule.status}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
});

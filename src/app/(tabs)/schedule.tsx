import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScheduleList } from "@/components/ScheduleList";
import { createThemedStyles } from "@/hooks/useThemedStyles";
import { useSchedule } from "@/hooks/useSchedule";
import { parseScheduleEntryParam } from "@/services/showReminders";

export default function Schedule() {
  const schedule = useSchedule();
  const { styles } = useStyles();
  const { event } = useLocalSearchParams<{ event?: string }>();
  const savedEntry = useMemo(() => parseScheduleEntryParam(event), [event]);
  const openedEvent = schedule.events.find((item) => item.id === savedEntry?.id) ?? savedEntry;
  const clearOpenedEvent = useCallback(() => router.setParams({ event: "" }), []);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <ScheduleList
        currentEvent={schedule.currentEvent}
        error={schedule.error}
        isRefreshing={schedule.isRefreshing}
        nextEvent={schedule.nextEvent}
        onRefresh={schedule.refresh}
        onRetry={schedule.retry}
        openedEvent={openedEvent}
        onClearOpenedEvent={clearOpenedEvent}
        sections={schedule.sections}
        status={schedule.status}
      />
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));

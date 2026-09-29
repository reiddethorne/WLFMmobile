import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { buildScheduleSections, getCurrentEvent, getNextEvent } from "@/services/schedule";
import { scheduleStore } from "@/services/scheduleState";
export type { ScheduleLoadError, ScheduleStatus } from "@/services/scheduleState";

interface UseScheduleOptions {
  readonly clock?: () => Date;
}

const currentClock = () => new Date();

export function useSchedule({ clock = currentClock }: UseScheduleOptions = {}) {
  const state = useSyncExternalStore(scheduleStore.subscribe, scheduleStore.getSnapshot, scheduleStore.getSnapshot);
  const [now, setNow] = useState(clock);
  const focused = useRef(false);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    setNow(clock());
    void scheduleStore.refreshIfStale();

    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      setNow(clock());
      const current = clock().getTime();
      const nextMinute = Number.isFinite(current) ? 60_000 - (current % 60_000) + 50 : 60_000;
      timer = setTimeout(update, nextMinute);
    };
    const current = clock().getTime();
    timer = setTimeout(update, Number.isFinite(current) ? 60_000 - (current % 60_000) + 50 : 60_000);

    return () => {
      focused.current = false;
      clearTimeout(timer);
      scheduleStore.cancel();
    };
  }, [clock]));

  useEffect(() => {
    let previousState: AppStateStatus | null = AppState.currentState;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (focused.current && previousState === "active" && nextState !== "active") {
        scheduleStore.cancel();
      }
      if (focused.current && previousState !== "active" && nextState === "active") {
        setNow(clock());
        void scheduleStore.refreshIfStale();
      }
      previousState = nextState;
    });
    return () => subscription.remove();
  }, [clock]);

  const sections = useMemo(() => buildScheduleSections(state.events), [state.events]);
  const currentEvent = useMemo(() => getCurrentEvent(state.events, now), [state.events, now]);
  const nextEvent = useMemo(() => getNextEvent(state.events, now), [state.events, now]);
  const refresh = useCallback(() => { void scheduleStore.refresh(); }, []);
  const retry = useCallback(() => { void scheduleStore.retry(); }, []);

  return {
    events: state.events,
    sections,
    currentEvent,
    nextEvent,
    status: state.status,
    error: state.error,
    isRefreshing: state.isRefreshing,
    refresh,
    retry,
  };
}

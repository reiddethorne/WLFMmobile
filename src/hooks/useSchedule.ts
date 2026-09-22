import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CalendarConfigurationError } from "@/config/calendar";
import { getUpcomingEvents, GoogleCalendarError } from "@/services/googleCalendar";
import { buildScheduleSections, getCurrentEvent, getNextEvent } from "@/services/schedule";
import type { ScheduleEvent } from "@/types/schedule";

export type ScheduleStatus = "loading" | "ready" | "error";

export interface ScheduleLoadError {
  readonly kind: "configuration" | "offline" | "timeout" | "malformed" | "unavailable";
  readonly title: string;
  readonly message: string;
}

interface ScheduleState {
  readonly events: readonly ScheduleEvent[];
  readonly status: ScheduleStatus;
  readonly error: ScheduleLoadError | null;
  readonly isRefreshing: boolean;
}

interface UseScheduleOptions {
  readonly clock?: () => Date;
}

const currentClock = () => new Date();

function listenerError(error: unknown): ScheduleLoadError {
  if (error instanceof CalendarConfigurationError || (error instanceof GoogleCalendarError && error.code === "configuration")) {
    return {
      kind: "configuration",
      title: "Schedule setup needed",
      message: "The schedule is not configured for this build.",
    };
  }
  if (error instanceof GoogleCalendarError && error.code === "network") {
    return {
      kind: "offline",
      title: "You're offline",
      message: "Connect to the internet, then try loading the schedule again.",
    };
  }
  if (error instanceof GoogleCalendarError && error.code === "timeout") {
    return {
      kind: "timeout",
      title: "The schedule took too long to load",
      message: "Check your connection and try again.",
    };
  }
  if (error instanceof GoogleCalendarError && error.code === "invalid-response") {
    return {
      kind: "malformed",
      title: "The schedule can't be read right now",
      message: "WLFM's calendar returned unexpected information. Please try again later.",
    };
  }
  return {
    kind: "unavailable",
    title: "The schedule is unavailable",
    message: "Please try again in a moment.",
  };
}

export function useSchedule({ clock = currentClock }: UseScheduleOptions = {}) {
  const [state, setState] = useState<ScheduleState>({
    events: [],
    status: "loading",
    error: null,
    isRefreshing: false,
  });
  const [now, setNow] = useState(clock);
  const mounted = useRef(false);
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);

  const load = useCallback((mode: "initial" | "refresh" | "retry") => {
    if (request.current !== null) return;
    const controller = new AbortController();
    const attempt = ++generation.current;
    request.current = controller;

    setState((previous) => ({
      ...previous,
      status: previous.events.length === 0 && mode !== "refresh" ? "loading" : previous.status,
      error: null,
      isRefreshing: mode === "refresh" || previous.events.length > 0,
    }));

    getUpcomingEvents({ signal: controller.signal })
      .then((events) => {
        if (!mounted.current || controller.signal.aborted || attempt !== generation.current) return;
        setNow(clock());
        setState({ events, status: "ready", error: null, isRefreshing: false });
      })
      .catch((error: unknown) => {
        if (!mounted.current || controller.signal.aborted || attempt !== generation.current) return;
        if (__DEV__) console.warn("Schedule request failed", error);
        setState((previous) => ({
          ...previous,
          status: previous.events.length > 0 ? "ready" : "error",
          error: listenerError(error),
          isRefreshing: false,
        }));
      })
      .finally(() => {
        if (request.current === controller) request.current = null;
      });
  }, [clock]);

  useEffect(() => {
    mounted.current = true;
    load("initial");
    return () => {
      mounted.current = false;
      generation.current += 1;
      request.current?.abort();
      request.current = null;
    };
  }, [load]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      setNow(clock());
      const nextMinute = 60_000 - (Date.now() % 60_000) + 50;
      timer = setTimeout(update, nextMinute);
    };
    timer = setTimeout(update, 60_000 - (Date.now() % 60_000) + 50);
    return () => clearTimeout(timer);
  }, [clock]);

  const sections = useMemo(() => buildScheduleSections(state.events), [state.events]);
  const currentEvent = useMemo(() => getCurrentEvent(state.events, now), [state.events, now]);
  const nextEvent = useMemo(() => getNextEvent(state.events, now), [state.events, now]);
  const refresh = useCallback(() => load("refresh"), [load]);
  const retry = useCallback(() => load("retry"), [load]);

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

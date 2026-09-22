import { useCallback, useEffect, useState } from "react";

import { getUpcomingEvents } from "@/services/googleCalendar";
import type { ScheduleEvent } from "@/types/schedule";

type ScheduleDiagnosticsState =
  | { readonly status: "loading" }
  | {
      readonly status: "ready";
      readonly eventCount: number;
      readonly firstEvent: ScheduleEvent | null;
    }
  | { readonly status: "error"; readonly message: string };

export function useScheduleDiagnostics() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ScheduleDiagnosticsState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState({ status: "loading" });

    getUpcomingEvents({ signal: controller.signal })
      .then((events) => {
        if (active) {
          setState({
            status: "ready",
            eventCount: events.length,
            firstEvent: events[0] ?? null,
          });
        }
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Could not load the schedule.",
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt]);

  const refresh = useCallback(() => setAttempt((value) => value + 1), []);
  return { state, refresh };
}

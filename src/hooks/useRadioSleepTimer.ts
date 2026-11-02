import { useEffect, useState, useSyncExternalStore } from "react";

import {
  cancelRadioSleepTimer,
  getRadioSleepTimerSnapshot,
  setRadioSleepTimer,
  setRadioSleepTimerUntil,
  subscribeToRadioSleepTimer,
} from "@/services/player";

export function useRadioSleepTimer() {
  const { endsAt } = useSyncExternalStore(
    subscribeToRadioSleepTimer,
    getRadioSleepTimerSnapshot,
    getRadioSleepTimerSnapshot,
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt === null) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [endsAt]);

  return {
    cancel: cancelRadioSleepTimer,
    endsAt,
    remainingSeconds: endsAt === null ? null : Math.max(0, Math.ceil((endsAt - now) / 1_000)),
    start: setRadioSleepTimer,
    startAt: setRadioSleepTimerUntil,
  };
}

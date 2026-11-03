import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, type PropsWithChildren, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { reminderNotifications } from "@/services/reminderNotifications";
import { scheduleStore } from "@/services/scheduleState";
import { ShowRemindersStore } from "@/services/showReminders";

const store = new ShowRemindersStore({ storage: AsyncStorage, notifications: reminderNotifications });
const LOAD_ERROR = "Show preferences or reminders could not be updated. Please try again.";

async function refreshReminders() {
  await store.initialize();
  if (store.getSnapshot().programReminders.length > 0) await scheduleStore.refreshIfStale();
  const schedule = scheduleStore.getSnapshot();
  if (schedule.lastSuccessfulAt !== null) await store.updateSchedule(schedule.events);
  if (schedule.error && store.getSnapshot().programReminders.length > 0) {
    throw new Error("The schedule could not be refreshed. Saved reminders are still enabled.");
  }
}
const ShowPreferencesContext = createContext<{
  readonly error: string | null;
  readonly retry: () => void;
} | null>(null);

export function ShowPreferencesProvider({ children }: PropsWithChildren) {
  const [error, setError] = useState<string | null>(null);
  const retry = () => {
    void refreshReminders().then(() => setError(null)).catch(() => {
      setError(LOAD_ERROR);
    });
  };

  useEffect(() => {
    let active = true;
    let seenEvents = scheduleStore.getSnapshot().events;
    const refresh = () => {
      void refreshReminders().then(() => { if (active) setError(null); }).catch(() => {
        if (active) setError(LOAD_ERROR);
      });
    };
    refresh();
    const stopSchedule = scheduleStore.subscribe(() => {
      const schedule = scheduleStore.getSnapshot();
      if (schedule.lastSuccessfulAt === null || schedule.events === seenEvents) return;
      seenEvents = schedule.events;
      void store.updateSchedule(schedule.events).then(() => { if (active) setError(null); }).catch(() => {
        if (active) setError(LOAD_ERROR);
      });
    });
    const stopListening = reminderNotifications.subscribeReceived?.(refresh);
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") refresh(); });
    return () => { active = false; subscription.remove(); stopListening?.(); stopSchedule(); };
  }, []);

  return <ShowPreferencesContext.Provider value={{ error, retry }}>{children}</ShowPreferencesContext.Provider>;
}

export function useShowPreferences() {
  const context = useContext(ShowPreferencesContext);
  if (!context) throw new Error("useShowPreferences must be used within ShowPreferencesProvider");
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { ...snapshot, ...context, store, remindersSupported: reminderNotifications.supported };
}

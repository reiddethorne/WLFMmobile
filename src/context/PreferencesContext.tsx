import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const SHOW_DIAGNOSTICS_KEY = "wlfm.show-diagnostics";
const SCHEDULE_TIME_MODE_KEY = "wlfm.schedule-time-mode";

export type ScheduleTimeMode = "station" | "local";

interface PreferencesContextValue {
  readonly scheduleTimeMode: ScheduleTimeMode;
  readonly setScheduleTimeMode: (mode: ScheduleTimeMode) => void;
  readonly setShowDiagnostics: (enabled: boolean) => void;
  readonly showDiagnostics: boolean;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: PropsWithChildren) {
  const [scheduleTimeMode, setScheduleTimeModeState] = useState<ScheduleTimeMode>("station");
  const [showDiagnostics, setShowDiagnosticsState] = useState(false);

  useEffect(() => {
    let active = true;

    void AsyncStorage.getItem(SHOW_DIAGNOSTICS_KEY).then((storedValue) => {
      if (!active) return;
      setShowDiagnosticsState(storedValue === "true");
    }).catch(() => {
      if (active) setShowDiagnosticsState(false);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    void AsyncStorage.getItem(SCHEDULE_TIME_MODE_KEY).then((storedValue) => {
      if (!active) return;
      setScheduleTimeModeState(storedValue === "local" ? "local" : "station");
    }).catch(() => {
      if (active) setScheduleTimeModeState("station");
    });

    return () => {
      active = false;
    };
  }, []);

  const setScheduleTimeMode = useCallback((mode: ScheduleTimeMode) => {
    setScheduleTimeModeState(mode);
    void AsyncStorage.setItem(SCHEDULE_TIME_MODE_KEY, mode).catch(() => undefined);
  }, []);

  const setShowDiagnostics = useCallback((enabled: boolean) => {
    setShowDiagnosticsState(enabled);
    void AsyncStorage.setItem(SHOW_DIAGNOSTICS_KEY, String(enabled)).catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({ scheduleTimeMode, setScheduleTimeMode, setShowDiagnostics, showDiagnostics }),
    [scheduleTimeMode, setScheduleTimeMode, setShowDiagnostics, showDiagnostics],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used within PreferencesProvider");
  return context;
}

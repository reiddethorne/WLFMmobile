export const STATION_TIME_ZONE = "America/Chicago";
export const SCHEDULE_WINDOW_DAYS = 14;

export interface CalendarConfig {
  readonly calendarId: string;
  readonly apiKey: string;
  readonly timeZone: typeof STATION_TIME_ZONE;
  readonly windowDays: typeof SCHEDULE_WINDOW_DAYS;
}

export class CalendarConfigurationError extends Error {
  readonly code = "configuration";

  constructor(message: string) {
    super(message);
    this.name = "CalendarConfigurationError";
  }
}

export function getCalendarConfig(): CalendarConfig {
  const calendarId = process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_ID?.trim() ?? "";
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_API_KEY?.trim() ?? "";
  const missing: string[] = [];

  if (!calendarId) missing.push("EXPO_PUBLIC_GOOGLE_CALENDAR_ID");
  if (!apiKey) missing.push("EXPO_PUBLIC_GOOGLE_CALENDAR_API_KEY");

  if (missing.length > 0) {
    throw new CalendarConfigurationError(
      `Google Calendar configuration is incomplete. Set ${missing.join(" and ")}.`,
    );
  }

  return {
    calendarId,
    apiKey,
    timeZone: STATION_TIME_ZONE,
    windowDays: SCHEDULE_WINDOW_DAYS,
  };
}

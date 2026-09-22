import {
  CalendarConfigurationError,
  getCalendarConfig,
  type CalendarConfig,
} from "../config/calendar";
import type { ScheduleEvent } from "../types/schedule";

const EVENTS_ENDPOINT = "https://www.googleapis.com/calendar/v3/calendars";
const DEFAULT_TIMEOUT_MS = 10_000;
const UNTITLED_PROGRAM = "Untitled program";
const RFC3339_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type CalendarErrorCode =
  | "configuration"
  | "http"
  | "network"
  | "invalid-response"
  | "timeout"
  | "aborted";

export class GoogleCalendarError extends Error {
  readonly code: CalendarErrorCode;
  readonly status: number | null;

  constructor(code: CalendarErrorCode, message: string, status: number | null = null) {
    super(message);
    this.name = "GoogleCalendarError";
    this.code = code;
    this.status = status;
  }
}

export interface ScheduleRequestOptions {
  readonly timeMin: Date;
  readonly timeMax: Date;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

export interface UpcomingEventsOptions {
  readonly now?: Date;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
}

function invalidEvent(message: string): never {
  throw new GoogleCalendarError("invalid-response", `Google Calendar returned an invalid event: ${message}.`);
}

function validDateParts(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isValidDateOnly(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  return validDateParts(Number(match[1]), Number(match[2]), Number(match[3]));
}

function isValidRfc3339(value: string): boolean {
  const match = RFC3339_PATTERN.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute, second, offsetHour, offsetMinute] = match;
  if (!validDateParts(Number(year), Number(month), Number(day))) return false;
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return false;
  if (offsetHour !== undefined && (Number(offsetHour) > 23 || Number(offsetMinute) > 59)) return false;
  return Number.isFinite(Date.parse(value));
}

/** Parses one expanded Google event into the app-owned model. Cancelled events return null. */
export function parseCalendarEvent(value: unknown): ScheduleEvent | null {
  if (!isRecord(value)) invalidEvent("event must be an object");

  const status = optionalText(value.status);
  if (!status) invalidEvent("status is missing");
  if (status === "cancelled") return null;

  const id = optionalText(value.id);
  if (!id) invalidEvent("id is missing");
  if (!isRecord(value.start) || !isRecord(value.end)) invalidEvent("start or end is missing");

  const title = optionalText(value.summary) ?? UNTITLED_PROGRAM;
  const description = optionalText(value.description);
  const location = optionalText(value.location);
  const startDateTime = optionalText(value.start.dateTime);
  const endDateTime = optionalText(value.end.dateTime);
  const startDate = optionalText(value.start.date);
  const endDate = optionalText(value.end.date);

  if (startDateTime !== null || endDateTime !== null) {
    if (startDateTime === null || endDateTime === null) invalidEvent("timed start and end must both use dateTime");
    if (!isValidRfc3339(startDateTime) || !isValidRfc3339(endDateTime)) invalidEvent("dateTime is not valid RFC 3339");
    if (Date.parse(endDateTime) <= Date.parse(startDateTime)) invalidEvent("end must be after start");
    return { id, title, description, location, start: startDateTime, end: endDateTime, isAllDay: false };
  }

  if (startDate !== null || endDate !== null) {
    if (startDate === null || endDate === null) invalidEvent("all-day start and end must both use date");
    if (!isValidDateOnly(startDate) || !isValidDateOnly(endDate)) invalidEvent("all-day date is invalid");
    if (endDate <= startDate) invalidEvent("exclusive all-day end must be after start");
    return { id, title, description, location, start: startDate, end: endDate, isAllDay: true };
  }

  return invalidEvent("start and end contain neither dateTime nor date");
}

function parsePage(value: unknown): { readonly events: readonly ScheduleEvent[]; readonly nextPageToken: string | null } {
  if (!isRecord(value)) {
    throw new GoogleCalendarError("invalid-response", "Google Calendar returned a malformed response.");
  }
  if (!Array.isArray(value.items)) {
    throw new GoogleCalendarError("invalid-response", "Google Calendar response is missing its event collection.");
  }

  const events: ScheduleEvent[] = [];
  for (const item of value.items) {
    const event = parseCalendarEvent(item);
    if (event !== null) events.push(event);
  }

  if (value.nextPageToken === undefined) return { events, nextPageToken: null };
  const nextPageToken = optionalText(value.nextPageToken);
  if (nextPageToken === null) {
    throw new GoogleCalendarError("invalid-response", "Google Calendar returned an invalid page token.");
  }
  return { events, nextPageToken };
}

function requireValidWindow(timeMin: Date, timeMax: Date): void {
  if (!Number.isFinite(timeMin.getTime()) || !Number.isFinite(timeMax.getTime()) || timeMax <= timeMin) {
    throw new GoogleCalendarError("configuration", "The schedule request window is invalid.");
  }
}

function buildEventsUrl(config: CalendarConfig, timeMin: Date, timeMax: Date, pageToken: string | null): string {
  const url = new URL(`${EVENTS_ENDPOINT}/${encodeURIComponent(config.calendarId)}/events`);
  url.searchParams.set("timeMin", timeMin.toISOString());
  url.searchParams.set("timeMax", timeMax.toISOString());
  url.searchParams.set("timeZone", config.timeZone);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("showDeleted", "false");
  url.searchParams.set("maxResults", "2500");
  if (pageToken !== null) url.searchParams.set("pageToken", pageToken);
  return url.toString();
}

function requestError(error: unknown, signal: AbortSignal | undefined, timedOut: boolean): GoogleCalendarError {
  if (signal?.aborted) return new GoogleCalendarError("aborted", "The calendar request was cancelled.");
  if (timedOut) return new GoogleCalendarError("timeout", "The calendar request timed out. Try again.");
  if (error instanceof GoogleCalendarError) return error;
  return new GoogleCalendarError("network", "Could not reach Google Calendar. Check your connection and try again.");
}

async function fetchSchedule(config: CalendarConfig, options: ScheduleRequestOptions): Promise<readonly ScheduleEvent[]> {
  requireValidWindow(options.timeMin, options.timeMax);
  if (options.signal?.aborted) throw new GoogleCalendarError("aborted", "The calendar request was cancelled.");

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new GoogleCalendarError("configuration", "The calendar request timeout is invalid.");
  }

  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const events: ScheduleEvent[] = [];
    const seenPageTokens = new Set<string>();
    let pageToken: string | null = null;

    do {
      const requestUrl = buildEventsUrl(config, options.timeMin, options.timeMax, pageToken);
      let response: Response;
      try {
        response = await fetch(requestUrl, {
          headers: { Accept: "application/json", "x-goog-api-key": config.apiKey },
          signal: controller.signal,
        });
      } catch (error: unknown) {
        throw requestError(error, options.signal, timedOut);
      }

      if (!response.ok) {
        throw new GoogleCalendarError("http", `Google Calendar request failed with HTTP ${response.status}.`, response.status);
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        if (options.signal?.aborted) throw new GoogleCalendarError("aborted", "The calendar request was cancelled.");
        if (timedOut) throw new GoogleCalendarError("timeout", "The calendar request timed out. Try again.");
        throw new GoogleCalendarError("invalid-response", "Google Calendar returned unreadable JSON.");
      }

      const page = parsePage(body);
      events.push(...page.events);
      pageToken = page.nextPageToken;
      if (pageToken !== null) {
        if (seenPageTokens.has(pageToken)) {
          throw new GoogleCalendarError("invalid-response", "Google Calendar repeated a page token.");
        }
        seenPageTokens.add(pageToken);
      }
    } while (pageToken !== null);

    return events;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", cancel);
  }
}

export async function getSchedule(options: ScheduleRequestOptions): Promise<readonly ScheduleEvent[]> {
  let config: CalendarConfig;
  try {
    config = getCalendarConfig();
  } catch (error: unknown) {
    if (error instanceof CalendarConfigurationError) throw error;
    throw new GoogleCalendarError("configuration", "Google Calendar configuration is invalid.");
  }
  return fetchSchedule(config, options);
}

export async function getUpcomingEvents(options: UpcomingEventsOptions = {}): Promise<readonly ScheduleEvent[]> {
  let config: CalendarConfig;
  try {
    config = getCalendarConfig();
  } catch (error: unknown) {
    if (error instanceof CalendarConfigurationError) throw error;
    throw new GoogleCalendarError("configuration", "Google Calendar configuration is invalid.");
  }

  const timeMin = options.now ?? new Date();
  const timeMax = new Date(timeMin.getTime() + config.windowDays * 24 * 60 * 60 * 1000);
  return fetchSchedule(config, {
    timeMin,
    timeMax,
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
  });
}

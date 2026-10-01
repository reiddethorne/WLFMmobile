import { STATION_TIME_ZONE } from "../config/calendar";
import type { ScheduleEvent, TimedScheduleEvent } from "../types/schedule";

export interface ScheduleSection {
  readonly date: string;
  readonly title: string;
  readonly data: readonly ScheduleEvent[];
}

export interface EventTimeLabel {
  readonly display: string;
  readonly accessibilityLabel: string;
}

const stationDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: STATION_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const sectionDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
  month: "long",
  day: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
  month: "short",
  day: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: STATION_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

const accessibleTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: STATION_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

function datePart(parts: readonly Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  const value = parts.find((part) => part.type === type)?.value;
  if (!value) throw new Error(`Intl did not provide a ${type} part for the station date.`);
  return value;
}

function getStationDateKeyForDate(date: Date): string | null {
  if (!Number.isFinite(date.getTime())) return null;
  const parts = stationDateFormatter.formatToParts(date);
  return `${datePart(parts, "year")}-${datePart(parts, "month")}-${datePart(parts, "day")}`;
}

function timedEventStart(event: TimedScheduleEvent): number {
  return Date.parse(event.start);
}

function compareTimedEvents(left: TimedScheduleEvent, right: TimedScheduleEvent): number {
  return timedEventStart(left) - timedEventStart(right) || Date.parse(left.end) - Date.parse(right.end);
}

function compareSectionEvents(left: ScheduleEvent, right: ScheduleEvent): number {
  if (left.isAllDay !== right.isAllDay) return left.isAllDay ? -1 : 1;
  if (!left.isAllDay && !right.isAllDay) return compareTimedEvents(left, right);
  return left.end.localeCompare(right.end);
}

/** Returns YYYY-MM-DD in the station timezone without using localized text for ordering. */
export function getStationDateKey(event: ScheduleEvent): string {
  if (event.isAllDay) return event.start;
  const date = getStationDateKeyForDate(new Date(event.start));
  if (date === null) throw new Error("The event start time is invalid.");
  return date;
}

/** Formats a validated calendar date without treating it as an event timestamp. */
export function formatScheduleDate(date: string): string {
  const [yearText, monthText, dayText] = date.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const calendarValue = new Date(Date.UTC(year, month - 1, day, 12));
  return sectionDateFormatter.format(calendarValue);
}

export function formatShortScheduleDate(date: string): string {
  const [yearText, monthText, dayText] = date.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const calendarValue = new Date(Date.UTC(year, month - 1, day, 12));
  return shortDateFormatter.format(calendarValue);
}

export function formatEventDate(event: ScheduleEvent, now: Date = new Date()): string {
  const eventDate = getStationDateKey(event);
  return eventDate === getStationDateKeyForDate(now) ? "Today" : formatScheduleDate(eventDate);
}

export function formatEventTime(event: ScheduleEvent): EventTimeLabel {
  if (event.isAllDay) {
    return { display: "All day", accessibilityLabel: "All-day event" };
  }
  const start = new Date(event.start);
  const end = new Date(event.end);
  return {
    display: `${timeFormatter.format(start)} – ${timeFormatter.format(end)}`,
    accessibilityLabel: `${accessibleTimeFormatter.format(start)} to ${accessibleTimeFormatter.format(end)}`,
  };
}

export function buildScheduleSections(events: readonly ScheduleEvent[]): readonly ScheduleSection[] {
  const grouped = new Map<string, ScheduleEvent[]>();
  for (const event of events) {
    const date = getStationDateKey(event);
    const group = grouped.get(date) ?? [];
    group.push(event);
    grouped.set(date, group);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, data]) => ({
      date,
      title: formatScheduleDate(date),
      data: data.sort(compareSectionEvents),
    }));
}

export function filterScheduleSections(
  sections: readonly ScheduleSection[],
  query: string,
  date: string | null,
): readonly ScheduleSection[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("en-US");

  return sections.flatMap((section) => {
    if (date !== null && section.date !== date) return [];

    const data = normalizedQuery
      ? section.data.filter((event) => (
        [event.title, event.description, event.location]
          .some((value) => value?.toLocaleLowerCase("en-US").includes(normalizedQuery))
      ))
      : section.data;

    return data.length > 0 ? [{ ...section, data }] : [];
  });
}

/** All-day entries are informational and never inferred to be live broadcasts. */
export function getCurrentEvent(events: readonly ScheduleEvent[], now: Date): TimedScheduleEvent | null {
  const timestamp = now.getTime();
  if (!Number.isFinite(timestamp)) return null;
  return events
    .filter((event): event is TimedScheduleEvent => (
      !event.isAllDay && Date.parse(event.start) <= timestamp && timestamp < Date.parse(event.end)
    ))
    .sort(compareTimedEvents)[0] ?? null;
}

/** All-day entries are excluded because they are not necessarily radio programs. */
export function getNextEvent(events: readonly ScheduleEvent[], now: Date): TimedScheduleEvent | null {
  const timestamp = now.getTime();
  if (!Number.isFinite(timestamp)) return null;
  return events
    .filter((event): event is TimedScheduleEvent => !event.isAllDay && Date.parse(event.start) > timestamp)
    .sort(compareTimedEvents)[0] ?? null;
}

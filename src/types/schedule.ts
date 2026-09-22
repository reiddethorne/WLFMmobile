interface ScheduleEventBase {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly location: string | null;
}

export interface TimedScheduleEvent extends ScheduleEventBase {
  readonly start: string;
  readonly end: string;
  readonly isAllDay: false;
}

export interface AllDayScheduleEvent extends ScheduleEventBase {
  /** Calendar date in YYYY-MM-DD form; never convert this through a device timezone. */
  readonly start: string;
  /** Exclusive calendar date in YYYY-MM-DD form, matching Google Calendar semantics. */
  readonly end: string;
  readonly isAllDay: true;
}

export type ScheduleEvent = TimedScheduleEvent | AllDayScheduleEvent;

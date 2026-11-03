import type { ScheduleEvent, TimedScheduleEvent } from "../types/schedule";

export const SHOW_PREFERENCES_KEY = "wlfm.show-preferences.v1";
export const REMINDER_LEAD_TIMES = [1, 5, 10, 15, 30] as const;
export type ReminderLeadTime = typeof REMINDER_LEAD_TIMES[number];

export interface FavoriteProgram {
  readonly key: string;
  readonly title: string;
}

export interface ShowReminder {
  readonly event: TimedScheduleEvent;
  readonly minutesBefore: ReminderLeadTime;
  readonly notificationId: string;
}

export interface ProgramReminder extends FavoriteProgram {
  readonly minutesBefore: ReminderLeadTime;
}

export interface ShowPreferences {
  readonly favorites: readonly FavoriteProgram[];
  readonly programReminders: readonly ProgramReminder[];
  readonly reminders: readonly ShowReminder[];
  readonly minutesBefore: ReminderLeadTime;
}

export interface ReminderNotifications {
  readonly supported: boolean;
  readonly requestPermission: () => Promise<void>;
  readonly schedule: (reminder: ShowReminder) => Promise<void>;
  readonly cancel: (identifier: string) => Promise<void>;
  readonly list: () => Promise<readonly ShowReminder[]>;
  readonly subscribeReceived?: (listener: () => void) => () => void;
}

interface StoreOptions {
  readonly storage: {
    readonly getItem: (key: string) => Promise<string | null>;
    readonly setItem: (key: string, value: string) => Promise<unknown>;
  };
  readonly notifications: ReminderNotifications;
  readonly clock?: () => number;
}

export const MAX_PENDING_REMINDERS = 50;
const emptyPreferences: ShowPreferences = { favorites: [], programReminders: [], reminders: [], minutesBefore: 5 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isReminderLeadTime(value: unknown): value is ReminderLeadTime {
  return REMINDER_LEAD_TIMES.some((minutes) => minutes === value);
}

/** Program titles identify favorites and reminders across separately scheduled airings. */
export function favoriteProgramKey(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export function parseScheduleEntry(value: unknown): ScheduleEvent | null {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id.trim()
    || typeof value.title !== "string" || !value.title.trim()
    || typeof value.start !== "string" || typeof value.end !== "string"
    || !(value.description === null || typeof value.description === "string")
    || !(value.location === null || typeof value.location === "string")) return null;
  if (value.isAllDay === true) {
    const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date)
      && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
    if (!validDate(value.start) || !validDate(value.end) || value.end <= value.start) return null;
    return { id: value.id, title: value.title, start: value.start, end: value.end,
      description: value.description, location: value.location, isAllDay: true };
  }
  if (value.isAllDay !== false || !/T.*(Z|[+-]\d{2}:\d{2})$/.test(value.start)
    || !/T.*(Z|[+-]\d{2}:\d{2})$/.test(value.end)
    || !Number.isFinite(Date.parse(value.start)) || !Number.isFinite(Date.parse(value.end))
    || Date.parse(value.end) <= Date.parse(value.start)) return null;
  return { id: value.id, title: value.title, start: value.start, end: value.end,
    description: value.description, location: value.location, isAllDay: false };
}

export function parseScheduleEntryParam(value: unknown): ScheduleEvent | null {
  if (typeof value !== "string") return null;
  try { return parseScheduleEntry(JSON.parse(value)); } catch { return null; }
}

export function reminderNotificationId(eventId: string): string {
  return `wlfm.show.${encodeURIComponent(eventId)}`;
}

export function reminderTimestamp(reminder: Pick<ShowReminder, "event" | "minutesBefore">): number {
  return Date.parse(reminder.event.start) - reminder.minutesBefore * 60_000;
}

export function parseShowReminder(value: unknown): ShowReminder | null {
  if (!isRecord(value) || !isReminderLeadTime(value.minutesBefore)) return null;
  const event = parseScheduleEntry(value.event);
  if (!event || event.isAllDay || value.notificationId !== reminderNotificationId(event.id)) return null;
  return { event, minutesBefore: value.minutesBefore, notificationId: value.notificationId };
}

function programRules(reminders: readonly ShowReminder[]): readonly ProgramReminder[] {
  const programs = new Map<string, ProgramReminder>();
  // Older per-airing settings may disagree. Use the earliest airing's lead time
  // consistently when converting them to one setting for the entire program.
  for (const reminder of [...reminders].sort((left, right) => Date.parse(left.event.start) - Date.parse(right.event.start))) {
    const key = favoriteProgramKey(reminder.event.title);
    if (!programs.has(key)) programs.set(key, { key, title: reminder.event.title, minutesBefore: reminder.minutesBefore });
  }
  return [...programs.values()];
}

function parsePreferences(raw: string | null): { preferences: ShowPreferences; legacy: boolean } {
  if (raw === null) return { preferences: emptyPreferences, legacy: true };
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value) || !Array.isArray(value.favorites) || !Array.isArray(value.reminders)
    || !isReminderLeadTime(value.minutesBefore)) throw new Error("Saved show preferences could not be read.");
  const favorites = new Map<string, FavoriteProgram>();
  for (const item of value.favorites) {
    if (isRecord(item) && typeof item.title === "string" && favoriteProgramKey(item.title)) {
      const key = favoriteProgramKey(item.title);
      favorites.set(key, { key, title: item.title });
    }
  }
  const reminders = new Map<string, ShowReminder>();
  for (const item of value.reminders) {
    const reminder = parseShowReminder(item);
    if (reminder) reminders.set(reminder.event.id, reminder);
  }
  const legacy = value.programReminders === undefined;
  const programs = new Map<string, ProgramReminder>();
  if (!legacy) {
    if (!Array.isArray(value.programReminders)) throw new Error("Saved program reminders could not be read.");
    for (const item of value.programReminders) {
      if (!isRecord(item) || typeof item.title !== "string" || !favoriteProgramKey(item.title)
        || !isReminderLeadTime(item.minutesBefore)) throw new Error("Saved program reminders could not be read.");
      const key = favoriteProgramKey(item.title);
      programs.set(key, { key, title: item.title, minutesBefore: item.minutesBefore });
    }
  }
  return {
    preferences: {
      favorites: [...favorites.values()], reminders: [...reminders.values()], minutesBefore: value.minutesBefore,
      programReminders: legacy ? programRules([...reminders.values()]) : [...programs.values()],
    },
    legacy,
  };
}

/** Only observed airings become date notifications; no weekly pattern is inferred. */
export function buildProgramReminderPlan(
  programs: readonly ProgramReminder[],
  events: readonly ScheduleEvent[],
  pending: readonly ShowReminder[],
  now: number,
): readonly ShowReminder[] {
  const rules = new Map(programs.map((program) => [program.key, program]));
  const knownEvents = new Map(events.map((event) => [event.id, event]));
  const desired = new Map<string, ShowReminder>();
  // Keep overdue requests that the OS still has queued until the airing ends,
  // so opening the app does not re-send or lose track of a delayed reminder.
  for (const reminder of pending) {
    const current = knownEvents.get(reminder.event.id);
    if (current && !current.isAllDay && current.start === reminder.event.start
      && favoriteProgramKey(current.title) === favoriteProgramKey(reminder.event.title)
      && rules.has(favoriteProgramKey(reminder.event.title)) && reminderTimestamp(reminder) <= now
      && Date.parse(reminder.event.end) > now) desired.set(reminder.event.id, reminder);
  }
  for (const event of events) {
    if (event.isAllDay) continue;
    const program = rules.get(favoriteProgramKey(event.title));
    if (!program) continue;
    const reminder: ShowReminder = { event, minutesBefore: program.minutesBefore, notificationId: reminderNotificationId(event.id) };
    if (reminderTimestamp(reminder) > now) desired.set(event.id, reminder);
  }
  return [...desired.values()]
    .sort((left, right) => reminderTimestamp(left) - reminderTimestamp(right) || left.event.id.localeCompare(right.event.id))
    .slice(0, MAX_PENDING_REMINDERS);
}

/** Serializes storage and OS changes, including taps made while hydration is pending. */
export class ShowRemindersStore {
  private snapshot: ShowPreferences & { readonly ready: boolean } = { ...emptyPreferences, ready: false };
  private readonly observers = new Set<() => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private needsSave = false;
  private migrateLegacy = false;
  private events: readonly ScheduleEvent[] | null = null;
  private readonly clock: () => number;

  constructor(private readonly options: StoreOptions) {
    this.clock = options.clock ?? Date.now;
  }

  readonly getSnapshot = () => this.snapshot;
  readonly subscribe = (observer: () => void) => {
    this.observers.add(observer);
    return () => { this.observers.delete(observer); };
  };

  readonly initialize = () => this.enqueue(async () => {
    if (!this.snapshot.ready) {
      const { preferences, legacy } = parsePreferences(await this.options.storage.getItem(SHOW_PREFERENCES_KEY));
      this.migrateLegacy = legacy;
      this.needsSave = legacy;
      this.publish(preferences);
    }
    await this.reconcile();
  });

  readonly toggleFavorite = (title: string) => this.enqueue(async () => {
    this.requireReady();
    const key = favoriteProgramKey(title);
    if (!key) throw new Error("This program has no title.");
    const exists = this.snapshot.favorites.some((favorite) => favorite.key === key);
    const favorites = exists
      ? this.snapshot.favorites.filter((favorite) => favorite.key !== key)
      : [...this.snapshot.favorites, { key, title }];
    await this.commit({ ...this.snapshot, favorites });
  });

  readonly setMinutesBefore = (minutesBefore: ReminderLeadTime) => this.enqueue(async () => {
    this.requireReady();
    if (!isReminderLeadTime(minutesBefore)) throw new Error("Choose a valid reminder time.");
    await this.commit({ ...this.snapshot, minutesBefore });
  });

  readonly setReminder = (event: ScheduleEvent, minutesBefore: ReminderLeadTime) => this.enqueue(async () => {
    this.requireReady();
    if (!this.options.notifications.supported) throw new Error("Show reminders are available in the iOS and Android app.");
    const parsed = parseScheduleEntry(event);
    if (!parsed || parsed.isAllDay || !isReminderLeadTime(minutesBefore)) {
      throw new Error("Reminders are available for timed programs only.");
    }
    await this.options.notifications.requestPermission();
    const key = favoriteProgramKey(parsed.title);
    const programReminders = [...this.snapshot.programReminders.filter((program) => program.key !== key),
      { key, title: parsed.title, minutesBefore }];
    await this.reconcile({ ...this.snapshot, programReminders }, parsed);
  });

  readonly setProgramMinutesBefore = (title: string, minutesBefore: ReminderLeadTime) => this.enqueue(async () => {
    this.requireReady();
    if (!isReminderLeadTime(minutesBefore)) throw new Error("Choose a valid reminder time.");
    const key = favoriteProgramKey(title);
    if (!this.snapshot.programReminders.some((program) => program.key === key)) return;
    await this.options.notifications.requestPermission();
    const programReminders = this.snapshot.programReminders.map((program) => (
      program.key === key ? { ...program, minutesBefore } : program
    ));
    await this.reconcile({ ...this.snapshot, programReminders });
  });

  readonly cancelReminder = (title: string) => this.enqueue(async () => {
    this.requireReady();
    const key = favoriteProgramKey(title);
    const programReminders = this.snapshot.programReminders.filter((program) => program.key !== key);
    await this.reconcile({ ...this.snapshot, programReminders });
  });

  /** Called only with a complete, successful calendar response, never on failure. */
  readonly updateSchedule = (events: readonly ScheduleEvent[]) => this.enqueue(async () => {
    this.requireReady();
    this.events = events;
    await this.reconcile();
  });

  private requireReady(): void {
    if (!this.snapshot.ready) throw new Error("Show preferences are still loading. Try again in a moment.");
  }

  private async reconcile(preferences: ShowPreferences = this.snapshot, seed?: TimedScheduleEvent): Promise<void> {
    if (!this.options.notifications.supported) {
      if (this.needsSave || preferences !== this.snapshot) await this.commit(preferences);
      return;
    }
    const pending = await this.options.notifications.list();
    if (this.migrateLegacy) {
      const programs = new Map(programRules(pending).map((program) => [program.key, program]));
      for (const program of preferences.programReminders) programs.set(program.key, program);
      preferences = { ...preferences, programReminders: [...programs.values()] };
    }
    // A cold/offline launch retains pending snapshots. A successful fresh
    // calendar replaces them, removing cancelled or renamed future airings.
    const candidates = new Map<string, ScheduleEvent>();
    for (const event of this.events ?? pending.map((reminder) => reminder.event)) candidates.set(event.id, event);
    if (seed && !this.events?.some((event) => event.id === seed.id)) candidates.set(seed.id, seed);
    const reminders = buildProgramReminderPlan(preferences.programReminders, [...candidates.values()], pending, this.clock());
    await this.applyPlan({ ...preferences, reminders }, pending);
  }

  private async applyPlan(next: ShowPreferences, pending: readonly ShowReminder[]): Promise<void> {
    const previous = new Map(pending.map((reminder) => [reminder.notificationId, reminder]));
    const desired = new Map(next.reminders.map((reminder) => [reminder.notificationId, reminder]));
    const touched = new Set<string>();
    try {
      for (const reminder of pending) {
        if (desired.has(reminder.notificationId)) continue;
        touched.add(reminder.notificationId);
        await this.options.notifications.cancel(reminder.notificationId);
      }
      for (const reminder of next.reminders) {
        if (JSON.stringify(previous.get(reminder.notificationId)) === JSON.stringify(reminder)) continue;
        // Recheck the deadline after any permissions prompt or earlier OS calls.
        if (reminderTimestamp(reminder) <= this.clock()) continue;
        touched.add(reminder.notificationId);
        await this.options.notifications.schedule(reminder);
      }
      // Delivery may have happened during the OS calls, and deadlines can pass
      // mid-update. Persist the requests that actually remain in the OS queue.
      const reminders = await this.options.notifications.list();
      const value = { favorites: next.favorites, programReminders: next.programReminders, reminders, minutesBefore: next.minutesBefore };
      const previousValue = {
        favorites: this.snapshot.favorites, programReminders: this.snapshot.programReminders,
        reminders: this.snapshot.reminders, minutesBefore: this.snapshot.minutesBefore,
      };
      if (this.needsSave || JSON.stringify(value) !== JSON.stringify(previousValue)) await this.commit(value);
    } catch (error) {
      // Restore the previous queue if any operation or storage write fails.
      // The next refresh checks the OS again if a rollback itself cannot finish.
      const rollback = await Promise.allSettled([...touched].map(async (id) => {
        const reminder = previous.get(id);
        if (reminder && reminderTimestamp(reminder) > this.clock()) await this.options.notifications.schedule(reminder);
        else if (!reminder) await this.options.notifications.cancel(id);
      }));
      if (rollback.some((result) => result.status === "rejected")) this.needsSave = true;
      throw error;
    }
  }

  private enqueue(action: () => Promise<void>): Promise<void> {
    const result = this.queue.then(action);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async commit(next: ShowPreferences): Promise<void> {
    const value: ShowPreferences = {
      favorites: next.favorites, programReminders: next.programReminders,
      reminders: next.reminders, minutesBefore: next.minutesBefore,
    };
    await this.options.storage.setItem(SHOW_PREFERENCES_KEY, JSON.stringify(value));
    this.needsSave = false;
    this.migrateLegacy = false;
    this.publish(value);
  }

  private publish(value: ShowPreferences): void {
    this.snapshot = { ...value, ready: true };
    this.observers.forEach((observer) => observer());
  }
}

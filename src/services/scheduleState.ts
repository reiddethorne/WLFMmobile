import { CalendarConfigurationError } from "../config/calendar";
import type { ScheduleEvent } from "../types/schedule";
import { getUpcomingEvents, GoogleCalendarError } from "./googleCalendar";

export const SCHEDULE_FRESHNESS_MS = 5 * 60 * 1000;

export type ScheduleStatus = "loading" | "ready" | "error";

export interface ScheduleLoadError {
  readonly kind: "configuration" | "offline" | "timeout" | "malformed" | "unavailable";
  readonly title: string;
  readonly message: string;
}

export interface ScheduleSnapshot {
  readonly events: readonly ScheduleEvent[];
  readonly status: ScheduleStatus;
  readonly error: ScheduleLoadError | null;
  readonly isRefreshing: boolean;
  readonly lastSuccessfulAt: number | null;
}

interface ScheduleStoreOptions {
  readonly loadEvents?: (options: { readonly signal: AbortSignal }) => Promise<readonly ScheduleEvent[]>;
  readonly clock?: () => number;
  readonly freshnessMs?: number;
}

interface ActiveRequest {
  readonly controller: AbortController;
  readonly generation: number;
  readonly promise: Promise<void>;
}

const currentTime = () => Date.now();

export function toScheduleLoadError(error: unknown): ScheduleLoadError {
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

/** In-memory request/cache owner. It deliberately has no persistent-storage dependency. */
export class ScheduleStore {
  private readonly loadEvents: NonNullable<ScheduleStoreOptions["loadEvents"]>;
  private readonly clock: NonNullable<ScheduleStoreOptions["clock"]>;
  private readonly freshnessMs: number;
  private readonly observers = new Set<() => void>();
  private generation = 0;
  private request: ActiveRequest | null = null;
  private snapshot: ScheduleSnapshot = {
    events: [],
    status: "loading",
    error: null,
    isRefreshing: false,
    lastSuccessfulAt: null,
  };

  constructor(options: ScheduleStoreOptions = {}) {
    this.loadEvents = options.loadEvents ?? getUpcomingEvents;
    this.clock = options.clock ?? currentTime;
    this.freshnessMs = options.freshnessMs ?? SCHEDULE_FRESHNESS_MS;
    if (!Number.isFinite(this.freshnessMs) || this.freshnessMs <= 0) {
      throw new Error("Schedule freshness must be a positive duration.");
    }
  }

  readonly getSnapshot = (): ScheduleSnapshot => this.snapshot;

  readonly subscribe = (observer: () => void): (() => void) => {
    this.observers.add(observer);
    return () => { this.observers.delete(observer); };
  };

  /** Focus and foreground refresh only when the last success is no longer fresh. */
  readonly refreshIfStale = (): Promise<void> => {
    if (this.isFresh()) return Promise.resolve();
    return this.startRequest();
  };

  /** User-initiated refresh/retry always requests current data unless one is already active. */
  readonly refresh = (): Promise<void> => this.startRequest();

  readonly retry = (): Promise<void> => this.startRequest();

  /** Cancels screen-owned work without discarding the last successful in-memory response. */
  readonly cancel = (): void => {
    if (this.request === null) return;
    this.generation += 1;
    this.request.controller.abort();
    this.request = null;
    this.publish({
      ...this.snapshot,
      status: this.snapshot.lastSuccessfulAt !== null ? "ready" : "loading",
      isRefreshing: false,
    });
  };

  private isFresh(): boolean {
    if (this.snapshot.lastSuccessfulAt === null) return false;
    const age = this.clock() - this.snapshot.lastSuccessfulAt;
    // A backwards wall-clock change invalidates freshness rather than extending it.
    return age >= 0 && age < this.freshnessMs;
  }

  private startRequest(): Promise<void> {
    if (this.request !== null) return this.request.promise;

    const controller = new AbortController();
    const generation = ++this.generation;
    const hasSuccessfulResponse = this.snapshot.lastSuccessfulAt !== null;
    this.publish({
      ...this.snapshot,
      status: hasSuccessfulResponse ? "ready" : "loading",
      error: null,
      isRefreshing: hasSuccessfulResponse,
    });

    // Defer execution until after request ownership is recorded, including for
    // injected loaders that throw synchronously in tests or development.
    const promise = Promise.resolve().then(() => this.performRequest(controller, generation));
    this.request = { controller, generation, promise };
    return promise;
  }

  private async performRequest(controller: AbortController, generation: number): Promise<void> {
    try {
      const events = await this.loadEvents({ signal: controller.signal });
      if (controller.signal.aborted || generation !== this.generation) return;
      this.publish({
        events,
        status: "ready",
        error: null,
        isRefreshing: false,
        lastSuccessfulAt: this.clock(),
      });
    } catch (error: unknown) {
      if (controller.signal.aborted || generation !== this.generation) return;
      this.publish({
        ...this.snapshot,
        status: this.snapshot.lastSuccessfulAt !== null ? "ready" : "error",
        error: toScheduleLoadError(error),
        isRefreshing: false,
      });
    } finally {
      if (this.request?.generation === generation) this.request = null;
    }
  }

  private publish(next: ScheduleSnapshot): void {
    this.snapshot = next;
    this.observers.forEach((observer) => observer());
  }
}

export const scheduleStore = new ScheduleStore();

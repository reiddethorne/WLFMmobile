export type RadioPlayerStatus =
  | "idle"
  | "connecting"
  | "buffering"
  | "playing"
  | "paused"
  | "error";

export type RadioTransport = "hls" | "mp3";

export interface RadioPlayerSnapshot {
  readonly status: RadioPlayerStatus;
  readonly error: string | null;
  /** Includes a requested connection so Pause can cancel it before audio starts. */
  readonly canPause: boolean;
}

export interface RadioSleepTimerSnapshot {
  /** Wall-clock deadline in milliseconds, or null when no timer is active. */
  readonly endsAt: number | null;
}

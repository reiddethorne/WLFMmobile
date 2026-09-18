export type RadioPlayerStatus =
  | "idle"
  | "connecting"
  | "buffering"
  | "playing"
  | "paused"
  | "error";

export interface RadioPlayerSnapshot {
  readonly status: RadioPlayerStatus;
  readonly error: string | null;
  /** Includes a requested connection so Pause can cancel it before audio starts. */
  readonly canPause: boolean;
}

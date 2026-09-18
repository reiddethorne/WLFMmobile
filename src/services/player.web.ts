import type { RadioPlayerSnapshot } from "../types/player";

// Native radio is the current milestone. Avoid loading the optional web engine.
const snapshot: RadioPlayerSnapshot = {
  status: "error",
  error: "Radio playback requires an iOS or Android development build.",
  canPause: false,
};

export function getRadioPlayerSnapshot(): RadioPlayerSnapshot { return snapshot; }
export function subscribeToRadioPlayer(_observer: () => void): () => void { return () => {}; }
export async function playRadio(): Promise<void> {}
export function pauseRadio(): void {}

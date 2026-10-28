import type { RadioPlayerSnapshot, RadioTransport } from "../types/player";

// Native radio is the current milestone. Avoid loading the optional web engine.
const snapshot: RadioPlayerSnapshot = {
  status: "error",
  error: "Radio playback requires an iOS or Android development build.",
  canPause: false,
};
let transport: RadioTransport = "hls";
const transportObservers = new Set<() => void>();

export function getRadioPlayerSnapshot(): RadioPlayerSnapshot { return snapshot; }
export function subscribeToRadioPlayer(_observer: () => void): () => void { return () => {}; }
export async function playRadio(): Promise<void> {}
export function pauseRadio(): void {}
export function getRadioTransportSnapshot(): RadioTransport { return transport; }
export function subscribeToRadioTransport(observer: () => void): () => void {
  transportObservers.add(observer);
  return () => { transportObservers.delete(observer); };
}
export function setRadioTransport(next: RadioTransport): void {
  if (next === transport) return;
  transport = next;
  transportObservers.forEach((observer) => observer());
}

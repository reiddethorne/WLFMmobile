import { STATION_ARTWORK } from "../constants/assets";
import type { NativeMetadataUpdate, NowPlayingSnapshot, StreamMetadataInput } from "../types/metadata";
import type { Live365NowPlaying } from "../types/live365";
import { getNowPlaying } from "./live365";

export const FALLBACK_NOW_PLAYING = {
  title: "LIVE",
  artist: "Student Radio",
} as const;

const POLL_INTERVAL_MS = 30_000;

interface TrackMetadata {
  readonly title: string | null;
  readonly artist: string | null;
  readonly artworkUrl: string | null;
}

const fallbackSnapshot: NowPlayingSnapshot = {
  ...FALLBACK_NOW_PLAYING,
  artworkUrl: null,
  source: "fallback",
};

let snapshot = fallbackSnapshot;
let streamTrack: TrackMetadata | null = null;
let directoryTrack: TrackMetadata | null = null;
let nativeUpdater: ((metadata: NativeMetadataUpdate) => void) | null = null;
let lastNativeUpdate = "";
let active = false;
let cycle = 0;
let request: AbortController | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const observers = new Set<() => void>();

function cleanText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned.length > 0 ? cleaned : null;
}

function httpsArtwork(value: unknown): string | null {
  const cleaned = typeof value === "string" ? cleanText(value) : null;
  if (!cleaned) return null;
  try {
    const url = new URL(cleaned);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function sameTrack(stream: TrackMetadata, directory: TrackMetadata): boolean {
  if (!stream.title || !directory.title || normalize(stream.title) !== normalize(directory.title)) return false;
  if (!stream.artist) return true;
  return Boolean(directory.artist && normalize(stream.artist) === normalize(directory.artist));
}

function isFallbackTrack(track: TrackMetadata): boolean {
  return track.title === FALLBACK_NOW_PLAYING.title;
}

function publish(next: NowPlayingSnapshot) {
  if (next.title === snapshot.title && next.artist === snapshot.artist &&
      next.artworkUrl === snapshot.artworkUrl && next.source === snapshot.source) return;
  snapshot = next;
  observers.forEach((observer) => observer());
}

function updateNative(metadata: NativeMetadataUpdate) {
  const signature = JSON.stringify(metadata);
  if (signature === lastNativeUpdate) return;
  lastNativeUpdate = signature;
  nativeUpdater?.(metadata);
}

function toTrack(value: Live365NowPlaying | StreamMetadataInput): TrackMetadata | null {
  const track = {
    title: cleanText(value.title),
    artist: cleanText(value.artist),
    artworkUrl: httpsArtwork(value.artworkUrl),
  };
  return track.title || track.artist || track.artworkUrl ? track : null;
}

function publishStream() {
  if (!streamTrack) return;
  const matchingDirectory = directoryTrack && sameTrack(streamTrack, directoryTrack) ? directoryTrack : null;
  const artworkUrl = streamTrack.artworkUrl ?? matchingDirectory?.artworkUrl ?? null;
  publish({
    title: streamTrack.title ?? FALLBACK_NOW_PLAYING.title,
    artist: streamTrack.artist ?? FALLBACK_NOW_PLAYING.artist,
    artworkUrl,
    source: "stream",
  });
  updateNative({ artworkUrl: artworkUrl ?? STATION_ARTWORK });
}

function applyDirectoryMetadata(value: Live365NowPlaying | null) {
  directoryTrack = value ? toTrack(value) : null;
  if (streamTrack) {
    publishStream();
    return;
  }
  if (!directoryTrack) {
    publish(fallbackSnapshot);
    updateNative({ ...FALLBACK_NOW_PLAYING, artworkUrl: STATION_ARTWORK });
    return;
  }
  const next: NowPlayingSnapshot = {
    title: directoryTrack.title ?? FALLBACK_NOW_PLAYING.title,
    artist: directoryTrack.artist ?? FALLBACK_NOW_PLAYING.artist,
    artworkUrl: directoryTrack.artworkUrl,
    source: "live365",
  };
  publish(next);
  updateNative({ title: next.title, artist: next.artist, artworkUrl: next.artworkUrl ?? STATION_ARTWORK });
}

function clearTimer() {
  if (timer !== null) clearTimeout(timer);
  timer = null;
}

async function poll(expectedCycle: number) {
  const controller = new AbortController();
  request = controller;
  try {
    const nowPlaying = await getNowPlaying({ signal: controller.signal });
    if (active && expectedCycle === cycle && !controller.signal.aborted) applyDirectoryMetadata(nowPlaying);
  } catch {
    // Stream metadata and the last valid value remain usable when Live365 is unavailable.
  } finally {
    if (request === controller) request = null;
    if (active && expectedCycle === cycle) {
      timer = setTimeout(() => { void poll(expectedCycle); }, POLL_INTERVAL_MS);
    }
  }
}

export function configureNativeMetadataUpdater(updater: (metadata: NativeMetadataUpdate) => void) {
  nativeUpdater = updater;
}

/** Raw ICY/ID3 metadata is authoritative for title and artist. */
export function receiveStreamMetadata(value: StreamMetadataInput) {
  const next = toTrack(value);
  if (!next) {
    updateNative({ title: snapshot.title, artist: snapshot.artist, artworkUrl: snapshot.artworkUrl ?? STATION_ARTWORK });
    return;
  }
  streamTrack = next;
  publishStream();
}

/** Effective native metadata confirms system/UI synchronization without changing source priority. */
export function receiveEffectiveMetadata(value: StreamMetadataInput) {
  if (streamTrack) {
    publishStream();
    return;
  }
  const effective = toTrack(value);
  if (effective && !isFallbackTrack(effective) && (!directoryTrack || !sameTrack(effective, directoryTrack))) {
    streamTrack = effective;
    publishStream();
  } else if (directoryTrack) {
    applyDirectoryMetadata(directoryTrack);
  } else {
    publish(fallbackSnapshot);
  }
}

export function resetNowPlaying() {
  streamTrack = null;
  directoryTrack = null;
  lastNativeUpdate = "";
  publish(fallbackSnapshot);
}

export function setMetadataPlaybackActive(nextActive: boolean) {
  if (nextActive === active) return;
  active = nextActive;
  cycle += 1;
  clearTimer();
  request?.abort();
  request = null;
  if (active) void poll(cycle);
}

export function refreshMetadataFallback() {
  if (!active || request) return;
  cycle += 1;
  clearTimer();
  void poll(cycle);
}

export function getNowPlayingSnapshot(): NowPlayingSnapshot {
  return snapshot;
}

export function subscribeToNowPlaying(observer: () => void): () => void {
  observers.add(observer);
  return () => { observers.delete(observer); };
}

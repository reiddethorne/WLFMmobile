import { Asset } from "expo-asset";

import { STATION } from "../config/station";
import { STATION_ARTWORK } from "../constants/assets";
import type {
  NativeMetadataUpdate,
  NowPlayingSnapshot,
  RecentlyPlayedSnapshot,
} from "../types/metadata";
import type { Live365NowPlaying, Live365RecentTrack } from "../types/live365";
import { cleanMetadataText } from "../utils/metadataText";
import { getStationInfo } from "./live365";

export const FALLBACK_NOW_PLAYING = {
  title: STATION.name,
  artist: STATION.slogan,
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
let nativeUpdater: ((metadata: NativeMetadataUpdate) => void) | null = null;
let lastNativeUpdate = "";
let fallbackArtworkUrl: string | null = null;
let fallbackArtworkInitialization: Promise<void> | null = null;
let playbackActive = false;
let pollingActive = false;
let cycle = 0;
let request: AbortController | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const observers = new Set<() => void>();
const recentlyPlayedObservers = new Set<() => void>();
let recentlyPlayedSnapshot: RecentlyPlayedSnapshot = { tracks: [], status: "loading" };

function httpsArtwork(value: unknown): string | null {
  const cleaned = typeof value === "string" ? value.trim() : null;
  if (!cleaned) return null;
  try {
    const url = new URL(cleaned);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function publish(next: NowPlayingSnapshot) {
  if (next.title === snapshot.title && next.artist === snapshot.artist &&
      next.artworkUrl === snapshot.artworkUrl && next.source === snapshot.source) return;
  snapshot = next;
  observers.forEach((observer) => observer());
}

function sameRecentTracks(
  current: readonly Live365RecentTrack[],
  next: readonly Live365RecentTrack[],
): boolean {
  return current.length === next.length && current.every((track, index) => {
    const candidate = next[index];
    return candidate !== undefined && track.title === candidate.title &&
      track.artist === candidate.artist && track.artworkUrl === candidate.artworkUrl &&
      track.startedAt === candidate.startedAt;
  });
}

function publishRecentlyPlayed(next: RecentlyPlayedSnapshot) {
  if (next.status === recentlyPlayedSnapshot.status &&
      sameRecentTracks(recentlyPlayedSnapshot.tracks, next.tracks)) return;
  recentlyPlayedSnapshot = next;
  recentlyPlayedObservers.forEach((observer) => observer());
}

function updateNative(metadata: NativeMetadataUpdate) {
  const signature = JSON.stringify(metadata);
  if (signature === lastNativeUpdate) return;
  lastNativeUpdate = signature;
  nativeUpdater?.(metadata);
}

function nativeMetadataFor(value: NowPlayingSnapshot): NativeMetadataUpdate {
  const artworkUrl = value.artworkUrl ?? fallbackArtworkUrl;
  return {
    title: value.title,
    artist: value.artist,
    ...(artworkUrl ? { artworkUrl } : {}),
  };
}

async function prepareFallbackArtwork(): Promise<void> {
  if (fallbackArtworkUrl) return;
  fallbackArtworkInitialization ??= (async () => {
    const asset = Asset.fromModule(STATION_ARTWORK);
    try {
      const downloaded = await asset.downloadAsync();
      fallbackArtworkUrl = downloaded.localUri ?? downloaded.uri;
    } catch {
      // Asset.fromModule supplies a real Metro/bundled URI even when a cache
      // download is unavailable. Never fabricate a native file path.
      fallbackArtworkUrl = asset.localUri ?? asset.uri;
    }
  })();
  await fallbackArtworkInitialization;
}

function toTrack(value: Live365NowPlaying): TrackMetadata | null {
  const track = {
    title: cleanMetadataText(value.title),
    artist: cleanMetadataText(value.artist),
    artworkUrl: httpsArtwork(value.artworkUrl),
  };
  return track.title || track.artist || track.artworkUrl ? track : null;
}

function applyLive365Metadata(value: Live365NowPlaying | null) {
  const track = value ? toTrack(value) : null;
  if (!track) {
    publish(fallbackSnapshot);
    updateNative(nativeMetadataFor(fallbackSnapshot));
    return;
  }
  const next: NowPlayingSnapshot = {
    title: track.title ?? FALLBACK_NOW_PLAYING.title,
    artist: track.artist ?? FALLBACK_NOW_PLAYING.artist,
    artworkUrl: track.artworkUrl,
    source: "live365",
  };
  publish(next);
  updateNative(nativeMetadataFor(next));
}

function clearTimer() {
  if (timer !== null) clearTimeout(timer);
  timer = null;
}

async function poll(expectedCycle: number) {
  const controller = new AbortController();
  request = controller;
  try {
    const station = await getStationInfo({ signal: controller.signal });
    if (pollingActive && expectedCycle === cycle && !controller.signal.aborted) {
      // History is visible on screen immediately, but the player remains at its
      // deliberate fallback until the listener explicitly starts playback.
      if (playbackActive) applyLive365Metadata(station.nowPlaying);
      publishRecentlyPlayed({ tracks: station.recentlyPlayed, status: "ready" });
    }
  } catch {
    // Keep the last valid now-playing and history values when Live365 is unavailable.
    if (pollingActive && expectedCycle === cycle && !controller.signal.aborted) {
      publishRecentlyPlayed({ tracks: recentlyPlayedSnapshot.tracks, status: "error" });
    }
  } finally {
    if (request === controller) request = null;
    if (pollingActive && expectedCycle === cycle) {
      timer = setTimeout(() => { void poll(expectedCycle); }, POLL_INTERVAL_MS);
    }
  }
}

function reconcilePolling() {
  const nextActive = playbackActive || recentlyPlayedObservers.size > 0;
  if (nextActive === pollingActive) return;
  pollingActive = nextActive;
  cycle += 1;
  clearTimer();
  request?.abort();
  request = null;
  if (pollingActive) {
    if (recentlyPlayedSnapshot.tracks.length === 0) {
      publishRecentlyPlayed({ tracks: [], status: "loading" });
    }
    void poll(cycle);
  }
}

export async function configureNativeMetadataUpdater(
  updater: (metadata: NativeMetadataUpdate) => void,
): Promise<void> {
  nativeUpdater = updater;
  lastNativeUpdate = "";
  await prepareFallbackArtwork();
  updateNative(nativeMetadataFor(snapshot));
}

export function resetNowPlaying() {
  lastNativeUpdate = "";
  publish(fallbackSnapshot);
  updateNative(nativeMetadataFor(fallbackSnapshot));
}

export function setMetadataPlaybackActive(nextActive: boolean) {
  if (nextActive === playbackActive) return;
  const wasPolling = pollingActive;
  playbackActive = nextActive;
  reconcilePolling();
  // A mounted history section may already own the poller. Refresh immediately
  // when playback starts so resetNowPlaying() is not visible until the next timer.
  if (nextActive && wasPolling && pollingActive) refreshMetadataFallback();
}

export function refreshMetadataFallback() {
  if (!pollingActive || request) return;
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

export function getRecentlyPlayedSnapshot(): RecentlyPlayedSnapshot {
  return recentlyPlayedSnapshot;
}

export function subscribeToRecentlyPlayed(observer: () => void): () => void {
  recentlyPlayedObservers.add(observer);
  reconcilePolling();
  return () => {
    recentlyPlayedObservers.delete(observer);
    reconcilePolling();
  };
}

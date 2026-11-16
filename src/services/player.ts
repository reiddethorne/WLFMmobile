import type { AudioMetadata, AudioPlayer, AudioStatus } from "expo-audio";
import { AppState, Platform } from "react-native";

import { STATION } from "../config/station";
import type { NativeMetadataUpdate } from "../types/metadata";
import type {
  RadioPlayerErrorKind,
  RadioPlayerSnapshot,
  RadioTransport,
} from "../types/player";
import { getStationInfo } from "./live365";
import {
  configureNativeMetadataUpdater,
  FALLBACK_NOW_PLAYING,
  getNowPlayingSnapshot,
  refreshMetadataFallback,
  resetNowPlaying,
  setMetadataPlaybackActive,
} from "./metadata";

type AudioModule = typeof import("expo-audio");

interface RadioSource {
  readonly uri: string;
  readonly transport: RadioTransport;
  /** The diagnostic preference that produced this source, including automatic MP3 fallback. */
  readonly preference: RadioTransport;
}

const CONNECTION_TIMEOUT_MS = 30_000;
// WLFM's HLS media playlist exposes three approximately five-second segments.
// Once paused beyond that live window, replace the source so iOS rejoins live.
const PAUSED_SOURCE_MAX_AGE_MS = 15_000;
const STREAM_USER_AGENT = `WLFM/1.0 (Expo Audio; ${Platform.OS})`;

class PlayerConfigurationError extends Error {}

let audioModule: AudioModule | null = null;
let player: AudioPlayer | null = null;
let initialization: Promise<AudioPlayer> | null = null;
let request: AbortController | null = null;
let generation = 0;
let wantsPlayback = false;
let discovering = false;
let timeout: ReturnType<typeof setTimeout> | null = null;
let activeSource: RadioSource | null = null;
let directFallback: RadioSource | null = null;
let fallbackAttempted = false;
let currentStatus: AudioStatus | null = null;
let lastNativePlaying = false;
let pausedAt: number | null = null;
let lockScreenMetadata: AudioMetadata = {
  title: FALLBACK_NOW_PLAYING.title,
  artist: FALLBACK_NOW_PLAYING.artist,
  albumTitle: STATION.name,
};
let snapshot: RadioPlayerSnapshot = {
  status: "idle",
  error: null,
  errorKind: null,
  canPause: false,
};
let transportPreference: RadioTransport = "hls";
const observers = new Set<() => void>();
const transportObservers = new Set<() => void>();

function publish(next: RadioPlayerSnapshot) {
  if (next.status === snapshot.status && next.error === snapshot.error &&
    next.errorKind === snapshot.errorKind && next.canPause === snapshot.canPause) return;
  snapshot = next;
  observers.forEach((observer) => observer());
}

function clearConnectionTimeout() {
  if (timeout !== null) clearTimeout(timeout);
  timeout = null;
}

function startConnectionTimeout(attempt: number, reconnecting: boolean) {
  clearConnectionTimeout();
  timeout = setTimeout(() => {
    if (attempt === generation) {
      fail(
        reconnecting
          ? "The stream took too long to reconnect. Check your connection and try again."
          : "The stream took too long to connect. Check your connection and retry.",
      );
    }
  }, CONNECTION_TIMEOUT_MS);
}

function metadataFromSnapshot(): AudioMetadata {
  const metadata = getNowPlayingSnapshot();
  return {
    title: metadata.title,
    artist: metadata.artist,
    albumTitle: STATION.name,
    ...(metadata.artworkUrl ? { artworkUrl: metadata.artworkUrl } : {}),
  };
}

function updateLockScreenMetadata(update: NativeMetadataUpdate) {
  lockScreenMetadata = {
    ...lockScreenMetadata,
    ...(update.title !== undefined ? { title: update.title } : {}),
    ...(update.artist !== undefined ? { artist: update.artist } : {}),
    ...(typeof update.artworkUrl === "string" ? { artworkUrl: update.artworkUrl } : {}),
  };
  if (player && activeSource) player.updateLockScreenMetadata(lockScreenMetadata);
}

function activateLockScreen() {
  if (!player || !activeSource) return;
  player.setActiveForLockScreen(true, lockScreenMetadata, {
    isLiveStream: true,
    showSeekBackward: false,
    showSeekForward: false,
  });
}

function audioSource(source: RadioSource) {
  return {
    uri: source.uri,
    name: `${STATION.name} ${source.transport.toUpperCase()} live stream`,
    headers: {
      "User-Agent": STREAM_USER_AGENT,
      ...(source.transport === "mp3" ? { "Icy-MetaData": "1" } : {}),
    },
  };
}

function replaceAndPlay(source: RadioSource) {
  if (!player) return;
  activeSource = source;
  currentStatus = null;
  lastNativePlaying = false;
  pausedAt = null;
  player.replace(audioSource(source));
  activateLockScreen();
  player.play();
  setMetadataPlaybackActive(true);
  publish({ status: "buffering", error: null, errorKind: null, canPause: true });
}

function pausedSourceIsStale(): boolean {
  if (pausedAt === null) return false;
  const pausedFor = Date.now() - pausedAt;
  return pausedFor < 0 || pausedFor >= PAUSED_SOURCE_MAX_AGE_MS;
}

function tryDirectFallback(): boolean {
  if (!player || !wantsPlayback || fallbackAttempted || activeSource?.transport !== "hls" || !directFallback) {
    return false;
  }
  fallbackAttempted = true;
  const attempt = generation;
  replaceAndPlay(directFallback);
  startConnectionTimeout(attempt, true);
  return true;
}

function fail(message: string, kind: RadioPlayerErrorKind = "connection") {
  generation += 1;
  request?.abort();
  request = null;
  discovering = false;
  wantsPlayback = false;
  lastNativePlaying = false;
  pausedAt = null;
  clearConnectionTimeout();
  setMetadataPlaybackActive(false);
  try { player?.pause(); } catch { /* Preserve the actionable connection error. */ }
  publish({ status: "error", error: message, errorKind: kind, canPause: false });
}

function applyNativeStatus(status: AudioStatus) {
  currentStatus = status;
  if (!activeSource) return;

  if (status.error) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn(`[radio] Expo Audio playback error: ${status.error}`);
    }
    if (!wantsPlayback && !discovering) {
      clearConnectionTimeout();
      setMetadataPlaybackActive(false);
      publish({ status: "paused", error: null, errorKind: null, canPause: false });
      return;
    }
    if (!tryDirectFallback()) {
      fail("Couldn't reconnect to WLFM. Check your connection and try again.");
    }
    return;
  }

  if (status.didJustFinish && wantsPlayback) {
    if (!tryDirectFallback()) fail("The live stream ended. Play to reconnect to WLFM.");
    return;
  }

  if (status.playing) {
    wantsPlayback = true;
    discovering = false;
    lastNativePlaying = true;
    pausedAt = null;
    clearConnectionTimeout();
    setMetadataPlaybackActive(true);
    publish({
      status: status.isBuffering ? "buffering" : "playing",
      error: null,
      errorKind: null,
      canPause: true,
    });
    return;
  }

  if (lastNativePlaying && status.isLoaded && !status.isBuffering) {
    // Native/system pauses must immediately become application pauses. A later
    // system Play event will set wantsPlayback again through the branch above.
    lastNativePlaying = false;
    wantsPlayback = false;
    pausedAt = Date.now();
    clearConnectionTimeout();
    setMetadataPlaybackActive(false);
    publish({ status: "paused", error: null, errorKind: null, canPause: false });
    return;
  }

  if (!wantsPlayback && (status.isBuffering || status.timeControlStatus === "waiting")) {
    // A system media-control Play can enter waiting/buffering before `playing`.
    const attempt = ++generation;
    wantsPlayback = true;
    if (pausedSourceIsStale()) {
      replaceAndPlay(activeSource);
      startConnectionTimeout(attempt, true);
      return;
    }
    startConnectionTimeout(attempt, true);
  }

  setMetadataPlaybackActive(wantsPlayback);
  publish({
    status: wantsPlayback
      ? status.isBuffering || status.timeControlStatus === "waiting" ? "buffering" : "connecting"
      : "paused",
    error: null,
    errorKind: null,
    canPause: wantsPlayback,
  });
}

function reconcileFromNative() {
  if (!player) return;
  applyNativeStatus(player.currentStatus);
}

async function initialize(): Promise<AudioPlayer> {
  if (player) return player;
  if (initialization) return initialization;
  initialization = (async () => {
    if (AppState.currentState !== "active") {
      throw new PlayerConfigurationError("Open the app in the foreground before starting radio playback.");
    }
    audioModule ??= await import("expo-audio");
    await audioModule.setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    });
    if (Platform.OS === "android") {
      try {
        await audioModule.requestNotificationPermissionsAsync();
      } catch (error: unknown) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.warn(`[radio] Notification permission request failed: ${error instanceof Error ? error.message : "unknown error"}`);
        }
      }
    }
    const instance = audioModule.createAudioPlayer(null, {
      keepAudioSessionActive: true,
      updateInterval: 250,
    });
    player = instance;
    instance.addListener("playbackStatusUpdate", applyNativeStatus);
    await configureNativeMetadataUpdater(updateLockScreenMetadata);
    AppState.addEventListener("change", (state) => {
      if (state === "active") {
        reconcileFromNative();
        refreshMetadataFallback();
      }
    });
    return instance;
  })();
  try {
    return await initialization;
  } catch (error: unknown) {
    if (error instanceof PlayerConfigurationError) throw error;
    throw new PlayerConfigurationError(error instanceof Error ? error.message : "Native player setup failed.");
  } finally {
    initialization = null;
  }
}

export function getRadioPlayerSnapshot(): RadioPlayerSnapshot {
  return snapshot;
}

/** UI subscriptions clean up independently of the single native player lifetime. */
export function subscribeToRadioPlayer(observer: () => void): () => void {
  observers.add(observer);
  return () => { observers.delete(observer); };
}

export function getRadioTransportSnapshot(): RadioTransport {
  return transportPreference;
}

export function subscribeToRadioTransport(observer: () => void): () => void {
  transportObservers.add(observer);
  return () => { transportObservers.delete(observer); };
}

/** Development diagnostic preference; changing it always requires a fresh Play. */
export function setRadioTransport(next: RadioTransport): void {
  if (next === transportPreference) return;
  transportPreference = next;
  pauseRadio();
  player?.clearLockScreenControls();
  resetNowPlaying();
  transportObservers.forEach((observer) => observer());
}

export async function playRadio(): Promise<void> {
  if (wantsPlayback || snapshot.status === "playing") return;
  const recovering = snapshot.status === "error";
  const attempt = ++generation;
  wantsPlayback = true;
  discovering = true;
  publish({ status: "connecting", error: null, errorKind: null, canPause: true });
  startConnectionTimeout(attempt, recovering);

  try {
    const instance = await initialize();
    if (attempt !== generation) return;

    const reusableSource = !recovering && activeSource?.preference === transportPreference &&
      !currentStatus?.error && !currentStatus?.didJustFinish ? activeSource : null;
    if (reusableSource) {
      discovering = false;
      if (pausedSourceIsStale()) {
        replaceAndPlay(reusableSource);
      } else {
        pausedAt = null;
        activateLockScreen();
        instance.play();
        setMetadataPlaybackActive(true);
        publish({ status: "connecting", error: null, errorKind: null, canPause: true });
      }
      return;
    }

    const controller = new AbortController();
    request = controller;
    const station = await getStationInfo({ signal: controller.signal });
    if (attempt !== generation || controller.signal.aborted) return;
    request = null;

    if (!station.preferredStream) {
      fail("WLFM is currently unavailable. Try again later.", "station-unavailable");
      return;
    }

    const direct: RadioSource = {
      uri: station.preferredStream.url,
      transport: "mp3",
      preference: transportPreference,
    };
    const selected: RadioSource = transportPreference === "hls" && station.hlsUrl
      ? { uri: station.hlsUrl, transport: "hls", preference: transportPreference }
      : direct;
    directFallback = selected.transport === "hls" ? direct : null;
    fallbackAttempted = selected.transport !== "hls";
    discovering = false;
    resetNowPlaying();
    lockScreenMetadata = metadataFromSnapshot();
    replaceAndPlay(selected);
  } catch (error: unknown) {
    if (attempt === generation) {
      const message = error instanceof Error ? error.message : "Playback failed.";
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.warn(`[radio] Connection attempt failed: ${message}`);
      }
      if (error instanceof PlayerConfigurationError) {
        fail(message, "configuration");
      } else {
        fail("Couldn't reconnect to WLFM. Check your connection and try again.");
      }
    }
  }
}

export function pauseRadio(): void {
  generation += 1;
  request?.abort();
  request = null;
  discovering = false;
  wantsPlayback = false;
  lastNativePlaying = false;
  pausedAt = activeSource ? Date.now() : null;
  clearConnectionTimeout();
  setMetadataPlaybackActive(false);
  try {
    player?.pause();
    publish({
      status: activeSource ? "paused" : "idle",
      error: null,
      errorKind: null,
      canPause: false,
    });
  } catch (error: unknown) {
    fail(error instanceof Error ? error.message : "Could not pause playback.");
  }
}

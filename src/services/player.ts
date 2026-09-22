import { AppState } from "react-native";

import { STATION } from "../config/station";
import { STATION_ARTWORK } from "../constants/assets";
import type { RadioPlayerSnapshot } from "../types/player";
import { getStationInfo } from "./live365";

type PlayerModule = typeof import("@rntp/player");
const CONNECTION_TIMEOUT_MS = 30_000;

let playerModule: PlayerModule | null = null;
let initialization: Promise<void> | null = null;
let setupComplete = false;
let listenersComplete = false;
let lastPlayingEvent = false;
let request: AbortController | null = null;
let generation = 0;
let wantsPlayback = false;
let discovering = false;
let failure: string | null = null;
let timeout: ReturnType<typeof setTimeout> | null = null;
let snapshot: RadioPlayerSnapshot = { status: "idle", error: null, canPause: false };
const observers = new Set<() => void>();

function publish(next: RadioPlayerSnapshot) {
  if (next.status === snapshot.status && next.error === snapshot.error && next.canPause === snapshot.canPause) return;
  snapshot = next;
  observers.forEach((observer) => observer());
}

function clearConnectionTimeout() {
  if (timeout !== null) clearTimeout(timeout);
  timeout = null;
}

function updateFromNative() {
  if (failure) {
    publish({ status: "error", error: failure, canPause: false });
    return;
  }
  if (discovering) {
    publish({ status: "connecting", error: null, canPause: wantsPlayback });
    return;
  }
  if (!playerModule || !setupComplete) return;
  const player = playerModule.default;
  const state = player.getPlaybackState();
  const playing = player.isPlaying();
  if (playing) clearConnectionTimeout();
  if (state === playerModule.PlaybackState.Error) {
    fail("The radio stream could not be played. Check your connection and retry.");
    return;
  }
  if (state === playerModule.PlaybackState.Ended && wantsPlayback) {
    fail("The live stream ended. Retry to reconnect to WLFM.");
    return;
  }
  const status = playing ? "playing" :
    wantsPlayback ? state === playerModule.PlaybackState.Buffering ? "buffering" : "connecting" :
      player.getActiveMediaItem() ? "paused" : "idle";
  publish({ status, error: null, canPause: wantsPlayback || playing });
}

function reconcileFromNative() {
  if (playerModule && setupComplete) {
    const player = playerModule.default;
    if (!player.isPlaying() && player.getPlaybackState() === playerModule.PlaybackState.Ready && !discovering) {
      wantsPlayback = false;
      clearConnectionTimeout();
    }
  }
  updateFromNative();
}

function fail(message: string) {
  generation += 1;
  request?.abort();
  request = null;
  discovering = false;
  wantsPlayback = false;
  failure = message;
  clearConnectionTimeout();
  // Preserve the queue for retry; suppress late starts after a failed connection.
  if (playerModule && setupComplete) {
    try { playerModule.default.pause(); } catch { /* Keep the original actionable error. */ }
  }
  publish({ status: "error", error: message, canPause: false });
}

async function initialize() {
  if (initialization) return initialization;
  initialization = (async () => {
    // Loading lazily lets missing native modules become a visible error on Play.
    playerModule ??= await import("@rntp/player");
    const player = playerModule.default;
    if (!setupComplete) {
      if (AppState.currentState !== "active") {
        throw new Error("Open the app in the foreground before starting radio playback.");
      }
      player.setupPlayer({
        contentType: "music",
        // Claim audio focus so calls and other interruptions pause/resume safely.
        audioMixing: "exclusive",
        // Prevent an unplugged headset/Bluetooth route from falling back to speakers.
        handleAudioBecomingNoisy: true,
        liveResumeBehavior: "live-edge",
        // Song metadata is a later milestone; keep station fallback metadata now.
        autoUpdateMetadataFromStream: false,
        android: {
          // The live network stream must keep the CPU and Wi-Fi path awake.
          wakeMode: "network",
          // Match normal radio behavior when the app is removed from recents.
          taskRemovedBehavior: "continue",
        },
      });
      setupComplete = true;
    }
    // Native handling works while JS is suspended and exposes only Play/Pause.
    player.setCommands({ capabilities: [playerModule.PlayerCommand.PlayPause], handling: "native" });
    if (!listenersComplete) {
      player.addEventListener(playerModule.Event.PlaybackStateChanged, updateFromNative);
      player.addEventListener(playerModule.Event.IsPlayingChanged, ({ playing }) => {
        // A native pause/interruption must not leave the screen showing Playing.
        if (lastPlayingEvent && !playing && player.getPlaybackState() === playerModule?.PlaybackState.Ready && !discovering) {
          wantsPlayback = false;
          clearConnectionTimeout();
        }
        lastPlayingEvent = playing;
        updateFromNative();
      });
      player.addEventListener(playerModule.Event.PlaybackError, ({ message }) => {
        fail(message.trim() || "Playback failed. Check your connection and retry.");
      });
      AppState.addEventListener("change", (state) => {
        if (state === "active") reconcileFromNative();
      });
      listenersComplete = true;
    }
  })();
  try {
    await initialization;
  } catch (error: unknown) {
    initialization = null;
    throw error;
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

export async function playRadio(): Promise<void> {
  if (wantsPlayback || snapshot.status === "playing") return;
  const recovering = snapshot.status === "error";
  const attempt = ++generation;
  wantsPlayback = true;
  discovering = true;
  failure = null;
  publish({ status: "connecting", error: null, canPause: true });
  clearConnectionTimeout();
  timeout = setTimeout(() => {
    if (attempt === generation) fail("The stream took too long to connect. Check your connection and retry.");
  }, CONNECTION_TIMEOUT_MS);

  try {
    await initialize();
    if (attempt !== generation || !playerModule) return;
    const player = playerModule.default;
    const current = player.getActiveMediaItem();
    const state = player.getPlaybackState();
    if (recovering || current?.mediaId !== STATION.id || state === playerModule.PlaybackState.Error ||
      state === playerModule.PlaybackState.Ended || state === playerModule.PlaybackState.Idle) {
      const controller = new AbortController();
      request = controller;
      const station = await getStationInfo({ signal: controller.signal });
      if (attempt !== generation) return;
      request = null;
      const stream = station.preferredStream;
      if (!stream) throw new Error("WLFM has no available supported listening stream. Try again later.");
      const currentUrl = typeof current?.url === "string" ? current.url :
        typeof current?.url === "object" ? current.url.uri : null;
      discovering = false;
      if (current?.mediaId === STATION.id && currentUrl === stream.url && state === playerModule.PlaybackState.Error) {
        player.retry();
      } else {
        player.setMediaItem({
          mediaId: STATION.id,
          url: { uri: stream.url, headers: { "Icy-MetaData": "1" } },
          mimeType: stream.mimeType,
          title: "LIVE",
          artist: station.name,
          isLive: true,
          artworkUrl: STATION_ARTWORK,
        });
      }
    }
    if (attempt !== generation) return;
    discovering = false;
    player.play();
    updateFromNative();
  } catch (error: unknown) {
    if (attempt === generation) {
      fail(error instanceof Error ? error.message : "Playback failed. Try again.");
    }
  }
}

export function pauseRadio(): void {
  generation += 1;
  request?.abort();
  request = null;
  discovering = false;
  wantsPlayback = false;
  failure = null;
  clearConnectionTimeout();
  try {
    if (playerModule && setupComplete) playerModule.default.pause();
    updateFromNative();
    if (!setupComplete) publish({ status: "idle", error: null, canPause: false });
  } catch (error: unknown) {
    fail(error instanceof Error ? error.message : "Could not pause playback.");
  }
}

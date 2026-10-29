import { AppState, Platform } from "react-native";

import { STATION } from "../config/station";
import { STATION_ARTWORK } from "../constants/assets";
import type { RadioPlayerSnapshot, RadioTransport } from "../types/player";
import { cleanMetadataText } from "../utils/metadataText";
import { getStationInfo } from "./live365";
import {
  configureNativeMetadataUpdater,
  FALLBACK_NOW_PLAYING,
  getNowPlayingSnapshot,
  receiveEffectiveMetadata,
  receiveStreamMetadata,
  refreshMetadataFallback,
  resetNowPlaying,
  setMetadataPlaybackActive,
} from "./metadata";

type PlayerModule = typeof import("@rntp/player");
const CONNECTION_TIMEOUT_MS = 30_000;
const HLS_MIME_TYPE = "application/x-mpegURL";
const PLAYBACK_TRANSPORT_EXTRA = "playbackTransport";
const TRANSPORT_PREFERENCE_EXTRA = "transportPreference";
const HLS_TRANSPORT = "hls";
const STREAM_USER_AGENT = "WLFM/1.0 (Android)";
const NATIVE_STATION_SUFFIX = ` - ${STATION.name}`;
const IS_NATIVE_PLATFORM = Platform.OS === "ios" || Platform.OS === "android";

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
let transportPreference: RadioTransport = "hls";
const observers = new Set<() => void>();
const transportObservers = new Set<() => void>();

function formatNativeArtist(artist: string): string;
function formatNativeArtist(artist: undefined): undefined;
function formatNativeArtist(artist: string | undefined): string | undefined {
  if (!IS_NATIVE_PLATFORM || artist === undefined) return artist;
  const cleaned = artist.trim().replace(/\s+/g, " ");
  const baseArtist = cleaned || FALLBACK_NOW_PLAYING.artist;
  return baseArtist.endsWith(NATIVE_STATION_SUFFIX) ? baseArtist : `${baseArtist}${NATIVE_STATION_SUFFIX}`;
}

function normalizeEffectiveMetadata(metadata: {
  readonly title?: string;
  readonly artist?: string;
  readonly artworkUrl?: unknown;
}) {
  if (!IS_NATIVE_PLATFORM || !metadata.artist?.endsWith(NATIVE_STATION_SUFFIX)) return metadata;
  return {
    ...metadata,
    artist: metadata.artist.slice(0, -NATIVE_STATION_SUFFIX.length).trim(),
  };
}

function isHlsItem(item: { readonly extras?: Record<string, unknown> } | null): boolean {
  // RNTP consumes mimeType while building the native source but does not return
  // it from getActiveMediaItem(). App-defined extras survive that round trip.
  return item?.extras?.[PLAYBACK_TRANSPORT_EXTRA] === HLS_TRANSPORT;
}

function itemMatchesTransportPreference(item: { readonly extras?: Record<string, unknown> } | null): boolean {
  return item?.extras?.[TRANSPORT_PREFERENCE_EXTRA] === transportPreference;
}

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
  // HLS may spend longer preparing its playlist and first segment. Start the
  // Live365 metadata fallback as soon as playback is wanted so the player does
  // not remain on LIVE/WLFM while native playback is still buffering.
  setMetadataPlaybackActive(wantsPlayback || playing);
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
  setMetadataPlaybackActive(false);
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
        // Native ICY/ID3 updates remain authoritative, including while JS sleeps.
        autoUpdateMetadataFromStream: true,
        android: {
          // The live network stream must keep the CPU and Wi-Fi path awake.
          wakeMode: "network",
          // Match normal radio behavior when the app is removed from recents.
          taskRemovedBehavior: "continue",
        },
      });
      setupComplete = true;
    }
    const updateActiveMetadata = (metadata: Parameters<typeof player.updateMetadata>[1]) => {
      const index = player.getActiveMediaItemIndex();
      if (index === null) return;
      if (metadata.artist === undefined) {
        player.updateMetadata(index, metadata);
        return;
      }
      const artist = formatNativeArtist(metadata.artist);
      player.updateMetadata(index, artist === metadata.artist ? metadata : { ...metadata, artist });
    };
    configureNativeMetadataUpdater(updateActiveMetadata);
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
      player.addEventListener(playerModule.Event.MetadataReceived, (metadata) => {
        if (isHlsItem(player.getActiveMediaItem())) {
          // Live365's HLS readiness event repeats the media item's LIVE/WLFM
          // fallback instead of identifying the song. Native auto-update has
          // already applied it by this point, so restore the API-backed value
          // without allowing the misleading event to outrank the directory.
          const current = getNowPlayingSnapshot();
          updateActiveMetadata({
            title: current.title,
            artist: current.artist,
            artworkUrl: current.artworkUrl ?? STATION_ARTWORK,
          });
          return;
        }
        receiveStreamMetadata(metadata);
        if (IS_NATIVE_PLATFORM) {
          const title = cleanMetadataText(metadata.title);
          const artist = cleanMetadataText(metadata.artist) ?? FALLBACK_NOW_PLAYING.artist;
          updateActiveMetadata({ ...(title ? { title } : {}), artist });
        }
      });
      player.addEventListener(playerModule.Event.MediaMetadataChanged, (metadata) => {
        // Live365's HLS playlist does not identify the current song. Treating
        // its generic asset metadata as stream metadata would permanently outrank
        // the directory fallback. Live365 API metadata is authoritative for HLS.
        if (isHlsItem(player.getActiveMediaItem())) return;
        receiveEffectiveMetadata(normalizeEffectiveMetadata(metadata));
      });
      AppState.addEventListener("change", (state) => {
        if (state === "active") {
          reconcileFromNative();
          const item = player.getActiveMediaItem();
          if (item && !isHlsItem(item)) receiveEffectiveMetadata(item);
          refreshMetadataFallback();
        }
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
  resetNowPlaying();
  transportObservers.forEach((observer) => observer());
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
    if (recovering || current?.mediaId !== STATION.id || !itemMatchesTransportPreference(current) ||
      state === playerModule.PlaybackState.Error ||
      state === playerModule.PlaybackState.Ended || state === playerModule.PlaybackState.Idle) {
      const controller = new AbortController();
      request = controller;
      const station = await getStationInfo({ signal: controller.signal });
      if (attempt !== generation) return;
      request = null;
      // HLS has a timestamped live window, so native players can recover at the
      // live edge after a network handoff instead of replaying an MP3 mount's
      // burst-on-connect buffer. Keep the direct stream as a compatibility
      // fallback, but only while Live365 reports the station as playable.
      const stream = transportPreference === "hls" && station.preferredStream && station.hlsUrl
        ? { url: station.hlsUrl, mimeType: HLS_MIME_TYPE }
        : station.preferredStream;
      if (!stream) throw new Error("WLFM has no available supported listening stream. Try again later.");
      const currentUrl = typeof current?.url === "string" ? current.url :
        typeof current?.url === "object" ? current.url.uri : null;
      discovering = false;
      if (current?.mediaId === STATION.id && currentUrl === stream.url && state === playerModule.PlaybackState.Error) {
        player.retry();
      } else {
        resetNowPlaying();
        player.setMediaItem({
          mediaId: STATION.id,
          url: {
            uri: stream.url,
            headers: {
              "User-Agent": STREAM_USER_AGENT,
              ...(stream.mimeType === HLS_MIME_TYPE ? {} : {
                "Icy-MetaData": "1",
              }),
            },
          },
          mimeType: stream.mimeType,
          extras: {
            [PLAYBACK_TRANSPORT_EXTRA]: stream.mimeType === HLS_MIME_TYPE ? HLS_TRANSPORT : "mp3",
            [TRANSPORT_PREFERENCE_EXTRA]: transportPreference,
          },
          ...FALLBACK_NOW_PLAYING,
          artist: formatNativeArtist(FALLBACK_NOW_PLAYING.artist),
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
  setMetadataPlaybackActive(false);
  try {
    if (playerModule && setupComplete) playerModule.default.pause();
    updateFromNative();
    if (!setupComplete) publish({ status: "idle", error: null, canPause: false });
  } catch (error: unknown) {
    fail(error instanceof Error ? error.message : "Could not pause playback.");
  }
}

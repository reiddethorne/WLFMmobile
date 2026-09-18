import { STATION } from "../config/station";
import type {
  Live365NowPlaying,
  Live365RequestOptions,
  Live365StationInfo,
  Live365Stream,
} from "../types/live365";

// Observed in Live365's public listener client and verified September 17, 2026.
// This is an unauthenticated directory endpoint, not a broadcaster API contract.
const DIRECTORY_URL = "https://api.live365.com";
const REQUEST_TIMEOUT_MS = 10_000;

type Live365ErrorCode =
  | "configuration"
  | "http"
  | "network"
  | "timeout"
  | "aborted"
  | "invalid-response"
  | "stream-unavailable";

export class Live365Error extends Error {
  constructor(
    readonly code: Live365ErrorCode,
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "Live365Error";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function httpsUrl(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function listeningUrl(value: unknown, stationId: string, hls = false): string | null {
  const candidate = httpsUrl(value);
  if (!candidate) return null;
  const url = new URL(candidate);
  const validPaths = hls
    ? [`/${stationId}/playlist.m3u8`]
    : [`/${stationId}`, `/${stationId}_2`];
  // Keep the stable public redirector, never persist a CDN/session-specific URL.
  return url.hostname === "streaming.live365.com" && !url.port &&
    validPaths.includes(url.pathname) && !url.search && !url.hash
    ? candidate
    : null;
}

function parseNowPlaying(value: unknown): Live365NowPlaying | null {
  if (!isRecord(value)) return null;
  const title = text(value.title);
  const artist = text(value.artist);
  // An artwork-only object is not a current song.
  if (!title && !artist) return null;
  return { title, artist, artworkUrl: httpsUrl(value.art) };
}

/** Parse only observed fields; all network JSON enters as unknown. */
export function parseStationInfo(
  value: unknown,
  expectedId: string = STATION.id,
): Live365StationInfo {
  if (!isRecord(value) || text(value["mount-id"]) !== expectedId) {
    throw new Live365Error("invalid-response", "Live365 returned an invalid station identity.");
  }

  const streams: Live365Stream[] = [];
  const entries: unknown = value["listening-urls"];
  if (Array.isArray(entries)) {
    for (const entry of entries as unknown[]) {
      if (!isRecord(entry)) continue;
      const url = listeningUrl(entry.url, expectedId);
      const encoding = text(entry.encoding)?.toLowerCase();
      if (!url || (encoding !== "mp3" && encoding !== "aac")) continue;
      if (streams.some((stream) => stream.url === url)) continue;
      streams.push({
        url,
        encoding,
        bitrateKbps: typeof entry.bitrate === "number" &&
          Number.isFinite(entry.bitrate) && entry.bitrate > 0 ? entry.bitrate : null,
        mimeType: encoding === "mp3" ? "audio/mpeg" : "audio/aac",
      });
    }
  }

  // The verified primary field is the standard MP3 mount. Do not infer AAC/HLS.
  const primaryUrl = listeningUrl(value["stream-url"], expectedId);
  if (primaryUrl === `https://streaming.live365.com/${expectedId}` &&
    !streams.some((stream) => stream.url === primaryUrl)) {
    streams.push({ url: primaryUrl, encoding: "mp3", bitrateKbps: null, mimeType: "audio/mpeg" });
  }

  const enabled = typeof value.station_enabled === "boolean" ? value.station_enabled : null;
  const broadcasting = typeof value.is_playing === "boolean" ? value.is_playing : null;
  const preferredStream = enabled === false || broadcasting === false ? null :
    streams.find((stream) => stream.encoding === "mp3") ?? streams[0] ?? null;

  return {
    id: expectedId,
    name: text(value.name) ?? STATION.name,
    artworkUrl: httpsUrl(value["station-logo"]),
    enabled,
    broadcasting,
    streams,
    preferredStream,
    hlsUrl: listeningUrl(value["stream-hls-url"], expectedId, true),
    nowPlaying: enabled === false || broadcasting === false
      ? null : parseNowPlaying(value["current-track"]),
  };
}

export async function getStationInfo(
  options: Live365RequestOptions = {},
): Promise<Live365StationInfo> {
  if (!/^a\d+$/.test(STATION.id)) {
    throw new Live365Error("configuration", "Configure a valid public Live365 mount ID.");
  }
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Live365Error("configuration", "Live365 request timeout must be positive.");
  }
  if (options.signal?.aborted) {
    throw new Live365Error("aborted", "Live365 request was cancelled.");
  }

  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`${DIRECTORY_URL}/station/${encodeURIComponent(STATION.id)}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Live365Error("http", `Live365 station request failed (HTTP ${response.status}).`, response.status);
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch (error: unknown) {
      if (controller.signal.aborted) throw error;
      throw new Live365Error("invalid-response", "Live365 returned unreadable JSON.");
    }
    if (controller.signal.aborted) {
      throw new Live365Error("aborted", "Live365 request was cancelled.");
    }
    return parseStationInfo(body);
  } catch (error: unknown) {
    if (timedOut) throw new Live365Error("timeout", "Live365 request timed out. Try again.");
    if (options.signal?.aborted) throw new Live365Error("aborted", "Live365 request was cancelled.");
    if (error instanceof Live365Error) throw error;
    throw new Live365Error("network", "Could not reach Live365. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
  }
}

export async function getStreamUrl(options?: Live365RequestOptions): Promise<string> {
  const station = await getStationInfo(options);
  if (!station.preferredStream) {
    throw new Live365Error("stream-unavailable", "Live365 has no available supported listening stream.");
  }
  return station.preferredStream.url;
}

export async function getNowPlaying(
  options?: Live365RequestOptions,
): Promise<Live365NowPlaying | null> {
  return (await getStationInfo(options)).nowPlaying;
}

/** Normalized app types, not assertions about unvalidated API JSON. */
export interface Live365Stream {
  readonly url: string;
  readonly encoding: "mp3" | "aac";
  readonly bitrateKbps: number | null;
  readonly mimeType: "audio/mpeg" | "audio/aac";
}

export interface Live365NowPlaying {
  readonly title: string | null;
  readonly artist: string | null;
  readonly artworkUrl: string | null;
}

export interface Live365StationInfo {
  readonly id: string;
  readonly name: string;
  readonly artworkUrl: string | null;
  readonly enabled: boolean | null;
  readonly broadcasting: boolean | null;
  readonly streams: readonly Live365Stream[];
  readonly preferredStream: Live365Stream | null;
  readonly hlsUrl: string | null;
  readonly nowPlaying: Live365NowPlaying | null;
}

export interface Live365RequestOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

import type { Live365RecentTrack } from "./live365";

export type NowPlayingSource = "fallback" | "live365" | "stream";

export interface NowPlayingSnapshot {
  readonly title: string;
  readonly artist: string;
  readonly artworkUrl: string | null;
  readonly source: NowPlayingSource;
}

export interface RecentlyPlayedSnapshot {
  readonly tracks: readonly Live365RecentTrack[];
  readonly status: "loading" | "ready" | "error";
}

export interface StreamMetadataInput {
  readonly title?: string;
  readonly artist?: string;
  readonly artworkUrl?: unknown;
}

export interface NativeMetadataUpdate {
  readonly title?: string;
  readonly artist?: string;
  readonly artworkUrl?: string | number;
}

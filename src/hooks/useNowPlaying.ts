import { useSyncExternalStore } from "react";

import { getNowPlayingSnapshot, subscribeToNowPlaying } from "@/services/metadata";

export function useNowPlaying() {
  return useSyncExternalStore(subscribeToNowPlaying, getNowPlayingSnapshot, getNowPlayingSnapshot);
}

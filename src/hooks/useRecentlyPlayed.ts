import { useSyncExternalStore } from "react";

import {
  getRecentlyPlayedSnapshot,
  subscribeToRecentlyPlayed,
} from "@/services/metadata";

export function useRecentlyPlayed() {
  return useSyncExternalStore(
    subscribeToRecentlyPlayed,
    getRecentlyPlayedSnapshot,
    getRecentlyPlayedSnapshot,
  );
}

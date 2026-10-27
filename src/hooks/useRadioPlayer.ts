import { useSyncExternalStore } from "react";

import { getRadioPlayerSnapshot, pauseRadio, playRadio, subscribeToRadioPlayer } from "@/services/player";

let hasRequestedPlayback = false;

export function useRadioPlayer() {
  const snapshot = useSyncExternalStore(subscribeToRadioPlayer, getRadioPlayerSnapshot, getRadioPlayerSnapshot);

  return {
    ...snapshot,
    hasRequestedPlayback,
    togglePlayback: () => {
      if (getRadioPlayerSnapshot().canPause) pauseRadio();
      else {
        hasRequestedPlayback = true;
        void playRadio();
      }
    },
  };
}

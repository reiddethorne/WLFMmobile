import { useSyncExternalStore } from "react";

import { getRadioPlayerSnapshot, pauseRadio, playRadio, subscribeToRadioPlayer } from "@/services/player";

export function useRadioPlayer() {
  const snapshot = useSyncExternalStore(subscribeToRadioPlayer, getRadioPlayerSnapshot, getRadioPlayerSnapshot);

  return {
    ...snapshot,
    togglePlayback: () => {
      if (getRadioPlayerSnapshot().canPause) pauseRadio();
      else void playRadio();
    },
  };
}

import { View } from "react-native";

import { NowPlaying } from "@/components/NowPlaying";
import { PlayerButton } from "@/components/PlayerButton";

export function RadioPlayer() {
  return (
    <View>
      <NowPlaying />
      <PlayerButton />
    </View>
  );
}

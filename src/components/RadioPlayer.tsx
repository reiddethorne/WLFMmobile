import { View } from "react-native";

import { CurrentShow } from "@/components/CurrentShow";
import { NowPlaying } from "@/components/NowPlaying";
import { PlayerButton } from "@/components/PlayerButton";

export function RadioPlayer() {
  return (
    <View>
      <NowPlaying />
      <PlayerButton />
      <CurrentShow />
    </View>
  );
}

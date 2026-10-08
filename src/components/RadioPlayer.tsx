import { View } from "react-native";

import { CurrentShow } from "@/components/CurrentShow";
import { NowPlaying } from "@/components/NowPlaying";
import { PlayerButton } from "@/components/PlayerButton";
import { RecentlyPlayed } from "@/components/RecentlyPlayed";

export function RadioPlayer() {
  return (
    <View>
      <NowPlaying />
      <PlayerButton />
      <RecentlyPlayed />
      <CurrentShow />
    </View>
  );
}

import { View } from "react-native";

import { CurrentShow } from "@/components/CurrentShow";
import { NowPlaying } from "@/components/NowPlaying";
import { RecentlyPlayed } from "@/components/RecentlyPlayed";

export function RadioPlayer() {
  return (
    <View>
      <CurrentShow />
      <NowPlaying />
      <RecentlyPlayed />
    </View>
  );
}

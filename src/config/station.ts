import type { StationConfig } from "@/types/station";

// Public mount ID verified against the WLFM listener page and station API.
export const STATION = {
  id: "a98536",
  name: "WLFM",
  slogan: "The only alternative in the valley.",
} as const satisfies StationConfig;

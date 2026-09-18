import type { StationConfig } from "@/types/station";

// Public mount ID verified against the WLFM listener page and station API.
export const STATION = {
  id: "a98536",
  name: "WLFM",
  slogan: "Your Campus. Your Music.",
} as const satisfies StationConfig;

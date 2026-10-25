import type { ImageSourcePropType } from "react-native";

/**
 * Landmark illustrations by their content key (CountryContent.landmark.illustration): the website's own pictures
 * (src/assets/landmarks), bundled for the levels the app plays (game/playable.ts). A landmark without one here is
 * shown as text, as the website shows one without an illustration. Each picture added here must also be let into
 * the EAS upload (/.easignore, scripts/check-eas-archive.mjs).
 */
export const LANDMARK_IMAGES: Readonly<Record<string, ImageSourcePropType>> = {
  "eiffel-tower": require("@/assets/landmarks/eiffel-tower.webp"),
  atomium: require("@/assets/landmarks/atomium.webp"),
  "amsterdam-canal-houses": require("@/assets/landmarks/amsterdam-canal-houses.webp"),
  "adolphe-bridge": require("@/assets/landmarks/adolphe-bridge.webp"),
  "brandenburg-gate": require("@/assets/landmarks/brandenburg-gate.webp"),
};

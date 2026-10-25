import type { ImageSourcePropType } from "react-native";

/**
 * Landmark illustrations by their content key (CountryContent.landmark.illustration): the website's own pictures
 * (src/assets/landmarks, at most 720px across), every one the European levels show, in the order the levels first
 * show them. A landmark without one here is shown as text, as the website shows one without an illustration. The
 * EAS upload lets in every picture of that folder (/.easignore), and its check (scripts/check-eas-archive.mjs)
 * requires exactly those listed here.
 */
export const LANDMARK_IMAGES: Readonly<Record<string, ImageSourcePropType>> = {
  // Level 1
  "eiffel-tower": require("@/assets/landmarks/eiffel-tower.webp"),
  atomium: require("@/assets/landmarks/atomium.webp"),
  "amsterdam-canal-houses": require("@/assets/landmarks/amsterdam-canal-houses.webp"),
  "adolphe-bridge": require("@/assets/landmarks/adolphe-bridge.webp"),
  "brandenburg-gate": require("@/assets/landmarks/brandenburg-gate.webp"),
  // Level 2
  "chapel-bridge": require("@/assets/landmarks/chapel-bridge.webp"),
  "schonbrunn-palace": require("@/assets/landmarks/schonbrunn-palace.webp"),
  colosseum: require("@/assets/landmarks/colosseum.webp"),
  // Level 3
  "wawel-castle": require("@/assets/landmarks/wawel-castle.webp"),
  "charles-bridge": require("@/assets/landmarks/charles-bridge.webp"),
  "bratislava-castle": require("@/assets/landmarks/bratislava-castle.webp"),
  // Level 4
  "bled-castle": require("@/assets/landmarks/bled-castle.webp"),
  "dubrovnik-city-walls": require("@/assets/landmarks/dubrovnik-city-walls.webp"),
  "stari-most": require("@/assets/landmarks/stari-most.webp"),
  "ostrog-monastery": require("@/assets/landmarks/ostrog-monastery.webp"),
  // Level 5
  "esztergom-basilica": require("@/assets/landmarks/esztergom-basilica.webp"),
  "bran-castle": require("@/assets/landmarks/bran-castle.webp"),
  "golubac-fortress": require("@/assets/landmarks/golubac-fortress.webp"),
  "rila-monastery": require("@/assets/landmarks/rila-monastery.webp"),
  meteora: require("@/assets/landmarks/meteora.webp"),
  // Level 6
  "mir-castle": require("@/assets/landmarks/mir-castle.webp"),
  "trakai-island-castle": require("@/assets/landmarks/trakai-island-castle.webp"),
  "house-of-the-black-heads": require("@/assets/landmarks/house-of-the-black-heads.webp"),
  "tallinn-town-hall": require("@/assets/landmarks/tallinn-town-hall.webp"),
  // Level 7
  "belem-tower": require("@/assets/landmarks/belem-tower.webp"),
  "sagrada-familia": require("@/assets/landmarks/sagrada-familia.webp"),
  "casa-de-la-vall": require("@/assets/landmarks/casa-de-la-vall.webp"),
  // Level 8
  "saint-sophia-cathedral": require("@/assets/landmarks/saint-sophia-cathedral.webp"),
  "soroca-fortress": require("@/assets/landmarks/soroca-fortress.webp"),
  // Level 9
  "prizren-fortress": require("@/assets/landmarks/prizren-fortress.webp"),
  butrint: require("@/assets/landmarks/butrint.webp"),
  "kaneo-church": require("@/assets/landmarks/kaneo-church.webp"),
  // Level 10
  kronborg: require("@/assets/landmarks/kronborg.webp"),
  "visby-city-wall": require("@/assets/landmarks/visby-city-wall.webp"),
  bryggen: require("@/assets/landmarks/bryggen.webp"),
  olavinlinna: require("@/assets/landmarks/olavinlinna.webp"),
  hallgrimskirkja: require("@/assets/landmarks/hallgrimskirkja.webp"),
  // Level 11
  "big-ben": require("@/assets/landmarks/big-ben.webp"),
  "cliffs-of-moher": require("@/assets/landmarks/cliffs-of-moher.webp"),
  // Level 12
  "saint-basils-cathedral": require("@/assets/landmarks/saint-basils-cathedral.webp"),
};

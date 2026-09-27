import type { CountryId, LonLat } from "../content/types";
import type { BorderGraph } from "../game/graph";
import type { LocalizedText } from "../i18n/locales";

export interface TravelMission {
  id: string;
  from: CountryId;
  to: CountryId;
  // The crossing budget is not stored: it is computed with BFS on `borders`.
}

export interface LessonDefinition {
  id: string;
  title: LocalizedText;
  regionName: LocalizedText;
  /** Countries that can be selected and played in this lesson. */
  countries: readonly CountryId[];
  /** Land borders between the active countries only (checked against the map data in tests). */
  borders: BorderGraph;
  find: { rounds: number };
  travel: { mission: TravelMission };
  map: {
    /**
     * Magnified inset for a small country: the area shown, as [south-west,
     * north-east] corners, and the country it is centred on (named in the inset
     * title only while that country's name is visible on the map).
     */
    inset?: { bounds: readonly [LonLat, LonLat]; country: CountryId };
    /**
     * Where the Travel route line crosses each lesson border, keyed by the two
     * country ids in alphabetical order ("BEL-FRA"). Each point lies on the
     * countries' shared border, and straight lines from it to both capitals stay
     * inside those countries (verified in src/geo/route.test.ts).
     */
    routeCrossings?: Readonly<Record<string, LonLat>>;
  };
}

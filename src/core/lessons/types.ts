import type { CountryId, LonLat } from "../content/types";
import type { BorderGraph } from "../game/graph";
import type { LocalizedText } from "../i18n/locales";

export interface TravelMission {
  id: string;
  from: CountryId;
  to: CountryId;
  // The crossing budget is not stored: it is computed with BFS on `borders`.
}

/** The playable content of a level: its countries, border graph, journey and map settings. */
export interface LessonDefinition {
  /** Stable level id, used as the key of the level's saved progress. */
  id: string;
  regionName: LocalizedText;
  /** Countries that can be selected and played in this level. */
  countries: readonly CountryId[];
  /** Land borders between the active countries only (checked against the map data in tests). */
  borders: BorderGraph;
  travel: { mission: TravelMission };
  /**
   * Hints that describe a country within this level's region, where the
   * country's own hint (src/core/content) would not fit it: e.g. Germany is in
   * the east of Level 1's region but the north of Level 2's.
   */
  hints?: Partial<Readonly<Record<CountryId, LocalizedText>>>;
  map: {
    /**
     * Magnified inset for a small country: the area shown, as [south-west,
     * north-east] corners, and the country it is centred on (named in the inset
     * title only while that country's name is visible on the map). Levels
     * without one have no close-up.
     */
    inset?: { bounds: readonly [LonLat, LonLat]; country: CountryId };
    /**
     * Countries too small for an in-place name at the whole-map view: their
     * names are drawn beside them with a leader line to the label point until
     * zooming makes them large enough, and the close-up shows them.
     */
    smallCountries?: readonly CountryId[];
    /**
     * Where the Travel route line crosses each border, keyed by the two
     * country ids in alphabetical order ("BEL-FRA"). Each point lies on the
     * countries' shared border, and the lines from it to both capitals stay
     * inside those countries (verified in src/geo/route.test.ts).
     */
    routeCrossings?: Readonly<Record<string, LonLat>>;
    /**
     * Turning points of a route leg inside one country, where a straight line
     * between its capital and a border crossing would leave the country (e.g.
     * across the sea, or through a neighbour). Keyed "<country>@<border key>"
     * ("ITA@FRA-ITA"), listed from the capital towards the crossing.
     */
    routeVia?: Readonly<Record<string, readonly LonLat[]>>;
    /**
     * Half-size, in world units, of the area around the level's countries that
     * the map may ever show (see src/geo/regionMap.ts). It must lie inside the
     * prepared map data, which the tests check. Defaults to [1150, 900].
     */
    coverageHalf?: readonly [number, number];
  };
}

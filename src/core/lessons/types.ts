import type { CountryId, LonLat } from "../content/types";
import type { BorderGraph } from "../game/graph";
import type { NonNeighbourOption } from "../game/travel";
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
  /**
   * Which version of the level's content this is, where a level's countries have changed: 2 for the
   * second, and so on. Absent for a level's first version. A save records it (LessonProgress.revision),
   * so an attempt stays on the version it was started on (see LevelInfo.earlier).
   */
  revision?: number;
  regionName: LocalizedText;
  /** Countries that can be selected and played in this level. */
  countries: readonly CountryId[];
  /**
   * Real neighbours outside the level's countries that Travel can also enter, so a journey never leaves
   * the player only one way on where a neighbour could give a second (Level 10's Germany, at Denmark).
   * They are never learned: Discover, Find, completion and stars stay with `countries`. In Travel (and its
   * Results) the map draws them as it draws the level's countries, and they are offered as moves like them.
   * None of them lies on a journey's shortest route, so the crossing budget and the routes that complete
   * a journey are the level's own (checked in tests). Absent where every journey already offers a choice,
   * or where no real neighbour can add one without a shorter route.
   */
  travelOnly?: readonly CountryId[];
  /**
   * Land borders between the active countries only, `travelOnly` included (checked against the map data in
   * tests), and the level's named fixed links between two of them (`map.borderLinks`), which are not land
   * borders. A country with neither (Level 10's Iceland) has no neighbours: it is learned in Discover and
   * Find, but no journey reaches it.
   */
  borders: BorderGraph;
  travel: {
    /** The journey every new attempt takes. */
    mission: TravelMission;
    /**
     * Journeys this level offered before `mission` (each with its own id). A saved attempt or result for one
     * is still read, on its own start and destination, never re-read with the current ones: an attempt
     * under way keeps them (Undo and Restart included), a finished one keeps its Results. Replay journey
     * and Play again start a new attempt, on `mission`.
     */
    earlierMissions?: readonly TravelMission[];
    /**
     * Countries shown among the choices at one point of the journey although they share no border with the country
     * there: geography distractors, styled as the moves are (Level 7's France, at the start in Portugal). They are no
     * edges of `borders`: choosing one moves nothing and uses no crossing; Travel says the two countries don't
     * share a border and the player chooses again (choose in src/core/game/travel.ts). Never a neighbour of that
     * country, a country of the route, or the destination; none in other levels yet.
     */
    nonNeighbourOptions?: readonly NonNeighbourOption[];
    /**
     * Travel's note under the moves, in place of the usual one (only the level's countries can be
     * entered), where that would not tell the whole story: Level 10's, on the Øresund link between
     * Denmark and Sweden and on Iceland, which no journey reaches. Geography only, never advice on
     * how to travel today.
     */
    note?: LocalizedText;
  };
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
     * without one have no close-up. On wide maps it sits top-left, unless
     * `wideMapCorner` says bottom-left (Level 10, whose top-left is Iceland); on
     * smaller ones bottom-left, opening upwards, unless `smallMapCorner` says
     * top-left (Level 7, whose bottom-left corner is Portugal).
     */
    inset?: {
      bounds: readonly [LonLat, LonLat];
      country: CountryId;
      smallMapCorner?: "bottom-left" | "top-left";
      wideMapCorner?: "top-left" | "bottom-left";
      /**
       * On smaller maps the panel opens beside its toggle, along the map's edge, rather than
       * above (or below) it: Level 10's, which above its toggle would cover Iceland on a 320px
       * phone and in a 740×360 landscape. Without it, only maps too short for the panel there.
       */
      smallMapBeside?: boolean;
    };
    /**
     * Countries too small for an in-place name at the whole-map view: their
     * names are drawn beside them with a leader line to the label point until
     * zooming makes them large enough, and the close-up shows them.
     */
    smallCountries?: readonly CountryId[];
    /**
     * Countries whose name, in a callout, goes on two lines where one line finds no room on the map
     * at all, while the country is highlighted (selected, or on Travel's journey): North Macedonia's
     * in Level 9, in Armenian at 200% text on a 320px phone. Otherwise their callouts are placed as
     * any other's.
     */
    twoLineCallouts?: readonly CountryId[];
    /**
     * Callouts keep clear of the Travel route line (as of another callout's leader) wherever that
     * leaves them a place; where it doesn't, they are placed as without it. Level 9's Montenegro,
     * whose callout on a 320px phone in Armenian otherwise lay over the route into Albania.
     */
    calloutsClearRoute?: boolean;
    /**
     * A highlighted country (selected, or on Travel's journey) whose label point lies under the map
     * controls (or the close-up) takes its callout's dot from the nearest point of the country clear
     * of them, as a larger country's dot moves when no position from its label point is clear, rather
     * than go unnamed: Level 10's Sweden and Norway at 200% text on a 320px phone, where the short map
     * puts its controls in a row across its bottom right. A country with no part clear of them
     * (Denmark there) is left out, and never opens the close-up, as in every other level.
     */
    calloutDotsClearControls?: boolean;
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
     * Fixed links a route leg may follow across water inside its own country, where
     * the country's land is split and no line on land joins its parts: each a pair of
     * consecutive points of `routeVia` (in either order), with the country whose leg
     * uses it. Only these segments may leave land; they must never enter another
     * country (verified in src/geo/route.test.ts). Croatia's Pelješac Bridge, past
     * Bosnia and Herzegovina's coast at Neum, is the only one.
     */
    routeLinks?: readonly { country: CountryId; name: string; points: readonly [LonLat, LonLat] }[];
    /**
     * Named fixed links joining two of the level's countries that share no land border: a bridge or
     * tunnel across the sea, which a move crosses as it would a border. Its countries are neighbours in
     * `borders`, and the tests accept that edge only through it (they share no boundary in the map data).
     * `points` run along the link from the first country's land to the second's, the national boundary
     * among them: the border's crossing (`routeCrossings`). The route line follows them (each leg's
     * `routeVia` points end, or start, with the link's points on its side), and only these segments of a
     * move between two countries may cross water; they never enter a third country (verified in
     * src/geo/route.test.ts). Level 10's Øresund Bridge and Drogden Tunnel is the only one.
     */
    borderLinks?: readonly { between: readonly [CountryId, CountryId]; name: string; points: readonly LonLat[] }[];
    /**
     * The map data the level is drawn from (src/geo/regionMap.ts): the levels' own by default, or
     * "north" (Level 10), loaded only with it, whose relief is its own overview and the Quick
     * Challenge's tiles (the levels' tiles stop where their data does, at 62°N).
     */
    dataset?: "north";
    /**
     * Half-size, in world units, of the area around the level's countries that
     * the map may ever show (see src/geo/regionMap.ts). It must lie inside the
     * prepared map data, which the tests check. Defaults to [1150, 900].
     */
    coverageHalf?: readonly [number, number];
    /**
     * In Travel and its Results, how much further north than the coverage the map may be panned, and moved to keep
     * the traveller whole, in world units: room for a Travel-only country's capital near the coverage's north edge
     * and the traveller's pin above it (Level 4's Budapest). The zoom limits, and the start views of Discover and
     * Find, keep the coverage's; the level's relief overview must reach this far (scripts/generate-relief.mjs).
     */
    travelReachNorth?: number;
  };
}

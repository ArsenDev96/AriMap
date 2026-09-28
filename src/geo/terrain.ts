import type { CountryId, LonLat } from "@/core/content/types";

/**
 * Geographic anchors for the map's landscape: wave marks (drawn in Discover),
 * and the crests of the main mountain ranges and named forests. Mountains and
 * forests are painted from elevation and land-cover data
 * (src/components/map/Relief.tsx, scripts/generate-relief.mjs); the crests and
 * forests are kept as independent reference points, which the tests use to
 * check that the relief and forests show where they really are. Sources and
 * simplifications are listed in docs/TERRAIN.md; src/geo/terrain.test.ts checks
 * every anchor against the map data (and, when NE_REGIONS is set, against
 * Natural Earth's named ranges).
 */

export type RangeKind = "alpine" | "rocky" | "hills";

export interface MountainRange {
  id: string;
  /** Natural Earth region name the crests lie in, or null (see `peaks`). */
  naturalEarth: string | null;
  kind: RangeKind;
  /** Crest lines, west to east, through named summits (lon, lat). */
  crests: readonly (readonly LonLat[])[];
}

export interface Forest {
  id: string;
  country: CountryId;
  /** Coordinate of the forest's Wikipedia article. */
  center: LonLat;
}

export const MOUNTAIN_RANGES: readonly MountainRange[] = [
  {
    id: "alps",
    naturalEarth: "Alps",
    kind: "alpine",
    crests: [
      // Main chain: Mercantour, Monte Viso, Mont Blanc, Monte Rosa, Gotthard, Bernina, Ortler, Wildspitze, Grossglockner, Niedere Tauern.
      [[7.13, 44.14], [7.09, 44.67], [6.95, 45.15], [6.87, 45.83], [7.87, 45.94], [8.57, 46.56], [9.91, 46.38], [10.55, 46.51], [10.87, 46.89], [11.8, 47.05], [12.7, 47.08], [13.9, 47.3], [15.2, 47.55]],
      // Western ranges: Écrins, Belledonne, Aravis.
      [[6.15, 44.45], [6.36, 44.92], [6.05, 45.3], [6.35, 45.85]],
      // Bernese Alps and Glarus Alps: Jungfrau, Titlis, Tödi.
      [[7.2, 46.33], [7.96, 46.54], [8.44, 46.77], [8.91, 46.81]],
      // Northern Limestone Alps: Säntis, Allgäu, Zugspitze, Dachstein.
      [[9.34, 47.25], [10.25, 47.38], [10.99, 47.42], [11.8, 47.55], [12.9, 47.58], [13.61, 47.48], [14.6, 47.65], [15.6, 47.72]],
      // Southern Alps: Adamello, Marmolada, Triglav.
      [[10.5, 46.16], [11.85, 46.44], [12.6, 46.45], [13.84, 46.38]],
    ],
  },
  {
    id: "pyrenees",
    naturalEarth: "Pyrenees",
    kind: "alpine",
    // Pic du Midi d'Ossau, Aneto, Canigó.
    crests: [[[-1.55, 43.05], [-0.44, 42.84], [0.2, 42.72], [0.66, 42.63], [1.5, 42.58], [2.46, 42.52], [2.9, 42.45]]],
  },
  {
    id: "cantabrian",
    naturalEarth: "Cantabrian Mountains",
    kind: "rocky",
    // Picos de Europa (Torre Cerredo).
    crests: [[[-6.9, 42.95], [-5.9, 43.05], [-4.85, 43.2], [-4.1, 43.05], [-3.3, 43.1]]],
  },
  {
    id: "apennines",
    naturalEarth: "Appennino Ligure",
    kind: "rocky",
    // Northern Apennines to Monte Cimone and Gran Sasso.
    crests: [[[9.0, 44.55], [9.8, 44.45], [10.7, 44.19], [11.6, 43.9], [12.4, 43.5], [13.0, 43.0], [13.57, 42.47], [14.1, 42.0], [15.0, 41.4]]],
  },
  {
    id: "dinaric",
    naturalEarth: "Dinaric Alps",
    kind: "rocky",
    crests: [[[14.5, 45.6], [15.3, 44.9], [16.2, 44.1], [17.3, 43.5], [18.4, 42.9]]],
  },
  {
    id: "massif-central",
    naturalEarth: "Massif Central",
    kind: "hills",
    crests: [
      // Chaîne des Puys, Puy de Sancy, Plomb du Cantal, Aubrac, Mont Lozère, Mont Aigoual.
      [[2.97, 45.77], [2.81, 45.53], [2.76, 45.06], [3.1, 44.7], [3.74, 44.43], [3.58, 44.12]],
      // Monts du Forez and the Vivarais.
      [[3.8, 45.7], [4.25, 45.25], [4.3, 44.9]],
    ],
  },
  {
    id: "vosges",
    naturalEarth: "Vosges Mountains",
    kind: "hills",
    // Down to the Grand Ballon.
    crests: [[[7.3, 48.7], [7.1, 48.25], [7.1, 47.9], [6.85, 47.82]]],
  },
  {
    id: "jura",
    naturalEarth: "Jura Mountains",
    kind: "hills",
    // From the Crêt de la Neige north-east.
    crests: [[[5.94, 46.27], [6.25, 46.6], [6.7, 46.9], [7.15, 47.2], [7.7, 47.4]]],
  },
  {
    id: "black-forest",
    naturalEarth: null,
    kind: "hills",
    // Feldberg to Hornisgrinde.
    crests: [[[8.01, 47.88], [8.1, 48.25], [8.2, 48.61]]],
  },
  {
    id: "swabian-jura",
    naturalEarth: null,
    kind: "hills",
    crests: [[[8.75, 48.12], [9.35, 48.3], [10.1, 48.62]]],
  },
  {
    id: "harz",
    naturalEarth: "Harz",
    kind: "hills",
    // Around the Brocken.
    crests: [[[10.35, 51.8], [10.62, 51.8], [10.95, 51.68]]],
  },
  {
    id: "ore",
    naturalEarth: "Ore Mountains",
    kind: "hills",
    // Fichtelberg.
    crests: [[[12.3, 50.33], [12.96, 50.43], [13.5, 50.65], [13.95, 50.8]]],
  },
  {
    id: "bohemian-forest",
    naturalEarth: "Böhmerwald",
    kind: "hills",
    // Großer Arber.
    crests: [[[12.55, 49.7], [13.13, 49.11], [13.8, 48.77]]],
  },
  {
    id: "sudetes",
    naturalEarth: "Sudetes",
    kind: "hills",
    // Sněžka.
    crests: [[[15.0, 50.85], [15.74, 50.74], [16.4, 50.4], [17.1, 50.2]]],
  },
  {
    id: "grampians",
    // Natural Earth's Scottish polygon ("Cruach nam Miseag") is a thin strip along
    // the Highland edge, so this range is anchored on its summits instead.
    naturalEarth: null,
    kind: "rocky",
    // Ben Nevis to the Cairngorms.
    crests: [[[-5.0, 56.8], [-4.3, 56.9], [-3.64, 57.12], [-3.1, 56.95]]],
  },
  {
    id: "cambrian",
    naturalEarth: "Cambrian Mountains",
    kind: "hills",
    // Snowdon southwards.
    crests: [[[-4.08, 53.07], [-3.85, 52.6], [-3.75, 52.25], [-3.6, 51.9]]],
  },
];

/**
 * Named forests: independent reference points (each article's coordinate), not
 * drawn. Forests are painted from ESA WorldCover tree cover; the tests check
 * that the painted forest shows at each of these places.
 */
export const FORESTS: readonly Forest[] = [
  { id: "landes", country: "FRA", center: [-0.58, 44.18] },
  { id: "compiegne", country: "FRA", center: [2.88, 49.38] },
  { id: "morvan", country: "FRA", center: [4.0, 47.08] },
  { id: "vosges", country: "FRA", center: [7.0, 48.0] },
  { id: "black-forest", country: "DEU", center: [8.05, 48.25] },
  { id: "palatinate", country: "DEU", center: [7.88, 49.29] },
  { id: "odenwald", country: "DEU", center: [9.02, 49.58] },
  { id: "spessart", country: "DEU", center: [9.43, 49.9] },
  { id: "rothaar", country: "DEU", center: [8.25, 51.08] },
  { id: "teutoburg", country: "DEU", center: [8.82, 51.9] },
  { id: "solling", country: "DEU", center: [9.6, 51.73] },
  { id: "harz", country: "DEU", center: [10.63, 51.75] },
  { id: "thuringian", country: "DEU", center: [10.75, 50.67] },
  { id: "bavarian", country: "DEU", center: [12.67, 49.0] },
  { id: "schorfheide", country: "DEU", center: [13.82, 52.97] },
  { id: "tuchola", country: "POL", center: [18.0, 53.6] },
  { id: "new-forest", country: "GBR", center: [-1.62, 50.86] },
  { id: "thetford", country: "GBR", center: [0.65, 52.46] },
  { id: "kielder", country: "GBR", center: [-2.53, 55.21] },
  { id: "galloway", country: "GBR", center: [-4.42, 55.12] },
];

/** A few wave marks in open water, well away from coasts. */
export const WAVES: readonly { sea: string; at: LonLat }[] = [
  { sea: "Bay of Biscay", at: [-4.0, 45.3] },
  { sea: "Atlantic, off Brittany", at: [-7.0, 47.8] },
  { sea: "Celtic Sea", at: [-7.5, 50.3] },
  { sea: "Atlantic, west of Ireland", at: [-11.0, 53.0] },
  { sea: "Irish Sea", at: [-5.4, 53.6] },
  { sea: "North Sea", at: [3.0, 55.0] },
  { sea: "North Sea (south)", at: [3.2, 53.6] },
  { sea: "Skagerrak", at: [9.5, 57.8] },
  { sea: "Baltic Sea", at: [16.5, 55.6] },
  { sea: "Balearic Sea", at: [3.2, 41.2] },
  { sea: "Gulf of Lion", at: [4.2, 42.6] },
  { sea: "Ligurian Sea", at: [8.4, 43.6] },
  { sea: "Tyrrhenian Sea", at: [11.5, 41.4] },
  { sea: "Adriatic Sea", at: [14.5, 43.4] },
];

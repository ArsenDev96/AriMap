/**
 * The levels the app plays from Discover to Results. The lesson screens are the same for every level; the others
 * still show their map and countries until each has been checked on phones (its map data, its landmarks' pictures,
 * its travel options). Their progress, unlocks and stars are the website's rules either way.
 */
const NATIVE_PLAYABLE: ReadonlySet<string> = new Set([
  "western-europe-1",
  "around-the-alps",
  "central-europe",
  "along-the-adriatic",
  "towards-greece",
  "baltic-journey",
  "iberian-journey",
  "eastern-europe",
]);

export const isPlayableInApp = (levelId: string) => NATIVE_PLAYABLE.has(levelId);

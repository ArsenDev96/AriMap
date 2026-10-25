import { useEffect, useState } from "react";
import { challengeMapFrom, type ChallengeMapData } from "@/geo/challengeMap";

let built: ChallengeMapData | null = null;

/**
 * The Quick Challenge's map of Europe (src/geo/challengeMap.ts, shared with the website), from its own data file,
 * bundled with the app and read the first time the challenge opens (an inline require runs then), then kept while the
 * app runs. Null until ready: projecting it takes a moment, so it runs after the screen has appeared.
 */
export function useChallengeMap(): ChallengeMapData | null {
  const [map, setMap] = useState<ChallengeMapData | null>(built);
  useEffect(() => {
    if (map) return;
    let current = true;
    const timer = setTimeout(() => {
      built ??= challengeMapFrom(require("@/data/geo/europe-challenge.topo.json"));
      if (current) setMap(built);
    }, 0);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [map]);
  return map;
}

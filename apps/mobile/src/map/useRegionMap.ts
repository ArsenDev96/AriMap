import { useEffect, useState } from "react";
import type { LessonDefinition } from "@/core/lessons/types";
import { isMapDataLoaded, loadMapData, regionMapFor, setMapData, type LoadedDataset, type RegionMap } from "@/geo/regionMap";

/**
 * The map data of the levels drawn from data of their own (Levels 10–12), bundled with the app and read only when
 * such a level opens (an inline require runs then). The website loads them with import() (regionMap.ts's
 * loadMapData); Metro's development server can't serve a file outside apps/mobile that way, so the app hands them
 * over itself, the same in development and in release.
 */
const MAP_DATA: Readonly<Record<LoadedDataset, () => unknown>> = {
  north: () => require("@/data/geo/europe-north.topo.json"),
  channel: () => require("@/data/geo/europe-channel.topo.json"),
  east: () => require("@/data/geo/europe-east.topo.json"),
};

/**
 * A level's map (src/geo/regionMap.ts, shared with the website): its countries projected as SVG paths in the levels'
 * shared "world" coordinates, with its focus and coverage. A level drawn from data of its own (Levels 10–12) loads it
 * first. Null until ready: projecting the data takes a moment the first time, so it runs after the screen has
 * appeared rather than delaying it.
 */
export function useRegionMap(lesson: LessonDefinition | undefined): RegionMap | null {
  const [map, setMap] = useState<{ lesson: LessonDefinition; map: RegionMap } | null>(null);
  useEffect(() => {
    if (!lesson) return;
    let current = true;
    const timer = setTimeout(() => {
      const dataset = lesson.map.dataset;
      if (dataset && !isMapDataLoaded(dataset)) setMapData(dataset, MAP_DATA[dataset]());
      loadMapData(dataset).then(() => current && setMap({ lesson, map: regionMapFor(lesson) }));
    }, 0);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [lesson]);
  return map && map.lesson === lesson ? map.map : null;
}

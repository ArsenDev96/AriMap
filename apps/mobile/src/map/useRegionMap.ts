import { useEffect, useState } from "react";
import type { LessonDefinition } from "@/core/lessons/types";
import { loadMapData, regionMapFor, type RegionMap } from "@/geo/regionMap";

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
      loadMapData(lesson.map.dataset).then(() => current && setMap({ lesson, map: regionMapFor(lesson) }));
    }, 0);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [lesson]);
  return map && map.lesson === lesson ? map.map : null;
}

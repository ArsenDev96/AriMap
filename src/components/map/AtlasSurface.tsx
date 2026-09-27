"use client";

import { memo, useId, useMemo } from "react";
import type { RegionMap } from "@/geo/regionMap";
import landTexture from "@/assets/map/land-texture.webp";
import seaTexture from "@/assets/map/sea-texture.webp";
import styles from "./RegionMap.module.css";

/**
 * Tile sizes in world units. The textures are painted in world coordinates, so
 * they stay anchored to the map while zooming and panning (and grow with it,
 * like paint on the land). At a 390px phone map one land tile is about 180px.
 */
const LAND_TILE = 520;
const SEA_TILE = 640;

/**
 * Decorative surface texture for the illustrated (Discover) map: soft tonal
 * variation on the water, drawn under the land. Purely colour, never data.
 */
export const SeaTexture = memo(function SeaTexture({ map }: { map: RegionMap }) {
  const id = useId().replace(/:/g, "");
  const [[x0, y0], [x1, y1]] = map.coverage;
  return (
    <g aria-hidden="true" className={styles.surface}>
      <defs>
        <pattern id={`${id}-sea`} patternUnits="userSpaceOnUse" width={SEA_TILE} height={SEA_TILE}>
          <image href={seaTexture.src} width={SEA_TILE} height={SEA_TILE} preserveAspectRatio="none" />
        </pattern>
      </defs>
      <rect x={x0 - 400} y={y0 - 400} width={x1 - x0 + 800} height={y1 - y0 + 800} fill={`url(#${id}-sea)`} />
    </g>
  );
});

/**
 * Soft, irregular tonal variation on the land, over the country fills and
 * under scenery and borders. Over a selected (dark) country it is lighter, so
 * the selection colour stays clean.
 */
export const LandTexture = memo(function LandTexture({ map, darkKey }: { map: RegionMap; darkKey: string }) {
  const id = useId().replace(/:/g, "");
  const { light, selected } = useMemo(() => {
    const set = new Set(darkKey ? darkKey.split(",") : []);
    return {
      light: map.shapes.filter((s) => !set.has(s.id)).map((s) => s.d).join(""),
      selected: map.shapes.filter((s) => set.has(s.id)).map((s) => s.d).join(""),
    };
  }, [map, darkKey]);
  return (
    <g aria-hidden="true" className={styles.surface}>
      <defs>
        <pattern id={`${id}-land`} patternUnits="userSpaceOnUse" width={LAND_TILE} height={LAND_TILE}>
          <image href={landTexture.src} width={LAND_TILE} height={LAND_TILE} preserveAspectRatio="none" />
        </pattern>
      </defs>
      <path d={light} fill={`url(#${id}-land)`} />
      {selected && <path d={selected} fill={`url(#${id}-land)`} className={styles.surfaceOnDark} />}
    </g>
  );
});

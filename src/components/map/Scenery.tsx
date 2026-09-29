"use client";

import { memo, useId, useMemo, type CSSProperties } from "react";
import type { Point, RegionMap, Transform } from "@/geo/regionMap";
import { WAVES } from "@/geo/terrain";
import { ART, type ArtLayer } from "./sceneryArt";
import styles from "./Scenery.module.css";

/** Screen-space rectangle. */
export interface SceneryBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Wave marks keep at least this far apart on screen, so small maps get fewer. */
const WAVE_SPACING = { px: 90, compactPx: 110 };

interface Props {
  map: RegionMap;
  transform: Transform;
  viewport: { width: number; height: number };
  /** Screen areas kept clear: names, callouts, leader lines, markers, Luxembourg and map controls. */
  avoid: SceneryBox[];
  compact: boolean;
  /** Drawn in the gesture copy of the map (see RegionMap): the same marks, without the attributes that identify them. */
  copy?: boolean;
}

const overlaps = (a: SceneryBox, b: SceneryBox) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Draws one piece of artwork's layers with the module's classes. */
function ArtLayers({ layers }: { layers: readonly ArtLayer[] }) {
  return (
    <>
      {layers.map((l, i) => {
        const className = styles[l.cls];
        if ("d" in l) return <path key={i} className={className} d={l.d} />;
        if ("circles" in l) return <g key={i}>{l.circles.map(([cx, cy, r], j) => <circle key={j} className={className} cx={cx} cy={cy} r={r} />)}</g>;
        const [cx, cy, rx, ry] = l.ellipse;
        return <ellipse key={i} className={className} cx={cx} cy={cy} rx={rx} ry={ry} />;
      })}
    </>
  );
}

/**
 * Discover's wave marks: a few at named open-sea points, drawn over the water
 * and clipped to it. (Mountains and forests are painted into the landscape,
 * see Relief.tsx.) They are anchored in world coordinates and keep a constant
 * size on screen, never cover a name, marker or map control (such marks are
 * simply left out), and never take pointer events.
 */
export const Scenery = memo(function Scenery({ map, transform, viewport, avoid, compact, copy = false }: Props) {
  const id = useId().replace(/:/g, "");
  const { k, x, y } = transform;

  // A few wave marks, in list order, each well apart from the others on screen.
  const waves: { key: string; at: Point; flip: boolean; sx: number; sy: number }[] = [];
  const waveGap = compact ? WAVE_SPACING.compactPx : WAVE_SPACING.px;
  WAVES.forEach((w, i) => {
    const at = map.project(w.at);
    const sx = at[0] * k + x;
    const sy = at[1] * k + y;
    const f = ART.wave.box;
    const box = { x0: sx + f.x0, y0: sy + f.y0, x1: sx + f.x1, y1: sy + f.y1 };
    if (box.x1 < 0 || box.y1 < 0 || box.x0 > viewport.width || box.y0 > viewport.height) return;
    if (avoid.some((a) => overlaps(a, box)) || waves.some((o) => Math.hypot(o.sx - sx, o.sy - sy) < waveGap)) return;
    waves.push({ key: `w:${i}`, at, flip: i % 2 === 1, sx, sy });
  });

  const seaPath = useMemo(() => {
    const [[x0, y0], [x1, y1]] = map.coverage;
    return `M${x0 - 500},${y0 - 500}H${x1 + 500}V${y1 + 500}H${x0 - 500}Z${map.shapes.map((s) => s.d).join("")}`;
  }, [map]);

  return (
    <g className={styles.scenery} style={{ "--inv": 1 / k } as CSSProperties} aria-hidden="true" data-scenery={copy ? undefined : ""}>
      <defs>
        <clipPath id={`${id}-sea`}>
          <path d={seaPath} clipRule="evenodd" />
        </clipPath>
        <g id={`${id}-wave`}>
          <ArtLayers layers={ART.wave.layers} />
        </g>
      </defs>
      <g clipPath={`url(#${id}-sea)`}>
        {waves.map((w) => (
          <g key={w.key} transform={`translate(${w.at[0]},${w.at[1]})`} data-sym={copy ? undefined : "wave"} data-key={copy ? undefined : w.key}>
            <use href={`#${id}-wave`} className={styles.symbol} style={{ "--sx": w.flip ? -1 : 1, "--sy": 1 } as CSSProperties} />
          </g>
        ))}
      </g>
    </g>
  );
});

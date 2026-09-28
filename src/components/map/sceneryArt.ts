/**
 * Artwork for the Discover scenery (wave marks), as plain drawing data: paths
 * in px around each symbol's anchor. Scenery.tsx turns it into reusable SVG
 * symbols; colours come from CSS classes (Scenery.module.css). Mountains and
 * forests are painted into the landscape instead (Relief.tsx).
 */

export type ArtLayer =
  | { cls: ArtClass; d: string }
  | { cls: ArtClass; circles: readonly (readonly [number, number, number])[] }
  | { cls: ArtClass; ellipse: readonly [number, number, number, number] };

export type ArtClass = "wave" | "waveSoft";

export interface Art {
  layers: readonly ArtLayer[];
  /** Footprint in px around the anchor, used for spacing and clearance. */
  box: { x0: number; y0: number; x1: number; y1: number };
}

export type ArtId = "wave";

export const ART: Record<ArtId, Art> = {
  wave: {
    layers: [
      { cls: "wave", d: "M-9,0Q-6.75,-3 -4.5,0T0,0 4.5,0 9,0" },
      { cls: "waveSoft", d: "M-5,1.4Q-3.5,-0.4 -2,1.4" },
    ],
    box: { x0: -9, y0: -3.5, x1: 9, y1: 1.5 },
  },
};

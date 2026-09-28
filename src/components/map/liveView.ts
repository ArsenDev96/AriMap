import type { Transform } from "@/geo/regionMap";

/**
 * Dragging and zooming move the drawn map as one layer, which the browser
 * shifts and scales without drawing it again. The map is drawn again for the
 * new view once it settles (see RegionMap).
 */

/** Magnification of the layer during a gesture beyond which it is drawn again, so it never looks soft for long. */
export const MAX_LAYER_SCALE = 2;

/** The live view during a gesture, updated at most once per frame; only the names and markers re-render for it. */
export interface LiveView {
  get: () => Transform;
  set: (view: Transform) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createLiveView(initial: Transform): LiveView {
  let view = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => view,
    set(next) {
      if (next === view) return;
      view = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * How a layer drawn for view `drawn`, extending `margin` px past each edge of
 * the viewport, moves to show view `live`: scale `s` and shift (`dx`, `dy`) in
 * screen px, about the viewport's top-left corner. `covers` is false when, so
 * moved, it would leave part of the viewport uncovered or be magnified past
 * MAX_LAYER_SCALE: the map must then be drawn for the live view.
 */
export function layerMove(
  drawn: Transform,
  live: Transform,
  viewport: { width: number; height: number },
  margin: { x: number; y: number },
): { s: number; dx: number; dy: number; covers: boolean } {
  const s = live.k / drawn.k;
  const dx = live.x - drawn.x * s;
  const dy = live.y - drawn.y * s;
  const covers =
    s <= MAX_LAYER_SCALE &&
    dx - margin.x * s <= 0 &&
    dy - margin.y * s <= 0 &&
    dx + (viewport.width + margin.x) * s >= viewport.width &&
    dy + (viewport.height + margin.y) * s >= viewport.height;
  return { s, dx, dy, covers };
}

/**
 * Applies layerMove to the drawn layer, as a CSS transform the compositor
 * applies without drawing the map again. Returns whether it still covers the view.
 */
export function placeLayer(
  layer: SVGSVGElement | null,
  drawn: Transform,
  live: Transform,
  viewport: { width: number; height: number },
  margin: { x: number; y: number },
): boolean {
  const { s, dx, dy, covers } = layerMove(drawn, live, viewport, margin);
  if (layer) layer.style.transform = s === 1 && dx === 0 && dy === 0 ? "" : `translate(${dx}px,${dy}px) scale(${s})`;
  return covers;
}

import { insideOutlineOf } from "@/geo/hitTest";
import type { CountryShape, Point } from "@/geo/regionMap";

let context: CanvasRenderingContext2D | null | undefined;
const pathCache = new Map<string, Path2D>();

/**
 * Whether a projected world point lies inside the shape: answered from its straight edges (src/geo/hitTest.ts,
 * shared with the app), or on a canvas for an outline that isn't only straight lines.
 */
export function insideShape(shape: CountryShape, point: Point): boolean {
  const inside = insideOutlineOf(shape, point);
  if (inside !== null) return inside;
  // Not only straight lines: hit-tested on a canvas.
  if (context === undefined) context = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  if (!context || typeof Path2D === "undefined") return true;
  let path = pathCache.get(shape.d);
  if (!path) {
    path = new Path2D(shape.d);
    pathCache.set(shape.d, path);
  }
  return context.isPointInPath(path, point[0], point[1]);
}

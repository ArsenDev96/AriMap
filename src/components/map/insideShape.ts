import type { CountryShape, Point } from "@/geo/regionMap";

let context: CanvasRenderingContext2D | null | undefined;
const pathCache = new Map<string, Path2D>();

/** Whether a projected world point lies inside the shape (hit-tested on a canvas). */
export function insideShape(shape: CountryShape, [x, y]: Point): boolean {
  if (context === undefined) context = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  if (!context || typeof Path2D === "undefined") return true;
  let path = pathCache.get(shape.d);
  if (!path) {
    path = new Path2D(shape.d);
    pathCache.set(shape.d, path);
  }
  return context.isPointInPath(path, x, y);
}

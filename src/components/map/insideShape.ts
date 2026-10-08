import type { CountryShape, Point } from "@/geo/regionMap";

let context: CanvasRenderingContext2D | null | undefined;
const pathCache = new Map<string, Path2D>();

/**
 * A country's outline as straight edges, for answering "is this point inside" without the canvas: label
 * placement asks thousands of times per layout, and canvas hit tests on full outlines were most of its
 * time. Edges are listed by horizontal band, so a question only looks at the edges crossing its band.
 */
interface Outline {
  /** x0, y0, x1, y1 of every edge, rings closed as a fill closes them. */
  edges: Float32Array;
  top: number;
  bottom: number;
  bandHeight: number;
  /** Edges (by index) crossing each band. */
  bands: Uint32Array[];
}

/** Outlines by path, or null for a path that isn't only straight lines (asked on the canvas instead). */
const outlineCache = new Map<string, Outline | null>();

/** Path commands of a country's outline (d3-geo writes polygons as M, L and Z only). */
const COMMAND = /([MLHVZmlhvz])([^MLHVZmlhvz]*)/g;
const NUMBER = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;

function outlineOf(d: string): Outline | null {
  // Coordinates are kept as 32-bit floats, as the browser keeps a path's, so the answers match its own.
  const coords: number[] = [];
  let [x, y, startX, startY] = [0, 0, 0, 0];
  let open = false;
  const close = () => {
    if (open && (x !== startX || y !== startY)) coords.push(x, y, startX, startY);
    [x, y] = [startX, startY];
    open = false;
  };
  const lineTo = (nx: number, ny: number) => {
    const [fx, fy] = [Math.fround(nx), Math.fround(ny)];
    coords.push(x, y, fx, fy);
    [x, y] = [fx, fy];
  };
  // Anything but the letters handled here (curves, arcs) is left to the canvas.
  if (/[^MLHVZmlhvz\d\s,.eE+-]/.test(d)) return null;
  for (const [, command, args] of d.matchAll(COMMAND)) {
    const n = (args.match(NUMBER) ?? []).map(Number);
    const relative = command === command.toLowerCase();
    switch (command.toUpperCase()) {
      case "M":
        if (n.length < 2 || n.length % 2) return null;
        close();
        [x, y] = [Math.fround(relative ? x + n[0] : n[0]), Math.fround(relative ? y + n[1] : n[1])];
        [startX, startY] = [x, y];
        open = true;
        // Further pairs after a move are lines.
        for (let i = 2; i < n.length; i += 2) lineTo(relative ? x + n[i] : n[i], relative ? y + n[i + 1] : n[i + 1]);
        break;
      case "L":
        if (n.length === 0 || n.length % 2) return null;
        for (let i = 0; i < n.length; i += 2) lineTo(relative ? x + n[i] : n[i], relative ? y + n[i + 1] : n[i + 1]);
        break;
      case "H":
        if (n.length === 0) return null;
        for (const v of n) lineTo(relative ? x + v : v, y);
        break;
      case "V":
        if (n.length === 0) return null;
        for (const v of n) lineTo(x, relative ? y + v : v);
        break;
      case "Z":
        if (n.length) return null;
        close();
        // A line after Z starts from the ring's start; a fill closes that subpath too.
        open = true;
        break;
    }
  }
  close();
  const edges = new Float32Array(coords);
  const count = edges.length / 4;
  let [top, bottom] = [Infinity, -Infinity];
  for (let i = 0; i < count; i++) {
    top = Math.min(top, edges[4 * i + 1], edges[4 * i + 3]);
    bottom = Math.max(bottom, edges[4 * i + 1], edges[4 * i + 3]);
  }
  const bandCount = Math.max(1, Math.min(512, Math.ceil(count / 8)));
  const bandHeight = (bottom - top) / bandCount || 1;
  const lists: number[][] = Array.from({ length: bandCount }, () => []);
  const band = (v: number) => Math.min(bandCount - 1, Math.max(0, Math.floor((v - top) / bandHeight)));
  for (let i = 0; i < count; i++) {
    const [a, b] = [edges[4 * i + 1], edges[4 * i + 3]];
    for (let k = band(Math.min(a, b)); k <= band(Math.max(a, b)); k++) lists[k].push(i);
  }
  return { edges, top, bottom, bandHeight, bands: lists.map((l) => Uint32Array.from(l)) };
}

/**
 * Non-zero winding, as the canvas fills and hit-tests a path by default: holes (lakes, enclaves) wind the
 * other way and islands add their own rings. A point on an edge counts as inside, as on the canvas.
 */
function insideOutline(o: Outline, px: number, py: number): boolean {
  // Above or below every edge.
  if (py < o.top || py > o.bottom) return false;
  const list = o.bands[Math.min(o.bands.length - 1, Math.max(0, Math.floor((py - o.top) / o.bandHeight)))];
  const e = o.edges;
  let winding = 0;
  for (let j = 0; j < list.length; j++) {
    const i = 4 * list[j];
    const [x0, y0, x1, y1] = [e[i], e[i + 1], e[i + 2], e[i + 3]];
    if (py < Math.min(y0, y1) || py > Math.max(y0, y1)) continue;
    const cross = (x1 - x0) * (py - y0) - (px - x0) * (y1 - y0);
    // On the edge itself.
    if (cross === 0 && px >= Math.min(x0, x1) && px <= Math.max(x0, x1)) return true;
    // Each edge counts once where it crosses the point's row: upward edges left of the point add one,
    // downward edges subtract one (half-open in y, so a vertex on the row is counted once).
    if (y0 <= py) {
      if (y1 > py && cross > 0) winding++;
    } else if (y1 <= py && cross < 0) winding--;
  }
  return winding !== 0;
}

/** Whether a projected world point lies inside the shape. */
export function insideShape(shape: CountryShape, [x, y]: Point): boolean {
  // Outside the shape's bounds it can't be inside: skips the costly hit test on the full outline.
  const [[x0, y0], [x1, y1]] = shape.bounds;
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  let outline = outlineCache.get(shape.d);
  if (outline === undefined) {
    outline = outlineOf(shape.d);
    outlineCache.set(shape.d, outline);
  }
  if (outline) return insideOutline(outline, Math.fround(x), Math.fround(y));
  // Not only straight lines: hit-tested on a canvas.
  if (context === undefined) context = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  if (!context || typeof Path2D === "undefined") return true;
  let path = pathCache.get(shape.d);
  if (!path) {
    path = new Path2D(shape.d);
    pathCache.set(shape.d, path);
  }
  return context.isPointInPath(path, x, y);
}

/**
 * TEMPORARY phone-lag diagnostics: remove once the lag is found. Read once from the page's URL and
 * never saved; without these parameters everything is as usual.
 *
 * - relief=off: the map's relief (overview images, zoomed tiles and their shading) is never drawn: not
 *   on the map, the close-up or the gesture copy, so none of it is fetched, decoded or clipped.
 * - labels=off: country names, callouts and capital and landmark names are neither placed nor drawn.
 *   Markers, the route and the hint circle stay.
 * - hud=1: a small panel with frame times, long tasks, label-placement time and relief images.
 * - freeze=1: the save is read but never written, so every run starts from the same state (and the
 *   player's real progress and stars stay as they were).
 */
export interface Diagnostics {
  relief: boolean;
  labels: boolean;
  hud: boolean;
  freeze: boolean;
}

const OFF: Diagnostics = { relief: true, labels: true, hud: false, freeze: false };
let current: Diagnostics | null = null;

export function diagnostics(): Diagnostics {
  if (current) return current;
  if (typeof window === "undefined") return OFF;
  const query = new URLSearchParams(window.location.search);
  current = {
    relief: query.get("relief") !== "off",
    labels: query.get("labels") !== "off",
    hud: query.get("hud") === "1",
    freeze: query.get("freeze") === "1",
  };
  // For automated measurements, which read the same figures as the HUD.
  if (current.hud) (window as Window & { __arimapDiagnostics?: unknown }).__arimapDiagnostics = { flags: current, timings: diagnosticTimings };
  return current;
}

/** Time spent placing the map's names (layoutOverlay) and keeping them in view during a gesture (keepInView). */
export interface Timing {
  runs: number;
  totalMs: number;
  maxMs: number;
  lastMs: number;
  /** End times (performance.now) and durations of recent runs, for the HUD's recent window. */
  recent: [number, number][];
}

const timing = (): Timing => ({ runs: 0, totalMs: 0, maxMs: 0, lastMs: 0, recent: [] });
export const diagnosticTimings = { placement: timing(), follow: timing() };

/** Runs `task`, timing it when the HUD is on. */
export function timed<T>(which: keyof typeof diagnosticTimings, task: () => T): T {
  if (!diagnostics().hud) return task();
  const started = performance.now();
  const result = task();
  const ended = performance.now();
  const t = diagnosticTimings[which];
  const ms = ended - started;
  t.runs++;
  t.totalMs += ms;
  t.maxMs = Math.max(t.maxMs, ms);
  t.lastMs = ms;
  t.recent.push([ended, ms]);
  if (t.recent.length > 2000) t.recent.splice(0, 1000);
  return result;
}

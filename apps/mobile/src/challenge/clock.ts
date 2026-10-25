/**
 * The Quick Challenge's clock in the app: the time since the round started, in milliseconds, for the shared rules
 * (src/core/challenge/quickChallenge.ts), which take any clock that never runs backwards. The round starts at 0 on it,
 * so its deadline is the round's duration.
 *
 * Two sources: a monotonic clock (`performance.now`: changing the date or time zone moves it not at all) and the wall
 * clock (`Date.now`, which keeps running while the phone sleeps, when a monotonic clock may stop). Each reading adds
 * the larger of the two clocks' advances since the last (a clock set back advances by nothing). So no time is gained
 * by putting the app in the background, letting the phone sleep or setting its clock back, or by doing these one after
 * the other; setting it forward only costs the player. The anchor saved with a round (its time, and the wall clock
 * then) lets a round opened after the app was closed add the wall clock's advance since, never less than nothing.
 * Pure apart from the sources passed in, so it is tested with clocks the test moves.
 */

export interface ClockSources {
  /** Milliseconds on a clock that never runs backwards (performance.now). */
  mono: () => number;
  /** Milliseconds on the wall clock (Date.now). */
  wall: () => number;
}

/** What a saved round keeps of its clock: its time (ms since the round started), and the wall clock's then. */
export interface ClockAnchor {
  elapsed: number;
  wallAt: number;
}

export interface RoundClock {
  /** The time since the round started (ms): never less than at the last reading. */
  now(): number;
  /** The anchor to save with the round: a reading now. */
  anchor(): ClockAnchor;
}

export const systemClock: ClockSources = {
  mono: () => performance.now(),
  wall: () => Date.now(),
};

/** A clock for a round starting now (0), or carrying on from a saved anchor (the wall clock's advance since added). */
export function roundClock(sources: ClockSources, saved?: ClockAnchor): RoundClock {
  let lastMono = sources.mono();
  let lastWall = sources.wall();
  let elapsed = saved ? saved.elapsed + Math.max(0, lastWall - saved.wallAt) : 0;
  const now = () => {
    const [mono, wall] = [sources.mono(), sources.wall()];
    elapsed += Math.max(0, mono - lastMono, wall - lastWall);
    [lastMono, lastWall] = [mono, wall];
    return elapsed;
  };
  return { now, anchor: () => ({ elapsed: now(), wallAt: lastWall }) };
}

/** Whether a saved anchor is one this clock can carry on from. */
export function isClockAnchor(value: unknown): value is ClockAnchor {
  const a = value as ClockAnchor | null;
  return !!a && Number.isFinite(a.elapsed) && Number.isFinite(a.wallAt) && a.elapsed >= 0;
}

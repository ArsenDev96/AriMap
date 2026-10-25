/**
 * How long (ms) after a gameplay press another is ignored. A press changes what is under the finger (Next replaces
 * the answer's buttons, a move replaces the neighbour cards): a quick double tap must not land a second, different
 * answer or move. The game's own rules already ignore a repeated action (an answered question, a country already on
 * the route); this keeps a second tap from becoming a new one.
 */
export const PRESS_GAP_MS = 400;

/** Whether a press at `now` goes through after the last one that did, at `last` (null: none yet). */
export function acceptPress(last: number | null, now: number, gap = PRESS_GAP_MS): boolean {
  return last === null || now - last >= gap || now < last;
}

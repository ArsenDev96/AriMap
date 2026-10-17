import { isServerTime, parseServerRound, type RequestTiming, type ServerRound, type ServerTime } from "../challenge/serverRound";
import { attemptsLeft, isAttemptGrantKind, type AttemptGrant } from "./attempts";
import type { DisplayNameProblem } from "./displayName";
import type { EuropeStarsSnapshot } from "../progress/europeStars";

/**
 * The player service: what the app asks the server about the player, the same for the web and a future
 * native app. Each platform supplies its own implementation (the web's: src/web/backend.ts); the
 * server's route handlers (src/app/api/player) answer with these shapes.
 *
 * The player is anonymous: an id from a verified sign-in session, never chosen by the device. A display
 * name is a label, not an identity.
 *
 * Framework-independent: no React, DOM, storage or network.
 */

export interface PlayerState {
  playerId: string;
  /** Null until the player saves one: their results stay private until then. */
  displayName: string | null;
  grants: readonly AttemptGrant[];
  /** Rounds started: each spent one attempt. */
  roundsStarted: number;
  attemptsLeft: number;
  /** The Quick Challenge round under way, if any (it resumes after a refresh, or in another tab). */
  activeRound: ServerRound | null;
  /** The best finished round: most correct answers, then the shortest time. Private until a name is saved. */
  best: { score: number; elapsedMs: number } | null;
  /** The server's times for this request (on the database's clock), to place an active round's deadline on the device's clock. */
  serverTime: ServerTime;
  /**
   * When the server accepted the device's report of all 36 Europe stars (ISO 8601), or null. The stars'
   * own dates are unknown (saved progress records none), so this is a claim date, not when they were earned.
   */
  europeStarsClaimedAt: string | null;
  /** Until when a name can not be changed again (ISO 8601), or null when it can be now. */
  nameChangeBlockedUntil: string | null;
}

export type SetDisplayNameResult =
  | { ok: true; state: PlayerState }
  | { ok: false; problem: DisplayNameProblem }
  | { ok: false; problem: "rateLimited"; retryAt: string };

export type ClaimEuropeStarsResult =
  /** `granted` is false when the reward had already been granted: never twice. */
  | { ok: true; granted: boolean; state: PlayerState }
  /** The snapshot did not have every star of the 12 lessons. */
  | { ok: false; problem: "notQualified" };

export type PlayerServiceErrorCode =
  /** This build or server has no backend configured: the game works as before, without player features. */
  | "notConfigured"
  /** The server could not be reached. */
  | "network"
  /** The session was missing or could not be verified. */
  | "unauthorized"
  /** The request was not one the server accepts (a fault in the app, not the player's). */
  | "badRequest"
  /** The server failed, or answered with something unexpected. */
  | "server";

export class PlayerServiceError extends Error {
  constructor(
    readonly code: PlayerServiceErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = "PlayerServiceError";
  }
}

export interface PlayerService {
  /**
   * The player, signed in anonymously first if there is no session yet (with the one initial attempt). `timing`, if
   * given, is filled in with the device's times for the request answered.
   */
  load(timing?: RequestTiming): Promise<PlayerState>;
  /** Saves the display name, or clears it with null (the player's results become private again). */
  setDisplayName(name: string | null): Promise<SetDisplayNameResult>;
  /** Asks for the one-time +2 attempts with the device's star snapshot. Safe to repeat. */
  claimAllEuropeStars(snapshot: EuropeStarsSnapshot): Promise<ClaimEuropeStarsResult>;
}

// --- Reading the server's answers ----------------------------------------------------------------------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isDate = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));
const isOptionalDate = (v: unknown): v is string | null => v === null || isDate(v);

/** A player state as sent by the server, or null when it is not one. The balance is recomputed, never read. */
export function parsePlayerState(v: unknown): PlayerState | null {
  if (!isObj(v) || typeof v.playerId !== "string" || !Array.isArray(v.grants)) return null;
  if (!(v.displayName === null || typeof v.displayName === "string")) return null;
  if (!Number.isInteger(v.roundsStarted) || (v.roundsStarted as number) < 0) return null;
  if (!isOptionalDate(v.europeStarsClaimedAt) || !isOptionalDate(v.nameChangeBlockedUntil)) return null;
  const grants: AttemptGrant[] = [];
  for (const g of v.grants) {
    if (!isObj(g) || !isAttemptGrantKind(g.kind) || !Number.isInteger(g.attempts) || (g.attempts as number) <= 0 || !isDate(g.grantedAt)) return null;
    grants.push({ kind: g.kind, attempts: g.attempts as number, grantedAt: g.grantedAt });
  }
  const roundsStarted = v.roundsStarted as number;
  const activeRound = v.activeRound === null ? null : parseServerRound(v.activeRound);
  if (v.activeRound !== null && !activeRound) return null;
  const best = v.best;
  if (!(best === null || (isObj(best) && Number.isInteger(best.score) && Number.isInteger(best.elapsedMs)))) return null;
  if (!isServerTime(v.serverTime)) return null;
  return {
    playerId: v.playerId,
    displayName: v.displayName,
    grants,
    roundsStarted,
    attemptsLeft: attemptsLeft(grants, roundsStarted),
    activeRound,
    best: best === null ? null : { score: best.score as number, elapsedMs: best.elapsedMs as number },
    serverTime: { receivedAt: v.serverTime.receivedAt, respondedAt: v.serverTime.respondedAt },
    europeStarsClaimedAt: v.europeStarsClaimedAt,
    nameChangeBlockedUntil: v.nameChangeBlockedUntil,
  };
}

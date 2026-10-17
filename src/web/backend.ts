import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ChallengeService, FinishRoundResult, StartRoundResult, SubmitAnswersResult } from "@/core/challenge/api";
import { parseLeaderboard, type Leaderboard } from "@/core/challenge/leaderboard";
import {
  isServerTime,
  parseReceipt,
  parseServerRound,
  type AnswerReceipt,
  type QueuedAnswer,
  type RequestTiming,
  type ServerRound,
} from "@/core/challenge/serverRound";
import {
  parsePlayerState,
  PlayerServiceError,
  type ClaimEuropeStarsResult,
  type PlayerService,
  type PlayerState,
  type SetDisplayNameResult,
} from "@/core/player/api";
import type { DisplayNameProblem } from "@/core/player/displayName";
import type { EuropeStarsSnapshot } from "@/core/progress/europeStars";

/**
 * The web's backend: the player service (src/core/player/api.ts) and the Quick Challenge's server rounds
 * (src/core/challenge/api.ts), through an anonymous Supabase Auth session in this browser and the app's own server
 * routes (src/app/api), each request carrying the session's access token.
 *
 * - Not configured (no public URL or publishable key in this build): webBackend returns null. Lessons work as
 *   before; the Quick Challenge says it is unavailable. There is no stand-in backend.
 * - One instance per page (one Supabase client), made when first asked for.
 * - The session is kept under its own key (AUTH_STORAGE_KEY), apart from lesson progress ("arimap:state"),
 *   which this never reads or writes.
 * - Signing in happens only when a method is first called, never on page load, and once for all the tabs
 *   open together (withSignInLock).
 * - A refused token is refreshed once; a new anonymous player is only created when there is no session at all.
 *   An outage or a failed refresh is reported as an error, never answered by signing in again.
 */
export const AUTH_STORAGE_KEY = "arimap:auth";

export type Backend = PlayerService & ChallengeService;

/**
 * Whether this build has a backend (its public URL and key, built in): the same on the server and in the browser,
 * so a control that needs one can be shown, or not, without a mismatch between the two.
 */
export const BACKEND_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

let backend: Backend | null | undefined;

export function webBackend(): Backend | null {
  if (typeof window === "undefined") return null;
  if (backend === undefined) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    backend =
      url && publishableKey
        ? new WebBackend(createClient(url, publishableKey, { auth: { storageKey: AUTH_STORAGE_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }))
        : null;
  }
  return backend;
}

class WebBackend implements Backend {
  /** One anonymous sign-in at a time in this tab. */
  private signingIn: Promise<string> | null = null;

  constructor(private readonly supabase: SupabaseClient) {}

  async load(timing?: RequestTiming): Promise<PlayerState> {
    const res = await this.request("GET", "/api/player", undefined, timing);
    if (res.status !== 200) throw await failure(res);
    return readState(await res.json());
  }

  async setDisplayName(name: string | null): Promise<SetDisplayNameResult> {
    const res = await this.request("PUT", "/api/player/display-name", { displayName: name });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (res.status === 200) return { ok: true, state: readState(body?.state) };
    if (res.status === 422 && typeof body?.problem === "string") return { ok: false, problem: body.problem as DisplayNameProblem };
    if (res.status === 429 && typeof body?.retryAt === "string") return { ok: false, problem: "rateLimited", retryAt: body.retryAt };
    throw failureOf(res.status, body);
  }

  async claimAllEuropeStars(snapshot: EuropeStarsSnapshot): Promise<ClaimEuropeStarsResult> {
    const res = await this.request("POST", "/api/player/europe-stars", { snapshot });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (res.status === 200 && typeof body?.granted === "boolean") return { ok: true, granted: body.granted, state: readState(body.state) };
    if (res.status === 422) return { ok: false, problem: "notQualified" };
    throw failureOf(res.status, body);
  }

  async startRound(requestId: string, timing?: RequestTiming): Promise<StartRoundResult> {
    const res = await this.request("POST", "/api/challenge/rounds", { requestId }, timing);
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (res.status === 200 && typeof body?.reused === "boolean" && isServerTime(body.serverTime))
      return { ok: true, round: readRound(body.round), reused: body.reused, state: readState(body.state), serverTime: body.serverTime };
    if (res.status === 409 && body?.problem === "noAttempts") return { ok: false, problem: "noAttempts", state: readState(body.state) };
    throw failureOf(res.status, body);
  }

  async submitAnswers(roundId: string, answers: readonly QueuedAnswer[]): Promise<SubmitAnswersResult> {
    const res = await this.request("POST", `/api/challenge/rounds/${encodeURIComponent(roundId)}/answers`, { answers });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (res.status === 200 && Array.isArray(body?.receipts) && isServerTime(body.serverTime)) {
      const receipts = body.receipts.map(parseReceipt);
      if (receipts.some((r) => r === null)) throw new PlayerServiceError("server", "Unexpected answer receipt");
      return { ok: true, receipts: receipts as AnswerReceipt[], round: readRound(body.round), serverTime: body.serverTime };
    }
    if (res.status === 404 && body?.problem === "notFound") return { ok: false, problem: "notFound" };
    throw failureOf(res.status, body);
  }

  async finishRound(roundId: string): Promise<FinishRoundResult> {
    const res = await this.request("POST", `/api/challenge/rounds/${encodeURIComponent(roundId)}/finish`);
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (res.status === 200 && isServerTime(body?.serverTime)) return { ok: true, round: readRound(body.round), serverTime: body.serverTime };
    if (res.status === 404 && body?.problem === "notFound") return { ok: false, problem: "notFound" };
    throw failureOf(res.status, body);
  }

  async leaderboard(): Promise<Leaderboard> {
    const res = await this.request("GET", "/api/challenge/leaderboard");
    const body: unknown = await res.json().catch(() => null);
    if (res.status !== 200) throw failureOf(res.status, body);
    const board = parseLeaderboard(body);
    if (!board) throw new PlayerServiceError("server", "Unexpected leaderboard");
    return board;
  }

  /**
   * The request with the session's token, refreshed and sent once more if the server refuses it. `timing` ends up
   * with the times of the request whose reply is returned.
   */
  private async request(method: string, path: string, body?: unknown, timing?: RequestTiming): Promise<Response> {
    let res = await this.send(method, path, await this.accessToken(), body, timing);
    if (res.status === 401) {
      const { data, error } = await this.supabase.auth.refreshSession();
      if (error || !data.session) throw new PlayerServiceError("unauthorized", error?.message);
      res = await this.send(method, path, data.session.access_token, body, timing);
    }
    return res;
  }

  /** One fetch, timed (if asked) from just before it, the session already in hand, to its reply. */
  private async send(method: string, path: string, token: string, body?: unknown, timing?: RequestTiming): Promise<Response> {
    if (timing) timing.sentAt = timing.receivedAt = null;
    const init: RequestInit = {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    };
    try {
      const sentAt = timing?.clock();
      const res = await fetch(path, init);
      if (timing && sentAt !== undefined) {
        timing.sentAt = sentAt;
        timing.receivedAt = timing.clock();
      }
      return res;
    } catch (e) {
      throw new PlayerServiceError("network", e instanceof Error ? e.message : undefined);
    }
  }

  /** The current session's token; an anonymous sign-in first only if this browser has no session. */
  private async accessToken(): Promise<string> {
    const token = await this.storedToken();
    if (token) return token;
    // The session is looked for again inside the lock: another tab may have signed in while this one waited.
    this.signingIn ??= withSignInLock(async () => (await this.storedToken()) ?? (await this.signInAnonymously())).finally(() => {
      this.signingIn = null;
    });
    return this.signingIn;
  }

  /** The session saved in this browser (read from storage each time, so another tab's sign-in is seen), or null. */
  private async storedToken(): Promise<string | null> {
    const { data, error } = await this.supabase.auth.getSession();
    if (error) throw new PlayerServiceError("network", error.message);
    return data.session?.access_token ?? null;
  }

  private async signInAnonymously(): Promise<string> {
    const { data, error } = await this.supabase.auth.signInAnonymously();
    if (error) {
      // Anonymous sign-ins switched off in the project is a setup problem (docs/PLAYER-BACKEND.md).
      const code = error.code === "anonymous_provider_disabled" ? "notConfigured" : error.status ? "server" : "network";
      throw new PlayerServiceError(code, error.message);
    }
    if (!data.session) throw new PlayerServiceError("server", "No session after signing in");
    return data.session.access_token;
  }
}

/**
 * Runs a first sign-in under a lock shared by every tab of this site, so tabs opened together sign in once
 * and share one anonymous player. Browsers without the Web Locks API (before Safari 15.4, Chrome 69,
 * Firefox 96) sign in without it, and may then still create two players.
 */
async function withSignInLock(signIn: () => Promise<string>): Promise<string> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  return locks ? await locks.request(`${AUTH_STORAGE_KEY}:sign-in`, signIn) : signIn();
}

function readRound(v: unknown): ServerRound {
  const round = parseServerRound(v);
  if (!round) throw new PlayerServiceError("server", "Unexpected round");
  return round;
}

function readState(v: unknown): PlayerState {
  const state = parsePlayerState(v);
  if (!state) throw new PlayerServiceError("server", "Unexpected player state");
  return state;
}

async function failure(res: Response): Promise<PlayerServiceError> {
  return failureOf(res.status, await res.json().catch(() => null));
}

function failureOf(status: number, body: unknown): PlayerServiceError {
  const code = typeof body === "object" && body !== null ? (body as { error?: unknown }).error : undefined;
  if (code === "notConfigured" || code === "unauthorized" || code === "badRequest") return new PlayerServiceError(code);
  return new PlayerServiceError("server", `HTTP ${status}`);
}

import type { ChallengeService } from "@/core/challenge/api";
import type { ChallengeRound } from "@/core/challenge/quickChallenge";
import {
  createAnswerSync,
  localRoundOf,
  mergeQueues,
  parseStoredChallenge,
  pendingAnswers,
  queueAnswer,
  replayQueued,
  settleAnswers,
  type AnswerSync,
  type QueuedAnswer,
  type ServerRound,
  type StoredChallenge,
} from "@/core/challenge/serverRound";

/**
 * A Quick Challenge round on the web, between the screen (QuickChallengeScreen.tsx), which plays it with immediate
 * feedback, and the server, which decides: answers are sent as they are given, in the background, and the result is
 * confirmed by the server once the round has ended. The rules of what is sent and how replies are settled are the
 * core's (src/core/challenge/serverRound.ts); this adds the browser's part: timers, retries, going back online, and
 * keeping the round's id and undecided answers in local storage (never lesson progress) so a refresh comes back to
 * the same round, or to its result.
 *
 * Storage: CHALLENGE_STORAGE_KEY names the round; each page keeps its own undecided answers under its own key
 * (QUEUE_PREFIX and an id made for each page load), so no tab, duplicated tab or page before a refresh ever overwrites
 * another's. They are merged when read (mergeQueues), and only the round's own keys are ever removed.
 *
 * - While playing, a failed send is retried (after 0.5, 1, 2, then every 4 seconds, and at once when the browser is
 *   back online); every send carries all the undecided answers. The screen shows "Reconnecting…" meanwhile.
 * - Answers still undecided once the deadline and its allowance have certainly passed can no longer count, and are
 *   dropped: the server ends the round without them.
 * - Confirming: once the round has ended on the device and every answer is decided, the server's result is asked for
 *   (when its deadline's allowance has passed, if the round ended on time). After a few failed tries it is "failed",
 *   with the provisional result still shown; retry() starts again, with the same requests (they are safe to repeat).
 */

/** The round this browser has under way, or whose result is still to show: { roundId }. */
export const CHALLENGE_STORAGE_KEY = "arimap:challenge";
/** A page's undecided answers: QUEUE_PREFIX + the page's id. */
const QUEUE_PREFIX = "arimap:challenge:queue:";
/** This page's own key: a new id for every page load. */
const PAGE_KEY = QUEUE_PREFIX + Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");

export type Confirmation = "playing" | "confirming" | "confirmed" | "failed";
export type Connection = "ok" | "retrying";

export interface SessionEvents {
  /** The device's round now, to compare with the server's receipts. */
  localRound: () => ChallengeRound | null;
  /** The server's round, each time it is newer. */
  onServerRound: (round: ServerRound) => void;
  /** The server's round differs from the device's: play on from the server's, with this page's undecided answers on top. */
  onResync: (round: ChallengeRound) => void;
  onConfirmation: (confirmation: Confirmation) => void;
  onConnection: (connection: Connection) => void;
}

const RETRY_MS = [500, 1000, 2000, 4000];
/** Tries at confirming before it counts as failed. */
const CONFIRM_TRIES = 4;
/** After the deadline and its allowance, how much longer before undecided answers are certainly too late. */
const CERTAINLY_LATE_MS = 3000;

function queueKeys(ls: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < ls.length; i++) {
    const key = ls.key(i);
    if (key?.startsWith(QUEUE_PREFIX)) keys.push(key);
  }
  return keys;
}

/** The round kept, with every page's undecided answers for it merged (this page's first). */
export function readStoredChallenge(): StoredChallenge | null {
  try {
    const ls = window.localStorage;
    const kept = parseStoredChallenge(ls.getItem(CHALLENGE_STORAGE_KEY));
    if (!kept) return null;
    let own: readonly QueuedAnswer[] = [];
    const others: (readonly QueuedAnswer[])[] = [];
    for (const key of queueKeys(ls)) {
      const queue = parseStoredChallenge(ls.getItem(key));
      if (queue?.roundId !== kept.roundId) continue;
      if (key === PAGE_KEY) own = queue.queue;
      else others.push(queue.queue);
    }
    return { roundId: kept.roundId, queue: mergeQueues(own, others) };
  } catch {
    return null;
  }
}

/**
 * Forgets a round: its name, if it is the round kept, and every page's answers for it. With no id (no backend at
 * all), everything kept.
 */
export function clearStoredChallenge(roundId?: string) {
  try {
    const ls = window.localStorage;
    const ofRound = (key: string) => roundId === undefined || parseStoredChallenge(ls.getItem(key))?.roundId === roundId;
    if (ofRound(CHALLENGE_STORAGE_KEY)) ls.removeItem(CHALLENGE_STORAGE_KEY);
    for (const key of queueKeys(ls)) if (ofRound(key)) ls.removeItem(key);
  } catch {
    // Storage blocked: nothing was kept.
  }
}

/** Keeps the round's name and this page's undecided answers; other pages' answers for other rounds are stale. */
function store(sync: AnswerSync) {
  try {
    const ls = window.localStorage;
    ls.setItem(CHALLENGE_STORAGE_KEY, JSON.stringify(createAnswerSync(sync.roundId)));
    ls.setItem(PAGE_KEY, JSON.stringify(sync));
    for (const key of queueKeys(ls)) if (parseStoredChallenge(ls.getItem(key))?.roundId !== sync.roundId) ls.removeItem(key);
  } catch {
    // Storage full or blocked: the round goes on; only a refresh could not resend its undecided answers.
  }
}

/** Keeps a round's id (with no answers to send), so a refresh shows its result. */
export function storeRound(roundId: string) {
  store(createAnswerSync(roundId));
}

export class RoundSession {
  private sync: AnswerSync;
  private server: ServerRound;
  private confirmation: Confirmation = "playing";
  private connection: Connection = "ok";
  private failures = 0;
  private confirmTries = 0;
  private retryTimer: number | undefined;
  private finishTimer: number | undefined;
  private disposed = false;
  /** Requests of answers on their way: a reply sends again only when none is (each carries every undecided answer). */
  private inFlight = 0;
  private readonly online = () => this.send();

  constructor(
    private readonly api: ChallengeService,
    server: ServerRound,
    /** The device's clock less the server's (clockOffset). */
    private readonly offset: number,
    private readonly clock: () => number,
    private readonly events: SessionEvents,
    queue: readonly QueuedAnswer[] = [],
  ) {
    this.server = server;
    this.sync = queue.reduce(queueAnswer, createAnswerSync(server.id));
    store(this.sync);
    window.addEventListener("online", this.online);
    this.send();
  }

  /** An answer given on the device (its feedback already shown): sent now, with any still undecided. */
  answer(answer: QueuedAnswer) {
    this.sync = queueAnswer(this.sync, answer);
    store(this.sync);
    this.send();
  }

  /** The round has ended on the device: confirm its result. */
  end() {
    if (this.confirmation !== "playing") return;
    this.setConfirmation("confirming");
    this.send();
  }

  /** After "failed": try confirming again. */
  retry() {
    if (this.confirmation !== "failed") return;
    this.confirmTries = 0;
    this.failures = 0;
    this.setConfirmation("confirming");
    this.send();
  }

  dispose() {
    this.disposed = true;
    window.clearTimeout(this.retryTimer);
    window.clearTimeout(this.finishTimer);
    window.removeEventListener("online", this.online);
  }

  private send() {
    if (this.disposed) return;
    window.clearTimeout(this.retryTimer);
    this.dropCertainlyLate();
    const batch = pendingAnswers(this.sync);
    if (batch.length === 0) return this.confirmWhenDue();
    this.inFlight++;
    this.api.submitAnswers(this.sync.roundId, batch).then(
      (res) => {
        this.inFlight--;
        if (this.disposed) return;
        if (!res.ok) return this.lost();
        this.failures = 0;
        this.setConnection("ok");
        this.takeServer(res.round);
        const local = this.events.localRound();
        const { sync, resync } = local ? settleAnswers(this.sync, res.receipts, local) : { sync: this.sync, resync: false };
        this.sync = sync;
        if (resync) {
          // The server's round, with this page's undecided answers that still follow on from it played on top.
          const replay = replayQueued(localRoundOf(this.server, this.offset), this.sync.queue);
          this.sync = { ...this.sync, queue: replay.kept };
          this.events.onResync(replay.round);
        }
        store(this.sync);
        if (pendingAnswers(this.sync).length === 0) this.confirmWhenDue();
        else if (this.inFlight === 0) this.send();
      },
      () => {
        this.inFlight--;
        if (this.disposed) return;
        this.setConnection("retrying");
        if (this.confirmation === "confirming" && ++this.confirmTries >= CONFIRM_TRIES) return this.setConfirmation("failed");
        this.retryTimer = window.setTimeout(() => this.send(), RETRY_MS[Math.min(this.failures++, RETRY_MS.length - 1)]);
      },
    );
  }

  /** Answers that can no longer reach the server in time leave the queue: they would only be refused as late. */
  private dropCertainlyLate() {
    if (this.server.status === "finished" || this.clock() < this.server.deadline + this.server.graceMs + this.offset + CERTAINLY_LATE_MS) return;
    if (this.sync.queue.length === 0) return;
    this.sync = { ...this.sync, queue: [] };
    store(this.sync);
  }

  /** Once confirming and nothing is left to send: the server's result, asked for when the server can give it. */
  private confirmWhenDue() {
    if (this.confirmation !== "confirming" || this.disposed) return;
    if (this.server.status === "finished") return this.setConfirmation("confirmed");
    window.clearTimeout(this.finishTimer);
    // The server ends a round under way once its deadline, the allowance and the settle window have passed.
    const due = this.server.deadline + this.server.graceMs + this.server.settleMs + this.offset + 250 - this.clock();
    this.finishTimer = window.setTimeout(() => this.finish(), Math.max(0, due));
  }

  private finish() {
    if (this.disposed) return;
    this.api.finishRound(this.server.id).then(
      (res) => {
        if (this.disposed) return;
        if (!res.ok) return this.lost();
        this.setConnection("ok");
        this.takeServer(res.round);
        if (this.server.status === "finished") return this.setConfirmation("confirmed");
        // Not ended yet on the server (the device's estimate of its clock ran early): ask again shortly.
        if (++this.confirmTries >= CONFIRM_TRIES) return this.setConfirmation("failed");
        this.finishTimer = window.setTimeout(() => this.finish(), 1000);
      },
      () => {
        if (this.disposed) return;
        this.setConnection("retrying");
        if (++this.confirmTries >= CONFIRM_TRIES) return this.setConfirmation("failed");
        this.finishTimer = window.setTimeout(() => this.finish(), RETRY_MS[Math.min(this.confirmTries, RETRY_MS.length - 1)]);
      },
    );
  }

  /** The server no longer has this round for this player (a different session, say): it can not be confirmed. */
  private lost() {
    this.sync = { ...this.sync, queue: [] };
    this.setConfirmation("failed");
  }

  /** The newer of the server's rounds: replies can arrive out of order, and a round never goes back from finished. */
  private takeServer(round: ServerRound) {
    const current = this.server;
    if (current.status === "finished" && round.status !== "finished") return;
    if (current.status === round.status && round.answers.length < current.answers.length) return;
    this.server = round;
    this.events.onServerRound(round);
  }

  private setConfirmation(c: Confirmation) {
    if (this.confirmation === c) return;
    this.confirmation = c;
    this.events.onConfirmation(c);
  }

  private setConnection(c: Connection) {
    if (this.connection === c) return;
    this.connection = c;
    this.events.onConnection(c);
  }
}

import "server-only";
import type { ServerTime } from "@/core/challenge/serverRound";

/** The database's clock for one call (db_clock in 20261020120000_database_clock.sql), in ms since 1970. */
export interface DbClockRow {
  /** When the call's transaction began (now()). */
  began_ms: number;
  /** When the reply was made (clock_timestamp()). */
  ended_ms: number;
}

/**
 * One request's times, measured on this server's monotonic clock (performance.now) and never on its wall clock, which
 * can be seconds off the database's. The database's clock is the only one that decides anything:
 *
 * - The database is told durations (waitedMs, sinceVerifiedMs), taken off its own now(). The time from this server's
 *   call to the database's transaction is not taken off: the database's times come out that much later, never earlier.
 * - The device is told this request's arrival and reply on the database's clock (serverTime), placed there as NTP
 *   does from the call's two ends on each clock: wrong only by half the difference between the call's way there and
 *   its way back.
 */
export class RequestClock {
  /** When the request arrived, before its token was checked. */
  readonly receivedAt = performance.now();
  private verifiedAt: number | null = null;
  private dbCall: { sent: number; back: number; db: DbClockRow } | null = null;

  /** Its token has been verified. */
  verified() {
    this.verifiedAt = performance.now();
  }

  /** For the database: how long the request has been with this server, since it arrived. */
  waitedMs(): number {
    return Math.max(0, Math.round(performance.now() - this.receivedAt));
  }

  /** For the database: how long since the request's token was verified. */
  sinceVerifiedMs(): number {
    if (this.verifiedAt === null) throw new Error("The request's token has not been verified");
    return Math.max(0, Math.round(performance.now() - this.verifiedAt));
  }

  /** Times a database call whose reply reports the database's clock (`clockOf`). */
  async timeCall<T>(run: () => Promise<T>, clockOf: (row: T) => DbClockRow | undefined): Promise<T> {
    const sent = performance.now();
    const row = await run();
    const back = performance.now();
    const db = clockOf(row);
    if (db) this.dbCall = { sent, back, db };
    return row;
  }

  /** The database's clock less this server's monotonic clock, from the last call timed. */
  private dbOffset(): number {
    if (!this.dbCall) throw new Error("No database call has reported the database's clock");
    const { sent, back, db } = this.dbCall;
    return (db.began_ms - sent + (db.ended_ms - back)) / 2;
  }

  /** Now, on the database's clock (ms since 1970). */
  dbNow(): number {
    return performance.now() + this.dbOffset();
  }

  /** The request's arrival and its reply (leaving now), on the database's clock: what the device places it by. */
  serverTime(): ServerTime {
    const offset = this.dbOffset();
    return { receivedAt: Math.round(this.receivedAt + offset), respondedAt: Math.round(performance.now() + offset) };
  }

  /** For the Server-Timing header: ms since arrival, the token check, and the last database call (its round trip, and its time in the database). */
  timings(): { total: number; auth: number | null; db: { roundTrip: number; inDb: number } | null } {
    const now = performance.now();
    const call = this.dbCall;
    return {
      total: now - this.receivedAt,
      auth: this.verifiedAt === null ? null : this.verifiedAt - this.receivedAt,
      db: call ? { roundTrip: call.back - call.sent, inDb: call.db.ended_ms - call.db.began_ms } : null,
    };
  }
}

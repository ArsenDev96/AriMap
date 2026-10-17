# Player backend (Supabase)

Anonymous player identity, an optional display name, the Quick Challenge attempt ledger (foundation, 17
October 2026, applied to the dev project), and server-managed Quick Challenge rounds (18 October 2026,
applied; their timing: see "Timing"). Nothing is deployed.

## What is built

| Part | Where |
| --- | --- |
| Rules, framework-independent (no React, DOM, storage or network) | `src/core/player/attempts.ts`, `src/core/player/displayName.ts`, `src/core/progress/europeStars.ts`, `src/core/challenge/serverRound.ts`, and the service contracts `src/core/player/api.ts`, `src/core/challenge/api.ts` |
| Database: tables, constraints, functions | `supabase/migrations/20261017120000_player_foundation.sql` and `20261018120000_challenge_rounds.sql`, `20261019120000_server_receipt_times.sql` (applied), `20261020120000_database_clock.sql` (not yet) |
| Server routes | `GET /api/player`, `PUT /api/player/display-name`, `POST /api/player/europe-stars` (`src/app/api/player`); `POST /api/challenge/rounds`, `POST /api/challenge/rounds/:id/answers`, `POST /api/challenge/rounds/:id/finish` (`src/app/api/challenge`); helpers in `src/server` |
| Web client | `src/web/backend.ts` (`webBackend`), the round's driver `src/components/challenge/roundSession.ts`, the screen `src/components/challenge/QuickChallengeScreen.tsx` |
| Configuration | `.env.example` (placeholders only) |

### Identity

- Each player is a Supabase Auth user, signed in anonymously in the browser the first time the web client
  is used (never on page load). The session lives under `arimap:auth` in local storage.
- Every server request carries the session's access token (`Authorization: Bearer …`). The server has
  Supabase Auth verify it and takes the player id from it, never from the request.
- Account linking later: Supabase can link an email or OAuth login to the same anonymous user, keeping its id.
- Tabs opened together sign in once: the first sign-in runs under a Web Lock shared by every tab, and a
  tab that waited uses the session the first one saved. Browsers without Web Locks (before Safari 15.4,
  Chrome 69, Firefox 96) skip the lock and may still create two players; the browser keeps the last.
- Clearing the browser's storage starts a new anonymous player, as it already loses lesson progress.

### Attempt ledger

- `attempt_grants` rows add attempts: `initial` (1), `all_europe_stars` (2), `rewarded_ad` (1 each).
- The initial attempt and the all-stars reward are unique per player (a partial unique index), so repeated,
  retried or simultaneous requests never grant twice. The initial attempt is created on the player's first
  request, for existing and new players alike; it never resets.
- Rewarded ads (later): any number per player, each unique per `(provider, provider_transaction_id)`.
  `grant_rewarded_ad` exists for that; nothing calls it, and no ad is offered or simulated.
- Each kind's amount is fixed by a check constraint, mirroring `GRANT_ATTEMPTS`.
- Each round started spends one attempt: the balance is the grants less the rounds (`challenge_rounds`).

### All 36 Europe stars

- The fixed 12 lessons are listed in `EUROPE_STAR_LESSONS` (the Europe levels as of October 2026). A level
  added later does not change who qualifies.
- The device sends a snapshot of its saved best stars per lesson. The server accepts exactly those 12
  lessons, 0–3 stars each, and grants +2 only when all 36 are there; the database repeats that count.
- `europe_stars_claims.claimed_at` is **when the server accepted the claim**, not when the stars were earned:
  saved lesson progress records no dates.
- The future **Europe Geography Master award** («Եվրոպայի աշխարհագրության գիտակ» պարգև) uses the same
  condition (`hasAllEuropeStars`) and the same display name, with its own issue date recorded when it is
  issued. It is not built.

### Trust (unchanged)

Lesson progress stays on the device, exactly as before (`arimap:state`, version 2, untouched by any of
this). It is the device's own record, so anything that trusts it, the +2 reward and later the award,
accepts progress edited in local storage. The harm is bounded: +2 attempts once per player.

### Display name

- Optional; results stay private until one is saved. Not an identity: names need not be unique.
- Rules (`checkDisplayName`, run on the device and again on the server): spaces tidied, 2–20 characters,
  letters of any script, digits, spaces and `- ' . _`; at least one letter; no web addresses; a few
  reserved names (AriMap, admin, …) and a short list of blocked words. The blocked list is a starting
  point: Armenian and transliterated entries are needed from someone who reads both languages, and a public
  leaderboard will still need moderation.
- At most 3 changes (a first name included) in any 24 hours; saving the current name again is not a change.
  Every change is kept in `display_name_changes`.

### Security

- Row level security is on for every table, with no policies; the `anon` and `authenticated` roles have no
  privileges on the tables or functions. Only the server, with the secret key, calls the functions.
- The secret key is read only in `src/server/supabaseAdmin.ts` (marked `server-only`, so a client import
  fails the build) and is never prefixed `NEXT_PUBLIC_`.

### Without configuration

With no URL or keys set, `webBackend()` returns null and the routes answer `503 { "error": "notConfigured" }`.
Nothing stands in for the database: lessons work as before, and the Quick Challenge says it is not available
(it has no unlimited or offline mode). **A deployment needs the backend configured before it ships this
build**, or its Quick Challenge is unavailable.

## Setting up the dev project

The dashboard's names may move; these are as of October 2026.

1. **Create the project.** At supabase.com, *New project*: name `arimap-dev`, region **Central EU
   (Frankfurt)**, a strong database password kept in a password manager.
2. **Anonymous sign-ins.** *Authentication → Sign In / Providers*: switch on **Allow anonymous sign-ins**,
   and save. Leave *Allow manual linking* off until account linking is built.
3. **Rate limit.** *Authentication → Rate Limits*: keep the limit for anonymous sign-ins (30 an hour per IP
   address by default). CAPTCHA (Cloudflare Turnstile) can be added later.
4. **Apply the migration.** *SQL Editor → New query*: paste the whole of
   `supabase/migrations/20261017120000_player_foundation.sql` and *Run*. It should finish without errors.
5. **Check it.** In the SQL editor:
   ```sql
   select relname, relrowsecurity from pg_class
   where relname in ('players', 'display_name_changes', 'attempt_grants', 'europe_stars_claims');
   ```
   Four rows, each `true`.
6. **Keys.** *Project Settings → API Keys*: copy the **publishable** key (`sb_publishable_…`) and a
   **secret** key (`sb_secret_…`; create one if only the legacy keys are shown). *Project Settings → Data
   API*: copy the **Project URL**.
7. **Local environment.** Copy `.env.example` to `.env.local` in the repository's root (it is ignored by
   git) and fill in the three values. Restart `next dev`; a production build or preview must be rebuilt,
   since `NEXT_PUBLIC_` values are built in.
8. **Vercel (when wanted).** *Project → Settings → Environment Variables*: add the three for **Preview**
   with the dev values, marking `SUPABASE_SECRET_KEY` sensitive. Production gets a separate production
   project later, set up the same way.

Optional smoke check, after step 7 with `next dev` running (`$URL` and `$KEY` being the project URL and
publishable key):

```sh
TOKEN=$(curl -s -X POST "$URL/auth/v1/signup" -H "apikey: $KEY" -H "Content-Type: application/json" -d '{}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).access_token')
curl -s http://localhost:3000/api/player -H "Authorization: Bearer $TOKEN"
```

The answer shows the new player with one `initial` grant and `attemptsLeft: 1`; asking again shows the
same grant, never a second.

## Rounds

The Quick Challenge's rules are unchanged (15 random countries, 60 seconds, 400 ms feedback). What changed is who
decides: the server.

- **Start** (`start_round`) spends exactly one attempt, in one transaction under a lock on the player's row. First it
  ends the player's rounds whose time has run out. Then the same press retried (its `request_id`), a double press,
  or another tab gets **the round already under way**, spending nothing (a unique index allows one round under way per
  player). With no attempts left it refuses. The server draws the questions with a cryptographic random source.
- **One deadline**: the round's start plus 60 seconds, on the database's clock (see "Timing"). The device places it
  on its own clock from the start request (`clockOffset`), so a slow connection costs the player about the reply's
  time on the network. Nothing is given back on a refresh.
- **Answers are received and scored by the server** (`submit_answers`) as they are given, against the round's own
  questions, in order, at the database's time. Each gets a receipt: accepted, duplicate (a retry), conflict (another
  tab answered first), out of order, or late. An answer arriving up to **1 second** after the deadline still counts
  (`SERVER_ROUND_RULES.graceMs`, stored on each round).
- **The 400 ms rhythm and queued answers**, on the server's clock alone: question *n* (from 0) can not arrive sooner
  than *n* × 400 ms after the start, since each question shows only once the last answer's feedback has ended. An
  answer arriving sooner is kept as skipped and **voided** (never counted). Network delay only makes answers later,
  so this never refuses an honest answer, however the network bunches them. Every request carries every answer not
  yet decided, in order, so answers queued while offline, or sent again after a reconnection or a refresh, arrive as
  one ordered list and are taken once each, until the deadline's allowance.
  **The trade-off:** the gap between two answers arriving together can not be enforced, so a device may send several
  at once as soon as its time allows. The device's own times prove nothing and decide nothing: they are kept, and
  flagged (`client_time_suspect`) when they do not fit, for review only.
- **Immediate feedback**: the device plays the same round by the same rules (`quickChallenge.ts`) and shows each
  answer at once; sending happens in the background (`roundSession.ts`: retried after 0.5, 1, 2, then every 4
  seconds, and at once when the browser is back online; "Reconnecting…" shows meanwhile). If the server's receipts
  disagree with the device (another tab, a voided answer), the device plays on from the server's round, with its own
  undecided answers that still follow on played on top; the server's first accepted answer to each question stands.
- **Results**: provisional (the device's scoring, shown quieter, "Confirming your result…") until the server's
  finished round arrives; then **confirmed**, and the confirmed result is the one shown, reviewed and shared. Answers
  that reached the server too late are said not to have counted. After 4 failed tries it says the result could not
  be confirmed, with **Try again** (the same requests; they are safe to repeat). Share waits for confirmation.
- **Refresh and leaving**: the round's id is kept in `arimap:challenge`, and each page's undecided answers under its
  own key (`arimap:challenge:queue:<page>`, a new id for every page load), so no tab, duplicated tab or page before
  a refresh overwrites another's; they are merged when read. All of it is local storage, apart from lesson progress. After a refresh the challenge reopens, resumes the same round with the same deadline
  (sending the kept answers again), or shows the result of the round that has ended. Home during a round leaves the
  screen only: the attempt is spent and the round runs on; coming back before the deadline carries on.
- **Abandoned rounds** end at their deadline (plus allowance) the next time the player asks for anything, scored from
  the answers that arrived. The attempt stays spent. There is no automatic refund, for a slow start or a server failure.
- **Best result** (`challenge_best`): the most correct answers, then the shortest time (the whole 60 seconds when the
  time ran out). It is kept for every player and stays private until a name is saved; nothing shows it publicly yet.
- **Name**: before the first round, Save and start / Skip and start (one line says leaderboard names are public).
  Skipped: offered again on Results. Once a name is saved it is not asked for again.
- **All 36 stars**: when the challenge opens, a device whose saved lessons hold all 36 stars claims the one-time +2
  attempts (once; the server refuses a second). With no attempts left, the challenge shows that path: the stars still
  missing and Explore Europe lessons. There are no ads and no practice rounds.

### Applying the rounds migration

Apply it to the dev project before running this build against it:

1. *SQL Editor → New query*: paste the whole of `supabase/migrations/20261018120000_challenge_rounds.sql` and *Run*.
   It adds `challenge_rounds`, `challenge_answers`, `challenge_best` and the round functions, and replaces the
   foundation's `player_state` and `ensure_player` (the foundation's file is not changed).
2. Check it:
   ```sql
   select relname, relrowsecurity from pg_class
   where relname in ('challenge_rounds', 'challenge_answers', 'challenge_best');
   ```
   Three rows, each `true`.
3. Rebuild the preview (`NEXT_PUBLIC_` values and the new routes are built in).

### T### Timing

One clock decides: **the database's**. Every time that counts (a round's start and deadline, each answer's receipt, a
round's end) is the database's, and the times the device places the deadline by are on it too. The app's server never
sends a time from its own wall clock, which can be seconds off: measured on the preview, this machine's clock was
about 10 s ahead of Supabase's, and timing by it moved starts and receipts by as much. It measures **durations**
instead, on its monotonic clock (`performance.now`, `src/server/requestClock.ts`), and the database takes them off its
own `now()` (when its transaction began). From `20261020120000_database_clock.sql`:

- **Receipt time.** The app's server notes when each request arrives, before it verifies the token or calls the
  database (`playerRoute.ts`), and tells the database how long the request has been with it (`p_waited_ms`). Every
  request is still verified; an unverified one is refused. All the answers of a request count as received then: in
  time if by the deadline plus the 1-second allowance (unchanged), timed from it for the rhythm's bound and a
  completed round's time, and never earlier than the round's last answer.
- **Start time.** A round starts when its start request's token was verified (`p_since_verified_ms` before the
  database's `now()`): the token check is not charged to the player. Deadline = start + 60 s.
- **Only the server's own measures.** The durations come from the app's server alone, never from the browser's
  request; the functions are callable by `service_role` only, and the database bounds each to between 0 and the
  settle window.
- **The database still decides** under its locks (order, duplicates, conflicts, one attempt per round). Waiting for a
  lock comes after `now()`, so it is never charged to a request.
- **Settle window (5 s, `SERVER_ROUND_RULES.settleMs`, stored on each round).** The database ends a round under way
  only once the deadline, the allowance and this window have passed, so a request that arrived in time but is still
  being verified is never shut out. It does not widen what counts as in time. The cost: a round whose time ran out
  is confirmed about 6 seconds after its deadline instead of about 1.
- **Device clock.** Each database function reports its clock (`db_clock`: when its transaction began, when it
  replied), and the app's server places the request's arrival and its reply on it as NTP does, from the call's two
  ends on each clock. Replies carry those two times (`serverTime`), and the device places the database's clock on its
  own the same way, leaving out the server's processing. So the countdown it shows and the deadline stored are on
  the same clock.
- **What remains: the hop from the app's server to the database.** The time between the server's call and the
  database's transaction beginning (the network between them, the connection pool, PostgREST) is not taken off.
  Starts and receipts come out that much later than the request's arrival, never earlier: a start's later by that
  much (in the player's favour), and an answer's later by that much (against it, within the 1-second allowance). The
  server's `serverTime` is placed on the database's clock with an error of half the difference between the call's
  way there and its way back. `Server-Timing` shows the call (`db`: its round trip from the server; `dbproc`: its time
  in the database), so each way is about half of `db` less `dbproc`. In one region that is a few milliseconds; on
  this preview (this machine to Supabase) it is far more (see the measured results).
- **Verification.** Tokens are verified locally with the project's asymmetric signing key (ES256, from its published
  JWKS, cached for 10 minutes): signature and expiry by supabase-js (`auth.getClaims`), and in `playerRoute.ts`
  the role and audience `authenticated`, this project's issuer and a user id. A token signed with a key the JWKS does
  not hold (during a key rotation) or a shared secret falls back to Supabase Auth, as before. A signed-out or deleted
  session's token stays valid until it expires (an hour by default); a deleted player's rows go with it, so such a
  request finds nothing to act on.
- **Measuring.** Every player reply has a `Server-Timing` header (`auth`, `work`, `total`, and `db`, `dbproc` for
  its database call, in ms): the device's round trip less the total is the time on the network.
- **Region.** The Supabase project is in Seoul (`ap-northeast-2`), so the API runs in Vercel's Seoul region,
  `icn1`: chosen in the project's settings (*Settings → Functions → Function Region*; Hobby allows one region) and
  pinned in `vercel.json` (`"regions": ["icn1"]`), which takes precedence, so the two must agree. Either takes effect
  from the next deployment; Vercel's default otherwise is Washington (`iad1`). Check a deployment: an `/api/…`
  reply's `X-Vercel-Id` reads `<edge>::icn1::…` (the second part is where the function ran), or
  `vercel inspect <deployment-url>`. Next 16's `preferredRegion` route option is deprecated.

### Applying the timing migrations

`20261019120000_server_receipt_times.sql` (applied) added the settle window; `20261020120000_database_clock.sql`
replaces its timestamps with durations. Apply it **before** rebuilding the preview with this code (the code calls the
new function signatures, and the old build can not call the replaced ones):

1. *SQL Editor → New query*: paste the whole of `supabase/migrations/20261020120000_database_clock.sql` and *Run*.
2. Check it:
   ```sql
   select p.oid::regprocedure from pg_proc p
   where p.proname in ('start_round', 'submit_answers', 'db_clock', 'ms_before_now', 'bounded_time');
   ```
   Four rows: `start_round` ending in `integer`, `submit_answers(uuid,uuid,jsonb,integer)`, `db_clock()` and
   `ms_before_now(integer,integer)`; no `bounded_time`.
3. Rebuild the preview.

nown limits

- **Not cheat-proof.** The server's clock, its own questions and its receipts stop forged scores, extra time, answers
  out of order and spending twice. They do not stop a script that reads the map and taps within the rhythm, or help
  from someone else; and clearing storage makes a new anonymous player with a new attempt.
- **Slow connections.** The start reply's time on the network comes off the round, and a last answer that reaches
  the server more than 1 second after the deadline does not count. The allowance and "no automatic refund" are proposed defaults to
  review in practice, not proven fairness guarantees.
- **Bursts.** Within the rhythm's bound (question *n* not before *n* × 400 ms), answers arriving together are all
  taken: a script can bank time and send several at once.
- **Two tabs** play one round. Whichever tab's answer to a question reaches the server first counts; the other tab
  is told, and plays on from the server's round. A tab's own undecided answers are only lost if it is closed before
  they are sent and no page of the round is opened again before the deadline.

## Corrections recorded for the rounds phase (now implemented, see "Rounds")

- **Answer rhythm.** The server enforces the 400 ms gap between answers, by the order of questions and the
  device's own offsets, with an explicit policy for answers queued while offline or resent after a
  reconnect (received together, they must not be refused for arriving close together, nor accepted out
  of order or after the deadline).
- **Expired rounds first.** Before a new Start, the server finalizes any of the player's rounds whose time
  has run out, so an expired round can never block or be confused with a new one.
- **Confirmation errors.** When a result cannot be confirmed (server or connection failure), Results say so
  and offer a retry, which repeats the same idempotent request; the provisional result is never presented
  as confirmed.
- **Proposed defaults, not guarantees.** The 1-second network allowance after the deadline and no automatic
  refund (for a slow start or a server failure) are proposed defaults to review in practice, not proven
  fairness guarantees.

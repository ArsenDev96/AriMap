-- One free Quick Challenge attempt per UTC calendar day. See docs/PLAYER-BACKEND.md ("Attempt ledger"). Prepared, not
-- applied. Needs 20261020120000_database_clock.sql, which it leaves as it is (and is independent of
-- 20261021120000_challenge_leaderboard.sql): it adds one column and one index to challenge_rounds, and replaces
-- ensure_player, player_state and start_round (start_round keeps its signature).
--
-- - Every player has one free attempt each UTC day, from 00:00 UTC on the database's clock. An unused one is not kept:
--   it never adds up.
-- - Start spends today's free attempt first, and a saved bonus attempt (the ledger's grants) only once it is used.
-- - The ledger is unchanged: grants add saved attempts, and only the rounds that spent one count against them. Rounds
--   played before this migration all spent saved attempts, so every balance stays exactly as it was.
-- - New players get no 'initial' grant any more: today's free attempt only. Existing players keep their grants
--   (an unspent 'initial' attempt stays a saved attempt) and get today's free attempt too.
-- - The day is the database's: (now() at time zone 'UTC')::date, in the start's transaction, under the player's row
--   lock. A unique index allows one free attempt per player per day, whatever the tabs or retries.
--
-- Not compatible with an app build from before it: that build's calls still succeed, but its screen counts every round
-- against the grants and does not know the daily attempt, so it shows a wrong balance and can block Start (a new
-- player has no grants). Rebuild the app straight after applying this.

-- The UTC day whose free attempt this round used; null when it spent a saved attempt (every round before this).
alter table public.challenge_rounds add column daily_attempt_on date;
comment on column public.challenge_rounds.daily_attempt_on is
  'The UTC day whose free attempt this round used; null when it spent a saved (bonus) attempt from attempt_grants.';

-- One free attempt per player per UTC day. Nulls (saved attempts) are never equal, so they are not limited by it.
create unique index challenge_rounds_one_daily on public.challenge_rounds (player_id, daily_attempt_on)
  where daily_attempt_on is not null;

-- The database's UTC day now (when this transaction began), and when the next begins.
create function public.utc_day()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'UTC')::date
$$;

create function public.next_utc_day_at()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (public.utc_day() + 1)::timestamp at time zone 'UTC'
$$;

-- As 20261020120000_database_clock.sql has it, with today's free attempt and the saved attempts' spending.
create or replace function public.player_state(p_player uuid)
returns jsonb
language sql
volatile
set search_path = ''
as $$
  select jsonb_build_object(
    'player_id', p.id,
    'display_name', p.display_name,
    'grants', coalesce(
      (select jsonb_agg(jsonb_build_object('kind', g.kind, 'attempts', g.attempts, 'granted_at', g.granted_at) order by g.granted_at, g.id)
       from public.attempt_grants g where g.player_id = p.id),
      '[]'::jsonb),
    'europe_stars_claimed_at', (select c.claimed_at from public.europe_stars_claims c where c.player_id = p.id),
    'name_change_blocked_until', (
      select n.changed_at + interval '24 hours' from public.display_name_changes n
      where n.player_id = p.id and n.changed_at > now() - interval '24 hours'
      order by n.changed_at desc offset 2 limit 1),
    'rounds_started', (select count(*) from public.challenge_rounds r where r.player_id = p.id),
    -- The rounds that spent a saved attempt: the grants less these are the saved attempts left.
    'bonus_rounds_started', (select count(*) from public.challenge_rounds r where r.player_id = p.id and r.daily_attempt_on is null),
    'daily_available', not exists (
      select 1 from public.challenge_rounds r where r.player_id = p.id and r.daily_attempt_on = public.utc_day()),
    'daily_resets_at', public.next_utc_day_at(),
    'active_round', (select public.round_view(r.id) from public.challenge_rounds r where r.player_id = p.id and r.status = 'playing'),
    'best', (select jsonb_build_object('score', b.score, 'elapsed_ms', b.elapsed_ms) from public.challenge_best b where b.player_id = p.id),
    'clock', public.db_clock()
  )
  from public.players p
  where p.id = p_player
$$;

-- As 20261018120000_challenge_rounds.sql has it, without the one-time 'initial' attempt: a new player has today's free
-- attempt only. Grants already made are kept.
create or replace function public.ensure_player(p_player uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  insert into public.players (id) values (p_player) on conflict (id) do nothing;
  perform 1 from public.players where id = p_player for update;
  perform public.end_due_rounds(p_player);
  return public.player_state(p_player);
end;
$$;

-- As 20261020120000_database_clock.sql has it (serialized by the player's row lock; the round under way for a retry, a
-- double press or another tab, spending nothing), spending today's free attempt if it is unused, otherwise a saved one.
create or replace function public.start_round(
  p_player uuid,
  p_request_id uuid,
  p_questions text[],
  p_duration_ms integer,
  p_grace_ms integer,
  p_settle_ms integer,
  p_feedback_ms integer,
  p_since_verified_ms integer
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_round uuid;
  v_day date;
  v_daily date;
  v_left bigint;
  v_start timestamptz;
begin
  -- Creates the player if new, locks their row (held to the end of this transaction) and ends rounds now due.
  perform public.ensure_player(p_player);

  select r.id into v_round from public.challenge_rounds r where r.player_id = p_player and r.request_id = p_request_id;
  if v_round is null then
    select r.id into v_round from public.challenge_rounds r where r.player_id = p_player and r.status = 'playing';
  end if;
  if v_round is not null then
    return jsonb_build_object('ok', true, 'reused', true, 'round', public.round_view(v_round), 'state', public.player_state(p_player));
  end if;

  -- Today's free attempt first (the day as player_state reports it: this transaction's).
  v_day := public.utc_day();
  if not exists (select 1 from public.challenge_rounds r where r.player_id = p_player and r.daily_attempt_on = v_day) then
    v_daily := v_day;
  else
    v_left := (select coalesce(sum(g.attempts), 0) from public.attempt_grants g where g.player_id = p_player)
            - (select count(*) from public.challenge_rounds r where r.player_id = p_player and r.daily_attempt_on is null);
    if v_left <= 0 then
      return jsonb_build_object('ok', false, 'problem', 'no_attempts', 'state', public.player_state(p_player));
    end if;
  end if;

  v_start := public.ms_before_now(p_since_verified_ms, p_settle_ms);
  insert into public.challenge_rounds (player_id, request_id, questions, duration_ms, grace_ms, settle_ms, feedback_ms, started_at, deadline, daily_attempt_on)
    values (p_player, p_request_id, p_questions, p_duration_ms, p_grace_ms, p_settle_ms, p_feedback_ms, v_start, v_start + p_duration_ms * interval '1 millisecond', v_daily)
    returning id into v_round;
  return jsonb_build_object('ok', true, 'reused', false, 'round', public.round_view(v_round), 'state', public.player_state(p_player));
end;
$$;

revoke all on function public.utc_day() from public, anon, authenticated;
revoke all on function public.next_utc_day_at() from public, anon, authenticated;
revoke all on function public.player_state(uuid) from public, anon, authenticated;
revoke all on function public.ensure_player(uuid) from public, anon, authenticated;
revoke all on function public.start_round(uuid, uuid, text[], integer, integer, integer, integer, integer) from public, anon, authenticated;

grant execute on function public.utc_day() to service_role;
grant execute on function public.next_utc_day_at() to service_role;
grant execute on function public.player_state(uuid) to service_role;
grant execute on function public.ensure_player(uuid) to service_role;
grant execute on function public.start_round(uuid, uuid, text[], integer, integer, integer, integer, integer) to service_role;

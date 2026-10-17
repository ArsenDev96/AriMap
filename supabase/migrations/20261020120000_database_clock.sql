-- Quick Challenge timing on the database's clock alone. See docs/PLAYER-BACKEND.md ("Timing"). Prepared, not
-- applied. Needs 20261019120000_server_receipt_times.sql, which it leaves as it is: start_round and submit_answers
-- take durations instead of the app server's timestamps (the old signatures are dropped, and bounded_time with them),
-- and every reply reports the database's clock.
--
-- The app's server sends no times from its own wall clock, which can be seconds off the database's. It measures, on
-- its monotonic clock, how long a request was with it before the database call: since it arrived (answers), or since
-- its token was verified (a start). The database takes that much off its own now() (when its transaction began), at
-- most the settle window. So every time that decides anything (start, deadline, receipts, a round's end) is the
-- database's, whatever the app server's clock says. The durations come only from the app's server: these functions
-- are callable by service_role alone, never by a browser.
--
-- What is not taken off: the call's time from the app's server to the database's transaction (the network between
-- them, the connection pool). Starts and receipts come out that much later than the request's arrival, never earlier.
--
-- Unchanged: one attempt spent under the player's lock, one round under way, the request id's idempotency, answers in
-- order and taken once, the deadline's 1-second allowance and the settle window.

-- A moment `p_ms` before this transaction began, `p_ms` bounded to [0, p_window_ms].
create function public.ms_before_now(p_ms integer, p_window_ms integer)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now() - least(greatest(coalesce(p_ms, 0), 0), greatest(p_window_ms, 0)) * interval '1 millisecond'
$$;

-- The database's clock for one call: when its transaction began (now()) and this moment (clock_timestamp()). The app's
-- server places its own times for the request on the database's clock from these and its own times for the call.
create function public.db_clock()
returns jsonb
language sql
volatile
set search_path = ''
as $$
  select jsonb_build_object('began_ms', public.epoch_ms(now()), 'ended_ms', public.epoch_ms(clock_timestamp()))
$$;

-- As 20261018120000_challenge_rounds.sql has it, with the database's clock (`clock`) in place of `server_now_ms`.
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
    -- Each round started spent one attempt.
    'rounds_started', (select count(*) from public.challenge_rounds r where r.player_id = p.id),
    'active_round', (select public.round_view(r.id) from public.challenge_rounds r where r.player_id = p.id and r.status = 'playing'),
    'best', (select jsonb_build_object('score', b.score, 'elapsed_ms', b.elapsed_ms) from public.challenge_best b where b.player_id = p.id),
    'clock', public.db_clock()
  )
  from public.players p
  where p.id = p_player
$$;

drop function public.start_round(uuid, uuid, text[], integer, integer, integer, integer, timestamptz);

-- As before (one attempt spent, under the player's lock; the round under way for a retry, a double press or another
-- tab), with the start `p_since_verified_ms` before this transaction began: when the app's server had verified this
-- request's token, so the token check is not charged to the player.
create function public.start_round(
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

  v_left := (select coalesce(sum(g.attempts), 0) from public.attempt_grants g where g.player_id = p_player)
          - (select count(*) from public.challenge_rounds r where r.player_id = p_player);
  if v_left <= 0 then
    return jsonb_build_object('ok', false, 'problem', 'no_attempts', 'state', public.player_state(p_player));
  end if;

  v_start := public.ms_before_now(p_since_verified_ms, p_settle_ms);
  insert into public.challenge_rounds (player_id, request_id, questions, duration_ms, grace_ms, settle_ms, feedback_ms, started_at, deadline)
    values (p_player, p_request_id, p_questions, p_duration_ms, p_grace_ms, p_settle_ms, p_feedback_ms, v_start, v_start + p_duration_ms * interval '1 millisecond')
    returning id into v_round;
  return jsonb_build_object('ok', true, 'reused', false, 'round', public.round_view(v_round), 'state', public.player_state(p_player));
end;
$$;

drop function public.submit_answers(uuid, uuid, jsonb, timestamptz);

-- As before (receipts: accepted, duplicate, conflict, out_of_order, late; one lock on the round; in order), with every
-- answer of the request received `p_waited_ms` before this transaction began: when the request reached the app's
-- server, before its token was checked. That time, never earlier than the round's last answer, decides whether an
-- answer is in time (by the deadline plus the allowance), the rhythm's bound (question n not before n feedback gaps
-- after the start), and a completed round's time.
create function public.submit_answers(p_player uuid, p_round uuid, p_answers jsonb, p_waited_ms integer)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  r public.challenge_rounds;
  v_answer jsonb;
  v_index integer;
  v_country text;
  v_at integer;
  v_existing public.challenge_answers;
  v_count integer;
  v_previous_at integer;
  v_received timestamptz;
  v_in_time boolean;
  v_elapsed bigint;
  v_void text;
  v_suspect boolean;
  v_outcome text;
  v_receipts jsonb := '[]'::jsonb;
begin
  select * into r from public.challenge_rounds where id = p_round and player_id = p_player for update;
  if not found then
    return jsonb_build_object('ok', false, 'problem', 'not_found');
  end if;
  if r.status = 'playing' and now() > r.deadline + (r.grace_ms + r.settle_ms) * interval '1 millisecond' then
    perform public.end_round(r.id, 'time_up', r.deadline);
    select * into r from public.challenge_rounds where id = p_round;
  end if;
  v_received := public.ms_before_now(p_waited_ms, r.settle_ms);
  v_received := greatest(v_received, (select max(a.received_at) from public.challenge_answers a where a.round_id = r.id));
  v_in_time := v_received <= r.deadline + r.grace_ms * interval '1 millisecond';
  v_elapsed := public.epoch_ms(v_received) - public.epoch_ms(r.started_at);

  for v_answer in select value from jsonb_array_elements(p_answers) loop
    v_index := (v_answer->>'index')::integer;
    v_country := v_answer->>'country';
    v_at := (v_answer->>'at_ms')::integer;

    select * into v_existing from public.challenge_answers a where a.round_id = r.id and a.question_index = v_index;
    if found then
      v_receipts := v_receipts || jsonb_build_object(
        'index', v_index,
        'status', case when v_existing.country is not distinct from v_country then 'duplicate' else 'conflict' end,
        'outcome', v_existing.outcome,
        'voided', v_existing.voided_reason is not null);
      continue;
    end if;
    if r.status <> 'playing' or not v_in_time then
      v_receipts := v_receipts || jsonb_build_object('index', v_index, 'status', 'late');
      continue;
    end if;

    select count(*), max(a.client_at_ms) into v_count, v_previous_at from public.challenge_answers a where a.round_id = r.id;
    if v_index is distinct from v_count or v_index >= cardinality(r.questions) then
      v_receipts := v_receipts || jsonb_build_object('index', v_index, 'status', 'out_of_order', 'expected', v_count);
      continue;
    end if;

    v_void := case when v_elapsed < v_index::bigint * r.feedback_ms then 'too_soon' end;
    v_suspect := v_at is null or v_at < 0 or v_at > r.duration_ms or v_at > v_elapsed + 1000
      or (v_previous_at is not null and v_at < v_previous_at + r.feedback_ms);
    v_outcome := case
      when v_void is not null or v_country is null then 'skipped'
      when v_country = r.questions[v_index + 1] then 'correct'
      else 'wrong'
    end;
    insert into public.challenge_answers (round_id, question_index, country, outcome, client_at_ms, received_at, voided_reason, client_time_suspect)
      values (r.id, v_index, v_country, v_outcome, coalesce(v_at, 0), v_received, v_void, v_suspect);
    v_receipts := v_receipts || jsonb_build_object('index', v_index, 'status', 'accepted', 'outcome', v_outcome, 'voided', v_void is not null);

    if v_index + 1 = cardinality(r.questions) then
      perform public.end_round(r.id, 'completed', v_received);
      select * into r from public.challenge_rounds where id = p_round;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'receipts', v_receipts, 'round', public.round_view(r.id), 'clock', public.db_clock());
end;
$$;

-- As before, with the database's clock in the reply.
create or replace function public.finish_round(p_player uuid, p_round uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  r public.challenge_rounds;
begin
  select * into r from public.challenge_rounds where id = p_round and player_id = p_player for update;
  if not found then
    return jsonb_build_object('ok', false, 'problem', 'not_found');
  end if;
  if r.status = 'playing' and now() > r.deadline + (r.grace_ms + r.settle_ms) * interval '1 millisecond' then
    perform public.end_round(r.id, 'time_up', r.deadline);
  end if;
  return jsonb_build_object('ok', true, 'round', public.round_view(r.id), 'clock', public.db_clock());
end;
$$;

-- Nothing calls it any more: the server's timestamps it bounded are no longer sent.
drop function public.bounded_time(timestamptz, integer);

revoke all on function public.ms_before_now(integer, integer) from public, anon, authenticated;
revoke all on function public.db_clock() from public, anon, authenticated;
revoke all on function public.player_state(uuid) from public, anon, authenticated;
revoke all on function public.start_round(uuid, uuid, text[], integer, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.submit_answers(uuid, uuid, jsonb, integer) from public, anon, authenticated;
revoke all on function public.finish_round(uuid, uuid) from public, anon, authenticated;

grant execute on function public.ms_before_now(integer, integer) to service_role;
grant execute on function public.db_clock() to service_role;
grant execute on function public.player_state(uuid) to service_role;
grant execute on function public.start_round(uuid, uuid, text[], integer, integer, integer, integer, integer) to service_role;
grant execute on function public.submit_answers(uuid, uuid, jsonb, integer) to service_role;
grant execute on function public.finish_round(uuid, uuid) to service_role;

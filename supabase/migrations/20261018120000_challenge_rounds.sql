-- Quick Challenge rounds, run by the server: starting a round spends one attempt, answers are received and
-- scored as they arrive, and the result is the server's. See docs/PLAYER-BACKEND.md ("Rounds").
-- Prepared, not applied. Needs 20261017120000_player_foundation.sql, which it leaves as it is: it adds
-- tables and functions, and replaces two of that migration's functions (player_state, ensure_player)
-- with versions that also report rounds and end those whose time has run out.
--
-- One clock: the database's. A round's start, its deadline and every answer's arrival are its now().
-- The rules each round is played by (its length, the network allowance after the deadline, the gap between
-- answers) come from the app's server (src/core/challenge/serverRound.ts) and are stored on the round, so a
-- change of rules never touches a round already under way.
--
-- Private, like the foundation: row level security on, no policies, no privileges for anon or
-- authenticated; only the server (service_role) calls the functions.

create table public.challenge_rounds (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  -- The device's id for one press of Start: a retried request finds the same round.
  request_id uuid not null,
  -- The questions, in order: drawn by the server.
  questions text[] not null,
  duration_ms integer not null,
  -- How long after the deadline an answer still counts (it was sent in time, the network was slow).
  grace_ms integer not null,
  -- The least time between two answers (each answer's feedback shows this long).
  feedback_ms integer not null,
  started_at timestamptz not null default now(),
  deadline timestamptz not null,
  status text not null default 'playing',
  end_reason text,
  ended_at timestamptz,
  score integer,
  elapsed_ms integer,
  constraint challenge_rounds_request unique (player_id, request_id),
  constraint challenge_rounds_questions check (cardinality(questions) between 1 and 50),
  constraint challenge_rounds_rules check (duration_ms > 0 and grace_ms >= 0 and feedback_ms >= 0),
  constraint challenge_rounds_state check (
    (status = 'playing' and end_reason is null and ended_at is null and score is null and elapsed_ms is null)
    or (status = 'finished' and end_reason in ('completed', 'time_up') and ended_at is not null and score is not null and elapsed_ms is not null)
  )
);

-- At most one round under way per player, whatever the tabs or retries.
create unique index challenge_rounds_one_active on public.challenge_rounds (player_id) where status = 'playing';
create index challenge_rounds_player on public.challenge_rounds (player_id, started_at desc);

-- Answers as the server received them: one per question, in order.
create table public.challenge_answers (
  round_id uuid not null references public.challenge_rounds (id) on delete cascade,
  question_index smallint not null,
  -- The country tapped; null for Skip.
  country text,
  outcome text not null check (outcome in ('correct', 'wrong', 'skipped')),
  -- When the device says it was given, from its start of the round. Not evidence of anything: kept for review only.
  client_at_ms integer not null,
  received_at timestamptz not null default now(),
  -- 'too_soon': it arrived sooner after the start than its question could have been reached (question n not
  -- before n feedback gaps, on the server's clock): kept as skipped, never counted.
  voided_reason text check (voided_reason in ('too_soon')),
  -- The device's own time did not fit (closer than one gap to the last answer, or ahead of the server's clock by
  -- more than a second). Never voids an answer: a flag for review, since a device's clock can drift.
  client_time_suspect boolean not null default false,
  primary key (round_id, question_index)
);

-- Each player's best finished round: most correct answers, then the shortest time. Private until the
-- player saves a name (nothing reads it publicly yet).
create table public.challenge_best (
  player_id uuid primary key references public.players (id) on delete cascade,
  round_id uuid not null references public.challenge_rounds (id) on delete cascade,
  score integer not null,
  elapsed_ms integer not null,
  achieved_at timestamptz not null
);

alter table public.challenge_rounds enable row level security;
alter table public.challenge_answers enable row level security;
alter table public.challenge_best enable row level security;

revoke all on table public.challenge_rounds, public.challenge_answers, public.challenge_best from anon, authenticated;
grant select, insert, update, delete on table public.challenge_rounds, public.challenge_answers, public.challenge_best to service_role;

-- --- Internal helpers -------------------------------------------------------------------------------------

create function public.epoch_ms(p_time timestamptz)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select floor(extract(epoch from p_time) * 1000)::bigint
$$;

-- A round as the server reports it.
create function public.round_view(p_round uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id,
    'questions', to_jsonb(r.questions),
    'started_at_ms', public.epoch_ms(r.started_at),
    'deadline_ms', public.epoch_ms(r.deadline),
    'duration_ms', r.duration_ms,
    'grace_ms', r.grace_ms,
    'feedback_ms', r.feedback_ms,
    'status', r.status,
    'end_reason', r.end_reason,
    'score', r.score,
    'elapsed_ms', r.elapsed_ms,
    'answers', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'index', a.question_index,
          'country', a.country,
          'outcome', a.outcome,
          'elapsed_ms', public.epoch_ms(a.received_at) - public.epoch_ms(r.started_at),
          'voided', a.voided_reason is not null)
        order by a.question_index)
       from public.challenge_answers a where a.round_id = r.id),
      '[]'::jsonb)
  )
  from public.challenge_rounds r
  where r.id = p_round
$$;

-- Keeps the player's best: a finished round replaces it only if it has more correct answers, or as many in less time.
create function public.record_best(p_round uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.challenge_best as b (player_id, round_id, score, elapsed_ms, achieved_at)
    select r.player_id, r.id, r.score, r.elapsed_ms, r.ended_at from public.challenge_rounds r
    where r.id = p_round and r.status = 'finished'
  on conflict (player_id) do update
    set round_id = excluded.round_id, score = excluded.score, elapsed_ms = excluded.elapsed_ms, achieved_at = excluded.achieved_at
    where excluded.score > b.score or (excluded.score = b.score and excluded.elapsed_ms < b.elapsed_ms);
end;
$$;

-- Ends a round under way, scored from the answers received. Completed: timed to its last answer (at most its
-- length). Time up: its whole length. The caller holds the round's row lock.
create function public.end_round(p_round uuid, p_reason text, p_ended_at timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.challenge_rounds r
    set status = 'finished',
        end_reason = p_reason,
        ended_at = p_ended_at,
        score = (select count(*) from public.challenge_answers a where a.round_id = r.id and a.outcome = 'correct'),
        elapsed_ms = case
          when p_reason = 'completed' then least(r.duration_ms, greatest(0, public.epoch_ms(p_ended_at) - public.epoch_ms(r.started_at)))::integer
          else r.duration_ms
        end
    where r.id = p_round and r.status = 'playing';
  perform public.record_best(p_round);
end;
$$;

-- Ends the player's rounds whose time (and network allowance) has run out: abandoned, or never finished by
-- the device. Scored from the answers that arrived; the attempt stays spent.
create function public.end_due_rounds(p_player uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_round record;
begin
  for v_round in
    select r.id, r.deadline from public.challenge_rounds r
    where r.player_id = p_player and r.status = 'playing' and now() > r.deadline + r.grace_ms * interval '1 millisecond'
    for update
  loop
    perform public.end_round(v_round.id, 'time_up', v_round.deadline);
  end loop;
end;
$$;

-- --- The foundation's player functions, now with rounds ----------------------------------------------------

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
    'server_now_ms', public.epoch_ms(clock_timestamp())
  )
  from public.players p
  where p.id = p_player
$$;

-- As before (the player's row and one initial attempt, safe to repeat and to race), and then ends any round whose
-- time has run out, so the state never shows one as under way.
--
-- Locks are always taken in one order: the player's row, then their rounds, then their best result. So this locks
-- the player's row before ending rounds, as start_round does (and as the foundation's set_display_name and
-- claim_all_europe_stars do after calling this); submit_answers and finish_round lock one round, then the best
-- result, and never the player's row. No two of them can wait on each other.
create or replace function public.ensure_player(p_player uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  insert into public.players (id) values (p_player) on conflict (id) do nothing;
  insert into public.attempt_grants (player_id, kind, attempts) values (p_player, 'initial', 1) on conflict do nothing;
  perform 1 from public.players where id = p_player for update;
  perform public.end_due_rounds(p_player);
  return public.player_state(p_player);
end;
$$;

-- --- Rounds -----------------------------------------------------------------------------------------------

-- Start: the round under way if there is one (the same request retried, a double press, another tab),
-- otherwise a new round, spending one attempt. A player's starts are serialized by a lock on their row,
-- and rounds whose time has run out are ended first. { ok: false, problem: 'no_attempts' } when none are left.
create function public.start_round(
  p_player uuid,
  p_request_id uuid,
  p_questions text[],
  p_duration_ms integer,
  p_grace_ms integer,
  p_feedback_ms integer
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_round uuid;
  v_left bigint;
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

  insert into public.challenge_rounds (player_id, request_id, questions, duration_ms, grace_ms, feedback_ms, deadline)
    values (p_player, p_request_id, p_questions, p_duration_ms, p_grace_ms, p_feedback_ms, now() + p_duration_ms * interval '1 millisecond')
    returning id into v_round;
  return jsonb_build_object('ok', true, 'reused', false, 'round', public.round_view(v_round), 'state', public.player_state(p_player));
end;
$$;

-- Answers, in the order given: [{ index, country (null: Skip), at_ms }]. Each gets a receipt:
-- - 'accepted', scored against the round's own question (an answer breaking the rhythm is kept as skipped, voided);
-- - 'duplicate' (the same answer already received: a retry) or 'conflict' (another answer to that question
--   was received first, from another tab), with the outcome received;
-- - 'out_of_order' (not the next question: the device must catch up from the round), or 'late' (the round has ended).
-- The rhythm, on the server's clock alone: question n (from 0) can not arrive sooner than n feedback gaps after the
-- start, since each question shows only after the last answer's feedback. That bound holds for every honest device
-- however the network delays or bunches its answers (delay only makes them later), so answers queued while offline
-- and arriving together are accepted, in order, until the deadline's allowance. What it can not do is enforce the
-- gap between two answers that arrive together: a device may send several at once once its time allows. The
-- device's own times are never trusted either way; they only flag an answer for review (client_time_suspect).
create function public.submit_answers(p_player uuid, p_round uuid, p_answers jsonb)
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
  if r.status = 'playing' and now() > r.deadline + r.grace_ms * interval '1 millisecond' then
    perform public.end_round(r.id, 'time_up', r.deadline);
    select * into r from public.challenge_rounds where id = p_round;
  end if;
  v_elapsed := public.epoch_ms(now()) - public.epoch_ms(r.started_at);

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
    if r.status <> 'playing' then
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
    insert into public.challenge_answers (round_id, question_index, country, outcome, client_at_ms, voided_reason, client_time_suspect)
      values (r.id, v_index, v_country, v_outcome, coalesce(v_at, 0), v_void, v_suspect);
    v_receipts := v_receipts || jsonb_build_object('index', v_index, 'status', 'accepted', 'outcome', v_outcome, 'voided', v_void is not null);

    if v_index + 1 = cardinality(r.questions) then
      perform public.end_round(r.id, 'completed', now());
      select * into r from public.challenge_rounds where id = p_round;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'receipts', v_receipts, 'round', public.round_view(r.id), 'server_now_ms', public.epoch_ms(clock_timestamp()));
end;
$$;

-- A round, ended first if its time has run out: the device asks for it to confirm its result.
create function public.finish_round(p_player uuid, p_round uuid)
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
  if r.status = 'playing' and now() > r.deadline + r.grace_ms * interval '1 millisecond' then
    perform public.end_round(r.id, 'time_up', r.deadline);
  end if;
  return jsonb_build_object('ok', true, 'round', public.round_view(r.id), 'server_now_ms', public.epoch_ms(clock_timestamp()));
end;
$$;

-- --- Privileges -------------------------------------------------------------------------------------------

revoke all on function public.epoch_ms(timestamptz) from public, anon, authenticated;
revoke all on function public.round_view(uuid) from public, anon, authenticated;
revoke all on function public.record_best(uuid) from public, anon, authenticated;
revoke all on function public.end_round(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.end_due_rounds(uuid) from public, anon, authenticated;
revoke all on function public.player_state(uuid) from public, anon, authenticated;
revoke all on function public.ensure_player(uuid) from public, anon, authenticated;
revoke all on function public.start_round(uuid, uuid, text[], integer, integer, integer) from public, anon, authenticated;
revoke all on function public.submit_answers(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.finish_round(uuid, uuid) from public, anon, authenticated;

grant execute on function public.epoch_ms(timestamptz) to service_role;
grant execute on function public.round_view(uuid) to service_role;
grant execute on function public.record_best(uuid) to service_role;
grant execute on function public.end_round(uuid, text, timestamptz) to service_role;
grant execute on function public.end_due_rounds(uuid) to service_role;
grant execute on function public.player_state(uuid) to service_role;
grant execute on function public.ensure_player(uuid) to service_role;
grant execute on function public.start_round(uuid, uuid, text[], integer, integer, integer) to service_role;
grant execute on function public.submit_answers(uuid, uuid, jsonb) to service_role;
grant execute on function public.finish_round(uuid, uuid) to service_role;

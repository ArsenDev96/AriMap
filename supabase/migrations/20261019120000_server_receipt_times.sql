-- Quick Challenge rounds timed from the app server's receipt of each request, not from when the database gets to it.
-- See docs/PLAYER-BACKEND.md ("Timing"). Prepared, not applied. Needs 20261018120000_challenge_rounds.sql, which it
-- leaves as it is: it adds a column and replaces round functions (start_round and submit_answers take the server's
-- times; the old signatures are dropped).
--
-- The app's server notes when each request arrived, before it checks the token or calls the database, and when a
-- start's token has been verified. The database still decides everything else under its locks; it only bounds those
-- times by its own clock: never later than its now(), never earlier than one settle window before it. So a server
-- clock that runs ahead or behind can only make times later, never earlier.
--
-- - An answer counts if it arrived by the deadline plus the allowance (grace_ms, unchanged).
-- - A round starts when its start request's token has been verified: the deadline is that plus its length.
-- - Rounds under way are ended by the database only once the deadline, the allowance and the settle window have all
--   passed (settle_ms), so a request that arrived in time but is still being checked is never shut out.

alter table public.challenge_rounds add column settle_ms integer not null default 5000;
alter table public.challenge_rounds add constraint challenge_rounds_settle check (settle_ms >= 0);

-- A time from the app's server, bounded by the database's clock: never after now(), never more than `p_window_ms` before.
create function public.bounded_time(p_time timestamptz, p_window_ms integer)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select least(greatest(p_time, now() - p_window_ms * interval '1 millisecond'), now())
$$;

create or replace function public.round_view(p_round uuid)
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
    'settle_ms', r.settle_ms,
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

-- Ended only once the deadline, the allowance and the settle window have passed.
create or replace function public.end_due_rounds(p_player uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_round record;
begin
  for v_round in
    select r.id, r.deadline from public.challenge_rounds r
    where r.player_id = p_player and r.status = 'playing'
      and now() > r.deadline + (r.grace_ms + r.settle_ms) * interval '1 millisecond'
    for update
  loop
    perform public.end_round(v_round.id, 'time_up', v_round.deadline);
  end loop;
end;
$$;

drop function public.start_round(uuid, uuid, text[], integer, integer, integer);

-- As before (one attempt spent, under the player's lock; the round under way for a retry, a double press or another
-- tab), with the start at `p_started_at`: when the app's server verified this request's token.
create function public.start_round(
  p_player uuid,
  p_request_id uuid,
  p_questions text[],
  p_duration_ms integer,
  p_grace_ms integer,
  p_settle_ms integer,
  p_feedback_ms integer,
  p_started_at timestamptz
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

  v_start := public.bounded_time(p_started_at, p_settle_ms);
  insert into public.challenge_rounds (player_id, request_id, questions, duration_ms, grace_ms, settle_ms, feedback_ms, started_at, deadline)
    values (p_player, p_request_id, p_questions, p_duration_ms, p_grace_ms, p_settle_ms, p_feedback_ms, v_start, v_start + p_duration_ms * interval '1 millisecond')
    returning id into v_round;
  return jsonb_build_object('ok', true, 'reused', false, 'round', public.round_view(v_round), 'state', public.player_state(p_player));
end;
$$;

drop function public.submit_answers(uuid, uuid, jsonb);

-- As before (receipts: accepted, duplicate, conflict, out_of_order, late; one lock on the round; in order), with every
-- answer of the request received at `p_received_at`: when the request reached the app's server, before its token was
-- checked. That time, bounded by the database's clock and never earlier than the round's last answer, decides whether
-- an answer is in time (by the deadline plus the allowance), the rhythm's bound (question n not before n feedback gaps
-- after the start), and a completed round's time.
create function public.submit_answers(p_player uuid, p_round uuid, p_answers jsonb, p_received_at timestamptz)
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
  v_received := public.bounded_time(p_received_at, r.settle_ms);
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

  return jsonb_build_object('ok', true, 'receipts', v_receipts, 'round', public.round_view(r.id));
end;
$$;

-- As before, ending the round only once the settle window has passed too.
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
  return jsonb_build_object('ok', true, 'round', public.round_view(r.id));
end;
$$;

revoke all on function public.bounded_time(timestamptz, integer) from public, anon, authenticated;
revoke all on function public.round_view(uuid) from public, anon, authenticated;
revoke all on function public.end_due_rounds(uuid) from public, anon, authenticated;
revoke all on function public.start_round(uuid, uuid, text[], integer, integer, integer, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.submit_answers(uuid, uuid, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.finish_round(uuid, uuid) from public, anon, authenticated;

grant execute on function public.bounded_time(timestamptz, integer) to service_role;
grant execute on function public.round_view(uuid) to service_role;
grant execute on function public.end_due_rounds(uuid) to service_role;
grant execute on function public.start_round(uuid, uuid, text[], integer, integer, integer, integer, timestamptz) to service_role;
grant execute on function public.submit_answers(uuid, uuid, jsonb, timestamptz) to service_role;
grant execute on function public.finish_round(uuid, uuid) to service_role;

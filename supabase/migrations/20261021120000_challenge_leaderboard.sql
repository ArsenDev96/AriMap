-- The Quick Challenge's all-time leaderboard. See docs/PLAYER-BACKEND.md ("Leaderboard"). Prepared, not applied.
-- Needs 20261018120000_challenge_rounds.sql (challenge_best) and leaves every earlier migration as it is: it adds two
-- moderation flags (both visible by default), one index and one function.
--
-- Read from what is already stored: each player's best confirmed round (challenge_best, kept by record_best when the
-- server ends a round), ranked by the same rule that keeps it: most correct answers, then the shortest time. Only
-- players with a display name appear; a player without one (never saved, or cleared) stays private. Players and
-- results hidden by moderation are left out before anything is ranked, the asking player's own place included.
-- Equal scores and times share a rank (1, 1, 3); rows with the same rank are shown earliest achieved first, then by
-- player id, so the order never changes between two reads of the same data.
--
-- Private, like the rest: the tables keep row level security with no policies, and only the server (service_role)
-- calls the function. It returns display fields only (rank, name, score, its total, time) and, for the player asking
-- (from their verified session, never from the request), whether a row is theirs: no player ids, sessions, answers
-- or other private data.

-- Moderation, from the Supabase dashboard only (docs/PLAYER-BACKEND.md, "Hiding an entry"). The tables keep row level
-- security with no policies and no privileges for anon or authenticated, and no function sets these columns, so no
-- browser can change them. Hiding never deletes anything: clearing the flag restores the entry as it was.
alter table public.players add column leaderboard_hidden boolean not null default false;
comment on column public.players.leaderboard_hidden is
  'Moderation: true keeps this player off the Quick Challenge leaderboard, whatever their name or results. Set from the dashboard only.';
-- A result is hidden through its round: challenge_best is replaced when the player does better, and a better round,
-- not hidden, then shows. The best kept stays the hidden one until then (no second-best is shown).
alter table public.challenge_rounds add column leaderboard_hidden boolean not null default false;
comment on column public.challenge_rounds.leaderboard_hidden is
  'Moderation: true keeps this round off the Quick Challenge leaderboard while it is the player''s best. Set from the dashboard only.';

-- The ranking's order, for reading the top of the board.
create index challenge_best_ranking on public.challenge_best (score desc, elapsed_ms, achieved_at, player_id);

-- The top `p_limit` (1 to 100) named players; the asking player's own row when it is not among them; and whether
-- they have a best result kept private for want of a name. Hidden players and results are neither shown nor ranked.
create function public.challenge_leaderboard(p_player uuid, p_limit integer)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with ranked as (
    select
      b.player_id,
      p.display_name,
      b.score,
      cardinality(r.questions) as total,
      b.elapsed_ms,
      rank() over (order by b.score desc, b.elapsed_ms) as rank,
      row_number() over (order by b.score desc, b.elapsed_ms, b.achieved_at, b.player_id) as position
    from public.challenge_best b
    join public.players p on p.id = b.player_id
    join public.challenge_rounds r on r.id = b.round_id
    where p.display_name is not null and not p.leaderboard_hidden and not r.leaderboard_hidden
  ),
  shown as (
    select * from ranked where position <= least(greatest(coalesce(p_limit, 50), 1), 100)
  )
  select jsonb_build_object(
    'entries', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'rank', s.rank,
          'display_name', s.display_name,
          'score', s.score,
          'total', s.total,
          'elapsed_ms', s.elapsed_ms,
          'is_you', s.player_id = p_player)
        order by s.position)
       from shown s),
      '[]'::jsonb),
    'own', (
      select jsonb_build_object(
        'rank', r.rank,
        'display_name', r.display_name,
        'score', r.score,
        'total', r.total,
        'elapsed_ms', r.elapsed_ms,
        'is_you', true)
      from ranked r
      where r.player_id = p_player and not exists (select 1 from shown s where s.player_id = p_player)),
    -- Only for the want of a name: a hidden player or result is not told to add one.
    'private_best', exists (
      select 1 from public.challenge_best b
      join public.players p on p.id = b.player_id
      join public.challenge_rounds r on r.id = b.round_id
      where b.player_id = p_player and p.display_name is null and not p.leaderboard_hidden and not r.leaderboard_hidden)
  )
$$;

revoke all on function public.challenge_leaderboard(uuid, integer) from public, anon, authenticated;
grant execute on function public.challenge_leaderboard(uuid, integer) to service_role;

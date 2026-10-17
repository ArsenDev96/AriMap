-- AriMap players: anonymous identity, optional display name, and the Quick Challenge attempt ledger.
-- See docs/PLAYER-BACKEND.md. Prepared, not applied: run it in the Supabase SQL editor of each project.
--
-- Everything here is private. Row level security is on with no policies, and the anon and authenticated
-- roles have no privileges on the tables or functions: only the app's server (the secret key, role
-- service_role) calls the functions, with a player id it has taken from a verified session.
--
-- The rules mirror src/core/player (attempts.ts, displayName.ts): keep them in step.

-- One row per player: a Supabase Auth user (anonymous until linked to an account, later).
create table public.players (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Optional; null until saved. Not an identity: names need not be unique.
  display_name text,
  created_at timestamptz not null default now(),
  constraint players_display_name_form check (
    display_name is null or (char_length(display_name) between 2 and 20 and display_name is nfc normalized)
  )
);

-- Every name saved or cleared, for the rate limit (3 changes in any 24 hours) and for moderation.
create table public.display_name_changes (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players (id) on delete cascade,
  -- Null: the name was cleared.
  display_name text,
  changed_at timestamptz not null default now()
);

create index display_name_changes_player_time on public.display_name_changes (player_id, changed_at desc);

-- The attempt ledger: each row adds attempts. (Rounds, which spend them, come with the server-managed rounds.)
create table public.attempt_grants (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players (id) on delete cascade,
  kind text not null,
  attempts integer not null,
  -- A rewarded ad's provider and its transaction id; null for the other kinds.
  provider text,
  provider_transaction_id text,
  granted_at timestamptz not null default now(),
  constraint attempt_grants_kind check (kind in ('initial', 'all_europe_stars', 'rewarded_ad')),
  constraint attempt_grants_attempts check (
    (kind = 'initial' and attempts = 1)
    or (kind = 'all_europe_stars' and attempts = 2)
    or (kind = 'rewarded_ad' and attempts = 1)
  ),
  constraint attempt_grants_transaction check (
    case
      when kind = 'rewarded_ad' then provider is not null and provider_transaction_id is not null
      else provider is null and provider_transaction_id is null
    end
  )
);

-- The initial attempt and the all-stars reward: once per player.
create unique index attempt_grants_one_time on public.attempt_grants (player_id, kind)
  where kind in ('initial', 'all_europe_stars');

-- Rewarded ads: as many as earned, each provider transaction only once (whichever player claims it).
create unique index attempt_grants_ad_transaction on public.attempt_grants (provider, provider_transaction_id)
  where kind = 'rewarded_ad';

-- The device's report of all 36 stars across the fixed 12 Europe lessons, as accepted for the reward.
-- claimed_at is when the server accepted the report, not when the stars were earned (saved lesson progress
-- records no dates), and the stars themselves are self-reported (lesson progress lives on the device).
-- The future Europe Geography Master award will record its own issue date; it is not this one.
create table public.europe_stars_claims (
  player_id uuid primary key references public.players (id) on delete cascade,
  claimed_at timestamptz not null default now(),
  snapshot jsonb not null
);

alter table public.players enable row level security;
alter table public.display_name_changes enable row level security;
alter table public.attempt_grants enable row level security;
alter table public.europe_stars_claims enable row level security;

revoke all on table public.players, public.display_name_changes, public.attempt_grants, public.europe_stars_claims
  from anon, authenticated;
grant select, insert, update, delete on table public.players, public.display_name_changes, public.attempt_grants, public.europe_stars_claims
  to service_role;

-- --- Functions (each one transaction) -------------------------------------------------------------------

-- The player as the server reports it. Kinds and times are converted by the server (src/server/playerStore.ts).
create function public.player_state(p_player uuid)
returns jsonb
language sql
stable
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
    -- With 3 changes in the last 24 hours, the next is possible once the oldest of them is 24 hours old.
    'name_change_blocked_until', (
      select n.changed_at + interval '24 hours' from public.display_name_changes n
      where n.player_id = p.id and n.changed_at > now() - interval '24 hours'
      order by n.changed_at desc offset 2 limit 1)
  )
  from public.players p
  where p.id = p_player
$$;

-- The player's row and their one initial attempt, created on first use. Safe to repeat and to race.
create function public.ensure_player(p_player uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  insert into public.players (id) values (p_player) on conflict (id) do nothing;
  insert into public.attempt_grants (player_id, kind, attempts) values (p_player, 'initial', 1) on conflict do nothing;
  return public.player_state(p_player);
end;
$$;

-- The one-time +2 attempts. The server has already checked the snapshot (all 36 stars); this repeats the
-- count as a guard. A repeated or simultaneous claim grants nothing more: { granted: false }.
create function public.claim_all_europe_stars(p_player uuid, p_snapshot jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_grant bigint;
begin
  if jsonb_typeof(p_snapshot) is distinct from 'object'
     or (select count(*) from jsonb_each(p_snapshot)) <> 12
     or (select count(*) from jsonb_each(p_snapshot) e where e.value = '3'::jsonb) <> 12 then
    raise exception 'snapshot does not hold all 36 stars' using errcode = '22023';
  end if;
  perform public.ensure_player(p_player);
  insert into public.europe_stars_claims (player_id, snapshot) values (p_player, p_snapshot) on conflict (player_id) do nothing;
  insert into public.attempt_grants (player_id, kind, attempts) values (p_player, 'all_europe_stars', 2)
    on conflict do nothing
    returning id into v_grant;
  return jsonb_build_object('granted', v_grant is not null, 'state', public.player_state(p_player));
end;
$$;

-- Saves (or, with null, clears) the display name, already validated by the server. At most 3 changes in
-- any 24 hours; saving the current name again is not a change. Changes for one player are serialized.
create function public.set_display_name(p_player uuid, p_name text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_current text;
  v_retry_at timestamptz;
begin
  perform public.ensure_player(p_player);
  select display_name into v_current from public.players where id = p_player for update;
  if v_current is not distinct from p_name then
    return jsonb_build_object('ok', true, 'state', public.player_state(p_player));
  end if;
  select n.changed_at + interval '24 hours' into v_retry_at from public.display_name_changes n
    where n.player_id = p_player and n.changed_at > now() - interval '24 hours'
    order by n.changed_at desc offset 2 limit 1;
  if v_retry_at is not null then
    return jsonb_build_object('ok', false, 'retry_at', v_retry_at);
  end if;
  update public.players set display_name = p_name where id = p_player;
  insert into public.display_name_changes (player_id, display_name) values (p_player, p_name);
  return jsonb_build_object('ok', true, 'state', public.player_state(p_player));
end;
$$;

-- For later: +1 attempt for a rewarded ad, once the provider's server has verified it. Nothing calls this
-- yet. A transaction id already granted (to anyone) grants nothing more: { granted: false }.
create function public.grant_rewarded_ad(p_player uuid, p_provider text, p_transaction_id text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_grant bigint;
begin
  perform public.ensure_player(p_player);
  insert into public.attempt_grants (player_id, kind, attempts, provider, provider_transaction_id)
    values (p_player, 'rewarded_ad', 1, p_provider, p_transaction_id)
    on conflict do nothing
    returning id into v_grant;
  return jsonb_build_object('granted', v_grant is not null, 'state', public.player_state(p_player));
end;
$$;

revoke all on function public.player_state(uuid) from public, anon, authenticated;
revoke all on function public.ensure_player(uuid) from public, anon, authenticated;
revoke all on function public.claim_all_europe_stars(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.set_display_name(uuid, text) from public, anon, authenticated;
revoke all on function public.grant_rewarded_ad(uuid, text, text) from public, anon, authenticated;

grant execute on function public.player_state(uuid) to service_role;
grant execute on function public.ensure_player(uuid) to service_role;
grant execute on function public.claim_all_europe_stars(uuid, jsonb) to service_role;
grant execute on function public.set_display_name(uuid, text) to service_role;
grant execute on function public.grant_rewarded_ad(uuid, text, text) to service_role;

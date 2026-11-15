-- Critical — classement mondial de Genèse.
-- À coller tel quel dans Supabase : SQL Editor → New query → Run. Peut être relancé sans risque.
--
-- Principe de sécurité : les tables sont fermées (RLS activé, aucune policy). La clé publique de l'application ne peut
-- ni les lire ni les écrire directement ; tout passe par les 4 fonctions ci-dessous, qui valident ce qu'elles reçoivent.
-- Un joueur est identifié par un secret aléatoire créé sur son appareil ; seule son empreinte (sha256) est stockée.

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  secret_hash text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists players_name_key on public.players (lower(name));

create table if not exists public.scores (
  player_id uuid not null references public.players (id) on delete cascade,
  board text not null,                 -- 'all' (mondial) ou 'day:AAAA-MM-JJ' (univers du jour)
  score integer not null,
  sector integer not null,
  tier integer not null,               -- plus gros astre atteint (0 à 12)
  seed bigint, log jsonb, steps integer, -- graine + journal des lâchers : permet de rejouer la partie pour la vérifier
  updated_at timestamptz not null default now(),
  primary key (player_id, board)
);
create index if not exists scores_board_score on public.scores (board, score desc, updated_at);

alter table public.players enable row level security;
alter table public.scores enable row level security;
revoke all on public.players, public.scores from anon, authenticated;

create or replace function public.critical_hash(p_secret text) returns text
language sql immutable as $$ select encode(sha256(convert_to(p_secret, 'UTF8')), 'hex') $$;

-- Choisir ou changer son pseudo (3 à 16 caractères : lettres, chiffres, espace, . _ -). Unique sans tenir compte de la casse.
create or replace function public.register(p_secret text, p_name text) returns json
language plpgsql security definer set search_path = public as $$
declare v_name text := btrim(p_name);
begin
  if p_secret is null or length(p_secret) < 20 or length(p_secret) > 200 then raise exception 'invalid_secret'; end if;
  if v_name is null or v_name !~ '^[[:alnum:] ._-]{3,16}$' then raise exception 'invalid_name'; end if;
  begin
    insert into players (secret_hash, name) values (critical_hash(p_secret), v_name)
    on conflict (secret_hash) do update set name = excluded.name;
  exception when unique_violation then raise exception 'name_taken';
  end;
  return json_build_object('name', v_name);
end $$;

-- Envoyer un score. Seul le meilleur score par tableau est gardé. Renvoie le rang.
create or replace function public.submit_score(p_secret text, p_board text, p_score integer, p_sector integer, p_tier integer, p_seed bigint, p_log jsonb, p_steps integer) returns json
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_drops integer; v_last timestamptz; v_best integer; v_rank bigint; v_total bigint;
begin
  select id into v_id from players where secret_hash = critical_hash(p_secret);
  if v_id is null then raise exception 'unknown_player'; end if;
  if p_board <> 'all' and p_board !~ '^day:\d{4}-\d{2}-\d{2}$' then raise exception 'invalid_board'; end if;
  -- univers du jour : seulement pour aujourd'hui (un jour de marge pour les fuseaux horaires)
  if p_board <> 'all' and abs(substr(p_board, 5)::date - (now() at time zone 'utc')::date) > 1 then raise exception 'invalid_day'; end if;
  if p_log is null or jsonb_typeof(p_log) <> 'array' or jsonb_array_length(p_log) > 40000 then raise exception 'invalid_log'; end if;
  v_drops := jsonb_array_length(p_log) / 2;
  -- garde-fous de plausibilité (le rejeu complet du journal, lui, se fait hors de la base)
  if p_score < 0 or p_sector < 1 or p_sector > 500 or p_tier < 0 or p_tier > 12 or p_steps < 1
     or p_score > 2500 * v_drops + 50000   -- aucun lâcher ne rapporte autant en moyenne
     or p_steps < v_drops * 30             -- 0,3 s minimum entre deux lâchers (120 pas par seconde)
  then raise exception 'implausible'; end if;
  select updated_at into v_last from scores where player_id = v_id and board = p_board;
  if v_last is not null and v_last > now() - interval '10 seconds' then raise exception 'too_fast'; end if;
  insert into scores (player_id, board, score, sector, tier, seed, log, steps) values (v_id, p_board, p_score, p_sector, p_tier, p_seed, p_log, p_steps)
  on conflict (player_id, board) do update set score = excluded.score, sector = excluded.sector, tier = excluded.tier, seed = excluded.seed, log = excluded.log, steps = excluded.steps, updated_at = now()
  where excluded.score > scores.score;
  select score into v_best from scores where player_id = v_id and board = p_board;
  select count(*) + 1 into v_rank from scores where board = p_board and score > v_best;
  select count(*) into v_total from scores where board = p_board;
  return json_build_object('rank', v_rank, 'total', v_total, 'best', v_best);
end $$;

-- Lire une page du classement (50 lignes par défaut, 100 au plus).
create or replace function public.leaderboard(p_board text, p_offset integer default 0, p_limit integer default 50)
returns table (rank bigint, name text, score integer, sector integer, tier integer)
language sql stable security definer set search_path = public as $$
  select r.rank, r.name, r.score, r.sector, r.tier from (
    select row_number() over (order by s.score desc, s.updated_at asc) as rank, p.name, s.score, s.sector, s.tier
    from scores s join players p on p.id = s.player_id where s.board = p_board
  ) r order by r.rank offset greatest(p_offset, 0) limit least(greatest(p_limit, 1), 100)
$$;

-- Mon rang sur un tableau (null si je n'y ai pas encore de score).
create or replace function public.my_rank(p_secret text, p_board text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('name', p.name, 'score', s.score,
    'rank', (select count(*) + 1 from scores o where o.board = s.board and o.score > s.score),
    'total', (select count(*) from scores o where o.board = s.board))
  from players p join scores s on s.player_id = p.id
  where p.secret_hash = critical_hash(p_secret) and s.board = p_board
$$;

revoke all on function public.register(text, text), public.submit_score(text, text, integer, integer, integer, bigint, jsonb, integer), public.leaderboard(text, integer, integer), public.my_rank(text, text), public.critical_hash(text) from public;
grant execute on function public.register(text, text), public.submit_score(text, text, integer, integer, integer, bigint, jsonb, integer), public.leaderboard(text, integer, integer), public.my_rank(text, text) to anon, authenticated;

-- Critical — classement mondial et profils publics.
-- À coller tel quel dans Supabase : SQL Editor → New query → Run. Peut être relancé sans risque.
--
-- Principe de sécurité : les tables sont fermées (RLS activé, aucune policy). La clé publique de l'application ne peut
-- ni les lire ni les écrire directement ; tout passe par les 4 fonctions ci-dessous, qui valident ce qu'elles reçoivent.
-- Un joueur est identifié par un secret aléatoire créé sur son appareil ; seule son empreinte (sha256) est stockée.
-- Mise à jour d'une base existante : recoller ce fichier en entier suffit (les colonnes de profil sont ajoutées, rien n'est perdu).

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  secret_hash text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);
-- profil public : vitrine (jusqu'à 3 astres, au format 'rang' ou 'rang:variante'), devise, nombre de découvertes du codex
alter table public.players add column if not exists motto text not null default '';
alter table public.players add column if not exists featured text[] not null default '{}';
alter table public.players add column if not exists codex integer not null default 0;
alter table public.players add column if not exists profile_at timestamptz;
-- temps de jeu actif en secondes (déclaré par l'appareil, mais borné par le temps réellement écoulé : voir report_playtime)
alter table public.players add column if not exists playtime integer not null default 0;
alter table public.players add column if not exists play_at timestamptz;
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

-- Lire une page du classement (50 lignes par défaut, 100 au plus). badge = premier astre de la vitrine du joueur.
drop function if exists public.leaderboard(text, integer, integer); -- le type de retour a changé (colonne badge)
create or replace function public.leaderboard(p_board text, p_offset integer default 0, p_limit integer default 50)
returns table (rank bigint, name text, score integer, sector integer, tier integer, badge text)
language sql stable security definer set search_path = public as $$
  select r.rank, r.name, r.score, r.sector, r.tier, r.badge from (
    select row_number() over (order by s.score desc, s.updated_at asc) as rank, p.name, s.score, s.sector, s.tier, p.featured[1] as badge
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

-- Modifier son profil public : vitrine (0 à 3 astres distincts), devise (40 caractères au plus), nombre de découvertes.
-- La vitrine est déclarative : le serveur vérifie le format, pas que l'astre a vraiment été obtenu.
create or replace function public.set_profile(p_secret text, p_featured text[], p_motto text, p_codex integer) returns json
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_last timestamptz; v_motto text := btrim(coalesce(p_motto, '')); v_feat text[] := coalesce(p_featured, '{}');
begin
  select id, profile_at into v_id, v_last from players where secret_hash = critical_hash(p_secret);
  if v_id is null then raise exception 'unknown_player'; end if;
  if v_last is not null and v_last > now() - interval '3 seconds' then raise exception 'too_fast'; end if;
  if coalesce(array_length(v_feat, 1), 0) > 3
     or exists (select 1 from unnest(v_feat) f where f is null or f !~ '^([0-9]|1[0-2])(:[0-5])?$')
     or (select count(distinct f) from unnest(v_feat) f) <> coalesce(array_length(v_feat, 1), 0)
  then raise exception 'invalid_featured'; end if;
  if v_motto !~ '^[^[:cntrl:]<>]{0,40}$' then raise exception 'invalid_motto'; end if;
  if p_codex is null or p_codex < 0 or p_codex > 100 then raise exception 'invalid_codex'; end if;
  update players set featured = v_feat, motto = v_motto, codex = p_codex, profile_at = now() where id = v_id;
  return json_build_object('ok', true);
end $$;

-- Voir le profil public d'un joueur (par pseudo) : null s'il n'existe pas.
create or replace function public.get_profile(p_name text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('name', p.name, 'motto', p.motto, 'featured', to_json(p.featured), 'codex', p.codex, 'since', p.created_at,
    'score', s.score, 'sector', s.sector,
    'tier', (select max(m.tier) from scores m where m.player_id = p.id), 'playtime', p.playtime,
    'rank', case when s.score is null then null else (select count(*) + 1 from scores o where o.board = 'all' and o.score > s.score) end,
    'total', (select count(*) from scores o where o.board = 'all'),
    'wins', (select count(*) from scores d where d.player_id = p.id and d.board like 'day:%'))
  from players p left join scores s on s.player_id = p.id and s.board = 'all'
  where lower(p.name) = lower(btrim(p_name))
$$;

-- Rediffusion : graine + journal de la meilleure partie d'un joueur (le moteur est déterministe : on la rejoue à l'identique).
create or replace function public.get_run(p_name text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('name', p.name, 'score', s.score, 'sector', s.sector, 'seed', s.seed, 'log', s.log, 'steps', s.steps)
  from players p join scores s on s.player_id = p.id and s.board = 'all'
  where lower(p.name) = lower(btrim(p_name)) and s.log is not null
$$;

-- Envoyer son temps de jeu cumulé (secondes). Valeur jamais diminuée, et progression bornée par le temps réellement écoulé depuis le
-- dernier envoi (+ 2 min de marge) : impossible de s'attribuer 500 heures d'un coup. Premier envoi : jusqu'à 72 h déjà jouées avant l'inscription.
create or replace function public.report_playtime(p_secret text, p_seconds integer) returns json
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_old integer; v_at timestamptz; v_cap bigint; v_new integer;
begin
  select id, playtime, play_at into v_id, v_old, v_at from players where secret_hash = critical_hash(p_secret);
  if v_id is null then raise exception 'unknown_player'; end if;
  if p_seconds is null or p_seconds < 0 or p_seconds > 36000000 then raise exception 'invalid_playtime'; end if;
  v_cap := case when v_at is null then 259200 else v_old + (extract(epoch from now() - v_at) * 1.05)::bigint + 120 end;
  v_new := least(greatest(v_old, p_seconds), v_cap)::integer;
  update players set playtime = v_new, play_at = now() where id = v_id;
  return json_build_object('playtime', v_new);
end $$;

revoke all on function public.register(text, text), public.submit_score(text, text, integer, integer, integer, bigint, jsonb, integer), public.leaderboard(text, integer, integer), public.my_rank(text, text), public.set_profile(text, text[], text, integer), public.get_profile(text), public.report_playtime(text, integer), public.get_run(text), public.critical_hash(text) from public;
grant execute on function public.register(text, text), public.submit_score(text, text, integer, integer, integer, bigint, jsonb, integer), public.leaderboard(text, integer, integer), public.my_rank(text, text), public.set_profile(text, text[], text, integer), public.get_profile(text), public.report_playtime(text, integer), public.get_run(text) to anon, authenticated;

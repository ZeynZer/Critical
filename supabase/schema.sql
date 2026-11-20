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
-- présence (vu en ligne il y a moins de 100 s) et « ne pas déranger » pour les invitations de duel
alter table public.players add column if not exists seen_at timestamptz;
alter table public.players add column if not exists no_duel boolean not null default false;
-- niveau affiché sur le profil (déclaré par l'appareil, borné de 1 à 999)
alter table public.players add column if not exists level integer not null default 1;
-- administration : un seul compte (le tien) reçoit is_admin, à la main : update players set is_admin = true where lower(name) = 'zeyn';
alter table public.players add column if not exists is_admin boolean not null default false;
alter table public.players add column if not exists banned boolean not null default false;
-- reprise de compte après un changement de domaine : ouverte à la main, par pseudo, pour une durée limitée (voir claim_player)
alter table public.players add column if not exists claim_until timestamptz;
-- personnalisation du profil : couleur (0-11), cadre (0-5), titre (clé d'une liste côté jeu)
alter table public.players add column if not exists accent smallint not null default 0;
alter table public.players add column if not exists frame smallint not null default 0;
alter table public.players add column if not exists title text not null default '';
-- classement Elo des duels de cuve
alter table public.players add column if not exists elo integer not null default 1000;
alter table public.players add column if not exists elo_games integer not null default 0;
alter table public.players add column if not exists elo_wins integer not null default 0;
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
  if exists (select 1 from players where id = v_id and banned) then raise exception 'banned'; end if;
  if p_board not in ('all', 'blitz') and p_board !~ '^day:\d{4}-\d{2}-\d{2}$' then raise exception 'invalid_board'; end if;
  -- univers du jour : seulement pour aujourd'hui (un jour de marge pour les fuseaux horaires)
  if p_board like 'day:%' and abs(substr(p_board, 5)::date - (now() at time zone 'utc')::date) > 1 then raise exception 'invalid_day'; end if;
  if p_log is null or jsonb_typeof(p_log) <> 'array' or jsonb_array_length(p_log) > 40000 then raise exception 'invalid_log'; end if;
  v_drops := jsonb_array_length(p_log) / 2;
  -- garde-fous de plausibilité (le rejeu complet du journal, lui, se fait hors de la base)
  if p_score < 0 or p_sector < 1 or p_sector > 500 or p_tier < 0 or p_tier > 12 or p_steps < 1
     or p_score > (case when p_board = 'blitz' then 15000 else 2500 end) * v_drops + 50000   -- aucun lâcher ne rapporte autant en moyenne (le tempo du Blitz multiplie jusqu'à ×5)
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

-- ===== Social : likes, présence, invitations de duel =====
create table if not exists public.likes (
  from_id uuid not null references public.players (id) on delete cascade,
  to_id uuid not null references public.players (id) on delete cascade,
  at timestamptz not null default now(),
  primary key (from_id, to_id)
);
create index if not exists likes_to on public.likes (to_id);
-- une seule invitation en attente par joueur invité ; le journal sert aux limites anti-spam
create table if not exists public.challenges (
  to_id uuid primary key references public.players (id) on delete cascade,
  from_id uuid not null references public.players (id) on delete cascade,
  code text not null, at timestamptz not null default now()
);
create table if not exists public.challenge_log (
  from_id uuid not null references public.players (id) on delete cascade,
  to_id uuid not null references public.players (id) on delete cascade,
  at timestamptz not null default now(), declined boolean not null default false
);
create index if not exists challenge_log_from on public.challenge_log (from_id, at);
alter table public.likes enable row level security; alter table public.challenges enable row level security; alter table public.challenge_log enable row level security;
revoke all on public.likes, public.challenges, public.challenge_log from anon, authenticated;

create table if not exists public.gifts (
  id bigserial primary key, to_id uuid not null references public.players (id) on delete cascade,
  eclats integer not null default 0, xp integer not null default 0, note text not null default '', at timestamptz not null default now(), claimed boolean not null default false
);
alter table public.gifts add column if not exists pack text;
alter table public.gifts add column if not exists pack_n integer not null default 0;
create index if not exists gifts_to on public.gifts (to_id) where not claimed;
create table if not exists public.announcements (id bigserial primary key, text text not null, until timestamptz not null, at timestamptz not null default now());
alter table public.gifts enable row level security; alter table public.announcements enable row level security;
revoke all on public.gifts, public.announcements from anon, authenticated;
revoke all on sequence public.gifts_id_seq, public.announcements_id_seq from anon, authenticated;

-- Lire une page du classement (50 lignes par défaut, 100 au plus). badge = premier astre de la vitrine du joueur.
drop function if exists public.leaderboard(text, integer, integer); -- le type de retour a changé (colonne badge)
create or replace function public.leaderboard(p_board text, p_offset integer default 0, p_limit integer default 50)
returns table (rank bigint, name text, score integer, sector integer, tier integer, badge text, online boolean, level integer, accent smallint, frame smallint, title text)
language sql stable security definer set search_path = public as $$
  select r.rank, r.name, r.score, r.sector, r.tier, r.badge, r.online, r.level, r.accent, r.frame, r.title from (
    select row_number() over (order by s.score desc, s.updated_at asc) as rank, p.name, s.score, s.sector, s.tier, p.featured[1] as badge, coalesce(p.seen_at > now() - interval '100 seconds', false) as online, p.level, p.accent, p.frame, p.title
    from scores s join players p on p.id = s.player_id where s.board = p_board and not p.banned
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
drop function if exists public.set_profile(text, text[], text, integer); -- anciennes signatures
drop function if exists public.set_profile(text, text[], text, integer, integer);
create or replace function public.set_profile(p_secret text, p_featured text[], p_motto text, p_codex integer, p_level integer default 1, p_accent integer default 0, p_frame integer default 0, p_title text default '') returns json
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_last timestamptz; v_adm boolean; v_motto text := btrim(coalesce(p_motto, '')); v_feat text[] := coalesce(p_featured, '{}'); v_title text := btrim(coalesce(p_title, ''));
begin
  select id, profile_at, is_admin into v_id, v_last, v_adm from players where secret_hash = critical_hash(p_secret);
  if v_id is null then raise exception 'unknown_player'; end if;
  if v_last is not null and v_last > now() - interval '3 seconds' then raise exception 'too_fast'; end if;
  if coalesce(array_length(v_feat, 1), 0) > 3
     or exists (select 1 from unnest(v_feat) f where f is null or f !~ '^([0-9]|1[0-2])(:[0-9])?$')
     or (select count(distinct f) from unnest(v_feat) f) <> coalesce(array_length(v_feat, 1), 0)
  then raise exception 'invalid_featured'; end if;
  if v_motto !~ '^[^[:cntrl:]<>]{0,40}$' then raise exception 'invalid_motto'; end if;
  if p_codex is null or p_codex < 0 or p_codex > 100 then raise exception 'invalid_codex'; end if;
  if coalesce(p_accent, 0) not between 0 and 11 or coalesce(p_frame, 0) not between 0 and 5 then raise exception 'invalid_style'; end if;
  if v_title !~ '^[a-z0-9_]{0,24}$' or (v_title = 'createur' and not v_adm) then raise exception 'invalid_title'; end if;
  update players set featured = v_feat, motto = v_motto, codex = p_codex, level = least(greatest(coalesce(p_level, 1), 1), 999), accent = coalesce(p_accent, 0), frame = coalesce(p_frame, 0), title = v_title, profile_at = now() where id = v_id;
  return json_build_object('ok', true);
end $$;

-- Voir le profil public d'un joueur (par pseudo) : null s'il n'existe pas.
drop function if exists public.get_profile(text); -- la signature a changé (pour savoir si je l'ai liké)
create or replace function public.get_profile(p_name text, p_secret text default null) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('name', p.name, 'motto', p.motto, 'featured', to_json(p.featured), 'codex', p.codex, 'since', p.created_at,
    'score', s.score, 'sector', s.sector,
    'tier', (select max(m.tier) from scores m where m.player_id = p.id), 'playtime', p.playtime,
    'rank', case when s.score is null then null else (select count(*) + 1 from scores o where o.board = 'all' and o.score > s.score) end,
    'total', (select count(*) from scores o where o.board = 'all'),
    'wins', (select count(*) from scores d where d.player_id = p.id and d.board like 'day:%'),
    'likes', (select count(*) from likes l where l.to_id = p.id),
    'liked', exists (select 1 from likes l join players me on me.id = l.from_id where l.to_id = p.id and me.secret_hash = critical_hash(p_secret)),
    'online', coalesce(p.seen_at > now() - interval '100 seconds', false), 'duel', not p.no_duel, 'level', p.level, 'admin', p.is_admin, 'accent', p.accent, 'frame', p.frame, 'title', p.title, 'elo', p.elo, 'elo_games', p.elo_games)
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

-- Le joueur juste au-dessus d'un score donné (sert de cible en partie) : toujours un vrai joueur, avec une partie rejouable.
create or replace function public.rival(p_score integer) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('name', p.name, 'score', s.score, 'rank', (select count(*) + 1 from scores o where o.board = 'all' and o.score > s.score))
  from scores s join players p on p.id = s.player_id
  where s.board = 'all' and not p.banned and s.score > greatest(coalesce(p_score, 0), 0) and s.log is not null
  order by s.score asc, s.updated_at asc limit 1
$$;

-- Dernières parties réelles du classement mondial (fil d'activité).
create or replace function public.activity() returns table (name text, score integer, sector integer, tier integer, at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.name, s.score, s.sector, s.tier, s.updated_at from scores s join players p on p.id = s.player_id where s.board = 'all' and not p.banned order by s.updated_at desc limit 6
$$;

-- Part réelle des joueurs classés ayant déjà atteint un trou noir (10), un quasar (11), une galaxie (12).
create or replace function public.rarity() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('total', count(*), 'hole', count(*) filter (where t >= 10), 'quasar', count(*) filter (where t >= 11), 'galaxy', count(*) filter (where t >= 12))
  from (select max(tier) as t from scores group by player_id) x
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


-- « Je suis là » (toutes les ~30 s tant que l'appli est ouverte) : renvoie l'invitation de duel éventuelle (valable 2 minutes).
create or replace function public.pulse(p_secret text) returns json
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_out json; v_admin boolean; v_gift json; v_msg json;
begin
  update players set seen_at = now() where secret_hash = critical_hash(p_secret) returning id, is_admin into v_id, v_admin;
  if v_id is null then return null; end if;
  delete from challenges where at < now() - interval '2 minutes';
  select json_build_object('from', pf.name, 'code', c.code, 'age', extract(epoch from now() - c.at)) into v_out
    from challenges c join players pf on pf.id = c.from_id where c.to_id = v_id;
  select json_build_object('id', g.id, 'eclats', g.eclats, 'xp', g.xp, 'note', g.note, 'pack', g.pack, 'packs', g.pack_n) into v_gift from gifts g where g.to_id = v_id and not g.claimed order by g.id limit 1;
  select json_build_object('id', a.id, 'text', a.text) into v_msg from announcements a where a.until > now() order by a.id desc limit 1;
  return json_build_object('duel', v_out, 'admin', v_admin, 'gift', v_gift, 'msg', v_msg);
end $$;

-- Liker / ne plus liker le profil d'un joueur (pas soi-même ; 30 changements par heure au plus).
create or replace function public.like_player(p_secret text, p_name text) returns json
language plpgsql security definer set search_path = public as $$
declare v_me uuid; v_to uuid; v_liked boolean;
begin
  select id into v_me from players where secret_hash = critical_hash(p_secret); if v_me is null then raise exception 'no_profile'; end if;
  select id into v_to from players where lower(name) = lower(btrim(p_name)); if v_to is null then raise exception 'not_found'; end if;
  if v_to = v_me then raise exception 'self'; end if;
  if (select count(*) from likes where from_id = v_me and at > now() - interval '1 hour') >= 30 then raise exception 'too_fast'; end if;
  if exists (select 1 from likes where from_id = v_me and to_id = v_to) then delete from likes where from_id = v_me and to_id = v_to; v_liked := false;
  else insert into likes (from_id, to_id) values (v_me, v_to); v_liked := true; end if;
  return json_build_object('liked', v_liked, 'likes', (select count(*) from likes where to_id = v_to));
end $$;

-- Inviter un joueur en ligne à un duel (le code de salon est créé par l'appelant). Limites : joueur en ligne et ouvert aux invitations,
-- une invitation en attente à la fois chez lui, 60 s entre deux invitations au même joueur, 8 par heure, 15 min de pause après un refus.
create or replace function public.challenge(p_secret text, p_name text, p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare v_me uuid; v_to uuid; v_seen timestamptz; v_off boolean;
begin
  select id into v_me from players where secret_hash = critical_hash(p_secret); if v_me is null then raise exception 'no_profile'; end if;
  if p_code is null or p_code !~ '^[A-Z0-9]{4}$' then raise exception 'invalid_code'; end if;
  select id, seen_at, no_duel into v_to, v_seen, v_off from players where lower(name) = lower(btrim(p_name)); if v_to is null then raise exception 'not_found'; end if;
  if v_to = v_me then raise exception 'self'; end if;
  if v_seen is null or v_seen < now() - interval '100 seconds' then raise exception 'offline'; end if;
  if v_off then raise exception 'no_duel'; end if;
  delete from challenge_log where at < now() - interval '1 day';
  if exists (select 1 from challenge_log where from_id = v_me and to_id = v_to and declined and at > now() - interval '15 minutes') then raise exception 'declined_recently'; end if;
  if exists (select 1 from challenge_log where from_id = v_me and to_id = v_to and not declined and at > now() - interval '60 seconds') then raise exception 'too_fast'; end if;
  if (select count(*) from challenge_log where from_id = v_me and not declined and at > now() - interval '1 hour') >= 8 then raise exception 'too_many'; end if;
  if exists (select 1 from challenges where to_id = v_to and from_id <> v_me and at > now() - interval '2 minutes') then raise exception 'busy'; end if;
  insert into challenges (to_id, from_id, code) values (v_to, v_me, p_code) on conflict (to_id) do update set from_id = excluded.from_id, code = excluded.code, at = now();
  insert into challenge_log (from_id, to_id) values (v_me, v_to);
  return json_build_object('ok', true);
end $$;

-- Répondre à l'invitation reçue : accepter renvoie le code du salon, refuser prévient l'expéditeur de ne pas insister (15 min).
create or replace function public.challenge_reply(p_secret text, p_accept boolean) returns json
language plpgsql security definer set search_path = public as $$
declare v_me uuid; c challenges; v_from text;
begin
  select id into v_me from players where secret_hash = critical_hash(p_secret); if v_me is null then raise exception 'no_profile'; end if;
  delete from challenges where to_id = v_me and at > now() - interval '2 minutes' returning * into c;
  if c.to_id is null then raise exception 'expired'; end if;
  if p_accept then select name into v_from from players where id = c.from_id; return json_build_object('code', c.code, 'from', v_from); end if;
  insert into challenge_log (from_id, to_id, declined) values (c.from_id, v_me, true);
  return json_build_object('declined', true);
end $$;

-- L'expéditeur annule son invitation (il ferme le salon avant réponse).
create or replace function public.challenge_cancel(p_secret text) returns void
language sql security definer set search_path = public as $$
  delete from challenges where from_id = (select id from players where secret_hash = critical_hash(p_secret))
$$;

-- Reprendre un ancien compte (secret perdu) : possible seulement si l'administrateur a ouvert ce pseudo (claim_until dans le futur), une fois.
--   update players set claim_until = now() + interval '30 minutes' where lower(name) = lower('Pseudo');
create or replace function public.claim_player(p_secret text, p_name text) returns json
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  if p_secret is null or length(p_secret) < 20 or length(p_secret) > 200 then raise exception 'invalid_secret'; end if;
  update players set secret_hash = critical_hash(p_secret), claim_until = null
   where lower(name) = lower(btrim(p_name)) and claim_until > now() returning id, name into v_id, v_name;
  if v_id is null then raise exception 'not_claimable'; end if;
  return json_build_object('name', v_name);
end $$;

-- Accepter ou non les invitations de duel (« ne pas déranger »).
create or replace function public.set_no_duel(p_secret text, p_value boolean) returns void
language sql security definer set search_path = public as $$
  update players set no_duel = coalesce(p_value, false) where secret_hash = critical_hash(p_secret)
$$;


-- ===== Administration : toutes ces fonctions exigent un compte is_admin (vérifié ici, jamais côté appareil) =====
create or replace function public.admin_id(p_secret text) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v uuid; begin
  select id into v from players where secret_hash = critical_hash(p_secret) and is_admin;
  if v is null then raise exception 'forbidden'; end if; return v;
end $$;
revoke all on function public.admin_id(text) from public, anon, authenticated;

create or replace function public.admin_players(p_secret text, p_query text default '', p_limit integer default 30)
returns table (name text, level integer, score integer, online boolean, banned boolean, since timestamptz, playtime integer, likes bigint, admin boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_id(p_secret);
  return query select p.name, p.level, (select max(s.score) from scores s where s.player_id = p.id and s.board = 'all'), coalesce(p.seen_at > now() - interval '100 seconds', false),
    p.banned, p.created_at, p.playtime, (select count(*) from likes l where l.to_id = p.id), p.is_admin
    from players p where p.name ilike '%' || replace(replace(btrim(coalesce(p_query, '')), '%', ''), '_', '') || '%'
    order by p.seen_at desc nulls last, p.created_at desc limit least(greatest(coalesce(p_limit, 30), 1), 60);
end $$;

drop function if exists public.admin_gift(text, text, integer, integer, text); -- nouvelle signature : packs
create or replace function public.admin_gift(p_secret text, p_name text, p_eclats integer, p_xp integer, p_note text default '', p_pack text default null, p_pack_n integer default 0) returns json
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  perform admin_id(p_secret); select id into v from players where lower(name) = lower(btrim(p_name)); if v is null then raise exception 'not_found'; end if;
  if coalesce(p_eclats, 0) not between 0 and 1000000 or coalesce(p_xp, 0) not between 0 and 1000000 then raise exception 'invalid_amount'; end if;
  if p_pack is not null and p_pack not in ('etoile', 'nebuleuse', 'galaxie') then raise exception 'invalid_pack'; end if;
  if coalesce(p_pack_n, 0) not between 0 and 100 then raise exception 'invalid_amount'; end if;
  insert into gifts (to_id, eclats, xp, note, pack, pack_n) values (v, coalesce(p_eclats, 0), coalesce(p_xp, 0), left(regexp_replace(coalesce(p_note, ''), '[[:cntrl:]<>]', '', 'g'), 80), p_pack, case when p_pack is null then 0 else coalesce(p_pack_n, 0) end);
  return json_build_object('ok', true);
end $$;

create or replace function public.admin_ban(p_secret text, p_name text, p_value boolean) returns void
language plpgsql security definer set search_path = public as $$
begin perform admin_id(p_secret); update players set banned = coalesce(p_value, true) where lower(name) = lower(btrim(p_name)) and not is_admin; end $$;

create or replace function public.admin_rename(p_secret text, p_name text, p_new text) returns json
language plpgsql security definer set search_path = public as $$
declare v_new text := btrim(p_new);
begin
  perform admin_id(p_secret); if v_new is null or v_new !~ '^[[:alnum:] ._-]{3,16}$' then raise exception 'invalid_name'; end if;
  begin update players set name = v_new where lower(name) = lower(btrim(p_name)); exception when unique_violation then raise exception 'name_taken'; end;
  return json_build_object('name', v_new);
end $$;

create or replace function public.admin_reset_scores(p_secret text, p_name text) returns void
language plpgsql security definer set search_path = public as $$
begin perform admin_id(p_secret); delete from scores where player_id = (select id from players where lower(name) = lower(btrim(p_name))); end $$;

create or replace function public.admin_delete(p_secret text, p_name text) returns void
language plpgsql security definer set search_path = public as $$
begin perform admin_id(p_secret); delete from players where lower(name) = lower(btrim(p_name)) and not is_admin; end $$;

create or replace function public.admin_open_claim(p_secret text, p_name text, p_minutes integer default 30) returns void
language plpgsql security definer set search_path = public as $$
begin perform admin_id(p_secret); update players set claim_until = now() + make_interval(mins => least(greatest(coalesce(p_minutes, 30), 1), 240)) where lower(name) = lower(btrim(p_name)) and not is_admin; end $$;

create or replace function public.admin_announce(p_secret text, p_text text, p_minutes integer default 30) returns void
language plpgsql security definer set search_path = public as $$
declare v_t text := left(btrim(regexp_replace(coalesce(p_text, ''), '[[:cntrl:]<>]', '', 'g')), 200);
begin perform admin_id(p_secret); if length(v_t) < 1 then raise exception 'invalid_text'; end if;
  insert into announcements (text, until) values (v_t, now() + make_interval(mins => least(greatest(coalesce(p_minutes, 30), 1), 1440))); end $$;

create or replace function public.admin_announce_clear(p_secret text) returns void
language plpgsql security definer set search_path = public as $$
begin perform admin_id(p_secret); delete from announcements; end $$;

-- Le joueur récupère un cadeau reçu : une seule fois, uniquement le sien.
create or replace function public.claim_gift(p_secret text, p_id bigint) returns json
language plpgsql security definer set search_path = public as $$
declare g gifts;
begin
  update gifts set claimed = true where id = p_id and not claimed and to_id = (select id from players where secret_hash = critical_hash(p_secret)) returning * into g;
  if g.id is null then raise exception 'none'; end if;
  return json_build_object('eclats', g.eclats, 'xp', g.xp, 'note', g.note, 'pack', g.pack, 'packs', g.pack_n);
end $$;

revoke all on function public.register(text, text), public.submit_score(text, text, integer, integer, integer, bigint, jsonb, integer), public.leaderboard(text, integer, integer), public.my_rank(text, text), public.set_profile(text, text[], text, integer, integer, integer, integer, text), public.get_profile(text, text), public.report_playtime(text, integer), public.get_run(text), public.rival(integer), public.activity(), public.rarity(), public.pulse(text), public.like_player(text, text), public.challenge(text, text, text), public.challenge_reply(text, boolean), public.challenge_cancel(text), public.set_no_duel(text, boolean), public.claim_player(text, text), public.admin_players(text, text, integer), public.admin_gift(text, text, integer, integer, text, text, integer), public.admin_ban(text, text, boolean), public.admin_rename(text, text, text), public.admin_reset_scores(text, text), public.admin_delete(text, text), public.admin_open_claim(text, text, integer), public.admin_announce(text, text, integer), public.admin_announce_clear(text), public.claim_gift(text, bigint), public.critical_hash(text) from public;
grant execute on function public.register(text, text), public.submit_score(text, text, integer, integer, integer, bigint, jsonb, integer), public.leaderboard(text, integer, integer), public.my_rank(text, text), public.set_profile(text, text[], text, integer, integer, integer, integer, text), public.get_profile(text, text), public.report_playtime(text, integer), public.get_run(text), public.rival(integer), public.activity(), public.rarity(), public.pulse(text), public.like_player(text, text), public.challenge(text, text, text), public.challenge_reply(text, boolean), public.challenge_cancel(text), public.set_no_duel(text, boolean), public.claim_player(text, text), public.admin_players(text, text, integer), public.admin_gift(text, text, integer, integer, text, text, integer), public.admin_ban(text, text, boolean), public.admin_rename(text, text, text), public.admin_reset_scores(text, text), public.admin_delete(text, text), public.admin_open_claim(text, text, integer), public.admin_announce(text, text, integer), public.admin_announce_clear(text), public.claim_gift(text, bigint) to anon, authenticated;

-- ============================== Communauté : idées, statistiques et outils d'administration ==============================
create table if not exists public.ideas (
  id bigserial primary key, player_id uuid not null references public.players (id) on delete cascade, body text not null,
  status text not null default 'open', pinned boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.idea_likes (
  idea_id bigint not null references public.ideas (id) on delete cascade, player_id uuid not null references public.players (id) on delete cascade, at timestamptz not null default now(),
  primary key (idea_id, player_id)
);
create index if not exists ideas_player on public.ideas (player_id, created_at);
create index if not exists idea_likes_player on public.idea_likes (player_id, at);
alter table public.ideas enable row level security; alter table public.idea_likes enable row level security;
revoke all on public.ideas, public.idea_likes from anon, authenticated;
revoke all on sequence public.ideas_id_seq from anon, authenticated;

-- Proposer une idée (10 à 280 caractères, 3 par jour, pas de doublon). Elle part avec le « like » de son auteur.
create or replace function public.idea_post(p_secret text, p_text text) returns json
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_ban boolean; v_t text := btrim(regexp_replace(coalesce(p_text, ''), '[[:cntrl:]<>]', ' ', 'g')); v_new bigint;
begin
  select id, banned into v_id, v_ban from players where secret_hash = critical_hash(p_secret);
  if v_id is null then raise exception 'unknown_player'; end if;
  if v_ban then raise exception 'forbidden'; end if;
  v_t := regexp_replace(v_t, ' {2,}', ' ', 'g');
  if length(v_t) < 10 or length(v_t) > 280 then raise exception 'invalid_idea'; end if;
  if (select count(*) from ideas where player_id = v_id and created_at > now() - interval '24 hours') >= 3 then raise exception 'too_many'; end if;
  if exists (select 1 from ideas where lower(body) = lower(v_t)) then raise exception 'duplicate'; end if;
  insert into ideas (player_id, body) values (v_id, v_t) returning id into v_new;
  insert into idea_likes (idea_id, player_id) values (v_new, v_id);
  return json_build_object('id', v_new);
end $$;

-- Liste des idées : 'top' (en cours de vote, les plus soutenues d'abord), 'new' (les plus récentes), 'done' (réalisées). Les idées refusées sont masquées (sauf pour l'administrateur, avec 'all').
create or replace function public.idea_list(p_secret text, p_sort text default 'top', p_limit integer default 60)
returns table (id bigint, body text, author text, mine boolean, likes bigint, liked boolean, status text, pinned boolean, at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_me uuid; v_adm boolean;
begin
  select p.id, p.is_admin into v_me, v_adm from players p where p.secret_hash = critical_hash(p_secret);
  return query select i.id, i.body, p.name, i.player_id = v_me, (select count(*) from idea_likes l where l.idea_id = i.id),
      exists (select 1 from idea_likes l where l.idea_id = i.id and l.player_id = v_me), i.status, i.pinned, i.created_at
    from ideas i join players p on p.id = i.player_id
    where case when p_sort = 'done' then i.status = 'done' when p_sort = 'all' and coalesce(v_adm, false) then true else i.status in ('open', 'planned', 'doing') end
    order by case when p_sort = 'new' then 0 else i.pinned::int * -1 end,
      case when p_sort = 'new' then 0 else (select count(*) from idea_likes l where l.idea_id = i.id) end desc, i.created_at desc
    limit least(greatest(coalesce(p_limit, 60), 1), 100);
end $$;

-- Soutenir / retirer son soutien à une idée (pas la sienne ; 60 changements par heure au plus).
create or replace function public.idea_like(p_secret text, p_id bigint) returns json
language plpgsql security definer set search_path = public as $$
declare v_me uuid; v_owner uuid; v_on boolean;
begin
  select id into v_me from players where secret_hash = critical_hash(p_secret) and not banned;
  if v_me is null then raise exception 'unknown_player'; end if;
  select player_id into v_owner from ideas where id = p_id; if v_owner is null then raise exception 'not_found'; end if;
  if v_owner = v_me then raise exception 'own_idea'; end if;
  if (select count(*) from idea_likes where player_id = v_me and at > now() - interval '1 hour') >= 60 then raise exception 'too_fast'; end if;
  if exists (select 1 from idea_likes where idea_id = p_id and player_id = v_me) then delete from idea_likes where idea_id = p_id and player_id = v_me; v_on := false;
  else insert into idea_likes (idea_id, player_id) values (p_id, v_me); v_on := true; end if;
  return json_build_object('liked', v_on, 'likes', (select count(*) from idea_likes where idea_id = p_id));
end $$;

-- Retirer sa propre idée (tant qu'elle n'est pas prise en charge).
create or replace function public.idea_delete(p_secret text, p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from ideas where id = p_id and status = 'open' and player_id = (select id from players where secret_hash = critical_hash(p_secret));
  if not found then raise exception 'not_found'; end if;
end $$;

create or replace function public.admin_idea_status(p_secret text, p_id bigint, p_status text, p_pin boolean default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform admin_id(p_secret); if p_status not in ('open', 'planned', 'doing', 'done', 'rejected') then raise exception 'invalid_status'; end if;
  update ideas set status = p_status, pinned = coalesce(p_pin, pinned) where id = p_id; if not found then raise exception 'not_found'; end if;
end $$;
create or replace function public.admin_idea_delete(p_secret text, p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin perform admin_id(p_secret); delete from ideas where id = p_id; end $$;

-- Tableau de bord : chiffres globaux.
create or replace function public.admin_stats(p_secret text) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_id(p_secret);
  return json_build_object(
    'players', (select count(*) from players), 'online', (select count(*) from players where seen_at > now() - interval '100 seconds'),
    'active24', (select count(*) from players where seen_at > now() - interval '24 hours'), 'new7', (select count(*) from players where created_at > now() - interval '7 days'),
    'banned', (select count(*) from players where banned), 'avg_level', (select coalesce(round(avg(level), 1), 0) from players),
    'runs', (select count(*) from scores where board = 'all'), 'top', (select coalesce(max(score), 0) from scores where board = 'all'),
    'hours', (select coalesce(round(sum(playtime) / 3600.0), 0) from players), 'likes', (select count(*) from likes),
    'ideas', (select count(*) from ideas), 'ideas_open', (select count(*) from ideas where status in ('open', 'planned', 'doing')), 'idea_likes', (select count(*) from idea_likes),
    'gifts_pending', (select count(*) from gifts where not claimed), 'duels', (select count(*) from challenge_log where at > now() - interval '24 hours'));
end $$;

-- Fiche complète d'un joueur.
create or replace function public.admin_player(p_secret text, p_name text) returns json
language plpgsql stable security definer set search_path = public as $$
declare p players;
begin
  perform admin_id(p_secret); select * into p from players where lower(name) = lower(btrim(p_name)); if p.id is null then raise exception 'not_found'; end if;
  return json_build_object('name', p.name, 'level', p.level, 'codex', p.codex, 'motto', p.motto, 'title', p.title, 'accent', p.accent, 'frame', p.frame, 'featured', to_json(p.featured),
    'since', p.created_at, 'seen', p.seen_at, 'playtime', p.playtime, 'banned', p.banned, 'admin', p.is_admin, 'online', coalesce(p.seen_at > now() - interval '100 seconds', false),
    'best', (select max(s.score) from scores s where s.player_id = p.id and s.board = 'all'), 'tier', (select max(s.tier) from scores s where s.player_id = p.id),
    'wins', (select count(*) from scores s where s.player_id = p.id and s.board like 'day:%'),
    'rank', (select count(*) + 1 from scores o where o.board = 'all' and o.score > coalesce((select max(s.score) from scores s where s.player_id = p.id and s.board = 'all'), 0)),
    'likes_in', (select count(*) from likes l where l.to_id = p.id), 'likes_out', (select count(*) from likes l where l.from_id = p.id),
    'ideas', (select count(*) from ideas i where i.player_id = p.id), 'gifts', (select count(*) from gifts g where g.to_id = p.id), 'gifts_pending', (select count(*) from gifts g where g.to_id = p.id and not g.claimed));
end $$;

-- Modération d'un profil : efface devise, vitrine, titre et style.
create or replace function public.admin_clear_profile(p_secret text, p_name text) returns void
language plpgsql security definer set search_path = public as $$
begin perform admin_id(p_secret); update players set motto = '', featured = '{}', title = '', accent = 0, frame = 0 where lower(name) = lower(btrim(p_name)) and not is_admin; end $$;

-- Cadeau pour tout le monde (ou seulement les joueurs en ligne) : un cadeau par joueur, encaissé à sa prochaine connexion.
create or replace function public.admin_gift_all(p_secret text, p_eclats integer, p_xp integer, p_note text default '', p_pack text default null, p_pack_n integer default 0, p_online boolean default false) returns json
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform admin_id(p_secret);
  if coalesce(p_eclats, 0) not between 0 and 100000 or coalesce(p_xp, 0) not between 0 and 100000 then raise exception 'invalid_amount'; end if;
  if p_pack is not null and p_pack not in ('etoile', 'nebuleuse', 'galaxie') then raise exception 'invalid_pack'; end if;
  if coalesce(p_pack_n, 0) not between 0 and 10 then raise exception 'invalid_amount'; end if;
  if coalesce(p_eclats, 0) = 0 and coalesce(p_xp, 0) = 0 and (p_pack is null or coalesce(p_pack_n, 0) = 0) then raise exception 'invalid_amount'; end if;
  insert into gifts (to_id, eclats, xp, note, pack, pack_n)
    select id, coalesce(p_eclats, 0), coalesce(p_xp, 0), left(regexp_replace(coalesce(p_note, ''), '[[:cntrl:]<>]', '', 'g'), 80), p_pack, case when p_pack is null then 0 else coalesce(p_pack_n, 0) end
    from players where not banned and (not coalesce(p_online, false) or seen_at > now() - interval '100 seconds');
  get diagnostics n = row_count; return json_build_object('count', n);
end $$;

-- Annonces : liste (actives et récentes) et suppression d'une seule.
create or replace function public.admin_announcements(p_secret text) returns table (id bigint, text text, until timestamptz, at timestamptz, active boolean)
language plpgsql stable security definer set search_path = public as $$
begin perform admin_id(p_secret); return query select a.id, a.text, a.until, a.at, a.until > now() from announcements a order by a.id desc limit 20; end $$;
create or replace function public.admin_announce_delete(p_secret text, p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin perform admin_id(p_secret); delete from announcements where id = p_id; end $$;

revoke all on function public.idea_post(text, text), public.idea_list(text, text, integer), public.idea_like(text, bigint), public.idea_delete(text, bigint), public.admin_idea_status(text, bigint, text, boolean), public.admin_idea_delete(text, bigint), public.admin_stats(text), public.admin_player(text, text), public.admin_clear_profile(text, text), public.admin_gift_all(text, integer, integer, text, text, integer, boolean), public.admin_announcements(text), public.admin_announce_delete(text, bigint) from public, anon, authenticated;
grant execute on function public.idea_post(text, text), public.idea_list(text, text, integer), public.idea_like(text, bigint), public.idea_delete(text, bigint), public.admin_idea_status(text, bigint, text, boolean), public.admin_idea_delete(text, bigint), public.admin_stats(text), public.admin_player(text, text), public.admin_clear_profile(text, text), public.admin_gift_all(text, integer, integer, text, text, integer, boolean), public.admin_announcements(text), public.admin_announce_delete(text, bigint) to anon, authenticated;

-- ============================== Duel de cuve : classement Elo ==============================
create table if not exists public.duel_reports (
  match text not null, player_id uuid not null references public.players (id) on delete cascade, opp_id uuid not null references public.players (id) on delete cascade,
  won boolean not null, at timestamptz not null default now(), settled boolean not null default false, delta integer,
  primary key (match, player_id)
);
create index if not exists duel_reports_pending on public.duel_reports (settled, at);
alter table public.duel_reports enable row level security; revoke all on public.duel_reports from anon, authenticated;

-- Règle l'Elo d'un match quand c'est possible : deux comptes rendus concordants (un vainqueur, un perdant) ; deux comptes rendus qui se contredisent = litige, aucun point ;
-- un seul compte rendu et plus de 90 s écoulées (l'autre a quitté) = on croit celui qui a rapporté. Même paire : 4 matchs classés par 24 h au plus (anti-échange de points).
create or replace function public.elo_settle(p_match text) returns void
language plpgsql security definer set search_path = public as $$
declare a duel_reports; b duel_reports; w duel_reports; l duel_reports; ew integer; el integer; ex numeric; d integer := 0; n integer;
begin
  select count(*) into n from duel_reports where match = p_match;
  if n = 0 or exists (select 1 from duel_reports where match = p_match and settled) then return; end if;
  select * into a from duel_reports where match = p_match order by at limit 1;
  select * into b from duel_reports where match = p_match and player_id <> a.player_id limit 1;
  if b.player_id is null then
    if a.at > now() - interval '90 seconds' then return; end if; -- on attend encore l'autre joueur
    if a.won then w := a; else l := a; end if;
  elsif a.opp_id <> b.player_id or b.opp_id <> a.player_id or a.won = b.won then
    update duel_reports set settled = true, delta = 0 where match = p_match; return; -- litige
  else
    if a.won then w := a; l := b; else w := b; l := a; end if;
  end if;
  -- un seul compte rendu : on reconstitue l'autre camp
  if w.player_id is null then w := (p_match, l.opp_id, l.player_id, true, now(), false, null)::duel_reports; end if;
  if l.player_id is null then l := (p_match, w.opp_id, w.player_id, false, now(), false, null)::duel_reports; end if;
  if (select count(*) from duel_reports r where r.settled and r.delta <> 0 and r.won and ((r.player_id = w.player_id and r.opp_id = l.player_id) or (r.player_id = l.player_id and r.opp_id = w.player_id)) and r.at > now() - interval '24 hours') >= 4
  then d := 0;
  else
    select elo into ew from players where id = w.player_id; select elo into el from players where id = l.player_id;
    ex := 1 / (1 + power(10, (el - ew) / 400.0)); d := greatest(1, round(32 * (1 - ex))::integer);
    update players set elo = elo + d, elo_games = elo_games + 1, elo_wins = elo_wins + 1 where id = w.player_id;
    update players set elo = greatest(100, elo - d), elo_games = elo_games + 1 where id = l.player_id;
  end if;
  insert into duel_reports (match, player_id, opp_id, won, delta, settled) values (p_match, w.player_id, w.opp_id, true, d, true) on conflict (match, player_id) do update set settled = true, delta = d;
  insert into duel_reports (match, player_id, opp_id, won, delta, settled) values (p_match, l.player_id, l.opp_id, false, -d, true) on conflict (match, player_id) do update set settled = true, delta = -d;
end $$;
revoke all on function public.elo_settle(text) from public, anon, authenticated;

-- Compte rendu de fin de match (match = CODE:graine). Renvoie l'Elo et le gain si le match est réglé, sinon « en attente » de l'adversaire.
create or replace function public.duel_report(p_secret text, p_match text, p_won boolean, p_opp text) returns json
language plpgsql security definer set search_path = public as $$
declare v_me uuid; v_opp uuid; r duel_reports;
begin
  select id into v_me from players where secret_hash = critical_hash(p_secret) and not banned; if v_me is null then raise exception 'unknown_player'; end if;
  if p_match !~ '^[A-Z0-9]{4}:[0-9]{1,10}$' then raise exception 'invalid_match'; end if;
  select id into v_opp from players where lower(name) = lower(btrim(p_opp)) and id <> v_me; if v_opp is null then raise exception 'not_found'; end if;
  if (select count(*) from duel_reports where player_id = v_me and at > now() - interval '1 hour') >= 20 then raise exception 'too_fast'; end if;
  insert into duel_reports (match, player_id, opp_id, won) values (p_match, v_me, v_opp, coalesce(p_won, false)) on conflict (match, player_id) do nothing;
  perform elo_settle(p_match);
  select * into r from duel_reports where match = p_match and player_id = v_me;
  return json_build_object('settled', r.settled, 'delta', coalesce(r.delta, 0), 'elo', (select elo from players where id = v_me));
end $$;

-- Mes derniers matchs réglés (les comptes rendus restés seuls sont réglés au passage) + mon Elo et mon rang.
create or replace function public.elo_sync(p_secret text) returns json
language plpgsql security definer set search_path = public as $$
declare v_me uuid; m text;
begin
  select id into v_me from players where secret_hash = critical_hash(p_secret); if v_me is null then return null; end if;
  for m in select match from duel_reports where player_id = v_me and not settled and at < now() - interval '90 seconds' limit 10 loop perform elo_settle(m); end loop;
  return json_build_object('elo', (select elo from players where id = v_me), 'games', (select elo_games from players where id = v_me),
    'rank', (select count(*) + 1 from players o where o.elo_games > 0 and o.elo > (select elo from players where id = v_me)), 'total', (select count(*) from players where elo_games > 0),
    'recent', coalesce((select json_agg(json_build_object('match', x.match, 'delta', x.delta, 'won', x.won) order by x.at desc) from (select * from duel_reports where player_id = v_me and settled order by at desc limit 5) x), '[]'::json));
end $$;

create or replace function public.elo_board(p_offset integer default 0, p_limit integer default 50)
returns table (rank bigint, name text, elo integer, games integer, wins integer, badge text, online boolean, level integer, accent smallint, frame smallint, title text)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by p.elo desc, p.elo_games desc), p.name, p.elo, p.elo_games, p.elo_wins, p.featured[1], coalesce(p.seen_at > now() - interval '100 seconds', false), p.level, p.accent, p.frame, p.title
  from players p where p.elo_games > 0 and not p.banned order by 1 offset greatest(p_offset, 0) limit least(greatest(p_limit, 1), 100)
$$;

revoke all on function public.duel_report(text, text, boolean, text), public.elo_sync(text), public.elo_board(integer, integer) from public, anon, authenticated;
grant execute on function public.duel_report(text, text, boolean, text), public.elo_sync(text), public.elo_board(integer, integer) to anon, authenticated;

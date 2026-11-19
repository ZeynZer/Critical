do $$ declare z text := 'zeyn-secret-aaaaaaaaaaaaaaaaaaa'; u text := 'user-secret-bbbbbbbbbbbbbbbbbbbb'; v text := 'user-secret-cccccccccccccccccccc'; r json; n int; i bigint;
begin
  perform register(z, 'Zeyn'); perform register(u, 'Bob'); perform register(v, 'Carl'); update players set is_admin = true where lower(name) = 'zeyn';
  -- profil : style et titre validés
  perform set_profile(u, '{}', 'hello', 5, 12, 7, 3, 'fusionneur');
  r := get_profile('Bob'); assert (r->>'accent')::int = 7 and (r->>'frame')::int = 3 and r->>'title' = 'fusionneur', 'style enregistré';
  update players set profile_at = null;
  begin perform set_profile(u, '{}', '', 5, 12, 12, 0, ''); assert false; exception when others then assert sqlerrm = 'invalid_style', sqlerrm; end;
  update players set profile_at = null;
  begin perform set_profile(u, '{}', '', 5, 12, 0, 0, 'createur'); assert false; exception when others then assert sqlerrm = 'invalid_title', sqlerrm; end;
  update players set profile_at = null;
  begin perform set_profile(u, '{}', '', 5, 12, 0, 0, 'Bad Title!'); assert false; exception when others then assert sqlerrm = 'invalid_title', sqlerrm; end;
  perform set_profile(z, '{}', '', 5, 12, 0, 0, 'createur'); assert get_profile('Zeyn')->>'title' = 'createur', 'titre admin';
  -- classement : style
  perform submit_score(u, 'all', 1000, 2, 3, 1, '[]'::jsonb, 10);
  -- idées
  r := idea_post(u, 'Ajouter un mode sombre pour les cartes'); i := (r->>'id')::bigint;
  begin perform idea_post(u, 'court'); assert false; exception when others then assert sqlerrm = 'invalid_idea', sqlerrm; end;
  begin perform idea_post(v, 'ajouter un mode SOMBRE pour les cartes'); assert false; exception when others then assert sqlerrm = 'duplicate', sqlerrm; end;
  perform idea_post(u, 'Un mode coopératif a deux joueurs'); perform idea_post(u, 'Des succès avec des récompenses');
  begin perform idea_post(u, 'Une quatrième idée le même jour'); assert false; exception when others then assert sqlerrm = 'too_many', sqlerrm; end;
  begin perform idea_like(u, i); assert false; exception when others then assert sqlerrm = 'own_idea', sqlerrm; end;
  r := idea_like(v, i); assert (r->>'likes')::int = 2 and (r->>'liked')::boolean, 'like';
  r := idea_like(v, i); assert (r->>'likes')::int = 1 and not (r->>'liked')::boolean, 'unlike';
  perform idea_like(v, i);
  select count(*) into n from idea_list(v, 'top'); assert n = 3, 'liste';
  assert (select id from idea_list(v, 'top') limit 1) = i, 'la plus soutenue en premier';
  assert (select liked from idea_list(v, 'top') where id = i), 'liked vrai pour moi';
  assert (select mine from idea_list(u, 'top') where id = i), 'mine';
  begin perform admin_idea_status(u, i, 'done'); assert false; exception when others then assert sqlerrm = 'forbidden', sqlerrm; end;
  perform admin_idea_status(z, i, 'doing', true); assert (select status from idea_list(v, 'top') where id = i) = 'doing', 'statut';
  begin perform idea_delete(u, i); assert false; exception when others then assert sqlerrm = 'not_found', 'prise en charge : plus supprimable'; end;
  perform admin_idea_status(z, i, 'done'); assert (select count(*) from idea_list(v, 'done')) = 1 and (select count(*) from idea_list(v, 'top')) = 2, 'réalisée';
  perform admin_idea_status(z, i, 'rejected'); assert (select count(*) from idea_list(v, 'done')) = 0 and (select count(*) from idea_list(z, 'all')) = 3 and (select count(*) from idea_list(v, 'all')) = 2, 'refusée masquée, visible admin';
  perform admin_idea_delete(z, i); assert (select count(*) from ideas) = 2, 'supprimée';
  -- stats, fiche, cadeau à tous, annonces, modération
  begin perform admin_stats(u); assert false; exception when others then assert sqlerrm = 'forbidden', sqlerrm; end;
  r := admin_stats(z); assert (r->>'players')::int = 3 and (r->>'ideas')::int = 2, 'stats';
  r := admin_player(z, 'bob'); assert r->>'title' = 'fusionneur' and (r->>'best')::int = 1000, 'fiche';
  r := admin_gift_all(z, 100, 0, 'Merci', null, 0, false); assert (r->>'count')::int = 3, 'cadeau à tous';
  begin perform admin_gift_all(z, 0, 0, '', null, 0, false); assert false; exception when others then assert sqlerrm = 'invalid_amount', sqlerrm; end;
  begin perform admin_gift_all(u, 5, 0, '', null, 0, false); assert false; exception when others then assert sqlerrm = 'forbidden', sqlerrm; end;
  assert (r->>'count')::int = (select count(*) from gifts where note = 'Merci'), 'un par joueur';
  perform admin_announce(z, 'Bonjour', 30); assert (select count(*) from admin_announcements(z) where active) = 1, 'annonce';
  perform admin_announce_delete(z, (select id from admin_announcements(z) limit 1)); assert (select count(*) from admin_announcements(z)) = 0, 'annonce supprimée';
  perform admin_clear_profile(z, 'bob'); assert get_profile('Bob')->>'title' = '' and get_profile('Bob')->>'motto' = '', 'profil modéré';
  perform admin_clear_profile(z, 'zeyn'); assert get_profile('Zeyn')->>'title' = 'createur', 'un admin ne se modère pas';
  select count(*) into n from leaderboard('all', 0, 10) where level is not null; assert n = 1, 'leaderboard enrichi';
  raise notice 'COMMUNAUTÉ OK';
end $$;

do $$ declare a text := 'user-secret-aaaaaaaaaaaaaaaaaaaa'; b text := 'user-secret-bbbbbbbbbbbbbbbbbbbb'; c text := 'user-secret-cccccccccccccccccccc'; r json; i int;
begin
  perform register(a, 'Ann'); perform register(b, 'Bob'); perform register(c, 'Cid');
  r := duel_report(a, 'ABCD:123', true, 'Bob'); assert not (r->>'settled')::boolean, 'en attente de l''adversaire';
  r := duel_report(b, 'ABCD:123', false, 'Ann'); assert (r->>'settled')::boolean and (r->>'delta')::int = -16 and (r->>'elo')::int = 984, 'Bob perd 16 (' || r::text || ')';
  assert (select elo from players where name = 'Ann') = 1016 and (select elo_wins from players where name = 'Ann') = 1, 'Ann gagne 16';
  r := duel_report(a, 'ABCD:123', true, 'Bob'); assert (r->>'delta')::int = 16, 'rapport répété : pas de double compte'; assert (select elo from players where name = 'Ann') = 1016;
  -- litige : les deux disent avoir gagné
  perform duel_report(a, 'EFGH:5', true, 'Bob'); r := duel_report(b, 'EFGH:5', true, 'Ann'); assert (r->>'settled')::boolean and (r->>'delta')::int = 0, 'litige = aucun point';
  -- format et adversaire
  begin perform duel_report(a, 'bad', true, 'Bob'); assert false; exception when others then assert sqlerrm = 'invalid_match', sqlerrm; end;
  begin perform duel_report(a, 'JKLM:9', true, 'Ann'); assert false; exception when others then assert sqlerrm = 'not_found', 'pas contre soi-même'; end;
  begin perform duel_report('x', 'JKLM:9', true, 'Bob'); assert false; exception when others then assert sqlerrm = 'unknown_player', sqlerrm; end;
  -- seul compte rendu, adversaire parti : réglé après 90 s
  perform duel_report(c, 'NPQR:7', true, 'Bob'); update duel_reports set at = now() - interval '2 minutes' where match = 'NPQR:7';
  r := elo_sync(c); assert (r->>'elo')::int > 1000 and (r->>'games')::int = 1, 'victoire par forfait réglée : ' || r::text; assert (select elo from players where name = 'Bob') < 984, 'le forfaiteur perd des points';
  -- anti-échange : 4 matchs classés par paire et par 24 h
  for i in 1..6 loop perform duel_report(a, 'Z' || lpad(i::text, 3, '0') || ':' || i, true, 'Cid'); perform duel_report(c, 'Z' || lpad(i::text, 3, '0') || ':' || i, false, 'Ann'); end loop;
  assert (select count(*) from duel_reports where player_id = (select id from players where name = 'Ann') and match like 'Z%' and delta <> 0) = 4, 'au plus 4 matchs classés contre le même adversaire par jour';
  assert (select count(*) from elo_board(0, 10)) = 3 and (select name from elo_board(0, 1)) is not null, 'classement Elo';
  assert (get_profile('Ann')->>'elo')::int > 1000, 'profil avec Elo';
  raise notice 'ELO OK';
end $$;

do $$ declare z text := 'zeyn-secret-aaaaaaaaaaaaaaaaaaa'; a text := 'user-secret-bbbbbbbbbbbbbbbbbbbb'; b text := 'user-secret-cccccccccccccccccccc'; r json; eid bigint; i int;
begin
  perform register(z, 'Zeyn'); perform register(a, 'Ann'); perform register(b, 'Bob'); update players set is_admin = true where name = 'Zeyn';
  assert event_current(a) is null, 'pas d''événement';
  begin perform event_drop(a, array[1,0,0,0]); assert false; exception when others then assert sqlerrm = 'no_event', sqlerrm; end;
  begin perform admin_event_start(a, 'x', 10, 10); assert false; exception when others then assert sqlerrm = 'forbidden', sqlerrm; end;
  eid := admin_event_start(z, 'La Grande Cuve', 60, 3); r := event_current(a); assert (r->>'active')::boolean and (r->>'goal')::int = 3 and (r->>'mass')::int = 0, 'événement lancé';
  r := event_drop(a, array[5,0,0,0]); assert (r->>'accepted')::int = 5 and (r->>'mass')::int = 5, 'masse = 5';
  r := event_drop(a, array[0,0,0,3]); assert (r->>'accepted')::int = 3 and (r->>'mass')::int = 29, '3 astres de rang 3 = 24 + 5 : ' || r::text; -- seau de 60 jetons, 8 déjà dépensés
  update event_players set tok = 2 where player_id = (select id from players where name = 'Ann'); r := event_drop(a, array[40,0,0,0]); assert (r->>'accepted')::int = 2, 'seau presque vide : 2 jetons → 2 astres'; update event_players set tok = 0; begin perform event_drop(a, array[1,0,0,0]); assert false; exception when others then assert sqlerrm = 'too_fast', sqlerrm; end;
  begin perform event_drop(a, array[41,0,0,0]); assert false; exception when others then assert sqlerrm = 'invalid_counts', sqlerrm; end;
  begin perform event_drop(a, array[1,2]); assert false; exception when others then assert sqlerrm = 'invalid_counts', sqlerrm; end;
  update event_players set last_at = now() - interval '30 seconds', tok = 60; r := event_drop(b, array[0,0,0,40]); assert (r->>'accepted')::int = 40, 'b pose 40 gros astres';
  update event_players set last_at = now() - interval '30 seconds', tok = 60 where player_id = (select id from players where name = 'Ann'); r := event_drop(a, array[0,0,0,40]); assert (r->>'accepted')::int = 40;
  r := event_current(a); assert (r->'board'->0->>'n') in ('Ann', 'Bob') and json_array_length(r->'board') = 2 and (r->'me'->>'astres')::int = 50, 'classement + ma part : ' || r::text; assert json_array_length(r->'act') = 2, 'actifs récents';
  assert (r->>'galaxies')::int = (r->>'mass')::bigint / 4096;
  -- récompenses : paliers selon la masse (3 galaxies = 12288 de masse)
  begin perform event_claim(z); assert false; exception when others then assert sqlerrm = 'not_enough', 'moins de 50 astres'; end;
  update event_players set astres = 60 where player_id = (select id from players where name = 'Ann'); update events set mass = 4096 * 1 where events.id = eid;
  r := event_claim(a); assert json_array_length(r->'gifts') = 1 and not (r->>'done')::boolean, '33 % = palier 25 % : ' || r::text; r := event_claim(a); assert json_array_length(r->'gifts') = 0, 'une seule fois';
  update events set mass = 4096 * 3 where events.id = eid; r := event_claim(a); assert json_array_length(r->'gifts') = 3, 'paliers 50, 75, 100 : ' || r::text;
  -- fin de l'événement : participation, podium, objectif atteint
  perform admin_event_end(z); r := event_claim(a); assert (r->>'done')::boolean and json_array_length(r->'gifts') >= 2, 'fin : ' || r::text; assert (r->'titles')::text like '%colosse%', 'titre colosse';
  begin perform event_drop(a, array[1,0,0,0]); assert false; exception when others then assert sqlerrm = 'no_event', 'plus de lâcher après la fin'; end;
  assert (select count(*) from gifts where to_id = (select id from players where name = 'Ann')) >= 6, 'cadeaux créés';
  raise notice 'EVENT OK';
end $$;

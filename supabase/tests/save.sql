-- Sauvegarde cloud. À lancer sur une base neuve où schema.sql est collé : psql -f supabase/tests/save.sql
do $$ declare a text := 'device-secret-aaaaaaaaaaaaaaaaaaaaaaaa'; b text := 'device-secret-bbbbbbbbbbbbbbbbbbbbbbbb'; r json;
begin
  begin perform save_push('court', '{}', 0, 0); assert false; exception when others then assert sqlerrm = 'invalid_secret', sqlerrm; end;
  begin perform save_push(a, '[1]', 0, 0); assert false; exception when others then assert sqlerrm = 'invalid_save', sqlerrm; end;
  begin perform save_push(a, jsonb_build_object('k', repeat('x', 300001)), 0, 0); assert false; exception when others then assert sqlerrm = 'invalid_save', sqlerrm; end;
  assert save_pull(a) is null, 'rien au départ';
  r := save_push(a, '{"k":{"critical.forage.v2":"{\"xp\":100}"}}', 100, 0);
  assert (r->>'rev')::int = 1, 'première version : ' || r::text;
  begin perform save_push(a, '{"k":{}}', 120, 1); assert false; exception when others then assert sqlerrm = 'too_fast', sqlerrm; end;
  update saves set at = now() - interval '1 minute';
  r := save_push(a, '{"k":{"x":"2"}}', 150, 1);
  assert (r->>'rev')::int = 2, 'deuxième version';
  -- un second appareil (même secret, restauré par code) en retard : il ne doit rien écraser et reçoit la version du serveur
  update saves set at = now() - interval '1 minute';
  r := save_push(a, '{"k":{"vieux":"1"}}', 110, 1);
  assert (r->>'conflict')::boolean and (r->'data'->'k'->>'x') = '2', 'conflit détecté : ' || r::text;
  assert (select s.rev from saves s) = 2, 'rien écrit';
  -- en avance (plus d'XP), il écrit même avec une base ancienne
  r := save_push(a, '{"k":{"neuf":"1"}}', 400, 1);
  assert (r->>'rev')::int = 3, 'appareil en avance';
  r := save_pull(a);
  assert (r->>'xp')::int = 400 and (r->'data'->'k'->>'neuf') = '1', 'lecture : ' || r::text;
  assert save_pull(b) is null, 'chacun sa sauvegarde';
  -- la table est fermée au public
  assert not has_table_privilege('anon', 'public.saves', 'select'), 'table fermée';
  raise notice 'save OK';
end $$;

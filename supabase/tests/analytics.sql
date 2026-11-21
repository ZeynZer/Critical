-- Télémétrie anonyme + rapport admin. À lancer sur une base où schema.sql est collé : psql -f supabase/tests/analytics.sql
do $$ declare z text := 'zeyn-secret-aaaaaaaaaaaaaaaaaaa'; a text := 'user-secret-bbbbbbbbbbbbbbbbbbbb'; r json; i int; dv text;
begin
  perform register(z, 'Zeyn'); perform register(a, 'Ann'); update players set is_admin = true where name = 'Zeyn';
  -- seul un appareil valide écrit ; les entrées sont bornées
  begin perform tele('x', 10); assert false; exception when others then assert sqlerrm = 'invalid_device', sqlerrm; end;
  perform tele('device-aaaa-0001', 30, '{"pf":"android","sa":true,"lg":"fr","sc":"390x844","v":"v71","ns":true}', '[{"m":"classic","s":12000,"t":7,"x":3,"d":240,"n":80,"o":true,"f":58},{"m":"blitz","s":3000,"t":5,"x":1,"d":70,"n":40,"o":false},{"m":"hack","s":1,"t":1,"x":1,"d":1}]', '[{"n":"tab:collection","v":1},{"n":"js_error","i":"TypeError: x is undefined"},{"n":"BAD NAME","v":1}]', a);
  assert (select count(*) from tele_runs) = 2, 'mode inconnu refusé';
  assert (select count(*) from tele_events) = 2, 'nom invalide refusé';
  assert (select d0.player_id from tele_devices d0 where d0.did = 'device-aaaa-0001') = (select id from players where name = 'Ann'), 'appareil lié au joueur';
  perform tele('device-aaaa-0001', 9999);
  assert (select h0.secs from tele_hours h0 where h0.did = 'device-aaaa-0001') = 150, 'secondes bornées à 120 par envoi';
  assert (select info from tele_events where name = 'js_error') = 'TypeError: x is undefined';
  assert (select d0.sessions from tele_devices d0 where d0.did = 'device-aaaa-0001') = 1, 'une session';
  -- historique synthétique : 12 appareils sur 10 jours
  for i in 1..12 loop
    dv := 'device-bbbb-' || lpad(i::text, 4, '0');
    insert into tele_devices (did, first_at, last_at, platform, standalone, lang, scr, ver, sessions, secs) values (dv, now() - ((i % 10) || ' days')::interval, now() - ((i % 3) || ' days')::interval, case when i % 2 = 0 then 'ios' else 'android' end, i % 3 = 0, 'fr', '390x844', 'v71', 3 + i, 600 * i);
    insert into tele_hours (hour, did, secs) select date_trunc('hour', now() - (s || ' days')::interval - (i || ' hours')::interval), dv, 300 + i * 20 from generate_series(0, i % 10) s;
    insert into tele_runs (at, did, mode, score, tier, sector, secs, drops, over, fps) values (now() - ((i % 5) || ' days')::interval, dv, case when i % 3 = 0 then 'blitz' else 'classic' end, i * 4000, i % 12, 1 + i % 5, 60 * i, 30 * i, i % 2 = 0, 50 + i);
    insert into tele_events (at, did, name, val) values (now() - ((i % 4) || ' days')::interval, dv, case when i % 2 = 0 then 'pack' else 'event_open' end, 1);
  end loop;
  begin perform admin_analytics(a, 30); assert false; exception when others then assert sqlerrm = 'forbidden', sqlerrm; end;
  r := admin_analytics(z, 14);
  assert json_array_length(r->'daily') = 14, 'une ligne par jour : ' || json_array_length(r->'daily');
  assert (r->'span'->>'devices')::int = 13 and (r->'span'->>'installed')::int = 5, 'appareils : ' || (r->'span')::text;
  assert (r->>'mau')::int = 13, 'MAU';
  assert json_array_length(r->'hod') = 24 and json_array_length(r->'retention') = 7, 'courbes';
  assert (r->'runs'->>'total')::int = 14 and json_array_length(r->'runs'->'tier_reach') = 12, 'parties : ' || (r->'runs'->>'total');
  assert (select sum((x->>'n')::int) from json_array_elements(r->'runs'->'secs_hist') x) = 14, 'histogramme durée complet';
  assert (select sum((x->>'n')::int) from json_array_elements(r->'devices'->'secs_hist') x) = 13, 'histogramme appareils complet';
  assert (select sum((x->>'n')::int) from json_array_elements(r->'players'->'levels') x) = (select count(*) from players), 'niveaux';
  assert (r->'errors'->0->>'k') = 'TypeError: x is undefined', 'erreurs listées';
  assert (select (x->>'n')::int from json_array_elements(r->'events') x where x->>'k' = 'pack') = 6, 'événements agrégés';
  assert (select (x->>'kept')::int from json_array_elements(r->'retention') x where (x->>'d')::int = 1) >= 1, 'rétention J1';
  assert (r->'now'->>'devices')::int >= 1, 'en ligne';
  r := admin_analytics(z, 1); assert json_array_length(r->'daily') = 1, '1 jour';
  r := admin_analytics(z, 9999); assert json_array_length(r->'daily') = 365, 'plafond 365 jours';
  raise notice 'ANALYTICS OK';
end $$;

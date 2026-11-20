do $$ declare u text := 'user-secret-bbbbbbbbbbbbbbbbbbbb'; r json;
begin
  perform register(u, 'Bob');
  r := submit_score(u, 'blitz', 30000, 2, 3, 1, '[1,5000,60,5000,120,5000]'::jsonb, 400); assert (r->>'rank')::int = 1, 'blitz classé';
  assert (select count(*) from leaderboard('blitz', 0, 10)) = 1 and (select count(*) from leaderboard('all', 0, 10)) = 0, 'tableaux séparés';
  begin perform submit_score(u, 'blitz', 999999, 2, 3, 1, '[1,5000]'::jsonb, 400); assert false; exception when others then assert sqlerrm = 'implausible', sqlerrm; end;
  begin perform submit_score(u, 'hack', 10, 1, 1, 1, '[]'::jsonb, 400); assert false; exception when others then assert sqlerrm = 'invalid_board', sqlerrm; end;
  raise notice 'BLITZ OK';
end $$;

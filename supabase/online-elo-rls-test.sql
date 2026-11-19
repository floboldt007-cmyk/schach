-- Prueft supabase/online-elo-schema.sql im Supabase SQL Editor (als Besitzer, wie dort ueblich). Alles wird am Ende
-- zurueckgerollt. Vier kurzlebige Nutzer A bis D. Jeder Fehler bricht mit "FEHLER: ..." ab; ohne Fehler endet der
-- Lauf mit ROLLBACK.
-- Abschnitte: 1 eigene Elo (A 1234 nach 5 Partien, C 1450 als selbst gesetzter Start); 2 ohne eigene Elo null (B ohne
-- Stand, D nur mit dem Vorgabewert 1000), nie eine fremde Zahl; 3 die bisherigen Felder bleiben, kein Feld liga;
-- 4 anon darf nichts, ohne Nutzerkennung Fehler.
begin;

insert into auth.users (id, email)
values
  ('a7a7a7a7-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'online-elo-a@example.invalid'),
  ('b7b7b7b7-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'online-elo-b@example.invalid'),
  ('c7c7c7c7-cccc-4ccc-8ccc-cccccccccccc', 'online-elo-c@example.invalid'),
  ('d7d7d7d7-dddd-4ddd-8ddd-dddddddddddd', 'online-elo-d@example.invalid');
insert into public.kronen_stand (user_id, elo, elo_n, start_gesetzt)
values ('a7a7a7a7-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1234, 5, false),
       ('c7c7c7c7-cccc-4ccc-8ccc-cccccccccccc', 1450, 0, true),
       ('d7d7d7d7-dddd-4ddd-8ddd-dddddddddddd', 1000, 0, false)
on conflict (user_id) do update set elo = excluded.elo, elo_n = excluded.elo_n, start_gesetzt = excluded.start_gesetzt;

-- ---------- 1. Eigene Elo ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a7a7a7a7-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  s jsonb := public.kronen_mein_stand();
begin
  if (s->>'elo')::int is distinct from 1234 then
    raise exception 'FEHLER: A sieht die eigene Elo nicht (%)', s;
  end if;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"c7c7c7c7-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
do $$
declare
  s jsonb := public.kronen_mein_stand();
begin
  if (s->>'elo')::int is distinct from 1450 then
    raise exception 'FEHLER: C sieht den selbst gesetzten Start nicht (%)', s;
  end if;
end;
$$;

-- ---------- 2. Ohne eigene Elo null, nie eine fremde Zahl ----------
select set_config('request.jwt.claims', '{"sub":"b7b7b7b7-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$
declare
  s jsonb := public.kronen_mein_stand();
begin
  if not (s ? 'elo') or jsonb_typeof(s->'elo') is distinct from 'null' then
    raise exception 'FEHLER: B ohne Stand bekommt nicht elo null (%)', s;
  end if;
  if s::text like '%1234%' or s::text like '%1450%' then
    raise exception 'FEHLER: B sieht eine fremde Elo (%)', s;
  end if;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"d7d7d7d7-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}', true);
do $$
declare
  s jsonb := public.kronen_mein_stand();
begin
  if jsonb_typeof(s->'elo') is distinct from 'null' then
    raise exception 'FEHLER: D zeigt den Vorgabewert 1000 als Elo (%)', s;
  end if;
end;
$$;

-- ---------- 3. Die bisherigen Felder bleiben ----------
select set_config('request.jwt.claims', '{"sub":"a7a7a7a7-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  s jsonb := public.kronen_mein_stand();
begin
  if not (s ?& array['stufe', 'kronen', 'platz', 'ziel', 'n', 'woche', 'elo']) or s ? 'liga' then
    raise exception 'FEHLER: Felder von kronen_mein_stand passen nicht (%)', s;
  end if;
end;
$$;

-- ---------- 4. anon darf nichts, ohne Nutzerkennung Fehler ----------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    perform public.kronen_mein_stand();
    raise exception 'FEHLER: anon konnte kronen_mein_stand aufrufen';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
do $$
begin
  begin
    perform public.kronen_mein_stand();
    raise exception 'FEHLER: kronen_mein_stand ohne Nutzerkennung angenommen';
  exception
    when others then if sqlerrm <> 'KRONEN_ANMELDUNG' then raise; end if;
  end;
end;
$$;

rollback;

-- Prueft supabase/weltrang-schema.sql im Supabase SQL Editor (als Besitzer, wie dort ueblich). Alles wird am Ende
-- zurueckgerollt. Sechs kurzlebige Nutzer A bis F. Jeder Fehler bricht mit "FEHLER: ..." ab; ohne Fehler endet der
-- Lauf mit ROLLBACK.
-- Abschnitte: 1 ohne Zustimmung niemand; 2 nur ab 15 Partien und mit Name, fremdes Banner als 'start';
-- 2b Start-Elo selbst gesetzt erst ab 30 Partien (D 29 nicht, E 30 drin, F 15 ohne Startwert drin);
-- 3 keine Tabellenrechte, anon darf nichts; 4 Zuruecknehmen wirkt sofort.
begin;

insert into auth.users (id, email)
values
  ('a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'weltrang-a@example.invalid'),
  ('b2b2b2b2-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'weltrang-b@example.invalid'),
  ('c3c3c3c3-cccc-4ccc-8ccc-cccccccccccc', 'weltrang-c@example.invalid');
insert into public.profile (user_id, benutzername)
values ('a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'weltrang_probe_a'), ('b2b2b2b2-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'weltrang_probe_b');
insert into public.kronen_stand (user_id, elo, elo_n)
values ('a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 3990, 15), ('b2b2b2b2-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 3980, 14),
       ('c3c3c3c3-cccc-4ccc-8ccc-cccccccccccc', 3970, 99)
on conflict (user_id) do update set elo = excluded.elo, elo_n = excluded.elo_n;
insert into auth.users (id, email)
values
  ('d4d4d4d4-dddd-4ddd-8ddd-dddddddddddd', 'weltrang-d@example.invalid'),
  ('e5e5e5e5-eeee-4eee-8eee-eeeeeeeeeeee', 'weltrang-e@example.invalid'),
  ('f6f6f6f6-ffff-4fff-8fff-ffffffffffff', 'weltrang-f@example.invalid');
insert into public.profile (user_id, benutzername)
values ('d4d4d4d4-dddd-4ddd-8ddd-dddddddddddd', 'weltrang_probe_d'), ('e5e5e5e5-eeee-4eee-8eee-eeeeeeeeeeee', 'weltrang_probe_e'),
       ('f6f6f6f6-ffff-4fff-8fff-ffffffffffff', 'weltrang_probe_f');
insert into public.kronen_stand (user_id, elo, elo_n, start_gesetzt)
values ('d4d4d4d4-dddd-4ddd-8ddd-dddddddddddd', 3960, 29, true), ('e5e5e5e5-eeee-4eee-8eee-eeeeeeeeeeee', 3950, 30, true),
       ('f6f6f6f6-ffff-4fff-8fff-ffffffffffff', 3940, 15, false)
on conflict (user_id) do update set elo = excluded.elo, elo_n = excluded.elo_n, start_gesetzt = excluded.start_gesetzt;
insert into public.karte_wahl (user_id, banner) values ('a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'kein-besitz')
on conflict (user_id) do update set banner = excluded.banner;

-- ---------- 1. Ohne Zustimmung erscheint niemand von A, B, C ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  l jsonb := public.weltrang_liste(100);
begin
  if (l->>'teilnahme')::boolean or l->'ich'->>'status' <> 'nicht_dabei'
     or exists (select 1 from jsonb_array_elements(l->'liste') z where z->>'name' like 'weltrang_probe_%') then
    raise exception 'FEHLER: ohne Zustimmung sichtbar (%)', l;
  end if;
end;
$$;

-- ---------- 2. Zustimmung: A (15 Partien) erscheint, B (14) nicht, C (ohne Name) nicht ----------
do $$
declare
  l jsonb := public.weltrang_mitmachen(true);
  z jsonb;
begin
  select x into z from jsonb_array_elements(l->'liste') x where x->>'name' = 'weltrang_probe_a';
  if z is null or (z->>'elo')::int <> 3990 or z->>'banner' <> 'start' or not (z->>'ich')::boolean
     or l->'ich'->>'status' <> 'dabei' then
    raise exception 'FEHLER: A nach Zustimmung falsch (%)', l;
  end if;
  if (select string_agg(k, ',' order by k) from jsonb_object_keys(z) k) <> 'banner,elo,ich,name,rang' then
    raise exception 'FEHLER: Zeile hat andere Felder (%)', z;
  end if;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"b2b2b2b2-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$
declare
  l jsonb := public.weltrang_mitmachen(true);
begin
  if l->'ich'->>'status' <> 'zaehlt_noch' or (l->'ich'->>'fehlen')::int <> 1
     or exists (select 1 from jsonb_array_elements(l->'liste') z where z->>'name' = 'weltrang_probe_b') then
    raise exception 'FEHLER: B mit 14 Partien falsch (%)', l;
  end if;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"c3c3c3c3-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
do $$
declare
  l jsonb := public.weltrang_mitmachen(true);
begin
  if l->'ich'->>'status' <> 'ohne_name' or jsonb_array_length(l->'liste') > 100 then
    raise exception 'FEHLER: C ohne Name falsch (%)', l;
  end if;
end;
$$;

-- ---------- 2b. Start-Elo selbst gesetzt (Flo 14.11.2026): erst ab 30 Partien, ohne Startwert weiter ab 15 ----------
select set_config('request.jwt.claims', '{"sub":"d4d4d4d4-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}', true);
do $$
declare
  l jsonb := public.weltrang_mitmachen(true);
begin
  if (l->>'ab_start')::int <> 30 or l->'ich'->>'status' <> 'zaehlt_noch' or (l->'ich'->>'fehlen')::int <> 1
     or exists (select 1 from jsonb_array_elements(l->'liste') z where z->>'name' = 'weltrang_probe_d') then
    raise exception 'FEHLER: D (Startwert selbst, 29 Partien) falsch (%)', l;
  end if;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"e5e5e5e5-eeee-4eee-8eee-eeeeeeeeeeee","role":"authenticated"}', true);
do $$
declare
  l jsonb := public.weltrang_mitmachen(true);
begin
  if l->'ich'->>'status' <> 'dabei'
     or not exists (select 1 from jsonb_array_elements(l->'liste') z where z->>'name' = 'weltrang_probe_e') then
    raise exception 'FEHLER: E (Startwert selbst, 30 Partien) falsch (%)', l;
  end if;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"f6f6f6f6-ffff-4fff-8fff-ffffffffffff","role":"authenticated"}', true);
do $$
declare
  l jsonb := public.weltrang_mitmachen(true);
begin
  if l->'ich'->>'status' <> 'dabei'
     or not exists (select 1 from jsonb_array_elements(l->'liste') z where z->>'name' = 'weltrang_probe_f') then
    raise exception 'FEHLER: F (ohne Startwert, 15 Partien) falsch (%)', l;
  end if;
end;
$$;

-- ---------- 3. Keine Tabellenrechte fuer Nutzer, anon darf nichts ----------
do $$
begin
  begin
    perform 1 from public.weltrang_teilnahme;
    raise exception 'FEHLER: authenticated konnte weltrang_teilnahme lesen';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.weltrang_teilnahme (user_id) values ('a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    raise exception 'FEHLER: authenticated konnte weltrang_teilnahme schreiben';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
set local role anon;
do $$
begin
  perform public.weltrang_liste(100);
  raise exception 'FEHLER: anon darf weltrang_liste aufrufen';
exception when insufficient_privilege then null;
end;
$$;
reset role;

-- ---------- 4. Zuruecknehmen wirkt sofort und loescht die Zeile ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  l jsonb := public.weltrang_mitmachen(false);
begin
  if (l->>'teilnahme')::boolean or l->'ich'->>'status' <> 'nicht_dabei'
     or exists (select 1 from jsonb_array_elements(l->'liste') z where z->>'name' = 'weltrang_probe_a') then
    raise exception 'FEHLER: Zuruecknehmen wirkt nicht (%)', l;
  end if;
end;
$$;
reset role;
do $$
begin
  if exists (select 1 from public.weltrang_teilnahme where user_id = 'a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then
    raise exception 'FEHLER: Zuruecknehmen hat die Zeile nicht geloescht';
  end if;
end;
$$;

rollback;

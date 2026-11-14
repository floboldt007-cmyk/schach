-- Prueft supabase/saison-schema.sql (VORSCHLAG, NOCH NICHT EINGESPIELT; Einspielen Flo, nie Claude) im Supabase SQL
-- Editor (als Besitzer, wie dort ueblich). Alles wird am Ende zurueckgerollt. Drei kurzlebige Nutzer A, B, C; A und B
-- spielen eine Online-Partie, C ist unbeteiligt. Jeder Fehler bricht mit "FEHLER: ..." ab; ohne Fehler meldet der Lauf
-- "Saison-RLS-Test erfolgreich" und rollt zurueck. Die echte Uhr laeuft: vor dem 04.01.2027 ist Vorsaison, die
-- Abrechnung selbst prueft tests/server-saison.test.mjs mit gestellter Uhr. Abschnitte: 1 eigener Stand; 2 Titel waehlen
-- (nur verdiente); 3 Karte der Partie (nur Teilnehmer, nur bestes Abzeichen und gewaehlter Titel); 4 keine Tabellenrechte,
-- anon darf nichts, saison_abrechnen nur intern.
begin;

insert into auth.users (id, email)
values
  ('a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'saison-a@example.invalid'),
  ('b1b1b1b1-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'saison-b@example.invalid'),
  ('c1c1c1c1-cccc-4ccc-8ccc-cccccccccccc', 'saison-c@example.invalid');

-- Testdaten als Besitzer: A hat Saison 1 mit 15 und Saison 2 mit 12 abgeschlossen und ist Crownmaster der Saison 1
insert into public.saison_abzeichen (user_id, saison, stufe)
values ('a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1, 15), ('a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 2, 12);
insert into public.saison_titel (user_id, saison, art) values ('a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1, 'crownmaster');

create function pg_temp.partie()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  p uuid;
begin
  insert into public.partien_online (erstellt_von, fen) values ('a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'egal') returning id into p;
  update public.partien_online set weiss = 'a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa', schwarz = 'b1b1b1b1-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    status = 'laeuft' where id = p;
  return p;
end;
$$;
revoke all on function pg_temp.partie() from public;
create temp table saison_test_partie as select pg_temp.partie() as id;
grant select on saison_test_partie to authenticated, anon;

-- ---------- 1. eigener Stand ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  s jsonb := public.saison_mein_stand();
begin
  if s -> 'abzeichen' <> '[{"saison": 1, "stufe": 15}, {"saison": 2, "stufe": 12}]'::jsonb then
    raise exception 'FEHLER: eigene Abzeichen %', s;
  end if;
  if s -> 'titel' <> '["crownmaster-s1"]'::jsonb or s -> 'gewaehlt' <> 'null'::jsonb then
    raise exception 'FEHLER: eigene Titel %', s;
  end if;
  if s ->> 'start' <> '2027-01-04' then raise exception 'FEHLER: Saisonstart %', s; end if;
  if s::text like '%a1a1a1a1%' then raise exception 'FEHLER: Konto-Kennung im Stand'; end if;
end;
$$;

-- ---------- 2. Titel waehlen ----------
do $$
begin
  begin
    perform public.saison_titel_waehle('top10-s1');
    raise exception 'FEHLER: nicht verdienter Titel angenommen';
  exception when others then
    if sqlerrm not like '%SAISON_TITEL%' then raise; end if;
  end;
  if public.saison_titel_waehle('crownmaster-s1') ->> 'titel' <> 'crownmaster-s1' then
    raise exception 'FEHLER: eigener Titel nicht angenommen';
  end if;
end;
$$;
reset role;

-- ---------- 3. Karte der Partie ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1b1b1b1-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$
declare
  k jsonb := public.saison_karte_der_partie((select id from saison_test_partie));
begin
  if k -> 'w' -> 'abzeichen' <> '{"saison": 1, "stufe": 15}'::jsonb or k -> 'w' ->> 'titel' <> 'crownmaster-s1' then
    raise exception 'FEHLER: Gegner sieht nicht bestes Abzeichen und gewaehlten Titel %', k;
  end if;
  if (select array_agg(x order by x) from jsonb_object_keys(k -> 'w') x) <> array['abzeichen', 'du', 'titel'] then
    raise exception 'FEHLER: weitere Felder auf der Karte %', k;
  end if;
  if k -> 's' -> 'abzeichen' <> 'null'::jsonb then raise exception 'FEHLER: B hat ein Abzeichen %', k; end if;
end;
$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1c1c1c1-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
do $$
begin
  perform public.saison_karte_der_partie((select id from saison_test_partie));
  raise exception 'FEHLER: Unbeteiligter sieht die Karte';
exception when others then
  if sqlerrm not like '%SAISON_KEINE_PARTIE%' then raise; end if;
end;
$$;

-- ---------- 4. Rechte ----------
do $$
declare
  t text;
begin
  foreach t in array array['saison_abzeichen', 'saison_titel', 'saison_wahl', 'saison_abrechnungen'] loop
    begin
      execute format('select count(*) from public.%I', t);
      raise exception 'FEHLER: % direkt lesbar', t;
    exception when insufficient_privilege then null;
    end;
  end loop;
  begin
    perform public.saison_abrechnen();
    raise exception 'FEHLER: saison_abrechnen fuer Nutzer aufrufbar';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
set local role anon;
do $$
begin
  perform public.saison_mein_stand();
  raise exception 'FEHLER: anon liest einen Saison-Stand';
exception when insufficient_privilege then null;
end;
$$;
reset role;

do $$ begin raise notice 'Saison-RLS-Test erfolgreich'; end; $$;
rollback;

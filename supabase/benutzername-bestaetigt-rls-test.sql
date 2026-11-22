-- Prueft supabase/benutzername-bestaetigt-schema.sql im Supabase SQL Editor (als Besitzer). Alles wird am Ende zurueckgerollt.
-- Voraussetzung: schema.sql, benutzername-sperre-schema.sql und benutzername-bestaetigt-schema.sql eingespielt.
-- Jeder Fehler bricht mit "FEHLER: ..." ab; ohne Fehler endet der Lauf mit ROLLBACK.
-- Achtung: benutzername-sperre-rls-test.sql passt nur VOR dieser Datei (dort ist das erste Setzen noch frei).
-- Abschnitte: 1 erstes eigenes Setzen: Haken und Frist; 2 Aenderung danach gesperrt; 3 Haken nicht selbst wegzunehmen;
-- 4 vergebener Name (Besitzer) ohne Haken, selbst bestaetigen setzt beides; 5 name_frei; 6 bestaetigte_namen;
-- 7 Umbenennen als Besitzer nimmt den Haken.
begin;

insert into auth.users (id, email)
values
  ('a8000000-0000-4000-8000-0000000000a8', 'name-haken-a@example.invalid'),
  ('b8000000-0000-4000-8000-0000000000b8', 'name-haken-b@example.invalid');

-- 4 vorbereiten: B bekommt seinen Namen vom Server (Besitzer)
insert into public.profile (user_id, benutzername) values ('b8000000-0000-4000-8000-0000000000b8', 'haken_test_b');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a8000000-0000-4000-8000-0000000000a8","role":"authenticated"}', true);

do $$
declare
  h boolean;
  am timestamptz;
begin
  -- 1 erstes eigenes Setzen ist ein Bestaetigen
  insert into public.profile (user_id, benutzername, name_bestaetigt) values ('a8000000-0000-4000-8000-0000000000a8', 'haken_test_a', false);
  select p.name_bestaetigt, p.name_geaendert_am into h, am from public.profile p where p.user_id = 'a8000000-0000-4000-8000-0000000000a8';
  if not h then raise exception 'FEHLER: erstes eigenes Setzen ohne Haken'; end if;
  if am is null or am < now() - interval '1 minute' then raise exception 'FEHLER: erstes eigenes Setzen ohne Frist'; end if;

  -- 2 Aenderung danach gesperrt
  begin
    update public.profile set benutzername = 'haken_test_a2' where user_id = 'a8000000-0000-4000-8000-0000000000a8';
    raise exception 'FEHLER: Aenderung direkt nach dem Bestaetigen ging durch';
  exception when others then
    if sqlerrm <> 'NAME_GESPERRT' then raise; end if;
  end;

  -- 3 den Haken nicht selbst wegnehmen
  update public.profile set name_bestaetigt = false where user_id = 'a8000000-0000-4000-8000-0000000000a8';
  select p.name_bestaetigt into h from public.profile p where p.user_id = 'a8000000-0000-4000-8000-0000000000a8';
  if not h then raise exception 'FEHLER: Haken liess sich selbst wegnehmen'; end if;

  -- 5 name_frei
  if public.name_frei('HAKEN_TEST_B') then raise exception 'FEHLER: name_frei meldet einen fremden Namen als frei'; end if;
  if not public.name_frei('Haken_Test_A') then raise exception 'FEHLER: name_frei meldet den eigenen Namen als vergeben'; end if;
  if public.name_frei('ab') then raise exception 'FEHLER: name_frei nimmt ein ungueltiges Format'; end if;

  -- 6 bestaetigte_namen: A ja, B (vergeben) nein
  if (select array_agg(n order by n) from public.bestaetigte_namen(array['HAKEN_TEST_A', 'haken_test_b']) as x(n)) is distinct from array['haken_test_a'] then
    raise exception 'FEHLER: bestaetigte_namen liefert nicht nur den bestaetigten Namen';
  end if;
end;
$$;

-- 4 B bestaetigt seinen vergebenen Namen selbst
select set_config('request.jwt.claims', '{"sub":"b8000000-0000-4000-8000-0000000000b8","role":"authenticated"}', true);
do $$
declare
  h boolean;
  am timestamptz;
begin
  select p.name_bestaetigt, p.name_geaendert_am into h, am from public.profile p where p.user_id = 'b8000000-0000-4000-8000-0000000000b8';
  if h or am is not null then raise exception 'FEHLER: vergebener Name hat Haken oder Frist'; end if;
  update public.profile set name_bestaetigt = true where user_id = 'b8000000-0000-4000-8000-0000000000b8';
  select p.name_bestaetigt, p.name_geaendert_am into h, am from public.profile p where p.user_id = 'b8000000-0000-4000-8000-0000000000b8';
  if not h or am is null then raise exception 'FEHLER: selbst bestaetigen setzt nicht Haken und Frist'; end if;
end;
$$;
reset role;

-- 7 Besitzer benennt um: Haken weg, Frist bleibt
do $$
declare
  h boolean;
  am timestamptz;
  am0 timestamptz;
begin
  select p.name_geaendert_am into am0 from public.profile p where p.user_id = 'a8000000-0000-4000-8000-0000000000a8';
  update public.profile set benutzername = 'haken_test_admin' where user_id = 'a8000000-0000-4000-8000-0000000000a8';
  select p.name_bestaetigt, p.name_geaendert_am into h, am from public.profile p where p.user_id = 'a8000000-0000-4000-8000-0000000000a8';
  if h then raise exception 'FEHLER: Umbenennen als Besitzer laesst den Haken stehen'; end if;
  if am is distinct from am0 then raise exception 'FEHLER: Umbenennen als Besitzer aendert die Frist'; end if;
  raise notice 'benutzername-bestaetigt-rls-test: alles gruen';
end;
$$;

rollback;

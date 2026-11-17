-- Prueft supabase/benutzername-sperre-schema.sql im Supabase SQL Editor (als Besitzer). Alles wird am Ende zurueckgerollt.
-- Voraussetzung: schema.sql und benutzername-sperre-schema.sql eingespielt.
-- Jeder Fehler bricht mit "FEHLER: ..." ab; ohne Fehler endet der Lauf mit ROLLBACK.
-- Abschnitte: 1 erstes Setzen frei, mitgeschickte Frist verworfen; 2 gleicher Name ist keine Aenderung; 3 erste Aenderung
-- setzt die Frist, die zweite ist gesperrt (NAME_GESPERRT mit Datum); 4 Frist nicht faelschbar; 5 fremde Zeile (RLS);
-- 6 Besitzer frei und kann die Sperre aufheben; 7 nach 30 Tagen wieder frei; 8 eigenes Loeschen gesperrt (vor 5 geprueft,
-- Kaltreview 17.11.2026: Loeschen und neu Anlegen setzte die Frist sonst auf null).
begin;

insert into auth.users (id, email)
values
  ('a7000000-0000-4000-8000-0000000000a7', 'name-sperre-a@example.invalid'),
  ('b7000000-0000-4000-8000-0000000000b7', 'name-sperre-b@example.invalid');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a7000000-0000-4000-8000-0000000000a7","role":"authenticated"}', true);

do $$
declare
  am timestamptz;
  meldung text;
  bis text;
begin
  -- 1 erstes Setzen frei, eine mitgeschickte Frist zaehlt nicht
  insert into public.profile (user_id, benutzername, name_geaendert_am)
  values ('a7000000-0000-4000-8000-0000000000a7', 'sperre_test_a', '2000-01-01');
  select p.name_geaendert_am into am from public.profile p where p.user_id = 'a7000000-0000-4000-8000-0000000000a7';
  if am is not null then raise exception 'FEHLER: erstes Setzen setzt eine Frist (%)', am; end if;

  -- 2 gleicher Name (wie "Jetzt sichern") ist keine Aenderung
  insert into public.profile (user_id, benutzername) values ('a7000000-0000-4000-8000-0000000000a7', 'sperre_test_a')
  on conflict (user_id) do update set benutzername = excluded.benutzername;
  select p.name_geaendert_am into am from public.profile p where p.user_id = 'a7000000-0000-4000-8000-0000000000a7';
  if am is not null then raise exception 'FEHLER: gleicher Name setzt eine Frist'; end if;

  -- 3 erste Aenderung frei und setzt die Frist; die zweite ist gesperrt
  update public.profile set benutzername = 'sperre_test_a2' where user_id = 'a7000000-0000-4000-8000-0000000000a7';
  select p.name_geaendert_am into am from public.profile p where p.user_id = 'a7000000-0000-4000-8000-0000000000a7';
  if am is null or am < now() - interval '1 minute' then raise exception 'FEHLER: erste Aenderung setzt keine Frist'; end if;
  begin
    update public.profile set benutzername = 'sperre_test_a3' where user_id = 'a7000000-0000-4000-8000-0000000000a7';
    raise exception 'FEHLER: zweite Aenderung innerhalb von 30 Tagen ging durch';
  exception when raise_exception then
    get stacked diagnostics meldung = message_text, bis = pg_exception_detail;
    if meldung <> 'NAME_GESPERRT' then raise exception '%', meldung; end if;
    if bis::timestamptz < am + interval '30 days' - interval '1 second' then raise exception 'FEHLER: falsches Datum %', bis; end if;
  end;

  -- 4 die Frist laesst sich nicht selbst faelschen
  update public.profile set name_geaendert_am = '2000-01-01' where user_id = 'a7000000-0000-4000-8000-0000000000a7';
  if (select p.name_geaendert_am from public.profile p where p.user_id = 'a7000000-0000-4000-8000-0000000000a7') <> am then
    raise exception 'FEHLER: Frist selbst zurueckdatiert';
  end if;

  -- 8 Loeschen und neu Anlegen setzt die Frist nicht zurueck: das eigene Loeschen ist gesperrt
  begin
    delete from public.profile where user_id = 'a7000000-0000-4000-8000-0000000000a7';
    raise exception 'FEHLER: eigenes Profil liess sich loeschen (Frist umgehbar)';
  exception when insufficient_privilege then
    get stacked diagnostics meldung = message_text;
    if meldung <> 'PROFIL_LOESCHEN_GESPERRT' then raise exception '%', meldung; end if;
  end;
  if (select p.name_geaendert_am from public.profile p where p.user_id = 'a7000000-0000-4000-8000-0000000000a7') <> am then
    raise exception 'FEHLER: Frist nach Loeschversuch veraendert';
  end if;

  -- 5 fremde Zeile: RLS laesst keine Aenderung zu
  update public.profile set benutzername = 'fremd' where user_id = 'b7000000-0000-4000-8000-0000000000b7';
end;
$$;

reset role;

do $$
begin
  -- 6 Besitzer (wie verwaltung_name): frei, die Frist bleibt; ausdruecklich null hebt die Sperre auf
  update public.profile set benutzername = 'sperre_admin' where user_id = 'a7000000-0000-4000-8000-0000000000a7';
  if (select p.name_geaendert_am from public.profile p where p.user_id = 'a7000000-0000-4000-8000-0000000000a7') is null then
    raise exception 'FEHLER: Besitzer-Aenderung hat die Frist geloescht';
  end if;
  -- 7 nach 30 Tagen wieder frei (Frist zurueckgesetzt, dann als Spieler aendern)
  update public.profile set name_geaendert_am = now() - interval '31 days' where user_id = 'a7000000-0000-4000-8000-0000000000a7';
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a7000000-0000-4000-8000-0000000000a7","role":"authenticated"}', true);
update public.profile set benutzername = 'sperre_test_a4' where user_id = 'a7000000-0000-4000-8000-0000000000a7';
reset role;

do $$
begin
  if (select p.benutzername from public.profile p where p.user_id = 'a7000000-0000-4000-8000-0000000000a7') <> 'sperre_test_a4' then
    raise exception 'FEHLER: nach 30 Tagen nicht frei';
  end if;
  raise notice 'benutzername-sperre-rls-test: alles gruen';
end;
$$;

rollback;

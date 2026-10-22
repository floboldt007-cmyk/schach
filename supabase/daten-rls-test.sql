-- Prueft das Daten-Schema (supabase/daten-schema.sql) im Supabase SQL Editor. Alles wird am Ende zurueckgerollt.
-- Erwartete Ausgabe: eine Zeile "Daten-RLS-Test erfolgreich". Jede andere Meldung ist ein Befund.
begin;

-- Zwei kurzlebige Auth-Nutzer, damit die Fremdschluessel realistisch bleiben.
insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'rls-a@example.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'rls-b@example.invalid');

-- Ausgangsdaten, die konto_loeschen() spaeter entfernen muss (als Besitzer angelegt). Die Angaben des
-- Anmeldeanbieters stehen wie bei einer Google-Anmeldung in raw_user_meta_data.
update auth.users set raw_user_meta_data = '{"name":"Test A"}' where id = '11111111-1111-4111-8111-111111111111';
insert into public.profile (user_id, benutzername) values ('11111111-1111-4111-8111-111111111111', 'rls_test_a');
insert into public.spielstaende (user_id, stand, format_version, geraet)
values ('11111111-1111-4111-8111-111111111111', '{"besitzer":"A"}', 1, 'RLS-Test');
-- Anmeldeprotokoll wie bei Supabase (nur wenn die Tabelle da und fuer den SQL Editor beschreibbar ist)
do $$
begin
  insert into auth.audit_log_entries (id, payload, ip_address)
  values (gen_random_uuid(), '{"action":"login","actor_id":"11111111-1111-4111-8111-111111111111","actor_username":"rls-a@example.invalid"}', '192.0.2.1'),
         (gen_random_uuid(), '{"action":"login","actor_id":"22222222-2222-4222-8222-222222222222","actor_username":"rls-b@example.invalid"}', '192.0.2.2');
  perform set_config('daten_test.protokoll', 'ja', true);
exception
  when undefined_table or insufficient_privilege then perform set_config('daten_test.protokoll', 'nein', true);
end
$$;

set local role authenticated;

-- Nutzer A: darf nur fuer sich archivieren und melden.
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);

insert into public.partien_archiv
  (user_id, bot_id, farbe, ergebnis, grund, modus, zuege, klassen, genauigkeit, hinweise, zuruecknahmen, dauer_s, app_version, gespielt_am)
values
  ('11111111-1111-4111-8111-111111111111', 'benno', 'w', 'sieg', 'matt', 'normal', 'e2e4 e7e5 g1f3', 'gut bester',
   87.5, 0, 0, 120, 'sw30', now());

insert into public.nutzung (user_id, ereignis, daten, geraet, app_version)
values ('11111111-1111-4111-8111-111111111111', 'screen', '{"name":"arena"}', 'Desktop Firefox', 'sw30');

do $$
begin
  begin
    insert into public.partien_archiv (user_id, zuege) values ('22222222-2222-4222-8222-222222222222', 'e2e4');
    raise exception 'FEHLER: Nutzer A konnte fuer Nutzer B archivieren';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.nutzung (user_id, ereignis) values ('22222222-2222-4222-8222-222222222222', 'screen');
    raise exception 'FEHLER: Nutzer A konnte fuer Nutzer B Nutzung melden';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.partien_archiv set ergebnis = 'remis' where user_id = '11111111-1111-4111-8111-111111111111';
    raise exception 'FEHLER: Das Archiv ist aenderbar';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform count(*) from public.nutzung;
    raise exception 'FEHLER: Nutzer koennen die Nutzung lesen';
  exception
    when insufficient_privilege then null;
  end;

  begin
    delete from public.nutzung where user_id = '11111111-1111-4111-8111-111111111111';
    raise exception 'FEHLER: Nutzer koennen die Nutzung loeschen (das geht nur mit dem ganzen Konto)';
  exception
    when insufficient_privilege then null;
  end;

  begin
    truncate public.partien_archiv;
    raise exception 'FEHLER: Nutzer koennen das Archiv leeren (truncate umgeht RLS)';
  exception
    when insufficient_privilege then null;
  end;

  begin
    truncate public.nutzung;
    raise exception 'FEHLER: Nutzer koennen die Nutzung leeren (truncate umgeht RLS)';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.partien_archiv (user_id, zuege) values ('11111111-1111-4111-8111-111111111111', repeat('e2e4 ', 4001));
    raise exception 'FEHLER: Groessen-Check fuer zuege fehlt';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.partien_archiv (user_id, zuege) values ('11111111-1111-4111-8111-111111111111', 'Nf3 e5');
    raise exception 'FEHLER: Format-Check fuer zuege fehlt';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.partien_archiv (user_id, farbe) values ('11111111-1111-4111-8111-111111111111', 'x');
    raise exception 'FEHLER: Farb-Check fehlt';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.nutzung (user_id, ereignis, daten)
    values ('11111111-1111-4111-8111-111111111111', 'gross', to_jsonb(repeat('a', 3000)));
    raise exception 'FEHLER: Groessen-Check fuer nutzung.daten fehlt';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.nutzung (user_id, ereignis, geraet)
    values ('11111111-1111-4111-8111-111111111111', 'screen', repeat('u', 121));
    raise exception 'FEHLER: Groessen-Check fuer nutzung.geraet fehlt';
  exception
    when check_violation then null;
  end;

  if (select count(*) from public.partien_archiv) <> 1 then
    raise exception 'FEHLER: Nutzer A sieht nicht genau das eigene Archiv';
  end if;
end
$$;

-- Auskunft fuer A: Konto, Profil, Spielstand-Metadaten (ohne den Stand), Archiv und Nutzung.
do $$
declare
  d jsonb;
begin
  d := public.meine_daten();
  if (d -> 'konto' ->> 'email') is distinct from 'rls-a@example.invalid'
     or (d -> 'konto' -> 'angaben_anbieter' ->> 'name') is distinct from 'Test A' then
    raise exception 'FEHLER: meine_daten ohne Konto: %', d;
  end if;
  if (d -> 'profil' ->> 'benutzername') is distinct from 'rls_test_a' then
    raise exception 'FEHLER: meine_daten ohne Profil: %', d;
  end if;
  if (d -> 'spielstand' ->> 'format_version') is distinct from '1' or (d -> 'spielstand') ? 'stand' then
    raise exception 'FEHLER: meine_daten liefert den Spielstand falsch (Metadaten ja, Stand nein): %', d;
  end if;
  if jsonb_array_length(d -> 'partien_archiv') <> 1 or jsonb_array_length(d -> 'nutzung') <> 1 then
    raise exception 'FEHLER: meine_daten unvollstaendig: %', d;
  end if;
  if (d -> 'nutzung' -> 0 ->> 'ereignis') is distinct from 'screen' then
    raise exception 'FEHLER: meine_daten liefert die Nutzung nicht: %', d;
  end if;
  -- Online-Partien immer als Liste (leer, wenn online-schema.sql fehlt), Widerruf und Anmeldeprotokoll als Schluessel
  if not (d ? 'partien_online') or jsonb_typeof(d -> 'partien_online') <> 'array' or not (d ? 'freigabe_widerruf')
     or not (d ? 'anmeldeprotokoll') then
    raise exception 'FEHLER: meine_daten ohne partien_online, freigabe_widerruf oder anmeldeprotokoll: %', d;
  end if;
  if current_setting('daten_test.protokoll', true) = 'ja'
     and (jsonb_array_length(d -> 'anmeldeprotokoll') <> 1 or (d -> 'anmeldeprotokoll' -> 0 ->> 'ip') <> '192.0.2.1') then
    raise exception 'FEHLER: meine_daten liefert das eigene Anmeldeprotokoll nicht (genau eine Zeile): %', d -> 'anmeldeprotokoll';
  end if;
end
$$;

-- Nutzer B sieht nichts von A, auch nicht ueber die Auskunft, und darf fuer sich archivieren.
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);

do $$
declare
  d jsonb;
begin
  if exists (select 1 from public.partien_archiv where user_id = '11111111-1111-4111-8111-111111111111') then
    raise exception 'FEHLER: Nutzer B kann das Archiv von A lesen';
  end if;
  d := public.meine_daten();
  -- ->> liefert fuer JSON-null ein SQL-NULL (-> lieferte das jsonb 'null', das nie "is null" ist)
  if jsonb_array_length(d -> 'partien_archiv') <> 0 or jsonb_array_length(d -> 'nutzung') <> 0
     or (d ->> 'profil') is not null or (d ->> 'spielstand') is not null
     or (d -> 'konto' ->> 'email') is distinct from 'rls-b@example.invalid' then
    raise exception 'FEHLER: meine_daten zeigt B fremde Daten: %', d;
  end if;
end
$$;

insert into public.partien_archiv (user_id, bot_id, farbe, ergebnis, zuege)
values ('22222222-2222-4222-8222-222222222222', 'hilde', 'b', 'niederlage', 'd2d4 d7d5');

-- Das fremde DELETE trifft wegen RLS keine Zeile.
delete from public.partien_archiv where user_id = '11111111-1111-4111-8111-111111111111';

-- Ohne Anmeldung ist das Loeschen nicht erreichbar.
set local role anon;
do $$
begin
  begin
    perform public.konto_loeschen();
    raise exception 'FEHLER: anon darf konto_loeschen() aufrufen';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform public.meine_daten();
    raise exception 'FEHLER: anon darf meine_daten() aufrufen';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

-- Mengenbremse und Widerruf (mit B): hoechstens 300 Partien und 2000 Nutzungsereignisse je 24 Stunden; danach
-- loescht der Widerruf alles Geteilte von B, A bleibt unberuehrt.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
insert into public.partien_archiv (user_id, zuege)
select '22222222-2222-4222-8222-222222222222', 'e2e4' from generate_series(1, 299);
insert into public.nutzung (user_id, ereignis)
select '22222222-2222-4222-8222-222222222222', 'screen' from generate_series(1, 2000);
do $$
begin
  begin
    insert into public.partien_archiv (user_id, zuege) values ('22222222-2222-4222-8222-222222222222', 'e2e4');
    raise exception 'FEHLER: Mengenbremse liess die 301. Partie in 24 Stunden zu';
  exception
    when others then if sqlerrm <> 'DATEN_MENGE' then raise; end if;
  end;
  begin
    insert into public.nutzung (user_id, ereignis) values ('22222222-2222-4222-8222-222222222222', 'screen');
    raise exception 'FEHLER: Mengenbremse liess das 2001. Nutzungsereignis in 24 Stunden zu';
  exception
    when others then if sqlerrm <> 'DATEN_MENGE' then raise; end if;
  end;
  -- auch innerhalb einer einzigen Anfrage zaehlt jede Zeile (B hat schon 2000)
  begin
    insert into public.nutzung (user_id, ereignis)
    select '22222222-2222-4222-8222-222222222222', 'screen' from generate_series(1, 5);
    raise exception 'FEHLER: Mengenbremse umgangen mit einer Sammel-Anfrage';
  exception
    when others then if sqlerrm <> 'DATEN_MENGE' then raise; end if;
  end;
  -- B kann den Widerrufs-Vermerk weder lesen noch selbst schreiben
  begin
    perform 1 from public.freigabe_widerrufe;
    raise exception 'FEHLER: freigabe_widerrufe direkt lesbar';
  exception
    when insufficient_privilege then null;
  end;
  begin
    insert into public.freigabe_widerrufe (user_id) values ('22222222-2222-4222-8222-222222222222');
    raise exception 'FEHLER: freigabe_widerrufe direkt beschreibbar';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

do $$
declare
  r jsonb;
  d jsonb;
begin
  r := public.freigabe_widerrufen();
  if (r ->> 'geloescht_partien')::integer <> 300 or (r ->> 'geloescht_nutzung')::integer <> 2000 then
    raise exception 'FEHLER: Widerruf loescht nicht alles Geteilte von B: %', r;
  end if;
  if exists (select 1 from public.partien_archiv where user_id = '22222222-2222-4222-8222-222222222222') then
    raise exception 'FEHLER: nach dem Widerruf liegt noch Archiv von B';
  end if;
  d := public.meine_daten();
  if jsonb_array_length(d -> 'partien_archiv') <> 0 or jsonb_array_length(d -> 'nutzung') <> 0
     or (d -> 'freigabe_widerruf' ->> 'widerrufen_am') is null
     or (d -> 'freigabe_widerruf' ->> 'geloescht_nutzung')::integer <> 2000 then
    raise exception 'FEHLER: Auskunft nach dem Widerruf falsch: %', d;
  end if;
  -- ein zweiter Widerruf ist harmlos und haelt die Summen
  r := public.freigabe_widerrufen();
  if (r ->> 'geloescht_partien')::integer <> 0 then
    raise exception 'FEHLER: zweiter Widerruf: %', r;
  end if;
end
$$;

-- Nach dem Widerruf darf B (mit neuer Zustimmung) wieder teilen: die Bremse zaehlt nur vorhandene Zeilen.
insert into public.partien_archiv (user_id, bot_id, farbe, ergebnis, zuege)
values ('22222222-2222-4222-8222-222222222222', 'hilde', 'b', 'niederlage', 'd2d4 d7d5');

reset role;
do $$
begin
  if (select count(*) from public.partien_archiv where user_id = '11111111-1111-4111-8111-111111111111') <> 1
     or (select count(*) from public.nutzung where user_id = '11111111-1111-4111-8111-111111111111') <> 1 then
    raise exception 'FEHLER: Widerruf von B hat Daten von A angefasst';
  end if;
end
$$;

set local role anon;
do $$
begin
  perform public.freigabe_widerrufen();
  raise exception 'FEHLER: anon darf freigabe_widerrufen() aufrufen';
exception
  when insufficient_privilege then null;
end
$$;

-- Nutzer A loescht sein Konto: alles weg, auch der Auth-Nutzer; B bleibt unberuehrt.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);

do $$
begin
  if not exists (select 1 from public.partien_archiv where user_id = '11111111-1111-4111-8111-111111111111') then
    raise exception 'FEHLER: Nutzer B konnte das Archiv von A loeschen';
  end if;
end
$$;

select public.konto_loeschen();

reset role;

do $$
begin
  if exists (select 1 from auth.users where id = '11111111-1111-4111-8111-111111111111') then
    raise exception 'FEHLER: konto_loeschen hat auth.users nicht geloescht';
  end if;
  if exists (select 1 from public.profile where user_id = '11111111-1111-4111-8111-111111111111') then
    raise exception 'FEHLER: konto_loeschen hat das Profil nicht geloescht';
  end if;
  if exists (select 1 from public.spielstaende where user_id = '11111111-1111-4111-8111-111111111111') then
    raise exception 'FEHLER: konto_loeschen hat den Spielstand nicht geloescht';
  end if;
  if exists (select 1 from public.partien_archiv where user_id = '11111111-1111-4111-8111-111111111111') then
    raise exception 'FEHLER: konto_loeschen hat das Archiv nicht geloescht';
  end if;
  if exists (select 1 from public.nutzung where user_id = '11111111-1111-4111-8111-111111111111') then
    raise exception 'FEHLER: konto_loeschen hat die Nutzung nicht geloescht';
  end if;
  if not exists (select 1 from auth.users where id = '22222222-2222-4222-8222-222222222222') then
    raise exception 'FEHLER: konto_loeschen hat einen fremden Nutzer geloescht';
  end if;
  if (select count(*) from public.partien_archiv where user_id = '22222222-2222-4222-8222-222222222222') <> 1 then
    raise exception 'FEHLER: konto_loeschen hat fremdes Archiv angefasst';
  end if;
  if current_setting('daten_test.protokoll', true) = 'ja' then
    if exists (select 1 from auth.audit_log_entries e where e.payload ->> 'actor_id' = '11111111-1111-4111-8111-111111111111') then
      raise exception 'FEHLER: konto_loeschen hat das Anmeldeprotokoll von A nicht geloescht';
    end if;
    if not exists (select 1 from auth.audit_log_entries e where e.payload ->> 'actor_id' = '22222222-2222-4222-8222-222222222222') then
      raise exception 'FEHLER: konto_loeschen hat das Anmeldeprotokoll von B geloescht';
    end if;
  end if;
end
$$;

select 'Daten-RLS-Test erfolgreich' as ergebnis;
rollback;

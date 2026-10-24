-- RLS- und Ablauf-Test fuer supabase/schule-schema.sql. Im Supabase SQL Editor ausfuehren (nach schema.sql und
-- schule-schema.sql). Alles laeuft in einer Transaktion und wird am Ende zurueckgerollt: keine Testnutzer, keine
-- Klassen bleiben zurueck. Am Ende steht "Schule-RLS-Test erfolgreich".
--
-- Rollen im Test: L (Lehrkraft), A und B (Schuelerinnen), F (fremd), M (zweite Lehrkraft).
-- Werte zwischen den Schritten (Klassen-ID, Code, Aufgaben-ID ...) wandern ueber set_config('schule.*', ..., true).
begin;

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'schule-l@example.invalid'),
  ('a1111111-1111-4111-8111-111111111111', 'schule-a@example.invalid'),
  ('b2222222-2222-4222-8222-222222222222', 'schule-b@example.invalid'),
  ('f3333333-3333-4333-8333-333333333333', 'schule-f@example.invalid'),
  ('d4444444-4444-4444-8444-444444444444', 'schule-m@example.invalid');

-- ---------- anon: nichts ----------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    perform 1 from public.klassen;
    raise exception 'FEHLER: anon kann klassen lesen';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.klassen_mitglieder;
    raise exception 'FEHLER: anon kann klassen_mitglieder lesen';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.klassen_aufgaben;
    raise exception 'FEHLER: anon kann klassen_aufgaben lesen';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.schule_erstelle_klasse('Probe');
    raise exception 'FEHLER: anon darf schule_erstelle_klasse aufrufen';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.schule_tritt_bei('ABCDEF', 'Anna');
    raise exception 'FEHLER: anon darf schule_tritt_bei aufrufen';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.schule_meine_klassen();
    raise exception 'FEHLER: anon darf schule_meine_klassen aufrufen';
  exception when insufficient_privilege then null;
  end;
end
$$;

-- ---------- angemeldet ohne Nutzer-ID (kaputtes Token): jede Funktion lehnt ab ----------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
do $$
declare
  aufruf text;
begin
  foreach aufruf in array array[
    'select public.schule_erstelle_klasse(''Probe'')',
    'select public.schule_tritt_bei(''ABCDEF'', ''Anna'')',
    'select public.schule_verlasse(gen_random_uuid())',
    'select public.schule_melde_fortschritt(1, 1, 1)',
    'select public.schule_meine_klassen()',
    'select public.schule_klassen_uebersicht(gen_random_uuid())',
    'select public.schule_aufgabe_anlegen(gen_random_uuid(), ''Titel'', ''partien'', ''{"anzahl":1}'')',
    'select public.schule_aufgabe_loeschen(gen_random_uuid())',
    'select public.schule_entferne_mitglied(gen_random_uuid())',
    'select public.schule_schliesse_klasse(gen_random_uuid())',
    'select public.schule_loesche_klasse(gen_random_uuid())'] loop
    begin
      execute aufruf;
      raise exception 'FEHLER: ohne Nutzer-ID angenommen: %', aufruf;
    exception when raise_exception then
      if sqlerrm <> 'SCHULE_NICHT_ANGEMELDET' then raise; end if;
    end;
  end loop;
end
$$;

-- ---------- L legt eine Klasse an und stellt Aufgaben ----------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
do $$
declare
  k jsonb;
  a jsonb;
  n integer;
begin
  -- ungueltige Namen
  begin
    perform public.schule_erstelle_klasse(' x ');
    raise exception 'FEHLER: Klassenname mit einem Zeichen angenommen';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_NAME_UNGUELTIG' then raise; end if;
  end;
  begin
    perform public.schule_erstelle_klasse('lehrer@schule.de');
    raise exception 'FEHLER: Klassenname mit @ angenommen';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_NAME_UNGUELTIG' then raise; end if;
  end;
  begin
    perform public.schule_erstelle_klasse(repeat('a', 41));
    raise exception 'FEHLER: Klassenname mit 41 Zeichen angenommen';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_NAME_UNGUELTIG' then raise; end if;
  end;
  k := public.schule_erstelle_klasse('  Schach-AG   10b ');
  if k ->> 'name' <> 'Schach-AG 10b' or (k ->> 'code') !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$' or (k ->> 'aktiv')::boolean is not true then
    raise exception 'FEHLER: Klasse falsch angelegt: %', k;
  end if;
  perform set_config('schule.klasse', k ->> 'id', true);
  perform set_config('schule.code', k ->> 'code', true);
  -- die eigene Klasse sieht L direkt in der Tabelle, mit Code
  if (select count(*) from public.klassen) <> 1 or (select code from public.klassen) <> k ->> 'code' then
    raise exception 'FEHLER: Leitung sieht ihre Klasse nicht';
  end if;
  -- L kann nicht in die eigene Klasse
  begin
    perform public.schule_tritt_bei(k ->> 'code', 'Herr L');
    raise exception 'FEHLER: Leitung konnte der eigenen Klasse beitreten';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_EIGENE_KLASSE' then raise; end if;
  end;
  -- Aufgaben: Bot ohne Sterne bekommt 1, Raetsel und Partien mit Anzahl
  a := public.schule_aufgabe_anlegen((k ->> 'id')::uuid, 'Besiege Ritter Rudi', 'bot', '{"bot":"rudi"}', public.schule_heute() + 7);
  if a -> 'ziel' <> '{"bot":"rudi","sterne":1}'::jsonb or (a ->> 'erledigt')::integer <> 0 then
    raise exception 'FEHLER: Bot-Aufgabe falsch: %', a;
  end if;
  perform set_config('schule.aufgabe1', a ->> 'id', true);
  a := public.schule_aufgabe_anlegen((k ->> 'id')::uuid, 'Fünf Partien', 'partien', '{"anzahl":5}');
  if a -> 'ziel' <> '{"anzahl":5}'::jsonb or a ->> 'faellig' is not null then
    raise exception 'FEHLER: Partien-Aufgabe falsch: %', a;
  end if;
  perform set_config('schule.aufgabe2', a ->> 'id', true);
  a := public.schule_aufgabe_anlegen((k ->> 'id')::uuid, 'Zehn Rätsel', 'raetsel', '{"anzahl":10,"extra":"weg"}');
  if a -> 'ziel' <> '{"anzahl":10}'::jsonb then
    raise exception 'FEHLER: Ziel wird nicht auf die bekannten Felder gekuerzt: %', a;
  end if;
  -- ungueltige Aufgaben
  begin
    perform public.schule_aufgabe_anlegen((k ->> 'id')::uuid, 'Besiege Magnus', 'bot', '{"bot":"magnus"}');
    raise exception 'FEHLER: unbekannter Bot angenommen';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_AUFGABE_UNGUELTIG' then raise; end if;
  end;
  begin
    perform public.schule_aufgabe_anlegen((k ->> 'id')::uuid, 'Rudi', 'bot', '{"bot":"rudi","sterne":4}');
    raise exception 'FEHLER: 4 Sterne angenommen';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_AUFGABE_UNGUELTIG' then raise; end if;
  end;
  begin
    perform public.schule_aufgabe_anlegen((k ->> 'id')::uuid, 'Null Partien', 'partien', '{"anzahl":0}');
    raise exception 'FEHLER: Anzahl 0 angenommen';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_AUFGABE_UNGUELTIG' then raise; end if;
  end;
  begin
    perform public.schule_aufgabe_anlegen((k ->> 'id')::uuid, 'Viele', 'raetsel', '{"anzahl":"5"}');
    raise exception 'FEHLER: Anzahl als Text angenommen';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_AUFGABE_UNGUELTIG' then raise; end if;
  end;
  begin
    perform public.schule_aufgabe_anlegen((k ->> 'id')::uuid, 'Hausaufgabe', 'lesen', '{"anzahl":1}');
    raise exception 'FEHLER: unbekannte Art angenommen';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_AUFGABE_UNGUELTIG' then raise; end if;
  end;
  begin
    perform public.schule_aufgabe_anlegen((k ->> 'id')::uuid, 'Weit weg', 'partien', '{"anzahl":1}', public.schule_heute() + 400);
    raise exception 'FEHLER: Faelligkeit in mehr als einem Jahr angenommen';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_AUFGABE_UNGUELTIG' then raise; end if;
  end;
  begin
    perform public.schule_aufgabe_anlegen((k ->> 'id')::uuid, 'x', 'partien', '{"anzahl":1}');
    raise exception 'FEHLER: Titel mit einem Zeichen angenommen';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_AUFGABE_UNGUELTIG' then raise; end if;
  end;
  select count(*) into n from public.klassen_aufgaben;
  if n <> 3 then
    raise exception 'FEHLER: Leitung sieht % statt 3 Aufgaben', n;
  end if;
  -- direkt schreiben geht nie
  begin
    insert into public.klassen (name, code, leitung) values ('Direkt', 'ZZZZZZ', '11111111-1111-4111-8111-111111111111');
    raise exception 'FEHLER: Leitung kann klassen direkt anlegen';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.klassen set aktiv = false;
    raise exception 'FEHLER: Leitung kann klassen direkt aendern';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.klassen_aufgaben (klasse, titel, art, ziel) values ((k ->> 'id')::uuid, 'Direkt', 'partien', '{"anzahl":1}');
    raise exception 'FEHLER: Leitung kann Aufgaben direkt anlegen';
  exception when insufficient_privilege then null;
  end;
end
$$;

-- ---------- A tritt bei ----------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
do $$
declare
  r jsonb;
  r2 jsonb;
  code text := current_setting('schule.code');
begin
  -- Anzeigename: nie eine E-Mail, 2 bis 24 Zeichen, mindestens ein Buchstabe
  begin
    perform public.schule_tritt_bei(code, 'anna@schule.de');
    raise exception 'FEHLER: E-Mail als Anzeigename angenommen';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_NAME_UNGUELTIG' then raise; end if;
  end;
  begin
    perform public.schule_tritt_bei(code, 'A');
    raise exception 'FEHLER: Anzeigename mit einem Zeichen angenommen';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_NAME_UNGUELTIG' then raise; end if;
  end;
  begin
    perform public.schule_tritt_bei(code, '12345');
    raise exception 'FEHLER: Anzeigename ohne Buchstaben angenommen';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_NAME_UNGUELTIG' then raise; end if;
  end;
  begin
    perform public.schule_tritt_bei(code, repeat('b', 25));
    raise exception 'FEHLER: Anzeigename mit 25 Zeichen angenommen';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_NAME_UNGUELTIG' then raise; end if;
  end;
  begin
    perform public.schule_tritt_bei(code, '<b>Anna</b>');
    raise exception 'FEHLER: Anzeigename mit Spitzklammern angenommen';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_NAME_UNGUELTIG' then raise; end if;
  end;
  -- Code klein und mit Bindestrich geht auch
  r := public.schule_tritt_bei(lower(substr(code, 1, 3)) || '-' || lower(substr(code, 4)), '  Anna-Lena  ');
  if r ->> 'fehler' is not null or r -> 'mitglied' ->> 'anzeigename' <> 'Anna-Lena' or (r -> 'klasse' ->> 'id') <> current_setting('schule.klasse')
    or r -> 'klasse' ->> 'name' <> 'Schach-AG 10b' then
    raise exception 'FEHLER: Beitritt falsch: %', r;
  end if;
  perform set_config('schule.mitglied_a', r -> 'mitglied' ->> 'id', true);
  -- zweiter Beitritt: dieselbe Mitgliedschaft, nur der Name aendert sich
  r2 := public.schule_tritt_bei(code, 'Anna');
  if r2 -> 'mitglied' ->> 'id' <> r -> 'mitglied' ->> 'id' or r2 -> 'mitglied' ->> 'anzeigename' <> 'Anna' then
    raise exception 'FEHLER: zweiter Beitritt legt eine neue Mitgliedschaft an: %', r2;
  end if;
  -- Umlaute und Akzente sind erlaubt
  r2 := public.schule_tritt_bei(code, 'Änne Øyvind');
  if r2 -> 'mitglied' ->> 'anzeigename' <> 'Änne Øyvind' then
    raise exception 'FEHLER: Anzeigename mit Umlaut abgelehnt: %', r2;
  end if;
  perform public.schule_tritt_bei(code, 'Anna');
end
$$;

-- ---------- B tritt bei (gleicher Name geht nicht) ----------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
do $$
declare
  r jsonb;
begin
  begin
    perform public.schule_tritt_bei(current_setting('schule.code'), 'ANNA');
    raise exception 'FEHLER: derselbe Anzeigename (andere Schreibung) zweimal in einer Klasse';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_NAME_VERGEBEN' then raise; end if;
  end;
  r := public.schule_tritt_bei(current_setting('schule.code'), 'Ben');
  perform set_config('schule.mitglied_b', r -> 'mitglied' ->> 'id', true);
end
$$;

-- ---------- A meldet Fortschritt und sieht nur Eigenes ----------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
do $$
declare
  n integer;
  mk jsonb;
  fremd text := gen_random_uuid()::text;
begin
  n := public.schule_melde_fortschritt(3, 7, 12, 81.46,
    '{"zuege":240,"arten":[{"art":"fehler","anzahl":9},{"art":"ungenau","anzahl":7}]}'::jsonb,
    jsonb_build_array(current_setting('schule.aufgabe1'), fremd));
  if n <> 1 then
    raise exception 'FEHLER: Meldung traf % statt 1 Klasse', n;
  end if;
  if (select count(*) from public.klassen_fortschritt) <> 1
    or (select genauigkeit_schnitt from public.klassen_fortschritt) <> 81.5
    or (select erledigt from public.klassen_fortschritt) <> array[current_setting('schule.aufgabe1')::uuid] then
    raise exception 'FEHLER: eigener Fortschritt falsch gespeichert (fremde Aufgaben-ID muss wegfallen)';
  end if;
  -- nur der Tag der Meldung, keine Uhrzeit (sonst liesse sich mitschreiben, wann jemand spielt)
  if (select pg_typeof(aktualisiert_am)::text from public.klassen_fortschritt) <> 'date'
    or (select aktualisiert_am from public.klassen_fortschritt) <> public.schule_heute() then
    raise exception 'FEHLER: aktualisiert_am ist kein Tag (Europe/Berlin)';
  end if;
  -- noch einmal: dieselbe Zeile, neue Werte
  perform public.schule_melde_fortschritt(4, 8, 13, null, '{}'::jsonb, '[]'::jsonb);
  if (select count(*) from public.klassen_fortschritt) <> 1 or (select bots_besiegt from public.klassen_fortschritt) <> 4
    or (select genauigkeit_schnitt from public.klassen_fortschritt) is not null then
    raise exception 'FEHLER: zweite Meldung ersetzt die Zeile nicht';
  end if;
  perform public.schule_melde_fortschritt(3, 7, 12, 81.46,
    '{"zuege":240,"arten":[{"art":"fehler","anzahl":9},{"art":"ungenau","anzahl":7}]}'::jsonb,
    jsonb_build_array(current_setting('schule.aufgabe1')));
  -- ungueltige Meldungen
  begin
    perform public.schule_melde_fortschritt(31, 7, 12);
    raise exception 'FEHLER: 31 besiegte Bots angenommen';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_FORTSCHRITT_UNGUELTIG' then raise; end if;
  end;
  begin
    perform public.schule_melde_fortschritt(3, -1, 12);
    raise exception 'FEHLER: negative Sterne angenommen';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_FORTSCHRITT_UNGUELTIG' then raise; end if;
  end;
  begin
    perform public.schule_melde_fortschritt(3, 7, 12, 100.5);
    raise exception 'FEHLER: Genauigkeit ueber 100 angenommen';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_FORTSCHRITT_UNGUELTIG' then raise; end if;
  end;
  begin
    perform public.schule_melde_fortschritt(3, 7, 12, 80, '{"zuege":10,"email":"a@b.de"}'::jsonb);
    raise exception 'FEHLER: fremdes Feld in haeufigste_fehler angenommen';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_FORTSCHRITT_UNGUELTIG' then raise; end if;
  end;
  begin
    perform public.schule_melde_fortschritt(3, 7, 12, 80, '{"arten":[{"art":"brillant","anzahl":1}]}'::jsonb);
    raise exception 'FEHLER: unbekannte Fehlerart angenommen';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_FORTSCHRITT_UNGUELTIG' then raise; end if;
  end;
  begin
    perform public.schule_melde_fortschritt(3, 7, 12, 80, '{"arten":[{"art":"fehler","anzahl":1},{"art":"fehler","anzahl":1},{"art":"fehler","anzahl":1},{"art":"fehler","anzahl":1},{"art":"fehler","anzahl":1}]}'::jsonb);
    raise exception 'FEHLER: mehr als 4 Fehlerarten angenommen';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_FORTSCHRITT_UNGUELTIG' then raise; end if;
  end;
  begin
    perform public.schule_melde_fortschritt(3, 7, 12, 80, '{}'::jsonb, '["keine-id"]'::jsonb);
    raise exception 'FEHLER: erledigt mit kaputter ID angenommen';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_FORTSCHRITT_UNGUELTIG' then raise; end if;
  end;
  -- Sichtbarkeit: keine Klassen-Tabelle, die eigene Mitglieds-Zeile, der eigene Fortschritt, die Aufgaben
  if (select count(*) from public.klassen) <> 0 then
    raise exception 'FEHLER: Mitglied liest die Tabelle klassen (mit der Konto-ID der Leitung)';
  end if;
  if (select count(*) from public.klassen_mitglieder) <> 1 or (select anzeigename from public.klassen_mitglieder) <> 'Anna' then
    raise exception 'FEHLER: Mitglied sieht nicht genau die eigene Mitglieds-Zeile';
  end if;
  if (select count(*) from public.klassen_fortschritt) <> 1 or (select mitglied::text from public.klassen_fortschritt) <> current_setting('schule.mitglied_a') then
    raise exception 'FEHLER: Mitglied sieht nicht genau den eigenen Fortschritt';
  end if;
  if (select count(*) from public.klassen_aufgaben) <> 3 then
    raise exception 'FEHLER: Mitglied sieht die Aufgaben der Klasse nicht';
  end if;
  begin
    perform user_id from public.klassen_mitglieder;
    raise exception 'FEHLER: Mitglied kann die Spalte user_id lesen';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.klassen_fortschritt set sterne = 30;
    raise exception 'FEHLER: Mitglied kann den Fortschritt direkt aendern';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.klassen_mitglieder (klasse, user_id, anzeigename)
    values (current_setting('schule.klasse')::uuid, 'a1111111-1111-4111-8111-111111111111', 'Zweitname');
    raise exception 'FEHLER: Mitglied kann sich direkt eintragen';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.klassen_aufgaben;
    raise exception 'FEHLER: Mitglied kann Aufgaben loeschen';
  exception when insufficient_privilege then null;
  end;
  -- nur die Leitung darf die Uebersicht, Aufgaben, Entfernen und Schliessen
  begin
    perform public.schule_klassen_uebersicht(current_setting('schule.klasse')::uuid);
    raise exception 'FEHLER: Mitglied bekommt die Uebersicht der Klasse';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_KEINE_LEITUNG' then raise; end if;
  end;
  begin
    perform public.schule_aufgabe_anlegen(current_setting('schule.klasse')::uuid, 'Selbst gestellt', 'partien', '{"anzahl":1}');
    raise exception 'FEHLER: Mitglied kann Aufgaben stellen';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_KEINE_LEITUNG' then raise; end if;
  end;
  begin
    perform public.schule_schliesse_klasse(current_setting('schule.klasse')::uuid);
    raise exception 'FEHLER: Mitglied kann die Klasse schliessen';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_KEINE_LEITUNG' then raise; end if;
  end;
  if public.schule_entferne_mitglied(current_setting('schule.mitglied_b')::uuid) then
    raise exception 'FEHLER: Mitglied kann ein anderes Mitglied entfernen';
  end if;
  if public.schule_aufgabe_loeschen(current_setting('schule.aufgabe2')::uuid) then
    raise exception 'FEHLER: Mitglied kann eine Aufgabe loeschen';
  end if;
  if public.schule_loesche_klasse(current_setting('schule.klasse')::uuid) then
    raise exception 'FEHLER: Mitglied kann die Klasse loeschen';
  end if;
  -- Meine Klassen: Name, eigener Anzeigename, Aufgaben und eigenes erledigt, aber nie die Leitung
  mk := public.schule_meine_klassen();
  if jsonb_array_length(mk -> 'mitglied') <> 1 or jsonb_array_length(mk -> 'leitung') <> 0
    or mk -> 'mitglied' -> 0 ->> 'anzeigename' <> 'Anna' or jsonb_array_length(mk -> 'mitglied' -> 0 -> 'aufgaben') <> 3
    or mk -> 'mitglied' -> 0 -> 'erledigt' <> jsonb_build_array(current_setting('schule.aufgabe1'))
    or mk::text like '%11111111-1111-4111-8111-111111111111%' or mk::text like '%example.invalid%'
    or mk -> 'mitglied' -> 0 ? 'code' then
    raise exception 'FEHLER: schule_meine_klassen fuer ein Mitglied falsch: %', mk;
  end if;
end
$$;

-- ---------- F (fremd): nichts sehen, nichts tun, Codes nicht durchprobieren ----------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f3333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
do $$
declare
  r jsonb;
  i integer;
  falsch text;
begin
  if (select count(*) from public.klassen) <> 0 or (select count(*) from public.klassen_mitglieder) <> 0
    or (select count(*) from public.klassen_fortschritt) <> 0 or (select count(*) from public.klassen_aufgaben) <> 0 then
    raise exception 'FEHLER: Fremde sehen Klassen, Mitglieder, Fortschritt oder Aufgaben';
  end if;
  if public.schule_meine_klassen() <> '{"leitung":[],"mitglied":[]}'::jsonb then
    raise exception 'FEHLER: schule_meine_klassen zeigt Fremden etwas';
  end if;
  begin
    perform public.schule_klassen_uebersicht(current_setting('schule.klasse')::uuid);
    raise exception 'FEHLER: Fremde bekommen die Uebersicht';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_KEINE_LEITUNG' then raise; end if;
  end;
  if public.schule_aufgabe_loeschen(current_setting('schule.aufgabe1')::uuid) or public.schule_verlasse(current_setting('schule.klasse')::uuid)
    or public.schule_entferne_mitglied(current_setting('schule.mitglied_a')::uuid) then
    raise exception 'FEHLER: Fremde koennen loeschen oder entfernen';
  end if;
  if public.schule_melde_fortschritt(10, 30, 999) <> 0 then
    raise exception 'FEHLER: Fremde melden Fortschritt in eine Klasse';
  end if;
  -- ein falscher Code zaehlt als Fehlversuch (ohne raise), nach 10 an einem Tag ist Schluss
  falsch := case when current_setting('schule.code') = 'ZZZZZZ' then 'YYYYYY' else 'ZZZZZZ' end;
  for i in 1..10 loop
    r := public.schule_tritt_bei(case when i = 1 then 'zu kurz' else falsch end, 'Fritz');
    if r ->> 'fehler' is distinct from 'SCHULE_CODE_UNGUELTIG' then
      raise exception 'FEHLER: falscher Code % meldet %', i, r;
    end if;
  end loop;
  begin
    perform public.schule_tritt_bei(current_setting('schule.code'), 'Fritz');
    raise exception 'FEHLER: nach 10 Fehlversuchen noch ein Beitritt moeglich';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_ZU_VIELE_VERSUCHE' then raise; end if;
  end;
  begin
    perform 1 from public.schule_versuche;
    raise exception 'FEHLER: Nutzer lesen schule_versuche';
  exception when insufficient_privilege then null;
  end;
end
$$;

-- ---------- M (andere Lehrkraft): sieht die Klasse von L nicht ----------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d4444444-4444-4444-8444-444444444444","role":"authenticated"}', true);
do $$
declare
  k jsonb;
begin
  k := public.schule_erstelle_klasse('Verein U14');
  perform set_config('schule.klasse_m', k ->> 'id', true);
  perform set_config('schule.code_m', k ->> 'code', true);
  if (select count(*) from public.klassen) <> 1 or (select count(*) from public.klassen_mitglieder) <> 0
    or (select count(*) from public.klassen_aufgaben) <> 0 or (select count(*) from public.klassen_fortschritt) <> 0 then
    raise exception 'FEHLER: eine andere Leitung sieht fremde Klassen';
  end if;
  begin
    perform public.schule_klassen_uebersicht(current_setting('schule.klasse')::uuid);
    raise exception 'FEHLER: andere Leitung bekommt die Uebersicht';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_KEINE_LEITUNG' then raise; end if;
  end;
  begin
    perform public.schule_aufgabe_anlegen(current_setting('schule.klasse')::uuid, 'Fremd', 'partien', '{"anzahl":1}');
    raise exception 'FEHLER: andere Leitung stellt Aufgaben in fremder Klasse';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_KEINE_LEITUNG' then raise; end if;
  end;
end
$$;

-- A ist jetzt in zwei Klassen: eine Meldung trifft beide
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
do $$
begin
  perform public.schule_tritt_bei(current_setting('schule.code_m'), 'Anna');
  if public.schule_melde_fortschritt(3, 7, 12, 81.46,
    '{"zuege":240,"arten":[{"art":"fehler","anzahl":9},{"art":"ungenau","anzahl":7}]}'::jsonb,
    jsonb_build_array(current_setting('schule.aufgabe1'))) <> 2 then
    raise exception 'FEHLER: Meldung trifft nicht beide Klassen';
  end if;
  -- erledigt gilt je Klasse: die Aufgabe von L steht nicht in der Zeile der Klasse von M
  if (select count(*) from public.klassen_fortschritt where cardinality(erledigt) = 0) <> 1 then
    raise exception 'FEHLER: erledigt einer fremden Aufgabe landet in der zweiten Klasse';
  end if;
end
$$;

-- ---------- L: Uebersicht ohne Konto-IDs und E-Mails, Spalte user_id gesperrt ----------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
do $$
declare
  u jsonb;
  mk jsonb;
  a1 jsonb;
begin
  if (select count(*) from public.klassen_mitglieder) <> 2 or (select count(*) from public.klassen_fortschritt) <> 1 then
    raise exception 'FEHLER: Leitung sieht nicht alle Mitglieder (2) und den Fortschritt (1) ihrer Klasse';
  end if;
  if (select string_agg(anzeigename, ',' order by anzeigename) from public.klassen_mitglieder) <> 'Anna,Ben' then
    raise exception 'FEHLER: Leitung sieht falsche Anzeigenamen';
  end if;
  begin
    perform user_id from public.klassen_mitglieder;
    raise exception 'FEHLER: Leitung kann die Konto-IDs der Mitglieder lesen';
  exception when insufficient_privilege then null;
  end;
  u := public.schule_klassen_uebersicht(current_setting('schule.klasse')::uuid);
  if jsonb_array_length(u -> 'mitglieder') <> 2 or u -> 'mitglieder' -> 0 ->> 'anzeigename' <> 'Anna'
    or (u -> 'mitglieder' -> 0 -> 'fortschritt' ->> 'sterne')::integer <> 7
    or (u -> 'mitglieder' -> 0 -> 'fortschritt' ->> 'genauigkeit_schnitt')::numeric <> 81.5
    or u -> 'mitglieder' -> 0 -> 'fortschritt' -> 'haeufigste_fehler' -> 'arten' -> 0 ->> 'art' <> 'fehler'
    or jsonb_typeof(u -> 'mitglieder' -> 1 -> 'fortschritt') <> 'null'
    or jsonb_array_length(u -> 'aufgaben') <> 3 or u -> 'klasse' ->> 'code' <> current_setting('schule.code') then
    raise exception 'FEHLER: Uebersicht falsch: %', u;
  end if;
  -- die Leitung bekommt vom Stand nur den Tag, auch beim direkten Lesen der Tabelle
  if (u -> 'mitglieder' -> 0 -> 'fortschritt' ->> 'aktualisiert_am') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or (select pg_typeof(f.aktualisiert_am)::text from public.klassen_fortschritt f) <> 'date' then
    raise exception 'FEHLER: Leitung sieht eine Uhrzeit: %', u -> 'mitglieder' -> 0 -> 'fortschritt' ->> 'aktualisiert_am';
  end if;
  select x into a1 from jsonb_array_elements(u -> 'aufgaben') x where x ->> 'id' = current_setting('schule.aufgabe1');
  if (a1 ->> 'erledigt')::integer <> 1 then
    raise exception 'FEHLER: Aufgabe zaehlt % statt 1 Erledigte', a1 ->> 'erledigt';
  end if;
  if u::text like '%a1111111-1111-4111-8111-111111111111%' or u::text like '%b2222222-2222-4222-8222-222222222222%'
    or u::text like '%example.invalid%' or u::text like '%user_id%' then
    raise exception 'FEHLER: Uebersicht enthaelt Konto-IDs oder E-Mails';
  end if;
  mk := public.schule_meine_klassen();
  if jsonb_array_length(mk -> 'leitung') <> 1 or (mk -> 'leitung' -> 0 ->> 'mitglieder')::integer <> 2
    or mk -> 'leitung' -> 0 ->> 'code' <> current_setting('schule.code') then
    raise exception 'FEHLER: schule_meine_klassen fuer die Leitung falsch: %', mk;
  end if;
  -- Aufgabe loeschen nimmt sie auch aus erledigt
  if not public.schule_aufgabe_loeschen(current_setting('schule.aufgabe1')::uuid) then
    raise exception 'FEHLER: Leitung kann ihre Aufgabe nicht loeschen';
  end if;
  if exists (select 1 from public.klassen_fortschritt where cardinality(erledigt) > 0) then
    raise exception 'FEHLER: geloeschte Aufgabe bleibt in erledigt stehen';
  end if;
  -- B entfernen: Mitgliedschaft weg
  if not public.schule_entferne_mitglied(current_setting('schule.mitglied_b')::uuid) then
    raise exception 'FEHLER: Leitung kann ein Mitglied nicht entfernen';
  end if;
  if (select count(*) from public.klassen_mitglieder) <> 1 then
    raise exception 'FEHLER: entferntes Mitglied noch da';
  end if;
end
$$;

-- ---------- A verlaesst die Klasse von M: Mitgliedschaft und Fortschritt weg ----------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
do $$
begin
  if not public.schule_verlasse(current_setting('schule.klasse_m')::uuid) then
    raise exception 'FEHLER: Verlassen meldet nichts';
  end if;
  if (select count(*) from public.klassen_mitglieder) <> 1 or (select count(*) from public.klassen_fortschritt) <> 1 then
    raise exception 'FEHLER: nach dem Verlassen bleiben Zeilen der Klasse stehen';
  end if;
  if public.schule_verlasse(current_setting('schule.klasse_m')::uuid) then
    raise exception 'FEHLER: zweites Verlassen meldet true';
  end if;
end
$$;

-- ---------- L schliesst die Klasse ----------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
do $$
begin
  if not public.schule_schliesse_klasse(current_setting('schule.klasse')::uuid) then
    raise exception 'FEHLER: Schliessen meldet false';
  end if;
  if (select aktiv from public.klassen where id = current_setting('schule.klasse')::uuid) then
    raise exception 'FEHLER: Klasse nach dem Schliessen noch aktiv';
  end if;
  begin
    perform public.schule_aufgabe_anlegen(current_setting('schule.klasse')::uuid, 'Zu spaet', 'partien', '{"anzahl":1}');
    raise exception 'FEHLER: Aufgabe in geschlossener Klasse';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_KLASSE_GESCHLOSSEN' then raise; end if;
  end;
  -- die Uebersicht bleibt lesbar
  if jsonb_array_length(public.schule_klassen_uebersicht(current_setting('schule.klasse')::uuid) -> 'mitglieder') <> 1 then
    raise exception 'FEHLER: Uebersicht nach dem Schliessen weg';
  end if;
end
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.schule_tritt_bei(current_setting('schule.code'), 'Ben');
    raise exception 'FEHLER: Beitritt in geschlossene Klasse';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_KLASSE_GESCHLOSSEN' then raise; end if;
  end;
end
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
do $$
declare
  mk jsonb;
begin
  if public.schule_melde_fortschritt(9, 20, 50) <> 0 then
    raise exception 'FEHLER: Meldung in geschlossene Klasse';
  end if;
  if (select sterne from public.klassen_fortschritt) <> 7 then
    raise exception 'FEHLER: Fortschritt in geschlossener Klasse veraendert';
  end if;
  mk := public.schule_meine_klassen();
  if (mk -> 'mitglied' -> 0 ->> 'aktiv')::boolean or jsonb_array_length(mk -> 'mitglied' -> 0 -> 'aufgaben') <> 0 then
    raise exception 'FEHLER: geschlossene Klasse zeigt dem Mitglied noch Aufgaben: %', mk;
  end if;
end
$$;

-- ---------- Grenzen und Aufraeumen (als Besitzer vorbereitet) ----------
reset role;
-- 60 Mitglieder in der Klasse von M (direkt eingetragen), dann ist sie voll
insert into auth.users (id, email)
select ('e0000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'voll' || i || '@example.invalid' from generate_series(1, 60) i;
insert into public.klassen_mitglieder (klasse, user_id, anzeigename)
select current_setting('schule.klasse_m')::uuid, ('e0000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'Kind ' || i
from generate_series(1, 60) i;
-- 30 Aufgaben in der Klasse von M, dann geht keine mehr
insert into public.klassen_aufgaben (klasse, titel, art, ziel)
select current_setting('schule.klasse_m')::uuid, 'Aufgabe ' || i, 'partien', '{"anzahl":1}' from generate_series(1, 30) i;
-- 19 weitere Klassen fuer M (zusammen 20), eine davon seit 91 Tagen geschlossen
insert into public.klassen (name, code, leitung, aktiv, geschlossen_am)
select 'Gruppe ' || i, 'QQQQQ' || substr('ABCDEFGHJKLMNPQRSTUVWXYZ', i, 1), 'd4444444-4444-4444-8444-444444444444',
  i <> 1, case when i = 1 then now() - interval '91 days' end
from generate_series(1, 19) i;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.schule_tritt_bei(current_setting('schule.code_m'), 'Ben');
    raise exception 'FEHLER: 61. Mitglied angenommen';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_KLASSE_VOLL' then raise; end if;
  end;
end
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d4444444-4444-4444-8444-444444444444","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.schule_aufgabe_anlegen(current_setting('schule.klasse_m')::uuid, 'Einunddreissig', 'partien', '{"anzahl":1}');
    raise exception 'FEHLER: 31. Aufgabe angenommen';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_ZU_VIELE_AUFGABEN' then raise; end if;
  end;
  -- 20 Klassen, davon eine seit 91 Tagen geschlossen: die raeumt der Server beim Anlegen weg, dann passt eine neue
  perform public.schule_erstelle_klasse('Gruppe 20');
  if (select count(*) from public.klassen) <> 20 or exists (select 1 from public.klassen where name = 'Gruppe 1') then
    raise exception 'FEHLER: alte geschlossene Klasse nicht aufgeraeumt';
  end if;
  begin
    perform public.schule_erstelle_klasse('Gruppe 21');
    raise exception 'FEHLER: 21. Klasse angenommen';
  exception when raise_exception then
    if sqlerrm <> 'SCHULE_ZU_VIELE_KLASSEN' then raise; end if;
  end;
end
$$;

-- ---------- Konto loeschen: alles der Person verschwindet ----------
reset role;
delete from auth.users where id = 'a1111111-1111-4111-8111-111111111111';
do $$
begin
  if exists (select 1 from public.klassen_mitglieder where user_id = 'a1111111-1111-4111-8111-111111111111')
    or (select count(*) from public.klassen_fortschritt) <> 0 then
    raise exception 'FEHLER: nach dem Loeschen des Kontos bleiben Mitgliedschaft oder Fortschritt';
  end if;
end
$$;
delete from auth.users where id = '11111111-1111-4111-8111-111111111111';
do $$
begin
  if exists (select 1 from public.klassen where leitung = '11111111-1111-4111-8111-111111111111')
    or exists (select 1 from public.klassen_aufgaben where klasse = current_setting('schule.klasse')::uuid) then
    raise exception 'FEHLER: nach dem Loeschen des Kontos der Leitung bleibt die Klasse';
  end if;
end
$$;

select 'Schule-RLS-Test erfolgreich' as ergebnis;
rollback;

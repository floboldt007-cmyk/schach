-- Prueft supabase/kronen-schema.sql im Supabase SQL Editor (als Besitzer, wie dort ueblich). Alles wird am Ende
-- zurueckgerollt. Drei kurzlebige Nutzer A, B und C, spaeter weitere. Jeder Fehler bricht mit "FEHLER: ..." ab; ohne
-- Fehler endet der Lauf mit ROLLBACK.
-- Abschnitte: 1 neuer Stand (Bauer III, ohne Gruppe); 2 keine Tabellenrechte fuer Nutzer; 3 anon darf nichts;
-- 4 Wochengrenze (Sonntag 23:59 alte Woche, Montag 00:00 neue, auch an der Zeitumstellung); 5 Konstanten;
-- 6 Online-Wertung; 7 Schutz gegen Absprache; 8 Gegnersuche; 9 Bot- und KI-Ergebnis; 10 Start-Liga;
-- 11 Wochen-Gruppen (Beitritt bei der ersten Krone, 31. Person in neuer Gruppe, Bots bis 30, Anzeige ohne fremde
-- Kennungen); 12 Wochen-Abrechnung (5 auf, 5 ab, Raender Bauer III und Koenig I, Belohnungen genau einmal,
-- Aufstiegs-Banner, zweiter Aufruf aendert nichts).
begin;

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'kronen-a@example.invalid'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'kronen-b@example.invalid'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'kronen-c@example.invalid');

-- ---------- 1. Neuer Stand: Bauer III, keine Gruppe, keine Kronen ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);

do $$
declare
  s jsonb;
  g jsonb;
begin
  s := public.kronen_mein_stand();
  if (s->>'stufe')::int is distinct from 0 or (s->>'kronen')::int is distinct from 0 or s->>'platz' is not null
     or (s->>'n')::int is distinct from 30 or s->>'woche' is null then
    raise exception 'FEHLER: neuer Stand falsch (%)', s;
  end if;
  -- Lesen allein bringt kein Konto in eine Gruppe (Flo 07.11.2026: erst mit der ersten Krone)
  g := public.liga_meine_gruppe();
  if g->>'gruppe' is not null or jsonb_array_length(g->'mitglieder') <> 0 or (g->>'stufe')::int is distinct from 0
     or (g->>'ende')::date - (g->>'woche')::date <> 6 or jsonb_array_length(g->'belohnung') < 1
     or jsonb_typeof(g->'offen') is distinct from 'array' then
    raise exception 'FEHLER: Gruppe ohne Buchung falsch (%)', g;
  end if;
end;
$$;

reset role;
do $$
begin
  if exists (select 1 from public.liga_mitglieder where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
     or exists (select 1 from public.liga_gruppen) then
    raise exception 'FEHLER: Lesen hat eine Gruppe angelegt';
  end if;
end;
$$;

-- ---------- 2. Keine Tabellenrechte fuer angemeldete Nutzer ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);

do $$
begin
  begin
    perform 1 from public.kronen_stand;
    raise exception 'FEHLER: A konnte kronen_stand lesen';
  exception
    when insufficient_privilege then null;
  end;
  begin
    update public.kronen_stand set stufe = 17 where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    raise exception 'FEHLER: A konnte die eigene Stufe direkt aendern';
  exception
    when insufficient_privilege then null;
  end;
  begin
    insert into public.kronen_buchungen (user_id, quelle, ref, delta, woche)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'online', 'erfunden-0001', 30, current_date);
    raise exception 'FEHLER: A konnte sich selbst Kronen buchen';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.kronen_buchungen;
    raise exception 'FEHLER: A konnte kronen_buchungen lesen';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.liga_gruppen;
    raise exception 'FEHLER: A konnte liga_gruppen lesen';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.liga_mitglieder;
    raise exception 'FEHLER: A konnte liga_mitglieder lesen (fremde Gruppen)';
  exception
    when insufficient_privilege then null;
  end;
  begin
    update public.liga_mitglieder set kronen = 9999;
    raise exception 'FEHLER: A konnte Wochen-Kronen direkt aendern';
  exception
    when insufficient_privilege then null;
  end;
  begin
    insert into public.liga_belohnungen (user_id, woche, stufe, platz, art, menge)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', current_date, 0, 1, 'taler', 9999);
    raise exception 'FEHLER: A konnte sich eine Belohnung schreiben';
  exception
    when insufficient_privilege then null;
  end;
  begin
    update public.kronen_schalter set zaehler_an = true;
    raise exception 'FEHLER: A konnte den Zaehler einschalten';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform public.kronen_stand_sichern('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    raise exception 'FEHLER: A konnte die interne Funktion kronen_stand_sichern aufrufen';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform public.liga_buchen('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 500);
    raise exception 'FEHLER: A konnte liga_buchen aufrufen';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform public.liga_abrechnen();
    raise exception 'FEHLER: A konnte liga_abrechnen aufrufen';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.liga_rangliste(1, true);
    raise exception 'FEHLER: A konnte liga_rangliste einer beliebigen Gruppe aufrufen';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

-- C legt beim ersten Aufruf nur den eigenen Stand an
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
select public.kronen_mein_stand();
reset role;
do $$
begin
  if (select count(*) from public.kronen_stand
      where user_id in ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')) <> 2
     or exists (select 1 from public.kronen_stand where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') then
    raise exception 'FEHLER: kronen_mein_stand legt fremde oder fehlende Staende an';
  end if;
end;
$$;

-- ---------- 3. anon darf nichts ----------
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
  begin
    perform public.liga_meine_gruppe();
    raise exception 'FEHLER: anon konnte liga_meine_gruppe aufrufen';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform public.kronen_konstanten();
    raise exception 'FEHLER: anon konnte kronen_konstanten aufrufen';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.kronen_stand;
    raise exception 'FEHLER: anon konnte kronen_stand lesen';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

-- angemeldet, aber ohne Nutzerkennung: Fehler statt leerer Stand
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
  begin
    perform public.liga_meine_gruppe();
    raise exception 'FEHLER: liga_meine_gruppe ohne Nutzerkennung angenommen';
  exception
    when others then if sqlerrm <> 'KRONEN_ANMELDUNG' then raise; end if;
  end;
end;
$$;

-- ---------- 4. Wochengrenze (Europe/Berlin, auch an der Zeitumstellung) ----------
reset role;
do $$
begin
  -- Sonntag 23:59 gehoert zur alten Woche, Montag 00:00 zur neuen (Winterzeit-Beginn am 25.10.2026)
  if public.liga_woche_am('2026-10-25 23:59:00 Europe/Berlin'::timestamptz) <> '2026-10-19'::date
     or public.liga_woche_am('2026-10-26 00:00:00 Europe/Berlin'::timestamptz) <> '2026-10-26'::date
     -- Sommerzeit-Beginn am 29.03.2026
     or public.liga_woche_am('2026-03-29 23:59:59 Europe/Berlin'::timestamptz) <> '2026-03-23'::date
     or public.liga_woche_am('2026-03-30 00:00:00 Europe/Berlin'::timestamptz) <> '2026-03-30'::date
     -- Sonntag 23:30 in Berlin ist in UTC schon Sonntag 22:30, Montag 00:30 in Berlin ist in UTC noch Sonntag
     or public.liga_woche_am('2026-11-08 23:30:00+00'::timestamptz) <> '2026-11-09'::date then
    raise exception 'FEHLER: liga_woche_am rechnet die Wochengrenze falsch';
  end if;
  if extract(isodow from public.liga_woche_heute()) <> 1 then
    raise exception 'FEHLER: liga_woche_heute ist kein Montag';
  end if;
  if public.liga_wochen_anteil(public.liga_woche_heute() - 7) <> 1
     or public.liga_wochen_anteil(public.liga_woche_heute() + 7) <> 0
     or public.liga_wochen_anteil(public.liga_woche_heute()) not between 0 and 1 then
    raise exception 'FEHLER: liga_wochen_anteil ausserhalb 0 bis 1';
  end if;
  -- eine Gruppe muss an einem Montag beginnen
  begin
    insert into public.liga_gruppen (woche, stufe) values (public.liga_woche_heute() + 1, 0);
    raise exception 'FEHLER: Gruppe an einem Dienstag angenommen';
  exception
    when check_violation then null;
  end;
end;
$$;

-- ---------- 5. Konstanten ----------
do $$
declare
  k jsonb := public.kronen_konstanten();
begin
  if (k#>>'{kronen,ki,sieg}')::int is distinct from 20 or (k#>>'{kronen,online,niederlage}')::int is distinct from -15
     or (k#>>'{kronen,bot,niederlage}')::int is distinct from 0 or (k->>'bot_tagesgrenze')::int is distinct from 10
     or (k->>'ki_tagesgrenze')::int is distinct from 20 or (k->>'ki_mindestdauer_s')::int is distinct from 60
     or (k->>'online_mindest_halbzuege')::int is distinct from 4 or (k->>'paar_tagesgrenze')::int is distinct from 3
     or (k->>'gruppe_groesse')::int is distinct from 30 or (k->>'aufstieg_plaetze')::int is distinct from 5
     or (k->>'abstieg_plaetze')::int is distinct from 5 or jsonb_array_length(k->'bot_ziel_max') <> 6
     or k->'belohnung'->0->>'art' is distinct from 'banner' or k ? 'saison_tage' or k ? 'stufe_kronen' then
    raise exception 'FEHLER: kronen_konstanten weicht vom Plan ab (%)', k;
  end if;
  if (select zaehler_an from public.kronen_schalter where id) then
    raise exception 'FEHLER: Zaehler ist nach dem Einspielen an';
  end if;
end;
$$;

-- ---------- 6. Online-Ergebnis (Task 3): Kronen und Elo bei gewerteten Partien ----------
-- Hilfen als Besitzer: Stand setzen und eine Partie anlegen (der Insert-Trigger macht sie zur offenen Einladung,
-- das folgende Update setzt Spieler, Wertung und 'laeuft' wie spaeter die Gegnersuche).
create function pg_temp.setze_stand(uid uuid, k integer, e integer, n integer)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.kronen_stand_sichern(uid);
  update public.kronen_stand
  set kronen = k, elo = e, elo_n = n
  where user_id = uid;
$$;

create function pg_temp.neue_partie(w uuid, s uuid, gew boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  p uuid;
begin
  insert into public.partien_online (erstellt_von, fen) values (w, 'egal') returning id into p;
  -- 4 Halbzuege: gerade genug fuer eine Wertung (Task 3b); kuerzere Partien setzt Abschnitt 7 selbst
  update public.partien_online set weiss = w, schwarz = s, gewertet = gew, status = 'laeuft', zuege = 'e4 e5 Nf3 Nc6'
  where id = p;
  return p;
end;
$$;

create function pg_temp.beende(p uuid, erg text, g text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.partien_online set status = 'beendet', ergebnis = erg, grund = g where id = p;
$$;

revoke all on function pg_temp.setze_stand(uuid, integer, integer, integer), pg_temp.neue_partie(uuid, uuid, boolean),
  pg_temp.beende(uuid, text, text) from public;

do $$
declare
  a constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  b constant uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  p uuid;
  sa public.kronen_stand;
  sb public.kronen_stand;
begin
  -- Online-Sieg: A (weiss) schlaegt B, beide 1000 Elo und neu (K=40)
  perform pg_temp.setze_stand(a, 0, 1000, 0);
  perform pg_temp.setze_stand(b, 0, 1000, 0);
  p := pg_temp.neue_partie(a, b, true);
  perform pg_temp.beende(p, '1-0', 'matt');
  select * into sa from public.kronen_stand where user_id = a;
  select * into sb from public.kronen_stand where user_id = b;
  if sa.kronen <> 30 or sb.kronen <> 0 then
    raise exception 'FEHLER: Online-Sieg: Kronen A % / B % (erwartet 30 / 0)', sa.kronen, sb.kronen;
  end if;
  if sa.elo <= 1000 or sb.elo >= 1000 or (sa.elo - 1000) + (sb.elo - 1000) <> 0 or sa.elo <> 1020 then
    raise exception 'FEHLER: Online-Sieg: Elo A % / B % (erwartet 1020 / 980)', sa.elo, sb.elo;
  end if;
  if sa.elo_n <> 1 or sb.elo_n <> 1 then
    raise exception 'FEHLER: Online-Sieg: Partienzahl fuer Elo nicht erhoeht';
  end if;

  -- Nur einmal: dieselbe Partie noch einmal beenden (Trigger feuert erneut) bucht nichts doppelt
  update public.partien_online set status = 'laeuft' where id = p;
  perform pg_temp.beende(p, '1-0', 'matt');
  if (select count(*) from public.kronen_buchungen where quelle = 'online' and ref = p::text) <> 2
     or (select kronen from public.kronen_stand where user_id = a) <> 30
     or (select elo from public.kronen_stand where user_id = a) <> 1020 then
    raise exception 'FEHLER: Online-Ergebnis wurde doppelt gebucht';
  end if;

  -- Wochen-Kronen nie unter 0: B hat diese Woche 0 (eine Niederlage) und verliert als Weiss erneut; Buchung mit 0,
  -- die Summe (310) bleibt, A hat danach 60 in der Woche
  perform pg_temp.setze_stand(b, 310, 1000, 20);
  p := pg_temp.neue_partie(b, a, true);
  perform pg_temp.beende(p, '0-1', 'aufgabe');
  if (select kronen from public.kronen_stand where user_id = b) <> 310
     or (select kronen from public.liga_mitglieder where user_id = b) <> 0
     or (select delta from public.kronen_buchungen where user_id = b and ref = p::text) <> 0
     or (select kronen from public.liga_mitglieder where user_id = a) <> 60 then
    raise exception 'FEHLER: Wochen-Kronen: B unter 0 oder A nicht 60 (B %, A %)',
      (select kronen from public.liga_mitglieder where user_id = b), (select kronen from public.liga_mitglieder where user_id = a);
  end if;
  -- beide sind mit der ersten Buchung in dieselbe Gruppe dieser Woche gekommen (Bauer III)
  if (select count(distinct gruppe) from public.liga_mitglieder where user_id in (a, b)) <> 1
     or (select g.stufe from public.liga_gruppen g join public.liga_mitglieder m on m.gruppe = g.id where m.user_id = a) <> 0 then
    raise exception 'FEHLER: A und B nicht in einer Bauer-III-Gruppe';
  end if;

  -- Abgebrochen (ergebnis null): keine Buchung, Elo unveraendert
  select * into sa from public.kronen_stand where user_id = a;
  p := pg_temp.neue_partie(a, b, true);
  perform pg_temp.beende(p, null, 'abgebrochen');
  if exists (select 1 from public.kronen_buchungen where ref = p::text)
     or (select elo from public.kronen_stand where user_id = a) <> sa.elo
     or (select kronen from public.kronen_stand where user_id = a) <> sa.kronen then
    raise exception 'FEHLER: abgebrochene Partie wurde gewertet';
  end if;

  -- Ungewertet (Einladung unter Freunden): keine Buchung
  p := pg_temp.neue_partie(a, b, false);
  perform pg_temp.beende(p, '1-0', 'matt');
  if exists (select 1 from public.kronen_buchungen where ref = p::text)
     or (select kronen from public.kronen_stand where user_id = a) <> sa.kronen then
    raise exception 'FEHLER: ungewertete Partie wurde gewertet';
  end if;

  -- Remis bei gleicher Elo: beide +10, Elo bleibt
  perform pg_temp.setze_stand(a, 0, 1200, 30);
  perform pg_temp.setze_stand(b, 0, 1200, 30);
  p := pg_temp.neue_partie(a, b, true);
  perform pg_temp.beende(p, '1/2-1/2', 'remis');
  select * into sa from public.kronen_stand where user_id = a;
  select * into sb from public.kronen_stand where user_id = b;
  if sa.kronen <> 10 or sb.kronen <> 10 or sa.elo <> 1200 or sb.elo <> 1200 then
    raise exception 'FEHLER: Remis: A %/% B %/% (erwartet 10/1200 je)', sa.kronen, sa.elo, sb.kronen, sb.elo;
  end if;
end;
$$;

-- Nutzer duerfen die Buchung nicht selbst ausloesen
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.kronen_online_buchen('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', gen_random_uuid(), 1, 1000);
    raise exception 'FEHLER: kronen_online_buchen ist fuer Nutzer offen';
  exception when insufficient_privilege then
    null;
  end;
  begin
    update public.partien_online set gewertet = true;
    raise exception 'FEHLER: Nutzer koennen gewertet setzen';
  exception when insufficient_privilege then
    null;
  end;
  -- Spieler setzt das Ergebnis seiner Partie selbst: verboten, also keine Kronen (Ergebnisse nur ueber Server-Funktionen)
  begin
    update public.partien_online set status = 'beendet', ergebnis = '1-0', grund = 'matt';
    raise exception 'FEHLER: Nutzer koennen ein Ergebnis selbst eintragen';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
reset role;

-- ---------- 7. Schutz gegen Absprache (Task 3b): kurze Partien, Paar-Grenze ----------
-- A und C (A und B haben in Abschnitt 6 heute schon 3 gewertete Partien gespielt).
do $$
declare
  a constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  b constant uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  c constant uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  p uuid;
  i integer;
  sa public.kronen_stand;
begin
  perform pg_temp.setze_stand(a, 0, 1000, 30);
  perform pg_temp.setze_stand(c, 0, 1000, 30);

  -- Kurz: Aufgabe nach 3 Halbzuegen, Remis nach 2, Zeitablauf nach 0 -> nichts gebucht, Partie trotzdem beendet
  p := pg_temp.neue_partie(a, c, true);
  update public.partien_online set zuege = 'e4 e5 Nf3' where id = p;
  perform pg_temp.beende(p, '1-0', 'aufgabe');
  if exists (select 1 from public.kronen_buchungen where ref = p::text)
     or (select status from public.partien_online where id = p) <> 'beendet' then
    raise exception 'FEHLER: kurze Partie (3 Halbzuege) wurde gewertet oder nicht beendet';
  end if;
  p := pg_temp.neue_partie(a, c, true);
  update public.partien_online set zuege = 'e4 e5' where id = p;
  perform pg_temp.beende(p, '1/2-1/2', 'remis');
  if exists (select 1 from public.kronen_buchungen where ref = p::text) then
    raise exception 'FEHLER: Remis nach 2 Halbzuegen wurde gewertet';
  end if;
  p := pg_temp.neue_partie(a, c, true);
  update public.partien_online set zuege = '' where id = p;
  perform pg_temp.beende(p, '0-1', 'zeit');
  if exists (select 1 from public.kronen_buchungen where ref = p::text) then
    raise exception 'FEHLER: Zeitablauf ohne Zug wurde gewertet';
  end if;
  select * into sa from public.kronen_stand where user_id = a;
  if sa.kronen <> 0 or sa.elo <> 1000 or sa.elo_n <> 30 then
    raise exception 'FEHLER: kurze Partien haben Kronen oder Elo veraendert (%/%/%)', sa.kronen, sa.elo, sa.elo_n;
  end if;

  -- Paar-Grenze: 3 gewertete Partien A gegen C zaehlen (Farben wechseln), die 4. nicht
  for i in 1..3 loop
    if i = 2 then
      p := pg_temp.neue_partie(c, a, true);
      perform pg_temp.beende(p, '0-1', 'matt');
    else
      p := pg_temp.neue_partie(a, c, true);
      perform pg_temp.beende(p, '1-0', 'matt');
    end if;
  end loop;
  select * into sa from public.kronen_stand where user_id = a;
  if sa.kronen <> 90 or sa.elo_n <> 33 then
    raise exception 'FEHLER: Paar-Grenze: die ersten 3 Partien zaehlen nicht alle (Kronen %, Partien %)', sa.kronen, sa.elo_n;
  end if;
  p := pg_temp.neue_partie(a, c, true);
  perform pg_temp.beende(p, '1-0', 'matt');
  if exists (select 1 from public.kronen_buchungen where ref = p::text)
     or (select kronen from public.kronen_stand where user_id = a) <> 90
     or (select elo from public.kronen_stand where user_id = a) <> sa.elo then
    raise exception 'FEHLER: Paar-Grenze: die 4. Partie am Tag gegen denselben Gegner wurde gewertet';
  end if;
  if (select status from public.partien_online where id = p) <> 'beendet' then
    raise exception 'FEHLER: Paar-Grenze: die 4. Partie ist nicht beendet';
  end if;

  -- die Grenze gilt je Paar: B gegen C zaehlt weiter
  perform pg_temp.setze_stand(b, 0, 1000, 30);
  p := pg_temp.neue_partie(b, c, true);
  perform pg_temp.beende(p, '1-0', 'matt');
  if (select count(*) from public.kronen_buchungen where ref = p::text) <> 2 then
    raise exception 'FEHLER: Paar-Grenze trifft ein anderes Paar';
  end if;
end;
$$;

-- ---------- 8. Gegnersuche (Task 4) ----------
-- Drei weitere Nutzer D, E, F (A und B sind nach der Paarung in einer laufenden Partie). In einer Transaktion steht
-- now() still: Wartezeit entsteht nur, wenn pg_temp.setze_seit die Zeile in die Vergangenheit legt.
insert into auth.users (id, email)
values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'kronen-d@example.invalid'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'kronen-e@example.invalid'),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'kronen-f@example.invalid');

create function pg_temp.setze_seit(uid uuid, sekunden integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.suche_warteschlange set seit = now() - make_interval(secs => sekunden) where user_id = uid;
$$;
revoke all on function pg_temp.setze_seit(uuid, integer) from public;

do $$
begin
  perform pg_temp.setze_stand('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 0, 1000, 30);
  perform pg_temp.setze_stand('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 0, 1050, 30);
  perform pg_temp.setze_stand('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 0, 1600, 30);
end;
$$;

-- Paarung: A und B suchen beide 3+2
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
begin
  if (public.online_suche_start('3+2')->>'wartet') is distinct from 'true' then
    raise exception 'FEHLER: Paarung: A allein wartet nicht';
  end if;
  begin
    perform public.online_suche_start('3 Minuten');
    raise exception 'FEHLER: Gegnersuche nimmt eine falsche Zeit an';
  exception when others then
    if sqlerrm <> 'KRONEN_EINGABE' then raise; end if;
  end;
  begin
    perform 1 from public.suche_warteschlange;
    raise exception 'FEHLER: Nutzer lesen die Warteschlange';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$
begin
  if (public.online_suche_start('3+2')->>'partie') is null then
    raise exception 'FEHLER: Paarung: B findet A nicht';
  end if;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  r jsonb := public.online_suche_stand();
begin
  if r->>'partie' is null then
    raise exception 'FEHLER: Paarung: A erfaehrt nichts von der Partie (%)', r;
  end if;
  -- A sieht die Partie ueber die bestehende Lese-Policy
  if not exists (select 1 from public.partien_online where id = (r->>'partie')::uuid and gewertet and status = 'laeuft') then
    raise exception 'FEHLER: Paarung: A sieht keine gewertete laufende Partie';
  end if;
end;
$$;
reset role;
do $$
begin
  if (select count(*) from public.partien_online p
      where p.gewertet and p.status = 'laeuft' and p.bedenkzeit_s = 180 and p.inkrement_s = 2
        and 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' in (p.weiss, p.schwarz)
        and 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' in (p.weiss, p.schwarz)) <> 1 then
    raise exception 'FEHLER: Paarung: nicht genau eine Partie A gegen B mit 3+2';
  end if;
  if exists (select 1 from public.suche_warteschlange) then
    raise exception 'FEHLER: Paarung: Warteschlange nicht leer';
  end if;
end;
$$;

-- Andere Zeit: D 3+2, E 10+0 -> beide warten; Abbruch: Zeile weg, kein Beleg
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}', true);
do $$
begin
  if (public.online_suche_start('3+2')->>'wartet') is distinct from 'true' then
    raise exception 'FEHLER: andere Zeit: D wartet nicht';
  end if;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","role":"authenticated"}', true);
do $$
begin
  if (public.online_suche_start('10+0')->>'wartet') is distinct from 'true'
     or (public.online_suche_stand()->>'wartet') is distinct from 'true' then
    raise exception 'FEHLER: andere Zeit: D und E wurden gepaart';
  end if;
  if public.online_suche_ende() <> '{}'::jsonb then
    raise exception 'FEHLER: Abbruch: E bekommt etwas zurueck';
  end if;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}', true);
do $$
begin
  if public.online_suche_ende(false) <> '{}'::jsonb then
    raise exception 'FEHLER: Abbruch: D bekommt etwas zurueck';
  end if;
end;
$$;
reset role;
do $$
begin
  if exists (select 1 from public.suche_warteschlange) or exists (select 1 from public.suche_ki_belege) then
    raise exception 'FEHLER: Abbruch: Zeile oder Beleg bleibt';
  end if;
end;
$$;

-- Elo-Fenster: C (1600) und E (1000) suchen 5+0: sofort zu weit (600 > 200); C wartet 9 s -> 650 -> Paarung
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
do $$
begin
  if (public.online_suche_start('5+0')->>'wartet') is distinct from 'true' then
    raise exception 'FEHLER: Elo-Fenster: C wartet nicht';
  end if;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","role":"authenticated"}', true);
do $$
begin
  if (public.online_suche_start('5+0')->>'wartet') is distinct from 'true' then
    raise exception 'FEHLER: Elo-Fenster: 600 Unterschied sofort gepaart';
  end if;
end;
$$;
reset role;
select pg_temp.setze_seit('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 9);
set local role authenticated;
do $$
begin
  if (public.online_suche_stand()->>'partie') is null then
    raise exception 'FEHLER: Elo-Fenster: nach 9 s Wartezeit (Fenster 650) keine Paarung';
  end if;
end;
$$;

-- KI-Beleg: F sucht, nach 10 s ohne Treffer gibt online_suche_ende(true) einen Beleg; nach 3 s keinen
select set_config('request.jwt.claims', '{"sub":"ffffffff-ffff-4fff-8fff-ffffffffffff","role":"authenticated"}', true);
do $$
begin
  perform public.online_suche_start('1+0');
end;
$$;
reset role;
select pg_temp.setze_seit('ffffffff-ffff-4fff-8fff-ffffffffffff', 10);
set local role authenticated;
do $$
declare
  r jsonb := public.online_suche_ende(true);
begin
  if r->>'ki_ref' is null then
    raise exception 'FEHLER: KI-Beleg: nach 10 s kein Beleg (%)', r;
  end if;
  perform public.online_suche_start('1+0');
end;
$$;
reset role;
select pg_temp.setze_seit('ffffffff-ffff-4fff-8fff-ffffffffffff', 3);
set local role authenticated;
do $$
begin
  if public.online_suche_ende(true) ? 'ki_ref' then
    raise exception 'FEHLER: KI-Beleg: nach 3 s schon ein Beleg';
  end if;
  -- F sucht erneut, damit C gleich eine fremde Zeile vor sich hat
  perform public.online_suche_start('1+0');
end;
$$;

-- Fremde Zeile: C sieht weder Zeilen noch Belege von F und kann F nicht aus der Suche nehmen
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
do $$
begin
  begin
    perform 1 from public.suche_ki_belege;
    raise exception 'FEHLER: Nutzer lesen KI-Belege';
  exception when insufficient_privilege then
    null;
  end;
  begin
    delete from public.suche_warteschlange;
    raise exception 'FEHLER: Nutzer loeschen in der Warteschlange';
  exception when insufficient_privilege then
    null;
  end;
  perform public.online_suche_ende(true);
end;
$$;
reset role;
do $$
begin
  if (select count(*) from public.suche_warteschlange where user_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff') <> 1 then
    raise exception 'FEHLER: fremde Zeile: F wurde aus der Suche genommen';
  end if;
  if (select count(*) from public.suche_ki_belege where user_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff') <> 1
     or exists (select 1 from public.suche_ki_belege where user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc') then
    raise exception 'FEHLER: KI-Belege falsch (F genau einer, C keiner)';
  end if;
end;
$$;

-- anon darf nicht suchen
set local role anon;
do $$
begin
  begin
    perform public.online_suche_start('3+2');
    raise exception 'FEHLER: anon darf suchen';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
reset role;

-- ---------- 9. Bot- und KI-Gegner-Ergebnis (Task 5) ----------
-- D: Bot-Leiter (Sieg, doppelt, Grenze 10, Eingabe), danach KI trotz voller Bot-Grenze. E: KI-Niederlage bei 0 Wochen-Kronen,
-- zu frueh, doppelt, fremd, erfunden, verfallen. F: KI-Grenze 20 (eine Buchung von gestern zaehlt nicht), danach Bot.
-- Belege legt der Besitzer mit festen uuids an (00000000-0000-4000-8000-<nr, 12-stellig>), damit die Nutzer-Abschnitte
-- sie ohne Testtabelle nennen koennen; eingeloest wird nur ueber kronen_ki_ergebnis.

create function pg_temp.neuer_beleg(nr integer, uid uuid, alter_s integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r uuid := ('00000000-0000-4000-8000-' || lpad(nr::text, 12, '0'))::uuid;
begin
  insert into public.suche_ki_belege (ref, user_id, erstellt_am) values (r, uid, now() - make_interval(secs => alter_s));
  return r;
end;
$$;
create function pg_temp.beleg_alter(nr integer, alter_s integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.suche_ki_belege set erstellt_am = now() - make_interval(secs => alter_s)
  where ref = ('00000000-0000-4000-8000-' || lpad(beleg_alter.nr::text, 12, '0'))::uuid;
$$;
revoke all on function pg_temp.neuer_beleg(integer, uuid, integer), pg_temp.beleg_alter(integer, integer) from public;

do $$
declare
  d constant uuid := 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  e constant uuid := 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  f constant uuid := 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  i integer;
begin
  perform pg_temp.setze_stand(d, 0, 1000, 30);
  perform pg_temp.setze_stand(e, 305, 1000, 30);
  perform pg_temp.setze_stand(f, 0, 1000, 30);
  perform pg_temp.neuer_beleg(1, d, 61);    -- D: KI trotz voller Bot-Grenze
  perform pg_temp.neuer_beleg(2, e, 61);    -- E: KI-Niederlage, danach doppelt
  perform pg_temp.neuer_beleg(3, e, 30);    -- E: zu frueh
  perform pg_temp.neuer_beleg(4, f, 61);    -- fremd (gehoert F, E versucht es)
  perform pg_temp.neuer_beleg(5, e, 25200); -- E: verfallen (7 Stunden)
  for i in 1..21 loop
    perform pg_temp.neuer_beleg(100 + i, f, 61); -- F: Grenze
  end loop;
  -- F: eine KI-Buchung von gestern zaehlt nicht zur heutigen Grenze
  insert into public.kronen_buchungen (user_id, quelle, ref, delta, woche, am)
  values (f, 'ki', 'gestern-ki-buchung', 0, public.liga_woche_am(now() - interval '30 hours'), now() - interval '30 hours');
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}', true);
do $$
declare
  r jsonb;
  i integer;
begin
  -- Bot-Sieg +15
  r := public.kronen_bot_ergebnis('partie-0001', 'sieg', 1200);
  if (r->>'delta')::int is distinct from 15 or (r->>'kronen')::int is distinct from 15 then
    raise exception 'FEHLER: Bot-Sieg: % (erwartet delta 15, kronen 15)', r;
  end if;
  -- Bot-Doppelt: gleiche ref -> keine zweite Buchung
  r := public.kronen_bot_ergebnis('partie-0001', 'sieg', 1200);
  if (r->>'delta')::int is distinct from 0 or (r->>'kronen')::int is distinct from 15 then
    raise exception 'FEHLER: Bot-Doppelt: % (erwartet delta 0, kronen 15)', r;
  end if;
  -- Bot-Eingabe
  if public.kronen_bot_ergebnis('partie-0002', 'sieg', 9999)->>'fehler' is distinct from 'KRONEN_EINGABE'
     or public.kronen_bot_ergebnis('kurz', 'sieg', 1200)->>'fehler' is distinct from 'KRONEN_EINGABE'
     or public.kronen_bot_ergebnis('partie-0002', 'gewonnen', 1200)->>'fehler' is distinct from 'KRONEN_EINGABE' then
    raise exception 'FEHLER: Bot-Eingabe wird angenommen';
  end if;
  -- Bot-Grenze: 9 weitere gehen (zusammen 10), die 11. Meldung nicht
  for i in 2..10 loop
    r := public.kronen_bot_ergebnis('partie-' || lpad(i::text, 4, '0'), 'sieg', 1200);
    if r ? 'fehler' then
      raise exception 'FEHLER: Bot-Grenze: Meldung % abgelehnt (%)', i, r;
    end if;
  end loop;
  r := public.kronen_bot_ergebnis('partie-0011', 'sieg', 1200);
  if r->>'fehler' is distinct from 'KRONEN_GRENZE' then
    raise exception 'FEHLER: Bot-Grenze: 11. Meldung am Tag nicht abgelehnt (%)', r;
  end if;
  -- KI-Grenze getrennt: 10 Bot-Buchungen sperren den KI-Gegner nicht
  r := public.kronen_ki_ergebnis('00000000-0000-4000-8000-000000000001'::uuid, 'sieg');
  if (r->>'delta')::int is distinct from 20 or (r->>'kronen')::int is distinct from 170 then
    raise exception 'FEHLER: KI-Grenze getrennt: % (erwartet delta 20, kronen 170)', r;
  end if;
  -- kein Recht auf die internen Funktionen
  begin
    perform public.kronen_einfach_buchen('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'bot', 'selbst-gebucht', 'sieg');
    raise exception 'FEHLER: kronen_einfach_buchen ist fuer Nutzer offen';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","role":"authenticated"}', true);
do $$
declare
  r jsonb;
begin
  -- KI-Niederlage -10 bei 0 Wochen-Kronen: bleibt 0 (nie unter 0), Buchung mit 0, E ist trotzdem in einer Gruppe
  r := public.kronen_ki_ergebnis('00000000-0000-4000-8000-000000000002'::uuid, 'niederlage');
  if (r->>'kronen')::int is distinct from 0 or (r->>'delta')::int is distinct from 0 or (r->>'stufe')::int is distinct from 0
     or public.liga_meine_gruppe()->>'gruppe' is null then
    raise exception 'FEHLER: KI-Niederlage: % (erwartet 0 Wochen-Kronen, delta 0, mit Gruppe)', r;
  end if;
  -- doppelt: derselbe Beleg ein zweites Mal
  if public.kronen_ki_ergebnis('00000000-0000-4000-8000-000000000002'::uuid, 'sieg')->>'fehler' is distinct from 'KRONEN_BELEG' then
    raise exception 'FEHLER: KI-Beleg doppelt eingeloest';
  end if;
  -- fremd und erfunden
  if public.kronen_ki_ergebnis('00000000-0000-4000-8000-000000000004'::uuid, 'sieg')->>'fehler' is distinct from 'KRONEN_BELEG'
     or public.kronen_ki_ergebnis(gen_random_uuid(), 'sieg')->>'fehler' is distinct from 'KRONEN_BELEG' then
    raise exception 'FEHLER: fremder oder erfundener KI-Beleg angenommen';
  end if;
  -- verfallen (7 Stunden)
  if public.kronen_ki_ergebnis('00000000-0000-4000-8000-000000000005'::uuid, 'sieg')->>'fehler' is distinct from 'KRONEN_BELEG' then
    raise exception 'FEHLER: verfallener KI-Beleg angenommen';
  end if;
  -- Eingabe
  if public.kronen_ki_ergebnis('00000000-0000-4000-8000-000000000003'::uuid, 'gewonnen')->>'fehler' is distinct from 'KRONEN_EINGABE'
     or public.kronen_ki_ergebnis(null, 'sieg')->>'fehler' is distinct from 'KRONEN_EINGABE' then
    raise exception 'FEHLER: KI-Eingabe wird angenommen';
  end if;
  -- zu frueh (30 s): keine Buchung, Beleg bleibt
  if public.kronen_ki_ergebnis('00000000-0000-4000-8000-000000000003'::uuid, 'sieg')->>'fehler' is distinct from 'KRONEN_ZU_FRUEH' then
    raise exception 'FEHLER: KI-Beleg nach 30 s nicht als zu frueh abgelehnt';
  end if;
end;
$$;
reset role;
do $$
begin
  if (select eingeloest from public.suche_ki_belege where ref = '00000000-0000-4000-8000-000000000003'::uuid)
     or exists (select 1 from public.kronen_buchungen where ref = '00000000-0000-4000-8000-000000000003') then
    raise exception 'FEHLER: zu frueh: Beleg eingeloest oder gebucht';
  end if;
  if (select eingeloest from public.suche_ki_belege where ref = '00000000-0000-4000-8000-000000000004'::uuid) then
    raise exception 'FEHLER: fremder Versuch hat den Beleg von F eingeloest';
  end if;
  perform pg_temp.beleg_alter(3, 61);
end;
$$;
set local role authenticated;
do $$
declare
  r jsonb := public.kronen_ki_ergebnis('00000000-0000-4000-8000-000000000003'::uuid, 'sieg');
begin
  if (r->>'delta')::int is distinct from 20 then
    raise exception 'FEHLER: zu frueher Beleg nach 61 s nicht gebucht (%)', r;
  end if;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"ffffffff-ffff-4fff-8fff-ffffffffffff","role":"authenticated"}', true);
do $$
declare
  r jsonb;
  i integer;
begin
  -- KI-Grenze: 20 Belege an einem Tag werden gebucht, der 21. nicht (die Buchung von gestern zaehlt nicht)
  for i in 1..20 loop
    r := public.kronen_ki_ergebnis(('00000000-0000-4000-8000-' || lpad((100 + i)::text, 12, '0'))::uuid, 'sieg');
    if r ? 'fehler' then
      raise exception 'FEHLER: KI-Grenze: Beleg % abgelehnt (%)', i, r;
    end if;
  end loop;
  -- 20 x 20 waeren 400, der Schummel-Schutz deckelt Bot- und KI-Gewinne bei 300 je Woche
  if (r->>'kronen')::int is distinct from 300 or not (r->>'bot_ki_voll')::boolean then
    raise exception 'FEHLER: KI-Grenze: nach 20 Siegen % statt 300 Kronen (gedeckelt)', r->>'kronen';
  end if;
  r := public.kronen_ki_ergebnis('00000000-0000-4000-8000-000000000121'::uuid, 'sieg');
  if r->>'fehler' is distinct from 'KRONEN_GRENZE' then
    raise exception 'FEHLER: KI-Grenze: 21. Beleg nicht abgelehnt (%)', r;
  end if;
  -- und umgekehrt: 20 KI-Buchungen sperren den Bot-Leiter nicht (keine Tagesgrenze), aber der Wochen-Deckel von 300
  -- fuer Bot und KI zusammen ist voll: angenommen mit delta 0
  r := public.kronen_bot_ergebnis('f-partie-0001', 'remis', 800);
  if r ? 'fehler' or (r->>'delta')::int is distinct from 0 or (r->>'kronen')::int is distinct from 300 then
    raise exception 'FEHLER: Bot nach voller KI-Grenze: % (erwartet delta 0, kronen 300)', r;
  end if;
end;
$$;
reset role;
do $$
begin
  if not (select eingeloest from public.suche_ki_belege where ref = '00000000-0000-4000-8000-000000000121'::uuid)
     or exists (select 1 from public.kronen_buchungen where ref = '00000000-0000-4000-8000-000000000121') then
    raise exception 'FEHLER: KI-Grenze: 21. Beleg nicht eingeloest oder doch gebucht';
  end if;
  if (select kronen from public.kronen_stand where user_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff') <> 300 then
    raise exception 'FEHLER: KI-Grenze: Stand von F veraendert';
  end if;
end;
$$;

-- anon darf keine Ergebnisse melden
set local role anon;
do $$
begin
  begin
    perform public.kronen_bot_ergebnis('partie-anon', 'sieg', 1200);
    raise exception 'FEHLER: anon darf ein Bot-Ergebnis melden';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.kronen_ki_ergebnis(gen_random_uuid(), 'sieg');
    raise exception 'FEHLER: anon darf ein KI-Ergebnis melden';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
reset role;

-- ---------- 10. Start-Liga (Task 6) ----------
-- Vier neue Nutzer: G startet mit Elo 1450, H hat schon eine Bot-Partie, I schickt Unsinn und dann 99999, J 300.
insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'kronen-g@example.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'kronen-h@example.invalid'),
  ('33333333-3333-4333-8333-333333333333', 'kronen-i@example.invalid'),
  ('44444444-4444-4444-8444-444444444444', 'kronen-j@example.invalid');

-- Start einmal: 1450 ist Klasse Gold (ab 1400), gedeckelt auf Laeufer III (Stufe 6), ohne Kronen; der zweite Aufruf aendert nichts
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
do $$
declare
  r jsonb;
begin
  r := public.kronen_start(1450);
  if r is distinct from '{"delta": 0, "kronen": 0, "stufe": 6}'::jsonb then
    raise exception 'FEHLER: Start einmal: % statt Stufe 6', r;
  end if;
  r := public.kronen_start(1900);
  if r->>'fehler' is distinct from 'KRONEN_START_VORBEI' then
    raise exception 'FEHLER: Start einmal: zweiter Aufruf %', r;
  end if;
  if (public.kronen_mein_stand()->>'stufe')::int is distinct from 6 then
    raise exception 'FEHLER: Start einmal: Stand nach dem zweiten Aufruf veraendert';
  end if;
end;
$$;
reset role;
do $$
begin
  if not exists (select 1 from public.kronen_stand where user_id = '11111111-1111-4111-8111-111111111111'
                 and stufe = 6 and kronen = 0 and elo = 1450 and start_gesetzt) then
    raise exception 'FEHLER: Start einmal: Stand von G (Stufe, Elo, start_gesetzt) falsch';
  end if;
  if (select count(*) from public.kronen_buchungen where user_id = '11111111-1111-4111-8111-111111111111'
      and quelle = 'start' and ref = 'start' and delta = 0) is distinct from 1::bigint then
    raise exception 'FEHLER: Start einmal: Buchung start/start fehlt oder doppelt';
  end if;
end;
$$;

-- Start nach Partie: nach einer Bot-Buchung ist der Start vorbei
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
do $$
declare
  r jsonb;
begin
  r := public.kronen_bot_ergebnis('partie-start-h', 'sieg', 1200);
  if (r->>'kronen')::int is distinct from 15 then
    raise exception 'FEHLER: Start nach Partie: Bot-Sieg %', r;
  end if;
  r := public.kronen_start(1900);
  if r->>'fehler' is distinct from 'KRONEN_START_VORBEI' then
    raise exception 'FEHLER: Start nach Partie: %', r;
  end if;
end;
$$;
reset role;
do $$
begin
  if not exists (select 1 from public.kronen_stand where user_id = '22222222-2222-4222-8222-222222222222'
                 and kronen = 15 and not start_gesetzt) then
    raise exception 'FEHLER: Start nach Partie: Stand von H veraendert';
  end if;
end;
$$;

-- Start-Grenze: ohne Elo keine Aenderung; 99999 zaehlt wie 2800 und startet trotzdem nur in Laeufer III (Stufe 6); 300 wie 400
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
do $$
declare
  r jsonb;
begin
  r := public.kronen_start(null);
  if r->>'fehler' is distinct from 'KRONEN_EINGABE' then
    raise exception 'FEHLER: Start-Grenze: ohne Elo %', r;
  end if;
  r := public.kronen_start(99999);
  if r is distinct from '{"delta": 0, "kronen": 0, "stufe": 6}'::jsonb then
    raise exception 'FEHLER: Start-Grenze: 99999 ergibt %', r;
  end if;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}', true);
do $$
declare
  r jsonb;
begin
  r := public.kronen_start(300);
  if r is distinct from '{"delta": 0, "kronen": 0, "stufe": 0}'::jsonb then
    raise exception 'FEHLER: Start-Grenze: 300 ergibt %', r;
  end if;
end;
$$;
reset role;
do $$
begin
  if not exists (select 1 from public.kronen_stand where user_id = '33333333-3333-4333-8333-333333333333'
                 and stufe = 6 and kronen = 0 and elo = 2800 and start_gesetzt) then
    raise exception 'FEHLER: Start-Grenze: Stand von I (Elo auf 2800 begrenzt) falsch';
  end if;
  if not exists (select 1 from public.kronen_stand where user_id = '44444444-4444-4444-8444-444444444444'
                 and stufe = 0 and kronen = 0 and elo = 400 and start_gesetzt) then
    raise exception 'FEHLER: Start-Grenze: Stand von J (Elo auf 400 begrenzt) falsch';
  end if;
end;
$$;

-- anon darf keinen Start setzen
set local role anon;
do $$
begin
  begin
    perform public.kronen_start(1450);
    raise exception 'FEHLER: anon darf kronen_start aufrufen';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
reset role;

-- ---------- 11. Wochen-Gruppen ----------
-- 31 Nutzer in Springer III (Stufe 3) buchen nacheinander: die ersten 30 kommen in eine Gruppe, der 31. in eine neue.
insert into auth.users (id, email)
select gen_random_uuid(), 'liga-' || lpad(i::text, 2, '0') || '@example.invalid' from generate_series(1, 31) as i;

create function pg_temp.liga_nutzer(i integer)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from auth.users u where u.email = 'liga-' || lpad(i::text, 2, '0') || '@example.invalid';
$$;
revoke all on function pg_temp.liga_nutzer(integer) from public;

do $$
declare
  i integer;
  g1 bigint;
  g2 bigint;
begin
  for i in 1..31 loop
    perform public.kronen_stand_sichern(pg_temp.liga_nutzer(i));
    update public.kronen_stand set stufe = 3 where user_id = pg_temp.liga_nutzer(i);
    perform public.liga_buchen(pg_temp.liga_nutzer(i), i * 10);
  end loop;
  select gruppe into g1 from public.liga_mitglieder where user_id = pg_temp.liga_nutzer(1);
  select gruppe into g2 from public.liga_mitglieder where user_id = pg_temp.liga_nutzer(31);
  if (select count(*) from public.liga_mitglieder where gruppe = g1) <> 30 or g2 = g1
     or (select count(*) from public.liga_gruppen where woche = public.liga_woche_heute() and stufe = 3) <> 2 then
    raise exception 'FEHLER: 30 je Gruppe: die 31. Person ist nicht in einer neuen Gruppe';
  end if;
  -- volle Gruppe ohne Bots; eine Person allein bekommt 29 Bots mit verschiedenen Namen, ihre Kronen bleiben im Rahmen
  -- (Springer: Wochenziel 0 bis 250) und liegen nie ueber dem vollen Wochenziel
  if (select count(*) from public.liga_bots(g1, false)) <> 0 or (select count(*) from public.liga_rangliste(g1, false)) <> 30 then
    raise exception 'FEHLER: volle Gruppe hat Bots';
  end if;
  if (select count(*) from public.liga_bots(g2, false)) <> 29 or (select count(distinct name) from public.liga_bots(g2, false)) <> 29
     or (select count(*) from public.liga_rangliste(g2, false)) <> 30
     or exists (select 1 from public.liga_bots(g2, false) j join public.liga_bots(g2, true) v on v.nr = j.nr
                where j.kronen > v.kronen or v.kronen < 0 or v.kronen > 250) then
    raise exception 'FEHLER: Bots fuellen die Gruppe nicht richtig auf';
  end if;
  -- zweite Buchung derselben Woche: gleiche Gruppe, Kronen zusammengezaehlt
  perform public.liga_buchen(pg_temp.liga_nutzer(31), 5);
  if (select kronen from public.liga_mitglieder where user_id = pg_temp.liga_nutzer(31)) <> 315
     or (select count(*) from public.liga_mitglieder where user_id = pg_temp.liga_nutzer(31)) <> 1 then
    raise exception 'FEHLER: zweite Buchung derselben Woche falsch';
  end if;
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', pg_temp.liga_nutzer(31), 'role', 'authenticated')::text, true);
end;
$$;

-- Anzeige fuer Nutzer 31: 30 Zeilen, eigene Zeile, Bots mit Namen und KI-Kennzeichen, keine Kennungen anderer
set local role authenticated;
do $$
declare
  g jsonb;
  s jsonb;
  ich jsonb;
begin
  g := public.liga_meine_gruppe();
  s := public.kronen_mein_stand();
  select e into ich from jsonb_array_elements(g->'mitglieder') e where (e->>'ich')::boolean;
  if jsonb_array_length(g->'mitglieder') <> 30 or (g->>'platz')::int is distinct from 1 or ich is null
     or (ich->>'kronen')::int <> 315 or (ich->>'ki')::boolean or (ich->>'platz')::int <> 1 then
    raise exception 'FEHLER: eigene Gruppe falsch (%)', g;
  end if;
  if (select count(*) from jsonb_array_elements(g->'mitglieder') e where (e->>'ki')::boolean and e->>'name' is not null) <> 29 then
    raise exception 'FEHLER: Bots ohne Namen oder ohne KI-Kennzeichen';
  end if;
  if g::text ~ '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-' then
    raise exception 'FEHLER: liga_meine_gruppe gibt Nutzerkennungen heraus';
  end if;
  if (s->>'platz')::int is distinct from 1 or (s->>'kronen')::int is distinct from 315 or (s->>'stufe')::int is distinct from 3 then
    raise exception 'FEHLER: kronen_mein_stand passt nicht zur Gruppe (%)', s;
  end if;
  -- ziel = Kronen auf Platz 5 der eigenen Gruppe (fuer den Ring)
  if (s->>'ziel')::int is distinct from (select (e->>'kronen')::int from jsonb_array_elements(g->'mitglieder') e
                                          where (e->>'platz')::int = 5) then
    raise exception 'FEHLER: ziel ist nicht der Kronen-Stand auf Platz 5 (%)', s;
  end if;
end;
$$;
reset role;

-- ---------- 12. Wochen-Abrechnung ----------
-- Vergangene Wochen mit den Nutzern 1 bis 30 (Kronen i * 10, also Nutzer 30 auf Platz 1, Nutzer 1 auf Platz 30) und
-- ohne Bots. Jede Runde: Gruppe anlegen, abrechnen, pruefen.
create function pg_temp.alte_gruppe(wochen integer, st integer)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid bigint;
  w date := public.liga_woche_heute() - 7 * wochen;
begin
  insert into public.liga_gruppen (woche, stufe, saat) values (w, st, 4242) returning id into gid;
  insert into public.liga_mitglieder (gruppe, user_id, woche, kronen)
  select gid, pg_temp.liga_nutzer(i), w, i * 10 from generate_series(1, 30) as i;
  return gid;
end;
$$;
create function pg_temp.stufe_von(i integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select s.stufe from public.kronen_stand s where s.user_id = pg_temp.liga_nutzer(i);
$$;
revoke all on function pg_temp.alte_gruppe(integer, integer), pg_temp.stufe_von(integer) from public;

do $$
declare
  w7 date := public.liga_woche_heute() - 7;
  zahl integer;
begin
  -- Koenig I (17): oben bleibt 17, unten 16
  perform pg_temp.alte_gruppe(3, 17);
  perform public.liga_abrechnen();
  if pg_temp.stufe_von(30) <> 17 or pg_temp.stufe_von(26) <> 17 or pg_temp.stufe_von(25) <> 17 or pg_temp.stufe_von(6) <> 17
     or pg_temp.stufe_von(5) <> 16 or pg_temp.stufe_von(1) <> 16 then
    raise exception 'FEHLER: Abrechnung Koenig I falsch';
  end if;
  -- Bauer III (0): oben 1, unten bleibt 0
  perform pg_temp.alte_gruppe(2, 0);
  perform public.liga_abrechnen();
  if pg_temp.stufe_von(30) <> 1 or pg_temp.stufe_von(26) <> 1 or pg_temp.stufe_von(25) <> 0 or pg_temp.stufe_von(5) <> 0
     or pg_temp.stufe_von(1) <> 0 then
    raise exception 'FEHLER: Abrechnung Bauer III falsch';
  end if;
  -- Springer I (5): Platz 1 bis 5 nach Laeufer III (6, neue Liga: Aufstiegs-Banner), letzte 5 nach Springer II (4)
  perform pg_temp.alte_gruppe(1, 5);
  perform public.liga_abrechnen();
  if pg_temp.stufe_von(30) <> 6 or pg_temp.stufe_von(26) <> 6 or pg_temp.stufe_von(25) <> 5 or pg_temp.stufe_von(6) <> 5
     or pg_temp.stufe_von(5) <> 4 or pg_temp.stufe_von(1) <> 4 then
    raise exception 'FEHLER: Abrechnung Springer I falsch';
  end if;
  -- Belohnungen der letzten Woche: Platz 1 Banner, 2 = 120, 3 = 100, 4 und 5 = 80, 6 bis 10 = 40, 11 bis 20 = 20, danach nichts
  if (select art || menge from public.liga_belohnungen where user_id = pg_temp.liga_nutzer(30) and woche = w7 and art <> 'aufstieg-banner') <> 'banner1'
     or (select menge from public.liga_belohnungen where user_id = pg_temp.liga_nutzer(29) and woche = w7 and art = 'taler') <> 120
     or (select menge from public.liga_belohnungen where user_id = pg_temp.liga_nutzer(28) and woche = w7 and art = 'taler') <> 100
     or (select menge from public.liga_belohnungen where user_id = pg_temp.liga_nutzer(26) and woche = w7 and art = 'taler') <> 80
     or (select menge from public.liga_belohnungen where user_id = pg_temp.liga_nutzer(25) and woche = w7) <> 40
     or (select menge from public.liga_belohnungen where user_id = pg_temp.liga_nutzer(11) and woche = w7) <> 20
     or exists (select 1 from public.liga_belohnungen where user_id = pg_temp.liga_nutzer(10) and woche = w7)
     or (select count(*) from public.liga_belohnungen where woche = w7 and art <> 'aufstieg-banner') <> 20
     or (select count(*) from public.liga_belohnungen where woche = w7 and art = 'aufstieg-banner' and stufe = 6) <> 5
     or exists (select 1 from public.liga_belohnungen where ausgezahlt) then
    raise exception 'FEHLER: Belohnungen der Woche falsch';
  end if;
  -- Aufstiegs-Banner je Liga nur einmal: noch einmal Springer I -> Laeufer III bringt keinen zweiten
  perform pg_temp.alte_gruppe(4, 5);
  perform public.liga_abrechnen();
  if (select count(*) from public.liga_belohnungen where art = 'aufstieg-banner') <> 5 then
    raise exception 'FEHLER: Aufstiegs-Banner doppelt vergeben';
  end if;
  -- zweiter Aufruf aendert nichts, die Gruppen dieser Woche bleiben offen
  select count(*) into zahl from public.liga_belohnungen;
  update public.kronen_stand set stufe = 2 where user_id = pg_temp.liga_nutzer(30);
  perform public.liga_abrechnen();
  if (select count(*) from public.liga_belohnungen) <> zahl or pg_temp.stufe_von(30) <> 2
     or exists (select 1 from public.liga_gruppen where woche < public.liga_woche_heute() and not abgerechnet)
     or exists (select 1 from public.liga_gruppen where woche = public.liga_woche_heute() and abgerechnet) then
    raise exception 'FEHLER: Abrechnung laeuft zweimal oder rechnet die laufende Woche ab';
  end if;
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', pg_temp.liga_nutzer(30), 'role', 'authenticated')::text, true);
end;
$$;

-- Nutzer 30 sieht seine gemerkten Belohnungen (4 Platz-1-Banner, 1 Aufstiegs-Banner), noch nicht ausgezahlt
set local role authenticated;
do $$
declare
  g jsonb := public.liga_meine_gruppe();
begin
  if jsonb_array_length(g->'offen') <> 5
     or (select count(*) from jsonb_array_elements(g->'offen') e where e->>'art' = 'banner') <> 4 then
    raise exception 'FEHLER: offene Belohnungen falsch (%)', g->'offen';
  end if;
end;
$$;
reset role;

-- Groesste saat: die Bot-Namen rechnen ohne Ueberlauf (sonst stuende jede Kronen-Funktion still)
do $$
declare
  gid bigint;
begin
  insert into public.liga_gruppen (woche, stufe, saat) values (public.liga_woche_heute() + 7, 5, 2147483646)
  returning id into gid;
  if (select count(*) from public.liga_bots(gid, true) b where b.name is not null) <> 30 then
    raise exception 'FEHLER: Bots bei groesster saat falsch';
  end if;
end;
$$;

-- ---------- 13. Schummel-Schutz ----------
-- Bot- und KI-Gewinne bringen zusammen hoechstens 300 Kronen je Woche. Gegenprobe Wochengrenze: 300 aus der Vorwoche
-- sperren nichts (am Montag wieder frei). Online-Kronen zaehlen nicht gegen den Deckel.
insert into auth.users (id, email) values ('55555555-5555-4555-8555-555555555555', 'kronen-deckel@example.invalid');
do $$
declare
  uid uuid := '55555555-5555-4555-8555-555555555555';
  wo date := public.liga_woche_heute();
  r jsonb;
begin
  perform public.kronen_stand_sichern(uid);
  insert into public.kronen_buchungen (user_id, quelle, ref, delta, woche) values
    (uid, 'bot', 'vorwoche-1', 300, wo - 7),
    (uid, 'online', '00000000-0000-4000-8000-000000000001', 500, wo);
  r := public.kronen_einfach_buchen(uid, 'bot', 'deckel-0', 'sieg');
  if (r->>'delta')::int is distinct from 15 or (r->>'bot_ki_voll')::boolean then
    raise exception 'FEHLER: Deckel: Vorwoche oder Online-Kronen sperren die neue Woche (%)', r;
  end if;
  insert into public.kronen_buchungen (user_id, quelle, ref, delta, woche) values (uid, 'ki', 'deckel-alt', 275, wo);
  r := public.kronen_einfach_buchen(uid, 'bot', 'deckel-1', 'sieg');
  if (r->>'delta')::int is distinct from 10 or not (r->>'bot_ki_voll')::boolean then
    raise exception 'FEHLER: Deckel: der Rest bis 300 ist falsch (%)', r;
  end if;
  r := public.kronen_einfach_buchen(uid, 'bot', 'deckel-2', 'sieg');
  if (r->>'delta')::int is distinct from 0 then
    raise exception 'FEHLER: Deckel: Bot-Sieg ueber 300 gebucht (%)', r;
  end if;
  r := public.kronen_einfach_buchen(uid, 'ki', 'deckel-3', 'sieg');
  if (r->>'delta')::int is distinct from 0 then
    raise exception 'FEHLER: Deckel: KI-Sieg ueber 300 gebucht (%)', r;
  end if;
  -- Raetsel-Duell: gegen den KI-Gegner zaehlt es zum Deckel, gegen einen Menschen nicht
  r := public.kronen_einfach_buchen(uid, 'duell_ki', 'deckel-4', 'sieg');
  if (r->>'delta')::int is distinct from 0 then
    raise exception 'FEHLER: Deckel: KI-Duell-Sieg ueber 300 gebucht (%)', r;
  end if;
  r := public.kronen_einfach_buchen(uid, 'duell', 'deckel-5', 'sieg');
  if (r->>'delta')::int is distinct from 30 then
    raise exception 'FEHLER: Deckel: Menschen-Duell gedeckelt (%)', r;
  end if;
  if public.liga_bot_ki_genutzt(uid, wo) <> 300 or public.liga_bot_ki_genutzt(uid, wo + 7) <> 0 then
    raise exception 'FEHLER: Deckel: Zaehlung je Woche falsch';
  end if;
  if (select kronen from public.liga_mitglieder where user_id = uid and woche = wo) <> 55 then
    raise exception 'FEHLER: Deckel: Wochen-Kronen der Gruppe falsch';
  end if;
end;
$$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}', true);
do $$
declare
  g jsonb := public.liga_meine_gruppe();
begin
  if g->'bot_ki' is distinct from '{"genutzt": 300, "max": 300}'::jsonb then
    raise exception 'FEHLER: Deckel: liga_meine_gruppe zeigt %', g->'bot_ki';
  end if;
end;
$$;
reset role;

rollback;

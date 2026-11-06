-- Prueft supabase/kronen-schema.sql im Supabase SQL Editor (als Besitzer, wie dort ueblich). Alles wird am Ende
-- zurueckgerollt, auch der Saisonstart in kronen_schalter.
-- Drei kurzlebige Nutzer: A, B und C. Jeder Fehler bricht mit "FEHLER: ..." ab; ohne Fehler endet der Lauf mit ROLLBACK.
-- Abschnitte: 1 Stand ohne Saisonstart, Start in der Zukunft und Start dieser Woche; 1b Saisonstart nur montags;
-- 2 keine Tabellenrechte fuer Nutzer; 3 anon darf nichts; 4 Saisongrenze (Archiv, Rueckstufung, nur einmal, mehrere
-- verpasste Saisons); 5 reine Rechenfunktionen und Konstanten; 6 Online-Wertung (Sieg, nur einmal, Liga-Boden,
-- abgebrochen, ungewertet, Remis, Buchung fuer Nutzer gesperrt).
-- Spaetere Tasks des Plans (Gegnersuche, Bot- und KI-Ergebnis, Start-Liga, Zaehler) haengen hier eigene Abschnitte an.
begin;

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'kronen-a@example.invalid'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'kronen-b@example.invalid'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'kronen-c@example.invalid');

-- Testhilfen (nur in dieser Sitzung, verschwinden mit dem rollback). Sie laufen als Besitzer (security definer),
-- weil angemeldete Nutzer weder kronen_schalter noch kronen_stand aendern duerfen.
create function pg_temp.setze_start(d date)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.kronen_schalter set saison_start = d where id;
$$;

create function pg_temp.setze_saison(uid uuid, nr integer, k integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.kronen_stand
  set saison = nr, kronen = k, boden = public.kronen_liga_boden(k)
  where user_id = uid;
$$;

-- Montag dieser Woche in Europe/Berlin (als Besitzer: kronen_heute ist fuer Nutzer gesperrt)
create function pg_temp.montag()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select public.kronen_heute() - (extract(isodow from public.kronen_heute())::integer - 1);
$$;

revoke all on function pg_temp.setze_start(date), pg_temp.setze_saison(uuid, integer, integer), pg_temp.montag() from public;

-- Ausgangslage: kein Saisonstart (wie direkt nach dem Einspielen)
select pg_temp.setze_start(null);

-- ---------- 1. Stand ohne Saisonstart, Start in der Zukunft, Start dieser Woche ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);

do $$
declare
  s jsonb;
begin
  s := public.kronen_mein_stand();
  if (s->>'saison')::int is distinct from 0 or (s->>'kronen')::int is distinct from 0 or (s->>'stufe')::int is distinct from 0 or (s->>'boden')::int is distinct from 0
     or (s->>'naechste')::int is distinct from 100 then
    raise exception 'FEHLER: neuer Stand ohne Saisonstart falsch (%)', s;
  end if;
end;
$$;

-- als Besitzer (Saisonstart und kronen_saison_heute sind fuer Nutzer gesperrt)
reset role;
do $$
begin
  -- Start naechste Woche: weiter Saison 0
  perform pg_temp.setze_start(pg_temp.montag() + 7);
  if public.kronen_saison_heute() <> 0 then
    raise exception 'FEHLER: Saisonstart in der Zukunft ergibt nicht Saison 0';
  end if;
  -- Start diese Woche: Saison 1
  perform pg_temp.setze_start(pg_temp.montag());
  if public.kronen_saison_heute() <> 1 then
    raise exception 'FEHLER: Saisonstart diese Woche ergibt nicht Saison 1 (%)', public.kronen_saison_heute();
  end if;
  -- Saisonzahl an festen Tagen relativ zum Start
  if public.kronen_saison_am(pg_temp.montag() - 1) <> 0 or public.kronen_saison_am(pg_temp.montag() + 27) <> 1
     or public.kronen_saison_am(pg_temp.montag() + 28) <> 2 then
    raise exception 'FEHLER: kronen_saison_am rechnet die Saisongrenze falsch';
  end if;
  perform pg_temp.setze_saison('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 0, 900);
end;
$$;

-- der Wechsel von 0 auf 1 stuft nicht zurueck und archiviert nichts
set local role authenticated;
do $$
declare
  s jsonb;
begin
  s := public.kronen_mein_stand();
  if (s->>'saison')::int is distinct from 1 or (s->>'kronen')::int is distinct from 900 or (s->>'boden')::int is distinct from 900 then
    raise exception 'FEHLER: Wechsel von Saison 0 auf 1 hat den Stand veraendert (%)', s;
  end if;
end;
$$;

-- ---------- 1b. Saisonstart nur montags ----------
reset role;
do $$
begin
  begin
    perform pg_temp.setze_start(pg_temp.montag() + 1);
    raise exception 'FEHLER: Saisonstart an einem Dienstag angenommen';
  exception
    when check_violation then null;
  end;
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
    update public.kronen_stand set kronen = 1700 where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    raise exception 'FEHLER: A konnte den eigenen Stand direkt aendern';
  exception
    when insufficient_privilege then null;
  end;
  begin
    insert into public.kronen_buchungen (user_id, quelle, ref, delta, saison)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'online', 'erfunden-0001', 30, 1);
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
    perform 1 from public.kronen_archiv;
    raise exception 'FEHLER: A konnte kronen_archiv lesen';
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
end;
$$;

-- ---------- 4. Saisongrenze ----------
-- Start vor 28 Tagen: heute ist Saison 2. A stand in Saison 1 bei 1750 (Krone I).
reset role;
select pg_temp.setze_start(pg_temp.montag() - 28);
select pg_temp.setze_saison('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1, 1750);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  s jsonb;
begin
  s := public.kronen_mein_stand();
  if (s->>'saison')::int is distinct from 2 or (s->>'kronen')::int is distinct from 1400 or (s->>'boden')::int is distinct from 1200
     or (s->>'stufe')::int is distinct from 14 or (s->>'naechste')::int is distinct from 1500 then
    raise exception 'FEHLER: Saisonwechsel 1750 ergibt nicht 1400 / Boden 1200 / Stufe 14 (%)', s;
  end if;
  -- zweiter Aufruf: nichts mehr
  s := public.kronen_mein_stand();
  if (s->>'kronen')::int is distinct from 1400 then
    raise exception 'FEHLER: zweiter Aufruf hat erneut zurueckgestuft (%)', s;
  end if;
end;
$$;

reset role;
do $$
begin
  if not exists (select 1 from public.kronen_archiv
                 where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and saison = 1 and kronen = 1750 and stufe = 17) then
    raise exception 'FEHLER: Archivzeile fuer Saison 1 fehlt oder ist falsch';
  end if;
  if (select count(*) from public.kronen_buchungen
      where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and quelle = 'saison') <> 1
     or (select delta from public.kronen_buchungen
         where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and quelle = 'saison') <> -350 then
    raise exception 'FEHLER: Saison-Buchung nicht genau einmal mit -350';
  end if;
end;
$$;

-- B hat zwei Saisons verpasst: Saison 1 bei 1750, heute Saison 3 -> 1750 -> 1400 -> 1100, nur Saison 1 im Archiv
select pg_temp.setze_start(pg_temp.montag() - 56);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select public.kronen_mein_stand();
reset role;
select pg_temp.setze_saison('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 1, 1750);
set local role authenticated;
do $$
declare
  s jsonb;
begin
  s := public.kronen_mein_stand();
  if (s->>'saison')::int is distinct from 3 or (s->>'kronen')::int is distinct from 1100 or (s->>'boden')::int is distinct from 900 then
    raise exception 'FEHLER: zwei verpasste Saisons ergeben nicht 1100 / Boden 900 (%)', s;
  end if;
end;
$$;
reset role;
do $$
begin
  if (select count(*) from public.kronen_archiv where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') <> 1
     or (select count(*) from public.kronen_buchungen
         where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and quelle = 'saison') <> 2 then
    raise exception 'FEHLER: verpasste Saisons: Archiv oder Buchungen falsch';
  end if;
end;
$$;

-- ---------- 5. Reine Rechenfunktionen und Konstanten ----------
do $$
declare
  k jsonb := public.kronen_konstanten();
begin
  if public.kronen_stufe(0) <> 0 or public.kronen_stufe(99) <> 0 or public.kronen_stufe(100) <> 1
     or public.kronen_stufe(1700) <> 17 or public.kronen_stufe(99999) <> 17 or public.kronen_stufe(-5) <> 0
     or public.kronen_stufe(null) <> 0 then
    raise exception 'FEHLER: kronen_stufe rechnet falsch';
  end if;
  if public.kronen_liga_boden(299) <> 0 or public.kronen_liga_boden(310) <> 300 or public.kronen_liga_boden(1550) <> 1500
     or public.kronen_liga_boden(1750) <> 1500 then
    raise exception 'FEHLER: kronen_liga_boden rechnet falsch';
  end if;
  if public.kronen_rueckstufen(1750) <> 1400 or public.kronen_rueckstufen(250) <> 0 or public.kronen_rueckstufen(0) <> 0 then
    raise exception 'FEHLER: kronen_rueckstufen rechnet falsch';
  end if;
  if (k->>'stufe_kronen')::int is distinct from 100 or (k#>>'{kronen,ki,sieg}')::int is distinct from 20 or (k#>>'{kronen,online,niederlage}')::int is distinct from -15
     or (k#>>'{kronen,bot,niederlage}')::int is distinct from 0 or (k->>'bot_tagesgrenze')::int is distinct from 10 or (k->>'ki_tagesgrenze')::int is distinct from 20
     or (k->>'ki_mindestdauer_s')::int is distinct from 60 or (k->>'online_mindest_halbzuege')::int is distinct from 4
     or (k->>'paar_tagesgrenze')::int is distinct from 3 or (k->>'saison_tage')::int is distinct from 28 or (k->>'rueckstufung_stufen')::int is distinct from 3 then
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
  set saison = public.kronen_saison_heute(), kronen = k, boden = public.kronen_liga_boden(k), elo = e, elo_n = n
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

  -- Liga-Boden: B steht bei 310 (Bronze III, Boden 300) und verliert als Weiss
  perform pg_temp.setze_stand(b, 310, 1000, 20);
  p := pg_temp.neue_partie(b, a, true);
  perform pg_temp.beende(p, '0-1', 'aufgabe');
  if (select kronen from public.kronen_stand where user_id = b) <> 300 then
    raise exception 'FEHLER: Liga-Boden: B faellt unter 300';
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
-- D: Bot-Leiter (Sieg, doppelt, Grenze 10, Eingabe), danach KI trotz voller Bot-Grenze. E: KI-Niederlage mit Liga-Boden,
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
  insert into public.kronen_buchungen (user_id, quelle, ref, delta, saison, am)
  values (f, 'ki', 'gestern-ki-buchung', 0, 0, now() - interval '30 hours');
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
  -- KI-Niederlage -10, Liga-Boden 300 gilt
  r := public.kronen_ki_ergebnis('00000000-0000-4000-8000-000000000002'::uuid, 'niederlage');
  if (r->>'kronen')::int is distinct from 300 or (r->>'delta')::int is distinct from -5 then
    raise exception 'FEHLER: KI-Niederlage: % (erwartet 305 -> 300 durch den Liga-Boden)', r;
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
  if (r->>'kronen')::int is distinct from 400 then
    raise exception 'FEHLER: KI-Grenze: nach 20 Siegen % statt 400 Kronen', r->>'kronen';
  end if;
  r := public.kronen_ki_ergebnis('00000000-0000-4000-8000-000000000121'::uuid, 'sieg');
  if r->>'fehler' is distinct from 'KRONEN_GRENZE' then
    raise exception 'FEHLER: KI-Grenze: 21. Beleg nicht abgelehnt (%)', r;
  end if;
  -- und umgekehrt: 20 KI-Buchungen sperren den Bot-Leiter nicht
  r := public.kronen_bot_ergebnis('f-partie-0001', 'remis', 800);
  if (r->>'delta')::int is distinct from 5 or (r->>'kronen')::int is distinct from 405 then
    raise exception 'FEHLER: Bot nach voller KI-Grenze: % (erwartet delta 5, kronen 405)', r;
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
  if (select kronen from public.kronen_stand where user_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff') <> 405 then
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

rollback;

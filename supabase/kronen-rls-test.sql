-- Prueft supabase/kronen-schema.sql im Supabase SQL Editor (als Besitzer, wie dort ueblich). Alles wird am Ende
-- zurueckgerollt, auch der Saisonstart in kronen_schalter.
-- Drei kurzlebige Nutzer: A, B und C. Jeder Fehler bricht mit "FEHLER: ..." ab; ohne Fehler endet der Lauf mit ROLLBACK.
-- Abschnitte: 1 Stand ohne Saisonstart, Start in der Zukunft und Start dieser Woche; 1b Saisonstart nur montags;
-- 2 keine Tabellenrechte fuer Nutzer; 3 anon darf nichts; 4 Saisongrenze (Archiv, Rueckstufung, nur einmal, mehrere
-- verpasste Saisons); 5 reine Rechenfunktionen und Konstanten.
-- Spaetere Tasks des Plans (Online-Wertung, Gegnersuche, Bot- und KI-Ergebnis, Start-Liga, Zaehler) haengen hier
-- eigene Abschnitte an.
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
  if (s->>'saison')::int <> 0 or (s->>'kronen')::int <> 0 or (s->>'stufe')::int <> 0 or (s->>'boden')::int <> 0
     or (s->>'naechste')::int <> 100 then
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
  if (s->>'saison')::int <> 1 or (s->>'kronen')::int <> 900 or (s->>'boden')::int <> 900 then
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
  if (s->>'saison')::int <> 2 or (s->>'kronen')::int <> 1400 or (s->>'boden')::int <> 1200
     or (s->>'stufe')::int <> 14 or (s->>'naechste')::int <> 1500 then
    raise exception 'FEHLER: Saisonwechsel 1750 ergibt nicht 1400 / Boden 1200 / Stufe 14 (%)', s;
  end if;
  -- zweiter Aufruf: nichts mehr
  s := public.kronen_mein_stand();
  if (s->>'kronen')::int <> 1400 then
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
  if (s->>'saison')::int <> 3 or (s->>'kronen')::int <> 1100 or (s->>'boden')::int <> 900 then
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
  if (k->>'stufe_kronen')::int <> 100 or (k#>>'{kronen,ki,sieg}')::int <> 20 or (k#>>'{kronen,online,niederlage}')::int <> -15
     or (k#>>'{kronen,bot,niederlage}')::int <> 0 or (k->>'bot_tagesgrenze')::int <> 10 or (k->>'ki_tagesgrenze')::int <> 20
     or (k->>'ki_mindestdauer_s')::int <> 60 or (k->>'saison_tage')::int <> 28 or (k->>'rueckstufung_stufen')::int <> 3 then
    raise exception 'FEHLER: kronen_konstanten weicht vom Plan ab (%)', k;
  end if;
  if (select zaehler_an from public.kronen_schalter where id) then
    raise exception 'FEHLER: Zaehler ist nach dem Einspielen an';
  end if;
end;
$$;

rollback;

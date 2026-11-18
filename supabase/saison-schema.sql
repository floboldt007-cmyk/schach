-- VORSCHLAG, NOCH NICHT EINGESPIELT (R19, 14.11.2026): Saison-System der Online-Liga.
-- Einspielen (Flo, nie Claude): im Supabase SQL Editor NUR diese Datei, nach kronen-schema.sql und zwei-ligen-schema.sql
-- (live). Danach supabase/saison-rls-test.sql (rollt zurueck). Rueckweg: supabase/saison-zurueck.sql. Wiederholbar.
--
-- Eine Saison dauert 8 Wochen; Saison 1 beginnt Montag 04.01.2027 (erster Montag nach dem Launch), davor ist Vorsaison
-- (kein Abzeichen, kein Reset, die Wochen-Liga laeuft normal). Der Start ist EINE Konstante (saison_konstanten).
-- Am Ende einer Saison, nach der Abrechnung ihrer letzten Woche und vor jeder Gruppe der neuen Saison:
--   1. Teilnehmer = Konten mit mindestens einer Online-Ligawoche in der Saison (die Raetsel-Liga zaehlt nicht).
--   2. Abzeichen = hoechste Stufe der Saison: groesste Stufe ihrer Wochen-Gruppen oder der Stand am Saisonende.
--   3. "crownmaster": wer am Saisonende bei Crownmate I steht (Stufe 17).
--   4. "top10" / "top100": Rang nach Online-Elo (rank, Gleichstand teilt den Platz) unter den Konten mit mindestens 20
--      Online-Partien MIT KRONEN in Wochen der Saison (kronen_buchungen quelle 'online': gewertet, ab 4 Halbzuegen,
--      hoechstens 3 je Gegnerpaar und Tag, wie die Elo); ein Titel je Konto und Saison, der bessere.
--   Dazu: daten-auskunft-zurueck.sql bricht ab, solange diese Datei eingespielt ist (zuerst saison-zurueck.sql).
--   5. Weicher Reset: Stufe minus 3, nie unter Squire III (0), nur fuer Teilnehmer. Die Elo bleibt immer.
-- Eine Pause ueber mehrere Saisons ergibt genau einen Reset (nur die Saison mit Ligawochen setzt zurueck).
-- Ausgeloest wird alles faul aus liga_abrechnen() (Haken unten, dieselbe Sperre 'liga-abrechnen'), je Saison genau einmal
-- (saison_abrechnungen). liga_abrechnen ist hier die live Fassung aus zwei-ligen-schema.sql mit dem Haken, zeichengleich
-- (Test); derselbe Haken steht auch in kronen-schema.sql und zwei-ligen-schema.sql, damit erneutes Einspielen ihn behaelt.
--
-- Datenschutz: Der Gegner einer Online-Partie sieht ueber saison_karte_der_partie NUR das beste Abzeichen (Saison und
-- Stufe) und einen Saison-Titel, wenn das Konto ihn selbst gewaehlt hat (Flo 14.11.2026). Keine Saison-Liste, keine
-- Kronen, keine Partienzahl, keine Konto-Kennung. Alles geht mit dem Konto (on delete cascade); die Datenauskunft
-- (meine_daten) nennt Abzeichen, Titel und Wahl: diese Datei bringt meine_daten() zeichengleich mit daten-schema.sql
-- mit (ganz unten), weil live die Fassung ohne Saison laeuft. Test: tests/server-saison.test.mjs.

do $$
begin
  if pg_catalog.to_regclass('public.kronen_stand') is null or pg_catalog.to_regclass('public.raetsel_stand') is null then
    raise exception 'SAISON: zuerst kronen-schema.sql und zwei-ligen-schema.sql einspielen';
  end if;
end;
$$;

-- je Saison genau eine Abrechnung
create table if not exists public.saison_abrechnungen (
  saison integer primary key,
  am timestamptz not null default now(),
  constraint saison_abrechnungen_saison check (saison >= 1)
);

-- hoechste Stufe je Konto und Saison (nur Teilnehmer)
create table if not exists public.saison_abzeichen (
  user_id uuid not null references auth.users (id) on delete cascade,
  saison integer not null,
  stufe integer not null,
  primary key (user_id, saison),
  constraint saison_abzeichen_saison check (saison >= 1),
  constraint saison_abzeichen_stufe check (stufe between 0 and 17)
);

create table if not exists public.saison_titel (
  user_id uuid not null references auth.users (id) on delete cascade,
  saison integer not null,
  art text not null,
  primary key (user_id, saison, art),
  constraint saison_titel_saison check (saison >= 1),
  constraint saison_titel_art check (art in ('crownmaster', 'top10', 'top100'))
);

-- der selbst gewaehlte Saison-Titel ('crownmaster-s1', 'top10-s3', ...), null = keiner
create table if not exists public.saison_wahl (
  user_id uuid primary key references auth.users (id) on delete cascade,
  titel text,
  constraint saison_wahl_titel check (titel is null or titel ~ '^(crownmaster|top10|top100)-s[1-9][0-9]{0,3}$')
);

alter table public.saison_abrechnungen enable row level security;
alter table public.saison_abzeichen enable row level security;
alter table public.saison_titel enable row level security;
alter table public.saison_wahl enable row level security;
-- keine Policies und keine Tabellenrechte: gelesen und geschrieben wird nur ueber die Funktionen unten
revoke all on table public.saison_abrechnungen, public.saison_abzeichen, public.saison_titel, public.saison_wahl
  from anon, authenticated, public;

create or replace function public.saison_konstanten()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('start', '2027-01-04', 'wochen', 8, 'reset', 3, 'top', jsonb_build_array(10, 100),
    'mindest_partien', 20);
$$;

-- Nummer der Saison einer Liga-Woche (Montag): 0 = Vorsaison
create or replace function public.saison_nummer(woche date)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when woche < s then 0 else (woche - s) / (7 * w) + 1 end
  from (select (k ->> 'start')::date as s, (k ->> 'wochen')::integer as w from (select public.saison_konstanten() as k) x) y;
$$;

-- erster Montag einer Saison
create or replace function public.saison_beginn(saison integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select (k ->> 'start')::date + (saison - 1) * 7 * (k ->> 'wochen')::integer from (select public.saison_konstanten() as k) x;
$$;

-- Rechnet jede beendete, noch offene Saison der Reihe nach ab. Nur intern (aus liga_abrechnen).
create or replace function public.saison_abrechnen()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k jsonb := public.saison_konstanten();
  wochen integer := (k ->> 'wochen')::integer;
  reset integer := (k ->> 'reset')::integer;
  top1 integer := (k -> 'top' ->> 0)::integer;
  top2 integer := (k -> 'top' ->> 1)::integer;
  mindest integer := (k ->> 'mindest_partien')::integer;
  jetzt integer := public.saison_nummer(public.liga_woche_heute());
  s integer;
  von date;
  bis date;
begin
  -- schneller Weg bei jedem Aufruf: alles Faellige ist schon abgerechnet
  if jetzt <= 1 or (select count(*) from public.saison_abrechnungen a where a.saison < jetzt) >= jetzt - 1 then
    return;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('liga-abrechnen'));
  for s in select n from pg_catalog.generate_series(1, jetzt - 1) n
    where not exists (select 1 from public.saison_abrechnungen a where a.saison = n) order by n
  loop
    von := public.saison_beginn(s);
    bis := von + 7 * wochen;
    insert into public.saison_abzeichen (user_id, saison, stufe)
    select m.user_id, s, greatest(max(g.stufe), max(st.stufe))
    from public.liga_mitglieder m
    join public.liga_gruppen g on g.id = m.gruppe
    join public.kronen_stand st on st.user_id = m.user_id
    where m.woche >= von and m.woche < bis and coalesce(to_jsonb(g) ->> 'liga', 'online') = 'online'
    group by m.user_id
    on conflict do nothing;
    insert into public.saison_titel (user_id, saison, art)
    select a.user_id, s, 'crownmaster'
    from public.saison_abzeichen a join public.kronen_stand st on st.user_id = a.user_id
    where a.saison = s and st.stufe = 17
    on conflict do nothing;
    insert into public.saison_titel (user_id, saison, art)
    select r.user_id, s, case when r.rang <= top1 then 'top10' else 'top100' end
    from (
      select st.user_id, rank() over (order by st.elo desc) as rang
      from public.kronen_stand st
      join (select b.user_id from public.kronen_buchungen b
            where b.quelle = 'online' and b.woche >= von and b.woche < bis
            group by b.user_id having count(*) >= mindest) e on e.user_id = st.user_id
    ) r
    where r.rang <= top2
    on conflict do nothing;
    update public.kronen_stand st set stufe = greatest(0, st.stufe - reset), aktualisiert_am = now()
    from public.saison_abzeichen a where a.user_id = st.user_id and a.saison = s;
    insert into public.saison_abrechnungen (saison) values (s) on conflict do nothing;
  end loop;
end;
$$;

-- Eigener Stand fuer das Profil: laufende Saison (0 = Vorsaison), Woche, letzter Sonntag, Hoechststufe bisher (null
-- ohne Ligawoche), eigene Abzeichen und Titel, gewaehlter Titel. Rechnet vorher Faelliges ab (kronen_stand_sichern).
create or replace function public.saison_mein_stand()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  st public.kronen_stand;
  heute date;
  n integer;
  beginn date;
  bisher integer;
  wochen integer := (public.saison_konstanten() ->> 'wochen')::integer;
begin
  if uid is null then
    raise exception 'SAISON_ANMELDUNG';
  end if;
  st := public.kronen_stand_sichern(uid);
  heute := public.liga_woche_heute();
  n := public.saison_nummer(heute);
  if n > 0 then
    beginn := public.saison_beginn(n);
    select max(g.stufe) into bisher
    from public.liga_mitglieder m join public.liga_gruppen g on g.id = m.gruppe
    where m.user_id = uid and m.woche >= beginn and m.woche <= heute and coalesce(to_jsonb(g) ->> 'liga', 'online') = 'online';
    if bisher is not null then
      bisher := greatest(bisher, st.stufe);
    end if;
  end if;
  return jsonb_build_object(
    'saison', n,
    'start', (public.saison_konstanten() ->> 'start'),
    'woche', case when n > 0 then (heute - beginn) / 7 + 1 end,
    'wochen', wochen,
    'ende', case when n > 0 then beginn + 7 * wochen - 1 end,
    'bisher', bisher,
    'stufe', st.stufe,
    'abzeichen', coalesce((select jsonb_agg(jsonb_build_object('saison', a.saison, 'stufe', a.stufe) order by a.saison)
      from public.saison_abzeichen a where a.user_id = uid), '[]'::jsonb),
    'titel', coalesce((select jsonb_agg(t.art || '-s' || t.saison order by t.saison, t.art)
      from public.saison_titel t where t.user_id = uid), '[]'::jsonb),
    'gewaehlt', (select w.titel from public.saison_wahl w where w.user_id = uid)
  );
end;
$$;

-- titel null nimmt den Titel ab; sonst nur ein eigener, verdienter Titel, sonst SAISON_TITEL
create or replace function public.saison_titel_waehle(titel text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'SAISON_ANMELDUNG';
  end if;
  if titel is not null and not exists (
    select 1 from public.saison_titel t where t.user_id = uid and t.art || '-s' || t.saison = titel) then
    raise exception 'SAISON_TITEL';
  end if;
  insert into public.saison_wahl (user_id, titel) values (uid, titel)
  on conflict (user_id) do update set titel = excluded.titel;
  return jsonb_build_object('titel', titel);
end;
$$;

-- Was der Gegner sieht: bestes Abzeichen (hoechste Stufe, bei Gleichstand die juengste Saison) und der gewaehlte Titel,
-- solange er verdient ist. Nur intern.
create or replace function public.saison_karte_von(uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'abzeichen', (select jsonb_build_object('saison', a.saison, 'stufe', a.stufe) from public.saison_abzeichen a
      where a.user_id = uid order by a.stufe desc, a.saison desc limit 1),
    'titel', (select w.titel from public.saison_wahl w where w.user_id = uid and exists (
      select 1 from public.saison_titel t where t.user_id = uid and t.art || '-s' || t.saison = w.titel)));
$$;

-- Saison-Teil beider Karten einer Online-Partie, nur fuer ihre beiden Spieler (wie karte_der_partie in karte-schema.sql)
create or replace function public.saison_karte_der_partie(partie uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  p public.partien_online;
begin
  if uid is null then
    raise exception 'SAISON_ANMELDUNG';
  end if;
  select * into p from public.partien_online x where x.id = partie;
  if p.id is null or (p.weiss is distinct from uid and p.schwarz is distinct from uid) then
    raise exception 'SAISON_KEINE_PARTIE';
  end if;
  return jsonb_build_object(
    'w', case when p.weiss is null then null else public.saison_karte_von(p.weiss) || jsonb_build_object('du', p.weiss = uid) end,
    's', case when p.schwarz is null then null else public.saison_karte_von(p.schwarz) || jsonb_build_object('du', p.schwarz = uid) end
  );
end;
$$;

-- ---------- liga_abrechnen: live Fassung (zwei-ligen-schema.sql) mit dem Saison-Haken, zeichengleich ----------
create or replace function public.liga_abrechnen()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k jsonb := public.kronen_konstanten();
  groesse integer := (k ->> 'gruppe_groesse')::integer;
  auf integer := (k ->> 'aufstieg_plaetze')::integer;
  ab integer := (k ->> 'abstieg_plaetze')::integer;
  heute date := public.liga_woche_heute();
  g public.liga_gruppen;
  r record;
  neu integer;
  b jsonb;
begin
  if not exists (select 1 from public.liga_gruppen x where not x.abgerechnet and x.woche < heute) then
    -- Saison (saison-schema.sql, falls eingespielt): auch ohne offene Woche kann eine Saison zu Ende sein
    if pg_catalog.to_regprocedure('public.saison_abrechnen()') is not null then
      perform public.saison_abrechnen();
    end if;
    return;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('liga-abrechnen'));
  for g in select * from public.liga_gruppen x where not x.abgerechnet and x.woche < heute order by x.woche, x.id for update
  loop
    for r in select * from public.liga_rangliste(g.id, true) l where not l.ki
    loop
      neu := case
        when r.platz <= auf then least(17, g.stufe + 1)
        when r.platz > groesse - ab then greatest(0, g.stufe - 1)
        else g.stufe end;
      if g.liga = 'raetsel' then
        update public.raetsel_stand s set stufe = neu, aktualisiert_am = now() where s.user_id = r.user_id;
      else
        update public.kronen_stand s set stufe = neu, aktualisiert_am = now() where s.user_id = r.user_id;
      end if;
      select e into b from jsonb_array_elements(k -> 'belohnung') e
      where r.platz between (e ->> 'von')::integer and (e ->> 'bis')::integer limit 1;
      if b is not null then
        insert into public.liga_belohnungen (user_id, woche, stufe, platz, art, menge, liga)
        values (r.user_id, g.woche, g.stufe, r.platz, b ->> 'art', (b ->> 'menge')::integer, g.liga)
        on conflict on constraint liga_belohnungen_einmal do nothing;
      end if;
      if neu > g.stufe and neu % 3 = 0 and not exists (
        select 1 from public.liga_belohnungen x
        where x.user_id = r.user_id and x.art = 'aufstieg-banner' and x.stufe = neu) then
        insert into public.liga_belohnungen (user_id, woche, stufe, platz, art, menge, liga)
        values (r.user_id, g.woche, neu, r.platz, 'aufstieg-banner', 1, g.liga)
        on conflict on constraint liga_belohnungen_einmal do nothing;
      end if;
      if pg_catalog.to_regprocedure('public.karte_liga_banner_nachtragen(uuid)') is not null then
        perform public.karte_liga_banner_nachtragen(r.user_id);
      end if;
    end loop;
    update public.liga_gruppen x set abgerechnet = true where x.id = g.id;
  end loop;
  -- Saison nach der Abrechnung ihrer letzten Woche und vor jeder Gruppe der neuen Saison (saison-schema.sql)
  if pg_catalog.to_regprocedure('public.saison_abrechnen()') is not null then
    perform public.saison_abrechnen();
  end if;
  perform public.liga_alte_wochen_loeschen();
end;
$$;

revoke all on function public.liga_abrechnen() from public, anon, authenticated;

revoke all on function public.saison_konstanten(), public.saison_nummer(date), public.saison_beginn(integer),
  public.saison_abrechnen(), public.saison_karte_von(uuid) from public, anon, authenticated, service_role;
revoke all on function public.saison_mein_stand(), public.saison_titel_waehle(text), public.saison_karte_der_partie(uuid)
  from public, anon, authenticated;
grant execute on function public.saison_mein_stand(), public.saison_titel_waehle(text), public.saison_karte_der_partie(uuid)
  to authenticated;

-- Datenauskunft (Kaltreview 14.11.2026): live ist meine_daten() die Fassung OHNE Saison. Damit "nur diese Datei" stimmt,
-- steht sie hier zeichengleich mit supabase/daten-schema.sql (Test). Wer daten-schema.sql spaeter erneut einspielt,
-- bekommt dieselbe Funktion.
create or replace function public.meine_daten()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  online jsonb := '[]'::jsonb;
  versuche jsonb := '[]'::jsonb;
  protokoll jsonb := '[]'::jsonb;
  abo jsonb := null;
  abo_ereignisse jsonb := '[]'::jsonb;
  werkstatt jsonb := jsonb_build_object('altersangabe', null, 'besitz', '[]'::jsonb, 'reservierungen', '[]'::jsonb,
    'edition_zustimmungen', '[]'::jsonb, 'sonderstuecke', '[]'::jsonb, 'edition_ereignisse', '[]'::jsonb);
  coach jsonb := jsonb_build_object('nutzung', '[]'::jsonb);
  schule jsonb := jsonb_build_object('geleitete_klassen', '[]'::jsonb, 'mitgliedschaften', '[]'::jsonb,
    'beitrittsversuche', '[]'::jsonb);
  freunde jsonb := jsonb_build_object('freundschaften', '[]'::jsonb, 'einladung', null, 'wochenpunkte', '[]'::jsonb);
  kronen jsonb := jsonb_build_object('stand', null, 'buchungen', '[]'::jsonb, 'gruppen', '[]'::jsonb,
    'belohnungen', '[]'::jsonb, 'suche', null, 'ki_belege', '[]'::jsonb);
  karte jsonb := jsonb_build_object('stufen', '[]'::jsonb, 'taler', '[]'::jsonb, 'banner', '[]'::jsonb, 'wahl', null);
  duelle jsonb := jsonb_build_object('duelle', '[]'::jsonb, 'suche', null);
  saison jsonb := jsonb_build_object('abzeichen', '[]'::jsonb, 'titel', '[]'::jsonb, 'gewaehlt', null);
  raetsel jsonb;
  verwaltung jsonb := jsonb_build_object('verwalter', null, 'protokoll', '[]'::jsonb); -- [verwaltung]
begin
  if uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  -- die eigenen abgelaufenen Eintraege immer (ohne Obergrenze), danach das allgemeine Aufraeumen fuer alle
  delete from public.daten_zaehler z where z.user_id = uid and z.stunde < date_trunc('hour', now()) - interval '48 hours';
  if to_regclass('public.online_versuche') is not null then
    execute 'delete from public.online_versuche v where v.user_id = $1
             and v.tag < (now() at time zone ''Europe/Berlin'')::date - 2' using uid;
  end if;
  perform public.daten_zaehler_aufraeumen();
  if to_regprocedure('public.online_aufraeumen()') is not null then
    execute 'select public.online_aufraeumen()';
  end if;
  if to_regclass('public.partien_online') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(o) order by o.erstellt_am), ''[]''::jsonb)
             from public.partien_online o where $1 in (o.weiss, o.schwarz, o.erstellt_von)'
      into online using uid;
  end if;
  if to_regclass('public.online_versuche') is not null then
    execute 'select coalesce(jsonb_agg(jsonb_build_object(''tag'', v.tag, ''anzahl'', v.anzahl) order by v.tag), ''[]''::jsonb)
             from public.online_versuche v where v.user_id = $1'
      into versuche using uid;
  end if;
  -- Abo (bisher fehlte die eigene Zeile in der Auskunft)
  if to_regclass('public.abos') is not null then
    execute 'select to_jsonb(a) from public.abos a where a.user_id = $1' into abo using uid;
  end if;
  -- Stripe-Ereignisse zum Abo: mit Konto-Verweis oder ueber die eigene Kundennummer (frueh eingegangene haben noch keinen)
  if to_regclass('public.stripe_ereignisse') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(e) order by e.erstellt, e.id), ''[]''::jsonb)
             from public.stripe_ereignisse e where e.user_id = $1
               or e.kunde_id in (select a.kunde_id from public.abos a where a.user_id = $1 and a.kunde_id is not null)'
      into abo_ereignisse using uid;
  end if;
  -- Frag den Coach (coach-schema.sql): Zahl der Fragen je Tag
  if to_regclass('public.coach_nutzung') is not null then
    execute 'select jsonb_build_object(''nutzung'', coalesce((select jsonb_agg(jsonb_build_object(''tag'', c.tag,
               ''anzahl'', c.anzahl) order by c.tag) from public.coach_nutzung c where c.user_id = $1), ''[]''::jsonb))'
      into coach using uid;
  end if;
  -- Schulmodus (schule-schema.sql): selbst geleitete Klassen mit ihren Aufgaben (ohne die Mitglieder, das sind andere
  -- Personen), die eigenen Mitgliedschaften mit dem eigenen Fortschritt und die Fehlversuche beim Beitreten
  if to_regclass('public.klassen') is not null then
    execute 'select jsonb_build_object(
               ''geleitete_klassen'', coalesce((select jsonb_agg((to_jsonb(k) - ''leitung'') || jsonb_build_object(''aufgaben'',
                   coalesce((select jsonb_agg(to_jsonb(a) - ''klasse'' order by a.erstellt_am)
                     from public.klassen_aufgaben a where a.klasse = k.id), ''[]''::jsonb)) order by k.erstellt_am)
                 from public.klassen k where k.leitung = $1), ''[]''::jsonb),
               ''mitgliedschaften'', coalesce((select jsonb_agg(jsonb_build_object(''klasse'', k.name,
                   ''anzeigename'', m.anzeigename, ''beigetreten_am'', m.beigetreten_am,
                   ''fortschritt'', (select to_jsonb(f) - ''mitglied'' - ''klasse'' from public.klassen_fortschritt f
                     where f.mitglied = m.id)) order by m.beigetreten_am)
                 from public.klassen_mitglieder m join public.klassen k on k.id = m.klasse where m.user_id = $1), ''[]''::jsonb),
               ''beitrittsversuche'', coalesce((select jsonb_agg(jsonb_build_object(''tag'', v.tag, ''anzahl'', v.anzahl)
                   order by v.tag) from public.schule_versuche v where v.user_id = $1), ''[]''::jsonb))'
      into schule using uid;
  end if;
  -- Werkstatt: alles zum Konto, auch Zahlungs- und Sitzungskennungen (es sind die eigenen Daten)
  if to_regclass('public.besitz') is not null then
    execute 'select jsonb_build_object(
               ''altersangabe'', (select to_jsonb(a) from public.altersangaben a where a.user_id = $1),
               ''besitz'', coalesce((select jsonb_agg(to_jsonb(b) order by b.erworben_am, b.nummer)
                 from public.besitz b where b.user_id = $1), ''[]''::jsonb),
               ''reservierungen'', coalesce((select jsonb_agg(to_jsonb(r) order by r.erstellt_am)
                 from public.reservierungen r where r.user_id = $1), ''[]''::jsonb),
               ''edition_zustimmungen'', coalesce((select jsonb_agg(to_jsonb(z) order by z.zeitpunkt)
                 from public.edition_zustimmungen z where z.user_id = $1), ''[]''::jsonb),
               ''sonderstuecke'', coalesce((select jsonb_agg(to_jsonb(s) order by s.stueck_id)
                 from public.sonderstuecke s where s.user_id = $1), ''[]''::jsonb),
               ''edition_ereignisse'', coalesce((select jsonb_agg(to_jsonb(e) order by e.erstellt, e.id)
                 from public.edition_ereignisse e join public.reservierungen r on r.id = e.reservierung_id
                 where r.user_id = $1), ''[]''::jsonb))'
      into werkstatt using uid;
  end if;
  -- Freunde (freunde-schema.sql): Freundschaften und Anfragen mit dem Benutzernamen der anderen Seite, der eigene
  -- Einladungscode und die Wochenwertung
  if to_regclass('public.freundschaften') is not null then
    execute 'select jsonb_build_object(
               ''freundschaften'', coalesce((select jsonb_agg(jsonb_build_object(
                   ''mit'', p.benutzername, ''angefragt_von_mir'', f.von = $1, ''status'', f.status,
                   ''erstellt_am'', f.erstellt_am, ''geaendert_am'', f.geaendert_am) order by f.erstellt_am)
                 from public.freundschaften f
                 left join public.profile p on p.user_id = case when f.von = $1 then f.an else f.von end
                 where f.von = $1 or f.an = $1), ''[]''::jsonb),
               ''einladung'', (select to_jsonb(e) - ''von'' from public.freund_einladungen e where e.von = $1),
               ''wochenpunkte'', coalesce((select jsonb_agg(to_jsonb(w) - ''user_id'' order by w.woche)
                 from public.wochenpunkte w where w.user_id = $1), ''[]''::jsonb))'
      into freunde using uid;
  end if;
  -- Liga mit Kronen (kronen-schema.sql): eigener Stand, alle Buchungen, die eigenen Wochen-Gruppen (Woche, Stufe, eigene
  -- Kronen; die anderen Mitglieder nicht), gemerkte Belohnungen, die laufende Gegnersuche und die KI-Belege. Die
  -- Tageszaehler (zaehler_tag) haben keinen Personenbezug und gehoeren nicht hierher.
  if to_regclass('public.kronen_stand') is not null then
    execute 'select jsonb_build_object(
               ''stand'', (select to_jsonb(s) - ''user_id'' from public.kronen_stand s where s.user_id = $1),
               ''buchungen'', coalesce((select jsonb_agg(to_jsonb(b) - ''user_id'' order by b.am, b.id)
                 from public.kronen_buchungen b where b.user_id = $1), ''[]''::jsonb),
               ''gruppen'', coalesce((select jsonb_agg(jsonb_build_object(''woche'', m.woche, ''stufe'', g.stufe,
                   ''kronen'', m.kronen, ''beigetreten'', m.beigetreten,
                   ''liga'', coalesce(to_jsonb(m) ->> ''liga'', ''online'')) order by m.woche)
                 from public.liga_mitglieder m join public.liga_gruppen g on g.id = m.gruppe where m.user_id = $1), ''[]''::jsonb),
               ''belohnungen'', coalesce((select jsonb_agg(to_jsonb(l) - ''user_id'' order by l.woche, l.id)
                 from public.liga_belohnungen l where l.user_id = $1), ''[]''::jsonb),
               ''suche'', (select to_jsonb(q) - ''user_id'' from public.suche_warteschlange q where q.user_id = $1),
               ''ki_belege'', coalesce((select jsonb_agg(to_jsonb(k) - ''user_id'' order by k.erstellt_am)
                 from public.suche_ki_belege k where k.user_id = $1), ''[]''::jsonb))'
      into kronen using uid;
    kronen := kronen || jsonb_build_object('raetsel_stand', null);
  end if;
  -- Zwei Ligen (zwei-ligen-schema.sql): der eigene Stand der Raetsel-Liga (Stufe, Kronen, Raetsel-Elo)
  if to_regclass('public.raetsel_stand') is not null then
    execute 'select to_jsonb(r) - ''user_id'' from public.raetsel_stand r where r.user_id = $1'
      into raetsel using uid;
    kronen := kronen || jsonb_build_object('raetsel_stand', raetsel);
  end if;
  -- Live-Bewertung (zwei-ligen-schema.sql, 11.11.2026): an welchen Tagen welche gewertete Partie live bewertet wurde
  if to_regclass('public.live_bewertung_nutzung') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(b) - ''user_id'' order by b.tag, b.erstellt_am), ''[]''::jsonb)
             from public.live_bewertung_nutzung b where b.user_id = $1'
      into raetsel using uid;
    kronen := kronen || jsonb_build_object('live_bewertung', raetsel);
  end if;
  -- Weltrangliste (weltrang-schema.sql, 14.11.2026): ob und seit wann du in der Weltrangliste gezeigt werden willst
  if to_regclass('public.weltrang_teilnahme') is not null then
    execute 'select jsonb_build_object(''teilnahme'', t.user_id is not null, ''seit'', t.seit)
             from (select 1) x left join public.weltrang_teilnahme t on t.user_id = $1'
      into raetsel using uid;
    kronen := kronen || jsonb_build_object('weltrang', raetsel);
  end if;
  -- Visitenkarte und Erfolge (karte-schema.sql, Etappe 4b): erreichte Stufen, alle Taler-Buchungen, eigene Banner und die
  -- gewaehlte Karte (Banner, Titel, Vitrine, Profilbild)
  if to_regclass('public.karte_stufen') is not null then
    execute 'select jsonb_build_object(
               ''stufen'', coalesce((select jsonb_agg(to_jsonb(s) - ''user_id'' order by s.familie, s.stufe)
                 from public.karte_stufen s where s.user_id = $1), ''[]''::jsonb),
               ''taler'', coalesce((select jsonb_agg(to_jsonb(t) - ''user_id'' order by t.am, t.id)
                 from public.taler_buchungen t where t.user_id = $1), ''[]''::jsonb),
               ''banner'', coalesce((select jsonb_agg(to_jsonb(b) - ''user_id'' order by b.banner)
                 from public.banner_besitz b where b.user_id = $1), ''[]''::jsonb),
               ''wahl'', (select to_jsonb(w) - ''user_id'' from public.karte_wahl w where w.user_id = $1))'
      into karte using uid;
  end if;
  -- Saison (saison-schema.sql, R19): Abzeichen je Saison (hoechste Stufe), verdiente Saison-Titel, der gewaehlte Titel
  if to_regclass('public.saison_abzeichen') is not null then
    execute 'select jsonb_build_object(
               ''abzeichen'', coalesce((select jsonb_agg(jsonb_build_object(''saison'', a.saison, ''stufe'', a.stufe) order by a.saison)
                 from public.saison_abzeichen a where a.user_id = $1), ''[]''::jsonb),
               ''titel'', coalesce((select jsonb_agg(jsonb_build_object(''saison'', t.saison, ''art'', t.art) order by t.saison, t.art)
                 from public.saison_titel t where t.user_id = $1), ''[]''::jsonb),
               ''gewaehlt'', (select w.titel from public.saison_wahl w where w.user_id = $1))'
      into saison using uid;
  end if;
  -- Raetsel-Duell (raetsel-duell-schema.sql): die eigenen Duelle mit dem eigenen Stand darin und die laufende Suche.
  -- Ohne Saat und Raetsel-Folge: beide sind keine Daten ueber das Konto, und waehrend eines laufenden Duells verrieten
  -- sie die kommenden Raetsel (Schummelschutz).
  if to_regclass('public.duell_spieler') is not null then
    execute 'select jsonb_build_object(
               ''duelle'', coalesce((select jsonb_agg((to_jsonb(x) - ''seed'' - ''raetsel'') || jsonb_build_object(''mein_stand'',
                   to_jsonb(s) - ''user_id'' - ''duell'') order by x.erstellt_am)
                 from public.duell_spieler s join public.duelle x on x.id = s.duell where s.user_id = $1), ''[]''::jsonb),
               ''suche'', (select to_jsonb(q) - ''user_id'' from public.duell_warteschlange q where q.user_id = $1))'
      into duelle using uid;
  end if;
  -- [verwaltung] Verwaltung (verwaltung-schema.sql): Aenderungen der Verwaltung an diesem Konto (was, vorher, nachher,
  -- [verwaltung] wann), ohne die Kennung des Verwalters; dazu, seit wann das Konto selbst verwalten darf
  if to_regclass('public.verwaltung_protokoll') is not null then -- [verwaltung]
    execute 'select jsonb_build_object(''verwalter'', (select jsonb_build_object(''seit'', v.seit) from public.verwalter v where v.user_id = $1), ''protokoll'', coalesce((select jsonb_agg(jsonb_build_object(''was'', x.was, ''vorher'', x.vorher, ''nachher'', x.nachher, ''am'', x.am) order by x.am, x.id) from public.verwaltung_protokoll x where x.ziel_user = $1), ''[]''::jsonb))' into verwaltung using uid; -- [verwaltung]
  end if; -- [verwaltung]
  begin
    execute 'select coalesce(jsonb_agg(jsonb_build_object(''am'', e.created_at, ''aktion'', e.payload ->> ''action'',
               ''ip'', e.ip_address) order by e.created_at), ''[]''::jsonb)
             from auth.audit_log_entries e where e.payload ->> ''actor_id'' = $1::text'
      into protokoll using uid;
  exception
    when undefined_table or insufficient_privilege then protokoll := null; -- nicht lesbar: in der Auskunft vermerkt
  end;
  return jsonb_build_object(
    'erstellt_am', now(),
    'konto', (
      select jsonb_build_object(
        'id', u.id, 'email', u.email, 'erstellt_am', u.created_at, 'letzte_anmeldung', u.last_sign_in_at,
        'anbieter', u.raw_app_meta_data -> 'providers',
        -- Angaben des Anmeldeanbieters (bei Google z. B. Name, Bild-Adresse, Google-Kennung)
        'angaben_anbieter', u.raw_user_meta_data)
      from auth.users u where u.id = uid),
    'profil', (select to_jsonb(p) from public.profile p where p.user_id = uid),
    'spielstand', (
      select jsonb_build_object(
        'format_version', s.format_version, 'geraet', s.geraet, 'aktualisiert_am', s.aktualisiert_am,
        'groesse_bytes', pg_column_size(s.stand))
      from public.spielstaende s where s.user_id = uid),
    'partien_archiv', coalesce(
      (select jsonb_agg(to_jsonb(a) order by a.gespielt_am, a.erstellt_am) from public.partien_archiv a where a.user_id = uid),
      '[]'::jsonb),
    'nutzung', coalesce(
      (select jsonb_agg(to_jsonb(n) order by n.erstellt_am) from public.nutzung n where n.user_id = uid),
      '[]'::jsonb),
    'freigabe_widerruf', (select to_jsonb(w) from public.freigabe_widerrufe w where w.user_id = uid),
    -- Freunde: Freundschaften und Anfragen (mit Benutzername der anderen Seite), Einladungscode, Wochenwertung
    'freunde', freunde,
    -- Liga mit Kronen: Stand, Buchungen, Wochen-Gruppen, Belohnungen, laufende Gegnersuche, KI-Belege (leer ohne kronen-schema.sql)
    'kronen', kronen,
    -- Visitenkarte und Erfolge: Stufen, Taler-Buchungen, Banner, gewaehlte Karte (leer ohne karte-schema.sql)
    'karte', karte,
    -- Saison: Abzeichen, Saison-Titel, gewaehlter Titel (leer ohne saison-schema.sql)
    'saison', saison,
    -- Raetsel-Duell: eigene Duelle mit eigenem Stand, laufende Suche (leer ohne raetsel-duell-schema.sql)
    'raetsel_duell', duelle,
    'partien_online', online,
    -- Fehlversuche beim Beitreten zu Online-Partien (Zahl je Tag; leer, wenn online-schema.sql fehlt)
    'online_versuche', versuche,
    -- Zaehler der Mengenbremse (Zahl der geteilten Zeilen je Tabelle und Stunde, ohne Inhalte; aeltere als 48 Stunden
    -- hat das Aufraeumen oben schon entfernt)
    'mengenzaehler', coalesce(
      (select jsonb_agg(jsonb_build_object('tabelle', z.tabelle, 'stunde', z.stunde, 'anzahl', z.anzahl)
                        order by z.stunde, z.tabelle)
       from public.daten_zaehler z where z.user_id = uid),
      '[]'::jsonb),
    'abo', abo,
    -- Stripe-Ereignisse zum Abo (leer ohne abo-schema.sql)
    'abo_ereignisse', abo_ereignisse,
    -- Frag den Coach: Fragen je Tag (leer ohne coach-schema.sql)
    'coach', coach,
    -- Schulmodus: geleitete Klassen mit Aufgaben, eigene Mitgliedschaften mit Fortschritt, Beitrittsversuche
    'schule', schule,
    -- [verwaltung] Aenderungen der Verwaltung an diesem Konto (leer ohne verwaltung-schema.sql)
    'verwaltung', verwaltung, -- [verwaltung]
    -- Anmeldeprotokoll von Supabase (Zeitpunkt, Art, IP); null, wenn die Funktion es nicht lesen darf
    'anmeldeprotokoll', protokoll
  ) || werkstatt;
end;
$$;

revoke execute on function public.meine_daten() from public, anon;
grant execute on function public.meine_daten() to authenticated;

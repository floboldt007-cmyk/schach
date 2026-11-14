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
-- (daten-schema.sql, meine_daten) nennt Abzeichen, Titel und Wahl. Test: tests/server-saison.test.mjs.

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

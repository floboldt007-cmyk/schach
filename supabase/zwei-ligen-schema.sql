-- Zwei Ligen (G-005, Punkt 38, 10.11.2026): Ranked Online 1 gegen 1 und Raetselduell bekommen je eigene Kronen,
-- Wochen-Gruppen, Plaetze und Belohnungen. Dazu die Sofort-Suche: eine feste Ranked-Zeit, 30 s auf einen Menschen
-- warten, "Jetzt gegen KI" ab 10 s gewertet, und die Elo bestimmt nur die Reihenfolge der Paarung, nie, ob gepaart wird
-- (Flo: "direkt den naechsten, der online ist"). Konzept und RPC-Vertrag: Vault, Schach-App/Konzept Zwei Ligen.md.
--
-- Modell: Spalte liga ('online' | 'raetsel', Vorgabe 'online') an liga_gruppen, liga_mitglieder, liga_belohnungen.
-- kronen_stand bleibt der Stand der Online-Liga (Bedeutung unveraendert), neu ist raetsel_stand. Die Liga einer Buchung
-- folgt aus ihrer Quelle: online, ki, bot -> online; duell, duell_ki -> raetsel. Bots, Rangliste und Aufbewahrung
-- arbeiten je Gruppe und bleiben, die Abrechnung bekommt eine Weiche je Liga.
-- Uebergang: alles Bisherige bleibt in der Online-Liga, auch die laufende Woche samt der schon gebuchten Duell-Kronen.
-- Die Raetsel-Liga beginnt mit der ersten Buchung nach dem Einspielen, mit 0 Kronen; ihre Stufe ist dann einmalig die
-- Online-Stufe, hoechstens Laeufer III, ihre Elo die Online-Elo.
--
-- Abwaertsvertraeglich: kronen_mein_stand(), liga_meine_gruppe(), kronen_bot_ergebnis, kronen_ki_ergebnis, kronen_start
-- und die Suchen online_suche_* / duell_suche_* behalten Namen und Antwortform (die Suchen bekommen Felder dazu).
--
-- Einspielen (Flo, nie Claude): nach online-, kronen-, raetsel-duell-, karte- und liga-bild-schema.sql im SQL Editor.
-- Wiederholbar. Wer eine dieser Dateien spaeter erneut einspielt, spielt danach auch diese Datei erneut ein (sie ersetzt
-- deren Funktionen). Pruefen: supabase/zwei-ligen-rls-test.sql (rollt zurueck). Rueckweg: supabase/zwei-ligen-zurueck.sql.

-- ---------- Tabellen ----------

create table if not exists public.raetsel_stand (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stufe integer not null default 0,
  kronen integer not null default 0,
  elo integer not null default 1000,
  elo_n integer not null default 0,
  aktualisiert_am timestamptz not null default now(),
  constraint raetsel_stand_stufe check (stufe between 0 and 17),
  constraint raetsel_stand_kronen check (kronen >= 0),
  constraint raetsel_stand_elo check (elo between 100 and 4000),
  constraint raetsel_stand_elo_n check (elo_n >= 0)
);
alter table public.raetsel_stand enable row level security;
revoke all on table public.raetsel_stand from anon, authenticated, public;

alter table public.liga_gruppen add column if not exists liga text not null default 'online';
alter table public.liga_mitglieder add column if not exists liga text not null default 'online';
alter table public.liga_belohnungen add column if not exists liga text not null default 'online';
alter table public.liga_gruppen drop constraint if exists liga_gruppen_liga;
alter table public.liga_gruppen add constraint liga_gruppen_liga check (liga in ('online', 'raetsel'));
alter table public.liga_mitglieder drop constraint if exists liga_mitglieder_liga;
alter table public.liga_mitglieder add constraint liga_mitglieder_liga check (liga in ('online', 'raetsel'));
alter table public.liga_belohnungen drop constraint if exists liga_belohnungen_liga;
alter table public.liga_belohnungen add constraint liga_belohnungen_liga check (liga in ('online', 'raetsel'));
-- je Konto, Woche und Liga genau eine Gruppe; je Konto, Woche, Art und Liga hoechstens eine Belohnung
alter table public.liga_mitglieder drop constraint if exists liga_mitglieder_einmal;
alter table public.liga_mitglieder add constraint liga_mitglieder_einmal unique (user_id, woche, liga);
alter table public.liga_belohnungen drop constraint if exists liga_belohnungen_einmal;
alter table public.liga_belohnungen add constraint liga_belohnungen_einmal unique (user_id, woche, art, liga);
create index if not exists liga_gruppen_liga_woche on public.liga_gruppen (liga, woche, stufe, abgerechnet);

-- ---------- Konstanten ----------
-- wie in kronen-schema.sql, dazu ranked_zeit, mensch_warte_s, ki_frueh_s, ligen, quellen_liga
create or replace function public.kronen_konstanten()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'stufen_je_liga', 3,
    'stufen_anzahl', 18,
    'kronen', jsonb_build_object(
      'online', jsonb_build_object('sieg', 30, 'remis', 10, 'niederlage', -15),
      'ki', jsonb_build_object('sieg', 20, 'remis', 5, 'niederlage', -10),
      'bot', jsonb_build_object('sieg', 15, 'remis', 5, 'niederlage', 0),
      'duell', jsonb_build_object('sieg', 30, 'remis', 10, 'niederlage', -15),
      'duell_ki', jsonb_build_object('sieg', 20, 'remis', 5, 'niederlage', -10)
    ),
    'bot_tagesgrenze', 10,
    'ki_tagesgrenze', 20,
    -- Gewinne gegen Bot und KI je Woche, Konto und LIGA (Online: bot + ki, Raetsel: duell_ki); Menschen-Partien frei
    'bot_ki_wochen_max', 300,
    'ki_mindestdauer_s', 60,
    'online_mindest_halbzuege', 4,
    'paar_tagesgrenze', 3,
    'klassen_grenzen', jsonb_build_array(0, 1000, 1200, 1400, 1600, 1900),
    'start_elo_min', 400,
    'start_elo_max', 2800,
    'start_hoechste_liga', 2,
    'gruppe_groesse', 30,
    'aufstieg_plaetze', 5,
    'abstieg_plaetze', 5,
    'belohnung', jsonb_build_array(
      jsonb_build_object('von', 1, 'bis', 1, 'art', 'banner', 'menge', 1),
      jsonb_build_object('von', 2, 'bis', 2, 'art', 'taler', 'menge', 120),
      jsonb_build_object('von', 3, 'bis', 3, 'art', 'taler', 'menge', 100),
      jsonb_build_object('von', 4, 'bis', 5, 'art', 'taler', 'menge', 80),
      jsonb_build_object('von', 6, 'bis', 10, 'art', 'taler', 'menge', 40),
      jsonb_build_object('von', 11, 'bis', 20, 'art', 'taler', 'menge', 20)
    ),
    'bot_ziel_max', jsonb_build_array(150, 250, 350, 450, 600, 800),
    -- Zwei Ligen (G-005): eine feste Ranked-Zeit, damit sich alle Suchenden finden; 30 s auf einen Menschen, danach
    -- nimmt die App die KI; "Jetzt gegen KI" bringt erst ab 10 s Suche einen gewerteten KI-Gegner (der alte Schutz)
    'ranked_zeit', '5+3',
    'mensch_warte_s', 30,
    'ki_frueh_s', 10,
    'ligen', jsonb_build_array('online', 'raetsel'),
    'quellen_liga', jsonb_build_object('online', 'online', 'ki', 'online', 'bot', 'online', 'duell', 'raetsel',
      'duell_ki', 'raetsel')
  );
$$;

-- ---------- Hilfen (intern) ----------

-- Liga pruefen: nur 'online' oder 'raetsel', sonst KRONEN_EINGABE
create or replace function public.liga_pruefen(liga text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if liga is null or liga not in ('online', 'raetsel') then
    raise exception 'KRONEN_EINGABE';
  end if;
  return liga;
end;
$$;

-- Liga einer Buchungsquelle
create or replace function public.liga_der_quelle(quelle text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when quelle in ('duell', 'duell_ki') then 'raetsel' else 'online' end;
$$;

-- Stand der Raetsel-Liga anlegen (einmalig aus dem Online-Stand: Stufe hoechstens Laeufer III, Elo) und sperren.
-- Sperrfolge immer kronen_stand vor raetsel_stand. Nur intern.
create or replace function public.raetsel_stand_sichern(uid uuid)
returns public.raetsel_stand
language plpgsql
security definer
set search_path = ''
as $$
declare
  ks public.kronen_stand;
  rs public.raetsel_stand;
  k jsonb := public.kronen_konstanten();
begin
  ks := public.kronen_stand_sichern(uid);   -- rechnet faellige Wochen ab und sperrt den Online-Stand
  insert into public.raetsel_stand (user_id, stufe, elo)
  values (uid, least(ks.stufe, (k ->> 'start_hoechste_liga')::integer * (k ->> 'stufen_je_liga')::integer), ks.elo)
  on conflict (user_id) do nothing;
  select * into rs from public.raetsel_stand r where r.user_id = uid for update;
  return rs;
end;
$$;

-- Stufe eines Kontos in einer Liga (Stand angelegt und gesperrt). Nur intern.
create or replace function public.liga_stufe_sichern(uid uuid, liga text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if liga = 'raetsel' then
    return (public.raetsel_stand_sichern(uid)).stufe;
  end if;
  return (public.kronen_stand_sichern(uid)).stufe;
end;
$$;

-- ---------- Buchen in die Wochen-Gruppe einer Liga ----------
-- Wie liga_buchen in kronen-schema.sql, je Liga: ohne Gruppe tritt das Konto der aeltesten Gruppe seiner Stufe in DIESER
-- Liga mit weniger als 30 Menschen bei (sonst einer neuen). Gesamtkronen gehen in den Stand der Liga. Nur intern, nach
-- liga_stufe_sichern (Stand gesperrt). Antwort: die tatsaechliche Aenderung der Wochen-Kronen.
create or replace function public.liga_buchen_in(uid uuid, liga text, nominal integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  wo date := public.liga_woche_am(pg_catalog.clock_timestamp());
  st_stufe integer;
  m public.liga_mitglieder;
  gid bigint;
  neu integer;
  fertig boolean;
begin
  if liga = 'raetsel' then
    select r.stufe into st_stufe from public.raetsel_stand r where r.user_id = uid;
  else
    select s.stufe into st_stufe from public.kronen_stand s where s.user_id = uid;
  end if;
  select * into m from public.liga_mitglieder x where x.user_id = uid and x.woche = wo and x.liga = liga_buchen_in.liga
  for update;
  if m.gruppe is null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('liga-gruppe:' || liga || ':' || wo::text || ':'
      || st_stufe::text));
    select g.id into gid from public.liga_gruppen g
    where g.liga = liga_buchen_in.liga and g.woche = wo and g.stufe = st_stufe and not g.abgerechnet
      and (select count(*) from public.liga_mitglieder x where x.gruppe = g.id)
          < (public.kronen_konstanten() ->> 'gruppe_groesse')::integer
    order by g.id limit 1;
    if gid is null then
      insert into public.liga_gruppen (woche, stufe, liga) values (wo, st_stufe, liga) returning id into gid;
    end if;
    insert into public.liga_mitglieder (gruppe, user_id, woche, liga) values (gid, uid, wo, liga) returning * into m;
  end if;
  select g.abgerechnet into fertig from public.liga_gruppen g where g.id = m.gruppe for share;
  if fertig then
    return 0;
  end if;
  neu := greatest(0, m.kronen + nominal);
  update public.liga_mitglieder x set kronen = neu where x.gruppe = m.gruppe and x.user_id = uid;
  if liga = 'raetsel' then
    update public.raetsel_stand r set kronen = greatest(0, r.kronen + (neu - m.kronen)), aktualisiert_am = now()
    where r.user_id = uid;
  else
    update public.kronen_stand s set kronen = greatest(0, s.kronen + (neu - m.kronen)), aktualisiert_am = now()
    where s.user_id = uid;
  end if;
  return neu - m.kronen;
end;
$$;

-- alter Name: Online-Liga
create or replace function public.liga_buchen(uid uuid, nominal integer)
returns integer
language sql
security definer
set search_path = ''
as $$
  select public.liga_buchen_in(uid, 'online', nominal);
$$;

-- Platz, Wochen-Kronen und ziel (Kronen auf Platz 5) in der Gruppe dieser Woche einer Liga; null ohne Gruppe
create or replace function public.liga_mein_platz_in(uid uuid, liga text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('gruppe', m.gruppe, 'kronen', m.kronen,
    'platz', (select r.platz from public.liga_rangliste(m.gruppe, false) r where r.user_id = uid),
    'ziel', (select r.kronen from public.liga_rangliste(m.gruppe, false) r
             where r.platz = (public.kronen_konstanten() ->> 'aufstieg_plaetze')::integer))
  from public.liga_mitglieder m
  where m.user_id = uid and m.woche = public.liga_woche_heute() and m.liga = liga_mein_platz_in.liga;
$$;

create or replace function public.liga_mein_platz(uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.liga_mein_platz_in(uid, 'online');
$$;

-- Gewinne gegen Bot und KI einer Liga in einer Woche (Online: bot + ki; Raetsel: duell_ki). Nur intern.
create or replace function public.liga_bot_ki_genutzt_in(uid uuid, wo date, liga text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(b.delta) filter (where b.delta > 0), 0)::integer from public.kronen_buchungen b
  where b.user_id = uid and b.woche = wo
    and b.quelle = any (case when liga = 'raetsel' then array['duell_ki'] else array['bot', 'ki'] end);
$$;

-- alter Name: Online-Liga
create or replace function public.liga_bot_ki_genutzt(uid uuid, wo date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select public.liga_bot_ki_genutzt_in(uid, wo, 'online');
$$;

-- Gemeinsame Buchung fuer Bot, KI-Gegner und Raetsel-Duell (wie kronen-schema.sql), jetzt in die Liga der Quelle.
-- Antwort { delta, kronen, stufe, bot_ki_voll } mit den Wochen-Kronen und der Stufe DIESER Liga.
create or replace function public.kronen_einfach_buchen(uid uuid, art text, schluessel text, ergebnis text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  konst jsonb := public.kronen_konstanten();
  nominal integer := (konst #>> array['kronen', art, ergebnis])::integer;
  deckel integer := (konst ->> 'bot_ki_wochen_max')::integer;
  wo date := public.liga_woche_am(pg_catalog.clock_timestamp());
  lg text := public.liga_der_quelle(art);
  stufe integer;
  d integer := 0;
  gebucht integer;
begin
  stufe := public.liga_stufe_sichern(uid, lg);
  insert into public.kronen_buchungen (user_id, quelle, ref, delta, woche)
  values (uid, art, schluessel, 0, wo)
  on conflict on constraint kronen_buchungen_einmal do nothing;
  get diagnostics gebucht = row_count;
  if gebucht > 0 then
    if nominal > 0 and art in ('bot', 'ki', 'duell_ki') then
      nominal := least(nominal, greatest(0, deckel - public.liga_bot_ki_genutzt_in(uid, wo, lg)));
    end if;
    d := public.liga_buchen_in(uid, lg, nominal);
    update public.kronen_buchungen b set delta = d where b.user_id = uid and b.quelle = art and b.ref = schluessel;
  end if;
  return jsonb_build_object('delta', d, 'kronen', coalesce((public.liga_mein_platz_in(uid, lg) ->> 'kronen')::integer, 0),
    'stufe', stufe, 'bot_ki_voll', public.liga_bot_ki_genutzt_in(uid, wo, lg) >= deckel);
end;
$$;

-- Online-Partie buchen (wie kronen-schema.sql, Online-Liga ausdruecklich)
create or replace function public.kronen_online_buchen(uid uuid, partie uuid, punkte numeric, gegner_elo integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  st public.kronen_stand;
  nominal integer;
  k integer;
  erwartet numeric;
  neu_elo integer;
  gebucht integer;
begin
  st := public.kronen_stand_sichern(uid);
  nominal := (public.kronen_konstanten() #>> array['kronen', 'online',
    case punkte when 1 then 'sieg' when 0 then 'niederlage' else 'remis' end])::integer;
  insert into public.kronen_buchungen (user_id, quelle, ref, delta, woche)
  values (uid, 'online', partie::text, 0, public.liga_woche_heute())
  on conflict (user_id, quelle, ref) do nothing;
  get diagnostics gebucht = row_count;
  if gebucht = 0 then
    return;
  end if;
  update public.kronen_buchungen b set delta = public.liga_buchen_in(uid, 'online', nominal)
  where b.user_id = uid and b.quelle = 'online' and b.ref = partie::text;
  k := case when st.elo_n < 15 then 40 else 32 end;
  erwartet := 1 / (1 + power(10::numeric, (gegner_elo - st.elo)::numeric / 400));
  neu_elo := least(4000, greatest(100, st.elo + round(k * (punkte - erwartet))::integer));
  update public.kronen_stand s
  set elo = neu_elo, elo_n = st.elo_n + 1, aktualisiert_am = now()
  where s.user_id = uid;
end;
$$;

-- Raetsel-Elo nach einem gewerteten Duell gegen einen Menschen (Formel wie online). Nur intern, Stand gesperrt.
create or replace function public.raetsel_elo_buchen(uid uuid, punkte numeric, gegner_elo integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rs public.raetsel_stand;
  k integer;
  erwartet numeric;
begin
  select * into rs from public.raetsel_stand r where r.user_id = uid for update;
  k := case when rs.elo_n < 15 then 40 else 32 end;
  erwartet := 1 / (1 + power(10::numeric, (gegner_elo - rs.elo)::numeric / 400));
  update public.raetsel_stand r
  set elo = least(4000, greatest(100, rs.elo + round(k * (punkte - erwartet))::integer)), elo_n = rs.elo_n + 1,
      aktualisiert_am = now()
  where r.user_id = uid;
end;
$$;

-- ---------- Abrechnung je Liga ----------
-- Wie kronen-schema.sql; die neue Stufe geht in den Stand der Liga der Gruppe, die Belohnung bekommt die Liga.
-- Das Aufstiegs-Banner einer Figur gibt es einmal im Leben, egal in welcher Liga (eine gemeinsame Banner-Sammlung).
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
  perform public.liga_alte_wochen_loeschen();
end;
$$;

-- ---------- Lesen (App) ----------

-- Mitgliederliste einer Gruppe in Rangfolge; mit Profilbild und Banner, wenn karte-schema.sql eingespielt ist (wie
-- liga-bild-schema.sql), sonst ohne. Nur intern.
create or replace function public.liga_mitglieder_liste(gid bigint, ich uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  liste jsonb;
begin
  if pg_catalog.to_regclass('public.karte_wahl') is not null and pg_catalog.to_regclass('public.banner_besitz') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object(
          'platz', r.platz,
          'name', case when r.ki then b.name else public.liga_name(r.user_id) end,
          'kronen', r.kronen, 'ki', r.ki, 'ich', r.user_id is not distinct from $2)
          || case when r.ki or r.user_id is null then '{}'::jsonb else jsonb_build_object(
               'motiv', coalesce(w.motiv, 'P'), 'grund', coalesce(w.grund, 'standard'), 'rahmen', coalesce(w.rahmen, 'ohne'),
               'banner', case when w.banner is not null and exists (select 1 from public.banner_besitz bb
                                                                    where bb.user_id = r.user_id and bb.banner = w.banner)
                              then w.banner else 'start' end) end
          order by r.platz), '[]'::jsonb)
      from public.liga_rangliste($1, false) r
      left join public.liga_bots($1, false) b on r.ki and b.nr = r.nr
      left join public.karte_wahl w on not r.ki and w.user_id = r.user_id
    $q$ into liste using gid, ich;
  else
    select coalesce(jsonb_agg(jsonb_build_object(
        'platz', r.platz,
        'name', case when r.ki then b.name else public.liga_name(r.user_id) end,
        'kronen', r.kronen, 'ki', r.ki, 'ich', r.user_id is not distinct from ich) order by r.platz), '[]'::jsonb)
      into liste
    from public.liga_rangliste(gid, false) r
    left join public.liga_bots(gid, false) b on r.ki and b.nr = r.nr;
  end if;
  return liste;
end;
$$;

-- Eigener Stand einer Liga: { liga, stufe, kronen, platz, ziel, n, woche } (kronen = Wochen-Kronen; ohne Gruppe platz
-- und ziel null). Legt den Stand an, nie eine Gruppe.
create or replace function public.liga_stand(liga text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  lg text;
  stufe integer;
  p jsonb;
begin
  if uid is null then
    raise exception 'KRONEN_ANMELDUNG';
  end if;
  lg := public.liga_pruefen(liga);
  stufe := public.liga_stufe_sichern(uid, lg);
  p := public.liga_mein_platz_in(uid, lg);
  return jsonb_build_object(
    'liga', lg,
    'stufe', stufe,
    'kronen', coalesce((p ->> 'kronen')::integer, 0),
    'platz', (p ->> 'platz')::integer,
    'ziel', (p ->> 'ziel')::integer,
    'n', (public.kronen_konstanten() ->> 'gruppe_groesse')::integer,
    'woche', public.liga_woche_heute()
  );
end;
$$;

-- Beide Staende in einem Aufruf (Startseite): { online, raetsel }
create or replace function public.liga_staende()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object('online', public.liga_stand('online'), 'raetsel', public.liga_stand('raetsel'));
$$;

-- Die eigene Gruppe dieser Woche einer Liga: { liga, woche, ende, stufe, gruppe, platz, n, mitglieder, belohnung,
-- bot_ki, offen }; ohne Gruppe gruppe null und mitglieder []. offen: nicht ausgezahlte Belohnungen DIESER Liga.
create or replace function public.liga_gruppe(liga text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  k jsonb := public.kronen_konstanten();
  wo date := public.liga_woche_heute();
  lg text;
  stufe integer;
  m public.liga_mitglieder;
  liste jsonb := '[]'::jsonb;
  mein_platz integer;
begin
  if uid is null then
    raise exception 'KRONEN_ANMELDUNG';
  end if;
  lg := public.liga_pruefen(liga);
  stufe := public.liga_stufe_sichern(uid, lg);
  select * into m from public.liga_mitglieder x where x.user_id = uid and x.woche = wo and x.liga = lg;
  if m.gruppe is not null then
    liste := public.liga_mitglieder_liste(m.gruppe, uid);
    select r.platz into mein_platz from public.liga_rangliste(m.gruppe, false) r where r.user_id = uid;
  end if;
  return jsonb_build_object(
    'liga', lg,
    'woche', wo,
    'ende', wo + 6,
    'stufe', stufe,
    'gruppe', m.gruppe,
    'platz', mein_platz,
    'n', (k ->> 'gruppe_groesse')::integer,
    'mitglieder', liste,
    'belohnung', k -> 'belohnung',
    'bot_ki', jsonb_build_object('genutzt', public.liga_bot_ki_genutzt_in(uid, wo, lg),
      'max', (k ->> 'bot_ki_wochen_max')::integer),
    'offen', coalesce((select jsonb_agg(jsonb_build_object('woche', x.woche, 'platz', x.platz, 'art', x.art, 'menge', x.menge)
                         order by x.woche, x.art)
                       from public.liga_belohnungen x where x.user_id = uid and not x.ausgezahlt and x.liga = lg),
                      '[]'::jsonb)
  );
end;
$$;

-- alte Namen: Online-Liga, Antwort wie bisher (ohne das Feld liga)
create or replace function public.kronen_mein_stand()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.liga_stand('online') - 'liga';
$$;

create or replace function public.liga_meine_gruppe()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.liga_gruppe('online') - 'liga';
$$;

-- ---------- Sofort-Suche Online ----------

-- Paart mit dem Wartenden der Ranked-Zeit, dessen Elo am naechsten liegt (bei Gleichstand der laenger Wartende). Die
-- Elo bestimmt nur die Reihenfolge: zwei Suchende werden immer gepaart, egal wie weit ihre Elo auseinander liegt.
create or replace function public.online_suche_paaren(uid uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ich public.suche_warteschlange;
  g public.suche_warteschlange;
  minuten integer;
  zuschlag integer;
  w uuid;
  s uuid;
  p uuid;
begin
  select * into ich from public.suche_warteschlange q where q.user_id = uid for update skip locked;
  if ich.user_id is null then
    return null;
  end if;
  select * into g from public.suche_warteschlange q
  where q.user_id <> uid and q.zeit = ich.zeit
  order by abs(q.elo - ich.elo), q.seit
  limit 1
  for update skip locked;
  if g.user_id is null then
    return null;
  end if;
  minuten := split_part(ich.zeit, '+', 1)::integer;
  zuschlag := split_part(ich.zeit, '+', 2)::integer;
  if random() < 0.5 then
    w := uid; s := g.user_id;
  else
    w := g.user_id; s := uid;
  end if;
  insert into public.partien_online (erstellt_von, fen, bedenkzeit_s, inkrement_s)
  values (g.user_id, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', minuten * 60, zuschlag)
  returning id into p;
  update public.partien_online t
  set weiss = w, schwarz = s, gewertet = true, status = 'laeuft', am_zug = 'w', letzter_zug_am = clock_timestamp(),
      remis_angebot = null
  where t.id = p;
  delete from public.suche_warteschlange q where q.user_id in (uid, g.user_id);
  return p;
end;
$$;

-- Antwort waehrend des Wartens: { wartet, seit, warte_s, ki_ab_s, zeit } (seit ist Serverzeit). Nur intern.
create or replace function public.online_suche_warten(uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('wartet', true, 'seit', q.seit,
    'warte_s', (public.kronen_konstanten() ->> 'mensch_warte_s')::integer,
    'ki_ab_s', (public.kronen_konstanten() ->> 'ki_frueh_s')::integer,
    'zeit', public.kronen_konstanten() ->> 'ranked_zeit')
  from public.suche_warteschlange q where q.user_id = uid;
$$;

-- Suche starten (oder fortsetzen). Gepaart wird immer in ranked_zeit; zeit darf fehlen und wird, wenn angegeben, nur auf
-- die bisherige Form geprueft (alte App-Staende schicken '3+2' und finden so neue). Antwort { partie } oder
-- { wartet, seit, warte_s, ki_ab_s, zeit }.
drop function if exists public.online_suche_start(text);
create or replace function public.online_suche_start(zeit text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  fest text := public.kronen_konstanten() ->> 'ranked_zeit';
  st public.kronen_stand;
  p uuid;
begin
  if uid is null then
    raise exception 'KRONEN_ANMELDUNG';
  end if;
  if zeit is not null then
    if zeit !~ '^[0-9]{1,3}\+[0-9]{1,2}$' then
      raise exception 'KRONEN_EINGABE';
    end if;
    if split_part(zeit, '+', 1)::integer not between 1 and 180 then
      raise exception 'KRONEN_EINGABE';
    end if;
  end if;
  delete from public.suche_warteschlange q where q.seit < now() - interval '2 minutes';
  delete from public.suche_ki_belege b where b.erstellt_am < now() - interval '6 hours';
  p := public.online_suche_partie(uid);
  if p is not null then
    return jsonb_build_object('partie', p);
  end if;
  st := public.kronen_stand_sichern(uid);
  insert into public.suche_warteschlange as q (user_id, zeit, elo) values (uid, fest, st.elo)
  on conflict (user_id) do update
  set zeit = excluded.zeit, elo = excluded.elo, seit = case when q.zeit = excluded.zeit then q.seit else now() end;
  p := public.online_suche_paaren(uid);
  if p is not null then
    return jsonb_build_object('partie', p);
  end if;
  return public.online_suche_warten(uid);
end;
$$;

create or replace function public.online_suche_stand()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  p uuid;
begin
  if uid is null then
    raise exception 'KRONEN_ANMELDUNG';
  end if;
  p := coalesce(public.online_suche_partie(uid), public.online_suche_paaren(uid));
  if p is not null then
    return jsonb_build_object('partie', p);
  end if;
  return coalesce(public.online_suche_warten(uid), jsonb_build_object('wartet', true));
end;
$$;

-- Suche beenden ("Jetzt gegen KI", nach 30 s von selbst, oder Abbruch). Mit ki = true und mindestens ki_frueh_s Suche
-- ohne Paarung: Beleg { ki_ref } fuer kronen_ki_ergebnis; sonst {} (dann ohne Kronen).
create or replace function public.online_suche_ende(ki boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  seit_war timestamptz;
  r uuid;
begin
  if uid is null then
    raise exception 'KRONEN_ANMELDUNG';
  end if;
  delete from public.suche_warteschlange q where q.user_id = uid returning q.seit into seit_war;
  if ki is true and seit_war is not null
     and seit_war <= now() - make_interval(secs => (public.kronen_konstanten() ->> 'ki_frueh_s')::integer)
     and public.online_suche_partie(uid) is null then
    insert into public.suche_ki_belege (user_id) values (uid) returning ref into r;
    return jsonb_build_object('ki_ref', r);
  end if;
  return '{}'::jsonb;
end;
$$;

-- ---------- Sofort-Suche Raetselduell (Raetsel-Liga) ----------

-- Paart wie online: naechste Raetsel-Elo zuerst, nie ausschliessen
create or replace function public.duell_suche_paaren(uid uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ich public.duell_warteschlange;
  g public.duell_warteschlange;
  d uuid;
begin
  select * into ich from public.duell_warteschlange q where q.user_id = uid for update skip locked;
  if ich.user_id is null then
    return null;
  end if;
  select * into g from public.duell_warteschlange q
  where q.user_id <> uid
  order by abs(q.elo - ich.elo), q.seit
  limit 1
  for update skip locked;
  if g.user_id is null then
    return null;
  end if;
  d := public.duell_anlegen('gewertet', g.user_id, uid, null);
  delete from public.duell_warteschlange q where q.user_id in (uid, g.user_id);
  return d;
end;
$$;

create or replace function public.duell_suche_warten(uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('wartet', true, 'seit', q.seit,
    'warte_s', (public.kronen_konstanten() ->> 'mensch_warte_s')::integer,
    'ki_ab_s', (public.kronen_konstanten() ->> 'ki_frueh_s')::integer)
  from public.duell_warteschlange q where q.user_id = uid;
$$;

-- Suche starten oder fortsetzen (die Wartezeit bleibt). Die Elo ist die Raetsel-Elo. Antwort { duell } oder
-- { wartet, seit, warte_s, ki_ab_s }.
create or replace function public.duell_suche_start()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  rs public.raetsel_stand;
  d uuid;
begin
  if uid is null then
    raise exception 'DUELL_ANMELDUNG';
  end if;
  perform public.duell_faellige_auswerten(uid);
  delete from public.duell_warteschlange q where q.seit < now() - interval '2 minutes';
  d := public.duell_suche_duell(uid);
  if d is not null then
    return jsonb_build_object('duell', d);
  end if;
  rs := public.raetsel_stand_sichern(uid);
  insert into public.duell_warteschlange as q (user_id, elo) values (uid, rs.elo)
  on conflict (user_id) do update set elo = excluded.elo;
  d := public.duell_suche_paaren(uid);
  if d is not null then
    return jsonb_build_object('duell', d);
  end if;
  return public.duell_suche_warten(uid);
end;
$$;

create or replace function public.duell_suche_stand()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  d uuid;
begin
  if uid is null then
    raise exception 'DUELL_ANMELDUNG';
  end if;
  d := coalesce(public.duell_suche_duell(uid), public.duell_suche_paaren(uid));
  if d is not null then
    return jsonb_build_object('duell', d);
  end if;
  return coalesce(public.duell_suche_warten(uid), jsonb_build_object('wartet', true));
end;
$$;

-- Suche beenden. Mit ki = true und mindestens ki_frueh_s Suche ohne Paarung legt der Server ein KI-Duell an: { duell }.
-- Die KI-Staerke ist die eigene Raetsel-Elo (aus der Warteschlange).
create or replace function public.duell_suche_ende(ki boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  seit_war timestamptz;
  elo_war integer;
  d uuid;
begin
  if uid is null then
    raise exception 'DUELL_ANMELDUNG';
  end if;
  perform public.duell_faellige_auswerten(uid);
  delete from public.duell_warteschlange q where q.user_id = uid returning q.seit, q.elo into seit_war, elo_war;
  if ki is true and seit_war is not null
     and seit_war <= now() - make_interval(secs => (public.kronen_konstanten() ->> 'ki_frueh_s')::integer)
     and public.duell_suche_duell(uid) is null then
    d := public.duell_anlegen('ki', uid, null, elo_war);
    return jsonb_build_object('duell', d);
  end if;
  return '{}'::jsonb;
end;
$$;

-- Duell auswerten (wie raetsel-duell-schema.sql); Kronen gehen ueber kronen_einfach_buchen in die Raetsel-Liga, ein
-- gewertetes Duell gegen einen Menschen aendert zusaetzlich die Raetsel-Elo beider (Elo vor der Buchung gelesen).
create or replace function public.duell_auswerten(duell uuid)
returns public.duelle
language plpgsql
security definer
set search_path = ''
as $$
declare
  k jsonb := public.duell_konstanten();
  d public.duelle;
  sa public.duell_spieler;
  sb public.duell_spieler;
  ki jsonb;
  ga integer;
  gb integer;
  fa integer;
  fb integer;
  erg text;
  paar integer;
  elo_a integer;
  elo_b integer;
  pa numeric;
  ba integer;
  bb integer;
  gnade interval := make_interval(secs => (k->>'gnade_s')::integer);
begin
  select * into d from public.duelle x where x.id = duell_auswerten.duell for update;
  if d.id is null or d.status <> 'laeuft' then
    return d;
  end if;
  select * into sa from public.duell_spieler s where s.duell = d.id and s.user_id = d.a for update;
  if d.art = 'ki' then
    ki := public.duell_ki_verlauf(d.seed, d.ki_elo, public.duell_ratings(d), d.dauer_s);
    gb := (ki->>'geloest')::integer;
    fb := (ki->>'fehler')::integer;
    if now() < d.start_am + make_interval(secs => d.dauer_s) + gnade
       or now() < public.duell_ende_am(d.start_am, d.dauer_s, sa.fehler) + gnade then
      return d;
    end if;
  else
    select * into sb from public.duell_spieler s where s.duell = d.id and s.user_id = d.b for update;
    gb := sb.geloest;
    fb := sb.fehler;
    if now() < public.duell_ende_am(d.start_am, d.dauer_s, sa.fehler) + gnade
       or now() < public.duell_ende_am(d.start_am, d.dauer_s, sb.fehler) + gnade then
      return d;
    end if;
  end if;
  ga := sa.geloest;
  fa := sa.fehler;
  erg := case when ga > gb then 'a' when gb > ga then 'b' when fa < fb then 'a' when fb < fa then 'b' else 'remis' end;
  update public.duelle x set status = 'beendet', ergebnis = erg where x.id = d.id returning * into d;
  if d.art = 'freundschaft' then
    return d;
  end if;
  if sa.zuege = 0 or (d.art = 'gewertet' and sb.zuege = 0) then
    return d;
  end if;
  if d.art = 'ki' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('kronen-melden:' || d.a::text));
    if public.kronen_heute_anzahl(d.a, 'duell_ki') < (k->>'ki_tagesgrenze')::integer then
      perform public.kronen_einfach_buchen(d.a, 'duell_ki', d.id::text,
        case erg when 'a' then 'sieg' when 'b' then 'niederlage' else 'remis' end);
    end if;
    return d;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('kronen-melden:' || least(d.a, d.b)::text));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('kronen-melden:' || greatest(d.a, d.b)::text));
  select count(*)::integer into paar from public.kronen_buchungen kb
  join public.duelle x on x.id::text = kb.ref
  where kb.user_id = d.a and kb.quelle = 'duell' and x.id <> d.id and d.b in (x.a, x.b)
    and kb.am >= (public.kronen_heute()::timestamp at time zone 'Europe/Berlin');
  if paar >= (k->>'paar_tagesgrenze')::integer then
    return d;
  end if;
  -- Staende in fester Reihenfolge (kleinere ID zuerst) anlegen und sperren, Elo vor der Buchung lesen
  if d.a < d.b then
    elo_a := (public.raetsel_stand_sichern(d.a)).elo;
    elo_b := (public.raetsel_stand_sichern(d.b)).elo;
  else
    elo_b := (public.raetsel_stand_sichern(d.b)).elo;
    elo_a := (public.raetsel_stand_sichern(d.a)).elo;
  end if;
  pa := case erg when 'a' then 1 when 'b' then 0 else 0.5 end;
  select count(*)::integer into ba from public.kronen_buchungen kb where kb.user_id = d.a and kb.quelle = 'duell' and kb.ref = d.id::text;
  select count(*)::integer into bb from public.kronen_buchungen kb where kb.user_id = d.b and kb.quelle = 'duell' and kb.ref = d.id::text;
  perform public.kronen_einfach_buchen(d.a, 'duell', d.id::text,
    case erg when 'a' then 'sieg' when 'b' then 'niederlage' else 'remis' end);
  perform public.kronen_einfach_buchen(d.b, 'duell', d.id::text,
    case erg when 'b' then 'sieg' when 'a' then 'niederlage' else 'remis' end);
  -- Elo nur bei einer neuen Buchung (je Duell und Konto einmal)
  if ba = 0 then
    perform public.raetsel_elo_buchen(d.a, pa, elo_b);
  end if;
  if bb = 0 then
    perform public.raetsel_elo_buchen(d.b, 1 - pa, elo_a);
  end if;
  return d;
end;
$$;

-- ---------- Rechte ----------
revoke all on function public.liga_pruefen(text) from public, anon, authenticated;
revoke all on function public.liga_der_quelle(text) from public, anon, authenticated;
revoke all on function public.raetsel_stand_sichern(uuid) from public, anon, authenticated;
revoke all on function public.liga_stufe_sichern(uuid, text) from public, anon, authenticated;
revoke all on function public.liga_buchen_in(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.liga_buchen(uuid, integer) from public, anon, authenticated;
revoke all on function public.liga_mein_platz_in(uuid, text) from public, anon, authenticated;
revoke all on function public.liga_mein_platz(uuid) from public, anon, authenticated;
revoke all on function public.liga_bot_ki_genutzt_in(uuid, date, text) from public, anon, authenticated;
revoke all on function public.liga_bot_ki_genutzt(uuid, date) from public, anon, authenticated;
revoke all on function public.kronen_einfach_buchen(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.kronen_online_buchen(uuid, uuid, numeric, integer) from public, anon, authenticated;
revoke all on function public.raetsel_elo_buchen(uuid, numeric, integer) from public, anon, authenticated;
revoke all on function public.liga_abrechnen() from public, anon, authenticated;
revoke all on function public.liga_mitglieder_liste(bigint, uuid) from public, anon, authenticated;
revoke all on function public.liga_stand(text) from public, anon, authenticated;
revoke all on function public.liga_staende() from public, anon, authenticated;
revoke all on function public.liga_gruppe(text) from public, anon, authenticated;
revoke all on function public.kronen_mein_stand() from public, anon, authenticated;
revoke all on function public.liga_meine_gruppe() from public, anon, authenticated;
revoke all on function public.kronen_konstanten() from public, anon, authenticated;
revoke all on function public.online_suche_paaren(uuid) from public, anon, authenticated;
revoke all on function public.online_suche_warten(uuid) from public, anon, authenticated;
revoke all on function public.online_suche_start(text) from public, anon, authenticated;
revoke all on function public.online_suche_stand() from public, anon, authenticated;
revoke all on function public.online_suche_ende(boolean) from public, anon, authenticated;
revoke all on function public.duell_suche_paaren(uuid) from public, anon, authenticated;
revoke all on function public.duell_suche_warten(uuid) from public, anon, authenticated;
revoke all on function public.duell_suche_start() from public, anon, authenticated;
revoke all on function public.duell_suche_stand() from public, anon, authenticated;
revoke all on function public.duell_suche_ende(boolean) from public, anon, authenticated;
revoke all on function public.duell_auswerten(uuid) from public, anon, authenticated;
grant execute on function public.liga_stand(text) to authenticated;
grant execute on function public.liga_staende() to authenticated;
grant execute on function public.liga_gruppe(text) to authenticated;
grant execute on function public.kronen_mein_stand() to authenticated;
grant execute on function public.liga_meine_gruppe() to authenticated;
grant execute on function public.kronen_konstanten() to authenticated;
grant execute on function public.online_suche_start(text) to authenticated;
grant execute on function public.online_suche_stand() to authenticated;
grant execute on function public.online_suche_ende(boolean) to authenticated;
grant execute on function public.duell_suche_start() to authenticated;
grant execute on function public.duell_suche_stand() to authenticated;
grant execute on function public.duell_suche_ende(boolean) to authenticated;

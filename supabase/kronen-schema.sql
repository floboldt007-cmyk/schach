-- Liga mit Kronen, Etappe B: Stufe, Wochen-Gruppen, Buchungen, Belohnungen und Schalter.
-- Plan: docs/superpowers/plans/2026-11-07-etappe-b-liga-kronen.md (Abschnitt "Umbau Wochen-Gruppen 07.11."). Die Zahlen
-- stehen gleich in js/pakete/liga/kronen.js (Vertragstest tests/kronen-vertrag.test.mjs).
--
-- Liga neu (Flo 07.11.2026, Konzept Abschnitt 5a): 18 Stufen, die Ligen heissen wie Figuren (Bauer, Springer, Laeufer,
-- Turm, Dame, Koenig, je III, II, I; Farben Holz bis Krone). Jede Woche (Montag 00:00 bis Sonntag 24:00, Europe/Berlin,
-- Serverzeit) spielt man in einer Gruppe von 30 derselben Stufe; gezaehlt werden die Kronen der Woche. Platz 1 bis 5
-- steigen eine Stufe auf, die letzten 5 eine ab. Leere Plaetze fuellen Bots mit KI-Kennzeichen (virtuell, ohne Zeilen,
-- fest aus der Gruppen-Saat). In eine Gruppe kommt ein Konto mit der ersten Buchung der Woche (Flo 07.11.2026), nie beim
-- blossen Lesen. Je Platz gibt es eine Belohnung (Banner, Taler); der Server merkt sie sich in liga_belohnungen,
-- ausgezahlt wird, sobald es Taler und eine Banner-Sammlung gibt (Flo 07.11.2026). Die 4-Wochen-Saison entfaellt.
-- Abrechnung ohne Cron und ohne Edge Function: jeder Aufruf rechnet zuerst alle Gruppen frueherer Wochen ab, die noch
-- offen sind (liga_abrechnen, nacheinander und nur einmal).
--
-- Der Server entscheidet: Nutzer haben keine Tabellenrechte, sie lesen nur ueber kronen_mein_stand() und
-- liga_meine_gruppe(). Einspielen: nach supabase/online-schema.sql im SQL Editor ausfuehren. Wiederholbar.
-- Pruefen: supabase/kronen-rls-test.sql (rollt am Ende alles zurueck). Rueckweg: supabase/kronen-zurueck.sql.
-- Fast rein additiv: neue Tabellen und Funktionen. Einzige Aenderung an Bestehendem: die Spalte
-- partien_online.gewertet (Vorgabe false, alte Zeilen bleiben ungewertet) und der Trigger kronen_nach_partie darauf.

create table if not exists public.kronen_schalter (
  id boolean primary key default true,
  zaehler_an boolean not null default false,
  constraint kronen_schalter_eine_zeile check (id)
);
insert into public.kronen_schalter (id) values (true) on conflict (id) do nothing;

-- stufe 0 (Bauer III) bis 17 (Koenig I); kronen ist die Summe aller Wochen (nie unter 0, nur fuer das Profil)
create table if not exists public.kronen_stand (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stufe integer not null default 0,
  kronen integer not null default 0,
  elo integer not null default 1000,
  elo_n integer not null default 0,
  start_gesetzt boolean not null default false,
  aktualisiert_am timestamptz not null default now(),
  constraint kronen_stand_stufe check (stufe between 0 and 17),
  constraint kronen_stand_kronen check (kronen >= 0),
  constraint kronen_stand_elo check (elo between 100 and 4000),
  constraint kronen_stand_elo_n check (elo_n >= 0)
);

create table if not exists public.kronen_buchungen (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  quelle text not null,
  ref text not null,
  delta integer not null,
  woche date not null,
  am timestamptz not null default now(),
  constraint kronen_buchungen_quelle check (quelle in ('online', 'ki', 'bot', 'start', 'duell', 'duell_ki')),
  constraint kronen_buchungen_ref check (char_length(ref) between 1 and 64),
  -- jede Partie und jeder Beleg wird je Konto hoechstens einmal gebucht
  constraint kronen_buchungen_einmal unique (user_id, quelle, ref)
);
-- Etappe 5 (Raetsel-Duell, supabase/raetsel-duell-schema.sql) bucht als 'duell' und 'duell_ki'. Fuer schon
-- eingespielte Tabellen wird die Pruefung hier ersetzt (wiederholbar; alte Zeilen erfuellen sie weiter).
alter table public.kronen_buchungen drop constraint if exists kronen_buchungen_quelle;
alter table public.kronen_buchungen add constraint kronen_buchungen_quelle
  check (quelle in ('online', 'ki', 'bot', 'start', 'duell', 'duell_ki'));
-- fuer die Tagesgrenzen: Buchungen je Konto, Quelle und Zeit
create index if not exists kronen_buchungen_tag on public.kronen_buchungen (user_id, quelle, am);

-- Eine Gruppe je Woche und Stufe, bei Bedarf mehrere (je 30 Menschen). saat macht die Bots fest (Namen, Wochenziel).
create table if not exists public.liga_gruppen (
  id bigserial primary key,
  woche date not null,
  stufe integer not null,
  saat integer not null default (floor(random() * 2147483647))::integer,
  abgerechnet boolean not null default false,
  angelegt_am timestamptz not null default now(),
  constraint liga_gruppen_stufe check (stufe between 0 and 17),
  constraint liga_gruppen_saat check (saat >= 0),
  constraint liga_gruppen_montag check (extract(isodow from woche) = 1)
);
create index if not exists liga_gruppen_woche on public.liga_gruppen (woche, stufe, abgerechnet);

-- kronen sind die Kronen dieser Woche (nie unter 0); je Konto und Woche genau eine Gruppe
create table if not exists public.liga_mitglieder (
  gruppe bigint not null references public.liga_gruppen (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  woche date not null,
  kronen integer not null default 0,
  beigetreten timestamptz not null default now(),
  primary key (gruppe, user_id),
  constraint liga_mitglieder_einmal unique (user_id, woche),
  constraint liga_mitglieder_kronen check (kronen >= 0)
);

-- Belohnung je Woche und Art (Platz-Belohnung, dazu ein Banner beim ersten Aufstieg in eine Liga); ausgezahlt kommt spaeter
create table if not exists public.liga_belohnungen (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  woche date not null,
  stufe integer not null,
  platz integer not null,
  art text not null,
  menge integer not null,
  ausgezahlt boolean not null default false,
  constraint liga_belohnungen_art check (art in ('banner', 'taler', 'aufstieg-banner')),
  constraint liga_belohnungen_einmal unique (user_id, woche, art)
);

alter table public.kronen_schalter enable row level security;
alter table public.kronen_stand enable row level security;
alter table public.kronen_buchungen enable row level security;
alter table public.liga_gruppen enable row level security;
alter table public.liga_mitglieder enable row level security;
alter table public.liga_belohnungen enable row level security;
-- keine Policies: ohne Policy sieht ein Nutzer keine Zeile; dazu kein Tabellenrecht (Supabase vergibt sonst Standardrechte)
revoke all on table public.kronen_schalter, public.kronen_stand, public.kronen_buchungen, public.liga_gruppen,
  public.liga_mitglieder, public.liga_belohnungen from anon, authenticated, public;
revoke all on sequence public.kronen_buchungen_id_seq, public.liga_gruppen_id_seq, public.liga_belohnungen_id_seq
  from anon, authenticated, public;

-- Alle Zahlen an einer Stelle (Vertragstest mit js/pakete/liga/kronen.js)
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
    -- Bot- und KI-Gewinne zusammen je Woche und Konto (Flo 07.11.2026, Schummel-Schutz), Online-Kronen frei
    'bot_ki_wochen_max', 300,
    'ki_mindestdauer_s', 60,
    'online_mindest_halbzuege', 4,
    'paar_tagesgrenze', 3,
    'klassen_grenzen', jsonb_build_array(0, 1000, 1200, 1400, 1600, 1900),
    'start_elo_min', 400,
    'start_elo_max', 2800,
    -- Start hoechstens Laeufer III (Flo 07.11.2026): die Geraete-Elo ist nur eine Behauptung des Clients
    'start_hoechste_liga', 2,
    -- Wochen-Gruppen (Flo 07.11.2026): 30 Plaetze, 5 auf, 5 ab
    'gruppe_groesse', 30,
    'aufstieg_plaetze', 5,
    'abstieg_plaetze', 5,
    -- Belohnung je Platz (Claudes Annahme 07.11.2026, Flo kann sie aendern): Platz 1 Banner, dann fallende Taler-Stapel
    'belohnung', jsonb_build_array(
      jsonb_build_object('von', 1, 'bis', 1, 'art', 'banner', 'menge', 1),
      jsonb_build_object('von', 2, 'bis', 2, 'art', 'taler', 'menge', 120),
      jsonb_build_object('von', 3, 'bis', 3, 'art', 'taler', 'menge', 100),
      jsonb_build_object('von', 4, 'bis', 5, 'art', 'taler', 'menge', 80),
      jsonb_build_object('von', 6, 'bis', 10, 'art', 'taler', 'menge', 40),
      jsonb_build_object('von', 11, 'bis', 20, 'art', 'taler', 'menge', 20)
    ),
    -- Wochenziel eines Bots: 0 bis zu diesem Wert, je Liga (Bauer bis Koenig); nach den ersten Wochen nachschaerfen
    'bot_ziel_max', jsonb_build_array(150, 250, 350, 450, 600, 800)
  );
$$;

-- heute in Europe/Berlin (Serverzeit, nie Geraetezeit)
create or replace function public.kronen_heute()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Berlin')::date;
$$;

-- Montag der Woche eines Zeitpunkts (Europe/Berlin); Sonntag 23:59 gehoert zur alten, Montag 00:00 zur neuen Woche
create or replace function public.liga_woche_am(t timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select (date_trunc('week', t at time zone 'Europe/Berlin'))::date;
$$;

create or replace function public.liga_woche_heute()
returns date
language sql
stable
set search_path = ''
as $$
  select public.liga_woche_am(now());
$$;

-- Wie viel der Woche schon vergangen ist, 0 bis 1 (fuer die Bot-Kronen); fruehere Wochen sind 1
create or replace function public.liga_wochen_anteil(woche date)
returns numeric
language sql
stable
set search_path = ''
as $$
  select least(1, greatest(0,
    extract(epoch from ((now() at time zone 'Europe/Berlin') - woche::timestamp)) / 604800.0))::numeric;
$$;

-- Bots einer Gruppe: so viele, wie Menschen fehlen (Nummern 1 bis 30 - n). Name und Wochenziel kommen fest aus der
-- Saat; 30 Namen und Schritt 7 (teilerfremd zu 30) geben in einer Gruppe nie zweimal denselben Namen. voll = Wochenende
-- (volles Ziel, fuer die Abrechnung), sonst der Anteil der vergangenen Woche.
create or replace function public.liga_bots(gid bigint, voll boolean)
returns table (nr integer, name text, kronen integer)
language sql
stable
security definer
set search_path = ''
as $$
  with g as (select * from public.liga_gruppen x where x.id = gid),
  k as (select public.kronen_konstanten() as w),
  n as (select count(*)::integer as menschen from public.liga_mitglieder m where m.gruppe = gid)
  select s.nr,
    (array['Ada', 'Bela', 'Cleo', 'Dario', 'Emil', 'Fiona', 'Greta', 'Hugo', 'Ida', 'Jonas', 'Kira', 'Luca', 'Mila',
      'Nils', 'Olga', 'Paul', 'Quinn', 'Rosa', 'Sven', 'Tilda', 'Udo', 'Vera', 'Wim', 'Xenia', 'Yuri', 'Zora', 'Arne',
      'Bruno', 'Carla', 'Dina'])[1 + ((g.saat::bigint + s.nr * 7) % 30)::integer],
    round((case when voll then 1 else public.liga_wochen_anteil(g.woche) end)
      * (abs(pg_catalog.hashtext(g.saat::text || ':' || s.nr::text)::bigint)
         % (((k.w -> 'bot_ziel_max') ->> (g.stufe / 3))::integer + 1)))::integer
  from g, k, n, generate_series(1, greatest(0, (k.w ->> 'gruppe_groesse')::integer - n.menschen)) as s(nr);
$$;

-- Rangliste einer Gruppe: Kronen absteigend, bei Gleichstand Menschen vor Bots, dann der fruehere Beitritt
create or replace function public.liga_rangliste(gid bigint, voll boolean)
returns table (platz integer, user_id uuid, nr integer, kronen integer, ki boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select (row_number() over (order by r.kronen desc, r.ki, r.beigetreten, r.nr))::integer, r.user_id, r.nr, r.kronen, r.ki
  from (
    select m.user_id, null::integer as nr, m.kronen, false as ki, m.beigetreten
    from public.liga_mitglieder m where m.gruppe = gid
    union all
    select null::uuid, b.nr, b.kronen, true, null::timestamptz from public.liga_bots(gid, voll) b
  ) r;
$$;

-- Aufbewahrung (Flo 08.11.2026): Wochen-Gruppen (liga_gruppen), die Plaetze darin (liga_mitglieder) und die
-- Belohnungen (liga_belohnungen, auch nicht ausgezahlte) von Wochen, die mehr als 52 Wochen vor der laufenden Woche
-- liegen, werden geloescht. Der Stand (kronen_stand) bleibt, ebenso die Buchungen (kronen_buchungen): kronen_start
-- erkennt an ihnen, dass ein Konto schon gespielt hat, wenn start_gesetzt noch false ist. Vorher bekommt jedes
-- betroffene Konto ueber karte_sichern (falls karte-schema.sql eingespielt ist) seine Erfolgs-Stufen aus diesen Wochen
-- und die noch nicht ausgezahlten Banner. Nur abgerechnete Gruppen. Laeuft am Ende jeder Wochen-Abrechnung und, falls
-- pg_cron eingeschaltet ist, zusaetzlich taeglich (unten). Wiederholbar. Antwort: geloeschte Zeilen je Tabelle.
create index if not exists liga_belohnungen_woche on public.liga_belohnungen (woche);

create or replace function public.liga_alte_wochen_loeschen()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  grenze date := public.liga_woche_heute() - 52 * 7;
  uid uuid;
  n_gruppen integer;
  n_plaetze integer;
  n_belohnungen integer;
  n_offen integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('liga-abrechnen'));
  if pg_catalog.to_regprocedure('public.karte_sichern(uuid)') is not null then
    for uid in
      select m.user_id from public.liga_mitglieder m join public.liga_gruppen g on g.id = m.gruppe
      where g.woche < grenze and g.abgerechnet
      union
      select l.user_id from public.liga_belohnungen l where l.woche < grenze and not l.ausgezahlt
    loop
      perform public.karte_sichern(uid);
    end loop;
  end if;
  select count(*)::integer into n_plaetze from public.liga_mitglieder m join public.liga_gruppen g on g.id = m.gruppe
  where g.woche < grenze and g.abgerechnet;
  select count(*)::integer into n_offen from public.liga_belohnungen l where l.woche < grenze and not l.ausgezahlt;
  delete from public.liga_belohnungen l where l.woche < grenze;
  get diagnostics n_belohnungen = row_count;
  -- die Plaetze gehen mit der Gruppe (on delete cascade)
  delete from public.liga_gruppen g where g.woche < grenze and g.abgerechnet;
  get diagnostics n_gruppen = row_count;
  return jsonb_build_object('gruppen', n_gruppen, 'plaetze', n_plaetze, 'belohnungen', n_belohnungen,
    'davon_nicht_ausgezahlt', n_offen);
end;
$$;

revoke all on function public.liga_alte_wochen_loeschen() from public, anon, authenticated, service_role;

-- Rechnet alle Gruppen frueherer Wochen ab, die noch offen sind: Platz 1 bis 5 eine Stufe auf (hoechstens Koenig I),
-- die letzten 5 eine ab (nie unter Bauer III), Bots zaehlen mit (volles Wochenziel). Je Mensch die Platz-Belohnung,
-- beim ersten Aufstieg in eine neue Liga dazu ein Banner. Nacheinander (Sperre) und je Gruppe genau einmal.
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
      update public.kronen_stand s set stufe = neu, aktualisiert_am = now() where s.user_id = r.user_id;
      select e into b from jsonb_array_elements(k -> 'belohnung') e
      where r.platz between (e ->> 'von')::integer and (e ->> 'bis')::integer limit 1;
      if b is not null then
        insert into public.liga_belohnungen (user_id, woche, stufe, platz, art, menge)
        values (r.user_id, g.woche, g.stufe, r.platz, b ->> 'art', (b ->> 'menge')::integer)
        on conflict on constraint liga_belohnungen_einmal do nothing;
      end if;
      -- erster Aufstieg in eine neue Liga (Stufe III der naechsten Figur): ein Banner, je Liga nur einmal im Leben
      if neu > g.stufe and neu % 3 = 0 and not exists (
        select 1 from public.liga_belohnungen x
        where x.user_id = r.user_id and x.art = 'aufstieg-banner' and x.stufe = neu) then
        insert into public.liga_belohnungen (user_id, woche, stufe, platz, art, menge)
        values (r.user_id, g.woche, neu, r.platz, 'aufstieg-banner', 1)
        on conflict on constraint liga_belohnungen_einmal do nothing;
      end if;
      -- Banner gleich in die Sammlung (karte-schema.sql, falls eingespielt; sonst holt karte_sichern sie spaeter nach)
      if pg_catalog.to_regprocedure('public.karte_liga_banner_nachtragen(uuid)') is not null then
        perform public.karte_liga_banner_nachtragen(r.user_id);
      end if;
    end loop;
    update public.liga_gruppen x set abgerechnet = true where x.id = g.id;
  end loop;
  -- einmal je neuer Woche: Wochen ueber 52 Wochen zurueck loeschen (Aufbewahrung oben)
  perform public.liga_alte_wochen_loeschen();
end;
$$;

-- Legt den Stand eines Kontos an, nachdem faellige Wochen abgerechnet sind. Nur intern.
create or replace function public.kronen_stand_sichern(uid uuid)
returns public.kronen_stand
language plpgsql
security definer
set search_path = ''
as $$
declare
  st public.kronen_stand;
begin
  if uid is null then
    raise exception 'KRONEN_ANMELDUNG';
  end if;
  perform public.liga_abrechnen();
  insert into public.kronen_stand (user_id) values (uid) on conflict (user_id) do nothing;
  select * into st from public.kronen_stand k where k.user_id = uid for update;
  return st;
end;
$$;

-- Bucht eine Aenderung in die Gruppe dieser Woche; ohne Gruppe tritt das Konto der aeltesten Gruppe seiner Stufe mit
-- weniger als 30 Menschen bei (sonst einer neuen). Sperre je Woche und Stufe: nie 31 Menschen in einer Gruppe.
-- Antwort: die tatsaechliche Aenderung der Wochen-Kronen. Nur intern, nach kronen_stand_sichern (Stand gesperrt).
create or replace function public.liga_buchen(uid uuid, nominal integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Uhrzeit des Aufrufs, nicht des Transaktionsbeginns: eine Partie, die Sonntag 23:59 beginnt und Montag endet,
  -- bucht in die neue Woche (die alte ist dann womoeglich schon abgerechnet)
  wo date := public.liga_woche_am(pg_catalog.clock_timestamp());
  st public.kronen_stand;
  m public.liga_mitglieder;
  gid bigint;
  neu integer;
  fertig boolean;
begin
  select * into st from public.kronen_stand k where k.user_id = uid;
  select * into m from public.liga_mitglieder x where x.user_id = uid and x.woche = wo for update;
  if m.gruppe is null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('liga-gruppe:' || wo::text || ':' || st.stufe::text));
    select g.id into gid from public.liga_gruppen g
    where g.woche = wo and g.stufe = st.stufe and not g.abgerechnet
      and (select count(*) from public.liga_mitglieder x where x.gruppe = g.id)
          < (public.kronen_konstanten() ->> 'gruppe_groesse')::integer
    order by g.id limit 1;
    if gid is null then
      insert into public.liga_gruppen (woche, stufe) values (wo, st.stufe) returning id into gid;
    end if;
    insert into public.liga_mitglieder (gruppe, user_id, woche) values (gid, uid, wo) returning * into m;
  end if;
  -- Gemeinsame Sperre gegen liga_abrechnen (die sperrt die Gruppe for update): nie in eine schon abgerechnete Gruppe
  select g.abgerechnet into fertig from public.liga_gruppen g where g.id = m.gruppe for share;
  if fertig then
    return 0;
  end if;
  neu := greatest(0, m.kronen + nominal);
  update public.liga_mitglieder x set kronen = neu where x.gruppe = m.gruppe and x.user_id = uid;
  update public.kronen_stand s set kronen = greatest(0, s.kronen + (neu - m.kronen)), aktualisiert_am = now()
  where s.user_id = uid;
  return neu - m.kronen;
end;
$$;

-- Platz und Wochen-Kronen eines Kontos in dieser Woche (null ohne Gruppe), dazu ziel: die Kronen auf dem letzten
-- Aufstiegsplatz (Platz 5) der Gruppe, daran fuellt sich der Ring der Startseite. Nur intern.
create or replace function public.liga_mein_platz(uid uuid)
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
  from public.liga_mitglieder m where m.user_id = uid and m.woche = public.liga_woche_heute();
$$;

-- Der eigene Stand fuer die App (Startseite, Lobby): Stufe, Wochen-Kronen, Platz von n und ziel (Kronen auf Platz 5);
-- ohne Gruppe platz und ziel null
create or replace function public.kronen_mein_stand()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  st public.kronen_stand;
  p jsonb;
begin
  st := public.kronen_stand_sichern(auth.uid());
  p := public.liga_mein_platz(st.user_id);
  return jsonb_build_object(
    'stufe', st.stufe,
    'kronen', coalesce((p ->> 'kronen')::integer, 0),
    'platz', (p ->> 'platz')::integer,
    'ziel', (p ->> 'ziel')::integer,
    'n', (public.kronen_konstanten() ->> 'gruppe_groesse')::integer,
    'woche', public.liga_woche_heute()
  );
end;
$$;

-- Name eines Mitglieds: Benutzername aus profile (nie die E-Mail); ohne Tabelle oder Namen null (die App zeigt "Spieler")
create or replace function public.liga_name(uid uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n text;
begin
  if to_regclass('public.profile') is null then
    return null;
  end if;
  execute 'select benutzername from public.profile where user_id = $1' into n using uid;
  return n;
end;
$$;

-- Die eigene Gruppe dieser Woche fuer den Liga-Reiter: { woche, ende, stufe, gruppe, platz, n, mitglieder, belohnung,
-- offen }. mitglieder [{ platz, name, kronen, ki, ich }] in Rangfolge; ohne Gruppe gruppe null und mitglieder [].
-- offen sind gemerkte, noch nicht ausgezahlte Belohnungen [{ woche, platz, art, menge }].
create or replace function public.liga_meine_gruppe()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  st public.kronen_stand;
  k jsonb := public.kronen_konstanten();
  wo date := public.liga_woche_heute();
  m public.liga_mitglieder;
  liste jsonb := '[]'::jsonb;
  mein_platz integer;
begin
  st := public.kronen_stand_sichern(auth.uid());
  select * into m from public.liga_mitglieder x where x.user_id = st.user_id and x.woche = wo;
  if m.gruppe is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
        'platz', r.platz,
        'name', case when r.ki then b.name else public.liga_name(r.user_id) end,
        'kronen', r.kronen, 'ki', r.ki, 'ich', r.user_id is not distinct from st.user_id) order by r.platz), '[]'::jsonb)
      into liste
    from public.liga_rangliste(m.gruppe, false) r
    left join public.liga_bots(m.gruppe, false) b on r.ki and b.nr = r.nr;
    select r.platz into mein_platz from public.liga_rangliste(m.gruppe, false) r where r.user_id = st.user_id;
  end if;
  return jsonb_build_object(
    'woche', wo,
    'ende', wo + 6,
    'stufe', st.stufe,
    'gruppe', m.gruppe,
    'platz', mein_platz,
    'n', (k ->> 'gruppe_groesse')::integer,
    'mitglieder', liste,
    'belohnung', k -> 'belohnung',
    -- Schummel-Schutz: Bot- und KI-Gewinne dieser Woche gegen den Deckel (der Client zeigt "diese Woche voll")
    'bot_ki', jsonb_build_object('genutzt', public.liga_bot_ki_genutzt(st.user_id, wo),
      'max', (k ->> 'bot_ki_wochen_max')::integer),
    'offen', coalesce((select jsonb_agg(jsonb_build_object('woche', x.woche, 'platz', x.platz, 'art', x.art, 'menge', x.menge)
                         order by x.woche, x.art)
                       from public.liga_belohnungen x where x.user_id = st.user_id and not x.ausgezahlt), '[]'::jsonb)
  );
end;
$$;

-- Rechte: alles zu, nur Stand, Gruppe und Konstanten fuer angemeldete Nutzer
revoke all on function public.kronen_konstanten() from public, anon, authenticated;
revoke all on function public.kronen_heute() from public, anon, authenticated;
revoke all on function public.liga_woche_am(timestamptz) from public, anon, authenticated;
revoke all on function public.liga_woche_heute() from public, anon, authenticated;
revoke all on function public.liga_wochen_anteil(date) from public, anon, authenticated;
revoke all on function public.liga_bots(bigint, boolean) from public, anon, authenticated;
revoke all on function public.liga_rangliste(bigint, boolean) from public, anon, authenticated;
revoke all on function public.liga_abrechnen() from public, anon, authenticated;
revoke all on function public.kronen_stand_sichern(uuid) from public, anon, authenticated;
revoke all on function public.liga_buchen(uuid, integer) from public, anon, authenticated;
revoke all on function public.liga_mein_platz(uuid) from public, anon, authenticated;
revoke all on function public.liga_name(uuid) from public, anon, authenticated;
revoke all on function public.kronen_mein_stand() from public, anon, authenticated;
revoke all on function public.liga_meine_gruppe() from public, anon, authenticated;
grant execute on function public.kronen_mein_stand() to authenticated;
grant execute on function public.liga_meine_gruppe() to authenticated;
grant execute on function public.kronen_konstanten() to authenticated;

-- ---------- Task 3: Online-Ergebnis bucht Kronen und Elo ----------
-- Nur Partien aus der Gegnersuche (Task 4) zaehlen; Einladungs-Partien unter Freunden bleiben ohne Kronen.
-- Einzige Aenderung an einer bestehenden Tabelle; Rueckweg in kronen-zurueck.sql.
alter table public.partien_online add column if not exists gewertet boolean not null default false;

-- Bucht eine Online-Partie fuer einen Spieler: Kronen in die Wochen-Gruppe (liga_buchen), Elo neu. Je Partie und Konto
-- hoechstens einmal (kronen_buchungen_einmal); nur bei einer neuen Buchung aendert sich der Stand. In der Buchung steht
-- die tatsaechliche Aenderung der Wochen-Kronen (bei 0 Kronen ist eine Niederlage eine Buchung mit 0).
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
  -- Zahlen aus kronen_konstanten (eine Quelle, Vertragstest mit js/pakete/liga/kronen.js)
  nominal := (public.kronen_konstanten() #>> array['kronen', 'online',
    case punkte when 1 then 'sieg' when 0 then 'niederlage' else 'remis' end])::integer;
  insert into public.kronen_buchungen (user_id, quelle, ref, delta, woche)
  values (uid, 'online', partie::text, 0, public.liga_woche_heute())
  on conflict (user_id, quelle, ref) do nothing;
  get diagnostics gebucht = row_count;
  if gebucht = 0 then
    return;
  end if;
  update public.kronen_buchungen b set delta = public.liga_buchen(uid, nominal)
  where b.user_id = uid and b.quelle = 'online' and b.ref = partie::text;
  k := case when st.elo_n < 15 then 40 else 32 end;
  erwartet := 1 / (1 + power(10::numeric, (gegner_elo - st.elo)::numeric / 400));
  neu_elo := least(4000, greatest(100, st.elo + round(k * (punkte - erwartet))::integer));
  update public.kronen_stand s
  set elo = neu_elo, elo_n = st.elo_n + 1, aktualisiert_am = now()
  where s.user_id = uid;
end;
$$;

-- Trigger-Funktion: beide Elo-Werte werden VOR der ersten Buchung gelesen, damit B gegen den alten Wert von A rechnet.
-- Schutz gegen Absprache zweier Konten (Task 3b): Partien mit weniger als 4 Halbzuegen (sofort aufgeben, Remis
-- annehmen, Zeit ablaufen lassen) und ab der 4. gewerteten Partie am Tag gegen denselben Gegner bleiben ohne Kronen
-- und Elo. Die Partie selbst bleibt beendet und im Verlauf.
create or replace function public.kronen_bei_partie_ende()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  elo_w integer;
  elo_s integer;
  punkte_w numeric;
  konst jsonb := public.kronen_konstanten();
  halbzuege integer;
  heute_paar integer;
begin
  if new.weiss is null or new.schwarz is null then
    return null;
  end if;
  halbzuege := case when new.zuege = '' then 0 else array_length(string_to_array(new.zuege, ' '), 1) end;
  if halbzuege < (konst->>'online_mindest_halbzuege')::integer then
    return null;
  end if;
  -- je Paar nacheinander, damit zwei gleichzeitig endende Partien nicht beide als dritte zaehlen
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('kronen-paar:' || least(new.weiss, new.schwarz)::text
    || ':' || greatest(new.weiss, new.schwarz)::text));
  select count(*) into heute_paar
  from public.kronen_buchungen b
  join public.partien_online p on p.id::text = b.ref
  where b.user_id = new.weiss and b.quelle = 'online' and p.id <> new.id
    and (p.weiss = new.schwarz or p.schwarz = new.schwarz)
    and (b.am at time zone 'Europe/Berlin')::date = public.kronen_heute();
  if heute_paar >= (konst->>'paar_tagesgrenze')::integer then
    return null;
  end if;
  -- Kronen sind Beiwerk: ein Fehler (auch ein Deadlock) nimmt nur die Buchung zurueck, nie das Partieende.
  -- Staende immer in fester Reihenfolge (kleinere ID zuerst) sperren, damit sich Partien nicht gegenseitig blockieren.
  begin
    if new.weiss < new.schwarz then
      elo_w := (public.kronen_stand_sichern(new.weiss)).elo;
      elo_s := (public.kronen_stand_sichern(new.schwarz)).elo;
    else
      elo_s := (public.kronen_stand_sichern(new.schwarz)).elo;
      elo_w := (public.kronen_stand_sichern(new.weiss)).elo;
    end if;
    punkte_w := case new.ergebnis when '1-0' then 1 when '0-1' then 0 else 0.5 end;
    perform public.kronen_online_buchen(new.weiss, new.id, punkte_w, elo_s);
    perform public.kronen_online_buchen(new.schwarz, new.id, 1 - punkte_w, elo_w);
  exception when others then
    raise warning 'kronen_bei_partie_ende %: %', new.id, sqlerrm;
  end;
  return null;
end;
$$;

-- Abgebrochene und strittige Partien (ergebnis null) und Einladungs-Partien (gewertet false) feuern gar nicht
drop trigger if exists kronen_nach_partie on public.partien_online;
create trigger kronen_nach_partie
after update of status on public.partien_online
for each row
when (new.status = 'beendet' and old.status <> 'beendet' and new.gewertet and new.ergebnis is not null)
execute function public.kronen_bei_partie_ende();

revoke all on function public.kronen_online_buchen(uuid, uuid, numeric, integer) from public, anon, authenticated;
revoke all on function public.kronen_bei_partie_ende() from public, anon, authenticated;

-- ---------- Task 4: Gegnersuche, Bot nach 10 Sekunden als KI-Gegner ----------
-- Wer sucht, steht hier (eine Zeile je Konto). Nur intern: Nutzer suchen ueber online_suche_start/_stand/_ende.
create table if not exists public.suche_warteschlange (
  user_id uuid primary key references auth.users (id) on delete cascade,
  zeit text not null,
  elo integer not null,
  seit timestamptz not null default now(),
  -- Minuten + Zuschlag in Sekunden, z. B. '3+2'
  constraint suche_warteschlange_zeit check (zeit ~ '^[0-9]{1,3}\+[0-9]{1,2}$')
);
create index if not exists suche_warteschlange_zeit_seit on public.suche_warteschlange (zeit, seit);

-- Beleg fuer einen KI-Gegner: nur wer wirklich mindestens 10 s ohne Treffer gesucht hat, bekommt einen; Task 5 bucht
-- KI-Ergebnisse nur gegen einen solchen Beleg (Mindestdauer, Tagesgrenze). Belege verfallen nach 6 Stunden.
create table if not exists public.suche_ki_belege (
  ref uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  erstellt_am timestamptz not null default now(),
  eingeloest boolean not null default false
);
create index if not exists suche_ki_belege_user on public.suche_ki_belege (user_id, erstellt_am);

alter table public.suche_warteschlange enable row level security;
alter table public.suche_ki_belege enable row level security;
revoke all on table public.suche_warteschlange, public.suche_ki_belege from anon, authenticated, public;

-- Gewertete laufende Partie, in die das Konto in den letzten 60 s gepaart wurde (sonst null)
create or replace function public.online_suche_partie(uid uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.partien_online p
  where p.gewertet and p.status = 'laeuft' and uid in (p.weiss, p.schwarz) and p.erstellt_am > now() - interval '60 seconds'
  order by p.erstellt_am desc
  limit 1;
$$;

-- Paart das Konto mit dem am laengsten Wartenden gleicher Bedenkzeit im Elo-Fenster: +-200, je Sekunde Wartezeit des
-- laenger Wartenden 50 breiter. Treffer: gewertete Partie mit zufaelligen Farben, beide Zeilen weg. Sonst null.
-- Intern; laeuft bei online_suche_start UND bei jeder Abfrage online_suche_stand (zwei, die genau gleichzeitig
-- anfangen, sehen sich beim Start noch nicht, und das Fenster waechst nur, wenn spaeter erneut gepaart wird).
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
    and abs(q.elo - ich.elo) <= 200 + 50 * extract(epoch from now() - least(q.seit, ich.seit))
  order by q.seit
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
  -- der Insert-Trigger macht daraus eine offene Partie mit vollen Uhren; danach wie online_tritt_bei auf 'laeuft'
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

-- Suche starten (oder fortsetzen: dieselbe Zeit behaelt die Wartezeit). Antwort { partie } oder { wartet: true }.
create or replace function public.online_suche_start(zeit text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  st public.kronen_stand;
  p uuid;
begin
  if uid is null then
    raise exception 'KRONEN_ANMELDUNG';
  end if;
  -- erst die Form, dann die Zahl (ein "or" garantiert keine Reihenfolge, der Cast wuerde sonst selbst scheitern)
  if zeit is null or zeit !~ '^[0-9]{1,3}\+[0-9]{1,2}$' then
    raise exception 'KRONEN_EINGABE';
  end if;
  if split_part(zeit, '+', 1)::integer not between 1 and 180 then
    raise exception 'KRONEN_EINGABE';
  end if;
  -- aufraeumen: verlassene Suchen nach 2 Minuten, Belege nach 6 Stunden
  delete from public.suche_warteschlange q where q.seit < now() - interval '2 minutes';
  delete from public.suche_ki_belege b where b.erstellt_am < now() - interval '6 hours';
  p := public.online_suche_partie(uid);
  if p is not null then
    return jsonb_build_object('partie', p);
  end if;
  st := public.kronen_stand_sichern(uid);
  insert into public.suche_warteschlange as q (user_id, zeit, elo) values (uid, zeit, st.elo)
  on conflict (user_id) do update
  set zeit = excluded.zeit, elo = excluded.elo, seit = case when q.zeit = excluded.zeit then q.seit else now() end;
  p := public.online_suche_paaren(uid);
  if p is not null then
    return jsonb_build_object('partie', p);
  end if;
  return jsonb_build_object('wartet', true);
end;
$$;

-- Abfrage waehrend der Suche: { partie }, sobald gepaart, sonst { wartet: true }
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
  return jsonb_build_object('wartet', true);
end;
$$;

-- Suche beenden (Abbruch oder Bot-Ersatz). Mit ki = true und nur nach mindestens 10 s ohne Paarung: Beleg { ki_ref }.
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
  if ki is true and seit_war is not null and seit_war <= now() - interval '10 seconds'
     and public.online_suche_partie(uid) is null then
    insert into public.suche_ki_belege (user_id) values (uid) returning ref into r;
    return jsonb_build_object('ki_ref', r);
  end if;
  return '{}'::jsonb;
end;
$$;

revoke all on function public.online_suche_partie(uuid) from public, anon, authenticated;
revoke all on function public.online_suche_paaren(uuid) from public, anon, authenticated;
revoke all on function public.online_suche_start(text) from public, anon, authenticated;
revoke all on function public.online_suche_stand() from public, anon, authenticated;
revoke all on function public.online_suche_ende(boolean) from public, anon, authenticated;
grant execute on function public.online_suche_start(text) to authenticated;
grant execute on function public.online_suche_stand() to authenticated;
grant execute on function public.online_suche_ende(boolean) to authenticated;

-- ---------- Task 5: Bot- und KI-Gegner-Ergebnis ----------
-- Gemeinsame Buchung fuer Bot-Leiter und KI-Gegner: Kronen in die Wochen-Gruppe, je (Konto, Quelle, ref) hoechstens
-- einmal. Antwort { delta, kronen, stufe } mit den Wochen-Kronen; eine schon gebuchte ref liefert den Stand mit delta 0.
-- Nur intern. Parameter heissen bewusst nicht quelle/ref: gleichnamige Spalten waeren in PL/pgSQL sonst mehrdeutig.
-- Schummel-Schutz (Flo 07.11.2026): Bot- und KI-Ergebnisse meldet der Client selbst, deshalb bringen sie zusammen
-- hoechstens bot_ki_wochen_max Kronen je Woche (nur Gewinne zaehlen). Das KI-Raetsel-Duell (duell_ki) zaehlt mit, weil
-- es gegen keinen Menschen geht. Online-Partien und Raetsel-Duelle gegen Menschen (duell) sind frei.
-- Antwort zusaetzlich bot_ki_voll: true, sobald der Deckel erreicht ist.

-- Gewinne aus Bot, KI-Gegner und KI-Raetsel-Duell eines Kontos in einer Woche. Nur intern.
create or replace function public.liga_bot_ki_genutzt(uid uuid, wo date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(b.delta) filter (where b.delta > 0), 0)::integer from public.kronen_buchungen b
  where b.user_id = uid and b.quelle in ('bot', 'ki', 'duell_ki') and b.woche = wo;
$$;

create or replace function public.kronen_einfach_buchen(uid uuid, art text, schluessel text, ergebnis text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  st public.kronen_stand;
  konst jsonb := public.kronen_konstanten();
  nominal integer := (konst #>> array['kronen', art, ergebnis])::integer;
  deckel integer := (konst ->> 'bot_ki_wochen_max')::integer;
  -- dieselbe Uhr wie liga_buchen: die Buchung zaehlt in der Woche, in die sie gebucht wird
  wo date := public.liga_woche_am(pg_catalog.clock_timestamp());
  d integer := 0;
  gebucht integer;
begin
  -- kronen_stand_sichern sperrt den Stand: Buchungen eines Kontos laufen nacheinander, der Deckel haelt
  st := public.kronen_stand_sichern(uid);
  insert into public.kronen_buchungen (user_id, quelle, ref, delta, woche)
  values (uid, art, schluessel, 0, wo)
  on conflict on constraint kronen_buchungen_einmal do nothing;
  get diagnostics gebucht = row_count;
  if gebucht > 0 then
    if nominal > 0 and art in ('bot', 'ki', 'duell_ki') then
      nominal := least(nominal, greatest(0, deckel - public.liga_bot_ki_genutzt(uid, wo)));
    end if;
    -- auch mit 0 (gedeckelt oder Niederlage): die erste Partie der Woche bringt das Konto in seine Gruppe
    d := public.liga_buchen(uid, nominal);
    update public.kronen_buchungen b set delta = d where b.user_id = uid and b.quelle = art and b.ref = schluessel;
  end if;
  return jsonb_build_object('delta', d, 'kronen', coalesce((public.liga_mein_platz(uid) ->> 'kronen')::integer, 0),
    'stufe', st.stufe, 'bot_ki_voll', public.liga_bot_ki_genutzt(uid, wo) >= deckel);
end;
$$;

-- Buchungen einer Quelle heute (Europe/Berlin), fuer die Tagesgrenzen. Nur intern.
create or replace function public.kronen_heute_anzahl(uid uuid, art text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.kronen_buchungen b
  where b.user_id = uid and b.quelle = art
    and b.am >= (public.kronen_heute()::timestamp at time zone 'Europe/Berlin');
$$;

-- Ergebnis gegen einen Bot der Leiter. ref ist die Partie-ID des Geraets; hoechstens 10 Buchungen am Tag.
-- Antwort { delta, kronen, stufe } oder { fehler: 'KRONEN_EINGABE' | 'KRONEN_GRENZE' }.
create or replace function public.kronen_bot_ergebnis(ref text, ergebnis text, bot_elo integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'KRONEN_ANMELDUNG';
  end if;
  if ergebnis is null or ergebnis not in ('sieg', 'remis', 'niederlage') or bot_elo is null or bot_elo not between 200 and 3200
     or ref is null or char_length(ref) not between 8 and 64 then
    return jsonb_build_object('fehler', 'KRONEN_EINGABE');
  end if;
  -- je Konto nacheinander, damit die Grenze auch bei gleichzeitigen Meldungen haelt
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('kronen-melden:' || uid::text));
  if exists (select 1 from public.kronen_buchungen b where b.user_id = uid and b.quelle = 'bot' and b.ref = kronen_bot_ergebnis.ref) then
    return public.kronen_einfach_buchen(uid, 'bot', ref, ergebnis); -- schon gebucht: Stand mit delta 0
  end if;
  if public.kronen_heute_anzahl(uid, 'bot') >= (public.kronen_konstanten()->>'bot_tagesgrenze')::integer then
    return jsonb_build_object('fehler', 'KRONEN_GRENZE');
  end if;
  return public.kronen_einfach_buchen(uid, 'bot', ref, ergebnis);
end;
$$;

-- Ergebnis gegen einen KI-Gegner aus der Gegnersuche, nur gegen einen eigenen Beleg (online_suche_ende(true)).
-- Reihenfolge: Eingabe -> Beleg (eigener, nicht eingeloest, juenger als 6 h) -> Mindestdauer 60 s (Beleg bleibt) ->
-- Tagesgrenze 20 (Beleg wird eingeloest, damit er nicht morgen nachgebucht wird) -> einloesen und buchen.
-- Antwort { delta, kronen, stufe } oder { fehler: 'KRONEN_EINGABE' | 'KRONEN_BELEG' | 'KRONEN_ZU_FRUEH' | 'KRONEN_GRENZE' }.
create or replace function public.kronen_ki_ergebnis(ki_ref uuid, ergebnis text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  beleg public.suche_ki_belege;
begin
  if uid is null then
    raise exception 'KRONEN_ANMELDUNG';
  end if;
  if ki_ref is null or ergebnis is null or ergebnis not in ('sieg', 'remis', 'niederlage') then
    return jsonb_build_object('fehler', 'KRONEN_EINGABE');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('kronen-melden:' || uid::text));
  select * into beleg from public.suche_ki_belege b
  where b.ref = ki_ref and b.user_id = uid and not b.eingeloest and b.erstellt_am > now() - interval '6 hours'
  for update;
  if beleg.ref is null then
    return jsonb_build_object('fehler', 'KRONEN_BELEG');
  end if;
  if now() - beleg.erstellt_am < make_interval(secs => (public.kronen_konstanten()->>'ki_mindestdauer_s')::integer) then
    return jsonb_build_object('fehler', 'KRONEN_ZU_FRUEH');
  end if;
  update public.suche_ki_belege b set eingeloest = true where b.ref = ki_ref;
  if public.kronen_heute_anzahl(uid, 'ki') >= (public.kronen_konstanten()->>'ki_tagesgrenze')::integer then
    return jsonb_build_object('fehler', 'KRONEN_GRENZE');
  end if;
  return public.kronen_einfach_buchen(uid, 'ki', ki_ref::text, ergebnis);
end;
$$;

revoke all on function public.kronen_einfach_buchen(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.liga_bot_ki_genutzt(uuid, date) from public, anon, authenticated;
revoke all on function public.kronen_heute_anzahl(uuid, text) from public, anon, authenticated;
revoke all on function public.kronen_bot_ergebnis(text, text, integer) from public, anon, authenticated;
revoke all on function public.kronen_ki_ergebnis(uuid, text) from public, anon, authenticated;
grant execute on function public.kronen_bot_ergebnis(text, text, integer) to authenticated;
grant execute on function public.kronen_ki_ergebnis(uuid, text) to authenticated;

-- ---------- Task 6: Start-Liga fuer Bestandsspieler ----------
-- Einmal je Konto und nur vor der ersten Partie mit Kronen (online, KI, Bot oder Raetsel-Duell): die Elo des Geraets,
-- begrenzt auf 400 bis 2800, wird zur Stufe III der Liga ihrer Spielklasse, hoechstens Laeufer III (SQL-Gegenstueck zu
-- startStufeAusElo in js/pakete/liga/kronen.js, Zahlen aus kronen_konstanten). Die Elo wird auch die Online-Elo.
-- Kronen gibt es dafuer keine (die Buchung 'start' mit 0 ist nur der Merker).
-- Antwort { delta: 0, kronen: 0, stufe } oder { fehler: 'KRONEN_EINGABE' | 'KRONEN_START_VORBEI' } ohne Aenderung.
create or replace function public.kronen_start(elo integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  konst jsonb := public.kronen_konstanten();
  st public.kronen_stand;
  wert integer;
  klasse integer;
  neu integer;
begin
  if uid is null then
    raise exception 'KRONEN_ANMELDUNG';
  end if;
  if kronen_start.elo is null then
    return jsonb_build_object('fehler', 'KRONEN_EINGABE');
  end if;
  -- kronen_stand_sichern sperrt die Zeile (for update): gleichzeitige Starts und Buchungen laufen nacheinander
  st := public.kronen_stand_sichern(uid);
  if st.start_gesetzt
     or exists (select 1 from public.kronen_buchungen b where b.user_id = uid and b.quelle in ('online', 'ki', 'bot', 'duell', 'duell_ki')) then
    return jsonb_build_object('fehler', 'KRONEN_START_VORBEI');
  end if;
  wert := least(greatest(kronen_start.elo, (konst->>'start_elo_min')::integer), (konst->>'start_elo_max')::integer);
  select count(*)::integer - 1 into klasse
  from jsonb_array_elements_text(konst->'klassen_grenzen') g(grenze)
  where wert >= g.grenze::integer;
  neu := least(klasse, (konst->>'start_hoechste_liga')::integer) * (konst->>'stufen_je_liga')::integer;
  insert into public.kronen_buchungen (user_id, quelle, ref, delta, woche)
  values (uid, 'start', 'start', 0, public.liga_woche_heute())
  on conflict on constraint kronen_buchungen_einmal do nothing;
  update public.kronen_stand s
  set stufe = neu, elo = wert, start_gesetzt = true, aktualisiert_am = now()
  where s.user_id = uid;
  return jsonb_build_object('delta', 0, 'kronen', 0, 'stufe', neu);
end;
$$;

revoke all on function public.kronen_start(integer) from public, anon, authenticated;
grant execute on function public.kronen_start(integer) to authenticated;

-- Aufbewahrung: mit pg_cron zusaetzlich taeglich um 03:17 (UTC), damit alte Wochen auch in einer Woche ohne
-- Abrechnung verschwinden. Ohne pg_cron reicht die Abrechnung. Gleicher Name = ersetzt, also wiederholbar.
do $cron$
begin
  if pg_catalog.to_regnamespace('cron') is not null then
    execute $sql$select cron.schedule('liga-alte-wochen-loeschen', '17 3 * * *',
      'select public.liga_alte_wochen_loeschen()')$sql$;
  end if;
end;
$cron$;

-- Visitenkarte, Erfolge in drei Stufen, Taler und Banner (Etappe 4b, Konzept 06.11.2026 Abschnitt 5b und 5c).
-- Die Zahlen und festen Listen stehen gleich in js/pakete/sammlung/stufen.js, js/pakete/sammlung/titel.js und
-- js/profil.js (Vertragstest tests/karte-vertrag.test.mjs).
--
-- Was der Server entscheidet: Taler, Banner-Besitz und welche Stufen gebucht sind. Jede Stufe wird je Konto genau
-- einmal gebucht (zahlt einmal Taler), Stufen kommen nur der Reihe nach (Bronze, Silber, Gold). Gold schreibt ein
-- Gold-Banner gut. Erfolge sind nie kaeuflich: es gibt keinen Weg aus einem Kauf in diese Tabellen.
-- BESITZ (Stand 09.11.2026, Audit "Visitenkarte an echten Besitz binden"): Titel, Rahmen, Hintergrund und Profilbild
-- nimmt karte_waehle nur an, wenn das Konto sie besitzt. Besitz leitet der Server aus dem ab, was er selbst hat: den
-- gebuchten Stufen (karte_stufen) und der Liga (Kronen). Die Zuordnung steht in karte_besitz_regeln(), die Liste des
-- eigenen Besitzes liefert karte_frei() (auch im Stand, Schluessel frei). Was der Server nicht belegen kann (z. B. die
-- Koennen-Titel aus dem Partien-Archiv des Geraets), hat keine Regel und bleibt aus der festen Liste waehlbar.
-- Was schon auf der Karte steht, bleibt (nur eine NEUE Wahl wird geprueft): niemand verliert beim Einspielen etwas.
-- BEKANNTE GRENZE (Flo 07.11.2026, am 09.11.2026 enger gefasst): Bot-, Raetsel-, Serie- und Level-Stufen meldet das
-- Geraet, weil diese Partien nur dort laufen (auch als Gast, vor dem Konto); der Server hat dazu keine eigenen Daten und
-- kann sie nicht nachrechnen. Er bremst deshalb: je Meldung hoechstens EINE neue Stufe je Familie, in 24 Stunden
-- hoechstens 3 neue Silber- und 2 neue Gold-Stufen je Konto (melde_tagesgrenze), und eine Serie-Stufe erst, wenn es die
-- App so viele Tage gibt (app_start). Taler und Gold-Banner gibt es nur fuer wirklich gebuchte Stufen. Ein geuebter
-- Schummler kann die Stufen also weiter vortaeuschen, aber nur langsam und nie auf einen Schlag. Die Liga-Stufen leitet
-- der Server selbst aus kronen_stand.stufe und den Wochen-Gruppen (liga_mitglieder, liga_gruppen) ab; die meldet
-- niemand. Liga-Banner schreibt nur der Server gut (karte_banner_gutschreiben, aufgerufen von liga_abrechnen in
-- kronen-schema.sql).
--
-- Wer die Karte eines anderen sieht: nur der Gegner einer gemeinsamen Online-Partie (karte_der_partie), mit
-- Benutzername. Datenschutz-Text dazu: datenschutz.html (Entwurf, Rechtspruefung vor dem Live-Gang).
--
-- Nutzer haben keine Tabellenrechte; alles laeuft ueber die Funktionen unten (security definer, fester search_path).
-- Einspielen: nach supabase/schema.sql, supabase/online-schema.sql und supabase/kronen-schema.sql im SQL Editor.
-- Wiederholbar. Pruefen: supabase/karte-rls-test.sql (rollt alles zurueck). Rueckweg: supabase/karte-zurueck.sql.
-- Rein additiv: neue Tabellen und Funktionen, nichts Bestehendes wird geaendert. Der Stand vor dem 09.11.2026 (ohne
-- Besitz-Pruefung und Bremse) kommt mit supabase/karte-besitz-zurueck.sql zurueck, ohne Daten zu verlieren.

create table if not exists public.karte_stufen (
  user_id uuid not null references auth.users (id) on delete cascade,
  familie text not null,
  stufe integer not null,
  am timestamptz not null default now(),
  primary key (user_id, familie, stufe),
  constraint karte_stufen_stufe check (stufe between 1 and 3),
  constraint karte_stufen_familie check (familie ~ '^[a-z]{2,20}$')
);

create table if not exists public.taler_buchungen (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  quelle text not null,
  ref text not null,
  delta integer not null,
  am timestamptz not null default now(),
  -- spaeter kommen Tagesaufgaben und der Shop dazu (eigene Etappen); heute zahlen nur Erfolgs-Stufen
  constraint taler_buchungen_quelle check (quelle in ('erfolg')),
  constraint taler_buchungen_ref check (char_length(ref) between 1 and 64),
  constraint taler_buchungen_einmal unique (user_id, quelle, ref)
);

create table if not exists public.banner_besitz (
  user_id uuid not null references auth.users (id) on delete cascade,
  banner text not null,
  quelle text not null,
  am timestamptz not null default now(),
  primary key (user_id, banner),
  constraint banner_besitz_quelle check (quelle in ('start', 'erfolg', 'liga'))
);

create table if not exists public.karte_wahl (
  user_id uuid primary key references auth.users (id) on delete cascade,
  banner text not null default 'start',
  titel text,
  vitrine text[] not null default '{}',
  motiv text not null default 'P',
  grund text not null default 'standard',
  rahmen text not null default 'ohne',
  aktualisiert_am timestamptz not null default now(),
  constraint karte_wahl_vitrine check (cardinality(vitrine) <= 3)
);

alter table public.karte_stufen enable row level security;
alter table public.taler_buchungen enable row level security;
alter table public.banner_besitz enable row level security;
alter table public.karte_wahl enable row level security;
-- keine Policies und kein Tabellenrecht (Supabase vergibt sonst Standardrechte)
revoke all on table public.karte_stufen, public.taler_buchungen, public.banner_besitz, public.karte_wahl
  from anon, authenticated, public;
revoke all on sequence public.taler_buchungen_id_seq from anon, authenticated, public;

-- Alle Zahlen und festen Listen an einer Stelle (Vertragstest)
create or replace function public.karte_konstanten()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'stufen', jsonb_build_array('bronze', 'silber', 'gold'),
    'taler', jsonb_build_object('bronze', 20, 'silber', 50, 'gold', 120),
    -- Familie -> Gold-Lohn (genau ein Titel oder ein Banner); server = Stufen leitet der Server selbst ab
    'familien', jsonb_build_object(
      'siege', jsonb_build_object('titel', 'erfolg-siegesbanner'),
      'bots', jsonb_build_object('banner', 'erfolg-turmbezwinger'),
      'welten', jsonb_build_object('titel', 'erfolg-tiefenlicht'),
      'sterne', jsonb_build_object('titel', 'erfolg-sternenkrone'),
      'endgegner', jsonb_build_object('titel', 'erfolg-weltenbezwinger'),
      'siegesfolge', jsonb_build_object('banner', 'erfolg-seriensieger'),
      'raetsel', jsonb_build_object('banner', 'erfolg-raetselmeister'),
      'serie', jsonb_build_object('titel', 'erfolg-ewige-flamme'),
      'level', jsonb_build_object('titel', 'level-30'),
      'liga', jsonb_build_object('titel', 'erfolg-ligakrone', 'server', true)
    ),
    -- Liga-Stufen (kronen_stand.stufe, 0 = Bauer III) fuer Bronze, Silber, Gold der Familie liga: Laeufer III, Turm III,
    -- Koenig III (gleiche Farben wie frueher Silber III, Gold III, Krone III)
    'liga_ziele', jsonb_build_array(6, 9, 15),
    'start_banner', 'start',
    -- Liga-Banner (Bilder aus assets/banner, Ids bleiben), je Liga eins in der Reihenfolge Bauer bis Koenig (Farben Holz
    -- bis Krone): liga_abrechnen schreibt es ueber karte_banner_gutschreiben gut, sobald eine Woche ein Banner bringt
    -- (Platz 1 der Wochen-Gruppe, erster Aufstieg in eine Liga), immer das Banner der Liga der Gruppe.
    'liga_banner', jsonb_build_array('saison-holz', 'saison-bronze', 'saison-silber', 'saison-gold', 'saison-diamant', 'saison-krone'),
    'titel', jsonb_build_array(
      'level-1', 'level-5', 'level-10', 'level-15', 'level-20', 'level-25', 'level-30', 'level-35', 'level-40', 'level-45',
      'level-50', 'level-60', 'level-75', 'level-100',
      'erfolg-feuertaufe', 'erfolg-sternenglanz', 'erfolg-goldene-aehre', 'erfolg-eichenlaub', 'erfolg-turmzinne',
      'erfolg-brandung', 'erfolg-tiefenlicht', 'erfolg-bot-schreck', 'erfolg-sternenkrone', 'erfolg-goldlorbeer',
      'erfolg-ligakrone', 'erfolg-wochenflamme', 'erfolg-monatsfeuer', 'erfolg-ewige-flamme', 'erfolg-schattenkoenig',
      'erfolg-siegeszug', 'erfolg-bezwinger', 'erfolg-siegesbanner', 'erfolg-weltenbezwinger', 'erfolg-goldene-feder',
      'erfolg-sternenschueler',
      'koennen-blitzschlag', 'koennen-langer-atem', 'koennen-gleichgewicht', 'koennen-feinschliff', 'koennen-eigene-kraft',
      'koennen-stammgast',
      -- Titel vom 08.11.2026 (js/pakete/sammlung/titel.js KOENNEN_TITEL); bis zum Einspielen lehnt der Server sie ab und
      -- die Karte zeigt keinen Titel (js/karte.js abgleichEinmal, zweiter Versuch ohne Titel)
      'koennen-kroenung', 'koennen-raetselfuchs', 'koennen-weltenwanderer', 'koennen-tafelkoenig', 'koennen-rekordjaeger',
      'koennen-sterne-sammler', 'koennen-fehlerjaeger', 'koennen-musterschueler', 'koennen-erzfeind'
    ),
    -- Profilbild ohne die Stuecke nur fuer den Erfinder (Koenig, Kronli) und ohne Labor-Rahmen
    'motive', jsonb_build_array('Q', 'R', 'B', 'N', 'P', 'karo', 'stups', 'zinni', 'klippa', 'glimm'),
    'gruende', jsonb_build_array('standard', 'welt-1', 'welt-2', 'welt-3', 'welt-4', 'welt-5'),
    'rahmen', jsonb_build_array('ohne', 'holz', 'liga-1', 'liga-2', 'liga-3', 'liga-4', 'liga-5', 'liga-6',
      'welt-1', 'welt-2', 'welt-3', 'welt-4', 'welt-5', 'serie-7', 'serie-30', 'serie-100'),
    -- Bremse fuer gemeldete Stufen (karte_stufe_moeglich): neue Silber- und Gold-Stufen je Konto in 24 Stunden. Bronze
    -- hat keine Tagesgrenze (ein guter erster Tag kann jede Familie anfangen); Liga-Stufen zaehlen nie mit.
    'melde_tagesgrenze', jsonb_build_object('silber', 3, 'gold', 2),
    -- Serie (Tage in Folge) fuer Bronze, Silber, Gold wie in js/pakete/sammlung/stufen.js; eine Serie kann nicht laenger
    -- sein, als es die App gibt (erster Stand im Repo 16.10.2026, ein Tag Luft fuer Zeitzonen)
    'serie_tage', jsonb_build_array(7, 30, 100),
    'app_start', '2026-10-15',
    -- Rahmen und Titel der alten Saison-Liga (lief bis 08.11.2026 nur auf dem Geraet, nicht mehr zu erspielen): der
    -- Server kann sie nicht belegen. Waehlbar bleiben sie fuer Konten, die es vor diesem Tag schon gab (die koennen sie
    -- ehrlich erspielt haben), und mit Gold der Familie liga (Koenig III, so rechnet auch die App). Ein Konto, das
    -- danach entsteht, kann sie nicht mehr neu waehlen.
    'alt_liga_bis', '2026-11-09'
  );
$$;

-- Woran der Server Besitz erkennt (karte_frei): je Liste der Karte ein Objekt Wert -> [Familie, Mindeststufe]. Erfuellt
-- ist eine Regel, wenn die Familie in karte_stufen mindestens bis zu dieser Stufe gebucht ist. Ein Wert OHNE Regel ist
-- fuer jeden frei: entweder immer frei (ohne, holz, standard, die Figuren, level-1) oder vom Server nicht belegbar.
-- Die Regeln sind nie strenger als die App (js/pakete/sammlung/index.js teileErfolge, profil.js, titel.js): wer ein
-- Stueck ehrlich hat, erfuellt sie. Wo die Stufen groeber sind als der Weg in der App, gilt die naechste Stufe darunter:
--   Level-Titel      Level 10/20/30 = Bronze/Silber/Gold der Familie level. level-5 liegt unter Bronze (frei), level-15
--                    und level-25 brauchen die Stufe darunter, level-35 bis level-100 nur Gold (mehr weiss der Server nicht)
--   Serie            7/30/100 Tage = Bronze/Silber/Gold der Familie serie (Titel und Rahmen), genau
--   Welt gemeistert  Titel, Rahmen und Kreatur einer Welt: mindestens eine Welt gemeistert (welten Bronze); welche Welt,
--                    weiss der Server nicht
--   Hintergrund      welt-2 bis welt-5: die Welt ist erreicht, dafuer braucht es mindestens einen Sieg (siege Bronze)
--   Sieg, drei Sterne      siege Bronze (ein besiegter Bot)
--   alle Bots, alle Sterne, alle Endgegner, 100 Siege   Gold von bots, sterne, endgegner, siege, genau
--   ein Endgegner    endgegner Bronze; Siegesfolge 5 = siegesfolge Silber
--   Koennen          kroenung = liga Gold (Koenig III, leitet der Server ab); raetselfuchs (100 Raetsel) = raetsel Silber
--                    (50); weltenwanderer (Sieg in jeder Welt, also 5 besiegte Bots) = bots Bronze; sterne-sammler (eine
--                    Welt mit allen Sternen) = welten Bronze
--   altliga          Rahmen liga-1 bis liga-6, Titel Goldlorbeer und Ligakrone: siehe alt_liga_bis in karte_konstanten()
-- Ohne Regel, weil nicht belegbar: schattenkoenig, goldene-feder, sternenschueler und die Koennen-Titel blitzschlag,
-- langer-atem, gleichgewicht, feinschliff, eigene-kraft, stammgast, tafelkoenig, rekordjaeger, fehlerjaeger,
-- musterschueler, erzfeind (Partien-Archiv, Tafeln, Kartei und Meisterschule liegen nur auf dem Geraet).
create or replace function public.karte_besitz_regeln()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'titel', '{
      "level-10": ["level", 1], "level-15": ["level", 1], "level-20": ["level", 2], "level-25": ["level", 2],
      "level-30": ["level", 3], "level-35": ["level", 3], "level-40": ["level", 3], "level-45": ["level", 3],
      "level-50": ["level", 3], "level-60": ["level", 3], "level-75": ["level", 3], "level-100": ["level", 3],
      "erfolg-feuertaufe": ["siege", 1], "erfolg-sternenglanz": ["siege", 1],
      "erfolg-goldene-aehre": ["welten", 1], "erfolg-eichenlaub": ["welten", 1], "erfolg-turmzinne": ["welten", 1],
      "erfolg-brandung": ["welten", 1], "erfolg-tiefenlicht": ["welten", 1],
      "erfolg-bot-schreck": ["bots", 3], "erfolg-sternenkrone": ["sterne", 3],
      "erfolg-goldlorbeer": ["altliga", 3], "erfolg-ligakrone": ["altliga", 3],
      "erfolg-wochenflamme": ["serie", 1], "erfolg-monatsfeuer": ["serie", 2], "erfolg-ewige-flamme": ["serie", 3],
      "erfolg-siegeszug": ["siegesfolge", 2], "erfolg-bezwinger": ["endgegner", 1],
      "erfolg-siegesbanner": ["siege", 3], "erfolg-weltenbezwinger": ["endgegner", 3],
      "koennen-kroenung": ["liga", 3], "koennen-raetselfuchs": ["raetsel", 2],
      "koennen-weltenwanderer": ["bots", 1], "koennen-sterne-sammler": ["welten", 1]
    }'::jsonb,
    'rahmen', '{
      "liga-1": ["altliga", 3], "liga-2": ["altliga", 3], "liga-3": ["altliga", 3], "liga-4": ["altliga", 3],
      "liga-5": ["altliga", 3], "liga-6": ["altliga", 3],
      "welt-1": ["welten", 1], "welt-2": ["welten", 1], "welt-3": ["welten", 1], "welt-4": ["welten", 1],
      "welt-5": ["welten", 1],
      "serie-7": ["serie", 1], "serie-30": ["serie", 2], "serie-100": ["serie", 3]
    }'::jsonb,
    'gruende', '{"welt-2": ["siege", 1], "welt-3": ["siege", 1], "welt-4": ["siege", 1], "welt-5": ["siege", 1]}'::jsonb,
    'motive', '{"karo": ["welten", 1], "stups": ["welten", 1], "zinni": ["welten", 1], "klippa": ["welten", 1],
      "glimm": ["welten", 1]}'::jsonb
  );
$$;

create or replace function public.karte_in_liste(schluessel text, wert text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select wert is not null and (public.karte_konstanten() -> schluessel) ? wert;
$$;

-- Bucht EINE Stufe (die vorige muss schon gebucht sein). Ergebnis: true = neu gebucht. Nur intern.
create or replace function public.karte_buche_stufe(uid uuid, fam text, nr integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  k jsonb := public.karte_konstanten();
  name text;
  lohn jsonb := k -> 'familien' -> fam;
  n integer;
begin
  if lohn is null or nr is null or nr < 1 or nr > 3 then
    raise exception 'KARTE_STUFE';
  end if;
  if nr > 1 and not exists (select 1 from public.karte_stufen s where s.user_id = uid and s.familie = fam and s.stufe = nr - 1) then
    raise exception 'KARTE_REIHENFOLGE';
  end if;
  insert into public.karte_stufen (user_id, familie, stufe) values (uid, fam, nr) on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then
    return false;
  end if;
  name := k -> 'stufen' ->> (nr - 1);
  insert into public.taler_buchungen (user_id, quelle, ref, delta)
  values (uid, 'erfolg', fam || ':' || name, (k -> 'taler' ->> name)::integer)
  on conflict (user_id, quelle, ref) do nothing;
  if nr = 3 and lohn ? 'banner' then
    insert into public.banner_besitz (user_id, banner, quelle) values (uid, lohn ->> 'banner', 'erfolg') on conflict do nothing;
  end if;
  return true;
end;
$$;

-- Legt den Besitz eines Kontos an: Start-Banner und Liga-Stufen aus den Kronen. Nur intern.
create or replace function public.karte_sichern(uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k jsonb := public.karte_konstanten();
  beste integer := -1;
  i integer;
begin
  if uid is null then
    raise exception 'KARTE_ANMELDUNG';
  end if;
  insert into public.banner_besitz (user_id, banner, quelle) values (uid, k ->> 'start_banner', 'start') on conflict do nothing;
  insert into public.karte_wahl (user_id) values (uid) on conflict (user_id) do nothing;
  -- Kronen: beste Stufe aus dem Stand und allen Wochen-Gruppen, in denen das Konto war (kronen-schema.sql muss
  -- eingespielt sein). Die Stufe sinkt nach einer schwachen Woche, eine einmal erreichte Erfolgs-Stufe bleibt.
  select greatest(
    coalesce((select s.stufe from public.kronen_stand s where s.user_id = uid), -1),
    coalesce((select max(g.stufe) from public.liga_mitglieder m join public.liga_gruppen g on g.id = m.gruppe
              where m.user_id = uid), -1)
  ) into beste;
  for i in 1..3 loop
    exit when beste < (k -> 'liga_ziele' ->> (i - 1))::integer;
    perform public.karte_buche_stufe(uid, 'liga', i);
  end loop;
  -- Liga-Banner, die die Abrechnung gemerkt hat, bevor es dieses Schema gab
  perform public.karte_liga_banner_nachtragen(uid);
end;
$$;

-- Schreibt einem Konto ein Liga-Banner gut (genau einmal). Ergebnis: true = neu. Fuer den Liga-Umbau (Konzept 5a):
-- nur aus anderen Server-Funktionen oder mit dem service_role-Schluessel aufrufbar, nie vom Geraet (kein grant).
create or replace function public.karte_banner_gutschreiben(uid uuid, banner text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if uid is null or not exists (select 1 from auth.users u where u.id = uid) then
    raise exception 'KARTE_KONTO';
  end if;
  if not public.karte_in_liste('liga_banner', banner) then
    raise exception 'KARTE_BANNER';
  end if;
  insert into public.banner_besitz (user_id, banner, quelle) values (uid, banner, 'liga') on conflict do nothing;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

-- Zahlt die gemerkten Liga-Banner eines Kontos aus (liga_belohnungen art 'banner' = Platz 1 der Wochen-Gruppe,
-- 'aufstieg-banner' = erster Aufstieg in eine Liga): je Zeile das Banner der Liga dieser Stufe (stufe / 3, Bauer bis
-- Koenig = Holz bis Krone), danach ausgezahlt. Taler bleiben gemerkt, die zahlt eine spaetere Etappe aus.
-- Aufgerufen von liga_abrechnen (kronen-schema.sql) und karte_sichern. Nur intern.
create or replace function public.karte_liga_banner_nachtragen(uid uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  k jsonb := public.karte_konstanten();
  r record;
  n integer := 0;
begin
  for r in select x.woche, x.art, x.stufe from public.liga_belohnungen x
           where x.user_id = uid and x.art in ('banner', 'aufstieg-banner') and not x.ausgezahlt
           order by x.woche, x.art for update
  loop
    if public.karte_banner_gutschreiben(uid, k -> 'liga_banner' ->> (r.stufe / 3)) then
      n := n + 1;
    end if;
    update public.liga_belohnungen x set ausgezahlt = true
    where x.user_id = uid and x.woche = r.woche and x.art = r.art;
  end loop;
  return n;
end;
$$;

-- Was ein Konto fuer die Karte waehlen darf: { titel: [...], rahmen: [...], gruende: [...], motive: [...] }, je Liste
-- die Werte aus karte_konstanten(), deren Regel (karte_besitz_regeln) erfuellt ist oder die keine Regel haben.
-- Der Erfinder (Flo 30.10.2026: als Erfinder ist alles Ausruestbare frei; Zeile erfinder-titel in sonderstuecke,
-- werkstatt-schema.sql, nur von Flo per SQL eingetragen) darf jeden Rahmen, Hintergrund und jedes Profilbild der Liste
-- waehlen; Titel bleiben auch fuer ihn erspielt. Ohne die Tabelle sonderstuecke gibt es keinen Erfinder. Nur intern.
create or replace function public.karte_frei(uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k jsonb := public.karte_konstanten();
  r jsonb := public.karte_besitz_regeln();
  st jsonb;
  erfinder boolean := false;
  altliga boolean;
begin
  select coalesce(jsonb_object_agg(s.familie, s.stufe), '{}'::jsonb) into st
  from (select x.familie, max(x.stufe) as stufe from public.karte_stufen x where x.user_id = uid group by x.familie) s;
  if to_regclass('public.sonderstuecke') is not null then
    execute 'select exists (select 1 from public.sonderstuecke s where s.user_id = $1 and s.stueck_id = ''erfinder-titel'')'
      into erfinder using uid;
  end if;
  -- to_jsonb: laeuft auch gegen eine Auth-Tabelle ohne die Spalte created_at (dann zaehlt nur Liga Gold)
  altliga := coalesce((st ->> 'liga')::integer, 0) >= 3
    or coalesce((select (to_jsonb(u) ->> 'created_at')::timestamptz < ((k ->> 'alt_liga_bis')::date::timestamp at time zone 'Europe/Berlin')
                 from auth.users u where u.id = uid), false);
  return (
    select jsonb_object_agg(a.art, coalesce((
      select jsonb_agg(w.wert order by w.o)
      from jsonb_array_elements_text(k -> a.art) with ordinality as w(wert, o)
      where (erfinder and a.art <> 'titel')
         or r -> a.art -> w.wert is null
         or case when r -> a.art -> w.wert ->> 0 = 'altliga' then altliga
                 else coalesce((st ->> (r -> a.art -> w.wert ->> 0))::integer, 0) >= (r -> a.art -> w.wert ->> 1)::integer end
    ), '[]'::jsonb))
    from (values ('titel'), ('rahmen'), ('gruende'), ('motive')) as a(art)
  );
end;
$$;

-- Darf das Konto die Stufe nr der Familie fam JETZT auf eine Meldung des Geraets hin buchen? Zwei Deckel, weil der
-- Server diese Stufen nicht nachrechnen kann (Kopf der Datei):
--   Serie         nicht, bevor es die App so viele Tage gibt (serie_tage, app_start; Kalender Europe/Berlin)
--   Tagesgrenze   Silber und Gold: hoechstens melde_tagesgrenze neue gemeldete Stufen dieser Hoehe in 24 Stunden
-- Was heute nicht geht, verfaellt nicht: das Geraet meldet seinen Stand bei jedem Start neu. Nur intern.
create or replace function public.karte_stufe_moeglich(uid uuid, fam text, nr integer)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k jsonb := public.karte_konstanten();
  grenze integer := (k -> 'melde_tagesgrenze' ->> (k -> 'stufen' ->> (nr - 1)))::integer;
begin
  if fam = 'serie' and (now() at time zone 'Europe/Berlin')::date - (k ->> 'app_start')::date
       < (k -> 'serie_tage' ->> (nr - 1))::integer then
    return false;
  end if;
  if grenze is not null and (
       select count(*) from public.karte_stufen s
       where s.user_id = uid and s.stufe = nr and s.am > now() - interval '24 hours'
         and not coalesce((k -> 'familien' -> s.familie) ? 'server', false)
     ) >= grenze then
    return false;
  end if;
  return true;
end;
$$;

-- Eigener Stand: Taler, erreichte Stufe je Familie, eigene Banner, gewaehlte Karte und (seit 09.11.2026) frei: was das
-- Konto fuer die Karte waehlen darf (karte_frei)
create or replace function public.karte_mein_stand()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  w public.karte_wahl;
begin
  perform public.karte_sichern(uid);
  select * into w from public.karte_wahl x where x.user_id = uid;
  return jsonb_build_object(
    'taler', coalesce((select sum(t.delta) from public.taler_buchungen t where t.user_id = uid), 0),
    'stufen', coalesce((select jsonb_object_agg(s.familie, s.stufe) from (
      select familie, max(stufe) as stufe from public.karte_stufen where user_id = uid group by familie) s), '{}'::jsonb),
    'banner', coalesce((select jsonb_agg(b.banner order by b.am, b.banner) from public.banner_besitz b where b.user_id = uid), '[]'::jsonb),
    'wahl', jsonb_build_object('banner', w.banner, 'titel', w.titel, 'vitrine', to_jsonb(w.vitrine),
      'motiv', w.motiv, 'grund', w.grund, 'rahmen', w.rahmen),
    'frei', public.karte_frei(uid)
  );
end;
$$;

-- Das Geraet meldet seine Stufen ({ familie: 0..3 }). Gebucht wird je Familie hoechstens die NAECHSTE fehlende Stufe
-- (kein Sprung mehr von 0 auf Gold in einem Aufruf), und nur, wenn karte_stufe_moeglich sie zulaesst. Was heute nicht
-- gebucht wird, ist kein Fehler: die Antwort ist der Stand, das Geraet meldet beim naechsten Start wieder. Taler und
-- Gold-Banner haengen an der gebuchten Stufe (karte_buche_stufe), nie an der Meldung. Die Familie liga wird ignoriert
-- (leitet der Server selbst ab). Unbekannte Familien oder Werte ausserhalb 0..3 lehnt er ab.
create or replace function public.karte_melde_stufen(stufen jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  k jsonb := public.karte_konstanten();
  fam text;
  wert jsonb;
  ziel integer;
  hat integer;
begin
  perform public.karte_sichern(uid);
  if stufen is null or jsonb_typeof(stufen) <> 'object' then
    raise exception 'KARTE_MELDUNG';
  end if;
  -- je Konto nacheinander, damit die Tagesgrenze auch bei gleichzeitigen Meldungen haelt
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('karte-melden:' || uid::text));
  for fam, wert in select * from jsonb_each(stufen) loop
    if not (k -> 'familien') ? fam then
      raise exception 'KARTE_FAMILIE';
    end if;
    if jsonb_typeof(wert) <> 'number' or (wert #>> '{}') !~ '^[0-3]$' then
      raise exception 'KARTE_STUFE';
    end if;
    continue when (k -> 'familien' -> fam) ? 'server';
    ziel := (wert #>> '{}')::integer;
    select coalesce(max(s.stufe), 0) into hat from public.karte_stufen s where s.user_id = uid and s.familie = fam;
    if ziel > hat and public.karte_stufe_moeglich(uid, fam, hat + 1) then
      perform public.karte_buche_stufe(uid, fam, hat + 1);
    end if;
  end loop;
  return public.karte_mein_stand();
end;
$$;

-- Karte waehlen: Banner nur aus dem eigenen Besitz, Titel/Motiv/Grund/Rahmen nur aus der festen Liste (nie Freitext)
-- UND nur aus dem eigenen Besitz (karte_frei); was schon auf der Karte steht, darf stehen bleiben (nur eine neue Wahl
-- wird geprueft). Vitrine hoechstens drei verschiedene erreichte Familien ('stufe-<familie>')
create or replace function public.karte_waehle(banner text, titel text, vitrine text[], motiv text, grund text, rahmen text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v text;
  sauber text[] := '{}';
  alt public.karte_wahl;
  frei jsonb;
begin
  perform public.karte_sichern(uid);
  select * into alt from public.karte_wahl x where x.user_id = uid;
  frei := public.karte_frei(uid);
  if not exists (select 1 from public.banner_besitz b where b.user_id = uid and b.banner = karte_waehle.banner) then
    raise exception 'KARTE_BANNER';
  end if;
  if titel is not null and not public.karte_in_liste('titel', titel) then
    raise exception 'KARTE_TITEL';
  end if;
  if titel is not null and titel is distinct from alt.titel and not (frei -> 'titel') ? titel then
    raise exception 'KARTE_TITEL';
  end if;
  if not public.karte_in_liste('motive', motiv) or not public.karte_in_liste('gruende', grund)
     or not public.karte_in_liste('rahmen', rahmen) then
    raise exception 'KARTE_PROFIL';
  end if;
  if (motiv is distinct from alt.motiv and not (frei -> 'motive') ? motiv)
     or (grund is distinct from alt.grund and not (frei -> 'gruende') ? grund)
     or (rahmen is distinct from alt.rahmen and not (frei -> 'rahmen') ? rahmen) then
    raise exception 'KARTE_PROFIL';
  end if;
  if vitrine is not null and cardinality(vitrine) > 3 then
    raise exception 'KARTE_VITRINE';
  end if;
  foreach v in array coalesce(vitrine, '{}') loop
    if v is null then
      continue;
    end if;
    if v !~ '^stufe-[a-z]{2,20}$' or v = any(sauber)
       or not exists (select 1 from public.karte_stufen s where s.user_id = uid and s.familie = substr(v, 7)) then
      raise exception 'KARTE_VITRINE';
    end if;
    sauber := sauber || v;
  end loop;
  update public.karte_wahl w
  set banner = karte_waehle.banner, titel = karte_waehle.titel, vitrine = sauber, motiv = karte_waehle.motiv,
      grund = karte_waehle.grund, rahmen = karte_waehle.rahmen, aktualisiert_am = now()
  where w.user_id = uid;
  return public.karte_mein_stand();
end;
$$;

-- Karte EINES Kontos fuer die Anzeige beim Gegner. Nur intern (karte_der_partie).
create or replace function public.karte_von(uid uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.karte_wahl;
  name text;
  stufe integer;
begin
  select * into w from public.karte_wahl x where x.user_id = uid;
  select p.benutzername into name from public.profile p where p.user_id = uid;
  select s.stufe into stufe from public.kronen_stand s where s.user_id = uid;
  return jsonb_build_object(
    'name', name,
    -- ein Banner, das nicht (mehr) im Besitz ist, zeigt das Start-Banner
    'banner', case when w.banner is not null and exists (select 1 from public.banner_besitz b where b.user_id = uid and b.banner = w.banner)
                   then w.banner else 'start' end,
    'titel', w.titel,
    'vitrine', coalesce((select jsonb_agg(jsonb_build_object('familie', substr(v, 7), 'stufe',
        (select max(s.stufe) from public.karte_stufen s where s.user_id = uid and s.familie = substr(v, 7))) order by o)
      from unnest(w.vitrine) with ordinality as x(v, o)), '[]'::jsonb),
    'motiv', coalesce(w.motiv, 'P'), 'grund', coalesce(w.grund, 'standard'), 'rahmen', coalesce(w.rahmen, 'ohne'),
    'kronen_stufe', stufe
  );
end;
$$;

-- Beide Karten einer Online-Partie, nur fuer ihre beiden Spieler. Unbeteiligte bekommen einen Fehler, keine Karte.
create or replace function public.karte_der_partie(partie uuid)
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
    raise exception 'KARTE_ANMELDUNG';
  end if;
  select * into p from public.partien_online x where x.id = partie;
  if p.id is null or (p.weiss is distinct from uid and p.schwarz is distinct from uid) then
    raise exception 'KARTE_KEINE_PARTIE';
  end if;
  -- du: welche der beiden Karten die eigene ist (statt einer Konto-Kennung)
  return jsonb_build_object(
    'w', case when p.weiss is null then null else public.karte_von(p.weiss) || jsonb_build_object('du', p.weiss = uid) end,
    's', case when p.schwarz is null then null else public.karte_von(p.schwarz) || jsonb_build_object('du', p.schwarz = uid) end
  );
end;
$$;

-- Rechte: alles zu, nur die vier Funktionen fuer angemeldete Nutzer
revoke all on function public.karte_konstanten() from public, anon, authenticated;
revoke all on function public.karte_in_liste(text, text) from public, anon, authenticated;
revoke all on function public.karte_besitz_regeln() from public, anon, authenticated;
revoke all on function public.karte_frei(uuid) from public, anon, authenticated;
revoke all on function public.karte_stufe_moeglich(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.karte_buche_stufe(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.karte_sichern(uuid) from public, anon, authenticated;
revoke all on function public.karte_banner_gutschreiben(uuid, text) from public, anon, authenticated;
revoke all on function public.karte_liga_banner_nachtragen(uuid) from public, anon, authenticated;
revoke all on function public.karte_mein_stand() from public, anon, authenticated;
revoke all on function public.karte_melde_stufen(jsonb) from public, anon, authenticated;
revoke all on function public.karte_waehle(text, text, text[], text, text, text) from public, anon, authenticated;
revoke all on function public.karte_von(uuid) from public, anon, authenticated;
revoke all on function public.karte_der_partie(uuid) from public, anon, authenticated;
grant execute on function public.karte_mein_stand() to authenticated;
grant execute on function public.karte_melde_stufen(jsonb) to authenticated;
grant execute on function public.karte_waehle(text, text, text[], text, text, text) to authenticated;
grant execute on function public.karte_der_partie(uuid) to authenticated;

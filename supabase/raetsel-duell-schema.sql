-- Raetsel-Duell (Etappe 5): zwei Spieler loesen gleichzeitig dieselben Raetsel, fest 3 Minuten, die Raetsel werden
-- schwerer, ein falscher Zug kostet 5 Sekunden und fuehrt sofort zum naechsten Raetsel, wer mehr loest, gewinnt
-- (gleich viele: weniger Fehler; auch gleich: Remis). Der Stand des Gegners ist live zu sehen (Abfrage alle 1 s).
-- Gewertet (Kronen, Liga) ueber die Gegnersuche, nach 10 s gegen einen KI-Gegner, oder Freundschaft per Code ohne Wertung.
-- Konzept: Schach-App/Konzept 2026-11-06 Spiel und Design.md, Abschnitte 5, 6 und 10b.
--
-- Der Server entscheidet alles:
--   * Die Raetsel liegen nur hier (duell_raetsel, aus raetsel-duell-daten.sql). Das Geraet sieht immer nur das aktuelle
--     Raetsel und die schon gespielten Zuege, nie die Loesung, nie die Folge, nie die Saat.
--   * Ob ein Zug richtig ist, prueft die Edge Function raetsel-duell (chess.js, ein anderes Matt im letzten Zug zaehlt);
--     verbucht wird nur ueber duell_zug_verbuchen, und das darf nur die Service-Rolle. Zeit misst der Server.
--   * Was der KI-Gegner schafft, rechnet duell_ki_verlauf aus Saat und KI-Staerke nach Serverzeit; das Geraet kann es
--     weder sehen noch aendern. Ein KI-Duell legt nur der Server an, und nur nach echten 10 s Suche.
--   * Kronen: genau einmal je Duell und Konto (ref = Duell-ID), hoechstens 20 KI-Duelle am Tag, hoechstens 3 gewertete
--     Duelle am Tag gegen dieselbe Person, ohne einen einzigen Zug keine Kronen (fuer beide).
--   * Falsche Codes beim Beitreten zaehlen in online_versuche mit (gemeinsam mit den Online-Codes, 20 am Tag).
-- Ehrliche Grenze: gegen jemanden, der nebenher eine Engine oder die oeffentliche Lichess-Datenbank fragt, hilft das nicht.
--
-- Einspielen: nach online-schema.sql und kronen-schema.sql, danach raetsel-duell-daten.sql. Wiederholbar.
-- Pruefen: raetsel-duell-rls-test.sql (rollt zurueck). Rueckweg: raetsel-duell-zurueck.sql. Rein additiv; die einzige
-- Beruehrung von Bestehendem steht in kronen-schema.sql (Quellen 'duell' und 'duell_ki').

create table if not exists public.duell_raetsel (
  id text primary key,
  fen text not null,
  loesung text[] not null,
  rating integer not null,
  themen text not null default '',
  quelle text not null default 'lichess',
  constraint duell_raetsel_id check (id ~ '^[A-Za-z0-9]{3,12}$'),
  constraint duell_raetsel_loesung check (cardinality(loesung) between 1 and 9 and cardinality(loesung) % 2 = 1),
  constraint duell_raetsel_rating check (rating between 100 and 3500)
);
create index if not exists duell_raetsel_rating on public.duell_raetsel (rating);

create table if not exists public.duelle (
  id uuid primary key default gen_random_uuid(),
  art text not null,
  code text unique,
  a uuid not null references auth.users (id) on delete cascade,
  b uuid references auth.users (id) on delete cascade,
  ki_elo integer,
  seed text not null,
  raetsel text[] not null,
  status text not null,
  start_am timestamptz,
  dauer_s integer not null default 180,
  ergebnis text,
  erstellt_am timestamptz not null default now(),
  constraint duelle_art check (art in ('gewertet', 'freundschaft', 'ki')),
  constraint duelle_status check (status in ('offen', 'laeuft', 'beendet', 'abgebrochen')),
  constraint duelle_ergebnis check (ergebnis is null or ergebnis in ('a', 'b', 'remis')),
  constraint duelle_ki check ((art = 'ki') = (ki_elo is not null) and (art <> 'ki' or b is null)),
  constraint duelle_code check (code is null or code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'),
  constraint duelle_verschieden check (b is null or a <> b),
  constraint duelle_gestartet check (status = 'offen' or start_am is not null)
);
create index if not exists duelle_a on public.duelle (a, erstellt_am);
create index if not exists duelle_b on public.duelle (b, erstellt_am);

-- je Duell und Spieler: idx = aktuelles Raetsel (ab 0), schritt = Zahl der schon gespielten Halbzuege darin (gerade)
create table if not exists public.duell_spieler (
  duell uuid not null references public.duelle (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  idx integer not null default 0,
  schritt integer not null default 0,
  geloest integer not null default 0,
  fehler integer not null default 0,
  zuege integer not null default 0,
  letzter_zug_am timestamptz,
  primary key (duell, user_id),
  constraint duell_spieler_zahlen check (idx >= 0 and schritt >= 0 and schritt % 2 = 0 and geloest >= 0 and fehler >= 0
    and zuege >= 0)
);
create index if not exists duell_spieler_user on public.duell_spieler (user_id);

create table if not exists public.duell_warteschlange (
  user_id uuid primary key references auth.users (id) on delete cascade,
  elo integer not null,
  seit timestamptz not null default now()
);

alter table public.duell_raetsel enable row level security;
alter table public.duelle enable row level security;
alter table public.duell_spieler enable row level security;
alter table public.duell_warteschlange enable row level security;
-- keine Policies und kein Tabellenrecht: gelesen wird nur ueber die Funktionen unten
revoke all on table public.duell_raetsel, public.duelle, public.duell_spieler, public.duell_warteschlange
  from anon, authenticated, public;

-- Alle Zahlen an einer Stelle (gespiegelt in js/pakete/raetsel-duell/logik.js, Vertragstest tests/raetsel-duell.test.mjs)
create or replace function public.duell_konstanten()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'dauer_s', 180,
    'strafe_s', 5,
    'vorlauf_s', 3,
    'raetsel_anzahl', 50,
    'rampe_von', 600,
    'rampe_bis', 2450,
    'rampe_fenster', 60,
    'ki_warte_s', 10,
    'ki_tagesgrenze', 20,
    'paar_tagesgrenze', 3,
    'einladung_stunden', 24
  );
$$;

-- Raetsel-Folge aus der Saat: Raetsel i (0 bis 49) hat eine Wertung nahe rampe_von + i * (rampe_bis - rampe_von) / 49,
-- gewaehlt per md5(Saat:id) im Fenster +-rampe_fenster; fehlt dort eins, das naechstgelegene. Gleiche Saat, gleiche Folge.
create or replace function public.duell_folge(saat text)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k jsonb := public.duell_konstanten();
  n integer := (k->>'raetsel_anzahl')::integer;
  von numeric := (k->>'rampe_von')::numeric;
  bis numeric := (k->>'rampe_bis')::numeric;
  fenster integer := (k->>'rampe_fenster')::integer;
  folge text[] := '{}';
  ziel integer;
  r text;
  i integer;
begin
  for i in 0..n - 1 loop
    ziel := round(von + i * (bis - von) / (n - 1));
    select d.id into r from public.duell_raetsel d
    where d.rating between ziel - fenster and ziel + fenster and d.id <> all (folge)
    order by md5(saat || ':' || d.id)
    limit 1;
    if r is null then
      select d.id into r from public.duell_raetsel d
      where d.id <> all (folge)
      order by abs(d.rating - ziel), md5(saat || ':' || d.id)
      limit 1;
    end if;
    exit when r is null;
    folge := folge || r;
  end loop;
  return folge;
end;
$$;

-- Zufallszahl 0 bis unter 1 aus Saat, Raetsel-Nummer und Zweck (rein, wiederholbar)
create or replace function public.duell_zufall(saat text, i integer, zweck text)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select ('x' || substr(md5(saat || ':' || i || ':' || zweck), 1, 8))::bit(32)::bigint / 4294967296.0;
$$;

-- Was der KI-Gegner nach `sekunden` geschafft hat: { geloest, fehler, idx }. Raetsel i loest er mit der Elo-Chance
-- 1 / (1 + 10^((r - elo) / 400)) und braucht dafuer (3 + 9 (r / elo)^2) * (0,6 bis 1,4) Sekunden, begrenzt auf 2 bis 40.
-- Ein Fehler kostet auch ihn 5 s. Rein und wiederholbar, ohne Uhr: dieselben Eingaben, dasselbe Ergebnis.
create or replace function public.duell_ki_verlauf(saat text, ki_elo integer, ratings integer[], sekunden numeric)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  k jsonb := public.duell_konstanten();
  ende numeric := (k->>'dauer_s')::numeric;
  strafe numeric := (k->>'strafe_s')::numeric;
  t numeric := 0;
  geloest integer := 0;
  fehler integer := 0;
  i integer;
  r numeric;
  d numeric;
begin
  for i in 1..coalesce(cardinality(ratings), 0) loop
    r := ratings[i];
    d := least(40, greatest(2, (3 + 9 * power(r / ki_elo, 2)) * (0.6 + 0.8 * public.duell_zufall(saat, i, 'zeit'))));
    exit when t + d > least(sekunden, ende);
    t := t + d;
    if public.duell_zufall(saat, i, 'loest') < 1 / (1 + power(10, (r - ki_elo) / 400.0)) then
      geloest := geloest + 1;
    else
      fehler := fehler + 1;
      ende := ende - strafe;
    end if;
  end loop;
  return jsonb_build_object('geloest', geloest, 'fehler', fehler, 'idx', geloest + fehler);
end;
$$;

-- Neues Duell anlegen (nur intern: Gegnersuche, KI-Ersatz, Einladung). Gewertet und KI starten sofort (nach 3 s
-- Vorlauf), eine Freundschaft ist bis zum Beitritt offen und bekommt einen Code. Antwort: die Duell-ID.
create or replace function public.duell_anlegen(art text, a uuid, b uuid, ki_elo integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  zeichen constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  saat text := pg_catalog.gen_random_uuid()::text;
  zufall bytea;
  c text;
  i integer;
  d uuid;
  offen boolean := duell_anlegen.art = 'freundschaft' and duell_anlegen.b is null;
begin
  if offen then
    loop
      c := '';
      zufall := pg_catalog.uuid_send(pg_catalog.gen_random_uuid());
      for i in 0..5 loop
        c := c || substr(zeichen, 1 + (get_byte(zufall, i) % 32), 1);
      end loop;
      exit when not exists (select 1 from public.duelle x where x.code = c);
    end loop;
  end if;
  insert into public.duelle (art, code, a, b, ki_elo, seed, raetsel, status, start_am)
  values (duell_anlegen.art, c, duell_anlegen.a, duell_anlegen.b, duell_anlegen.ki_elo, saat, public.duell_folge(saat),
          case when offen then 'offen' else 'laeuft' end,
          case when offen then null
               else now() + make_interval(secs => (public.duell_konstanten()->>'vorlauf_s')::integer) end)
  returning id into d;
  insert into public.duell_spieler (duell, user_id) values (d, duell_anlegen.a);
  if duell_anlegen.b is not null then
    insert into public.duell_spieler (duell, user_id) values (d, duell_anlegen.b);
  end if;
  return d;
end;
$$;

-- Eigenes Ende eines Spielers: Start + 180 s - 5 s je Fehler
create or replace function public.duell_ende_am(start_am timestamptz, dauer_s integer, fehler integer)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select start_am + make_interval(secs => dauer_s - (public.duell_konstanten()->>'strafe_s')::integer * fehler);
$$;

-- Wertungen der Folge eines Duells (fuer den KI-Gegner)
create or replace function public.duell_ratings(d public.duelle)
returns integer[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(r.rating order by u.n), '{}') from unnest(d.raetsel) with ordinality u(id, n)
  join public.duell_raetsel r on r.id = u.id;
$$;

-- Stand des KI-Gegners zur Serverzeit
create or replace function public.duell_ki_jetzt(d public.duelle)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.duell_ki_verlauf(d.seed, d.ki_elo, public.duell_ratings(d),
    greatest(0, extract(epoch from now() - d.start_am))::numeric);
$$;

-- Wertet ein laufendes Duell aus, sobald beide Zeiten um sind, und bucht Kronen genau einmal. Nur intern (und ueber
-- duell_stand). Antwort: das Duell nach der Auswertung (unveraendert, wenn es noch laeuft).
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
  quelle text;
  paar integer;
begin
  select * into d from public.duelle x where x.id = duell_auswerten.duell for update;
  if d.id is null or d.status <> 'laeuft' then
    return d;
  end if;
  select * into sa from public.duell_spieler s where s.duell = d.id and s.user_id = d.a;
  if d.art = 'ki' then
    ki := public.duell_ki_verlauf(d.seed, d.ki_elo, public.duell_ratings(d), d.dauer_s);
    gb := (ki->>'geloest')::integer;
    fb := (ki->>'fehler')::integer;
    -- die KI ist fertig, wenn die ganze Zeit um ist
    if now() < d.start_am + make_interval(secs => d.dauer_s)
       or now() < public.duell_ende_am(d.start_am, d.dauer_s, sa.fehler) then
      return d;
    end if;
  else
    select * into sb from public.duell_spieler s where s.duell = d.id and s.user_id = d.b;
    gb := sb.geloest;
    fb := sb.fehler;
    if now() < public.duell_ende_am(d.start_am, d.dauer_s, sa.fehler)
       or now() < public.duell_ende_am(d.start_am, d.dauer_s, sb.fehler) then
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
  -- ohne einen einzigen Zug keine Kronen, fuer beide (gegen Absprachen mit einem Zweitkonto)
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
  -- gewertet: beide Konten nacheinander sperren (feste Reihenfolge, kein Verklemmen)
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('kronen-melden:' || least(d.a, d.b)::text));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('kronen-melden:' || greatest(d.a, d.b)::text));
  select count(*)::integer into paar from public.kronen_buchungen kb
  join public.duelle x on x.id::text = kb.ref
  where kb.user_id = d.a and kb.quelle = 'duell' and x.id <> d.id and d.b in (x.a, x.b)
    and kb.am >= (public.kronen_heute()::timestamp at time zone 'Europe/Berlin');
  if paar >= (k->>'paar_tagesgrenze')::integer then
    return d;
  end if;
  perform public.kronen_einfach_buchen(d.a, 'duell', d.id::text,
    case erg when 'a' then 'sieg' when 'b' then 'niederlage' else 'remis' end);
  perform public.kronen_einfach_buchen(d.b, 'duell', d.id::text,
    case erg when 'b' then 'sieg' when 'a' then 'niederlage' else 'remis' end);
  return d;
end;
$$;

-- Aktuelles Raetsel eines Spielers fuer die Anzeige: { nr, fen, bisher } (bisher = schon gespielte Halbzuege), nie die
-- Loesung. null, wenn alle Raetsel durch sind.
create or replace function public.duell_raetsel_anzeige(d public.duelle, s public.duell_spieler)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when r.id is null then null else jsonb_build_object(
    'nr', s.idx + 1,
    'fen', r.fen,
    'bisher', to_jsonb(coalesce(r.loesung[1:s.schritt], '{}'::text[])),
    'rating', r.rating) end
  from (select 1) eins
  left join public.duell_raetsel r on r.id = d.raetsel[s.idx + 1];
$$;

-- Gemeinsame Form eines Spielerstands
create or replace function public.duell_spieler_json(geloest integer, fehler integer, ende_am timestamptz)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('geloest', geloest, 'fehler', fehler, 'ende_am', ende_am);
$$;

-- ---------- fuer angemeldete Nutzer ----------

-- Laufendes Duell aus der Gegnersuche der letzten 60 s (sonst null)
create or replace function public.duell_suche_duell(uid uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select x.id from public.duelle x
  where x.art = 'gewertet' and x.status = 'laeuft' and uid in (x.a, x.b) and x.erstellt_am > now() - interval '60 seconds'
  order by x.erstellt_am desc
  limit 1;
$$;

-- Paart wie online_suche_paaren: +-200 Elo, je Sekunde Wartezeit 50 breiter. Treffer: gewertetes Duell, beide Zeilen weg.
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
  where q.user_id <> uid and abs(q.elo - ich.elo) <= 200 + 50 * extract(epoch from now() - least(q.seit, ich.seit))
  order by q.seit
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

-- Suche starten oder fortsetzen. Antwort { duell } oder { wartet: true }.
create or replace function public.duell_suche_start()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  st public.kronen_stand;
  d uuid;
begin
  if uid is null then
    raise exception 'DUELL_ANMELDUNG';
  end if;
  delete from public.duell_warteschlange q where q.seit < now() - interval '2 minutes';
  d := public.duell_suche_duell(uid);
  if d is not null then
    return jsonb_build_object('duell', d);
  end if;
  st := public.kronen_stand_sichern(uid);
  insert into public.duell_warteschlange as q (user_id, elo) values (uid, st.elo)
  on conflict (user_id) do update set elo = excluded.elo;
  d := public.duell_suche_paaren(uid);
  if d is not null then
    return jsonb_build_object('duell', d);
  end if;
  return jsonb_build_object('wartet', true);
end;
$$;

-- Abfrage waehrend der Suche
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
  return jsonb_build_object('wartet', true);
end;
$$;

-- Suche beenden. Mit ki = true und nach mindestens 10 s ohne Paarung legt der Server ein KI-Duell an: { duell }.
-- Die KI-Staerke ist die eigene Elo aus kronen_stand (das Geraet nennt keine Zahl).
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
  delete from public.duell_warteschlange q where q.user_id = uid returning q.seit, q.elo into seit_war, elo_war;
  if ki is true and seit_war is not null
     and seit_war <= now() - make_interval(secs => (public.duell_konstanten()->>'ki_warte_s')::integer)
     and public.duell_suche_duell(uid) is null then
    d := public.duell_anlegen('ki', uid, null, elo_war);
    return jsonb_build_object('duell', d);
  end if;
  return '{}'::jsonb;
end;
$$;

-- Freundschafts-Duell anlegen: { duell, code }. Hoechstens 5 offene Einladungen je Konto.
create or replace function public.duell_einladen()
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
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('duell-einladen:' || uid::text));
  delete from public.duelle x where x.status = 'offen'
    and x.erstellt_am < now() - make_interval(hours => (public.duell_konstanten()->>'einladung_stunden')::integer);
  if (select count(*) from public.duelle x where x.a = uid and x.status = 'offen') >= 5 then
    return jsonb_build_object('fehler', 'DUELL_ZU_VIELE_EINLADUNGEN');
  end if;
  d := public.duell_anlegen('freundschaft', uid, null, null);
  return jsonb_build_object('duell', d, 'code', (select x.code from public.duelle x where x.id = d));
end;
$$;

-- Einem Freundschafts-Duell beitreten. Gross/klein, Leerzeichen und Bindestriche egal. Antwort { duell } oder
-- { fehler: 'DUELL_CODE' | 'DUELL_ZU_VIELE_VERSUCHE' }. Falsche Codes zaehlen in online_versuche (kein raise, das
-- rollte den Zaehler zurueck). Wer schon im Duell ist, bekommt es zurueck (kein Fehlversuch).
create or replace function public.duell_beitreten(code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  c text := upper(regexp_replace(coalesce(duell_beitreten.code, ''), '[^A-Za-z0-9]', '', 'g'));
  heute date := (now() at time zone 'Europe/Berlin')::date;
  d public.duelle;
begin
  if uid is null then
    raise exception 'DUELL_ANMELDUNG';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('online_versuche:' || uid::text, 0));
  if coalesce((select v.anzahl from public.online_versuche v where v.user_id = uid and v.tag = heute), 0) >= 20 then
    return jsonb_build_object('fehler', 'DUELL_ZU_VIELE_VERSUCHE');
  end if;
  if c ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$' then
    select * into d from public.duelle x where x.code = c for update;
  end if;
  if d.id is not null and uid in (d.a, d.b) then
    return jsonb_build_object('duell', d.id);
  end if;
  if d.id is null or d.status <> 'offen' or d.b is not null
     or d.erstellt_am < now() - make_interval(hours => (public.duell_konstanten()->>'einladung_stunden')::integer) then
    delete from public.online_versuche v where v.tag < heute - 2;
    insert into public.online_versuche as v (user_id, tag, anzahl) values (uid, heute, 1)
    on conflict (user_id, tag) do update set anzahl = v.anzahl + 1;
    return jsonb_build_object('fehler', 'DUELL_CODE');
  end if;
  update public.duelle x
  set b = uid, status = 'laeuft', start_am = now() + make_interval(secs => (public.duell_konstanten()->>'vorlauf_s')::integer)
  where x.id = d.id;
  insert into public.duell_spieler (duell, user_id) values (d.id, uid);
  return jsonb_build_object('duell', d.id);
end;
$$;

-- Stand eines Duells fuer einen Teilnehmer (Abfrage alle 1 s). Wertet aus, sobald beide Zeiten um sind.
-- Antwort { duell, art, status, jetzt, start_am, ich, gegner, raetsel, ergebnis, kronen_delta } oder
-- { fehler: 'DUELL_UNBEKANNT' }. ergebnis aus eigener Sicht: 'sieg' | 'remis' | 'niederlage'.
create or replace function public.duell_stand(duell uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  d public.duelle;
  ich public.duell_spieler;
  er public.duell_spieler;
  gegner jsonb;
  ki jsonb;
  erg text;
  delta integer;
  rae jsonb;
begin
  if uid is null then
    raise exception 'DUELL_ANMELDUNG';
  end if;
  select * into d from public.duelle x where x.id = duell_stand.duell;
  if d.id is null or uid not in (d.a, coalesce(d.b, d.a)) then
    return jsonb_build_object('fehler', 'DUELL_UNBEKANNT');
  end if;
  -- auswerten prueft selbst, ob beide Zeiten um sind
  if d.status = 'laeuft' and now() >= d.start_am then
    d := public.duell_auswerten(d.id);
  end if;
  select * into ich from public.duell_spieler s where s.duell = d.id and s.user_id = uid;
  if d.art = 'ki' then
    ki := case when d.status = 'beendet'
               then public.duell_ki_verlauf(d.seed, d.ki_elo, public.duell_ratings(d), d.dauer_s)
               when d.start_am is null or now() < d.start_am then '{"geloest": 0, "fehler": 0}'::jsonb
               else public.duell_ki_jetzt(d) end;
    gegner := public.duell_spieler_json((ki->>'geloest')::integer, (ki->>'fehler')::integer,
                public.duell_ende_am(d.start_am, d.dauer_s, (ki->>'fehler')::integer))
              || jsonb_build_object('ki', true, 'elo', d.ki_elo);
  else
    select * into er from public.duell_spieler s where s.duell = d.id and s.user_id <> uid;
    gegner := case when er.user_id is null then null
                   else public.duell_spieler_json(er.geloest, er.fehler, public.duell_ende_am(d.start_am, d.dauer_s, er.fehler))
                        || jsonb_build_object('ki', false) end;
  end if;
  if d.status = 'laeuft' and now() >= d.start_am and now() < public.duell_ende_am(d.start_am, d.dauer_s, ich.fehler) then
    rae := public.duell_raetsel_anzeige(d, ich);
  end if;
  if d.status = 'beendet' then
    erg := case when d.ergebnis = 'remis' then 'remis'
                when (d.ergebnis = 'a') = (uid = d.a) then 'sieg' else 'niederlage' end;
    delta := coalesce((select kb.delta from public.kronen_buchungen kb
                       where kb.user_id = uid and kb.quelle in ('duell', 'duell_ki') and kb.ref = d.id::text), 0);
  end if;
  return jsonb_build_object(
    'duell', d.id, 'art', d.art, 'status', d.status, 'jetzt', now(), 'start_am', d.start_am, 'dauer_s', d.dauer_s,
    'code', case when d.status = 'offen' then d.code end,
    'ich', public.duell_spieler_json(ich.geloest, ich.fehler, public.duell_ende_am(d.start_am, d.dauer_s, ich.fehler)),
    'gegner', gegner, 'raetsel', rae, 'ergebnis', erg, 'kronen_delta', delta);
end;
$$;

-- ---------- nur fuer die Service-Rolle (Edge Function raetsel-duell) ----------

-- Lage eines Spielers MIT Loesung, damit die Edge Function den Zug pruefen kann: { idx, schritt, fen, loesung, ende_am,
-- start_am, status } oder raise DUELL_UNBEKANNT.
create or replace function public.duell_zug_lage(nutzer uuid, duell uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d public.duelle;
  s public.duell_spieler;
  r public.duell_raetsel;
begin
  select * into d from public.duelle x where x.id = duell_zug_lage.duell;
  select * into s from public.duell_spieler x where x.duell = duell_zug_lage.duell and x.user_id = nutzer;
  if d.id is null or s.user_id is null then
    raise exception 'DUELL_UNBEKANNT';
  end if;
  select * into r from public.duell_raetsel x where x.id = d.raetsel[s.idx + 1];
  return jsonb_build_object('idx', s.idx, 'schritt', s.schritt, 'fen', r.fen, 'loesung', to_jsonb(r.loesung),
    'status', d.status, 'start_am', d.start_am, 'ende_am', public.duell_ende_am(d.start_am, d.dauer_s, s.fehler));
end;
$$;

-- Verbucht einen geprueften Zug. idx_vorher/schritt_vorher = Stand, auf dem die Edge Function geprueft hat (sonst
-- DUELL_STAND_VERALTET). richtig + fertig = Raetsel geloest; richtig ohne fertig = Zwischenzug (schritt + 2, die Antwort
-- des Gegners steht danach in bisher); falsch = Fehler, 5 s Abzug, naechstes Raetsel. ankunft misst die Edge Function;
-- sie wird auf [letzter Zug bzw. Start, jetzt] begrenzt. Antwort { idx, schritt, geloest, fehler, ende_am, naechstes }.
-- Fehler (raise): DUELL_UNBEKANNT, DUELL_BEENDET, DUELL_NICHT_GESTARTET, DUELL_ZEIT_UM, DUELL_FERTIG, DUELL_STAND_VERALTET.
create or replace function public.duell_zug_verbuchen(nutzer uuid, duell uuid, idx_vorher integer, schritt_vorher integer,
  richtig boolean, fertig boolean, ankunft timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.duelle;
  s public.duell_spieler;
  zeit timestamptz;
begin
  select * into d from public.duelle x where x.id = duell_zug_verbuchen.duell;
  select * into s from public.duell_spieler x where x.duell = duell_zug_verbuchen.duell and x.user_id = nutzer for update;
  if d.id is null or s.user_id is null then
    raise exception 'DUELL_UNBEKANNT';
  end if;
  if d.status <> 'laeuft' then
    raise exception 'DUELL_BEENDET';
  end if;
  if now() < d.start_am then
    raise exception 'DUELL_NICHT_GESTARTET';
  end if;
  zeit := least(greatest(coalesce(ankunft, now()), coalesce(s.letzter_zug_am, d.start_am)), now());
  if zeit >= public.duell_ende_am(d.start_am, d.dauer_s, s.fehler) then
    raise exception 'DUELL_ZEIT_UM';
  end if;
  if s.idx >= cardinality(d.raetsel) then
    raise exception 'DUELL_FERTIG';
  end if;
  if s.idx <> idx_vorher or s.schritt <> schritt_vorher then
    raise exception 'DUELL_STAND_VERALTET';
  end if;
  if richtig and not fertig then
    update public.duell_spieler x set schritt = x.schritt + 2, zuege = x.zuege + 1, letzter_zug_am = zeit
    where x.duell = s.duell and x.user_id = s.user_id returning * into s;
  else
    update public.duell_spieler x
    set idx = x.idx + 1, schritt = 0, zuege = x.zuege + 1, letzter_zug_am = zeit,
        geloest = x.geloest + case when richtig then 1 else 0 end,
        fehler = x.fehler + case when richtig then 0 else 1 end
    where x.duell = s.duell and x.user_id = s.user_id returning * into s;
  end if;
  return jsonb_build_object('idx', s.idx, 'schritt', s.schritt, 'geloest', s.geloest, 'fehler', s.fehler,
    'ende_am', public.duell_ende_am(d.start_am, d.dauer_s, s.fehler),
    'naechstes', public.duell_raetsel_anzeige(d, s));
end;
$$;

-- ---------- Rechte ----------
revoke all on function public.duell_konstanten() from public, anon, authenticated;
revoke all on function public.duell_folge(text) from public, anon, authenticated;
revoke all on function public.duell_zufall(text, integer, text) from public, anon, authenticated;
revoke all on function public.duell_ki_verlauf(text, integer, integer[], numeric) from public, anon, authenticated;
revoke all on function public.duell_anlegen(text, uuid, uuid, integer) from public, anon, authenticated, service_role;
revoke all on function public.duell_ende_am(timestamptz, integer, integer) from public, anon, authenticated;
revoke all on function public.duell_ratings(public.duelle) from public, anon, authenticated;
revoke all on function public.duell_ki_jetzt(public.duelle) from public, anon, authenticated;
revoke all on function public.duell_auswerten(uuid) from public, anon, authenticated, service_role;
revoke all on function public.duell_raetsel_anzeige(public.duelle, public.duell_spieler) from public, anon, authenticated;
revoke all on function public.duell_spieler_json(integer, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.duell_suche_duell(uuid) from public, anon, authenticated;
revoke all on function public.duell_suche_paaren(uuid) from public, anon, authenticated;
revoke all on function public.duell_suche_start() from public, anon, authenticated;
revoke all on function public.duell_suche_stand() from public, anon, authenticated;
revoke all on function public.duell_suche_ende(boolean) from public, anon, authenticated;
revoke all on function public.duell_einladen() from public, anon, authenticated;
revoke all on function public.duell_beitreten(text) from public, anon, authenticated;
revoke all on function public.duell_stand(uuid) from public, anon, authenticated;
revoke all on function public.duell_zug_lage(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.duell_zug_verbuchen(uuid, uuid, integer, integer, boolean, boolean, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.duell_konstanten() to authenticated;
grant execute on function public.duell_suche_start() to authenticated;
grant execute on function public.duell_suche_stand() to authenticated;
grant execute on function public.duell_suche_ende(boolean) to authenticated;
grant execute on function public.duell_einladen() to authenticated;
grant execute on function public.duell_beitreten(text) to authenticated;
grant execute on function public.duell_stand(uuid) to authenticated;
grant execute on function public.duell_zug_lage(uuid, uuid) to service_role;
grant execute on function public.duell_zug_verbuchen(uuid, uuid, integer, integer, boolean, boolean, timestamptz) to service_role;

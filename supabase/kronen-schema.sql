-- Liga mit Kronen, Etappe B Task 2: Stand, Buchungen, Saison-Archiv und Schalter.
-- Plan: docs/superpowers/plans/2026-11-07-etappe-b-liga-kronen.md. Die Zahlen stehen gleich in js/pakete/liga/kronen.js
-- (Vertragstest tests/kronen-vertrag.test.mjs); alle Zahlen entschieden 06.11.2026.
--
-- Kronen sind die einzige sichtbare Rang-Zahl. 18 Stufen (Holz, Bronze, Silber, Gold, Diamant, Krone, je III, II, I),
-- 100 Kronen je Stufe, Krone I ab 1700. Saison 28 Tage ab einem Montag, Europe/Berlin, Serverzeit. Der erste Start ist
-- eine Einstellung (kronen_schalter.saison_start): leer = Saison 0, kein Wechsel. Beim Live-Gang setzen:
--   update public.kronen_schalter set saison_start = '<erster Montag nach dem Live-Gang>';
-- Saisonwechsel: das Ergebnis der alten Saison geht ins Archiv, die Kronen fallen um 3 Stufen auf den Anfang der
-- Zielstufe. Der Wechsel von Saison 0 auf 1 stuft nicht zurueck (die Start-Liga aus Task 6 bleibt erhalten).
-- Innerhalb einer Saison faellt niemand unter den Anfang der erreichten Liga (Spalte boden; gebucht wird ab Task 3).
--
-- Der Server entscheidet: Nutzer haben keine Tabellenrechte, sie lesen ihren Stand nur ueber kronen_mein_stand().
-- Einspielen: nach supabase/online-schema.sql im SQL Editor ausfuehren. Wiederholbar (mehrfach ausfuehren schadet nicht).
-- Pruefen: supabase/kronen-rls-test.sql (rollt am Ende alles zurueck). Rueckweg: supabase/kronen-zurueck.sql.
-- Fast rein additiv: neue Tabellen und Funktionen. Einzige Aenderung an Bestehendem (Task 3): die Spalte
-- partien_online.gewertet (Vorgabe false, alte Zeilen bleiben ungewertet) und der Trigger kronen_nach_partie darauf.
-- Keine Zeilen werden umgeschrieben.

create table if not exists public.kronen_schalter (
  id boolean primary key default true,
  zaehler_an boolean not null default false,
  saison_start date,
  constraint kronen_schalter_eine_zeile check (id),
  -- eine Saison beginnt immer montags (ISO-Wochentag 1)
  constraint kronen_schalter_montag check (saison_start is null or extract(isodow from saison_start) = 1)
);
insert into public.kronen_schalter (id) values (true) on conflict (id) do nothing;

create table if not exists public.kronen_stand (
  user_id uuid primary key references auth.users (id) on delete cascade,
  saison integer not null default 0,
  kronen integer not null default 0,
  boden integer not null default 0,
  elo integer not null default 1000,
  elo_n integer not null default 0,
  start_gesetzt boolean not null default false,
  aktualisiert_am timestamptz not null default now(),
  constraint kronen_stand_saison check (saison >= 0),
  constraint kronen_stand_kronen check (kronen >= 0),
  constraint kronen_stand_boden check (boden >= 0 and boden <= kronen),
  constraint kronen_stand_elo check (elo between 100 and 4000),
  constraint kronen_stand_elo_n check (elo_n >= 0)
);

create table if not exists public.kronen_buchungen (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  quelle text not null,
  ref text not null,
  delta integer not null,
  saison integer not null,
  am timestamptz not null default now(),
  constraint kronen_buchungen_quelle check (quelle in ('online', 'ki', 'bot', 'start', 'saison')),
  constraint kronen_buchungen_ref check (char_length(ref) between 1 and 64),
  -- jede Partie, jeder Beleg und jeder Saisonwechsel wird je Konto hoechstens einmal gebucht
  constraint kronen_buchungen_einmal unique (user_id, quelle, ref)
);
-- fuer die Tagesgrenzen (Task 5): Buchungen je Konto, Quelle und Zeit
create index if not exists kronen_buchungen_tag on public.kronen_buchungen (user_id, quelle, am);

create table if not exists public.kronen_archiv (
  user_id uuid not null references auth.users (id) on delete cascade,
  saison integer not null,
  kronen integer not null,
  stufe integer not null,
  primary key (user_id, saison),
  constraint kronen_archiv_stufe check (stufe between 0 and 17)
);

alter table public.kronen_schalter enable row level security;
alter table public.kronen_stand enable row level security;
alter table public.kronen_buchungen enable row level security;
alter table public.kronen_archiv enable row level security;
-- keine Policies: ohne Policy sieht ein Nutzer keine Zeile; dazu kein Tabellenrecht (Supabase vergibt sonst Standardrechte)
revoke all on table public.kronen_schalter, public.kronen_stand, public.kronen_buchungen, public.kronen_archiv
  from anon, authenticated, public;
revoke all on sequence public.kronen_buchungen_id_seq from anon, authenticated, public;

-- Alle Zahlen an einer Stelle (Vertragstest mit js/pakete/liga/kronen.js), dazu der eingestellte Saisonstart
create or replace function public.kronen_konstanten()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'stufe_kronen', 100,
    'stufen_je_liga', 3,
    'stufen_anzahl', 18,
    'kronen', jsonb_build_object(
      'online', jsonb_build_object('sieg', 30, 'remis', 10, 'niederlage', -15),
      'ki', jsonb_build_object('sieg', 20, 'remis', 5, 'niederlage', -10),
      'bot', jsonb_build_object('sieg', 15, 'remis', 5, 'niederlage', 0)
    ),
    'bot_tagesgrenze', 10,
    'ki_tagesgrenze', 20,
    'ki_mindestdauer_s', 60,
    'online_mindest_halbzuege', 4,
    'paar_tagesgrenze', 3,
    'saison_tage', 28,
    'rueckstufung_stufen', 3,
    'saison_start', (select s.saison_start from public.kronen_schalter s where s.id)
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

-- Saisonnummer an einem Tag: 0 ohne Start oder vor dem Start, sonst 1, 2, ... je 28 Tage
create or replace function public.kronen_saison_am(tag date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  -- ohne Schalter-Zeile ebenfalls 0 (nie NULL)
  select coalesce((
    select case
      when s.saison_start is null or tag is null or tag < s.saison_start then 0
      else (tag - s.saison_start) / 28 + 1
    end
    from public.kronen_schalter s
    where s.id
  ), 0);
$$;

create or replace function public.kronen_saison_heute()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select public.kronen_saison_am(public.kronen_heute());
$$;

-- Stufe 0 (Holz III) bis 17 (Krone I); unsinnige Eingaben ergeben 0
create or replace function public.kronen_stufe(kronen integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when kronen is null or kronen < 0 then 0 else least(17, kronen / 100) end;
$$;

-- Anfang der Liga der Stufe (Holz 0, Bronze 300, Silber 600, Gold 900, Diamant 1200, Krone 1500)
create or replace function public.kronen_liga_boden(kronen integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (public.kronen_stufe(kronen) / 3) * 300;
$$;

-- Rueckstufung zum Saisonende: 3 Stufen tiefer, auf den Anfang der Zielstufe, nie unter 0
create or replace function public.kronen_rueckstufen(kronen integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select greatest(0, public.kronen_stufe(kronen) - 3) * 100;
$$;

-- Legt den Stand eines Kontos an und fuehrt faellige Saisonwechsel aus. Nur intern (kronen_mein_stand, spaetere Tasks).
-- Ruht ein Konto mehrere Saisons, wird je verpasster Saison einmal zurueckgestuft; ins Archiv kommt nur die Saison,
-- in der das Konto zuletzt stand (die ruhenden Saisons haben kein eigenes Ergebnis).
create or replace function public.kronen_stand_sichern(uid uuid)
returns public.kronen_stand
language plpgsql
security definer
set search_path = ''
as $$
declare
  st public.kronen_stand;
  heute_nr integer := public.kronen_saison_heute();
  alt integer;
  neu integer;
  nr integer;
begin
  if uid is null then
    raise exception 'KRONEN_ANMELDUNG';
  end if;
  insert into public.kronen_stand (user_id, saison) values (uid, heute_nr) on conflict (user_id) do nothing;
  select * into st from public.kronen_stand k where k.user_id = uid for update;
  if st.saison >= heute_nr then
    return st;
  end if;
  -- Saison 0 (vor dem ersten Start) wird weder archiviert noch zurueckgestuft
  if st.saison > 0 then
    insert into public.kronen_archiv (user_id, saison, kronen, stufe)
    values (uid, st.saison, st.kronen, public.kronen_stufe(st.kronen))
    on conflict (user_id, saison) do nothing;
  end if;
  alt := st.kronen;
  neu := st.kronen;
  nr := st.saison;
  while nr < heute_nr loop
    nr := nr + 1;
    if nr > 1 then
      neu := public.kronen_rueckstufen(neu);
      insert into public.kronen_buchungen (user_id, quelle, ref, delta, saison)
      values (uid, 'saison', 'saison-' || nr, neu - alt, nr)
      on conflict (user_id, quelle, ref) do nothing;
      alt := neu;
    end if;
  end loop;
  update public.kronen_stand k
  set saison = heute_nr, kronen = neu, boden = public.kronen_liga_boden(neu), aktualisiert_am = now()
  where k.user_id = uid
  returning * into st;
  return st;
end;
$$;

-- Der eigene Stand fuer die App (Startseite, Lobby)
create or replace function public.kronen_mein_stand()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  st public.kronen_stand;
  stufe integer;
begin
  st := public.kronen_stand_sichern(auth.uid());
  stufe := public.kronen_stufe(st.kronen);
  return jsonb_build_object(
    'saison', st.saison,
    'kronen', st.kronen,
    'stufe', stufe,
    'boden', st.boden,
    'naechste', case when stufe < 17 then (stufe + 1) * 100 else null end
  );
end;
$$;

-- Rechte: alles zu, nur Stand und Konstanten fuer angemeldete Nutzer
revoke all on function public.kronen_konstanten() from public, anon, authenticated;
revoke all on function public.kronen_heute() from public, anon, authenticated;
revoke all on function public.kronen_saison_am(date) from public, anon, authenticated;
revoke all on function public.kronen_saison_heute() from public, anon, authenticated;
revoke all on function public.kronen_stufe(integer) from public, anon, authenticated;
revoke all on function public.kronen_liga_boden(integer) from public, anon, authenticated;
revoke all on function public.kronen_rueckstufen(integer) from public, anon, authenticated;
revoke all on function public.kronen_stand_sichern(uuid) from public, anon, authenticated;
revoke all on function public.kronen_mein_stand() from public, anon, authenticated;
grant execute on function public.kronen_mein_stand() to authenticated;
grant execute on function public.kronen_konstanten() to authenticated;

-- ---------- Task 3: Online-Ergebnis bucht Kronen und Elo ----------
-- Nur Partien aus der Gegnersuche (Task 4) zaehlen; Einladungs-Partien unter Freunden bleiben ohne Kronen.
-- Einzige Aenderung an einer bestehenden Tabelle; Rueckweg in kronen-zurueck.sql.
alter table public.partien_online add column if not exists gewertet boolean not null default false;

-- Bucht eine Online-Partie fuer einen Spieler: Kronen mit Liga-Boden, Elo neu. Je Partie und Konto hoechstens einmal
-- (kronen_buchungen_einmal); nur bei einer neuen Buchung aendert sich der Stand. In der Buchung steht die
-- tatsaechliche Aenderung (bei 0 Kronen ist eine Niederlage eine Buchung mit 0).
create or replace function public.kronen_online_buchen(uid uuid, partie uuid, punkte numeric, gegner_elo integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  st public.kronen_stand;
  nominal integer;
  neu integer;
  k integer;
  erwartet numeric;
  neu_elo integer;
  gebucht integer;
begin
  st := public.kronen_stand_sichern(uid);
  -- Zahlen aus kronen_konstanten (eine Quelle, Vertragstest mit js/pakete/liga/kronen.js)
  nominal := (public.kronen_konstanten() #>> array['kronen', 'online',
    case punkte when 1 then 'sieg' when 0 then 'niederlage' else 'remis' end])::integer;
  neu := greatest(st.boden, 0, st.kronen + nominal);
  insert into public.kronen_buchungen (user_id, quelle, ref, delta, saison)
  values (uid, 'online', partie::text, neu - st.kronen, st.saison)
  on conflict (user_id, quelle, ref) do nothing;
  get diagnostics gebucht = row_count;
  if gebucht = 0 then
    return;
  end if;
  k := case when st.elo_n < 15 then 40 else 32 end;
  erwartet := 1 / (1 + power(10::numeric, (gegner_elo - st.elo)::numeric / 400));
  neu_elo := least(4000, greatest(100, st.elo + round(k * (punkte - erwartet))::integer));
  update public.kronen_stand s
  set kronen = neu, boden = greatest(st.boden, public.kronen_liga_boden(neu)), elo = neu_elo, elo_n = st.elo_n + 1,
      aktualisiert_am = now()
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
  elo_w := (public.kronen_stand_sichern(new.weiss)).elo;
  elo_s := (public.kronen_stand_sichern(new.schwarz)).elo;
  punkte_w := case new.ergebnis when '1-0' then 1 when '0-1' then 0 else 0.5 end;
  perform public.kronen_online_buchen(new.weiss, new.id, punkte_w, elo_s);
  perform public.kronen_online_buchen(new.schwarz, new.id, 1 - punkte_w, elo_w);
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
-- Gemeinsame Buchung fuer Bot-Leiter und KI-Gegner: Kronen mit Liga-Boden, je (Konto, Quelle, ref) hoechstens einmal.
-- Antwort { delta, kronen, stufe }; eine schon gebuchte ref liefert den Stand mit delta 0. Nur intern.
-- Parameter heissen bewusst nicht quelle/ref: gleichnamige Spalten waeren in PL/pgSQL sonst mehrdeutig.
create or replace function public.kronen_einfach_buchen(uid uuid, art text, schluessel text, ergebnis text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  st public.kronen_stand;
  nominal integer := (public.kronen_konstanten() #>> array['kronen', art, ergebnis])::integer;
  neu integer;
  gebucht integer;
begin
  st := public.kronen_stand_sichern(uid);
  neu := greatest(st.boden, 0, st.kronen + nominal);
  insert into public.kronen_buchungen (user_id, quelle, ref, delta, saison)
  values (uid, art, schluessel, neu - st.kronen, st.saison)
  on conflict on constraint kronen_buchungen_einmal do nothing;
  get diagnostics gebucht = row_count;
  if gebucht = 0 then
    return jsonb_build_object('delta', 0, 'kronen', st.kronen, 'stufe', public.kronen_stufe(st.kronen));
  end if;
  update public.kronen_stand s
  set kronen = neu, boden = greatest(st.boden, public.kronen_liga_boden(neu)), aktualisiert_am = now()
  where s.user_id = uid;
  return jsonb_build_object('delta', neu - st.kronen, 'kronen', neu, 'stufe', public.kronen_stufe(neu));
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
revoke all on function public.kronen_heute_anzahl(uuid, text) from public, anon, authenticated;
revoke all on function public.kronen_bot_ergebnis(text, text, integer) from public, anon, authenticated;
revoke all on function public.kronen_ki_ergebnis(uuid, text) from public, anon, authenticated;
grant execute on function public.kronen_bot_ergebnis(text, text, integer) to authenticated;
grant execute on function public.kronen_ki_ergebnis(uuid, text) to authenticated;

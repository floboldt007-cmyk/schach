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
-- Rein additiv: neue Tabellen und Funktionen, keine bestehende Tabelle wird hier geaendert, keine Zeilen werden umgeschrieben.

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

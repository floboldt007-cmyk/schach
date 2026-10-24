-- Schulmodus (Welle B3): Klassen fuer Lehrkraefte und Vereine. Mehrfach ausfuehrbar (Muster: schema.sql,
-- coach-schema.sql). Vorher schema.sql einspielen. Test: supabase/schule-rls-test.sql. Idee, Rollen und Datenschutz:
-- design/runde4/SCHULE.md.
--
-- Rollen:
--   Leitung   wer eine Klasse anlegt (Lehrkraft, Trainerin im Verein). Sieht die Mitglieder IHRER Klassen mit
--             Anzeigename und Fortschritt, nie eine E-Mail-Adresse und nie die Konto-ID eines Mitglieds.
--   Mitglied  wer mit dem 6-stelligen Code beitritt (Schuelerin, Vereinsmitglied). Sieht nur die eigene Zeile und die
--             Aufgaben der Klasse, nie die anderen Mitglieder und nie die Konto-ID der Leitung.
--   Fremde    sehen nichts.
--
-- Grundsatz Datensparsamkeit: gespeichert wird nur, was die Leitung fuer den Unterricht braucht. Je Mitglied ein
-- selbst gewaehlter Anzeigename (Vorname oder Spitzname, 2 bis 24 Zeichen, nie eine E-Mail) und eine Zeile mit
-- Kennzahlen (besiegte Bots, Sterne, Partien, durchschnittliche Genauigkeit, die haeufigsten Fehlerarten, erledigte
-- Aufgaben) mit dem TAG der letzten Meldung (aktualisiert_am ist ein Datum ohne Uhrzeit: die Meldung kommt nach jeder
-- Partie, ein Zeitstempel verriete, wann jemand spielt). Nie Partien, Zuege, Uhrzeiten einzelner Partien oder
-- Geraetedaten. Mit dem Konto verschwindet alles (on delete cascade), mit dem Verlassen der Klasse die Zeile, mit dem
-- Loeschen der Klasse die ganze Klasse.
-- Geschlossene Klassen raeumt der Server nach 90 Tagen selbst weg (bei jeder neuen Klasse, fuer alle).
--
-- Tabellen (Nutzer lesen nur ueber RLS, schreiben nie direkt; alles Schreiben ueber die Funktionen unten):
--   klassen              id, name, code (6 Zeichen ohne 0/O/1/I, wie im Online-Fundament), leitung, erstellt_am, aktiv,
--                        geschlossen_am. Lesen: nur die Leitung (Mitglieder bekommen Name und Stand ueber
--                        schule_meine_klassen, ohne die Konto-ID der Leitung).
--   klassen_mitglieder   id (eigene Kennung, damit die Leitung nie die Konto-ID sieht), klasse, user_id, anzeigename,
--                        beigetreten_am. Lesen: Leitung alle ihrer Klassen, Mitglied die eigene Zeile. Die Spalte
--                        user_id ist fuer angemeldete Nutzer gar nicht lesbar (Spaltenrechte).
--   klassen_fortschritt  eine Zeile je Mitglied: bots_besiegt, sterne, partien, genauigkeit_schnitt, haeufigste_fehler
--                        (jsonb, klein), erledigt (Aufgaben-IDs), aktualisiert_am (date, Europe/Berlin). Lesen: Leitung und das Mitglied
--                        selbst. Schreiben nur ueber schule_melde_fortschritt (das Mitglied seine eigene Zeile).
--   klassen_aufgaben     klasse, titel, art ('bot' | 'raetsel' | 'partien'), ziel (jsonb), faellig, erstellt_am. Lesen:
--                        Leitung und Mitglieder der Klasse.
--   schule_versuche      Fehlversuche beim Beitreten je Nutzer und Tag (gegen das Durchprobieren von Codes). Nur
--                        Service-Rolle. Gleichzeitige Beitritte eines Kontos laufen nacheinander (Sperre je Nutzer bis
--                        zum Ende der Transaktion), sonst saehen parallele Anfragen alle einen Zaehler unter 10.
--
-- Funktionen (alle security definer mit leerem search_path, nur fuer angemeldete Nutzer; js/schule.js ruft sie):
--   schule_erstelle_klasse(name)                    -> { id, name, code, aktiv, erstellt_am }
--   schule_tritt_bei(code, anzeigename)             -> { klasse: { id, name }, mitglied: { id, anzeigename, beigetreten_am } }
--                                                      oder { fehler: 'SCHULE_CODE_UNGUELTIG' } (ein falscher Code wird als
--                                                      Fehlversuch gezaehlt; deshalb kein raise, das zaehlte nicht)
--   schule_verlasse(klasse)                         -> boolean (true: Mitgliedschaft und Fortschritt geloescht)
--   schule_melde_fortschritt(bots_besiegt, sterne, partien, genauigkeit_schnitt, haeufigste_fehler, erledigt)
--                                                   -> integer (Zahl der aktiven Klassen, deren Zeile jetzt so steht)
--   schule_meine_klassen()                          -> { leitung: [...], mitglied: [...] } (Form siehe unten)
--   schule_klassen_uebersicht(klasse)               -> { klasse, mitglieder, aufgaben } (nur Leitung)
--   schule_aufgabe_anlegen(klasse, titel, art, ziel, faellig) -> Aufgabe (nur Leitung, Klasse aktiv)
--   schule_aufgabe_loeschen(aufgabe)                -> boolean (nur Leitung; false: nicht gefunden oder nicht deine)
--   schule_entferne_mitglied(mitglied)              -> boolean (nur Leitung)
--   schule_schliesse_klasse(klasse)                 -> boolean (nur Leitung: kein Beitritt, keine Meldung, keine neue
--                                                      Aufgabe mehr; Mitglieder und Fortschritt bleiben lesbar)
--   schule_loesche_klasse(klasse)                   -> boolean (nur Leitung: alles weg)
--   Hilfen fuer die Policies (liefern nur ja/nein ueber den Aufrufer): schule_leitet(klasse),
--   schule_mitglied_in(klasse), schule_ist_mein_mitglied(mitglied)
--
-- Ziel einer Aufgabe (wird beim Anlegen geprueft und in diese Form gebracht):
--   bot      { "bot": "<id aus js/bots.js>", "sterne": 1..3 }   den Bot mit so vielen Sternen besiegen
--   raetsel  { "anzahl": 1..100 }                             so viele Raetsel richtig loesen (seit der Aufgabe)
--   partien  { "anzahl": 1..100 }                             so viele Partien spielen (seit der Aufgabe)
-- Ob eine Aufgabe erledigt ist, rechnet die App aus dem Spielstand auf dem Geraet und meldet die IDs mit erledigt.
--
-- haeufigste_fehler: { "zuege": n, "arten": [{ "art": "patzer" | "fehler" | "verpasst" | "ungenau", "anzahl": n }] }
-- (hoechstens 4 Arten; die Zugklassen-IDs aus js/zugklassen.js, Namen zeigt die App).
--
-- Fehler-Kennungen (Vertrag mit js/schule.js, dort stehen die Saetze):
--   SCHULE_NICHT_ANGEMELDET, SCHULE_NAME_UNGUELTIG (Klassenname oder Anzeigename), SCHULE_NAME_VERGEBEN (Anzeigename
--   in der Klasse schon vergeben), SCHULE_CODE_UNGUELTIG, SCHULE_KLASSE_GESCHLOSSEN, SCHULE_EIGENE_KLASSE,
--   SCHULE_KLASSE_VOLL, SCHULE_ZU_VIELE_KLASSEN, SCHULE_ZU_VIELE_VERSUCHE, SCHULE_KEIN_CODE, SCHULE_KEINE_LEITUNG,
--   SCHULE_AUFGABE_UNGUELTIG, SCHULE_ZU_VIELE_AUFGABEN, SCHULE_FORTSCHRITT_UNGUELTIG
--
-- Grenzen: 20 Klassen je Leitung, 60 Mitglieder je Klasse, 10 Klassen je Mitglied, 30 Aufgaben je Klasse,
-- 10 Fehlversuche beim Beitreten je Nutzer und Tag.
--
-- Hinweis fuer spaetere Aenderungen: `create or replace function` kann weder Parameternamen noch Rueckgabetyp
-- aendern. Dann vorher `drop function public.<name>(<typen>)` ausfuehren. Die Tabellen entstehen mit
-- `create table if not exists`: eine neue Spalte braucht ein eigenes `alter table ... add column if not exists`.

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------
create table if not exists public.klassen (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  leitung uuid not null references auth.users (id) on delete cascade,
  erstellt_am timestamptz not null default now(),
  aktiv boolean not null default true,
  geschlossen_am timestamptz,
  constraint klassen_code_form check (code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'),
  constraint klassen_name_form check (char_length(name) between 2 and 40 and name !~ '[[:cntrl:]<>@]'),
  constraint klassen_geschlossen check ((aktiv and geschlossen_am is null) or (not aktiv and geschlossen_am is not null))
);
create index if not exists klassen_leitung on public.klassen (leitung);

create table if not exists public.klassen_mitglieder (
  id uuid primary key default gen_random_uuid(),
  klasse uuid not null references public.klassen (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  anzeigename text not null,
  beigetreten_am timestamptz not null default now(),
  constraint klassen_mitglieder_einmal unique (klasse, user_id),
  -- Vorname oder Spitzname: Buchstaben (auch mit Akzent), Ziffern, Leerzeichen, Punkt, Bindestrich, Apostroph;
  -- mindestens ein Buchstabe; nie eine E-Mail (kein @)
  constraint klassen_mitglieder_name_form check (char_length(anzeigename) between 2 and 24
    and anzeigename ~ '^[A-Za-zÀ-ÖØ-öø-ÿĀ-ž0-9 .''-]+$' and anzeigename ~ '[A-Za-zÀ-ÖØ-öø-ÿĀ-ž]')
);
-- "Anna" und "anna" sind in einer Klasse derselbe Name (die Leitung muss sie auseinanderhalten koennen)
create unique index if not exists klassen_mitglieder_name_klein on public.klassen_mitglieder (klasse, lower(anzeigename));
create index if not exists klassen_mitglieder_user on public.klassen_mitglieder (user_id);

create table if not exists public.klassen_fortschritt (
  mitglied uuid primary key references public.klassen_mitglieder (id) on delete cascade,
  klasse uuid not null references public.klassen (id) on delete cascade,
  bots_besiegt integer not null default 0,
  sterne integer not null default 0,
  partien integer not null default 0,
  genauigkeit_schnitt numeric(4, 1),
  haeufigste_fehler jsonb not null default '{}'::jsonb,
  erledigt uuid[] not null default '{}',
  -- nur der Tag der letzten Meldung, keine Uhrzeit (siehe Kopf)
  aktualisiert_am date not null default ((now() at time zone 'Europe/Berlin')::date),
  constraint klassen_fortschritt_bots check (bots_besiegt between 0 and 10),
  constraint klassen_fortschritt_sterne check (sterne between 0 and 30),
  constraint klassen_fortschritt_partien check (partien between 0 and 100000),
  constraint klassen_fortschritt_genauigkeit check (genauigkeit_schnitt is null or genauigkeit_schnitt between 0 and 100),
  constraint klassen_fortschritt_fehler check (jsonb_typeof(haeufigste_fehler) = 'object' and char_length(haeufigste_fehler::text) <= 300),
  constraint klassen_fortschritt_erledigt check (cardinality(erledigt) <= 30)
);
create index if not exists klassen_fortschritt_klasse on public.klassen_fortschritt (klasse);
-- Erste Fassung (vor der Pruefung): aktualisiert_am war ein Zeitstempel. Beim erneuten Einspielen auf den Tag kuerzen.
do $$
begin
  if exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'klassen_fortschritt'
             and c.column_name = 'aktualisiert_am' and c.data_type <> 'date') then
    alter table public.klassen_fortschritt alter column aktualisiert_am drop default;
    alter table public.klassen_fortschritt alter column aktualisiert_am type date
      using ((aktualisiert_am at time zone 'Europe/Berlin')::date);
    alter table public.klassen_fortschritt alter column aktualisiert_am set default ((now() at time zone 'Europe/Berlin')::date);
  end if;
end
$$;

create table if not exists public.klassen_aufgaben (
  id uuid primary key default gen_random_uuid(),
  klasse uuid not null references public.klassen (id) on delete cascade,
  titel text not null,
  art text not null,
  ziel jsonb not null,
  faellig date,
  erstellt_am timestamptz not null default now(),
  constraint klassen_aufgaben_titel check (char_length(titel) between 2 and 80 and titel !~ '[[:cntrl:]]'),
  constraint klassen_aufgaben_art check (art in ('bot', 'raetsel', 'partien')),
  constraint klassen_aufgaben_ziel check (jsonb_typeof(ziel) = 'object' and char_length(ziel::text) <= 120)
);
create index if not exists klassen_aufgaben_klasse on public.klassen_aufgaben (klasse);

create table if not exists public.schule_versuche (
  user_id uuid not null references auth.users (id) on delete cascade,
  tag date not null,
  anzahl integer not null default 0,
  primary key (user_id, tag)
);

-- ---------------------------------------------------------------------------
-- Hilfen fuer die Policies (security definer: lesen die Tabellen ohne RLS, also ohne Kreis zwischen den Policies,
-- und liefern nur ja/nein ueber den Aufrufer selbst)
-- ---------------------------------------------------------------------------
create or replace function public.schule_leitet(k uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.klassen t where t.id = k and t.leitung = (select auth.uid()));
$$;

create or replace function public.schule_mitglied_in(k uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.klassen_mitglieder m where m.klasse = k and m.user_id = (select auth.uid()));
$$;

create or replace function public.schule_ist_mein_mitglied(m_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.klassen_mitglieder m where m.id = m_id and m.user_id = (select auth.uid()));
$$;

-- Leerraum zusammenfassen und aussen abschneiden (Klassenname, Anzeigename, Titel)
create or replace function public.schule_sauber(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g'));
$$;

-- Der Tag fuer die Fehlversuche (Europe/Berlin; die Tagesgrenze ist hier egal)
create or replace function public.schule_heute()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Berlin')::date;
$$;

-- ---------------------------------------------------------------------------
-- Klasse anlegen (Leitung)
-- ---------------------------------------------------------------------------
create or replace function public.schule_erstelle_klasse(name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_name text := public.schule_sauber(name);
  zeichen constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  zufall bytea;
  v_code text;
  k public.klassen;
  i integer;
  versuch integer;
begin
  if uid is null then
    raise exception 'SCHULE_NICHT_ANGEMELDET';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 40 or v_name ~ '[[:cntrl:]<>@]' then
    raise exception 'SCHULE_NAME_UNGUELTIG';
  end if;
  -- Datensparsam: geschlossene Klassen nach 90 Tagen weg (fuer alle Leitungen)
  delete from public.klassen t where not t.aktiv and t.geschlossen_am < now() - interval '90 days';
  if (select count(*) from public.klassen t where t.leitung = uid) >= 20 then
    raise exception 'SCHULE_ZU_VIELE_KLASSEN';
  end if;
  for versuch in 1..20 loop
    -- die ersten 6 Bytes einer v4-UUID sind voller Zufall; 256 ist durch 32 teilbar, also gleichverteilt
    zufall := uuid_send(gen_random_uuid());
    v_code := '';
    for i in 0..5 loop
      v_code := v_code || substr(zeichen, 1 + (get_byte(zufall, i) % 32), 1);
    end loop;
    begin
      insert into public.klassen (name, code, leitung) values (v_name, v_code, uid) returning * into k;
      return jsonb_build_object('id', k.id, 'name', k.name, 'code', k.code, 'aktiv', k.aktiv, 'erstellt_am', k.erstellt_am);
    exception
      when unique_violation then
        null; -- Code schon vergeben: neuer Versuch mit neuem Code
    end;
  end loop;
  raise exception 'SCHULE_KEIN_CODE';
end;
$$;

-- ---------------------------------------------------------------------------
-- Beitreten (Mitglied). Ein zweiter Beitritt in dieselbe Klasse aendert nur den Anzeigenamen.
-- ---------------------------------------------------------------------------
create or replace function public.schule_tritt_bei(code text, anzeigename text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_name text := public.schule_sauber(anzeigename);
  v_tag date := public.schule_heute();
  k public.klassen;
  m public.klassen_mitglieder;
begin
  if uid is null then
    raise exception 'SCHULE_NICHT_ANGEMELDET';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 24 or v_name !~ '^[A-Za-zÀ-ÖØ-öø-ÿĀ-ž0-9 .''-]+$'
    or v_name !~ '[A-Za-zÀ-ÖØ-öø-ÿĀ-ž]' then
    raise exception 'SCHULE_NAME_UNGUELTIG';
  end if;
  -- Fehlversuche eines Kontos nacheinander zaehlen (Sperre je Nutzer bis zum Ende der Transaktion): parallele Anfragen
  -- saehen sonst alle einen Zaehler unter 10
  perform pg_advisory_xact_lock(hashtextextended('schule_versuche:' || uid::text, 0));
  if coalesce((select v.anzahl from public.schule_versuche v where v.user_id = uid and v.tag = v_tag), 0) >= 10 then
    raise exception 'SCHULE_ZU_VIELE_VERSUCHE';
  end if;
  if v_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$' then
    -- Sperre auf der Klasse: gleichzeitige Beitritte zaehlen die Mitglieder nacheinander
    select * into k from public.klassen t where t.code = v_code for update;
  end if;
  if k.id is null then
    -- Fehlversuch zaehlen (kein raise: das rollte den Zaehler zurueck); alte Tage raeumen
    delete from public.schule_versuche v where v.tag < v_tag - 2;
    insert into public.schule_versuche as v (user_id, tag, anzahl) values (uid, v_tag, 1)
    on conflict (user_id, tag) do update set anzahl = v.anzahl + 1;
    return jsonb_build_object('fehler', 'SCHULE_CODE_UNGUELTIG');
  end if;
  if not k.aktiv then
    raise exception 'SCHULE_KLASSE_GESCHLOSSEN';
  end if;
  if k.leitung = uid then
    raise exception 'SCHULE_EIGENE_KLASSE';
  end if;
  select * into m from public.klassen_mitglieder t where t.klasse = k.id and t.user_id = uid;
  if m.id is null then
    if (select count(*) from public.klassen_mitglieder t where t.klasse = k.id) >= 60 then
      raise exception 'SCHULE_KLASSE_VOLL';
    end if;
    if (select count(*) from public.klassen_mitglieder t where t.user_id = uid) >= 10 then
      raise exception 'SCHULE_ZU_VIELE_KLASSEN';
    end if;
  end if;
  if exists (select 1 from public.klassen_mitglieder t where t.klasse = k.id and lower(t.anzeigename) = lower(v_name)
             and t.user_id <> uid) then
    raise exception 'SCHULE_NAME_VERGEBEN';
  end if;
  if m.id is null then
    insert into public.klassen_mitglieder (klasse, user_id, anzeigename) values (k.id, uid, v_name) returning * into m;
  elsif m.anzeigename <> v_name then
    update public.klassen_mitglieder t set anzeigename = v_name where t.id = m.id returning * into m;
  end if;
  return jsonb_build_object('klasse', jsonb_build_object('id', k.id, 'name', k.name),
    'mitglied', jsonb_build_object('id', m.id, 'anzeigename', m.anzeigename, 'beigetreten_am', m.beigetreten_am));
end;
$$;

create or replace function public.schule_verlasse(klasse uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_klasse uuid := klasse;
begin
  if uid is null then
    raise exception 'SCHULE_NICHT_ANGEMELDET';
  end if;
  delete from public.klassen_mitglieder t where t.klasse = v_klasse and t.user_id = uid;
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fortschritt melden (Mitglied, nur die eigenen Zeilen, in allen aktiven Klassen auf einmal)
-- ---------------------------------------------------------------------------
create or replace function public.schule_melde_fortschritt(bots_besiegt integer, sterne integer, partien integer,
  genauigkeit_schnitt numeric default null, haeufigste_fehler jsonb default '{}'::jsonb, erledigt jsonb default '[]'::jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_bots integer := bots_besiegt;
  v_sterne integer := sterne;
  v_partien integer := partien;
  v_gen numeric := genauigkeit_schnitt;
  v_fehler jsonb := coalesce(haeufigste_fehler, '{}'::jsonb);
  v_erledigt jsonb := coalesce(erledigt, '[]'::jsonb);
  v_ids uuid[];
  e jsonb;
  m record;
  anzahl integer := 0;
begin
  if uid is null then
    raise exception 'SCHULE_NICHT_ANGEMELDET';
  end if;
  if v_bots is null or v_bots < 0 or v_bots > 10 or v_sterne is null or v_sterne < 0 or v_sterne > 30
    or v_partien is null or v_partien < 0 or v_partien > 100000 or (v_gen is not null and (v_gen < 0 or v_gen > 100)) then
    raise exception 'SCHULE_FORTSCHRITT_UNGUELTIG';
  end if;
  -- haeufigste_fehler: { zuege, arten: [{ art, anzahl }] } mit hoechstens 4 bekannten Arten, sonst nichts
  if jsonb_typeof(v_fehler) <> 'object' or char_length(v_fehler::text) > 300
    or exists (select 1 from jsonb_object_keys(v_fehler) s where s not in ('zuege', 'arten')) then
    raise exception 'SCHULE_FORTSCHRITT_UNGUELTIG';
  end if;
  if v_fehler ? 'zuege' and (jsonb_typeof(v_fehler -> 'zuege') <> 'number' or (v_fehler ->> 'zuege') !~ '^[0-9]{1,6}$') then
    raise exception 'SCHULE_FORTSCHRITT_UNGUELTIG';
  end if;
  if v_fehler ? 'arten' then
    if jsonb_typeof(v_fehler -> 'arten') <> 'array' or jsonb_array_length(v_fehler -> 'arten') > 4 then
      raise exception 'SCHULE_FORTSCHRITT_UNGUELTIG';
    end if;
    for e in select x from jsonb_array_elements(v_fehler -> 'arten') x loop
      if jsonb_typeof(e) <> 'object' or (e ->> 'art') is null or (e ->> 'art') not in ('patzer', 'fehler', 'verpasst', 'ungenau')
        or jsonb_typeof(e -> 'anzahl') <> 'number' or (e ->> 'anzahl') !~ '^[0-9]{1,6}$'
        or exists (select 1 from jsonb_object_keys(e) s where s not in ('art', 'anzahl')) then
        raise exception 'SCHULE_FORTSCHRITT_UNGUELTIG';
      end if;
    end loop;
  end if;
  -- erledigt: Liste von Aufgaben-IDs (hoechstens 30); was keine ID ist, ist ein Fehler, unbekannte IDs fallen unten weg
  if jsonb_typeof(v_erledigt) <> 'array' or jsonb_array_length(v_erledigt) > 30 then
    raise exception 'SCHULE_FORTSCHRITT_UNGUELTIG';
  end if;
  if exists (select 1 from jsonb_array_elements(v_erledigt) x
             where jsonb_typeof(x) <> 'string' or (x #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    raise exception 'SCHULE_FORTSCHRITT_UNGUELTIG';
  end if;
  select coalesce(array_agg(distinct (x #>> '{}')::uuid), '{}') into v_ids from jsonb_array_elements(v_erledigt) x;
  for m in
    select t.id, t.klasse from public.klassen_mitglieder t join public.klassen k on k.id = t.klasse
    where t.user_id = uid and k.aktiv
  loop
    insert into public.klassen_fortschritt as f (mitglied, klasse, bots_besiegt, sterne, partien, genauigkeit_schnitt,
      haeufigste_fehler, erledigt, aktualisiert_am)
    values (m.id, m.klasse, v_bots, v_sterne, v_partien, round(v_gen, 1), v_fehler,
      coalesce((select array_agg(a.id) from public.klassen_aufgaben a where a.klasse = m.klasse and a.id = any (v_ids)), '{}'),
      public.schule_heute())
    on conflict (mitglied) do update set
      bots_besiegt = excluded.bots_besiegt, sterne = excluded.sterne, partien = excluded.partien,
      genauigkeit_schnitt = excluded.genauigkeit_schnitt, haeufigste_fehler = excluded.haeufigste_fehler,
      erledigt = excluded.erledigt, aktualisiert_am = excluded.aktualisiert_am;
    anzahl := anzahl + 1;
  end loop;
  return anzahl;
end;
$$;

-- ---------------------------------------------------------------------------
-- Meine Klassen (beide Rollen). Mitglieder bekommen Name, Stand und Aufgaben ihrer Klasse, nie die Leitung.
--   { leitung: [{ id, name, code, aktiv, erstellt_am, geschlossen_am, mitglieder }],
--     mitglied: [{ klasse, name, aktiv, mitglied, anzeigename, beigetreten_am, erledigt,
--                  aufgaben: [{ id, titel, art, ziel, faellig, erstellt_am }] }] }
-- ---------------------------------------------------------------------------
create or replace function public.schule_meine_klassen()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'SCHULE_NICHT_ANGEMELDET';
  end if;
  return jsonb_build_object(
    'leitung', coalesce((
      select jsonb_agg(jsonb_build_object('id', k.id, 'name', k.name, 'code', k.code, 'aktiv', k.aktiv,
        'erstellt_am', k.erstellt_am, 'geschlossen_am', k.geschlossen_am,
        'mitglieder', (select count(*) from public.klassen_mitglieder t where t.klasse = k.id)) order by k.erstellt_am)
      from public.klassen k where k.leitung = uid), '[]'::jsonb),
    'mitglied', coalesce((
      select jsonb_agg(jsonb_build_object('klasse', k.id, 'name', k.name, 'aktiv', k.aktiv, 'mitglied', m.id,
        'anzeigename', m.anzeigename, 'beigetreten_am', m.beigetreten_am,
        'erledigt', coalesce(to_jsonb(f.erledigt), '[]'::jsonb),
        'aufgaben', case when k.aktiv then coalesce((
          select jsonb_agg(jsonb_build_object('id', a.id, 'titel', a.titel, 'art', a.art, 'ziel', a.ziel, 'faellig', a.faellig,
            'erstellt_am', a.erstellt_am) order by a.faellig nulls last, a.erstellt_am)
          from public.klassen_aufgaben a where a.klasse = k.id), '[]'::jsonb) else '[]'::jsonb end) order by m.beigetreten_am)
      from public.klassen_mitglieder m
      join public.klassen k on k.id = m.klasse
      left join public.klassen_fortschritt f on f.mitglied = m.id
      where m.user_id = uid), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- Uebersicht einer Klasse (nur Leitung): Mitglieder mit Fortschritt, Aufgaben mit der Zahl der Erledigten.
-- Ohne Konto-IDs und ohne E-Mail-Adressen.
-- ---------------------------------------------------------------------------
create or replace function public.schule_klassen_uebersicht(klasse uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_klasse uuid := klasse;
  k public.klassen;
begin
  if uid is null then
    raise exception 'SCHULE_NICHT_ANGEMELDET';
  end if;
  select * into k from public.klassen t where t.id = v_klasse and t.leitung = uid;
  if k.id is null then
    raise exception 'SCHULE_KEINE_LEITUNG';
  end if;
  return jsonb_build_object(
    'klasse', jsonb_build_object('id', k.id, 'name', k.name, 'code', k.code, 'aktiv', k.aktiv, 'erstellt_am', k.erstellt_am,
      'geschlossen_am', k.geschlossen_am),
    'mitglieder', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'anzeigename', m.anzeigename, 'beigetreten_am', m.beigetreten_am,
        'fortschritt', case when f.mitglied is null then null else jsonb_build_object('bots_besiegt', f.bots_besiegt,
          'sterne', f.sterne, 'partien', f.partien, 'genauigkeit_schnitt', f.genauigkeit_schnitt,
          'haeufigste_fehler', f.haeufigste_fehler, 'erledigt', to_jsonb(f.erledigt), 'aktualisiert_am', f.aktualisiert_am) end)
        order by lower(m.anzeigename))
      from public.klassen_mitglieder m left join public.klassen_fortschritt f on f.mitglied = m.id
      where m.klasse = k.id), '[]'::jsonb),
    'aufgaben', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'titel', a.titel, 'art', a.art, 'ziel', a.ziel, 'faellig', a.faellig,
        'erstellt_am', a.erstellt_am,
        'erledigt', (select count(*) from public.klassen_fortschritt f where f.klasse = k.id and a.id = any (f.erledigt)))
        order by a.faellig nulls last, a.erstellt_am)
      from public.klassen_aufgaben a where a.klasse = k.id), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- Aufgaben (nur Leitung)
-- ---------------------------------------------------------------------------
create or replace function public.schule_aufgabe_anlegen(klasse uuid, titel text, art text, ziel jsonb, faellig date default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_klasse uuid := klasse;
  v_titel text := public.schule_sauber(titel);
  v_art text := art;
  v_ziel jsonb := ziel;
  v_faellig date := faellig;
  v_neu jsonb;
  v_zahl integer;
  k public.klassen;
  a public.klassen_aufgaben;
begin
  if uid is null then
    raise exception 'SCHULE_NICHT_ANGEMELDET';
  end if;
  select * into k from public.klassen t where t.id = v_klasse and t.leitung = uid for update;
  if k.id is null then
    raise exception 'SCHULE_KEINE_LEITUNG';
  end if;
  if not k.aktiv then
    raise exception 'SCHULE_KLASSE_GESCHLOSSEN';
  end if;
  if char_length(v_titel) < 2 or char_length(v_titel) > 80 or v_titel ~ '[[:cntrl:]]'
    or v_art is null or v_art not in ('bot', 'raetsel', 'partien') or v_ziel is null or jsonb_typeof(v_ziel) <> 'object' then
    raise exception 'SCHULE_AUFGABE_UNGUELTIG';
  end if;
  if v_art = 'bot' then
    -- die Bots der Leiter, Welten: dreissig (js/bots.js, tests/server-schule.test.mjs vergleicht die Liste)
    if (v_ziel ->> 'bot') is null or (v_ziel ->> 'bot') not in ('fridolin', 'benno', 'paula', 'gustav', 'hilde', 'janine', 'bodo', 'kalle', 'leo', 'lisa', 'edda',
      'rudi', 'luke', 'turm', 'moritz', 'delia', 'ottilie', 'koenig', 'lasse', 'wiebke', 'greta',
      'henning', 'ilka', 'johann', 'keetan', 'ragna', 'silas', 'merle', 'alva', 'stockfisch') then
      raise exception 'SCHULE_AUFGABE_UNGUELTIG';
    end if;
    if v_ziel ? 'sterne' and (jsonb_typeof(v_ziel -> 'sterne') <> 'number' or (v_ziel ->> 'sterne') !~ '^[123]$') then
      raise exception 'SCHULE_AUFGABE_UNGUELTIG';
    end if;
    v_neu := jsonb_build_object('bot', v_ziel ->> 'bot', 'sterne', coalesce((v_ziel ->> 'sterne')::integer, 1));
  else
    if jsonb_typeof(v_ziel -> 'anzahl') is distinct from 'number' or (v_ziel ->> 'anzahl') !~ '^[0-9]{1,3}$' then
      raise exception 'SCHULE_AUFGABE_UNGUELTIG';
    end if;
    v_zahl := (v_ziel ->> 'anzahl')::integer;
    if v_zahl < 1 or v_zahl > 100 then
      raise exception 'SCHULE_AUFGABE_UNGUELTIG';
    end if;
    v_neu := jsonb_build_object('anzahl', v_zahl);
  end if;
  if v_faellig is not null and (v_faellig < public.schule_heute() - 1 or v_faellig > public.schule_heute() + 366) then
    raise exception 'SCHULE_AUFGABE_UNGUELTIG';
  end if;
  if (select count(*) from public.klassen_aufgaben t where t.klasse = k.id) >= 30 then
    raise exception 'SCHULE_ZU_VIELE_AUFGABEN';
  end if;
  insert into public.klassen_aufgaben (klasse, titel, art, ziel, faellig) values (k.id, v_titel, v_art, v_neu, v_faellig)
  returning * into a;
  return jsonb_build_object('id', a.id, 'klasse', a.klasse, 'titel', a.titel, 'art', a.art, 'ziel', a.ziel, 'faellig', a.faellig,
    'erstellt_am', a.erstellt_am, 'erledigt', 0);
end;
$$;

create or replace function public.schule_aufgabe_loeschen(aufgabe uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_aufgabe uuid := aufgabe;
  v_klasse uuid;
begin
  if uid is null then
    raise exception 'SCHULE_NICHT_ANGEMELDET';
  end if;
  delete from public.klassen_aufgaben a
  using public.klassen k
  where a.id = v_aufgabe and k.id = a.klasse and k.leitung = uid
  returning a.klasse into v_klasse;
  if v_klasse is null then
    return false;
  end if;
  update public.klassen_fortschritt f set erledigt = array_remove(f.erledigt, v_aufgabe)
  where f.klasse = v_klasse and v_aufgabe = any (f.erledigt);
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mitglied entfernen, Klasse schliessen, Klasse loeschen (nur Leitung)
-- ---------------------------------------------------------------------------
create or replace function public.schule_entferne_mitglied(mitglied uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_mitglied uuid := mitglied;
begin
  if uid is null then
    raise exception 'SCHULE_NICHT_ANGEMELDET';
  end if;
  delete from public.klassen_mitglieder m
  using public.klassen k
  where m.id = v_mitglied and k.id = m.klasse and k.leitung = uid;
  return found;
end;
$$;

create or replace function public.schule_schliesse_klasse(klasse uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_klasse uuid := klasse;
begin
  if uid is null then
    raise exception 'SCHULE_NICHT_ANGEMELDET';
  end if;
  if not exists (select 1 from public.klassen t where t.id = v_klasse and t.leitung = uid) then
    raise exception 'SCHULE_KEINE_LEITUNG';
  end if;
  update public.klassen t set aktiv = false, geschlossen_am = now() where t.id = v_klasse and t.aktiv;
  return true;
end;
$$;

create or replace function public.schule_loesche_klasse(klasse uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_klasse uuid := klasse;
begin
  if uid is null then
    raise exception 'SCHULE_NICHT_ANGEMELDET';
  end if;
  delete from public.klassen t where t.id = v_klasse and t.leitung = uid;
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- Zeilen-Sicherheit (RLS): Leitung sieht ihre Klassen samt Mitgliedern, Fortschritt und Aufgaben; ein Mitglied die
-- eigene Zeile, den eigenen Fortschritt und die Aufgaben seiner Klassen; Fremde nichts.
-- ---------------------------------------------------------------------------
alter table public.klassen enable row level security;
alter table public.klassen_mitglieder enable row level security;
alter table public.klassen_fortschritt enable row level security;
alter table public.klassen_aufgaben enable row level security;
alter table public.schule_versuche enable row level security;

-- Wiederholbares Einspielen: die eigenen Policies werden gezielt ersetzt.
drop policy if exists "Klassen: Leitung liest ihre Klassen" on public.klassen;
create policy "Klassen: Leitung liest ihre Klassen"
on public.klassen for select
to authenticated
using ((select auth.uid()) = leitung);

drop policy if exists "Mitglieder: Leitung und das Mitglied selbst" on public.klassen_mitglieder;
create policy "Mitglieder: Leitung und das Mitglied selbst"
on public.klassen_mitglieder for select
to authenticated
using ((select auth.uid()) = user_id or public.schule_leitet(klasse));

drop policy if exists "Fortschritt: Leitung und das Mitglied selbst" on public.klassen_fortschritt;
create policy "Fortschritt: Leitung und das Mitglied selbst"
on public.klassen_fortschritt for select
to authenticated
using (public.schule_leitet(klasse) or public.schule_ist_mein_mitglied(mitglied));

drop policy if exists "Aufgaben: Leitung und Mitglieder der Klasse" on public.klassen_aufgaben;
create policy "Aufgaben: Leitung und Mitglieder der Klasse"
on public.klassen_aufgaben for select
to authenticated
using (public.schule_leitet(klasse) or public.schule_mitglied_in(klasse));

-- Tabellenrechte: angemeldete Nutzer lesen (RLS begrenzt die Zeilen), schreiben nie direkt. Die Konto-ID eines
-- Mitglieds (user_id) ist fuer niemanden lesbar (Spaltenrechte), auch nicht fuer die Leitung.
revoke all on table public.klassen, public.klassen_mitglieder, public.klassen_fortschritt, public.klassen_aufgaben,
  public.schule_versuche from anon, authenticated, public;
grant select on table public.klassen, public.klassen_fortschritt, public.klassen_aufgaben to authenticated;
grant select (id, klasse, anzeigename, beigetreten_am) on table public.klassen_mitglieder to authenticated;
grant select, insert, update, delete on table public.klassen, public.klassen_mitglieder, public.klassen_fortschritt,
  public.klassen_aufgaben, public.schule_versuche to service_role;

-- Funktionen: nie fuer anon und public (Supabase vergibt neue Funktionen sonst an alle), nur fuer angemeldete Nutzer.
-- schule_sauber und schule_heute sind reine Hilfen ohne Daten, ebenfalls nur fuer angemeldete Nutzer.
revoke all on function public.schule_leitet(uuid) from anon, authenticated, public;
revoke all on function public.schule_mitglied_in(uuid) from anon, authenticated, public;
revoke all on function public.schule_ist_mein_mitglied(uuid) from anon, authenticated, public;
revoke all on function public.schule_sauber(text) from anon, authenticated, public;
revoke all on function public.schule_heute() from anon, authenticated, public;
revoke all on function public.schule_erstelle_klasse(text) from anon, authenticated, public;
revoke all on function public.schule_tritt_bei(text, text) from anon, authenticated, public;
revoke all on function public.schule_verlasse(uuid) from anon, authenticated, public;
revoke all on function public.schule_melde_fortschritt(integer, integer, integer, numeric, jsonb, jsonb) from anon, authenticated, public;
revoke all on function public.schule_meine_klassen() from anon, authenticated, public;
revoke all on function public.schule_klassen_uebersicht(uuid) from anon, authenticated, public;
revoke all on function public.schule_aufgabe_anlegen(uuid, text, text, jsonb, date) from anon, authenticated, public;
revoke all on function public.schule_aufgabe_loeschen(uuid) from anon, authenticated, public;
revoke all on function public.schule_entferne_mitglied(uuid) from anon, authenticated, public;
revoke all on function public.schule_schliesse_klasse(uuid) from anon, authenticated, public;
revoke all on function public.schule_loesche_klasse(uuid) from anon, authenticated, public;
grant execute on function public.schule_leitet(uuid) to authenticated;
grant execute on function public.schule_mitglied_in(uuid) to authenticated;
grant execute on function public.schule_ist_mein_mitglied(uuid) to authenticated;
grant execute on function public.schule_sauber(text) to authenticated;
grant execute on function public.schule_heute() to authenticated;
grant execute on function public.schule_erstelle_klasse(text) to authenticated;
grant execute on function public.schule_tritt_bei(text, text) to authenticated;
grant execute on function public.schule_verlasse(uuid) to authenticated;
grant execute on function public.schule_melde_fortschritt(integer, integer, integer, numeric, jsonb, jsonb) to authenticated;
grant execute on function public.schule_meine_klassen() to authenticated;
grant execute on function public.schule_klassen_uebersicht(uuid) to authenticated;
grant execute on function public.schule_aufgabe_anlegen(uuid, text, text, jsonb, date) to authenticated;
grant execute on function public.schule_aufgabe_loeschen(uuid) to authenticated;
grant execute on function public.schule_entferne_mitglied(uuid) to authenticated;
grant execute on function public.schule_schliesse_klasse(uuid) to authenticated;
grant execute on function public.schule_loesche_klasse(uuid) to authenticated;

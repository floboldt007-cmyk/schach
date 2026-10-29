-- Daten-Fundament (DSGVO, Entscheidung des Besitzers vom 22.10.2026): Partien-Archiv und pseudonyme Nutzung
-- (ohne Name und E-Mail, aber am Konto, damit Auskunft, Widerruf und Loeschung gehen),
-- nur fuer angemeldete Spieler und nur mit Freigabe in der App (Einstellung datenfreigabe, Standard aus),
-- dazu Konto loeschen (Art. 17) und Datenauskunft (Art. 15/20). Mehrfach ausfuehrbar (Muster: schema.sql).
-- Voraussetzung: schema.sql ist eingespielt (profile, spielstaende).
-- Die Browser-App schreibt nur per INSERT (Prefer: return=minimal); gelesen wird nur ueber meine_daten().

-- ---------------------------------------------------------------------------
-- Partien-Archiv: eine fertige Partie je Zeile, nur eigene Zeilen, nie aenderbar
-- ---------------------------------------------------------------------------
create table if not exists public.partien_archiv (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  bot_id text,
  farbe text,                 -- 'w' | 'b' (Farbe des Spielers)
  ergebnis text,              -- sieg | remis | niederlage
  grund text,                 -- matt, aufgabe, zeit, patt, ...
  modus text,                 -- normal | uebung | boss | frei | spiel
  zuege text,                 -- UCI durch Leerzeichen, z. B. "e2e4 e7e5 g1f3"
  klassen text,               -- Klassen-IDs je eigenem Zug durch Leerzeichen ("-" = nicht bewertet)
  genauigkeit numeric,        -- 0..100
  hinweise integer,
  zuruecknahmen integer,
  dauer_s integer,
  app_version text,
  gespielt_am timestamptz,
  erstellt_am timestamptz not null default now(),
  constraint partien_archiv_farbe check (farbe is null or farbe in ('w', 'b')),
  constraint partien_archiv_zuege_groesse check (zuege is null or char_length(zuege) <= 20000),
  constraint partien_archiv_zuege_format check (
    zuege is null or zuege ~ '^([a-h][1-8][a-h][1-8][qrbnQRBN]?)?( [a-h][1-8][a-h][1-8][qrbnQRBN]?)*$'),
  constraint partien_archiv_klassen_groesse check (klassen is null or char_length(klassen) <= 4000),
  constraint partien_archiv_klassen_format check (klassen is null or klassen ~ '^([a-z-]+)?( [a-z-]+)*$'),
  constraint partien_archiv_texte_groesse check (
    (bot_id is null or char_length(bot_id) <= 64)
    and (ergebnis is null or char_length(ergebnis) <= 32)
    and (grund is null or char_length(grund) <= 64)
    and (modus is null or char_length(modus) <= 32)
    and (app_version is null or char_length(app_version) <= 40)),
  constraint partien_archiv_zahlen check (
    (genauigkeit is null or (genauigkeit >= 0 and genauigkeit <= 100))
    and (hinweise is null or hinweise >= 0)
    and (zuruecknahmen is null or zuruecknahmen >= 0)
    and (dauer_s is null or dauer_s >= 0))
);

create index if not exists partien_archiv_user_gespielt on public.partien_archiv (user_id, gespielt_am);
create index if not exists partien_archiv_bot on public.partien_archiv (bot_id);

-- ---------------------------------------------------------------------------
-- Nutzung: kleine Ereignisse (Screen, Partie-Start, Partie-Ende, Fehler, Freigabe). Nutzer schreiben nur,
-- lesen koennen sie ihre Zeilen ausschliesslich ueber meine_daten() (Auskunft).
-- ---------------------------------------------------------------------------
create table if not exists public.nutzung (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ereignis text not null,
  daten jsonb,
  geraet text,                -- nur Browser-Familie/OS, z. B. "iOS Safari", nie der User-Agent-String
  app_version text,
  erstellt_am timestamptz not null default now(),
  constraint nutzung_ereignis_groesse check (char_length(ereignis) between 1 and 64),
  constraint nutzung_daten_groesse check (daten is null or pg_column_size(daten) <= 2048),
  constraint nutzung_geraet_groesse check (geraet is null or char_length(geraet) <= 120),
  constraint nutzung_app_version_groesse check (app_version is null or char_length(app_version) <= 40)
);

create index if not exists nutzung_erstellt_am on public.nutzung (erstellt_am);
create index if not exists nutzung_user on public.nutzung (user_id);

-- ---------------------------------------------------------------------------
-- Zeilen-Sicherheit
-- ---------------------------------------------------------------------------
alter table public.partien_archiv enable row level security;
alter table public.nutzung enable row level security;

drop policy if exists "Eigene Partie archivieren" on public.partien_archiv;
create policy "Eigene Partie archivieren"
on public.partien_archiv for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Eigenes Archiv lesen" on public.partien_archiv;
create policy "Eigenes Archiv lesen"
on public.partien_archiv for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Eigenes Archiv loeschen" on public.partien_archiv;
create policy "Eigenes Archiv loeschen"
on public.partien_archiv for delete
to authenticated
using ((select auth.uid()) = user_id);

-- kein update: weder Policy noch Tabellenrecht

drop policy if exists "Eigene Nutzung melden" on public.nutzung;
create policy "Eigene Nutzung melden"
on public.nutzung for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- kein select, update, delete fuer Nutzer (nur Besitzer/Service und meine_daten())

-- ---------------------------------------------------------------------------
-- Widerruf der Freigabe (Art. 7 Abs. 3, Art. 17 Abs. 1 lit. b): Zeitpunkt festhalten. Eine Zeile je Konto, der
-- letzte Widerruf gilt. Nutzer lesen sie nur ueber meine_daten() und schreiben sie nur ueber freigabe_widerrufen().
-- ---------------------------------------------------------------------------
create table if not exists public.freigabe_widerrufe (
  user_id uuid primary key references auth.users (id) on delete cascade,
  widerrufen_am timestamptz not null default now(),
  geloescht_partien integer not null default 0,
  geloescht_nutzung integer not null default 0
);
alter table public.freigabe_widerrufe enable row level security;

-- Supabase vergibt auf neue Tabellen in public alle Rechte (auch update und truncate, die RLS nicht abdeckt).
-- Deshalb erst alles entziehen und dann genau das Noetige vergeben.
revoke all on table public.partien_archiv, public.nutzung, public.freigabe_widerrufe from anon, authenticated, public;
grant select, insert, delete on table public.partien_archiv to authenticated;
grant insert on table public.nutzung to authenticated;

-- ---------------------------------------------------------------------------
-- Mengenbremse: Ein Konto schreibt hoechstens 300 Partien und 2000 Nutzungsereignisse in 24 Stunden (die App
-- kommt im Alltag nie in die Naehe). Darueber lehnt der Server jede weitere Zeile ab (Kennung DATEN_MENGE), damit
-- ein manipulierter Client die Tabellen nicht fluten kann. Zaehlt auch Zeilen, die dieselbe Anfrage gerade anlegt.
-- Gezaehlt wird in einer eigenen Zaehltabelle (daten_zaehler, je Konto, Tabelle und Stunde), nicht an den
-- vorhandenen Zeilen: Loeschen (direkt oder ueber freigabe_widerrufen) und neu Einfuegen setzt die Bremse also
-- nicht zurueck. Das Fenster sind die laufende und die 24 vollen Stunden davor (also 24 bis 25 Stunden). Damit ein
-- frisch eingespieltes Schema nicht bei 0 anfaengt, zaehlen zusaetzlich die vorhandenen Zeilen der letzten 24
-- Stunden (der groessere Wert gilt). Gleichzeitige Anfragen eines Kontos zaehlen nacheinander (Sperre je Konto und
-- Tabelle bis zum Ende der Transaktion). Die Zaehler enthalten keine Inhalte und werden nach 48 Stunden geloescht,
-- mit dem Konto sofort (on delete cascade). Sie stehen in der Datenauskunft (meine_daten, mengenzaehler).
-- ---------------------------------------------------------------------------
create table if not exists public.daten_zaehler (
  user_id uuid not null references auth.users (id) on delete cascade,
  tabelle text not null,
  stunde timestamptz not null,
  anzahl integer not null default 0,
  primary key (user_id, tabelle, stunde),
  constraint daten_zaehler_tabelle check (tabelle in ('partien_archiv', 'nutzung'))
);
alter table public.daten_zaehler enable row level security;
-- kein Recht fuer Nutzer (weder lesen noch schreiben); geschrieben wird nur ueber den Trigger unten
revoke all on table public.daten_zaehler from anon, authenticated, public;

create or replace function public.daten_mengenbremse()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  grenze integer := tg_argv[0]::integer;
  v_stunde timestamptz := date_trunc('hour', now());
  gezaehlt integer;
  vorhanden integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('daten_zaehler:' || tg_table_name || ':' || new.user_id::text, 0));
  select coalesce(sum(z.anzahl), 0) into gezaehlt from public.daten_zaehler z
  where z.user_id = new.user_id and z.tabelle = tg_table_name and z.stunde >= v_stunde - interval '24 hours';
  if tg_table_name = 'partien_archiv' then
    select count(*) into vorhanden from public.partien_archiv a
    where a.user_id = new.user_id and a.erstellt_am > now() - interval '24 hours';
  else
    select count(*) into vorhanden from public.nutzung u
    where u.user_id = new.user_id and u.erstellt_am > now() - interval '24 hours';
  end if;
  if greatest(gezaehlt, vorhanden) >= grenze then
    raise exception 'DATEN_MENGE';
  end if;
  insert into public.daten_zaehler as z (user_id, tabelle, stunde, anzahl)
  values (new.user_id, tg_table_name, v_stunde, 1)
  on conflict (user_id, tabelle, stunde) do update set anzahl = z.anzahl + 1;
  delete from public.daten_zaehler z where z.user_id = new.user_id and z.stunde < v_stunde - interval '48 hours';
  return new;
end;
$$;
revoke all on function public.daten_mengenbremse() from anon, authenticated, public;

drop trigger if exists partien_archiv_mengenbremse on public.partien_archiv;
create trigger partien_archiv_mengenbremse
before insert on public.partien_archiv
for each row execute function public.daten_mengenbremse('300');

drop trigger if exists nutzung_mengenbremse on public.nutzung;
create trigger nutzung_mengenbremse
before insert on public.nutzung
for each row execute function public.daten_mengenbremse('2000');

-- ---------------------------------------------------------------------------
-- Freigabe widerrufen: loescht alles bisher Geteilte des Aufrufers (Archiv und Nutzung) und haelt den Zeitpunkt
-- fest. Mehrfach aufrufbar. Die App ruft das beim Ausschalten (offline: beim naechsten Start, immer vor neuem Senden).
-- Die Zaehler der Mengenbremse (daten_zaehler, nur Zahlen) bleiben bis zu 48 Stunden stehen, sonst setzte ein
-- Widerruf die Bremse zurueck.
-- ---------------------------------------------------------------------------
create or replace function public.freigabe_widerrufen()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n_partien integer;
  n_nutzung integer;
  am timestamptz := now();
begin
  if uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  delete from public.partien_archiv where user_id = uid;
  get diagnostics n_partien = row_count;
  delete from public.nutzung where user_id = uid;
  get diagnostics n_nutzung = row_count;
  insert into public.freigabe_widerrufe (user_id, widerrufen_am, geloescht_partien, geloescht_nutzung)
  values (uid, am, n_partien, n_nutzung)
  on conflict (user_id) do update
    set widerrufen_am = excluded.widerrufen_am,
        geloescht_partien = public.freigabe_widerrufe.geloescht_partien + excluded.geloescht_partien,
        geloescht_nutzung = public.freigabe_widerrufe.geloescht_nutzung + excluded.geloescht_nutzung;
  return jsonb_build_object('widerrufen_am', am, 'geloescht_partien', n_partien, 'geloescht_nutzung', n_nutzung);
end;
$$;

revoke execute on function public.freigabe_widerrufen() from public, anon;
grant execute on function public.freigabe_widerrufen() to authenticated;

-- ---------------------------------------------------------------------------
-- Konto loeschen (Art. 17): alles des Aufrufers, zuletzt der Auth-Nutzer selbst. Laeuft als Besitzer der
-- Funktion (security definer), damit auch auth.users erreichbar ist; der Aufrufer kommt nur an sich selbst.
-- Mit dem Auth-Nutzer verschwinden per on delete cascade auch Identitaeten (Google), Sitzungen, Online-Partien
-- (partien_online, falls eingespielt) und der Widerrufs-Vermerk. Das Anmeldeprotokoll von Supabase
-- (auth.audit_log_entries: E-Mail und IP je Anmeldung, ohne Fremdschluessel) wird hier ebenfalls geloescht, soweit
-- die Rechte reichen; fehlt die Tabelle oder das Recht, laeuft die Loeschung trotzdem durch. Nicht erreichbar sind
-- Server-Logs und Sicherungen des Anbieters: Sie laufen nach dessen Fristen ab (Datenschutzerklaerung).
-- ---------------------------------------------------------------------------
create or replace function public.konto_loeschen()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  delete from public.nutzung where user_id = uid;
  delete from public.partien_archiv where user_id = uid;
  delete from public.spielstaende where user_id = uid;
  delete from public.profile where user_id = uid;
  begin
    delete from auth.audit_log_entries e where e.payload ->> 'actor_id' = uid::text;
  exception
    when undefined_table or insufficient_privilege then null;
  end;
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.konto_loeschen() from public, anon;
grant execute on function public.konto_loeschen() to authenticated;

-- ---------------------------------------------------------------------------
-- Datenauskunft (Art. 15/20): alles, was der Server ueber den Aufrufer hat. Vom Spielstand nur die Metadaten
-- (den Stand selbst hat der Spieler schon lokal und ueber die Sicherung).
-- ---------------------------------------------------------------------------
-- Online-Partien und Fehlversuche beim Beitreten (online-schema.sql) und das Anmeldeprotokoll kommen nur dazu, wenn
-- es sie gibt: Die Datei laeuft so in jeder Reihenfolge und auch ohne das Online-Schema.
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
begin
  if uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
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
    'partien_online', online,
    -- Fehlversuche beim Beitreten zu Online-Partien (Zahl je Tag; leer, wenn online-schema.sql fehlt)
    'online_versuche', versuche,
    -- Zaehler der Mengenbremse (Zahl der geteilten Zeilen je Tabelle und Stunde, ohne Inhalte, hoechstens 48 Stunden)
    'mengenzaehler', coalesce(
      (select jsonb_agg(jsonb_build_object('tabelle', z.tabelle, 'stunde', z.stunde, 'anzahl', z.anzahl)
                        order by z.stunde, z.tabelle)
       from public.daten_zaehler z where z.user_id = uid),
      '[]'::jsonb),
    -- Anmeldeprotokoll von Supabase (Zeitpunkt, Art, IP); null, wenn die Funktion es nicht lesen darf
    'anmeldeprotokoll', protokoll
  );
end;
$$;

revoke execute on function public.meine_daten() from public, anon;
grant execute on function public.meine_daten() to authenticated;

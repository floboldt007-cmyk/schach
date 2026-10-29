-- Limitierte Editionen der Werkstatt, Server-Teil Etappe 1 (Entscheidung des Besitzers vom 29.10.2026, Form B: feste
-- Auflage ab 100 plus Verkaufszeitraum, nie Neuauflage, Nummern der Reihe nach). Nur Stripe-Testmodus, ohne
-- Oberflaeche. Mehrfach ausfuehrbar (Muster: schema.sql). Vorher schema.sql einspielen (auth.users und die
-- Zeitstempel-Funktion stehen dort; sie wird hier fuer den Fall, dass diese Datei allein laeuft, noch einmal angelegt).
-- Konzept: Vault, Schach-App/Arbeitsstand-2026-10-29/Konzept-Limitierte-Editionen.md (Abschnitte 4, 6 und 8).
--
-- Grundsatz: Der Besitz einer Edition steht NUR hier in der Datenbank (besitz), nie im Spielstand oder im Browser. Den
-- Cloud-Spielstand darf jeder selbst beschreiben, diese Tabellen nicht. Preise stehen nie im Repo, nur in den Zeilen,
-- die Flo im SQL Editor anlegt (editionen.betrag_cent, waehrung, stripe_preis).
--
-- Tabellen:
--   altersangaben         Selbstauskunft "18 oder aelter" je Konto, mit Zeitpunkt. Kein Geburtsdatum. Nutzer lesen die
--                         eigene Zeile und schreiben nur ueber alter_angeben(). Mit dem Konto geloescht.
--   editionen             eine Zeile je Edition. Flo legt sie im SQL Editor an. Lesen nur Konten mit bestaetigtem
--                         "18 oder aelter", und nur die festen Angaben (Spaltenrechte): vergeben, reserviert, endzahl,
--                         stripe_preis und die Schalter nie, sonst waere der Umsatz je Edition live oeffentlich.
--   reservierungen        haelt ein Stueck, solange jemand an der Stripe-Kasse ist. Ein offener Kauf je Konto und
--                         Edition (Teilindex). Nutzer lesen die eigenen Zeilen ohne sitzung_id und zahlung_id.
--   edition_zustimmungen  Beleg fuer die beiden Erklaerungen zum Widerruf (sofortige Lieferung, Kenntnis vom Erloeschen)
--                         je Reservierung, mit Textversion und Zeitpunkt. Nach Kontoloeschung pseudonym (user_id leer).
--   besitz                wer welche Nummer hat. Nummer je Edition eindeutig, ab 1, der Reihe nach in der Reihenfolge
--                         der Verbuchung. Ein Stueck je Konto und Edition. Eine Nummer wird nie neu vergeben, auch nach
--                         Erstattung, Widerruf oder Rueckbuchung nicht (nur der Status aendert sich). Nach Kontoloeschung
--                         bleibt die Zeile pseudonym (user_id leer, die Nummer bleibt verbrannt). Nur der Besitzer liest.
--   edition_ereignisse    jedes Stripe-Ereignis genau einmal samt Ergebnis (Idempotenz), dazu offene Erstattungen. Nur
--                         Service-Rolle (lesen). Nach 90 Tagen geloescht.
--   sonderstuecke         Flos Erfinder-Profil (Nr. 0, 1 von 1): je Stueck genau eine Zeile. Eintragen nur der Besitzer
--                         der Datenbank im SQL Editor, keine Funktion und kein Nutzer kann schreiben. Angemeldete lesen
--                         die eigenen Zeilen. Was Gegner sehen, kommt spaeter ueber einen Server-Kanal (Etappe 3b).
--
-- Regeln in der Datenbank (nicht nur in der App):
--   auflage >= 100; vergeben + reserviert <= auflage; vergeben sinkt nie (Trigger EDITION_VERGEBEN_SINKT); ab
--   angekuendigt_am (sobald der Zeitpunkt erreicht ist) sind Name, Auflage, Zeitraum, Stripe-Preis, Betrag und Waehrung
--   eingefroren (Trigger EDITION_EINGEFROREN), das Ende laesst sich dann nur vorziehen, wenn alles vergeben ist, nie
--   verschieben; eine angekuendigte Edition laesst sich nicht loeschen. Angekuendigt wird mindestens 28 Tage vor dem
--   Verkaufsstart (vorsichtige Empfehlung aus dem Konzept, wie Fairness-Regel 19 fuer Events). Neue Editionen beginnen
--   mit vergeben = reserviert = 0 (EDITION_NEU_MIT_ZAEHLERN), so ist die Zahl der Nummern immer gleich vergeben.
--   Der Schalter verkauf_freigegeben (Standard aus) steht in edition_reserviere vor allen anderen Verkaufsbedingungen.
--   zeige_restzahl (Standard aus) entscheidet, ob edition_stand eine Restzahl nennt. Kassenschluss: ab verkauf_bis minus
--   31 Minuten oeffnet der Server keine neue Kasse mehr (Stripe-Kassen leben mindestens 30 Minuten, eine Minute Puffer
--   fuer Laufzeit und Uhren), so endet jede Kasse spaetestens mit dem angekuendigten Ende.
--
-- Funktionen (security definer, search_path = ''):
--   alter_angeben(ab18)                          angemeldete Nutzer: eigene Selbstauskunft setzen (mit Zeitpunkt)
--   edition_stand(produkt), edition_staende()   angemeldete Nutzer ab 18: feste Angaben und Status 'angekuendigt' |
--                                                'erhaeltlich' | 'ausverkauft' | 'beendet'; Restzahl nur mit
--                                                zeige_restzahl, Endzahl nur fuer Besitzer eines Stuecks oder mit dem
--                                                Schalter. Unter 18, ohne Antwort und anon: nichts.
--   edition_reserviere(...)                      Service-Rolle (Edge Function werkstatt-kasse): atomar reservieren
--   edition_kasse_setzen(...)                    Service-Rolle: Stripe-Kasse an die Reservierung haengen
--   edition_kasse_abbrechen(reservierung)        Service-Rolle: Reservierung ohne Kasse freigeben (Stripe hat abgelehnt)
--   edition_stripe_ereignis(...)                 Service-Rolle (Edge Function werkstatt-webhook): Ereignis verbuchen
--   edition_erstattung_gesendet(ereignis_id)     Service-Rolle: eine automatische Erstattung ist bei Stripe angekommen
--   edition_aufraeumen()                         Service-Rolle und Besitzer: Reservierungen ohne Kasse nach 2 Stunden
--                                                freigeben, Endzahlen festschreiben, alte Zeilen nach 90 Tagen loeschen
--   intern (fuer niemanden freigegeben): edition_kassenschluss, edition_schliesse_ab, edition_stand_json,
--   edition_ereignis_json, editionen_schutz, besitz_schutz
--
-- Fehler kommen als Kennungen EDITION_... (raise exception). Vertrag mit supabase/functions/_gemeinsam/werkstatt.js
-- (KENNUNGEN); tests/server-werkstatt.test.mjs prueft, dass jede Kennung aus edition_reserviere dort steht.
--
-- Gleichzeitigkeit: Das Reservieren ist ein einziges update mit allen Bedingungen in der where-Klausel. Wollen zwei
-- Konten gleichzeitig das letzte Stueck, wartet der zweite Befehl auf den ersten und prueft danach gegen den neuen Stand.
-- Aufrufe desselben Kontos fuer dieselbe Edition laufen nacheinander (pg_advisory_xact_lock), der zweite bekommt die
-- bestehende Reservierung zurueck.
--
-- Hinweis fuer spaetere Aenderungen: `create or replace function` kann weder Parameternamen noch Rueckgabetyp aendern.
-- Dann vorher `drop function public.<name>(<typen>)` ausfuehren.

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------
create table if not exists public.altersangaben (
  user_id uuid primary key references auth.users (id) on delete cascade,
  ab18 boolean not null,
  angegeben_am timestamptz not null default now()
);

create table if not exists public.editionen (
  produkt_id text primary key,
  name text not null,
  stripe_preis text,
  betrag_cent integer,
  waehrung text,
  auflage integer not null,
  angekuendigt_am timestamptz,
  verkauf_ab timestamptz not null,
  verkauf_bis timestamptz not null,
  verkauf_freigegeben boolean not null default false,
  zeige_restzahl boolean not null default false,
  vergeben integer not null default 0,
  reserviert integer not null default 0,
  endzahl integer,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  constraint editionen_id_form check (produkt_id ~ '^[a-z0-9-]{2,40}$'),
  constraint editionen_name_laenge check (char_length(name) between 1 and 60),
  constraint editionen_preis_form check (stripe_preis is null or stripe_preis ~ '^price_[A-Za-z0-9]{1,200}$'),
  constraint editionen_betrag check (betrag_cent is null or betrag_cent > 0),
  constraint editionen_waehrung check (waehrung is null or waehrung ~ '^[a-z]{3}$'),
  constraint editionen_auflage check (auflage >= 100 and auflage <= 1000000),
  constraint editionen_fenster check (verkauf_bis > verkauf_ab),
  constraint editionen_vorlauf check (angekuendigt_am is null or angekuendigt_am <= verkauf_ab - interval '28 days'),
  constraint editionen_angekuendigt_vollstaendig
    check (angekuendigt_am is null or (stripe_preis is not null and betrag_cent is not null and waehrung is not null)),
  constraint editionen_freigabe check (not verkauf_freigegeben or angekuendigt_am is not null),
  constraint editionen_zaehler check (vergeben >= 0 and reserviert >= 0 and vergeben + reserviert <= auflage),
  constraint editionen_endzahl check (endzahl is null or endzahl = vergeben)
);

create table if not exists public.reservierungen (
  id uuid primary key default gen_random_uuid(),
  produkt_id text not null references public.editionen (produkt_id) on delete restrict,
  user_id uuid references auth.users (id) on delete set null,
  status text not null default 'offen',
  sitzung_id text unique,
  kassen_url text,
  kasse_bis timestamptz,
  zahlung_id text,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  constraint reservierungen_status check (status in ('offen', 'bezahlt', 'abgelaufen', 'abgebrochen')),
  constraint reservierungen_sitzung_form check (sitzung_id is null or sitzung_id ~ '^cs_[A-Za-z0-9_]{1,250}$'),
  -- Nur die Kassen-Adresse von Stripe (die App oeffnet sie; kein javascript: oder data:)
  constraint reservierungen_kassen_url_form check (kassen_url is null
    or (char_length(kassen_url) <= 2000 and kassen_url ~ '^https://checkout\.stripe\.com/[^[:space:]<>"''`]+$')),
  constraint reservierungen_zahlung_form check (zahlung_id is null or zahlung_id ~ '^pi_[A-Za-z0-9]{1,200}$')
);

-- Ein offener Kauf je Konto und Edition
create unique index if not exists reservierungen_offen_je_konto
  on public.reservierungen (user_id, produkt_id) where status = 'offen';
create index if not exists reservierungen_produkt_status on public.reservierungen (produkt_id, status);

create table if not exists public.edition_zustimmungen (
  id uuid primary key default gen_random_uuid(),
  reservierung_id uuid not null unique references public.reservierungen (id) on delete cascade,
  produkt_id text not null references public.editionen (produkt_id) on delete restrict,
  user_id uuid references auth.users (id) on delete set null,
  textversion text not null,
  zustimmung_sofortige_lieferung boolean not null,
  kenntnis_widerruf_erlischt boolean not null,
  zeitpunkt timestamptz not null default now(),
  constraint edition_zustimmungen_textversion check (textversion ~ '^[a-z0-9][a-z0-9._-]{0,39}$'),
  constraint edition_zustimmungen_beide check (zustimmung_sofortige_lieferung and kenntnis_widerruf_erlischt)
);
create index if not exists edition_zustimmungen_user on public.edition_zustimmungen (user_id);

create table if not exists public.besitz (
  produkt_id text not null references public.editionen (produkt_id) on delete restrict,
  nummer integer not null,
  user_id uuid references auth.users (id) on delete set null,
  reservierung_id uuid not null unique references public.reservierungen (id) on delete restrict,
  status text not null default 'aktiv',
  -- bleibt fuer die gesetzliche Aufbewahrungsfrist (Frist klaert der Steuerberater), danach leer
  zahlung_id text unique,
  sitzung_id text,
  erworben_am timestamptz not null default now(),
  status_zeit timestamptz,
  aktualisiert_am timestamptz not null default now(),
  primary key (produkt_id, nummer),
  constraint besitz_nummer check (nummer >= 1),
  constraint besitz_status check (status in ('aktiv', 'strittig', 'erstattet', 'zurueckgebucht', 'widerrufen')),
  constraint besitz_zahlung_form check (zahlung_id is null or zahlung_id ~ '^pi_[A-Za-z0-9]{1,200}$'),
  constraint besitz_sitzung_form check (sitzung_id is null or sitzung_id ~ '^cs_[A-Za-z0-9_]{1,250}$'),
  -- ein Stueck je Konto und Edition (auch nach einer Erstattung kein zweites; nach Kontoloeschung ist user_id leer)
  constraint besitz_ein_stueck_je_konto unique (produkt_id, user_id)
);
create index if not exists besitz_user on public.besitz (user_id);

create table if not exists public.edition_ereignisse (
  id text primary key,
  typ text not null,
  erstellt timestamptz not null,
  reservierung_id uuid,
  zahlung_id text,
  ergebnis text not null default 'offen',
  nummer integer,
  erstattung text,
  erstattung_grund text,
  eingegangen_am timestamptz not null default now(),
  constraint edition_ereignisse_id_form check (id ~ '^evt_[A-Za-z0-9]{1,200}$'),
  constraint edition_ereignisse_typ check (typ in ('checkout.session.completed', 'checkout.session.expired',
    'charge.refunded', 'charge.dispute.created', 'charge.dispute.closed')),
  constraint edition_ereignisse_erstattung check (erstattung is null or erstattung in ('offen', 'gesendet')),
  constraint edition_ereignisse_grund check (erstattung_grund is null or erstattung_grund in
    ('ausverkauft', 'endzahl', 'doppelt', 'betrag', 'sitzung', 'konto_geloescht', 'unbekannt'))
);
create index if not exists edition_ereignisse_eingang on public.edition_ereignisse (eingegangen_am);

create table if not exists public.sonderstuecke (
  stueck_id text primary key,              -- jedes Stueck gibt es genau einmal
  art text not null,
  user_id uuid references auth.users (id) on delete set null,
  nummer integer not null default 0,
  vergeben_am timestamptz not null default now(),
  constraint sonderstuecke_id_form check (stueck_id ~ '^[a-z0-9-]{2,60}$'),
  constraint sonderstuecke_art check (art in ('banner', 'titel', 'figurensatz', 'finisher')),
  constraint sonderstuecke_nummer check (nummer = 0)
);

-- ---------------------------------------------------------------------------
-- Zeitstempel und Schutz-Trigger
-- ---------------------------------------------------------------------------
-- Gleiche Funktion wie in schema.sql (fuer den Fall, dass diese Datei allein laeuft)
create or replace function public.setze_aktualisiert_am()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.aktualisiert_am = now();
  return new;
end;
$$;

drop trigger if exists editionen_setze_aktualisiert_am on public.editionen;
create trigger editionen_setze_aktualisiert_am
before update on public.editionen
for each row execute function public.setze_aktualisiert_am();

drop trigger if exists reservierungen_setze_aktualisiert_am on public.reservierungen;
create trigger reservierungen_setze_aktualisiert_am
before update on public.reservierungen
for each row execute function public.setze_aktualisiert_am();

drop trigger if exists besitz_setze_aktualisiert_am on public.besitz;
create trigger besitz_setze_aktualisiert_am
before update on public.besitz
for each row execute function public.setze_aktualisiert_am();

-- "Keine Neuauflage" als Datenbank-Regel. Ehrlich: Flo kann als Besitzer der Datenbank den Trigger entfernen. Er
-- verhindert Versehen, das Versprechen selbst tragen die AGB und Flos Wort.
create or replace function public.editionen_schutz()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.vergeben <> 0 or new.reserviert <> 0 or new.endzahl is not null then
      raise exception 'EDITION_NEU_MIT_ZAEHLERN';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.angekuendigt_am is not null and old.angekuendigt_am <= now() then
      raise exception 'EDITION_EINGEFROREN';
    end if;
    return old;
  end if;
  if new.produkt_id is distinct from old.produkt_id then
    raise exception 'EDITION_EINGEFROREN';
  end if;
  if new.vergeben < old.vergeben then
    raise exception 'EDITION_VERGEBEN_SINKT';
  end if;
  if old.endzahl is not null and new.endzahl is distinct from old.endzahl then
    raise exception 'EDITION_EINGEFROREN';
  end if;
  if old.angekuendigt_am is not null and old.angekuendigt_am <= now() then
    if new.angekuendigt_am is distinct from old.angekuendigt_am
      or new.name is distinct from old.name
      or new.auflage is distinct from old.auflage
      or new.verkauf_ab is distinct from old.verkauf_ab
      or new.stripe_preis is distinct from old.stripe_preis
      or new.betrag_cent is distinct from old.betrag_cent
      or new.waehrung is distinct from old.waehrung then
      raise exception 'EDITION_EINGEFROREN';
    end if;
    -- Das Ende wird nie verschoben. Vorziehen geht nur, wenn alles vergeben ist (ausverkauft).
    if new.verkauf_bis is distinct from old.verkauf_bis
      and (new.verkauf_bis > old.verkauf_bis or new.vergeben < new.auflage) then
      raise exception 'EDITION_EINGEFROREN';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists editionen_schutz on public.editionen;
create trigger editionen_schutz
before insert or update or delete on public.editionen
for each row execute function public.editionen_schutz();

-- Eine Nummer bleibt fuer immer vergeben: Zeilen in besitz werden nie geloescht, Edition, Nummer und Reservierung
-- aendern sich nie. Aendern duerfen sich Status, Zeitpunkte, user_id (Kontoloeschung) und zahlung_id (nach der Frist).
create or replace function public.besitz_schutz()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'EDITION_BESITZ_BLEIBT';
  end if;
  if new.produkt_id is distinct from old.produkt_id or new.nummer is distinct from old.nummer
    or new.reservierung_id is distinct from old.reservierung_id then
    raise exception 'EDITION_BESITZ_BLEIBT';
  end if;
  return new;
end;
$$;

drop trigger if exists besitz_schutz on public.besitz;
create trigger besitz_schutz
before update or delete on public.besitz
for each row execute function public.besitz_schutz();

-- ---------------------------------------------------------------------------
-- Interne Helfer
-- ---------------------------------------------------------------------------
-- Ab hier keine neue Kasse mehr (siehe Kopf). Gleiche Zahl wie KASSE_S in supabase/functions/_gemeinsam/werkstatt.js.
create or replace function public.edition_kassenschluss(bis timestamptz)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select bis - interval '31 minutes';
$$;

-- Endzahl festschreiben, sobald keine Reservierung mehr offen ist und das Fenster vorbei oder alles vergeben ist.
-- Danach aendert sich vergeben nie mehr (Pruefung editionen_endzahl), spaete Zahlungen werden erstattet.
create or replace function public.edition_schliesse_ab(produkt text)
returns void
language sql
set search_path = ''
as $$
  update public.editionen e
  set endzahl = e.vergeben
  where e.produkt_id = produkt
    and e.endzahl is null
    and e.reserviert = 0
    and (now() >= e.verkauf_bis or e.vergeben >= e.auflage);
$$;

-- Oeffentlicher Stand einer Edition fuer einen Nutzer (ab 18 geprueft vom Aufrufer)
create or replace function public.edition_stand_json(e public.editionen, uid uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_status text;
  v_endzahl integer;
  v_darf_zahl boolean;
begin
  v_status := case
    when e.vergeben >= e.auflage then 'ausverkauft'
    when now() >= public.edition_kassenschluss(e.verkauf_bis) or e.endzahl is not null then 'beendet'
    when now() < e.verkauf_ab or not e.verkauf_freigegeben then 'angekuendigt'
    else 'erhaeltlich'
  end;
  -- Die Endzahl verraet den Umsatz: nur fuer Besitzer eines Stuecks dieser Edition oder mit dem Schalter
  v_darf_zahl := e.zeige_restzahl
    or exists (select 1 from public.besitz b where b.produkt_id = e.produkt_id and b.user_id = uid);
  if v_status in ('ausverkauft', 'beendet') and v_darf_zahl then
    v_endzahl := coalesce(e.endzahl, case when e.reserviert = 0 then e.vergeben end);
  end if;
  return jsonb_build_object(
    'produkt_id', e.produkt_id,
    'name', e.name,
    'auflage', e.auflage,
    'verkauf_ab', e.verkauf_ab,
    'verkauf_bis', e.verkauf_bis,
    'kassenschluss', public.edition_kassenschluss(e.verkauf_bis),
    'betrag_cent', e.betrag_cent,
    'waehrung', e.waehrung,
    'status', v_status,
    'restzahl', case when e.zeige_restzahl and v_status = 'erhaeltlich' then e.auflage - e.vergeben end,
    'endzahl', v_endzahl,
    'endzahl_folgt', v_status = 'beendet' and e.endzahl is null and e.reserviert > 0
  );
end;
$$;

create or replace function public.edition_ereignis_json(ev public.edition_ereignisse, doppelt boolean)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'ereignis', ev.id,
    'ergebnis', ev.ergebnis,
    'doppelt', doppelt,
    'nummer', ev.nummer,
    'reservierung', ev.reservierung_id,
    'zahlung', ev.zahlung_id,
    'erstatten', coalesce(ev.erstattung = 'offen', false),
    'erstattung_grund', ev.erstattung_grund
  );
$$;

-- ---------------------------------------------------------------------------
-- Altersangabe (angemeldete Nutzer)
-- ---------------------------------------------------------------------------
create or replace function public.alter_angeben(ab18 boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_ab18 boolean := ab18;
  a public.altersangaben;
begin
  if uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  if v_ab18 is null then
    raise exception 'EDITION_EINGABE';
  end if;
  insert into public.altersangaben as t (user_id, ab18, angegeben_am)
  values (uid, v_ab18, now())
  on conflict (user_id) do update set ab18 = excluded.ab18, angegeben_am = excluded.angegeben_am
  returning * into a;
  return jsonb_build_object('ab18', a.ab18, 'angegeben_am', a.angegeben_am);
end;
$$;

-- ---------------------------------------------------------------------------
-- Stand fuer die App (angemeldete Nutzer mit "18 oder aelter"; sonst null bzw. leere Liste)
-- ---------------------------------------------------------------------------
create or replace function public.edition_stand(produkt text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  e public.editionen;
begin
  if uid is null or not exists (select 1 from public.altersangaben a where a.user_id = uid and a.ab18) then
    return null;
  end if;
  select * into e from public.editionen x
  where x.produkt_id = produkt and x.angekuendigt_am is not null and x.angekuendigt_am <= now();
  if not found then
    return null;
  end if;
  return public.edition_stand_json(e, uid);
end;
$$;

create or replace function public.edition_staende()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.altersangaben a where a.user_id = uid and a.ab18) then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(public.edition_stand_json(x, uid) order by x.verkauf_ab, x.produkt_id)
    from public.editionen x
    where x.angekuendigt_am is not null and x.angekuendigt_am <= now()), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Reservieren (nur Service-Rolle). Die Edge Function werkstatt-kasse ruft das mit der Nutzer-ID aus dem geprueften
-- Token. Rueckgabe: die Reservierung und was die Function fuer die Stripe-Kasse braucht (Zeiten als Unix-Sekunden).
-- Hat das Konto schon eine offene Reservierung dieser Edition, kommt genau diese zurueck (neu = false), mit ihrer Kasse.
-- ---------------------------------------------------------------------------
create or replace function public.edition_reserviere(
  nutzer uuid,
  produkt text,
  textversion text,
  zustimmung_sofort boolean,
  kenntnis_widerruf boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nutzer uuid := nutzer;
  v_produkt text := produkt;
  v_text text := textversion;
  v_neu boolean := false;
  e public.editionen;
  r public.reservierungen;
begin
  if v_nutzer is null or v_produkt is null or v_produkt !~ '^[a-z0-9-]{2,40}$'
    or v_text is null or v_text !~ '^[a-z0-9][a-z0-9._-]{0,39}$' then
    raise exception 'EDITION_EINGABE';
  end if;
  select * into e from public.editionen x where x.produkt_id = v_produkt;
  if not found or e.angekuendigt_am is null or e.angekuendigt_am > now() then
    raise exception 'EDITION_UNBEKANNT';
  end if;
  -- Der Server-Schalter zuerst: ist der Verkauf nicht freigegeben, geht gar nichts (auch keine bestehende Kasse)
  if not e.verkauf_freigegeben then
    raise exception 'EDITION_GESPERRT';
  end if;
  if zustimmung_sofort is distinct from true or kenntnis_widerruf is distinct from true then
    raise exception 'EDITION_ZUSTIMMUNG';
  end if;
  if not exists (select 1 from auth.users u where u.id = v_nutzer and u.email_confirmed_at is not null) then
    raise exception 'EDITION_EMAIL';
  end if;
  if not exists (select 1 from public.altersangaben a where a.user_id = v_nutzer and a.ab18) then
    raise exception 'EDITION_ALTER';
  end if;

  -- Doppelklick und zwei Tabs: Aufrufe desselben Kontos fuer dieselbe Edition nacheinander
  perform pg_advisory_xact_lock(hashtextextended('edition:' || v_produkt || ':' || v_nutzer::text, 0));

  select * into r from public.reservierungen x
  where x.user_id = v_nutzer and x.produkt_id = v_produkt and x.status = 'offen';
  if not found then
    if exists (select 1 from public.besitz b where b.user_id = v_nutzer and b.produkt_id = v_produkt) then
      raise exception 'EDITION_SCHON_IM_BESITZ';
    end if;
    -- Das Herzstueck: atomar reservieren, alle Bedingungen in einem Befehl
    update public.editionen x
    set reserviert = x.reserviert + 1
    where x.produkt_id = v_produkt
      and x.verkauf_freigegeben
      and now() >= x.verkauf_ab
      and now() < public.edition_kassenschluss(x.verkauf_bis)
      and x.endzahl is null
      and x.vergeben + x.reserviert < x.auflage
    returning * into e;
    if not found then
      select * into e from public.editionen x where x.produkt_id = v_produkt;
      if not e.verkauf_freigegeben then
        raise exception 'EDITION_GESPERRT';
      end if;
      if now() < e.verkauf_ab then
        raise exception 'EDITION_NOCH_NICHT';
      end if;
      if e.vergeben >= e.auflage then
        raise exception 'EDITION_AUSVERKAUFT';
      end if;
      if now() >= public.edition_kassenschluss(e.verkauf_bis) or e.endzahl is not null then
        raise exception 'EDITION_BEENDET';
      end if;
      -- Alle restlichen Stuecke sind gerade an einer Kasse reserviert
      raise exception 'EDITION_NICHT_VERFUEGBAR';
    end if;
    insert into public.reservierungen as t (produkt_id, user_id) values (v_produkt, v_nutzer) returning * into r;
    insert into public.edition_zustimmungen as t (reservierung_id, produkt_id, user_id, textversion,
      zustimmung_sofortige_lieferung, kenntnis_widerruf_erlischt)
    values (r.id, v_produkt, v_nutzer, v_text, true, true);
    v_neu := true;
  end if;
  return jsonb_build_object(
    'reservierung', r.id,
    'neu', v_neu,
    'produkt_id', e.produkt_id,
    'name', e.name,
    'stripe_preis', e.stripe_preis,
    'betrag_cent', e.betrag_cent,
    'waehrung', e.waehrung,
    'kassen_url', r.kassen_url,
    'kasse_bis_s', floor(extract(epoch from r.kasse_bis))::bigint,
    -- Ablauf der Stripe-Kasse: fest aus dem Zeitpunkt der Reservierung (gleiche Anfrage bei jedem Versuch, damit der
    -- Idempotency-Key bei Stripe passt) und nie nach dem angekuendigten Ende
    'stripe_ablauf_s', floor(extract(epoch from r.erstellt_am))::bigint + 31 * 60,
    'kassenschluss_s', floor(extract(epoch from public.edition_kassenschluss(e.verkauf_bis)))::bigint,
    'verkauf_bis_s', floor(extract(epoch from e.verkauf_bis))::bigint
  );
end;
$$;

-- Kasse an die Reservierung haengen (nur Service-Rolle). Mehrfach mit derselben Sitzung: 'schon_gesetzt'.
create or replace function public.edition_kasse_setzen(
  reservierung uuid,
  sitzung text,
  kassen_url text,
  kasse_bis timestamptz)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res uuid := reservierung;
  v_sitzung text := sitzung;
  v_url text := kassen_url;
  v_bis timestamptz := kasse_bis;
  r public.reservierungen;
begin
  if v_res is null or v_sitzung is null or v_sitzung !~ '^cs_[A-Za-z0-9_]{1,250}$' or v_url is null or v_bis is null then
    raise exception 'EDITION_EINGABE';
  end if;
  select * into r from public.reservierungen x where x.id = v_res for update;
  if not found then
    raise exception 'EDITION_RESERVIERUNG';
  end if;
  if r.sitzung_id is not null then
    if r.sitzung_id = v_sitzung then
      return 'schon_gesetzt';
    end if;
    raise exception 'EDITION_RESERVIERUNG';
  end if;
  if r.status <> 'offen' then
    raise exception 'EDITION_RESERVIERUNG';
  end if;
  update public.reservierungen x
  set sitzung_id = v_sitzung, kassen_url = v_url, kasse_bis = v_bis
  where x.id = v_res;
  return 'gesetzt';
end;
$$;

-- Reservierung ohne Kasse freigeben (nur Service-Rolle): Stripe hat die Kasse sicher nicht angelegt. Hat die
-- Reservierung schon eine Kasse, bleibt sie: Freigegeben wird dann nur nach dem Ereignis checkout.session.expired.
create or replace function public.edition_kasse_abbrechen(reservierung uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res uuid := reservierung;
  r public.reservierungen;
begin
  select * into r from public.reservierungen x where x.id = v_res for update;
  if not found then
    return 'unbekannt';
  end if;
  if r.status <> 'offen' then
    return r.status;
  end if;
  if r.sitzung_id is not null then
    return 'hat_kasse';
  end if;
  update public.reservierungen x set status = 'abgebrochen' where x.id = v_res;
  update public.editionen x set reserviert = x.reserviert - 1 where x.produkt_id = r.produkt_id;
  perform public.edition_schliesse_ab(r.produkt_id);
  return 'freigegeben';
end;
$$;

-- ---------------------------------------------------------------------------
-- Aufraeumen (Service-Rolle und Besitzer; laeuft auch nach jedem Stripe-Ereignis)
-- ---------------------------------------------------------------------------
create or replace function public.edition_aufraeumen()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  n_frei integer := 0;
  n_ereignisse integer := 0;
  n_reservierungen integer := 0;
begin
  -- Reservierungen, die nach 2 Stunden noch keine Kasse haben, bekamen nie eine (die Kasse lebt 31 Minuten und kommt
  -- sonst mit checkout.session.expired zurueck). Zahlt jemand doch noch, greift das Sicherheitsnetz fuer spaete Zahlungen.
  for r in
    select x.id, x.produkt_id from public.reservierungen x
    where x.status = 'offen' and x.sitzung_id is null and x.erstellt_am < now() - interval '2 hours'
    for update
  loop
    update public.reservierungen x set status = 'abgebrochen' where x.id = r.id;
    update public.editionen x set reserviert = x.reserviert - 1 where x.produkt_id = r.produkt_id;
    n_frei := n_frei + 1;
  end loop;
  perform public.edition_schliesse_ab(x.produkt_id) from public.editionen x where x.endzahl is null;
  delete from public.edition_ereignisse t
  where t.eingegangen_am < now() - interval '90 days' and t.erstattung is distinct from 'offen';
  get diagnostics n_ereignisse = row_count;
  delete from public.reservierungen t
  where t.status in ('abgelaufen', 'abgebrochen') and t.aktualisiert_am < now() - interval '90 days'
    and not exists (select 1 from public.besitz b where b.reservierung_id = t.id);
  get diagnostics n_reservierungen = row_count;
  return jsonb_build_object('freigegeben', n_frei, 'ereignisse_geloescht', n_ereignisse,
    'reservierungen_geloescht', n_reservierungen);
end;
$$;

-- ---------------------------------------------------------------------------
-- Stripe-Ereignis verbuchen (nur Service-Rolle). Die Parameter liefert supabase/functions/_gemeinsam/werkstatt.js
-- (auswertenEdition). Rueckgabe: { ereignis, ergebnis, doppelt, nummer, reservierung, zahlung, erstatten,
-- erstattung_grund }. Bei erstatten = true erstattet die Edge Function die Zahlung bei Stripe (Idempotency-Key je
-- Zahlung) und meldet das mit edition_erstattung_gesendet. Ein doppeltes Ereignis liefert das gespeicherte Ergebnis.
--
-- Ergebnisse: checkout.session.completed 'zugeteilt' | 'zugeteilt_spaet' | 'erstatten' | 'schon_verbucht' |
-- 'nicht_bezahlt'; checkout.session.expired 'freigegeben' | 'unveraendert' | 'unbekannt'; charge.* 'erstattet' |
-- 'widerrufen' | 'teilerstattung' | 'strittig' | 'aktiv' | 'zurueckgebucht' | 'unveraendert' | 'veraltet' | 'ohne_besitz'.
-- Ob eine Zahlung ins Fenster faellt, entscheidet der Zeitpunkt der Reservierung, nie die Uhr beim Verbuchen.
-- ---------------------------------------------------------------------------
create or replace function public.edition_stripe_ereignis(
  ereignis_id text,
  typ text,
  erstellt timestamptz,
  reservierung uuid default null,
  sitzung text default null,
  zahlung text default null,
  zahlstatus text default null,
  betrag integer default null,
  waehrung text default null,
  erstattet integer default null,
  grund text default null,
  streit text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := ereignis_id;
  v_typ text := typ;
  v_zeit timestamptz := erstellt;
  v_res uuid := reservierung;
  v_sitzung text := sitzung;
  v_zahlung text := zahlung;
  v_zahlstatus text := zahlstatus;
  v_betrag integer := betrag;
  v_waehrung text := waehrung;
  v_erstattet integer := erstattet;
  v_grund text := grund;
  v_streit text := streit;
  n integer;
  ev public.edition_ereignisse;
  r public.reservierungen;
  e public.editionen;
  b public.besitz;
  v_ergebnis text;
  v_nummer integer;
  v_erstatten text;
  v_neu_status text;
  v_gefunden boolean;
begin
  -- Form pruefen (die Auswertung im Modul prueft dasselbe; hier zur Sicherheit noch einmal)
  if v_id is null or v_id !~ '^evt_[A-Za-z0-9]{1,200}$' or v_zeit is null or v_typ is null
    or v_typ not in ('checkout.session.completed', 'checkout.session.expired', 'charge.refunded',
      'charge.dispute.created', 'charge.dispute.closed')
    or (v_zahlung is not null and v_zahlung !~ '^pi_[A-Za-z0-9]{1,200}$')
    or (v_sitzung is not null and v_sitzung !~ '^cs_[A-Za-z0-9_]{1,250}$')
    or (v_grund is not null and v_grund !~ '^[a-z_]{1,40}$')
    or (v_streit is not null and v_streit !~ '^[a-z_]{1,40}$') then
    raise exception 'EDITION_EREIGNIS_UNGUELTIG';
  end if;
  if v_typ in ('checkout.session.completed', 'checkout.session.expired') and (v_res is null or v_sitzung is null) then
    raise exception 'EDITION_EREIGNIS_UNGUELTIG';
  end if;
  if v_typ = 'checkout.session.completed' and (v_zahlstatus is null or v_zahlstatus !~ '^[a-z_]{1,40}$'
    or v_betrag is null or v_betrag < 0 or v_waehrung is null or v_waehrung !~ '^[a-z]{3}$'
    or (v_zahlstatus = 'paid' and v_zahlung is null)) then
    raise exception 'EDITION_EREIGNIS_UNGUELTIG';
  end if;
  if v_typ like 'charge.%' and v_zahlung is null then
    raise exception 'EDITION_EREIGNIS_UNGUELTIG';
  end if;
  if v_typ = 'charge.refunded' and (v_betrag is null or v_betrag < 0 or v_erstattet is null or v_erstattet < 0) then
    raise exception 'EDITION_EREIGNIS_UNGUELTIG';
  end if;

  -- Idempotenz: dasselbe Ereignis nur einmal. Ein gleichzeitiger zweiter Aufruf wartet am Primaerschluessel.
  insert into public.edition_ereignisse as t (id, typ, erstellt, reservierung_id, zahlung_id)
  values (v_id, v_typ, v_zeit, v_res, v_zahlung)
  on conflict (id) do nothing;
  get diagnostics n = row_count;
  if n = 0 then
    select * into ev from public.edition_ereignisse t where t.id = v_id;
    return public.edition_ereignis_json(ev, true);
  end if;

  if v_typ = 'checkout.session.completed' then
    select * into r from public.reservierungen x where x.id = v_res for update;
    v_gefunden := found;
    if v_gefunden and r.status = 'bezahlt' and r.sitzung_id = v_sitzung then
      v_ergebnis := 'schon_verbucht';
      v_nummer := (select b2.nummer from public.besitz b2 where b2.reservierung_id = r.id);
    elsif v_zahlstatus <> 'paid' then
      -- Nur Karte ist erlaubt, das kommt praktisch nicht vor. Die Reservierung bleibt, bis die Kasse ablaeuft.
      v_ergebnis := 'nicht_bezahlt';
    elsif not v_gefunden then
      v_erstatten := 'unbekannt';
    elsif r.sitzung_id is not null and r.sitzung_id <> v_sitzung then
      v_erstatten := 'sitzung';
    else
      select * into e from public.editionen x where x.produkt_id = r.produkt_id for update;
      if v_betrag <> e.betrag_cent or v_waehrung <> e.waehrung then
        v_erstatten := 'betrag';
      elsif r.user_id is null then
        v_erstatten := 'konto_geloescht';
      elsif exists (select 1 from public.besitz x where x.produkt_id = r.produkt_id and x.user_id = r.user_id) then
        v_erstatten := 'doppelt';
      elsif r.status = 'offen' then
        -- Regelfall: aus der Reservierung wird die naechste Nummer
        update public.editionen x
        set vergeben = x.vergeben + 1, reserviert = x.reserviert - 1
        where x.produkt_id = r.produkt_id
        returning x.vergeben into v_nummer;
        v_ergebnis := 'zugeteilt';
      else
        -- Spaete Zahlung: die Reservierung war schon freigegeben. Ist noch ein Stueck frei und die Endzahl nicht
        -- festgeschrieben, wird zugeteilt, sonst erstattet.
        perform public.edition_schliesse_ab(r.produkt_id);
        update public.editionen x
        set vergeben = x.vergeben + 1
        where x.produkt_id = r.produkt_id and x.endzahl is null and x.vergeben + x.reserviert < x.auflage
        returning x.vergeben into v_nummer;
        if v_nummer is not null then
          v_ergebnis := 'zugeteilt_spaet';
        else
          select * into e from public.editionen x where x.produkt_id = r.produkt_id;
          v_erstatten := case when e.vergeben + e.reserviert >= e.auflage then 'ausverkauft' else 'endzahl' end;
        end if;
      end if;
      if v_nummer is not null then
        update public.reservierungen x
        set status = 'bezahlt', sitzung_id = coalesce(x.sitzung_id, v_sitzung), zahlung_id = v_zahlung
        where x.id = r.id;
        insert into public.besitz as t (produkt_id, nummer, user_id, reservierung_id, zahlung_id, sitzung_id, status_zeit)
        values (r.produkt_id, v_nummer, r.user_id, r.id, v_zahlung, v_sitzung, v_zeit);
        perform public.edition_schliesse_ab(r.produkt_id);
      elsif v_erstatten is not null then
        -- Der Kauf scheitert: eine noch offene Reservierung wird frei, die Zahlung geht zurueck
        if r.status = 'offen' then
          update public.reservierungen x
          set status = 'abgebrochen', sitzung_id = coalesce(x.sitzung_id, v_sitzung), zahlung_id = v_zahlung
          where x.id = r.id;
          update public.editionen x set reserviert = x.reserviert - 1 where x.produkt_id = r.produkt_id;
          perform public.edition_schliesse_ab(r.produkt_id);
        else
          update public.reservierungen x set zahlung_id = coalesce(x.zahlung_id, v_zahlung) where x.id = r.id;
        end if;
      end if;
    end if;
    if v_erstatten is not null then
      v_ergebnis := 'erstatten';
    end if;

  elsif v_typ = 'checkout.session.expired' then
    select * into r from public.reservierungen x where x.id = v_res for update;
    if not found then
      v_ergebnis := 'unbekannt';
    elsif r.status <> 'offen' or (r.sitzung_id is not null and r.sitzung_id <> v_sitzung) then
      v_ergebnis := 'unveraendert';
    else
      update public.reservierungen x
      set status = 'abgelaufen', sitzung_id = coalesce(x.sitzung_id, v_sitzung)
      where x.id = r.id;
      update public.editionen x set reserviert = x.reserviert - 1 where x.produkt_id = r.produkt_id;
      perform public.edition_schliesse_ab(r.produkt_id);
      v_ergebnis := 'freigegeben';
    end if;

  else
    -- Erstattung und Rueckbuchung: zugeordnet ueber die Zahlung (pi_...). Die Nummer bleibt immer vergeben.
    select * into b from public.besitz x where x.zahlung_id = v_zahlung for update;
    if not found then
      v_ergebnis := 'ohne_besitz';
    elsif b.status_zeit is not null and v_zeit < b.status_zeit then
      v_ergebnis := 'veraltet';
    else
      v_neu_status := null;
      if v_typ = 'charge.refunded' then
        if v_betrag > 0 and v_erstattet >= v_betrag then
          if b.status in ('aktiv', 'strittig') then
            v_neu_status := case when v_grund = 'widerruf' then 'widerrufen' else 'erstattet' end;
          end if;
        else
          v_ergebnis := 'teilerstattung';   -- Kulanz: das Stueck bleibt
        end if;
      elsif v_typ = 'charge.dispute.created' then
        if b.status = 'aktiv' then
          v_neu_status := 'strittig';
        end if;
      elsif b.status = 'strittig' then
        if v_streit = 'lost' then
          v_neu_status := 'zurueckgebucht';
        elsif v_streit in ('won', 'warning_closed') then
          v_neu_status := 'aktiv';
        end if;
      end if;
      if v_neu_status is not null then
        update public.besitz x set status = v_neu_status, status_zeit = v_zeit
        where x.produkt_id = b.produkt_id and x.nummer = b.nummer;
        v_ergebnis := v_neu_status;
        v_nummer := b.nummer;
      elsif v_ergebnis is null then
        v_ergebnis := 'unveraendert';
      end if;
    end if;
  end if;

  update public.edition_ereignisse t
  set ergebnis = v_ergebnis,
      nummer = v_nummer,
      zahlung_id = coalesce(t.zahlung_id, v_zahlung),
      erstattung = case when v_erstatten is not null and v_zahlung is not null then 'offen' end,
      erstattung_grund = v_erstatten
  where t.id = v_id
  returning * into ev;
  perform public.edition_aufraeumen();
  return public.edition_ereignis_json(ev, false);
end;
$$;

-- Eine automatische Erstattung ist bei Stripe angekommen (nur Service-Rolle)
create or replace function public.edition_erstattung_gesendet(ereignis_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := ereignis_id;
  n integer;
begin
  update public.edition_ereignisse t set erstattung = 'gesendet' where t.id = v_id and t.erstattung = 'offen';
  get diagnostics n = row_count;
  return case when n = 1 then 'gesendet' else 'unveraendert' end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Zeilen-Sicherheit und Rechte
-- ---------------------------------------------------------------------------
alter table public.altersangaben enable row level security;
alter table public.editionen enable row level security;
alter table public.reservierungen enable row level security;
alter table public.edition_zustimmungen enable row level security;
alter table public.besitz enable row level security;
alter table public.edition_ereignisse enable row level security;
alter table public.sonderstuecke enable row level security;

-- Wiederholbares Einspielen: vorhandene Policies werden gezielt ersetzt.
drop policy if exists "Eigene Altersangabe lesen" on public.altersangaben;
create policy "Eigene Altersangabe lesen"
on public.altersangaben for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Editionen ab 18 lesen" on public.editionen;
create policy "Editionen ab 18 lesen"
on public.editionen for select
to authenticated
using (
  angekuendigt_am is not null and angekuendigt_am <= now()
  and exists (select 1 from public.altersangaben a where a.user_id = (select auth.uid()) and a.ab18)
);

drop policy if exists "Eigene Reservierungen lesen" on public.reservierungen;
create policy "Eigene Reservierungen lesen"
on public.reservierungen for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Eigene Zustimmungen lesen" on public.edition_zustimmungen;
create policy "Eigene Zustimmungen lesen"
on public.edition_zustimmungen for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Eigenen Besitz lesen" on public.besitz;
create policy "Eigenen Besitz lesen"
on public.besitz for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Eigene Sonderstuecke lesen" on public.sonderstuecke;
create policy "Eigene Sonderstuecke lesen"
on public.sonderstuecke for select
to authenticated
using ((select auth.uid()) = user_id);

-- edition_ereignisse: keine Policy, kein Recht fuer anon und authenticated.

-- Supabase vergibt auf neue Tabellen in public alle Rechte (auch an service_role). Deshalb erst alles entziehen und
-- dann genau das Noetige vergeben. Geschrieben wird nur ueber die Funktionen oben (und von Flo als Besitzer).
revoke all on table public.altersangaben, public.editionen, public.reservierungen, public.edition_zustimmungen,
  public.besitz, public.edition_ereignisse, public.sonderstuecke from anon, authenticated, service_role, public;
grant select on table public.altersangaben to authenticated;
grant select (produkt_id, name, auflage, angekuendigt_am, verkauf_ab, verkauf_bis, betrag_cent, waehrung)
  on table public.editionen to authenticated;
grant select (id, produkt_id, status, kassen_url, kasse_bis, erstellt_am) on table public.reservierungen to authenticated;
grant select (id, reservierung_id, produkt_id, textversion, zustimmung_sofortige_lieferung, kenntnis_widerruf_erlischt,
  zeitpunkt) on table public.edition_zustimmungen to authenticated;
grant select (produkt_id, nummer, status, erworben_am, status_zeit) on table public.besitz to authenticated;
grant select on table public.sonderstuecke to authenticated;
grant select on table public.altersangaben, public.editionen, public.reservierungen, public.edition_zustimmungen,
  public.besitz, public.edition_ereignisse, public.sonderstuecke to service_role;

-- Funktionen: nie fuer anon oder public. Erst alles entziehen (auch Supabase-Standardrechte), dann genau vergeben.
revoke all on function public.editionen_schutz() from anon, authenticated, service_role, public;
revoke all on function public.besitz_schutz() from anon, authenticated, service_role, public;
revoke all on function public.edition_kassenschluss(timestamptz) from anon, authenticated, service_role, public;
revoke all on function public.edition_schliesse_ab(text) from anon, authenticated, service_role, public;
revoke all on function public.edition_stand_json(public.editionen, uuid) from anon, authenticated, service_role, public;
revoke all on function public.edition_ereignis_json(public.edition_ereignisse, boolean)
  from anon, authenticated, service_role, public;
revoke all on function public.alter_angeben(boolean) from anon, authenticated, service_role, public;
revoke all on function public.edition_stand(text) from anon, authenticated, service_role, public;
revoke all on function public.edition_staende() from anon, authenticated, service_role, public;
revoke all on function public.edition_reserviere(uuid, text, text, boolean, boolean)
  from anon, authenticated, service_role, public;
revoke all on function public.edition_kasse_setzen(uuid, text, text, timestamptz)
  from anon, authenticated, service_role, public;
revoke all on function public.edition_kasse_abbrechen(uuid) from anon, authenticated, service_role, public;
revoke all on function public.edition_aufraeumen() from anon, authenticated, service_role, public;
revoke all on function public.edition_stripe_ereignis(text, text, timestamptz, uuid, text, text, text, integer, text,
  integer, text, text) from anon, authenticated, service_role, public;
revoke all on function public.edition_erstattung_gesendet(text) from anon, authenticated, service_role, public;

grant execute on function public.alter_angeben(boolean) to authenticated;
grant execute on function public.edition_stand(text) to authenticated;
grant execute on function public.edition_staende() to authenticated;
grant execute on function public.edition_reserviere(uuid, text, text, boolean, boolean) to service_role;
grant execute on function public.edition_kasse_setzen(uuid, text, text, timestamptz) to service_role;
grant execute on function public.edition_kasse_abbrechen(uuid) to service_role;
grant execute on function public.edition_aufraeumen() to service_role;
grant execute on function public.edition_stripe_ereignis(text, text, timestamptz, uuid, text, text, text, integer, text,
  integer, text, text) to service_role;
grant execute on function public.edition_erstattung_gesendet(text) to service_role;

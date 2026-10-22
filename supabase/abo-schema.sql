-- Abo "Crownmate Trainer" (Welle B1): Produkte, Abos und die Stripe-Ereignisse. Mehrfach ausfuehrbar (Muster:
-- schema.sql). Vorher schema.sql einspielen (auth.users und die Zeitstempel-Funktion stehen dort; sie wird hier fuer
-- den Fall, dass diese Datei allein laeuft, noch einmal angelegt).
--
-- Grundsatz (SPIELKONZEPT 2b.5 und 5): Das Abo verkauft Lehrer und Lernstoff, nie den Zugang zum Spiel. Diese Datei
-- haelt nur fest, WER gerade Premium hat; was Premium freischaltet, entscheidet die App (und fuer Server-Funktionen
-- wie den KI-Coach die jeweilige Edge Function ueber ist_premium_von).
--
-- Tabellen:
--   produkte           oeffentlich lesbar (nur aktive Zeilen), schreiben nur Service-Rolle und Dashboard. Flo traegt
--                      Name, Preis-Text und die Stripe-Links hier ein, deshalb stehen keine Preise im Code.
--   abos               eine Zeile je Nutzer. Nutzer lesen nur die eigene und schreiben nie. Geschrieben wird von der
--                      Edge Function stripe-webhook (ueber abo_stripe_ereignis) oder von Flo im Dashboard
--                      (quelle 'manuell', z. B. fuer Testerinnen).
--   stripe_ereignisse  jedes Stripe-Ereignis genau einmal (Idempotenz), dazu Ereignisse, deren Kunde noch keinem Nutzer
--                      zugeordnet ist (Stripe schickt die Ereignisse nicht in fester Reihenfolge). Nur Service-Rolle.
--                      Nach 90 Tagen werden die Zeilen geloescht (Stripe wiederholt hoechstens 3 Tage).
--
-- Funktionen:
--   ist_premium()                 fuer den Aufrufer: status 'aktiv' oder 'gekuendigt' und gueltig_bis in der Zukunft
--   ist_premium_von(uid)          dasselbe fuer einen Nutzer, nur Service-Rolle (Edge Functions)
--   abo_stripe_ereignis(...)      nur Service-Rolle: ein ausgewertetes Stripe-Ereignis verbuchen. Die Auswertung macht
--                                 supabase/functions/_gemeinsam/stripe.js; Rueckgabe ist ein kurzes Ergebnis:
--                                 'neu' | 'doppelt' | 'wartet' | 'veraltet' | 'fremdes_abo' | 'zugeordnet' | 'ohne_nutzer'
--   abo_wende_an(...)             intern (kein Recht fuer irgendwen ausser dem Besitzer)
--   abo_hole_nach(kunde, abo)     wartende Ereignisse eines Stripe-Kunden auf seine Zeile in abos anwenden. Ruft der Kauf
--                                 selbst auf; Flo ruft es im SQL Editor (als Besitzer) nach einer von Hand angelegten
--                                 Zeile auf (Kauf 'ohne_nutzer', siehe ANLEITUNG). Kein Recht fuer anon, Nutzer, Service.
--
-- Gleichzeitigkeit: Stripe schickt beim Abschluss mehrere Ereignisse fast gleichzeitig. Alle Ereignisse EINES Kunden
-- laufen deshalb nacheinander (Transaktions-Sperre pg_advisory_xact_lock je Kunde). Sonst koennte ein Abo-Ereignis, das
-- parallel zum Kauf ankommt, den noch nicht festgeschriebenen Kauf nicht sehen und sich als 'wartet' ablegen, waehrend
-- der Kauf es beim Nachholen ebenfalls noch nicht sieht: es bliebe fuer immer liegen.
--
-- Reihenfolge der Ereignisse: Jede Zeile in abos merkt sich in stand_zeit den Zeitpunkt (Stripe event.created) des
-- Ereignisses, das ihren Stand gesetzt hat. Ein aelteres Ereignis aendert nichts mehr ('veraltet'), bei gleicher
-- Sekunde nimmt nur customer.subscription.deleted ein laufendes Premium weg. Ein Kauf
-- (checkout.session.completed) setzt nur die Zuordnung Nutzer <-> Stripe-Kunde und einen vorlaeufigen Stand
-- (stand_zeit null), den das naechste Abo-Ereignis immer ueberschreibt. Dabei werden die Ereignisse nachgeholt, die vor
-- dem Kauf ankamen ('wartet', und bei einem zweiten Abo desselben Kunden die 'fremdes_abo' dieses neuen Abos).
--
-- Fehler melden die Funktionen als Kennungen (ABO_EREIGNIS_UNGUELTIG); die Edge Function antwortet dann mit 500 und
-- Stripe wiederholt die Zustellung. Die Kennungen sind ein Vertrag mit supabase/functions/_gemeinsam/stripe.js.
--
-- Hinweis fuer spaetere Aenderungen: `create or replace function` kann weder Parameternamen noch Rueckgabetyp aendern.
-- Dann vorher `drop function public.<name>(<typen>)` ausfuehren.

create table if not exists public.produkte (
  id text primary key,
  name text not null,
  beschreibung text,
  preis_text text,
  kauf_link text,
  portal_link text,
  aktiv boolean not null default false,
  aktualisiert_am timestamptz not null default now(),
  constraint produkte_id_form check (id ~ '^[a-z0-9-]{2,40}$'),
  constraint produkte_name_laenge check (char_length(name) between 1 and 60),
  constraint produkte_beschreibung_laenge check (beschreibung is null or char_length(beschreibung) <= 400),
  constraint produkte_preis_text_laenge check (preis_text is null or char_length(preis_text) <= 80),
  -- Nur https-Adressen ohne Leerzeichen und Anfuehrungszeichen (die App oeffnet sie; kein javascript: oder data:)
  constraint produkte_kauf_link_form
    check (kauf_link is null or (char_length(kauf_link) <= 300 and kauf_link ~ '^https://[^[:space:]<>"''`]+$')),
  constraint produkte_portal_link_form
    check (portal_link is null or (char_length(portal_link) <= 300 and portal_link ~ '^https://[^[:space:]<>"''`]+$'))
);

create table if not exists public.abos (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null,
  plan text,
  gueltig_bis timestamptz not null,
  quelle text not null default 'manuell',
  kunde_id text unique,
  abo_id text,
  stand_zeit timestamptz,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  constraint abos_status check (status in ('aktiv', 'gekuendigt', 'abgelaufen')),
  constraint abos_quelle check (quelle in ('stripe', 'manuell')),
  constraint abos_plan_laenge check (plan is null or char_length(plan) <= 60),
  constraint abos_kunde_form check (kunde_id is null or kunde_id ~ '^cus_[A-Za-z0-9]{1,200}$'),
  constraint abos_abo_form check (abo_id is null or abo_id ~ '^sub_[A-Za-z0-9]{1,200}$')
);

create table if not exists public.stripe_ereignisse (
  id text primary key,
  typ text not null,
  erstellt timestamptz not null,
  kunde_id text not null,
  abo_id text,
  user_id uuid references auth.users (id) on delete set null,
  status text,
  gueltig_bis timestamptz,
  plan text,
  ergebnis text not null default 'offen',
  eingegangen_am timestamptz not null default now(),
  constraint stripe_ereignisse_id_form check (id ~ '^evt_[A-Za-z0-9]{1,200}$'),
  constraint stripe_ereignisse_typ check (typ in ('checkout.session.completed', 'customer.subscription.created',
    'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid')),
  constraint stripe_ereignisse_kunde_form check (kunde_id ~ '^cus_[A-Za-z0-9]{1,200}$'),
  constraint stripe_ereignisse_abo_form check (abo_id is null or abo_id ~ '^sub_[A-Za-z0-9]{1,200}$'),
  constraint stripe_ereignisse_status check (status is null or status in ('aktiv', 'gekuendigt', 'abgelaufen')),
  constraint stripe_ereignisse_plan_laenge check (plan is null or char_length(plan) <= 60)
);

create index if not exists stripe_ereignisse_kunde on public.stripe_ereignisse (kunde_id, erstellt);
create index if not exists stripe_ereignisse_eingang on public.stripe_ereignisse (eingegangen_am);

-- Der Zeitstempel wird bei jeder Aenderung serverseitig erneuert (gleiche Funktion wie in schema.sql).
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

drop trigger if exists produkte_setze_aktualisiert_am on public.produkte;
create trigger produkte_setze_aktualisiert_am
before update on public.produkte
for each row execute function public.setze_aktualisiert_am();

drop trigger if exists abos_setze_aktualisiert_am on public.abos;
create trigger abos_setze_aktualisiert_am
before update on public.abos
for each row execute function public.setze_aktualisiert_am();

-- Premium fuer den Aufrufer. Laeuft mit den Rechten des Aufrufers (RLS: nur die eigene Zeile).
create or replace function public.ist_premium()
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.abos t
    where t.user_id = (select auth.uid())
      and t.status in ('aktiv', 'gekuendigt')
      and t.gueltig_bis > now()
  );
$$;

-- Premium fuer einen bestimmten Nutzer: nur fuer die Service-Rolle (Edge Functions wie der KI-Coach).
create or replace function public.ist_premium_von(uid uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.abos t
    where t.user_id = uid
      and t.status in ('aktiv', 'gekuendigt')
      and t.gueltig_bis > now()
  );
$$;

-- Ein Abo-Ereignis auf die Zeile eines Nutzers anwenden (intern). Aeltere Ereignisse als der Stand aendern nichts.
-- invoice.paid verlaengert nur (gueltig_bis = groesserer Wert) und laesst eine Kuendigung stehen; die Abo-Ereignisse
-- (created, updated, deleted) bringen den vollstaendigen Stand.
create or replace function public.abo_wende_an(
  ziel uuid, art text, zeit timestamptz, abo text, neu_status text, neu_bis timestamptz, neu_plan text)
returns text
language plpgsql
set search_path = public
as $$
declare
  a public.abos;
begin
  select * into a from public.abos t where t.user_id = ziel for update;
  if not found then
    return 'wartet';
  end if;
  if a.abo_id is not null and abo is not null and a.abo_id <> abo then
    return 'fremdes_abo';
  end if;
  if a.stand_zeit is not null and zeit < a.stand_zeit then
    return 'veraltet';
  end if;
  -- Gleiche Sekunde: Stripe schickt beim Abschluss mehrere Ereignisse mit demselben created (z. B. subscription.created
  -- noch "incomplete" und subscription.updated schon "active"), die Zustellreihenfolge ist zufaellig. Bei Gleichstand
  -- nimmt deshalb nur das Ende des Abos (deleted) ein laufendes Premium weg.
  if a.stand_zeit is not null and zeit = a.stand_zeit and art <> 'customer.subscription.deleted'
    and neu_status = 'abgelaufen' and a.status in ('aktiv', 'gekuendigt') then
    return 'veraltet';
  end if;
  if art = 'invoice.paid' then
    update public.abos t
    set status = case when a.status = 'gekuendigt' then 'gekuendigt' else 'aktiv' end,
        gueltig_bis = greatest(a.gueltig_bis, neu_bis),
        plan = coalesce(neu_plan, a.plan),
        abo_id = coalesce(a.abo_id, abo),
        quelle = 'stripe',
        stand_zeit = zeit
    where t.user_id = ziel;
  else
    update public.abos t
    set status = neu_status,
        gueltig_bis = neu_bis,
        plan = coalesce(neu_plan, a.plan),
        abo_id = coalesce(a.abo_id, abo),
        quelle = 'stripe',
        stand_zeit = zeit
    where t.user_id = ziel;
  end if;
  return 'neu';
end;
$$;

-- Ereignisse nachholen (intern und fuer Flo im SQL Editor): wendet die Ereignisse eines Stripe-Kunden, die vor der
-- Zuordnung ankamen, in ihrer Reihenfolge auf seine Zeile in abos an. Das sind die wartenden (Kunde war noch unbekannt)
-- und, wenn abo genannt ist (ein bekannter Kunde schliesst ein zweites Mal ab), die schon als 'fremdes_abo' abgelegten
-- Ereignisse genau dieses Abos. Rueckgabe: Anzahl der nachgeholten Ereignisse. Die Zeile in abos muss kunde_id tragen.
create or replace function public.abo_hole_nach(kunde text, abo text default null)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_ziel uuid;
  e record;
  n integer := 0;
begin
  if kunde is null or kunde !~ '^cus_[A-Za-z0-9]{1,200}$' or (abo is not null and abo !~ '^sub_[A-Za-z0-9]{1,200}$') then
    raise exception 'ABO_EREIGNIS_UNGUELTIG';
  end if;
  -- dieselbe Sperre wie abo_stripe_ereignis (in derselben Transaktion wiederholbar), damit ein Aufruf von Hand nicht
  -- mit einem gerade eintreffenden Ereignis desselben Kunden zusammenfaellt
  perform pg_advisory_xact_lock(hashtextextended('abo:' || kunde, 0));
  select t.user_id into v_ziel from public.abos t where t.kunde_id = kunde for update;
  if v_ziel is null then
    raise exception 'ABO_KUNDE_UNBEKANNT';
  end if;
  for e in
    select w.id, w.typ, w.erstellt, w.abo_id, w.status, w.gueltig_bis, w.plan
    from public.stripe_ereignisse w
    where w.kunde_id = kunde
      and (w.ergebnis = 'wartet' or (w.ergebnis = 'fremdes_abo' and abo is not null and w.abo_id = abo))
    order by w.erstellt, w.eingegangen_am
  loop
    update public.stripe_ereignisse t
    set ergebnis = public.abo_wende_an(v_ziel, e.typ, e.erstellt, e.abo_id, e.status, e.gueltig_bis, e.plan),
        user_id = v_ziel
    where t.id = e.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Ein ausgewertetes Stripe-Ereignis verbuchen (nur Service-Rolle). Die Parameter liefert
-- supabase/functions/_gemeinsam/stripe.js (auswerten): bei checkout.session.completed nutzer (client_reference_id) und
-- der vorlaeufige Stand (status, gueltig_bis), bei den uebrigen der Stand aus dem Abo bzw. der Rechnung.
create or replace function public.abo_stripe_ereignis(
  ereignis_id text,
  typ text,
  erstellt timestamptz,
  kunde_id text,
  abo_id text default null,
  nutzer uuid default null,
  status text default null,
  gueltig_bis timestamptz default null,
  plan text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := ereignis_id;
  v_typ text := typ;
  v_zeit timestamptz := erstellt;
  v_kunde text := kunde_id;
  v_abo text := abo_id;
  v_nutzer uuid := nutzer;
  v_status text := status;
  v_bis timestamptz := gueltig_bis;
  v_plan text := left(plan, 60);
  v_ziel uuid;
  v_ergebnis text;
  n integer;
begin
  -- Form pruefen (die Auswertung im Modul prueft dasselbe; hier zur Sicherheit noch einmal)
  if v_id is null or v_id !~ '^evt_[A-Za-z0-9]{1,200}$'
    or v_typ is null or v_typ not in ('checkout.session.completed', 'customer.subscription.created',
      'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid')
    or v_zeit is null
    or v_kunde is null or v_kunde !~ '^cus_[A-Za-z0-9]{1,200}$'
    or (v_abo is not null and v_abo !~ '^sub_[A-Za-z0-9]{1,200}$')
    or v_status is null or v_status not in ('aktiv', 'gekuendigt', 'abgelaufen')
    or v_bis is null then
    raise exception 'ABO_EREIGNIS_UNGUELTIG';
  end if;

  -- Alle Ereignisse eines Kunden nacheinander (bis zum Ende der Transaktion). Ein Ereignis, das gleichzeitig mit dem Kauf
  -- ankommt, wartet hier, bis der Kauf festgeschrieben ist, und findet dann die Zeile (oder umgekehrt: der Kauf findet
  -- danach das festgeschriebene 'wartet' und holt es nach).
  perform pg_advisory_xact_lock(hashtextextended('abo:' || v_kunde, 0));

  -- Idempotenz: dasselbe Ereignis (Stripe stellt manchmal doppelt zu) nur einmal. Ein gleichzeitiger zweiter
  -- Aufruf wartet am Primaerschluessel, bis der erste fertig ist, und findet dann die Zeile.
  insert into public.stripe_ereignisse as t (id, typ, erstellt, kunde_id, abo_id, status, gueltig_bis, plan)
  values (v_id, v_typ, v_zeit, v_kunde, v_abo, v_status, v_bis, v_plan)
  on conflict (id) do nothing;
  get diagnostics n = row_count;
  if n = 0 then
    return 'doppelt';
  end if;

  if v_typ = 'checkout.session.completed' then
    if v_nutzer is null or not exists (select 1 from auth.users u where u.id = v_nutzer) then
      v_ergebnis := 'ohne_nutzer';
    else
      update public.stripe_ereignisse t set user_id = v_nutzer where t.id = v_id;
      -- Ein Stripe-Kunde gehoert genau einem Nutzer: Wer ihn bisher hatte, gibt ihn ab.
      update public.abos t set kunde_id = null where t.kunde_id = v_kunde and t.user_id <> v_nutzer;
      insert into public.abos as t (user_id, status, gueltig_bis, quelle, kunde_id, abo_id, stand_zeit)
      values (v_nutzer, v_status, v_bis, 'stripe', v_kunde, v_abo, null)
      on conflict (user_id) do update
      set kunde_id = excluded.kunde_id,
          abo_id = excluded.abo_id,
          quelle = 'stripe',
          stand_zeit = null,
          -- Ein neuer Kauf nimmt nichts weg: ein noch gueltiges Abo behaelt sein spaeteres Datum
          status = case when t.status in ('aktiv', 'gekuendigt') and t.gueltig_bis > excluded.gueltig_bis
                        then t.status else excluded.status end,
          gueltig_bis = case when t.status in ('aktiv', 'gekuendigt')
                             then greatest(t.gueltig_bis, excluded.gueltig_bis) else excluded.gueltig_bis end;
      -- Ereignisse, die vor dem Kauf ankamen, jetzt in ihrer Reihenfolge anwenden: wartende (Kunde noch unbekannt) und,
      -- wenn ein bekannter Kunde ein zweites Mal abschliesst, die schon als 'fremdes_abo' abgelegten Ereignisse genau
      -- dieses neuen Abos (sonst gaelte nur der vorlaeufige Tag bis zur naechsten Verlaengerung)
      perform public.abo_hole_nach(v_kunde, v_abo);
      v_ergebnis := 'zugeordnet';
    end if;
  else
    select t.user_id into v_ziel from public.abos t where t.kunde_id = v_kunde for update;
    if v_ziel is null then
      v_ergebnis := 'wartet';
    else
      update public.stripe_ereignisse t set user_id = v_ziel where t.id = v_id;
      v_ergebnis := public.abo_wende_an(v_ziel, v_typ, v_zeit, v_abo, v_status, v_bis, v_plan);
    end if;
  end if;

  update public.stripe_ereignisse t set ergebnis = v_ergebnis where t.id = v_id;
  -- Aufraeumen: Stripe wiederholt hoechstens 3 Tage, 90 Tage reichen fuer Idempotenz und Nachfragen
  delete from public.stripe_ereignisse t where t.eingegangen_am < now() - interval '90 days';
  return v_ergebnis;
end;
$$;

alter table public.produkte enable row level security;
alter table public.abos enable row level security;
alter table public.stripe_ereignisse enable row level security;

-- Wiederholbares Einspielen: vorhandene Policies werden gezielt ersetzt.
drop policy if exists "Aktive Produkte lesen" on public.produkte;
create policy "Aktive Produkte lesen"
on public.produkte for select
to anon, authenticated
using (aktiv);

drop policy if exists "Eigenes Abo lesen" on public.abos;
create policy "Eigenes Abo lesen"
on public.abos for select
to authenticated
using ((select auth.uid()) = user_id);

-- stripe_ereignisse: keine Policy, kein Tabellenrecht fuer anon und authenticated.

-- Tabellenrechte: lesen, mehr nicht. Schreiben nur die Service-Rolle (umgeht RLS) und der Besitzer.
revoke all on table public.produkte, public.abos, public.stripe_ereignisse from anon, authenticated, public;
grant select on table public.produkte to anon, authenticated;
grant select on table public.abos to authenticated;
grant select, insert, update, delete on table public.produkte, public.abos, public.stripe_ereignisse to service_role;

-- Funktionen: nie fuer anon oder public. ist_premium fuer angemeldete Nutzer, der Rest nur Service-Rolle.
revoke all on function public.ist_premium() from anon, public;
revoke all on function public.ist_premium_von(uuid) from anon, authenticated, public;
revoke all on function public.abo_wende_an(uuid, text, timestamptz, text, text, timestamptz, text) from anon, authenticated, public, service_role;
revoke all on function public.abo_hole_nach(text, text) from anon, authenticated, public, service_role;
revoke all on function public.abo_stripe_ereignis(text, text, timestamptz, text, text, uuid, text, timestamptz, text)
  from anon, authenticated, public;
grant execute on function public.ist_premium() to authenticated, service_role;
grant execute on function public.ist_premium_von(uuid) to service_role;
grant execute on function public.abo_stripe_ereignis(text, text, timestamptz, text, text, uuid, text, timestamptz, text)
  to service_role;

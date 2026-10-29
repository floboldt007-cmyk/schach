-- RLS- und Ablauf-Test fuer supabase/werkstatt-schema.sql (Limitierte Editionen, Etappe 1). Im Supabase SQL Editor
-- ausfuehren (nach schema.sql, daten-schema.sql und werkstatt-schema.sql; abo-schema.sql ist freiwillig, dann prueft
-- der Test auch die Abo-Zeile in meine_daten). Alles laeuft in einer Transaktion und wird am Ende zurueckgerollt: keine
-- Testnutzer, keine Editionen, kein Besitz bleiben zurueck. Am Ende steht "Werkstatt-RLS-Test erfolgreich".
-- Alle Betraege hier sind Testbetraege, kein Preis.
--
-- Nicht hier pruefbar: zwei Kaeufer gleichzeitig (im SQL Editor ist jeder Aufruf eine Transaktion, hier laeuft alles in
-- einer). Das letzte Stueck ist trotzdem sicher, weil das Reservieren ein einziges update mit der Bedingung
-- vergeben + reserviert < auflage ist, dazu die Tabellen-Pruefung vergeben + reserviert <= auflage.
begin;

-- ---------- Hilfen nur fuer diesen Test (temporaeres Schema, der Rollback nimmt sie mit) ----------
-- Erwartet einen Fehler: eine Kennung (EDITION_...) oder einen SQLSTATE (42501 kein Recht, 23514 Pruefung,
-- 23505 doppelt). Laeuft mit den Rechten der gerade gesetzten Rolle.
create function pg_temp.erwarte_fehler(befehl text, kennung text) returns void language plpgsql as $f$
begin
  begin
    execute befehl;
  exception when others then
    if sqlerrm = kennung or sqlstate = kennung then
      return;
    end if;
    raise exception 'FEHLER: "%" lieferte "%" (%) statt %', befehl, sqlerrm, sqlstate, kennung;
  end;
  raise exception 'FEHLER: "%" lief durch, erwartet war %', befehl, kennung;
end
$f$;
create function pg_temp.reserviere(nutzer uuid, produkt text) returns jsonb language sql as $f$
  select public.edition_reserviere(nutzer, produkt, 'agb-test-1', true, true);
$f$;
create function pg_temp.kasse(res jsonb, sitzung text) returns text language sql as $f$
  select public.edition_kasse_setzen((res ->> 'reservierung')::uuid, sitzung,
    'https://checkout.stripe.com/c/pay/' || sitzung, now() + interval '31 minutes');
$f$;
-- Testbetrag 1234 Cent, kein Preis
create function pg_temp.bezahlt(ereignis text, res uuid, sitzung text, zahlung text, betrag integer default 1234,
  waehrung text default 'eur') returns jsonb language sql as $f$
  select public.edition_stripe_ereignis(ereignis, 'checkout.session.completed', now(), res, sitzung, zahlung, 'paid',
    betrag, waehrung);
$f$;
create function pg_temp.abgelaufen(ereignis text, res uuid, sitzung text) returns jsonb language sql as $f$
  select public.edition_stripe_ereignis(ereignis, 'checkout.session.expired', now(), res, sitzung);
$f$;
create function pg_temp.zahlung(ereignis text, art text, zahlung text, zeit timestamptz default now(),
  erstattet integer default null, grund text default null, streit text default null) returns jsonb language sql as $f$
  select public.edition_stripe_ereignis(ereignis, art, zeit, null, null, zahlung, null,
    case when art = 'charge.refunded' then 1234 end, null, erstattet, grund, streit);
$f$;
create function pg_temp.zaehler(produkt text) returns text language sql as $f$
  select e.vergeben || '/' || e.reserviert from public.editionen e where e.produkt_id = produkt;
$f$;

-- ---------- Ausgangsdaten (als Besitzer, wie Flo im SQL Editor) ----------
-- A, B, C, G: ab 18 mit bestaetigter E-Mail. D: unter 18. E: keine Antwort. F: ab 18, E-Mail nicht bestaetigt.
insert into auth.users (id, email, email_confirmed_at)
values
  ('a7000000-0000-4000-8000-00000000000a', 'werkstatt-a@example.invalid', now()),
  ('b7000000-0000-4000-8000-00000000000b', 'werkstatt-b@example.invalid', now()),
  ('c7000000-0000-4000-8000-00000000000c', 'werkstatt-c@example.invalid', now()),
  ('d7000000-0000-4000-8000-00000000000d', 'werkstatt-d@example.invalid', now()),
  ('e7000000-0000-4000-8000-00000000000e', 'werkstatt-e@example.invalid', now()),
  ('f7000000-0000-4000-8000-00000000000f', 'werkstatt-f@example.invalid', null),
  ('97000000-0000-4000-8000-000000000097', 'werkstatt-g@example.invalid', now());
-- 98 weitere Kaeufer fuer die fortlaufenden Nummern
insert into auth.users (id, email, email_confirmed_at)
select ('e0000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'werkstatt-' || i || '@example.invalid', now()
from generate_series(1, 98) i;
insert into public.altersangaben (user_id, ab18)
values
  ('a7000000-0000-4000-8000-00000000000a', true), ('b7000000-0000-4000-8000-00000000000b', true),
  ('c7000000-0000-4000-8000-00000000000c', true), ('d7000000-0000-4000-8000-00000000000d', false),
  ('f7000000-0000-4000-8000-00000000000f', true), ('97000000-0000-4000-8000-000000000097', true);
insert into public.altersangaben (user_id, ab18)
select ('e0000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, true from generate_series(1, 98) i;

-- Editionen (Testbetrag, kein Preis). Kassenschluss ist verkauf_bis minus 31 Minuten.
insert into public.editionen (produkt_id, name, stripe_preis, betrag_cent, waehrung, auflage, angekuendigt_am,
  verkauf_ab, verkauf_bis, verkauf_freigegeben)
values
  ('rls-haupt', 'Probe-Edition', 'price_RlsHaupt', 1234, 'eur', 100, now() - interval '40 days',
    now() - interval '1 day', now() + interval '10 days', true),
  -- Grenzfall: Kassenschluss eine Sekunde in der Zukunft bzw. eine Sekunde vorbei
  ('rls-knapp-vor', 'Probe knapp davor', 'price_RlsVor', 1234, 'eur', 100, now() - interval '40 days',
    now() - interval '1 day', now() + interval '31 minutes 1 second', true),
  ('rls-knapp-nach', 'Probe knapp danach', 'price_RlsNach', 1234, 'eur', 100, now() - interval '40 days',
    now() - interval '1 day', now() + interval '30 minutes 59 seconds', true),
  ('rls-gesperrt', 'Probe gesperrt', 'price_RlsGesperrt', 1234, 'eur', 100, now() - interval '40 days',
    now() - interval '1 day', now() + interval '10 days', false),
  ('rls-bald', 'Probe bald', 'price_RlsBald', 1234, 'eur', 100, now() - interval '1 day',
    now() + interval '30 days', now() + interval '60 days', true),
  ('rls-geheim', 'Probe noch nicht angekuendigt', null, null, null, 100, null,
    now() + interval '40 days', now() + interval '50 days', false),
  ('rls-vorbei', 'Probe vorbei', 'price_RlsVorbei', 1234, 'eur', 100, now() - interval '50 days',
    now() - interval '20 days', now() - interval '1 hour', true);
-- rls-vorbei: eine Kasse, die noch vor dem Ende begann (offen), und eine schon freigegebene
insert into public.reservierungen (id, produkt_id, user_id, status, sitzung_id, kassen_url, kasse_bis, erstellt_am)
values
  ('a7a00000-0000-4000-8000-000000000001', 'rls-vorbei', 'a7000000-0000-4000-8000-00000000000a', 'offen',
    'cs_test_RlsVorbei1', 'https://checkout.stripe.com/c/pay/cs_test_RlsVorbei1', now() - interval '89 minutes',
    now() - interval '2 hours'),
  ('b7b00000-0000-4000-8000-000000000002', 'rls-vorbei', 'b7000000-0000-4000-8000-00000000000b', 'abgelaufen',
    'cs_test_RlsVorbei2', 'https://checkout.stripe.com/c/pay/cs_test_RlsVorbei2', now() - interval '89 minutes',
    now() - interval '2 hours');
update public.editionen set reserviert = 1 where produkt_id = 'rls-vorbei';
-- Abo-Zeile fuer die Auskunft (nur wenn abo-schema.sql eingespielt ist)
do $$
begin
  if to_regclass('public.abos') is not null then
    execute 'insert into public.abos (user_id, status, plan, gueltig_bis, quelle) values ($1, ''aktiv'', ''monat'',
      now() + interval ''30 days'', ''manuell'')' using 'a7000000-0000-4000-8000-00000000000a'::uuid;
  end if;
end
$$;

-- ---------- Pruefungen in der Tabelle (als Besitzer) ----------
do $$
begin
  perform pg_temp.erwarte_fehler($q$insert into public.editionen (produkt_id, name, auflage, verkauf_ab, verkauf_bis)
    values ('rls-klein', 'Zu klein', 99, now() + interval '40 days', now() + interval '50 days')$q$, '23514');
  perform pg_temp.erwarte_fehler($q$insert into public.editionen (produkt_id, name, auflage, verkauf_ab, verkauf_bis, vergeben)
    values ('rls-zaehler', 'Mit Zaehler', 100, now() + interval '40 days', now() + interval '50 days', 3)$q$,
    'EDITION_NEU_MIT_ZAEHLERN');
  perform pg_temp.erwarte_fehler($q$insert into public.editionen (produkt_id, name, stripe_preis, betrag_cent, waehrung,
    auflage, verkauf_ab, verkauf_bis, verkauf_freigegeben) values ('rls-frei', 'Frei ohne Ankuendigung', 'price_X', 1234,
    'eur', 100, now() - interval '1 day', now() + interval '1 day', true)$q$, '23514');
  perform pg_temp.erwarte_fehler($q$insert into public.editionen (produkt_id, name, stripe_preis, betrag_cent, waehrung,
    auflage, angekuendigt_am, verkauf_ab, verkauf_bis) values ('rls-kurz', 'Zu kurz angekuendigt', 'price_X', 1234, 'eur',
    100, now() - interval '1 day', now() + interval '1 day', now() + interval '9 days')$q$, '23514');
  perform pg_temp.erwarte_fehler($q$insert into public.editionen (produkt_id, name, auflage, angekuendigt_am, verkauf_ab,
    verkauf_bis) values ('rls-ohne-preis', 'Ohne Betrag', 100, now() - interval '40 days', now() - interval '1 day',
    now() + interval '1 day')$q$, '23514');
  perform pg_temp.erwarte_fehler($q$insert into public.reservierungen (produkt_id, user_id, kassen_url)
    values ('rls-haupt', 'a7000000-0000-4000-8000-00000000000a', 'javascript:alert(1)')$q$, '23514');
end
$$;

-- ---------- anon: nichts ----------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  perform pg_temp.erwarte_fehler('select produkt_id from public.editionen', '42501');
  perform pg_temp.erwarte_fehler($q$select public.edition_stand('rls-haupt')$q$, '42501');
  perform pg_temp.erwarte_fehler('select public.edition_staende()', '42501');
  perform pg_temp.erwarte_fehler('select public.alter_angeben(true)', '42501');
  perform pg_temp.erwarte_fehler('select nummer from public.besitz', '42501');
  perform pg_temp.erwarte_fehler('select status from public.reservierungen', '42501');
  perform pg_temp.erwarte_fehler('select textversion from public.edition_zustimmungen', '42501');
  perform pg_temp.erwarte_fehler('select ab18 from public.altersangaben', '42501');
  perform pg_temp.erwarte_fehler('select stueck_id from public.sonderstuecke', '42501');
  perform pg_temp.erwarte_fehler($q$select pg_temp.reserviere('a7000000-0000-4000-8000-00000000000a', 'rls-haupt')$q$, '42501');
end
$$;

-- ---------- E (keine Antwort) und D (unter 18): keine Editionen, auch nicht im Stand ----------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e7000000-0000-4000-8000-00000000000e","role":"authenticated"}', true);
do $$
declare
  j jsonb;
begin
  if (select count(produkt_id) from public.editionen) <> 0 or public.edition_stand('rls-haupt') is not null
    or public.edition_staende() <> '[]'::jsonb then
    raise exception 'FEHLER: ohne Altersangabe sind Editionen sichtbar';
  end if;
  perform pg_temp.erwarte_fehler('insert into public.altersangaben (user_id, ab18) values (auth.uid(), true)', '42501');
  -- Selbstauskunft "unter 18": gespeichert mit Zeitpunkt, Editionen bleiben unsichtbar
  j := public.alter_angeben(false);
  if (j ->> 'ab18')::boolean is distinct from false or (j ->> 'angegeben_am') is null
    or (select ab18 from public.altersangaben) is distinct from false then
    raise exception 'FEHLER: alter_angeben speichert die Antwort nicht (%)', j;
  end if;
  if (select count(produkt_id) from public.editionen) <> 0 or public.edition_stand('rls-haupt') is not null then
    raise exception 'FEHLER: unter 18 sind Editionen sichtbar';
  end if;
  perform pg_temp.erwarte_fehler('update public.altersangaben set ab18 = true', '42501');
end
$$;
select set_config('request.jwt.claims', '{"sub":"d7000000-0000-4000-8000-00000000000d","role":"authenticated"}', true);
do $$
begin
  if (select count(produkt_id) from public.editionen) <> 0 or public.edition_stand('rls-haupt') is not null
    or public.edition_staende() <> '[]'::jsonb then
    raise exception 'FEHLER: unter 18 (D) sind Editionen sichtbar';
  end if;
  if (select count(*) from public.altersangaben) <> 1 then
    raise exception 'FEHLER: D sieht fremde Altersangaben';
  end if;
end
$$;

-- ---------- A (ab 18): feste Angaben ja, Zaehler und Schalter nie, schreiben nie ----------
select set_config('request.jwt.claims', '{"sub":"a7000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$
declare
  s jsonb;
begin
  if (select count(produkt_id) from public.editionen where produkt_id like 'rls-%') <> 6
    or exists (select 1 from public.editionen where produkt_id = 'rls-geheim') then
    raise exception 'FEHLER: A sieht nicht genau die angekuendigten Editionen';
  end if;
  if (select betrag_cent from public.editionen where produkt_id = 'rls-haupt') <> 1234 then
    raise exception 'FEHLER: A sieht den Betrag nicht';
  end if;
  perform pg_temp.erwarte_fehler('select vergeben from public.editionen', '42501');
  perform pg_temp.erwarte_fehler('select reserviert from public.editionen', '42501');
  perform pg_temp.erwarte_fehler('select endzahl from public.editionen', '42501');
  perform pg_temp.erwarte_fehler('select stripe_preis from public.editionen', '42501');
  perform pg_temp.erwarte_fehler('select verkauf_freigegeben from public.editionen', '42501');
  perform pg_temp.erwarte_fehler('select zeige_restzahl from public.editionen', '42501');
  perform pg_temp.erwarte_fehler('select * from public.editionen', '42501');
  s := public.edition_stand('rls-haupt');
  if s ->> 'status' <> 'erhaeltlich' or (s ->> 'auflage')::int <> 100 or s ? 'vergeben' or s ? 'reserviert'
    or (s -> 'restzahl') <> 'null'::jsonb or (s -> 'endzahl') <> 'null'::jsonb or (s ->> 'betrag_cent')::int <> 1234 then
    raise exception 'FEHLER: edition_stand fuer A falsch (%)', s;
  end if;
  if public.edition_stand('rls-bald') ->> 'status' <> 'angekuendigt'
    or public.edition_stand('rls-gesperrt') ->> 'status' <> 'angekuendigt'
    or public.edition_stand('rls-vorbei') ->> 'status' <> 'beendet'
    or (public.edition_stand('rls-vorbei') ->> 'endzahl_folgt')::boolean is distinct from true
    or public.edition_stand('rls-knapp-nach') ->> 'status' <> 'beendet'
    or public.edition_stand('rls-knapp-vor') ->> 'status' <> 'erhaeltlich'
    or public.edition_stand('rls-geheim') is not null or public.edition_stand('gibt-es-nicht') is not null
    or jsonb_array_length(public.edition_staende()) < 6 then
    raise exception 'FEHLER: Status der Editionen falsch';
  end if;
  perform pg_temp.erwarte_fehler($q$update public.editionen set name = 'x' where produkt_id = 'rls-haupt'$q$, '42501');
  perform pg_temp.erwarte_fehler($q$insert into public.reservierungen (produkt_id, user_id) values ('rls-haupt', auth.uid())$q$, '42501');
  perform pg_temp.erwarte_fehler($q$insert into public.besitz (produkt_id, nummer, user_id, reservierung_id)
    values ('rls-haupt', 1, auth.uid(), gen_random_uuid())$q$, '42501');
  perform pg_temp.erwarte_fehler($q$insert into public.sonderstuecke (stueck_id, art, user_id)
    values ('rls-falscher-erfinder', 'titel', auth.uid())$q$, '42501');
  perform pg_temp.erwarte_fehler('delete from public.altersangaben', '42501');
  perform pg_temp.erwarte_fehler($q$select pg_temp.reserviere(auth.uid(), 'rls-haupt')$q$, '42501');
  perform pg_temp.erwarte_fehler($q$select pg_temp.bezahlt('evt_RlsSelbst', gen_random_uuid(), 'cs_test_Selbst', 'pi_Selbst')$q$, '42501');
  perform pg_temp.erwarte_fehler($q$select public.edition_kasse_setzen(gen_random_uuid(), 'cs_test_X', 'https://checkout.stripe.com/x', now())$q$, '42501');
  perform pg_temp.erwarte_fehler('select public.edition_kasse_abbrechen(gen_random_uuid())', '42501');
  perform pg_temp.erwarte_fehler('select public.edition_aufraeumen()', '42501');
  perform pg_temp.erwarte_fehler($q$select public.edition_erstattung_gesendet('evt_X')$q$, '42501');
  if (public.alter_angeben(true) ->> 'ab18')::boolean is distinct from true then
    raise exception 'FEHLER: alter_angeben(true) fuer A';
  end if;
end
$$;

-- ---------- Service-Rolle: Kennungen, Doppel-Reservierung, fortlaufende Nummern ----------
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
declare
  r1 jsonb;
  r2 jsonb;
  r jsonb;
  e jsonb;
  i integer;
  u uuid;
begin
  perform pg_temp.erwarte_fehler('select public.alter_angeben(true)', '42501');
  perform pg_temp.erwarte_fehler($q$insert into public.sonderstuecke (stueck_id, art) values ('rls-dienst', 'titel')$q$, '42501');
  perform pg_temp.erwarte_fehler($q$update public.editionen set reserviert = 0 where produkt_id = 'rls-haupt'$q$, '42501');
  -- Der Server-Schalter zuerst: gesperrt schlaegt sogar "unter 18"
  perform pg_temp.erwarte_fehler($q$select pg_temp.reserviere('d7000000-0000-4000-8000-00000000000d', 'rls-gesperrt')$q$, 'EDITION_GESPERRT');
  perform pg_temp.erwarte_fehler($q$select pg_temp.reserviere('a7000000-0000-4000-8000-00000000000a', 'rls-gesperrt')$q$, 'EDITION_GESPERRT');
  perform pg_temp.erwarte_fehler($q$select pg_temp.reserviere('d7000000-0000-4000-8000-00000000000d', 'rls-haupt')$q$, 'EDITION_ALTER');
  perform pg_temp.erwarte_fehler($q$select pg_temp.reserviere('e7000000-0000-4000-8000-00000000000e', 'rls-haupt')$q$, 'EDITION_ALTER');
  perform pg_temp.erwarte_fehler($q$select pg_temp.reserviere('f7000000-0000-4000-8000-00000000000f', 'rls-haupt')$q$, 'EDITION_EMAIL');
  perform pg_temp.erwarte_fehler($q$select public.edition_reserviere('a7000000-0000-4000-8000-00000000000a', 'rls-haupt',
    'agb-test-1', true, false)$q$, 'EDITION_ZUSTIMMUNG');
  perform pg_temp.erwarte_fehler($q$select public.edition_reserviere('a7000000-0000-4000-8000-00000000000a', 'rls-haupt',
    'AGB mit Leerzeichen', true, true)$q$, 'EDITION_EINGABE');
  perform pg_temp.erwarte_fehler($q$select pg_temp.reserviere('a7000000-0000-4000-8000-00000000000a', 'rls-bald')$q$, 'EDITION_NOCH_NICHT');
  perform pg_temp.erwarte_fehler($q$select pg_temp.reserviere('a7000000-0000-4000-8000-00000000000a', 'rls-geheim')$q$, 'EDITION_UNBEKANNT');
  perform pg_temp.erwarte_fehler($q$select pg_temp.reserviere('a7000000-0000-4000-8000-00000000000a', 'gibt-es-nicht')$q$, 'EDITION_UNBEKANNT');
  perform pg_temp.erwarte_fehler($q$select pg_temp.reserviere('97000000-0000-4000-8000-000000000097', 'rls-vorbei')$q$, 'EDITION_BEENDET');
  -- A hat dort noch eine offene Kasse von vor dem Ende: dieselbe kommt zurueck, nichts Neues (die Function entscheidet
  -- dann ueber kasse_bis bzw. den Kassenschluss)
  r := pg_temp.reserviere('a7000000-0000-4000-8000-00000000000a', 'rls-vorbei');
  if (r ->> 'neu')::boolean or r ->> 'reservierung' <> 'a7a00000-0000-4000-8000-000000000001'
    or r ->> 'kassen_url' <> 'https://checkout.stripe.com/c/pay/cs_test_RlsVorbei1' or pg_temp.zaehler('rls-vorbei') <> '0/1'
    or (r ->> 'kassenschluss_s')::bigint > floor(extract(epoch from now()))::bigint then
    raise exception 'FEHLER: bestehende Kasse nach dem Ende (%)', r;
  end if;
  -- Kassenschluss: eine Sekunde danach keine Kasse mehr, eine Sekunde davor noch
  perform pg_temp.erwarte_fehler($q$select pg_temp.reserviere('a7000000-0000-4000-8000-00000000000a', 'rls-knapp-nach')$q$, 'EDITION_BEENDET');
  r := pg_temp.reserviere('a7000000-0000-4000-8000-00000000000a', 'rls-knapp-vor');
  if (r ->> 'neu')::boolean is distinct from true or pg_temp.zaehler('rls-knapp-vor') <> '0/1'
    or (r ->> 'stripe_ablauf_s')::bigint > (r ->> 'verkauf_bis_s')::bigint then
    raise exception 'FEHLER: eine Sekunde vor dem Kassenschluss keine Reservierung (%)', r;
  end if;
  perform set_config('t.res_a_vor', r ->> 'reservierung', true);

  -- Doppelklick: dieselbe Reservierung zurueck, nichts doppelt reserviert, eine Zustimmung
  r1 := pg_temp.reserviere('a7000000-0000-4000-8000-00000000000a', 'rls-haupt');
  r2 := pg_temp.reserviere('a7000000-0000-4000-8000-00000000000a', 'rls-haupt');
  if (r1 ->> 'neu')::boolean is distinct from true or (r2 ->> 'neu')::boolean is distinct from false
    or r1 ->> 'reservierung' <> r2 ->> 'reservierung' or pg_temp.zaehler('rls-haupt') <> '0/1'
    or (select count(*) from public.edition_zustimmungen z where z.reservierung_id = (r1 ->> 'reservierung')::uuid) <> 1
    or r1 ->> 'stripe_preis' <> 'price_RlsHaupt' or (r1 ->> 'betrag_cent')::int <> 1234 or r1 ->> 'waehrung' <> 'eur'
    or (r1 ->> 'stripe_ablauf_s')::bigint <> floor(extract(epoch from now()))::bigint + 31 * 60 then
    raise exception 'FEHLER: Doppel-Reservierung (% / %)', r1, r2;
  end if;
  if pg_temp.kasse(r1, 'cs_test_RlsA1') <> 'gesetzt' or pg_temp.kasse(r1, 'cs_test_RlsA1') <> 'schon_gesetzt' then
    raise exception 'FEHLER: Kasse setzen';
  end if;
  perform pg_temp.erwarte_fehler(format('select pg_temp.kasse(%L::jsonb, %L)', r1, 'cs_test_RlsAnders'), 'EDITION_RESERVIERUNG');
  r2 := pg_temp.reserviere('a7000000-0000-4000-8000-00000000000a', 'rls-haupt');
  if r2 ->> 'kassen_url' <> 'https://checkout.stripe.com/c/pay/cs_test_RlsA1' or (r2 ->> 'neu')::boolean then
    raise exception 'FEHLER: zweiter Aufruf liefert nicht dieselbe Kasse (%)', r2;
  end if;
  perform set_config('t.res_a', r1 ->> 'reservierung', true);

  -- 98 Kaeufe: Nummern der Reihe nach, in der Reihenfolge der Verbuchung
  for i in 1..98 loop
    u := ('e0000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;
    r := pg_temp.reserviere(u, 'rls-haupt');
    perform pg_temp.kasse(r, 'cs_test_Bulk' || i);
    e := pg_temp.bezahlt('evt_Bulk' || i, (r ->> 'reservierung')::uuid, 'cs_test_Bulk' || i, 'pi_Bulk' || i);
    if e ->> 'ergebnis' <> 'zugeteilt' or (e ->> 'nummer')::int <> i or (e ->> 'erstatten')::boolean then
      raise exception 'FEHLER: Kauf % falsch verbucht (%)', i, e;
    end if;
  end loop;
  if pg_temp.zaehler('rls-haupt') <> '98/1'
    or (select count(*) from public.besitz where produkt_id = 'rls-haupt') <> 98 then
    raise exception 'FEHLER: nach 98 Kaeufen falscher Stand (%)', pg_temp.zaehler('rls-haupt');
  end if;

  -- Die letzten Stuecke: B reserviert das letzte freie, C bekommt "nicht verfuegbar"
  r := pg_temp.reserviere('b7000000-0000-4000-8000-00000000000b', 'rls-haupt');
  perform pg_temp.kasse(r, 'cs_test_RlsB1');
  perform set_config('t.res_b', r ->> 'reservierung', true);
  if pg_temp.zaehler('rls-haupt') <> '98/2' then
    raise exception 'FEHLER: letzte Reservierung';
  end if;
  perform pg_temp.erwarte_fehler($q$select pg_temp.reserviere('c7000000-0000-4000-8000-00000000000c', 'rls-haupt')$q$, 'EDITION_NICHT_VERFUEGBAR');
end
$$;

-- Alle restlichen Stuecke sind reserviert: der Stand sagt weiter "erhaeltlich" (keine Restzahl, kein Wettrennen)
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c7000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
do $$
begin
  if public.edition_stand('rls-haupt') ->> 'status' <> 'erhaeltlich' or (public.edition_stand('rls-haupt') -> 'restzahl') <> 'null'::jsonb then
    raise exception 'FEHLER: alles reserviert zeigt nicht "erhaeltlich" (%)', public.edition_stand('rls-haupt');
  end if;
end
$$;

-- ---------- Service-Rolle: Zahlung, Ablauf, ausverkauft, spaete Zahlung, doppelte Ereignisse ----------
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
declare
  e jsonb;
  r jsonb;
begin
  e := pg_temp.bezahlt('evt_RlsA1', current_setting('t.res_a')::uuid, 'cs_test_RlsA1', 'pi_RlsA1');
  if e ->> 'ergebnis' <> 'zugeteilt' or (e ->> 'nummer')::int <> 99 or (e ->> 'doppelt')::boolean then
    raise exception 'FEHLER: Zahlung von A (%)', e;
  end if;
  -- doppelt zugestellt: das gespeicherte Ergebnis, nichts doppelt
  e := pg_temp.bezahlt('evt_RlsA1', current_setting('t.res_a')::uuid, 'cs_test_RlsA1', 'pi_RlsA1');
  if e ->> 'ergebnis' <> 'zugeteilt' or (e ->> 'nummer')::int <> 99 or (e ->> 'doppelt')::boolean is distinct from true
    or pg_temp.zaehler('rls-haupt') <> '99/1' then
    raise exception 'FEHLER: doppeltes Ereignis (%)', e;
  end if;
  -- Kasse von B laeuft ab: das Stueck wird frei (nur nach dem Ereignis, nie nach der Uhr)
  e := pg_temp.abgelaufen('evt_RlsB1x', current_setting('t.res_b')::uuid, 'cs_test_RlsB1');
  if e ->> 'ergebnis' <> 'freigegeben' or pg_temp.zaehler('rls-haupt') <> '99/0' then
    raise exception 'FEHLER: Ablauf von B (%)', e;
  end if;
  if pg_temp.abgelaufen('evt_RlsB1y', current_setting('t.res_b')::uuid, 'cs_test_RlsB1') ->> 'ergebnis' <> 'unveraendert' then
    raise exception 'FEHLER: zweiter Ablauf aendert etwas';
  end if;
  -- C bekommt das letzte Stueck: Nummer 100, ausverkauft, Endzahl steht fest
  r := pg_temp.reserviere('c7000000-0000-4000-8000-00000000000c', 'rls-haupt');
  perform pg_temp.kasse(r, 'cs_test_RlsC1');
  e := pg_temp.bezahlt('evt_RlsC1', (r ->> 'reservierung')::uuid, 'cs_test_RlsC1', 'pi_RlsC1');
  if e ->> 'ergebnis' <> 'zugeteilt' or (e ->> 'nummer')::int <> 100 or pg_temp.zaehler('rls-haupt') <> '100/0'
    or (select endzahl from public.editionen where produkt_id = 'rls-haupt') <> 100 then
    raise exception 'FEHLER: letztes Stueck (%)', e;
  end if;
  perform pg_temp.erwarte_fehler($q$select pg_temp.reserviere('97000000-0000-4000-8000-000000000097', 'rls-haupt')$q$, 'EDITION_AUSVERKAUFT');
  perform pg_temp.erwarte_fehler($q$select pg_temp.reserviere('c7000000-0000-4000-8000-00000000000c', 'rls-haupt')$q$, 'EDITION_SCHON_IM_BESITZ');
  -- Verspaetete Zahlung von B, aber ausverkauft: Markierung "erstatten", nichts zugeteilt
  e := pg_temp.bezahlt('evt_RlsB2', current_setting('t.res_b')::uuid, 'cs_test_RlsB1', 'pi_RlsB1');
  if e ->> 'ergebnis' <> 'erstatten' or e ->> 'erstattung_grund' <> 'ausverkauft' or (e ->> 'erstatten')::boolean is distinct from true
    or e ->> 'zahlung' <> 'pi_RlsB1' or pg_temp.zaehler('rls-haupt') <> '100/0'
    or exists (select 1 from public.besitz where zahlung_id = 'pi_RlsB1') then
    raise exception 'FEHLER: spaete Zahlung bei ausverkauft (%)', e;
  end if;
  if public.edition_erstattung_gesendet('evt_RlsB2') <> 'gesendet' or public.edition_erstattung_gesendet('evt_RlsB2') <> 'unveraendert'
    or (pg_temp.bezahlt('evt_RlsB2', current_setting('t.res_b')::uuid, 'cs_test_RlsB1', 'pi_RlsB1') ->> 'erstatten')::boolean then
    raise exception 'FEHLER: Erstattung als gesendet markieren';
  end if;

  -- rls-knapp-vor: falscher Betrag, falsche Waehrung, spaete Zahlung mit freiem Stueck, Doppelzahlung
  perform pg_temp.kasse(jsonb_build_object('reservierung', current_setting('t.res_a_vor')), 'cs_test_RlsAVor');
  e := pg_temp.bezahlt('evt_RlsAVor', current_setting('t.res_a_vor')::uuid, 'cs_test_RlsAVor', 'pi_RlsAVor', 999);
  if e ->> 'ergebnis' <> 'erstatten' or e ->> 'erstattung_grund' <> 'betrag' or pg_temp.zaehler('rls-knapp-vor') <> '0/0'
    or (select status from public.reservierungen where id = current_setting('t.res_a_vor')::uuid) <> 'abgebrochen' then
    raise exception 'FEHLER: falscher Betrag (%)', e;
  end if;
  r := pg_temp.reserviere('97000000-0000-4000-8000-000000000097', 'rls-knapp-vor');
  perform pg_temp.kasse(r, 'cs_test_RlsGVor');
  e := pg_temp.bezahlt('evt_RlsGVor', (r ->> 'reservierung')::uuid, 'cs_test_RlsGVor', 'pi_RlsGVor', 1234, 'usd');
  if e ->> 'ergebnis' <> 'erstatten' or e ->> 'erstattung_grund' <> 'betrag' or pg_temp.zaehler('rls-knapp-vor') <> '0/0' then
    raise exception 'FEHLER: falsche Waehrung (%)', e;
  end if;
  r := pg_temp.reserviere('b7000000-0000-4000-8000-00000000000b', 'rls-knapp-vor');
  perform pg_temp.kasse(r, 'cs_test_RlsBVor');
  perform pg_temp.abgelaufen('evt_RlsBVorx', (r ->> 'reservierung')::uuid, 'cs_test_RlsBVor');
  e := pg_temp.bezahlt('evt_RlsBVor', (r ->> 'reservierung')::uuid, 'cs_test_RlsBVor', 'pi_RlsBVor');
  if e ->> 'ergebnis' <> 'zugeteilt_spaet' or (e ->> 'nummer')::int <> 1 or pg_temp.zaehler('rls-knapp-vor') <> '1/0' then
    raise exception 'FEHLER: spaete Zahlung mit freiem Stueck (%)', e;
  end if;
  r := pg_temp.reserviere('c7000000-0000-4000-8000-00000000000c', 'rls-knapp-vor');
  perform pg_temp.kasse(r, 'cs_test_RlsC1Vor');
  perform pg_temp.abgelaufen('evt_RlsC1Vorx', (r ->> 'reservierung')::uuid, 'cs_test_RlsC1Vor');
  perform set_config('t.res_c1', r ->> 'reservierung', true);
  r := pg_temp.reserviere('c7000000-0000-4000-8000-00000000000c', 'rls-knapp-vor');
  perform pg_temp.kasse(r, 'cs_test_RlsC2Vor');
  e := pg_temp.bezahlt('evt_RlsC2Vor', (r ->> 'reservierung')::uuid, 'cs_test_RlsC2Vor', 'pi_RlsC2Vor');
  if e ->> 'ergebnis' <> 'zugeteilt' or (e ->> 'nummer')::int <> 2 then
    raise exception 'FEHLER: zweiter Versuch von C (%)', e;
  end if;
  e := pg_temp.bezahlt('evt_RlsC1Vor', current_setting('t.res_c1')::uuid, 'cs_test_RlsC1Vor', 'pi_RlsC1Vor');
  if e ->> 'ergebnis' <> 'erstatten' or e ->> 'erstattung_grund' <> 'doppelt' or pg_temp.zaehler('rls-knapp-vor') <> '2/0' then
    raise exception 'FEHLER: Doppelzahlung desselben Kontos (%)', e;
  end if;
  -- Falsche Sitzung zur Reservierung: erstatten, nichts zugeteilt
  e := pg_temp.bezahlt('evt_RlsFremd', current_setting('t.res_a')::uuid, 'cs_test_RlsFremd', 'pi_RlsFremd');
  if e ->> 'ergebnis' <> 'erstatten' or e ->> 'erstattung_grund' <> 'sitzung' then
    raise exception 'FEHLER: fremde Sitzung (%)', e;
  end if;
  -- Unbekannte Reservierung: erstatten; nicht bezahlt: nichts
  e := pg_temp.bezahlt('evt_RlsUnbekannt', gen_random_uuid(), 'cs_test_RlsUnbekannt', 'pi_RlsUnbekannt');
  if e ->> 'ergebnis' <> 'erstatten' or e ->> 'erstattung_grund' <> 'unbekannt' then
    raise exception 'FEHLER: unbekannte Reservierung (%)', e;
  end if;
  e := public.edition_stripe_ereignis('evt_RlsUnbezahlt', 'checkout.session.completed', now(), gen_random_uuid(),
    'cs_test_RlsUnbezahlt', null, 'unpaid', 1234, 'eur');
  if e ->> 'ergebnis' <> 'nicht_bezahlt' or (e ->> 'erstatten')::boolean then
    raise exception 'FEHLER: unbezahlte Kasse (%)', e;
  end if;

  -- rls-vorbei: die Zahlung kommt nach dem Ende an, die Kasse begann vorher: zugeteilt. Danach steht die Endzahl.
  e := pg_temp.bezahlt('evt_RlsVorbei1', 'a7a00000-0000-4000-8000-000000000001', 'cs_test_RlsVorbei1', 'pi_RlsVorbei1');
  if e ->> 'ergebnis' <> 'zugeteilt' or (e ->> 'nummer')::int <> 1
    or (select endzahl from public.editionen where produkt_id = 'rls-vorbei') <> 1 then
    raise exception 'FEHLER: Zahlung nach verkauf_bis (%)', e;
  end if;
  e := pg_temp.bezahlt('evt_RlsVorbei2', 'b7b00000-0000-4000-8000-000000000002', 'cs_test_RlsVorbei2', 'pi_RlsVorbei2');
  if e ->> 'ergebnis' <> 'erstatten' or e ->> 'erstattung_grund' <> 'endzahl' or pg_temp.zaehler('rls-vorbei') <> '1/0' then
    raise exception 'FEHLER: spaete Zahlung nach festgeschriebener Endzahl (%)', e;
  end if;

  -- Erstattung, Widerruf, Teilerstattung, Rueckbuchung: Status aendert sich, die Nummer bleibt, vergeben sinkt nie
  if pg_temp.zahlung('evt_RlsR1', 'charge.refunded', 'pi_Bulk1', now(), 1234) ->> 'ergebnis' <> 'erstattet'
    or pg_temp.zahlung('evt_RlsR2', 'charge.refunded', 'pi_Bulk2', now(), 500) ->> 'ergebnis' <> 'teilerstattung'
    or pg_temp.zahlung('evt_RlsR3', 'charge.refunded', 'pi_Bulk3', now(), 1234, 'widerruf') ->> 'ergebnis' <> 'widerrufen'
    or pg_temp.zahlung('evt_RlsD4a', 'charge.dispute.created', 'pi_Bulk4') ->> 'ergebnis' <> 'strittig'
    or pg_temp.zahlung('evt_RlsD4b', 'charge.dispute.closed', 'pi_Bulk4', now(), null, null, 'lost') ->> 'ergebnis' <> 'zurueckgebucht'
    or pg_temp.zahlung('evt_RlsD5a', 'charge.dispute.created', 'pi_Bulk5') ->> 'ergebnis' <> 'strittig'
    or pg_temp.zahlung('evt_RlsD5b', 'charge.dispute.closed', 'pi_Bulk5', now() + interval '1 minute', null, null, 'won') ->> 'ergebnis' <> 'aktiv'
    or pg_temp.zahlung('evt_RlsD5c', 'charge.dispute.created', 'pi_Bulk5', now() - interval '1 hour') ->> 'ergebnis' <> 'veraltet'
    or pg_temp.zahlung('evt_RlsR1b', 'charge.refunded', 'pi_Bulk1', now(), 1234) ->> 'ergebnis' <> 'unveraendert'
    or pg_temp.zahlung('evt_RlsR9', 'charge.refunded', 'pi_GibtEsNicht', now(), 1234) ->> 'ergebnis' <> 'ohne_besitz' then
    raise exception 'FEHLER: Erstattung oder Rueckbuchung falsch verbucht';
  end if;
  if (select string_agg(status, ',' order by nummer) from public.besitz where produkt_id = 'rls-haupt' and nummer <= 5)
      <> 'erstattet,aktiv,widerrufen,zurueckgebucht,aktiv'
    or pg_temp.zaehler('rls-haupt') <> '100/0' or (select count(*) from public.besitz where produkt_id = 'rls-haupt') <> 100 then
    raise exception 'FEHLER: Status nach Erstattung und Rueckbuchung falsch oder Nummer frei geworden';
  end if;
  perform pg_temp.erwarte_fehler($q$select public.edition_stripe_ereignis('kein-evt', 'charge.refunded', now(), null, null,
    'pi_Bulk1', null, 1234, null, 1234)$q$, 'EDITION_EREIGNIS_UNGUELTIG');
  perform pg_temp.erwarte_fehler($q$select public.edition_stripe_ereignis('evt_RlsTyp', 'invoice.paid', now())$q$, 'EDITION_EREIGNIS_UNGUELTIG');
  perform pg_temp.erwarte_fehler($q$select public.edition_stripe_ereignis('evt_RlsOhneRes', 'checkout.session.completed', now(),
    null, 'cs_test_X', 'pi_X', 'paid', 1234, 'eur')$q$, 'EDITION_EREIGNIS_UNGUELTIG');
  perform pg_temp.erwarte_fehler($q$select public.edition_stripe_ereignis('evt_RlsOhneZahlung', 'charge.dispute.created', now())$q$,
    'EDITION_EREIGNIS_UNGUELTIG');

  -- Kasse abbrechen: nur ohne Stripe-Kasse; mit Kasse bleibt die Reservierung bis zum Ablauf-Ereignis
  r := pg_temp.reserviere('97000000-0000-4000-8000-000000000097', 'rls-knapp-vor');
  if public.edition_kasse_abbrechen((r ->> 'reservierung')::uuid) <> 'freigegeben' or pg_temp.zaehler('rls-knapp-vor') <> '2/0' then
    raise exception 'FEHLER: Kasse abbrechen ohne Kasse';
  end if;
  r := pg_temp.reserviere('97000000-0000-4000-8000-000000000097', 'rls-knapp-vor');
  perform pg_temp.kasse(r, 'cs_test_RlsGVor2');
  if public.edition_kasse_abbrechen((r ->> 'reservierung')::uuid) <> 'hat_kasse' or pg_temp.zaehler('rls-knapp-vor') <> '2/1' then
    raise exception 'FEHLER: Reservierung mit Kasse wurde ohne Ablauf freigegeben';
  end if;
  perform pg_temp.abgelaufen('evt_RlsGVor2x', (r ->> 'reservierung')::uuid, 'cs_test_RlsGVor2');
  -- A reserviert noch einmal (fuer den Test "Konto geloescht" unten)
  r := pg_temp.reserviere('a7000000-0000-4000-8000-00000000000a', 'rls-knapp-vor');
  perform pg_temp.kasse(r, 'cs_test_RlsA3');
  perform set_config('t.res_a3', r ->> 'reservierung', true);
end
$$;

-- ---------- Besitzer: Aufraeumen, Einfrieren, vergeben sinkt nie, Besitz bleibt, Sonderstuecke ----------
reset role;
-- eine Reservierung, die nach 3 Stunden noch keine Kasse hat (die Kasse kam nie zustande)
insert into public.reservierungen (id, produkt_id, user_id, status, erstellt_am)
values ('e0e00000-0000-4000-8000-000000000050', 'rls-knapp-vor', 'e0000000-0000-4000-8000-000000000050', 'offen',
  now() - interval '3 hours');
update public.editionen set reserviert = reserviert + 1 where produkt_id = 'rls-knapp-vor';
set local role service_role;
do $$
declare
  j jsonb;
begin
  j := public.edition_aufraeumen();
  if (j ->> 'freigegeben')::int < 1 or pg_temp.zaehler('rls-knapp-vor') <> '2/1'
    or (select status from public.reservierungen where id = 'e0e00000-0000-4000-8000-000000000050') <> 'abgebrochen'
    or (select status from public.reservierungen where id = current_setting('t.res_a3')::uuid) <> 'offen' then
    raise exception 'FEHLER: Aufraeumen (%)', j;
  end if;
end
$$;
reset role;
do $$
begin
  perform pg_temp.erwarte_fehler($q$update public.editionen set auflage = 200 where produkt_id = 'rls-haupt'$q$, 'EDITION_EINGEFROREN');
  perform pg_temp.erwarte_fehler($q$update public.editionen set name = 'Neuauflage' where produkt_id = 'rls-haupt'$q$, 'EDITION_EINGEFROREN');
  perform pg_temp.erwarte_fehler($q$update public.editionen set betrag_cent = 999 where produkt_id = 'rls-haupt'$q$, 'EDITION_EINGEFROREN');
  perform pg_temp.erwarte_fehler($q$update public.editionen set waehrung = 'usd' where produkt_id = 'rls-haupt'$q$, 'EDITION_EINGEFROREN');
  perform pg_temp.erwarte_fehler($q$update public.editionen set stripe_preis = 'price_Anders' where produkt_id = 'rls-haupt'$q$, 'EDITION_EINGEFROREN');
  perform pg_temp.erwarte_fehler($q$update public.editionen set verkauf_ab = verkauf_ab - interval '1 day' where produkt_id = 'rls-haupt'$q$, 'EDITION_EINGEFROREN');
  perform pg_temp.erwarte_fehler($q$update public.editionen set angekuendigt_am = null where produkt_id = 'rls-haupt'$q$, 'EDITION_EINGEFROREN');
  -- Das Ende wird nie verschoben, vorziehen nur, wenn alles vergeben ist
  perform pg_temp.erwarte_fehler($q$update public.editionen set verkauf_bis = verkauf_bis + interval '1 day' where produkt_id = 'rls-knapp-vor'$q$, 'EDITION_EINGEFROREN');
  perform pg_temp.erwarte_fehler($q$update public.editionen set verkauf_bis = verkauf_bis - interval '1 minute' where produkt_id = 'rls-knapp-vor'$q$, 'EDITION_EINGEFROREN');
  perform pg_temp.erwarte_fehler($q$update public.editionen set verkauf_bis = verkauf_bis + interval '1 day' where produkt_id = 'rls-haupt'$q$, 'EDITION_EINGEFROREN');
  update public.editionen set verkauf_bis = now() + interval '1 day' where produkt_id = 'rls-haupt';
  perform pg_temp.erwarte_fehler($q$delete from public.editionen where produkt_id = 'rls-bald'$q$, 'EDITION_EINGEFROREN');
  -- Schalter duerfen sich immer aendern; vor der Ankuendigung ist alles frei. Verkauf aus: der Besitz bleibt sichtbar
  -- (A liest ihn unten), nur neue Kaeufe gehen nicht.
  update public.editionen set verkauf_freigegeben = false where produkt_id = 'rls-haupt';
  update public.editionen set zeige_restzahl = true where produkt_id = 'rls-knapp-vor';
  update public.editionen set auflage = 150, verkauf_bis = verkauf_bis + interval '1 day' where produkt_id = 'rls-geheim';
  -- vergeben sinkt nie, und mehr als die Auflage geht nie
  perform pg_temp.erwarte_fehler($q$update public.editionen set vergeben = 99 where produkt_id = 'rls-haupt'$q$, 'EDITION_VERGEBEN_SINKT');
  perform pg_temp.erwarte_fehler($q$update public.editionen set vergeben = auflage + 1 where produkt_id = 'rls-knapp-vor'$q$, '23514');
  perform pg_temp.erwarte_fehler($q$update public.editionen set reserviert = auflage where produkt_id = 'rls-knapp-vor'$q$, '23514');
  perform pg_temp.erwarte_fehler($q$update public.editionen set endzahl = null where produkt_id = 'rls-haupt'$q$, 'EDITION_EINGEFROREN');
  -- Teilindex: ein offener Kauf je Konto und Edition, auch von Hand nicht zweimal (A hat dort eine offene Kasse)
  perform pg_temp.erwarte_fehler($q$insert into public.reservierungen (produkt_id, user_id)
    values ('rls-knapp-vor', 'a7000000-0000-4000-8000-00000000000a')$q$, '23505');
  -- Eine vergebene Nummer bleibt
  perform pg_temp.erwarte_fehler($q$delete from public.besitz where produkt_id = 'rls-haupt' and nummer = 1$q$, 'EDITION_BESITZ_BLEIBT');
  perform pg_temp.erwarte_fehler($q$update public.besitz set nummer = 101 where produkt_id = 'rls-haupt' and nummer = 1$q$, 'EDITION_BESITZ_BLEIBT');
  -- Sonderstuecke: nur der Besitzer traegt ein, je Stueck genau eine Zeile, immer Nr. 0
  insert into public.sonderstuecke (stueck_id, art, user_id)
  values ('rls-erfinder-titel', 'titel', 'a7000000-0000-4000-8000-00000000000a'),
         ('rls-erfinder-banner', 'banner', 'a7000000-0000-4000-8000-00000000000a');
  perform pg_temp.erwarte_fehler($q$insert into public.sonderstuecke (stueck_id, art, user_id)
    values ('rls-erfinder-titel', 'titel', 'b7000000-0000-4000-8000-00000000000b')$q$, '23505');
  perform pg_temp.erwarte_fehler($q$insert into public.sonderstuecke (stueck_id, art, nummer) values ('rls-nummer-eins', 'titel', 1)$q$, '23514');
  perform pg_temp.erwarte_fehler($q$insert into public.sonderstuecke (stueck_id, art) values ('rls-emote', 'emote')$q$, '23514');
end
$$;

-- ---------- Nutzer: eigene Zeilen, Spaltenrechte, Stand mit Schaltern, Auskunft ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a7000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$
declare
  d jsonb;
  s jsonb;
begin
  if (select string_agg(produkt_id || '#' || nummer, ',' order by produkt_id) from public.besitz) <> 'rls-haupt#99,rls-vorbei#1' then
    raise exception 'FEHLER: A sieht nicht genau den eigenen Besitz';
  end if;
  perform pg_temp.erwarte_fehler('select zahlung_id from public.besitz', '42501');
  perform pg_temp.erwarte_fehler('select user_id from public.besitz', '42501');
  perform pg_temp.erwarte_fehler('select sitzung_id from public.besitz', '42501');
  perform pg_temp.erwarte_fehler('select sitzung_id from public.reservierungen', '42501');
  perform pg_temp.erwarte_fehler('select zahlung_id from public.reservierungen', '42501');
  perform pg_temp.erwarte_fehler('select user_id from public.edition_zustimmungen', '42501');
  perform pg_temp.erwarte_fehler('select id from public.edition_ereignisse', '42501');
  if (select count(id) from public.reservierungen) <> 4 or (select count(id) from public.edition_zustimmungen) <> 3 then
    raise exception 'FEHLER: A sieht nicht genau die eigenen Reservierungen und Zustimmungen';
  end if;
  if (select count(*) from public.sonderstuecke) <> 2 then
    raise exception 'FEHLER: A sieht die eigenen Sonderstuecke nicht';
  end if;
  perform pg_temp.erwarte_fehler($q$update public.sonderstuecke set user_id = auth.uid()$q$, '42501');
  -- Endzahl: A besitzt ein Stueck von rls-vorbei, also sieht A "Nr. 1 von 1"
  s := public.edition_stand('rls-vorbei');
  if s ->> 'status' <> 'beendet' or (s ->> 'endzahl')::int <> 1 or (s ->> 'endzahl_folgt')::boolean then
    raise exception 'FEHLER: Endzahl fuer den Besitzer (%)', s;
  end if;
  if public.edition_stand('rls-haupt') ->> 'status' <> 'ausverkauft' or (public.edition_stand('rls-haupt') ->> 'endzahl')::int <> 100 then
    raise exception 'FEHLER: ausverkauft (%)', public.edition_stand('rls-haupt');
  end if;
  -- Restzahl nur mit dem Schalter (rls-knapp-vor: zeige_restzahl an, 2 vergeben)
  if (public.edition_stand('rls-knapp-vor') ->> 'restzahl')::int <> 98 then
    raise exception 'FEHLER: Restzahl mit Schalter (%)', public.edition_stand('rls-knapp-vor');
  end if;
  -- Auskunft: Besitz, Zustimmungen, Altersangabe, Sonderstuecke und (falls eingespielt) das Abo
  if to_regprocedure('public.meine_daten()') is not null then
    d := public.meine_daten();
    if jsonb_array_length(d -> 'besitz') <> 2 or jsonb_array_length(d -> 'edition_zustimmungen') <> 3
      or jsonb_array_length(d -> 'reservierungen') <> 4 or jsonb_array_length(d -> 'sonderstuecke') <> 2
      or (d -> 'altersangabe' ->> 'ab18')::boolean is distinct from true
      or not (d -> 'besitz') @> '[{"zahlung_id": "pi_RlsA1", "nummer": 99}]'::jsonb or not (d ? 'abo') then
      raise exception 'FEHLER: meine_daten ohne Werkstatt-Daten (%)', d;
    end if;
    if to_regclass('public.abos') is not null and (d -> 'abo' ->> 'status') is distinct from 'aktiv' then
      raise exception 'FEHLER: meine_daten ohne die Abo-Zeile (%)', d -> 'abo';
    end if;
  end if;
end
$$;
select set_config('request.jwt.claims', '{"sub":"b7000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
do $$
begin
  if (select string_agg(produkt_id || '#' || nummer, ',') from public.besitz) <> 'rls-knapp-vor#1'
    or (select count(*) from public.sonderstuecke) <> 0 then
    raise exception 'FEHLER: B sieht fremden Besitz oder fremde Sonderstuecke';
  end if;
  -- B besitzt nichts von rls-vorbei und der Schalter ist aus: keine Endzahl (sie verriete den Umsatz)
  if (public.edition_stand('rls-vorbei') -> 'endzahl') <> 'null'::jsonb then
    raise exception 'FEHLER: Endzahl ohne Besitz sichtbar';
  end if;
end
$$;

-- ---------- Konto loeschen: Nummern bleiben vergeben, Besitz und Zustimmungen pseudonym ----------
select set_config('request.jwt.claims', '{"sub":"a7000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$
begin
  if to_regprocedure('public.konto_loeschen()') is not null then
    perform public.konto_loeschen();
  end if;
end
$$;
reset role;
-- ohne daten-schema.sql loescht der Besitzer den Nutzer selbst (gleiche Wirkung)
delete from auth.users where id = 'a7000000-0000-4000-8000-00000000000a';
do $$
begin
  if exists (select 1 from auth.users where id = 'a7000000-0000-4000-8000-00000000000a')
    or exists (select 1 from public.altersangaben where user_id = 'a7000000-0000-4000-8000-00000000000a') then
    raise exception 'FEHLER: Konto oder Altersangabe nach dem Loeschen noch da';
  end if;
  if (select user_id from public.besitz where produkt_id = 'rls-haupt' and nummer = 99) is not null
    or (select zahlung_id from public.besitz where produkt_id = 'rls-haupt' and nummer = 99) <> 'pi_RlsA1'
    or (select count(*) from public.besitz where produkt_id = 'rls-haupt') <> 100 or pg_temp.zaehler('rls-haupt') <> '100/0'
    or (select user_id from public.besitz where produkt_id = 'rls-vorbei' and nummer = 1) is not null then
    raise exception 'FEHLER: Besitz nach dem Loeschen nicht pseudonym oder Nummer frei';
  end if;
  if (select count(*) from public.edition_zustimmungen where reservierung_id = current_setting('t.res_a')::uuid and user_id is null) <> 1
    or exists (select 1 from public.sonderstuecke where user_id is not null and stueck_id like 'rls-%') then
    raise exception 'FEHLER: Zustimmungen oder Sonderstuecke nach dem Loeschen nicht pseudonym';
  end if;
end
$$;
set local role service_role;
do $$
declare
  e jsonb;
begin
  -- die noch offene Kasse des geloeschten Kontos wird bezahlt: erstatten, Stueck frei
  e := pg_temp.bezahlt('evt_RlsA3', current_setting('t.res_a3')::uuid, 'cs_test_RlsA3', 'pi_RlsA3');
  if e ->> 'ergebnis' <> 'erstatten' or e ->> 'erstattung_grund' <> 'konto_geloescht' or pg_temp.zaehler('rls-knapp-vor') <> '2/0' then
    raise exception 'FEHLER: Zahlung eines geloeschten Kontos (%)', e;
  end if;
end
$$;

-- ---------- Zum Schluss: Zaehler passen zu den Zeilen, Nummern lueckenlos ab 1 ----------
reset role;
do $$
declare
  x record;
begin
  for x in select * from public.editionen where produkt_id like 'rls-%' loop
    if x.vergeben <> (select count(*) from public.besitz b where b.produkt_id = x.produkt_id)
      or x.reserviert <> (select count(*) from public.reservierungen r where r.produkt_id = x.produkt_id and r.status = 'offen')
      or coalesce((select max(b.nummer) from public.besitz b where b.produkt_id = x.produkt_id), 0) <> x.vergeben
      or exists (select 1 from public.besitz b where b.produkt_id = x.produkt_id and b.nummer < 1) then
      raise exception 'FEHLER: Zaehler und Zeilen passen nicht (%: %/%)', x.produkt_id, x.vergeben, x.reserviert;
    end if;
  end loop;
end
$$;

select 'Werkstatt-RLS-Test erfolgreich' as ergebnis;
rollback;

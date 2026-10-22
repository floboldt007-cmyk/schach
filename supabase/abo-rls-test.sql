-- RLS- und Ablauf-Test fuer supabase/abo-schema.sql. Im Supabase SQL Editor ausfuehren (nach schema.sql und
-- abo-schema.sql). Alles laeuft in einer Transaktion und wird am Ende zurueckgerollt: keine Testnutzer, keine
-- Produkte, keine Abos bleiben zurueck. Am Ende steht "Abo-RLS-Test erfolgreich".
begin;

insert into auth.users (id, email)
values
  ('a1111111-1111-4111-8111-111111111111', 'abo-a@example.invalid'),
  ('b2222222-2222-4222-8222-222222222222', 'abo-b@example.invalid'),
  ('c3333333-3333-4333-8333-333333333333', 'abo-c@example.invalid'),
  ('d4444444-4444-4444-8444-444444444444', 'abo-d@example.invalid');

-- Als Besitzer (wie Flo im Dashboard): zwei Produkte, eines aktiv; zwei Abos.
insert into public.produkte (id, name, beschreibung, preis_text, kauf_link, portal_link, aktiv)
values
  ('rls-trainer', 'Probe-Trainer', 'nur fuer den Test', 'Probe-Preis', 'https://buy.stripe.example/probe', 'https://billing.stripe.example/p/login/probe', true),
  ('rls-alt', 'Altes Produkt', null, null, null, null, false);
insert into public.abos (user_id, status, plan, gueltig_bis, quelle)
values
  ('a1111111-1111-4111-8111-111111111111', 'aktiv', 'monat', now() + interval '30 days', 'manuell'),
  ('b2222222-2222-4222-8222-222222222222', 'abgelaufen', 'monat', now() - interval '1 day', 'manuell'),
  -- D: Status noch "gekuendigt", aber das Datum ist vorbei (das Datum entscheidet)
  ('d4444444-4444-4444-8444-444444444444', 'gekuendigt', 'monat', now() - interval '1 minute', 'manuell');

-- Links nur als https (die App oeffnet sie)
do $$
begin
  begin
    insert into public.produkte (id, name, kauf_link) values ('rls-boese', 'Boese', 'javascript:alert(1)');
    raise exception 'FEHLER: javascript:-Link wurde angenommen';
  exception when check_violation then null;
  end;
  begin
    insert into public.produkte (id, name, portal_link) values ('rls-boese', 'Boese', 'http://billing.example/x');
    raise exception 'FEHLER: http-Link (ohne s) wurde angenommen';
  exception when check_violation then null;
  end;
end
$$;

-- ---------- anon: nur aktive Produkte, sonst nichts ----------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  if (select count(*) from public.produkte where id like 'rls-%') <> 1
    or not exists (select 1 from public.produkte where id = 'rls-trainer') then
    raise exception 'FEHLER: anon sieht nicht genau das aktive Produkt';
  end if;
  begin
    perform 1 from public.abos;
    raise exception 'FEHLER: anon kann abos lesen';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.ist_premium();
    raise exception 'FEHLER: anon darf ist_premium aufrufen';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.produkte set preis_text = 'gratis' where id = 'rls-trainer';
    raise exception 'FEHLER: anon kann Produkte aendern';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.abo_stripe_ereignis('evt_anon1', 'invoice.paid', now(), 'cus_anon', null, null, 'aktiv', now() + interval '1 year', null);
    raise exception 'FEHLER: anon darf abo_stripe_ereignis aufrufen';
  exception when insufficient_privilege then null;
  end;
end
$$;

-- ---------- Nutzer A: Premium, sieht nur die eigene Zeile, schreibt nie ----------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.abos) <> 1
    or not exists (select 1 from public.abos where user_id = 'a1111111-1111-4111-8111-111111111111') then
    raise exception 'FEHLER: Nutzer A sieht nicht genau das eigene Abo';
  end if;
  if not public.ist_premium() then
    raise exception 'FEHLER: Nutzer A sollte Premium haben';
  end if;
  if (select count(*) from public.produkte where id like 'rls-%') <> 1 then
    raise exception 'FEHLER: Nutzer A sieht inaktive Produkte';
  end if;
  begin
    update public.abos set gueltig_bis = now() + interval '100 years' where user_id = 'a1111111-1111-4111-8111-111111111111';
    raise exception 'FEHLER: Nutzer A kann das eigene Abo verlaengern';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.abos (user_id, status, gueltig_bis) values ('a1111111-1111-4111-8111-111111111111', 'aktiv', now() + interval '1 year');
    raise exception 'FEHLER: Nutzer A kann ein Abo anlegen';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.abos where user_id = 'a1111111-1111-4111-8111-111111111111';
    raise exception 'FEHLER: Nutzer A kann das Abo loeschen';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.produkte (id, name, aktiv) values ('rls-neu', 'Neu', true);
    raise exception 'FEHLER: Nutzer A kann Produkte anlegen';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.ist_premium_von('b2222222-2222-4222-8222-222222222222');
    raise exception 'FEHLER: Nutzer A darf ist_premium_von aufrufen';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.abo_stripe_ereignis('evt_selbst1', 'checkout.session.completed', now(), 'cus_selbst', 'sub_selbst',
      'a1111111-1111-4111-8111-111111111111', 'aktiv', now() + interval '10 years', null);
    raise exception 'FEHLER: Nutzer A darf sich ueber abo_stripe_ereignis selbst Premium geben';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.abo_wende_an('a1111111-1111-4111-8111-111111111111', 'invoice.paid', now(), null, 'aktiv', now() + interval '9 years', null);
    raise exception 'FEHLER: Nutzer A darf abo_wende_an aufrufen';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.stripe_ereignisse;
    raise exception 'FEHLER: Nutzer A kann stripe_ereignisse lesen';
  exception when insufficient_privilege then null;
  end;
end
$$;

-- ---------- Nutzer B: abgelaufen, sieht A nicht ----------
select set_config('request.jwt.claims', '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
do $$
begin
  if public.ist_premium() then
    raise exception 'FEHLER: Nutzer B (abgelaufen) hat Premium';
  end if;
  if exists (select 1 from public.abos where user_id = 'a1111111-1111-4111-8111-111111111111') then
    raise exception 'FEHLER: Nutzer B sieht das Abo von A';
  end if;
end
$$;

-- ---------- Nutzer C: ohne Zeile kein Premium ----------
select set_config('request.jwt.claims', '{"sub":"c3333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
do $$
begin
  if public.ist_premium() or (select count(*) from public.abos) <> 0 then
    raise exception 'FEHLER: Nutzer C ohne Abo hat Premium oder sieht fremde Zeilen';
  end if;
end
$$;

-- ---------- Nutzer D: gekuendigt und Datum vorbei, also kein Premium ----------
select set_config('request.jwt.claims', '{"sub":"d4444444-4444-4444-8444-444444444444","role":"authenticated"}', true);
do $$
begin
  if public.ist_premium() or (select count(*) from public.abos) <> 1 then
    raise exception 'FEHLER: Nutzer D (Datum vorbei) hat Premium';
  end if;
end
$$;

-- ---------- Service-Rolle: ist_premium_von und der Ablauf der Stripe-Ereignisse ----------
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
declare
  t0 timestamptz := now();
  r text;
  a public.abos;
begin
  if not public.ist_premium_von('a1111111-1111-4111-8111-111111111111') or public.ist_premium_von('b2222222-2222-4222-8222-222222222222')
    or public.ist_premium_von('c3333333-3333-4333-8333-333333333333') or public.ist_premium_von('d4444444-4444-4444-8444-444444444444') then
    raise exception 'FEHLER: ist_premium_von liefert falsche Werte';
  end if;
  begin
    perform public.abo_wende_an('b2222222-2222-4222-8222-222222222222', 'invoice.paid', now(), null, 'aktiv', now() + interval '1 year', null);
    raise exception 'FEHLER: abo_wende_an ist auch fuer die Service-Rolle direkt aufrufbar';
  exception when insufficient_privilege then null;
  end;

  -- 1. Kauf durch B: Zuordnung und vorlaeufiger Stand (1 Tag), Premium sofort
  r := public.abo_stripe_ereignis('evt_b1', 'checkout.session.completed', t0, 'cus_B1', 'sub_B1',
    'b2222222-2222-4222-8222-222222222222', 'aktiv', t0 + interval '1 day', null);
  select * into a from public.abos where user_id = 'b2222222-2222-4222-8222-222222222222';
  if r <> 'zugeordnet' or a.kunde_id <> 'cus_B1' or a.abo_id <> 'sub_B1' or a.quelle <> 'stripe' or a.stand_zeit is not null
    or not public.ist_premium_von('b2222222-2222-4222-8222-222222222222') then
    raise exception 'FEHLER: Kauf von B nicht richtig verbucht (%, %)', r, row_to_json(a);
  end if;
  -- 2. dasselbe Ereignis noch einmal: nichts passiert
  r := public.abo_stripe_ereignis('evt_b1', 'checkout.session.completed', t0, 'cus_B1', 'sub_B1',
    'b2222222-2222-4222-8222-222222222222', 'aktiv', t0 + interval '1 day', null);
  if r <> 'doppelt' then
    raise exception 'FEHLER: doppeltes Ereignis nicht erkannt (%)', r;
  end if;
  -- 3. Abo-Stand kommt: 30 Tage, Plan monat
  r := public.abo_stripe_ereignis('evt_b2', 'customer.subscription.updated', t0 + interval '10 seconds', 'cus_B1', 'sub_B1',
    null, 'aktiv', t0 + interval '30 days', 'monat');
  select * into a from public.abos where user_id = 'b2222222-2222-4222-8222-222222222222';
  if r <> 'neu' or a.gueltig_bis <> t0 + interval '30 days' or a.plan <> 'monat' or a.stand_zeit <> t0 + interval '10 seconds' then
    raise exception 'FEHLER: Abo-Stand nicht uebernommen (%, %)', r, row_to_json(a);
  end if;
  -- 4. ein aelteres Ereignis (spaet zugestellt) aendert nichts
  r := public.abo_stripe_ereignis('evt_b3', 'customer.subscription.updated', t0 + interval '5 seconds', 'cus_B1', 'sub_B1',
    null, 'abgelaufen', t0, null);
  if r <> 'veraltet' or not public.ist_premium_von('b2222222-2222-4222-8222-222222222222') then
    raise exception 'FEHLER: veraltetes Ereignis hat den Stand geaendert (%)', r;
  end if;
  -- 5. Kuendigung zum Laufzeitende: weiter Premium bis gueltig_bis
  r := public.abo_stripe_ereignis('evt_b4', 'customer.subscription.updated', t0 + interval '20 seconds', 'cus_B1', 'sub_B1',
    null, 'gekuendigt', t0 + interval '30 days', null);
  select * into a from public.abos where user_id = 'b2222222-2222-4222-8222-222222222222';
  if r <> 'neu' or a.status <> 'gekuendigt' or a.plan <> 'monat' or not public.ist_premium_von('b2222222-2222-4222-8222-222222222222') then
    raise exception 'FEHLER: Kuendigung falsch verbucht (%, %)', r, row_to_json(a);
  end if;
  -- 6. Rechnung bezahlt laesst die Kuendigung stehen und verkuerzt nie
  r := public.abo_stripe_ereignis('evt_b5', 'invoice.paid', t0 + interval '21 seconds', 'cus_B1', 'sub_B1',
    null, 'aktiv', t0 + interval '2 days', null);
  select * into a from public.abos where user_id = 'b2222222-2222-4222-8222-222222222222';
  if r <> 'neu' or a.status <> 'gekuendigt' or a.gueltig_bis <> t0 + interval '30 days' then
    raise exception 'FEHLER: invoice.paid hat die Kuendigung aufgehoben oder verkuerzt (%, %)', r, row_to_json(a);
  end if;
  -- 7. Abo beendet: kein Premium mehr
  r := public.abo_stripe_ereignis('evt_b6', 'customer.subscription.deleted', t0 + interval '30 seconds', 'cus_B1', 'sub_B1',
    null, 'abgelaufen', t0 + interval '30 seconds', null);
  if r <> 'neu' or public.ist_premium_von('b2222222-2222-4222-8222-222222222222') then
    raise exception 'FEHLER: beendetes Abo hat noch Premium (%)', r;
  end if;
  -- 8. Ereignis eines anderen Abos desselben Kunden aendert nichts
  r := public.abo_stripe_ereignis('evt_b7', 'customer.subscription.updated', t0 + interval '40 seconds', 'cus_B1', 'sub_ANDERES',
    null, 'aktiv', t0 + interval '1 year', null);
  if r <> 'fremdes_abo' or public.ist_premium_von('b2222222-2222-4222-8222-222222222222') then
    raise exception 'FEHLER: fremdes Abo hat den Stand geaendert (%)', r;
  end if;
  -- 9. bezahlte Rechnung nach dem Ende (neue Zahlung): wieder aktiv
  r := public.abo_stripe_ereignis('evt_b8', 'invoice.paid', t0 + interval '50 seconds', 'cus_B1', 'sub_B1',
    null, 'aktiv', t0 + interval '60 days', null);
  select * into a from public.abos where user_id = 'b2222222-2222-4222-8222-222222222222';
  if r <> 'neu' or a.status <> 'aktiv' or a.gueltig_bis <> t0 + interval '60 days' or not public.ist_premium_von('b2222222-2222-4222-8222-222222222222') then
    raise exception 'FEHLER: invoice.paid nach dem Ende nicht verbucht (%, %)', r, row_to_json(a);
  end if;

  -- 10. Reihenfolge vertauscht: das Abo-Ereignis fuer C kommt VOR dem Kauf, wartet und wird beim Kauf angewendet
  r := public.abo_stripe_ereignis('evt_c1', 'customer.subscription.updated', t0 + interval '3 seconds', 'cus_C1', 'sub_C1',
    null, 'aktiv', t0 + interval '365 days', 'jahr');
  if r <> 'wartet' or exists (select 1 from public.abos where user_id = 'c3333333-3333-4333-8333-333333333333') then
    raise exception 'FEHLER: Ereignis ohne Zuordnung wartet nicht (%)', r;
  end if;
  r := public.abo_stripe_ereignis('evt_c2', 'checkout.session.completed', t0 + interval '2 seconds', 'cus_C1', 'sub_C1',
    'c3333333-3333-4333-8333-333333333333', 'aktiv', t0 + interval '1 day', null);
  select * into a from public.abos where user_id = 'c3333333-3333-4333-8333-333333333333';
  if r <> 'zugeordnet' or a.gueltig_bis <> t0 + interval '365 days' or a.plan <> 'jahr' or a.stand_zeit <> t0 + interval '3 seconds'
    or (select ergebnis from public.stripe_ereignisse where id = 'evt_c1') <> 'neu'
    or (select user_id from public.stripe_ereignisse where id = 'evt_c1') <> 'c3333333-3333-4333-8333-333333333333' then
    raise exception 'FEHLER: wartendes Ereignis beim Kauf nicht angewendet (%, %)', r, row_to_json(a);
  end if;

  -- 10b. Gleiche Sekunde (Stripe schickt beim Abschluss mehrere Ereignisse mit demselben created): ein spaet
  -- zugestelltes "incomplete" nimmt nichts weg, die bezahlte Rechnung verlaengert, nur "deleted" beendet
  r := public.abo_stripe_ereignis('evt_c3', 'customer.subscription.created', t0 + interval '3 seconds', 'cus_C1', 'sub_C1',
    null, 'abgelaufen', t0 + interval '3 seconds', null);
  if r <> 'veraltet' or not public.ist_premium_von('c3333333-3333-4333-8333-333333333333') then
    raise exception 'FEHLER: Ereignis gleicher Sekunde hat Premium weggenommen (%)', r;
  end if;
  r := public.abo_stripe_ereignis('evt_c4', 'invoice.paid', t0 + interval '3 seconds', 'cus_C1', 'sub_C1',
    null, 'aktiv', t0 + interval '400 days', null);
  select * into a from public.abos where user_id = 'c3333333-3333-4333-8333-333333333333';
  if r <> 'neu' or a.gueltig_bis <> t0 + interval '400 days' or a.status <> 'aktiv' then
    raise exception 'FEHLER: Rechnung gleicher Sekunde nicht verbucht (%, %)', r, row_to_json(a);
  end if;
  r := public.abo_stripe_ereignis('evt_c5', 'customer.subscription.deleted', t0 + interval '3 seconds', 'cus_C1', 'sub_C1',
    null, 'abgelaufen', t0 + interval '3 seconds', null);
  if r <> 'neu' or public.ist_premium_von('c3333333-3333-4333-8333-333333333333') then
    raise exception 'FEHLER: Ende des Abos in derselben Sekunde nicht verbucht (%)', r;
  end if;

  -- 10c. Zweites Abo desselben Kunden (C schliesst nach dem Ende wieder ab), Abo-Ereignis kommt VOR dem Kauf: erst
  -- 'fremdes_abo' (altes Abo sub_C1 steht noch in der Zeile), beim Kauf nachgeholt; ein Ereignis eines dritten Abos bleibt
  r := public.abo_stripe_ereignis('evt_c6', 'customer.subscription.updated', t0 + interval '60 seconds', 'cus_C1', 'sub_C2',
    null, 'aktiv', t0 + interval '30 days', 'monat');
  if r <> 'fremdes_abo' or public.ist_premium_von('c3333333-3333-4333-8333-333333333333') then
    raise exception 'FEHLER: Ereignis eines neuen Abos vor dem Kauf falsch verbucht (%)', r;
  end if;
  r := public.abo_stripe_ereignis('evt_c7', 'customer.subscription.updated', t0 + interval '61 seconds', 'cus_C1', 'sub_C3',
    null, 'aktiv', t0 + interval '9 years', 'jahr');
  r := public.abo_stripe_ereignis('evt_c8', 'checkout.session.completed', t0 + interval '59 seconds', 'cus_C1', 'sub_C2',
    'c3333333-3333-4333-8333-333333333333', 'aktiv', t0 + interval '1 day', null);
  select * into a from public.abos where user_id = 'c3333333-3333-4333-8333-333333333333';
  if r <> 'zugeordnet' or a.abo_id <> 'sub_C2' or a.gueltig_bis <> t0 + interval '30 days' or a.plan <> 'monat'
    or a.stand_zeit <> t0 + interval '60 seconds' or not public.ist_premium_von('c3333333-3333-4333-8333-333333333333')
    or (select ergebnis from public.stripe_ereignisse where id = 'evt_c6') <> 'neu'
    or (select ergebnis from public.stripe_ereignisse where id = 'evt_c7') <> 'fremdes_abo' then
    raise exception 'FEHLER: Ereignis des neuen Abos beim zweiten Kauf nicht nachgeholt (%, %)', r, row_to_json(a);
  end if;

  -- 11. Kauf mit unbekannter Nutzer-ID: verbucht, aber keine Zeile
  r := public.abo_stripe_ereignis('evt_x1', 'checkout.session.completed', t0, 'cus_X1', 'sub_X1',
    'deadbeef-0000-4000-8000-000000000000', 'aktiv', t0 + interval '1 day', null);
  if r <> 'ohne_nutzer' or exists (select 1 from public.abos where kunde_id = 'cus_X1') then
    raise exception 'FEHLER: Kauf ohne bekannten Nutzer falsch verbucht (%)', r;
  end if;

  -- 12. Ein neuer Kauf verkuerzt ein laengeres manuelles Abo nicht (A: manuell 30 Tage)
  r := public.abo_stripe_ereignis('evt_a1', 'checkout.session.completed', t0, 'cus_A1', 'sub_A1',
    'a1111111-1111-4111-8111-111111111111', 'aktiv', t0 + interval '1 day', null);
  select * into a from public.abos where user_id = 'a1111111-1111-4111-8111-111111111111';
  if r <> 'zugeordnet' or a.gueltig_bis < t0 + interval '29 days' or a.status <> 'aktiv' or a.kunde_id <> 'cus_A1' then
    raise exception 'FEHLER: Kauf hat ein laengeres Abo verkuerzt (%, %)', r, row_to_json(a);
  end if;

  -- 13. Unfertige Eingaben werden abgelehnt (Stripe wiederholt dann)
  begin
    perform public.abo_stripe_ereignis('kein-evt', 'invoice.paid', t0, 'cus_B1', 'sub_B1', null, 'aktiv', t0 + interval '1 day', null);
    raise exception 'FEHLER: ungueltige Ereignis-ID angenommen';
  exception when raise_exception then
    if sqlerrm <> 'ABO_EREIGNIS_UNGUELTIG' then raise; end if;
  end;
  begin
    perform public.abo_stripe_ereignis('evt_z1', 'charge.refunded', t0, 'cus_B1', null, null, 'aktiv', t0 + interval '1 day', null);
    raise exception 'FEHLER: unbekannter Ereignistyp angenommen';
  exception when raise_exception then
    if sqlerrm <> 'ABO_EREIGNIS_UNGUELTIG' then raise; end if;
  end;
  begin
    perform public.abo_stripe_ereignis('evt_z2', 'invoice.paid', t0, 'cus_B1', 'sub_B1', null, 'aktiv', null, null);
    raise exception 'FEHLER: Ereignis ohne gueltig_bis angenommen';
  exception when raise_exception then
    if sqlerrm <> 'ABO_EREIGNIS_UNGUELTIG' then raise; end if;
  end;
end
$$;

-- Nutzer B sieht nach dem Kauf die eigene Zeile mit Stripe-Daten, aber keine Ereignisse
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
do $$
begin
  if not public.ist_premium() or (select quelle from public.abos) <> 'stripe' or (select count(*) from public.abos) <> 1 then
    raise exception 'FEHLER: Nutzer B sieht den eigenen Stripe-Stand nicht';
  end if;
end
$$;

reset role;
select 'Abo-RLS-Test erfolgreich' as ergebnis;
rollback;

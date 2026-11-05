-- RLS- und Ablauf-Test fuer supabase/abo-beenden-schema.sql. Im Supabase SQL Editor ausfuehren (nach schema.sql,
-- abo-schema.sql und abo-beenden-schema.sql). Alles in einer Transaktion, am Ende zurueckgerollt.
-- Am Ende steht "Abo-Beenden-RLS-Test erfolgreich".
begin;

insert into auth.users (id, email, email_confirmed_at)
values
  ('e5555555-5555-4555-8555-555555555555', 'beenden-e@example.invalid', now()),
  ('f6666666-6666-4666-8666-666666666666', 'beenden-f@example.invalid', null);
insert into public.abos (user_id, status, plan, gueltig_bis, quelle, kunde_id, abo_id)
values
  ('e5555555-5555-4555-8555-555555555555', 'aktiv', 'monat', now() + interval '30 days', 'stripe', 'cus_rlsE', 'sub_rlsE'),
  ('f6666666-6666-4666-8666-666666666666', 'aktiv', 'monat', now() + interval '30 days', 'stripe', 'cus_rlsF', 'sub_rlsF');

-- ---------- Service-Rolle (Edge Function) ----------
set local role service_role;
do $$
declare h text := repeat('a', 64);
begin
  if public.abo_link_anlegen('BEENDEN-E@example.invalid', h, now() + interval '1 hour') is not true then
    raise exception 'FEHLER: Link fuer bestaetigte Adresse mit Abo wurde nicht angelegt';
  end if;
  if public.abo_link_anlegen('beenden-f@example.invalid', repeat('b', 64), now() + interval '1 hour') then
    raise exception 'FEHLER: Link fuer unbestaetigte Adresse angelegt';
  end if;
  if public.abo_link_anlegen('niemand@example.invalid', repeat('c', 64), now() + interval '1 hour') then
    raise exception 'FEHLER: Link fuer unbekannte Adresse angelegt';
  end if;
  if public.abo_link_anlegen('beenden-e@example.invalid', 'kein-hash', now() + interval '1 hour') then
    raise exception 'FEHLER: ungueltiger Hash angenommen';
  end if;
  -- Begrenzung: zwei weitere gehen, der vierte in der Stunde nicht
  perform public.abo_link_anlegen('beenden-e@example.invalid', repeat('d', 64), now() + interval '1 hour');
  perform public.abo_link_anlegen('beenden-e@example.invalid', repeat('e', 64), now() + interval '1 hour');
  if public.abo_link_anlegen('beenden-e@example.invalid', repeat('f', 64), now() + interval '1 hour') then
    raise exception 'FEHLER: vierter Link in einer Stunde angelegt';
  end if;
  if (select count(*) from public.abo_link_pruefen(h)) <> 1 then
    raise exception 'FEHLER: gueltiger Link nicht gefunden';
  end if;
  perform public.abo_link_verbrauchen(h);
  if (select count(*) from public.abo_link_pruefen(h)) <> 0 then
    raise exception 'FEHLER: verbrauchter Link gilt noch';
  end if;
  update public.abo_kuendigungs_links set ablauf = now() - interval '1 minute' where hash = repeat('d', 64);
  if (select count(*) from public.abo_link_pruefen(repeat('d', 64))) <> 0 then
    raise exception 'FEHLER: abgelaufener Link gilt noch';
  end if;
  perform public.abo_vorgang_eintragen('e5555555-5555-4555-8555-555555555555', 'kuendigung', 'link', 'sub_rlsE',
    now() + interval '30 days', null, true);
  perform public.abo_vorgang_eintragen('f6666666-6666-4666-8666-666666666666', 'widerruf', 'angemeldet', 'sub_rlsF',
    now(), 199, true);
end
$$;
reset role;

-- ---------- Nutzer E: sieht nur den eigenen Vorgang, keine Links, darf nichts schreiben ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e5555555-5555-4555-8555-555555555555","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.abo_vorgaenge) <> 1 then
    raise exception 'FEHLER: Nutzer sieht fremde Vorgaenge';
  end if;
  begin
    perform 1 from public.abo_kuendigungs_links;
    raise exception 'FEHLER: Nutzer kann Kuendigungs-Links lesen';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.abo_vorgaenge (user_id, art, weg) values ('e5555555-5555-4555-8555-555555555555', 'widerruf', 'link');
    raise exception 'FEHLER: Nutzer kann Vorgaenge schreiben';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.abo_link_anlegen('beenden-e@example.invalid', repeat('9', 64), now() + interval '1 hour');
    raise exception 'FEHLER: Nutzer darf Links anlegen';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

-- ---------- anon: nichts ----------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    perform 1 from public.abo_vorgaenge;
    raise exception 'FEHLER: anon kann Vorgaenge lesen';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.abo_link_pruefen(repeat('a', 64));
    raise exception 'FEHLER: anon darf Links pruefen';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

select 'Abo-Beenden-RLS-Test erfolgreich' as ergebnis;
rollback;

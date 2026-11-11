-- Prueft supabase/zwei-ligen-schema.sql im Supabase SQL Editor (als Besitzer). Alles wird am Ende zurueckgerollt.
-- Voraussetzung: online-, kronen-, raetsel-duell- (mit raetsel-duell-daten.sql) und zwei-ligen-schema.sql eingespielt.
-- Jeder Fehler bricht mit "FEHLER: ..." ab; ohne Fehler endet der Lauf mit ROLLBACK.
-- Abschnitte: 1 neuer Stand je Liga, Rechte; 2 Trennung der Kronen nach Quelle; 3 Start der Raetsel-Liga; 4 KI-Deckel je
-- Liga; 5 Ranked-Zeit und Antwort der Suche; 6 Paarung nur nach Reihenfolge (grosser Elo-Abstand wird gepaart, die
-- naechste Elo zuerst), online und Raetsel; 7 "Jetzt gegen KI" erst ab ki_frueh_s; 8 Wochen-Abrechnung je Liga;
-- 9 Raetsel-Elo aendert sich durch ein gewertetes Duell, die Online-Elo nicht; 10 KI-Belege: Vorab-Niederlage, hoechstens
-- ein offener Beleg, Korrektur auf Sieg und Remis, Abbruch ohne Meldung, volle Tagesgrenze; 11 Riegel gegen eine zweite
-- gewertete Partie (Suche fuehrt zurueck, Paarung prueft beide Seiten, abgelaufene Uhr macht frei); 12 Kontingent der
-- Live-Bewertung (1 Partie je Tag, je Partie einmal, Premium unbegrenzt falls abo-schema.sql da ist, Rechte).
-- Auf der echten Datenbank: die Pruefungen beschraenken sich auf die Testkonten. Damit kein echter Suchender mit einem
-- Testkonto gepaart wird, leert der Test zuerst beide Warteschlangen; das rollt mit zurueck (echte Zeilen bleiben).
begin;

delete from public.suche_warteschlange;
delete from public.duell_warteschlange;

insert into auth.users (id, email)
values
  ('a1000000-0000-4000-8000-000000000001', 'ligen-a@example.invalid'),
  ('b2000000-0000-4000-8000-000000000002', 'ligen-b@example.invalid'),
  ('c3000000-0000-4000-8000-000000000003', 'ligen-c@example.invalid'),
  ('d4000000-0000-4000-8000-000000000004', 'ligen-d@example.invalid'),
  ('e5000000-0000-4000-8000-000000000005', 'ligen-e@example.invalid'),
  ('c9000000-0000-4000-8000-000000000009', 'ligen-i@example.invalid');

-- ---------- 1. Neuer Stand je Liga, Rechte ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
declare
  s jsonb;
  g jsonb;
  k jsonb := public.kronen_konstanten();
begin
  s := public.liga_staende();
  if s->'online'->>'liga' <> 'online' or s->'raetsel'->>'liga' <> 'raetsel'
     or (s->'online'->>'stufe')::int <> 0 or (s->'raetsel'->>'stufe')::int <> 0
     or (s->'raetsel'->>'kronen')::int <> 0 or s->'raetsel'->>'platz' is not null or (s->'raetsel'->>'n')::int <> 30 then
    raise exception 'FEHLER: neue Staende falsch (%)', s;
  end if;
  g := public.liga_gruppe('raetsel');
  if g->>'liga' <> 'raetsel' or g->>'gruppe' is not null or jsonb_array_length(g->'mitglieder') <> 0
     or (g->'bot_ki'->>'max')::int <> 60 or jsonb_typeof(g->'offen') <> 'array' then
    raise exception 'FEHLER: Raetsel-Gruppe ohne Buchung falsch (%)', g;
  end if;
  if public.kronen_mein_stand() ? 'liga' or public.liga_meine_gruppe() ? 'liga' then
  -- ranked_zeit ist Flos Wahl L3 (Empfehlung 5+3): nur das Format wird hier geprueft, der Wert steht EINMAL im Schema
    raise exception 'FEHLER: alte Aufrufe haben das neue Feld liga';
  end if;
  -- Flo 11.11.2026: Bot nach 10 s, "Jetzt gegen KI" ab 0 s; ohne Premium 1 Partie Live-Bewertung je Tag
  if k->>'ranked_zeit' !~ '^[0-9]+[+][0-9]+$' or (k->>'mensch_warte_s')::int <> 10 or (k->>'ki_frueh_s')::int <> 0
     or (k->>'live_bewertung_tag')::int <> 1
     or k->'quellen_liga'->>'duell' <> 'raetsel' or k->'quellen_liga'->>'bot' <> 'online' then
    raise exception 'FEHLER: Konstanten falsch (%)', k;
  end if;
  begin
    perform public.liga_stand('schach');
    raise exception 'FEHLER: unbekannte Liga angenommen';
  exception when others then
    if sqlerrm <> 'KRONEN_EINGABE' then raise; end if;
  end;
  begin
    perform 1 from public.raetsel_stand;
    raise exception 'FEHLER: raetsel_stand lesbar';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.liga_buchen_in('a1000000-0000-4000-8000-000000000001', 'raetsel', 999);
    raise exception 'FEHLER: liga_buchen_in fuer Nutzer offen';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
do $$
begin
  -- nur die Testkonten: auf der echten Datenbank gibt es laengst Mitglieder
  if exists (select 1 from public.liga_mitglieder m where m.user_id in ('a1000000-0000-4000-8000-000000000001',
       'b2000000-0000-4000-8000-000000000002', 'c3000000-0000-4000-8000-000000000003',
       'd4000000-0000-4000-8000-000000000004', 'e5000000-0000-4000-8000-000000000005')) then
    raise exception 'FEHLER: Lesen hat eine Gruppe angelegt';
  end if;
end;
$$;

set local role anon;
do $$
begin
  begin
    perform public.liga_stand('online');
    raise exception 'FEHLER: anon darf liga_stand';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.liga_gruppe('raetsel');
    raise exception 'FEHLER: anon darf liga_gruppe';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- ---------- 2. Trennung der Kronen nach Quelle ----------
do $$
declare
  a uuid := 'a1000000-0000-4000-8000-000000000001';
  r jsonb;
begin
  r := public.kronen_einfach_buchen(a, 'duell', 'duell-1', 'sieg');
  if (r->>'delta')::int <> 30 or (r->>'kronen')::int <> 30 then
    raise exception 'FEHLER: Duell-Sieg falsch gebucht (%)', r;
  end if;
  r := public.kronen_einfach_buchen(a, 'bot', 'bot-1', 'sieg');
  if (r->>'delta')::int <> 15 or (r->>'kronen')::int <> 15 then
    raise exception 'FEHLER: Bot-Sieg nicht nur in Online (%)', r;
  end if;
  if (select count(*) from public.liga_mitglieder m where m.user_id = a) <> 2
     or (select m.kronen from public.liga_mitglieder m where m.user_id = a and m.liga = 'raetsel') <> 30
     or (select m.kronen from public.liga_mitglieder m where m.user_id = a and m.liga = 'online') <> 15
     or (select g.liga from public.liga_gruppen g join public.liga_mitglieder m on m.gruppe = g.id
         where m.user_id = a and m.liga = 'raetsel') <> 'raetsel' then
    raise exception 'FEHLER: Gruppen nicht je Liga getrennt';
  end if;
  if (select s.kronen from public.kronen_stand s where s.user_id = a) <> 15
     or (select s.kronen from public.raetsel_stand s where s.user_id = a) <> 30 then
    raise exception 'FEHLER: Gesamtkronen nicht je Liga getrennt';
  end if;
  -- dieselbe Buchung noch einmal: nichts aendert sich
  r := public.kronen_einfach_buchen(a, 'duell', 'duell-1', 'sieg');
  if (r->>'delta')::int <> 0 or (r->>'kronen')::int <> 30 then
    raise exception 'FEHLER: Duell doppelt gebucht (%)', r;
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
declare
  o jsonb := public.liga_stand('online');
  r jsonb := public.liga_stand('raetsel');
  g jsonb := public.liga_gruppe('raetsel');
  alt jsonb := public.kronen_mein_stand();
begin
  if (o->>'kronen')::int <> 15 or (r->>'kronen')::int <> 30 or (o->>'platz')::int is null or (r->>'platz')::int is null then
    raise exception 'FEHLER: liga_stand je Liga falsch (% / %)', o, r;
  end if;
  if (alt->>'kronen')::int <> 15 then
    raise exception 'FEHLER: kronen_mein_stand ist nicht die Online-Liga (%)', alt;
  end if;
  if jsonb_array_length(g->'mitglieder') <> 30
     or (select count(*) from jsonb_array_elements(g->'mitglieder') e where (e->>'ich')::boolean and (e->>'kronen')::int = 30) <> 1 then
    raise exception 'FEHLER: Raetsel-Gruppe falsch (%)', g;
  end if;
  if (public.liga_meine_gruppe()->>'gruppe') = (g->>'gruppe') then
    raise exception 'FEHLER: alte Gruppe zeigt die Raetsel-Gruppe';
  end if;
end;
$$;
reset role;

-- ---------- 3. Start der Raetsel-Liga: Online-Stufe, hoechstens Laeufer III; Elo uebernommen ----------
do $$
declare
  c uuid := 'c3000000-0000-4000-8000-000000000003';
  st public.raetsel_stand;
begin
  perform public.kronen_stand_sichern(c);
  update public.kronen_stand s set stufe = 11, elo = 1777 where s.user_id = c;
  st := public.raetsel_stand_sichern(c);
  if st.stufe <> 6 or st.elo <> 1777 or st.kronen <> 0 then
    raise exception 'FEHLER: Start der Raetsel-Liga falsch (%)', to_jsonb(st);
  end if;
  update public.kronen_stand s set stufe = 2 where s.user_id = c;
  st := public.raetsel_stand_sichern(c);
  if st.stufe <> 6 then
    raise exception 'FEHLER: Raetsel-Stufe folgt spaeter der Online-Stufe';
  end if;
end;
$$;

-- ---------- 4. KI-Deckel je Liga ----------
do $$
declare
  d uuid := 'd4000000-0000-4000-8000-000000000004';
  r jsonb;
begin
  perform public.kronen_stand_sichern(d);
  -- Online-Deckel voll (60 aus KI-Gegnern, Flos Wahl R13-K1)
  insert into public.kronen_buchungen (user_id, quelle, ref, delta, woche)
  values (d, 'ki', 'voll-1', 60, public.liga_woche_am(clock_timestamp()));
  r := public.kronen_einfach_buchen(d, 'bot', 'bot-d', 'sieg');
  if (r->>'delta')::int <> 0 or not (r->>'bot_ki_voll')::boolean then
    raise exception 'FEHLER: Online-Deckel greift nicht (%)', r;
  end if;
  r := public.kronen_einfach_buchen(d, 'duell_ki', 'duell-ki-d', 'sieg');
  if (r->>'delta')::int <> 20 or (r->>'bot_ki_voll')::boolean then
    raise exception 'FEHLER: Online-Deckel sperrt die Raetsel-Liga (%)', r;
  end if;
end;
$$;

-- ---------- 5. Ranked-Zeit und Antwort der Suche ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b2000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
declare
  r jsonb;
begin
  r := public.online_suche_start('3+2');
  if not (r->>'wartet')::boolean or r->>'zeit' <> public.kronen_konstanten() ->> 'ranked_zeit' or (r->>'warte_s')::int <> 10 or (r->>'ki_ab_s')::int <> 0
     or r->>'seit' is null then
    raise exception 'FEHLER: Antwort der Online-Suche falsch (%)', r;
  end if;
  r := public.online_suche_stand();
  if not (r->>'wartet')::boolean or r->>'seit' is null then
    raise exception 'FEHLER: online_suche_stand ohne seit (%)', r;
  end if;
  begin
    perform public.online_suche_start('drei');
    raise exception 'FEHLER: falsche Zeit angenommen';
  exception when others then
    if sqlerrm <> 'KRONEN_EINGABE' then raise; end if;
  end;
end;
$$;
reset role;
do $$
begin
  if (select q.zeit from public.suche_warteschlange q where q.user_id = 'b2000000-0000-4000-8000-000000000002') <> public.kronen_konstanten() ->> 'ranked_zeit' then
    raise exception 'FEHLER: Warteschlange nicht in der Ranked-Zeit';
  end if;
end;
$$;

-- ---------- 6. Paarung: grosser Elo-Abstand wird gepaart, naechste Elo zuerst ----------
-- B wartet mit Elo 2800 (gesetzt), E sucht mit Elo 400 ohne Zeitangabe: sofort eine gewertete Partie in der Ranked-Zeit
update public.suche_warteschlange q set elo = 2800 where q.user_id = 'b2000000-0000-4000-8000-000000000002';
do $$
begin
  perform public.kronen_stand_sichern('e5000000-0000-4000-8000-000000000005');
  update public.kronen_stand s set elo = 400 where s.user_id = 'e5000000-0000-4000-8000-000000000005';
end;
$$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e5000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
do $$
declare
  r jsonb := public.online_suche_start();
begin
  if r->>'partie' is null then
    raise exception 'FEHLER: 400 gegen 2800 nicht gepaart (%)', r;
  end if;
end;
$$;
reset role;
do $$
declare
  p record;
begin
  select * into p from public.partien_online x
  where 'e5000000-0000-4000-8000-000000000005' in (x.weiss, x.schwarz) and x.gewertet;
  if p.id is null or p.bedenkzeit_s || '+' || p.inkrement_s <> (split_part(public.kronen_konstanten() ->> 'ranked_zeit', '+', 1)::int * 60) || '+' || split_part(public.kronen_konstanten() ->> 'ranked_zeit', '+', 2)
     or 'b2000000-0000-4000-8000-000000000002' not in (p.weiss, p.schwarz) then
    raise exception 'FEHLER: gepaarte Partie falsch (%)', to_jsonb(p);
  end if;
  if exists (select 1 from public.suche_warteschlange q where q.user_id in ('b2000000-0000-4000-8000-000000000002',
       'e5000000-0000-4000-8000-000000000005')) then
    raise exception 'FEHLER: Warteschlange nach der Paarung nicht leer';
  end if;
end;
$$;

-- naechste Elo zuerst: C (1777) und D (1000) warten, A (Elo 1700) sucht und bekommt C, obwohl D laenger wartet
do $$
begin
  insert into public.suche_warteschlange (user_id, zeit, elo, seit) values
    ('d4000000-0000-4000-8000-000000000004', public.kronen_konstanten() ->> 'ranked_zeit', 1000, now() - interval '20 seconds'),
    ('c3000000-0000-4000-8000-000000000003', public.kronen_konstanten() ->> 'ranked_zeit', 1777, now() - interval '5 seconds');
  update public.kronen_stand s set elo = 1700 where s.user_id = 'a1000000-0000-4000-8000-000000000001';
end;
$$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  if public.online_suche_start()->>'partie' is null then
    raise exception 'FEHLER: A nicht gepaart';
  end if;
end;
$$;
reset role;
do $$
begin
  if not exists (select 1 from public.suche_warteschlange q where q.user_id = 'd4000000-0000-4000-8000-000000000004')
     or exists (select 1 from public.suche_warteschlange q where q.user_id = 'c3000000-0000-4000-8000-000000000003') then
    raise exception 'FEHLER: nicht die naechste Elo gepaart';
  end if;
  delete from public.suche_warteschlange q where q.user_id in ('a1000000-0000-4000-8000-000000000001',
    'c3000000-0000-4000-8000-000000000003', 'd4000000-0000-4000-8000-000000000004');
end;
$$;

-- Raetsel: Elo 300 gegen 3500 (Raetsel-Elo) wird gepaart
do $$
begin
  perform public.raetsel_stand_sichern('b2000000-0000-4000-8000-000000000002');
  perform public.raetsel_stand_sichern('e5000000-0000-4000-8000-000000000005');
  update public.raetsel_stand r set elo = 300 where r.user_id = 'b2000000-0000-4000-8000-000000000002';
  update public.raetsel_stand r set elo = 3500 where r.user_id = 'e5000000-0000-4000-8000-000000000005';
end;
$$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b2000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
declare
  r jsonb := public.duell_suche_start();
begin
  if not (r->>'wartet')::boolean or (r->>'warte_s')::int <> 10 or (r->>'ki_ab_s')::int <> 0 or r->>'seit' is null then
    raise exception 'FEHLER: Antwort der Duell-Suche falsch (%)', r;
  end if;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"e5000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
do $$
declare
  r jsonb := public.duell_suche_start();
begin
  if r->>'duell' is null then
    raise exception 'FEHLER: Raetsel 300 gegen 3500 nicht gepaart (%)', r;
  end if;
end;
$$;
reset role;
do $$
begin
  if (select x.art from public.duelle x where 'e5000000-0000-4000-8000-000000000005' in (x.a, x.b)
        and 'b2000000-0000-4000-8000-000000000002' in (x.a, x.b)) is distinct from 'gewertet' then
    raise exception 'FEHLER: kein gewertetes Duell zwischen B und E';
  end if;
end;
$$;

-- ---------- 7. "Jetzt gegen KI" erst ab ki_frueh_s ----------
-- Flo 11.11.2026: ki_frueh_s = 0, der Sofort-Knopf zaehlt ab Sekunde 0. Die Sperre davor wird nur geprueft, wenn es eine
-- gibt (ki_frueh_s > 0); der Wert selbst steht in Abschnitt 1.
do $$
declare
  frueh integer := (public.kronen_konstanten() ->> 'ki_frueh_s')::integer;
begin
  if frueh > 0 then
    insert into public.suche_warteschlange (user_id, zeit, elo, seit) values
      ('d4000000-0000-4000-8000-000000000004', public.kronen_konstanten() ->> 'ranked_zeit', 1000,
       now() - make_interval(secs => frueh) / 2);
    insert into public.duell_warteschlange (user_id, elo, seit) values
      ('d4000000-0000-4000-8000-000000000004', 1000, now() - make_interval(secs => frueh) / 2);
  end if;
end;
$$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d4000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$
begin
  if (public.kronen_konstanten() ->> 'ki_frueh_s')::integer > 0
     and (public.online_suche_ende(true) <> '{}'::jsonb or public.duell_suche_ende(true) <> '{}'::jsonb) then
    raise exception 'FEHLER: KI vor ki_frueh_s gewertet';
  end if;
end;
$$;
-- bei ki_frueh_s = 0: der Sofort-Knopf in Sekunde 0 bringt einen gewerteten KI-Gegner (Beleg)
reset role;
do $$
declare
  r jsonb;
begin
  if (public.kronen_konstanten() ->> 'ki_frueh_s')::integer = 0 then
    -- eigenes Konto I: C und E spielen seit Abschnitt 6
    insert into public.suche_warteschlange (user_id, zeit, elo, seit) values
      ('c9000000-0000-4000-8000-000000000009', public.kronen_konstanten() ->> 'ranked_zeit', 1000, now());
    perform set_config('request.jwt.claims', '{"sub":"c9000000-0000-4000-8000-000000000009","role":"authenticated"}', true);
    r := public.online_suche_ende(true);
    if r->>'ki_ref' is null then
      raise exception 'FEHLER: Sofort-Knopf in Sekunde 0 ohne Beleg (%)', r;
    end if;
  end if;
end;
$$;
reset role;
do $$
begin
  insert into public.suche_warteschlange (user_id, zeit, elo, seit) values
    ('d4000000-0000-4000-8000-000000000004', public.kronen_konstanten() ->> 'ranked_zeit', 1000, now() - interval '11 seconds');
  insert into public.duell_warteschlange (user_id, elo, seit) values
    ('d4000000-0000-4000-8000-000000000004', 1234, now() - interval '11 seconds');
end;
$$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d4000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$
declare
  o jsonb := public.online_suche_ende(true);
  d jsonb := public.duell_suche_ende(true);
begin
  if o->>'ki_ref' is null or d->>'duell' is null then
    raise exception 'FEHLER: KI nach ki_frueh_s nicht gewertet (% / %)', o, d;
  end if;
end;
$$;
reset role;
do $$
begin
  if (select x.ki_elo from public.duelle x where x.a = 'd4000000-0000-4000-8000-000000000004' and x.art = 'ki') <> 1234 then
    raise exception 'FEHLER: KI-Duell nicht mit der Raetsel-Elo';
  end if;
end;
$$;

-- ---------- 8. Wochen-Abrechnung je Liga ----------
-- A hat in beiden Ligen eine Gruppe dieser Woche; beide in die Vorwoche schieben und abrechnen
do $$
declare
  a uuid := 'a1000000-0000-4000-8000-000000000001';
  vor date := public.liga_woche_heute() - 7;
  n integer;
begin
  update public.kronen_stand s set stufe = 3 where s.user_id = a;
  update public.raetsel_stand s set stufe = 9 where s.user_id = a;
  update public.liga_gruppen g set woche = vor, stufe = case g.liga when 'online' then 3 else 9 end
  where g.id in (select m.gruppe from public.liga_mitglieder m where m.user_id = a);
  update public.liga_mitglieder m set woche = vor where m.user_id = a;
  -- A ist in beiden Gruppen vorne (900 Kronen schlagen jeden Bot)
  update public.liga_mitglieder m set kronen = 900 where m.user_id = a;
  perform public.liga_abrechnen();
  if (select s.stufe from public.kronen_stand s where s.user_id = a) <> 4
     or (select s.stufe from public.raetsel_stand s where s.user_id = a) <> 10 then
    raise exception 'FEHLER: Aufstieg nicht je Liga (online %, raetsel %)',
      (select s.stufe from public.kronen_stand s where s.user_id = a), (select s.stufe from public.raetsel_stand s where s.user_id = a);
  end if;
  select count(*) into n from public.liga_belohnungen l where l.user_id = a and l.woche = vor and l.art = 'banner';
  if n <> 2 or (select count(distinct l.liga) from public.liga_belohnungen l where l.user_id = a and l.art = 'banner') <> 2 then
    raise exception 'FEHLER: Platz-1-Belohnung nicht genau einmal je Liga (%)', n;
  end if;
  perform public.liga_abrechnen();
  if (select count(*) from public.liga_belohnungen l where l.user_id = a) <> n
     or (select s.stufe from public.kronen_stand s where s.user_id = a) <> 4 then
    raise exception 'FEHLER: zweite Abrechnung aendert etwas';
  end if;
  -- erwartete offene Belohnungen je Liga merken (mit karte-schema.sql sind Banner schon ausgezahlt)
  perform set_config('ligen_test.offen_online', (select count(*) from public.liga_belohnungen l
    where l.user_id = a and not l.ausgezahlt and l.liga = 'online')::text, true);
  perform set_config('ligen_test.offen_raetsel', (select count(*) from public.liga_belohnungen l
    where l.user_id = a and not l.ausgezahlt and l.liga = 'raetsel')::text, true);
end;
$$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
declare
  o jsonb := public.liga_gruppe('online');
  r jsonb := public.liga_gruppe('raetsel');
  eo integer := current_setting('ligen_test.offen_online')::integer;
  er integer := current_setting('ligen_test.offen_raetsel')::integer;
begin
  if jsonb_array_length(o->'offen') <> eo or jsonb_array_length(r->'offen') <> er
     or jsonb_array_length(public.liga_meine_gruppe()->'offen') <> eo then
    raise exception 'FEHLER: offene Belohnungen nicht je Liga (% / %)', o->'offen', r->'offen';
  end if;
end;
$$;
reset role;

-- ---------- 9. Raetsel-Elo durch ein gewertetes Duell ----------
do $$
declare
  ub uuid := 'b2000000-0000-4000-8000-000000000002';
  ue uuid := 'e5000000-0000-4000-8000-000000000005';
  dd public.duelle;
  online_b integer := (select s.elo from public.kronen_stand s where s.user_id = 'b2000000-0000-4000-8000-000000000002');
begin
  select * into dd from public.duelle x where ub in (x.a, x.b) and ue in (x.a, x.b) and x.art = 'gewertet';
  update public.duelle x set start_am = now() - interval '10 minutes' where x.id = dd.id;
  update public.duell_spieler s set geloest = 9, zuege = 12 where s.duell = dd.id and s.user_id = ub;
  update public.duell_spieler s set geloest = 2, zuege = 5 where s.duell = dd.id and s.user_id = ue;
  perform public.duell_auswerten(dd.id);
  if (select r.elo from public.raetsel_stand r where r.user_id = ub) <= 300
     or (select r.elo from public.raetsel_stand r where r.user_id = ue) >= 3500
     or (select r.elo_n from public.raetsel_stand r where r.user_id = ub) <> 1 then
    raise exception 'FEHLER: Raetsel-Elo nicht gebucht';
  end if;
  if (select s.elo from public.kronen_stand s where s.user_id = ub) <> online_b then
    raise exception 'FEHLER: Duell aendert die Online-Elo';
  end if;
  if (select m.kronen from public.liga_mitglieder m where m.user_id = ub and m.liga = 'raetsel') <> 30
     or exists (select 1 from public.liga_mitglieder m where m.user_id = ub and m.liga = 'online') then
    raise exception 'FEHLER: Duell-Sieg nicht in der Raetsel-Liga';
  end if;
  -- zweites Auswerten aendert nichts
  perform public.duell_auswerten(dd.id);
  if (select r.elo_n from public.raetsel_stand r where r.user_id = ub) <> 1 then
    raise exception 'FEHLER: Elo doppelt gebucht';
  end if;
end;
$$;

-- ---------- 10. KI-Belege: Vorab-Niederlage, hoechstens ein offener Beleg ----------
-- Als Besitzer mit gesetzter Anmeldung (die Funktionen sind security definer; die Rechte prueft Abschnitt 1).
-- now() steht in der Transaktion still: Suchbeginn und Alter eines Belegs werden zurueckgestellt.
insert into auth.users (id, email) values ('a8000000-0000-4000-8000-000000000008', 'ligen-ki@example.invalid');
do $$
declare
  u uuid := 'a8000000-0000-4000-8000-000000000008';
  r1 uuid;
  r2 uuid;
  r3 uuid;
  r4 uuid;
  r5 uuid;
  a jsonb;
  ref_text text;
  i integer;
begin
  perform set_config('request.jwt.claims', '{"sub":"a8000000-0000-4000-8000-000000000008","role":"authenticated"}', true);
  perform public.kronen_einfach_buchen(u, 'bot', 'ki-start', 'sieg');
  update public.liga_mitglieder m set kronen = 100 where m.user_id = u and m.liga = 'online';
  update public.kronen_stand s set kronen = 100 where s.user_id = u;

  -- Beleg 1: sofort -10
  insert into public.suche_warteschlange (user_id, zeit, elo, seit) values (u, public.kronen_konstanten() ->> 'ranked_zeit', 1000, now() - interval '11 seconds');
  r1 := (public.online_suche_ende(true) ->> 'ki_ref')::uuid;
  if r1 is null or (select m.kronen from public.liga_mitglieder m where m.user_id = u and m.liga = 'online') <> 90 then
    raise exception 'FEHLER: Beleg ohne Vorab-Niederlage (%)',
      (select m.kronen from public.liga_mitglieder m where m.user_id = u and m.liga = 'online');
  end if;

  -- Stapeln: Beleg 2 schliesst Beleg 1 (bleibt verloren), Beleg 1 ist nicht mehr einloesbar
  insert into public.suche_warteschlange (user_id, zeit, elo, seit) values (u, public.kronen_konstanten() ->> 'ranked_zeit', 1000, now() - interval '11 seconds');
  r2 := (public.online_suche_ende(true) ->> 'ki_ref')::uuid;
  update public.suche_ki_belege b set erstellt_am = now() - interval '61 seconds' where b.user_id = u;
  a := public.kronen_ki_ergebnis(r1, 'sieg');
  if a->>'fehler' is distinct from 'KRONEN_BELEG'
     or (select count(*) from public.suche_ki_belege b where b.user_id = u and not b.eingeloest) <> 1 then
    raise exception 'FEHLER: Belege lassen sich stapeln (%)', a;
  end if;
  if (select m.kronen from public.liga_mitglieder m where m.user_id = u and m.liga = 'online') <> 80 then
    raise exception 'FEHLER: zwei Belege nicht je -10';
  end if;

  -- zu frueh: Fehler, Beleg bleibt offen, -10 bleibt; danach Sieg: -10 weg, +20 (80 + 30 = 110), delta 20
  update public.suche_ki_belege b set erstellt_am = now() - interval '30 seconds' where b.ref = r2;
  a := public.kronen_ki_ergebnis(r2, 'sieg');
  if a->>'fehler' is distinct from 'KRONEN_ZU_FRUEH'
     or (select m.kronen from public.liga_mitglieder m where m.user_id = u and m.liga = 'online') <> 80 then
    raise exception 'FEHLER: zu fruehe Meldung (%)', a;
  end if;
  update public.suche_ki_belege b set erstellt_am = now() - interval '61 seconds' where b.ref = r2;
  a := public.kronen_ki_ergebnis(r2, 'sieg');
  if (a->>'delta')::int is distinct from 20 or (a->>'kronen')::int is distinct from 110
     or (select b.delta from public.kronen_buchungen b where b.user_id = u and b.quelle = 'ki' and b.ref = r2::text) <> 20 then
    raise exception 'FEHLER: Sieg korrigiert die Vorab-Niederlage nicht (%)', a;
  end if;
  a := public.kronen_ki_ergebnis(r2, 'sieg');
  if a->>'fehler' is distinct from 'KRONEN_BELEG'
     or (select m.kronen from public.liga_mitglieder m where m.user_id = u and m.liga = 'online') <> 110 then
    raise exception 'FEHLER: Sieg doppelt eingeloest (%)', a;
  end if;

  -- Abbruch ohne Meldung: Beleg 3 bleibt bei -10 (110 -> 100), auch nachdem Beleg 4 ihn schliesst (100 -> 90)
  insert into public.suche_warteschlange (user_id, zeit, elo, seit) values (u, public.kronen_konstanten() ->> 'ranked_zeit', 1000, now() - interval '11 seconds');
  r3 := (public.online_suche_ende(true) ->> 'ki_ref')::uuid;
  insert into public.suche_warteschlange (user_id, zeit, elo, seit) values (u, public.kronen_konstanten() ->> 'ranked_zeit', 1000, now() - interval '11 seconds');
  r4 := (public.online_suche_ende(true) ->> 'ki_ref')::uuid;
  if (select m.kronen from public.liga_mitglieder m where m.user_id = u and m.liga = 'online') <> 90
     or (select b.delta from public.kronen_buchungen b where b.user_id = u and b.quelle = 'ki' and b.ref = r3::text)
        is distinct from -10 then
    raise exception 'FEHLER: Abbruch ohne Meldung kostet nichts';
  end if;

  -- Niederlage gemeldet (alte App): nicht doppelt bestraft, bleibt -10 (90)
  update public.suche_ki_belege b set erstellt_am = now() - interval '61 seconds' where b.ref = r4;
  a := public.kronen_ki_ergebnis(r4, 'niederlage');
  if (a->>'delta')::int is distinct from -10 or (a->>'kronen')::int is distinct from 90 then
    raise exception 'FEHLER: Niederlage doppelt bestraft (%)', a;
  end if;

  -- Remis: -10 weg, +5 (90 -> 80 -> 95)
  insert into public.suche_warteschlange (user_id, zeit, elo, seit) values (u, public.kronen_konstanten() ->> 'ranked_zeit', 1000, now() - interval '11 seconds');
  r5 := (public.online_suche_ende(true) ->> 'ki_ref')::uuid;
  update public.suche_ki_belege b set erstellt_am = now() - interval '61 seconds' where b.ref = r5;
  a := public.kronen_ki_ergebnis(r5, 'remis');
  if (a->>'delta')::int is distinct from 5 or (a->>'kronen')::int is distinct from 95 then
    raise exception 'FEHLER: Remis korrigiert nicht sauber (%)', a;
  end if;

  -- Tagesgrenze voll: Beleg ohne Vorab-Buchung, Meldung wie bisher KRONEN_GRENZE, Kronen unveraendert
  for i in 1..20 loop
    insert into public.kronen_buchungen (user_id, quelle, ref, delta, woche)
    values (u, 'ki', 'voll-' || i, 0, public.liga_woche_am(pg_catalog.clock_timestamp()));
  end loop;
  insert into public.suche_warteschlange (user_id, zeit, elo, seit) values (u, public.kronen_konstanten() ->> 'ranked_zeit', 1000, now() - interval '11 seconds');
  ref_text := public.online_suche_ende(true) ->> 'ki_ref';
  update public.suche_ki_belege b set erstellt_am = now() - interval '61 seconds' where b.ref = ref_text::uuid;
  a := public.kronen_ki_ergebnis(ref_text::uuid, 'sieg');
  if a->>'fehler' is distinct from 'KRONEN_GRENZE'
     or exists (select 1 from public.kronen_buchungen b where b.user_id = u and b.ref = ref_text)
     or (select m.kronen from public.liga_mitglieder m where m.user_id = u and m.liga = 'online') <> 95 then
    raise exception 'FEHLER: volle Tagesgrenze (%)', a;
  end if;
end;
$$;

-- ---------- 11. Riegel: keine zweite gewertete Partie, die Suche fuehrt zurueck ----------
-- Befund 11.11.2026 (live 20:09:58 und 20:11:45): dieselben zwei Konten hatten zwei laufende Partien, weil die Suche
-- eine Partie nur 60 s lang erkannte. F und G werden gepaart, die Partie wird kuenstlich 2 Minuten alt; beide suchen
-- erneut und landen in derselben Partie. H wartet, F (Zeile von Hand in der Warteschlange) wird nicht mit H gepaart.
-- Ist F's Uhr abgelaufen, endet die Partie beim Suchen auf Zeit und F wird frei.
insert into auth.users (id, email)
values
  ('f6000000-0000-4000-8000-000000000006', 'ligen-f@example.invalid'),
  ('a7000000-0000-4000-8000-000000000007', 'ligen-g@example.invalid'),
  ('b8000000-0000-4000-8000-000000000008', 'ligen-h@example.invalid');
do $$
declare
  f uuid := 'f6000000-0000-4000-8000-000000000006';
  g uuid := 'a7000000-0000-4000-8000-000000000007';
  h uuid := 'b8000000-0000-4000-8000-000000000008';
  r jsonb;
  p1 uuid;
  p2 uuid;
begin
  perform set_config('request.jwt.claims', '{"sub":"f6000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
  r := public.online_suche_start();
  if not (r->>'wartet')::boolean then
    raise exception 'FEHLER: Riegel: F wartet nicht (%)', r;
  end if;
  perform set_config('request.jwt.claims', '{"sub":"a7000000-0000-4000-8000-000000000007","role":"authenticated"}', true);
  p1 := (public.online_suche_start() ->> 'partie')::uuid;
  if p1 is null then
    raise exception 'FEHLER: Riegel: F und G nicht gepaart';
  end if;
  -- aelter als das alte 60-s-Fenster, Uhr laeuft noch (erst der Beitritt, kein Zug)
  update public.partien_online t set erstellt_am = now() - interval '2 minutes' where t.id = p1;

  -- F steht dabei noch in der Warteschlange (alter App-Stand): die Zeile muss weg
  insert into public.suche_warteschlange (user_id, zeit, elo, seit) values (f, public.kronen_konstanten() ->> 'ranked_zeit', 1000, now());
  perform set_config('request.jwt.claims', '{"sub":"f6000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
  r := public.online_suche_start();
  if (r->>'partie')::uuid is distinct from p1 or exists (select 1 from public.suche_warteschlange q where q.user_id = f) then
    raise exception 'FEHLER: Riegel: F bekommt nicht die laufende Partie zurueck (%)', r;
  end if;
  if (public.online_suche_stand() ->> 'partie')::uuid is distinct from p1 then
    raise exception 'FEHLER: Riegel: online_suche_stand fuehrt F nicht zurueck';
  end if;
  perform set_config('request.jwt.claims', '{"sub":"a7000000-0000-4000-8000-000000000007","role":"authenticated"}', true);
  if (public.online_suche_start() ->> 'partie')::uuid is distinct from p1 then
    raise exception 'FEHLER: Riegel: G bekommt nicht die laufende Partie zurueck';
  end if;
  if (select count(*) from public.partien_online t where t.gewertet and t.status = 'laeuft' and f in (t.weiss, t.schwarz)) <> 1 then
    raise exception 'FEHLER: Riegel: zwei laufende gewertete Partien fuer F';
  end if;
  -- "Jetzt gegen KI" waehrend einer laufenden Partie gibt keinen Beleg
  insert into public.suche_warteschlange (user_id, zeit, elo, seit) values (g, public.kronen_konstanten() ->> 'ranked_zeit', 1000, now());
  if public.online_suche_ende(true) <> '{}'::jsonb then
    raise exception 'FEHLER: Riegel: KI-Beleg trotz laufender Partie';
  end if;

  -- F steht (z. B. aus einem alten App-Stand) in der Warteschlange: H wird nicht mit F gepaart
  insert into public.suche_warteschlange (user_id, zeit, elo, seit) values (f, public.kronen_konstanten() ->> 'ranked_zeit', 1000, now());
  perform public.kronen_stand_sichern(h);
  perform set_config('request.jwt.claims', '{"sub":"b8000000-0000-4000-8000-000000000008","role":"authenticated"}', true);
  r := public.online_suche_start();
  if not coalesce((r->>'wartet')::boolean, false) then
    raise exception 'FEHLER: Riegel: H mit F gepaart, obwohl F spielt (%)', r;
  end if;
  -- F's Paarung bringt F in seine Partie zurueck und nimmt die Zeile aus der Warteschlange, H wartet weiter
  r := to_jsonb(public.online_suche_paaren(f));
  if (r #>> '{}')::uuid is distinct from p1 then
    raise exception 'FEHLER: Riegel: online_suche_paaren fuer F gibt nicht die laufende Partie (% statt %)', r, p1;
  end if;
  if exists (select 1 from public.suche_warteschlange q where q.user_id = f) then
    raise exception 'FEHLER: Riegel: F bleibt trotz laufender Partie in der Warteschlange';
  end if;
  if not exists (select 1 from public.suche_warteschlange q where q.user_id = h) then
    raise exception 'FEHLER: Riegel: H wartet nicht mehr';
  end if;

  -- F ist am Zug und seine Uhr ist abgelaufen: die Suche beendet die Partie auf Zeit, F wird frei und trifft H
  update public.partien_online t
  set zuege = 'e2e4 e7e5', am_zug = case when t.weiss = f then 'w' else 'b' end, uhr_weiss_ms = 1000, uhr_schwarz_ms = 1000,
      letzter_zug_am = now() - interval '1 hour'
  where t.id = p1;
  perform set_config('request.jwt.claims', '{"sub":"f6000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
  p2 := (public.online_suche_start() ->> 'partie')::uuid;
  if p2 is null or p2 = p1 or h not in (select x from public.partien_online t, unnest(array[t.weiss, t.schwarz]) x where t.id = p2) then
    raise exception 'FEHLER: Riegel: nach Zeitablauf keine neue Partie mit H (%)', p2;
  end if;
  if (select t.status || '/' || t.grund from public.partien_online t where t.id = p1) is distinct from 'beendet/zeit' then
    raise exception 'FEHLER: Riegel: abgelaufene Partie nicht auf Zeit beendet';
  end if;
  perform set_config('ligen_test.p1', p1::text, true);
  perform set_config('ligen_test.p2', p2::text, true);

  -- haengende Partie (Uhr laeuft noch nicht, 11 Minuten kein Zug): die Suche bricht sie ab, G wird frei
  insert into public.partien_online (erstellt_von, fen, bedenkzeit_s, inkrement_s) values (g, 'x', 300, 3)
  returning id into p1;
  update public.partien_online t
  set weiss = g, schwarz = 'c9000000-0000-4000-8000-000000000009', gewertet = true, status = 'laeuft',
      letzter_zug_am = now() - interval '11 minutes'
  where t.id = p1;
  perform set_config('request.jwt.claims', '{"sub":"a7000000-0000-4000-8000-000000000007","role":"authenticated"}', true);
  r := public.online_suche_start();
  if r ? 'partie' or (select t.status || '/' || t.grund from public.partien_online t where t.id = p1) is distinct from 'beendet/abgebrochen' then
    raise exception 'FEHLER: Riegel: haengende Partie sperrt G (%)', r;
  end if;
  delete from public.suche_warteschlange q where q.user_id = g;
end;
$$;

-- ---------- 12. Live-Bewertung: 1 Partie je Tag ohne Premium, je Partie einmal, Rechte ----------
-- F spielt P2 (laeuft), P1 ist beendet. P3 ist eine zweite laufende gewertete Partie von F (von Hand angelegt, die Suche
-- legt sie nach Abschnitt 11 nie an), damit die Grenze pruefbar ist.
do $$
declare
  p3 uuid;
begin
  insert into public.partien_online (erstellt_von, fen, bedenkzeit_s, inkrement_s)
  values ('a7000000-0000-4000-8000-000000000007', 'x', 300, 3)
  returning id into p3;
  update public.partien_online t
  set weiss = 'f6000000-0000-4000-8000-000000000006', schwarz = 'a7000000-0000-4000-8000-000000000007', gewertet = true,
      status = 'laeuft', letzter_zug_am = clock_timestamp()
  where t.id = p3;
  perform set_config('ligen_test.p3', p3::text, true);
end;
$$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f6000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
do $$
declare
  p1 uuid := current_setting('ligen_test.p1')::uuid;
  p2 uuid := current_setting('ligen_test.p2')::uuid;
  p3 uuid := current_setting('ligen_test.p3')::uuid;
  r jsonb;
begin
  r := public.online_live_bewertung_frei();
  if r <> '{"frei": true, "rest": 1, "unbegrenzt": false}'::jsonb then
    raise exception 'FEHLER: Kontingent: Anfang falsch (%)', r;
  end if;
  r := public.online_live_bewertung_nutzen(p2);
  if r <> '{"ok": true, "frei": true, "rest": 0, "unbegrenzt": false, "gebucht": true}'::jsonb then
    raise exception 'FEHLER: Kontingent: erste Partie nicht gebucht (%)', r;
  end if;
  r := public.online_live_bewertung_nutzen(p2);
  if r <> '{"ok": true, "frei": true, "rest": 0, "unbegrenzt": false, "gebucht": true}'::jsonb then
    raise exception 'FEHLER: Kontingent: dieselbe Partie zaehlt doppelt (%)', r;
  end if;
  r := public.online_live_bewertung_frei();
  if (r->>'frei')::boolean or (r->>'rest')::int <> 0 then
    raise exception 'FEHLER: Kontingent: nach einer Partie noch frei (%)', r;
  end if;
  if not (public.online_live_bewertung_frei(p2) ->> 'frei')::boolean then
    raise exception 'FEHLER: Kontingent: gebuchte Partie nach Neuladen gesperrt';
  end if;
  r := public.online_live_bewertung_nutzen(p3);
  if r <> '{"ok": false, "frei": false, "rest": 0, "unbegrenzt": false, "gebucht": false}'::jsonb then
    raise exception 'FEHLER: Kontingent: zweite Partie am selben Tag frei (%)', r;
  end if;
  begin
    perform public.online_live_bewertung_nutzen(gen_random_uuid());
    raise exception 'FEHLER: Kontingent: unbekannte Partie angenommen';
  exception when others then
    if sqlerrm <> 'KRONEN_EINGABE' then raise; end if;
  end;
  begin
    perform public.online_live_bewertung_nutzen(p1);
    raise exception 'FEHLER: Kontingent: beendete Partie gebucht';
  exception when others then
    if sqlerrm <> 'ONLINE_PARTIE_BEENDET' then raise; end if;
  end;
  begin
    perform 1 from public.live_bewertung_nutzung;
    raise exception 'FEHLER: Kontingent: live_bewertung_nutzung lesbar';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.live_bewertung_unbegrenzt('f6000000-0000-4000-8000-000000000006');
    raise exception 'FEHLER: Kontingent: live_bewertung_unbegrenzt fuer Nutzer offen';
  exception when insufficient_privilege then null;
  end;
end;
$$;
-- fremde Partie: H spielt P3 nicht
select set_config('request.jwt.claims', '{"sub":"b8000000-0000-4000-8000-000000000008","role":"authenticated"}', true);
do $$
begin
  perform public.online_live_bewertung_nutzen(current_setting('ligen_test.p3')::uuid);
  raise exception 'FEHLER: Kontingent: fremde Partie gebucht';
exception when others then
  if sqlerrm <> 'KRONEN_EINGABE' then raise; end if;
end;
$$;
reset role;
-- naechster Kalendertag: die Buchung von gestern zaehlt nicht mehr
do $$
declare
  r jsonb;
begin
  -- der Tag ist der Berliner Kalendertag
  if (select b.tag from public.live_bewertung_nutzung b where b.partie = current_setting('ligen_test.p2')::uuid)
     is distinct from (now() at time zone 'Europe/Berlin')::date then
    raise exception 'FEHLER: Kontingent: Tag nicht nach Europe/Berlin';
  end if;
  update public.live_bewertung_nutzung b set tag = tag - 1 where b.user_id = 'f6000000-0000-4000-8000-000000000006';
  -- eine Zeile von vor 5 Tagen wird beim naechsten Buchen weggeraeumt
  insert into public.live_bewertung_nutzung (user_id, partie, tag)
  values ('f6000000-0000-4000-8000-000000000006', gen_random_uuid(), (now() at time zone 'Europe/Berlin')::date - 5);
  perform set_config('request.jwt.claims', '{"sub":"f6000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
  r := public.online_live_bewertung_nutzen(current_setting('ligen_test.p3')::uuid);
  if r <> '{"ok": true, "frei": true, "rest": 0, "unbegrenzt": false, "gebucht": true}'::jsonb then
    raise exception 'FEHLER: Kontingent: neuer Tag gibt keine neue Partie frei (%)', r;
  end if;
  if exists (select 1 from public.live_bewertung_nutzung b
             where b.user_id = 'f6000000-0000-4000-8000-000000000006' and b.tag < (now() at time zone 'Europe/Berlin')::date - 3) then
    raise exception 'FEHLER: Kontingent: alte Zeilen bleiben liegen';
  end if;
  -- Premium (nur wenn abo-schema.sql eingespielt ist): unbegrenzt, ohne Buchung
  if to_regclass('public.abos') is not null then
    insert into public.abos (user_id, status, gueltig_bis, quelle)
    values ('f6000000-0000-4000-8000-000000000006', 'aktiv', now() + interval '30 days', 'manuell')
    on conflict (user_id) do update set status = 'aktiv', gueltig_bis = excluded.gueltig_bis;
    r := public.online_live_bewertung_frei();
    if r <> '{"frei": true, "rest": null, "unbegrenzt": true}'::jsonb then
      raise exception 'FEHLER: Kontingent: Premium nicht unbegrenzt (%)', r;
    end if;
    r := public.online_live_bewertung_nutzen(current_setting('ligen_test.p2')::uuid);
    if r <> '{"ok": true, "frei": true, "rest": null, "unbegrenzt": true, "gebucht": false}'::jsonb then
      raise exception 'FEHLER: Kontingent: Premium-Nutzung falsch (%)', r;
    end if;
    update public.abos a set status = 'abgelaufen', gueltig_bis = now() - interval '1 day'
    where a.user_id = 'f6000000-0000-4000-8000-000000000006';
    if (public.online_live_bewertung_frei() ->> 'unbegrenzt')::boolean then
      raise exception 'FEHLER: Kontingent: abgelaufenes Abo noch unbegrenzt';
    end if;
  end if;
end;
$$;
set local role anon;
do $$
begin
  perform public.online_live_bewertung_frei();
  raise exception 'FEHLER: anon darf online_live_bewertung_frei';
exception when insufficient_privilege then null;
end;
$$;
reset role;
do $$
begin
  if has_function_privilege('service_role', 'public.online_live_bewertung_nutzen(uuid)', 'execute')
     or has_function_privilege('service_role', 'public.live_bewertung_unbegrenzt(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.online_live_bewertung_frei(uuid)', 'execute') then
    raise exception 'FEHLER: Kontingent: Rechte nicht nur fuer authenticated';
  end if;
end;
$$;

rollback;

-- Prueft supabase/zwei-ligen-schema.sql im Supabase SQL Editor (als Besitzer). Alles wird am Ende zurueckgerollt.
-- Voraussetzung: online-, kronen-, raetsel-duell- (mit raetsel-duell-daten.sql) und zwei-ligen-schema.sql eingespielt.
-- Jeder Fehler bricht mit "FEHLER: ..." ab; ohne Fehler endet der Lauf mit ROLLBACK.
-- Abschnitte: 1 neuer Stand je Liga, Rechte; 2 Trennung der Kronen nach Quelle; 3 Start der Raetsel-Liga; 4 KI-Deckel je
-- Liga; 5 Ranked-Zeit und Antwort der Suche; 6 Paarung nur nach Reihenfolge (grosser Elo-Abstand wird gepaart, die
-- naechste Elo zuerst), online und Raetsel; 7 "Jetzt gegen KI" erst ab ki_frueh_s; 8 Wochen-Abrechnung je Liga;
-- 9 Raetsel-Elo aendert sich durch ein gewertetes Duell, die Online-Elo nicht.
begin;

insert into auth.users (id, email)
values
  ('a1000000-0000-4000-8000-000000000001', 'ligen-a@example.invalid'),
  ('b2000000-0000-4000-8000-000000000002', 'ligen-b@example.invalid'),
  ('c3000000-0000-4000-8000-000000000003', 'ligen-c@example.invalid'),
  ('d4000000-0000-4000-8000-000000000004', 'ligen-d@example.invalid'),
  ('e5000000-0000-4000-8000-000000000005', 'ligen-e@example.invalid');

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
     or (g->'bot_ki'->>'max')::int <> 300 or jsonb_typeof(g->'offen') <> 'array' then
    raise exception 'FEHLER: Raetsel-Gruppe ohne Buchung falsch (%)', g;
  end if;
  if public.kronen_mein_stand() ? 'liga' or public.liga_meine_gruppe() ? 'liga' then
    raise exception 'FEHLER: alte Aufrufe haben das neue Feld liga';
  end if;
  if k->>'ranked_zeit' <> '5+3' or (k->>'mensch_warte_s')::int <> 30 or (k->>'ki_frueh_s')::int <> 10
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
  if exists (select 1 from public.liga_mitglieder) then
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
  -- Online-Deckel voll (300 aus KI-Gegnern)
  insert into public.kronen_buchungen (user_id, quelle, ref, delta, woche)
  values (d, 'ki', 'voll-1', 300, public.liga_woche_am(clock_timestamp()));
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
  if not (r->>'wartet')::boolean or r->>'zeit' <> '5+3' or (r->>'warte_s')::int <> 30 or (r->>'ki_ab_s')::int <> 10
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
  if (select q.zeit from public.suche_warteschlange q where q.user_id = 'b2000000-0000-4000-8000-000000000002') <> '5+3' then
    raise exception 'FEHLER: Warteschlange nicht in der Ranked-Zeit';
  end if;
end;
$$;

-- ---------- 6. Paarung: grosser Elo-Abstand wird gepaart, naechste Elo zuerst ----------
-- B wartet mit Elo 2800 (gesetzt), E sucht mit Elo 400 ohne Zeitangabe: sofort eine gewertete Partie in 5+3
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
  if p.id is null or p.bedenkzeit_s <> 300 or p.inkrement_s <> 3
     or 'b2000000-0000-4000-8000-000000000002' not in (p.weiss, p.schwarz) then
    raise exception 'FEHLER: gepaarte Partie falsch (%)', to_jsonb(p);
  end if;
  if exists (select 1 from public.suche_warteschlange) then
    raise exception 'FEHLER: Warteschlange nach der Paarung nicht leer';
  end if;
end;
$$;

-- naechste Elo zuerst: C (1777) und D (1000) warten, A (Elo 1700) sucht und bekommt C, obwohl D laenger wartet
do $$
begin
  insert into public.suche_warteschlange (user_id, zeit, elo, seit) values
    ('d4000000-0000-4000-8000-000000000004', '5+3', 1000, now() - interval '20 seconds'),
    ('c3000000-0000-4000-8000-000000000003', '5+3', 1777, now() - interval '5 seconds');
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
  delete from public.suche_warteschlange;
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
  if not (r->>'wartet')::boolean or (r->>'warte_s')::int <> 30 or (r->>'ki_ab_s')::int <> 10 or r->>'seit' is null then
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
do $$
begin
  insert into public.suche_warteschlange (user_id, zeit, elo, seit) values
    ('d4000000-0000-4000-8000-000000000004', '5+3', 1000, now() - interval '5 seconds');
  insert into public.duell_warteschlange (user_id, elo, seit) values
    ('d4000000-0000-4000-8000-000000000004', 1000, now() - interval '5 seconds');
end;
$$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d4000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$
begin
  if public.online_suche_ende(true) <> '{}'::jsonb or public.duell_suche_ende(true) <> '{}'::jsonb then
    raise exception 'FEHLER: KI vor ki_frueh_s gewertet';
  end if;
end;
$$;
reset role;
do $$
begin
  insert into public.suche_warteschlange (user_id, zeit, elo, seit) values
    ('d4000000-0000-4000-8000-000000000004', '5+3', 1000, now() - interval '11 seconds');
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

rollback;

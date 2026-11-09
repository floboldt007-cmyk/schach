-- Prueft supabase/raetsel-duell-schema.sql im Supabase SQL Editor (als Besitzer, wie dort ueblich), nach dem Einspielen
-- von online-schema.sql, kronen-schema.sql, raetsel-duell-schema.sql und raetsel-duell-daten.sql. Alles wird am Ende
-- zurueckgerollt. Drei kurzlebige Nutzer: A, B und C. Jeder Fehler bricht mit "FEHLER: ..." ab.
-- Abschnitte: 1 Rechte; 2 Raetsel-Folge; 3 KI-Verlauf; 4 Gegnersuche und Stand; 5 Zuege (richtig, mehrzuegig, falsch,
-- veraltet, Zeit); 6 Auswertung und Kronen; 7 ohne Zug keine Kronen; 8 Paar-Grenze; 9 KI-Gegner; 10 Freundschaft;
-- 11 Start-Liga nach einem Duell; 12 Fremde sehen nichts; 13 Gnadenfrist, Auswertung ohne Abfrage, Grenzen fuer
-- Einladungen und Codes; 14 Server-Lauf (pg_cron) ohne Aufruf des Spielers.
-- Die Uhr steht in einer Transaktion still (now() ist der Beginn): die Testhilfen schieben deshalb Startzeit und
-- Wartezeit zurueck, statt zu warten.
begin;

insert into auth.users (id, email)
values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'duell-a@example.invalid'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'duell-b@example.invalid'),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'duell-c@example.invalid');

-- Testhilfen (nur in dieser Sitzung, laufen als Besitzer)
create function pg_temp.zurueck(d uuid, s integer)
returns void language sql security definer set search_path = '' as $$
  update public.duelle set start_am = start_am - make_interval(secs => s), erstellt_am = erstellt_am - make_interval(secs => s)
  where id = d;
  update public.duell_spieler set letzter_zug_am = letzter_zug_am - make_interval(secs => s) where duell = d;
$$;
create function pg_temp.warte(uid uuid, s integer)
returns void language sql security definer set search_path = '' as $$
  update public.duell_warteschlange set seit = seit - make_interval(secs => s) where user_id = uid;
$$;
create function pg_temp.loesung(d uuid, i integer)
returns text[] language sql stable security definer set search_path = '' as $$
  select r.loesung from public.duell_raetsel r where r.id = (select x.raetsel[i + 1] from public.duelle x where x.id = d);
$$;
create function pg_temp.start(d uuid)
returns timestamptz language sql stable security definer set search_path = '' as $$
  select x.start_am from public.duelle x where x.id = d;
$$;
-- ein Zug, wie ihn die Edge Function verbucht (Service-Rolle), Ankunft s Sekunden nach dem Start
create function pg_temp.zug(uid uuid, d uuid, i integer, sch integer, richtig boolean, fertig boolean, s numeric)
returns jsonb language sql security definer set search_path = '' as $$
  select public.duell_zug_verbuchen(uid, d, i, sch, richtig, fertig, pg_temp.start(d) + make_interval(secs => s));
$$;
create function pg_temp.kronen(uid uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce((select s.kronen from public.kronen_stand s where s.user_id = uid), 0);
$$;
create function pg_temp.buchungen(uid uuid, q text)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.kronen_buchungen b where b.user_id = uid and b.quelle = q;
$$;
-- Duell direkt anlegen (wie die Gegnersuche es tut), fuer die Abschnitte ab 6
create function pg_temp.duell(a uuid, b uuid)
returns uuid language sql security definer set search_path = '' as $$
  select public.duell_anlegen('gewertet', a, b, null);
$$;
revoke all on function pg_temp.zurueck(uuid, integer), pg_temp.warte(uuid, integer), pg_temp.loesung(uuid, integer),
  pg_temp.start(uuid), pg_temp.zug(uuid, uuid, integer, integer, boolean, boolean, numeric), pg_temp.kronen(uuid),
  pg_temp.buchungen(uuid, text), pg_temp.duell(uuid, uuid) from public;
grant execute on function pg_temp.zurueck(uuid, integer), pg_temp.warte(uuid, integer), pg_temp.loesung(uuid, integer),
  pg_temp.start(uuid), pg_temp.kronen(uuid), pg_temp.buchungen(uuid, text) to authenticated, service_role;

-- ---------- 1. Rechte ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}', true);
do $$
begin
  begin
    perform 1 from public.duell_raetsel limit 1;
    raise exception 'FEHLER: Nutzer lesen duell_raetsel';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.duelle limit 1;
    raise exception 'FEHLER: Nutzer lesen duelle';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.duell_spieler limit 1;
    raise exception 'FEHLER: Nutzer lesen duell_spieler';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.duell_warteschlange limit 1;
    raise exception 'FEHLER: Nutzer lesen duell_warteschlange';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.duell_zug_verbuchen('dddddddd-dddd-4ddd-8ddd-dddddddddddd', gen_random_uuid(), 0, 0, true, true, now());
    raise exception 'FEHLER: Nutzer duerfen Zuege verbuchen';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.duell_zug_lage('dddddddd-dddd-4ddd-8ddd-dddddddddddd', gen_random_uuid());
    raise exception 'FEHLER: Nutzer sehen die Lage mit Loesung';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.duell_auswerten(gen_random_uuid());
    raise exception 'FEHLER: Nutzer duerfen auswerten';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.duell_anlegen('gewertet', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', null);
    raise exception 'FEHLER: Nutzer duerfen Duelle direkt anlegen';
  exception when insufficient_privilege then null;
  end;
  if (public.duell_konstanten()->>'dauer_s')::int <> 180 or (public.duell_konstanten()->>'strafe_s')::int <> 5 then
    raise exception 'FEHLER: Konstanten (3 Minuten, 5 s Abzug) falsch: %', public.duell_konstanten();
  end if;
end;
$$;
reset role;
set local role anon;
do $$
begin
  begin
    perform public.duell_stand(gen_random_uuid());
    raise exception 'FEHLER: anon darf duell_stand';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.duell_suche_start();
    raise exception 'FEHLER: anon darf suchen';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- ---------- 2. Raetsel-Folge ----------
do $$
declare
  f1 text[] := public.duell_folge('probe-1');
  f2 text[] := public.duell_folge('probe-1');
  f3 text[] := public.duell_folge('probe-2');
  r integer[];
begin
  if f1 is distinct from f2 then
    raise exception 'FEHLER: gleiche Saat, andere Folge';
  end if;
  if f1 = f3 then
    raise exception 'FEHLER: andere Saat, gleiche Folge';
  end if;
  if coalesce(array_length(f1, 1), 0) <> 50 or (select count(distinct x) from unnest(f1) x) <> 50 then
    raise exception 'FEHLER: Folge hat nicht 50 verschiedene Raetsel (%)', array_length(f1, 1);
  end if;
  select array_agg(d.rating order by u.n) into r
  from unnest(f1) with ordinality u(id, n) join public.duell_raetsel d on d.id = u.id;
  if r[1] > 700 or r[50] < 2300 or r[25] <= r[5] or r[45] <= r[25] then
    raise exception 'FEHLER: Folge wird nicht schwerer: %', r;
  end if;
end;
$$;

-- ---------- 3. KI-Verlauf ----------
do $$
declare
  rat integer[] := (select array_agg(d.rating order by u.n) from unnest(public.duell_folge('probe-1')) with ordinality u(id, n)
                    join public.duell_raetsel d on d.id = u.id);
  null_s jsonb := public.duell_ki_verlauf('probe-1', 1200, rat, 0);
  halb jsonb := public.duell_ki_verlauf('probe-1', 1200, rat, 90);
  voll jsonb := public.duell_ki_verlauf('probe-1', 1200, rat, 180);
  nochmal jsonb := public.duell_ki_verlauf('probe-1', 1200, rat, 180);
  stark jsonb := public.duell_ki_verlauf('probe-1', 2200, rat, 180);
  schwach jsonb := public.duell_ki_verlauf('probe-1', 500, rat, 180);
begin
  if (null_s->>'geloest')::int <> 0 or (null_s->>'fehler')::int <> 0 then
    raise exception 'FEHLER: KI hat bei 0 s schon etwas: %', null_s;
  end if;
  if voll is distinct from nochmal then
    raise exception 'FEHLER: KI-Verlauf nicht wiederholbar';
  end if;
  if (halb->>'geloest')::int > (voll->>'geloest')::int or (halb->>'fehler')::int > (voll->>'fehler')::int then
    raise exception 'FEHLER: KI-Verlauf geht rueckwaerts: % / %', halb, voll;
  end if;
  if (voll->>'geloest')::int < 3 or (voll->>'geloest')::int > 45 then
    raise exception 'FEHLER: KI 1200 loest in 3 Minuten unplausibel viel oder wenig: %', voll;
  end if;
  if (stark->>'geloest')::int <= (schwach->>'geloest')::int then
    raise exception 'FEHLER: starke KI loest nicht mehr als schwache: % / %', stark, schwach;
  end if;
end;
$$;

-- ---------- 4. Gegnersuche und Stand ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}', true);
do $$
declare
  r jsonb := public.duell_suche_start();
begin
  if r is distinct from '{"wartet": true}'::jsonb then
    raise exception 'FEHLER: erste Suche wartet nicht: %', r;
  end if;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","role":"authenticated"}', true);
create temp table t_duell as select (public.duell_suche_start()->>'duell')::uuid as id;
grant select on t_duell to authenticated, service_role;
do $$
declare
  d uuid := (select id from t_duell);
  s jsonb;
begin
  if d is null then
    raise exception 'FEHLER: zwei Suchende mit gleicher Elo werden nicht gepaart';
  end if;
  s := public.duell_stand(d);
  if s->>'art' <> 'gewertet' or s->>'status' <> 'laeuft' or (s->'gegner'->>'ki')::boolean then
    raise exception 'FEHLER: Stand nach der Paarung falsch: %', s;
  end if;
  -- vor dem Start (3 s Vorlauf) noch kein Raetsel
  if s ? 'raetsel' and s->'raetsel' <> 'null'::jsonb then
    raise exception 'FEHLER: Raetsel schon vor dem Start sichtbar: %', s;
  end if;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}', true);
do $$
declare
  d uuid := (select id from t_duell);
  s jsonb;
begin
  if (public.duell_suche_stand()->>'duell')::uuid is distinct from d then
    raise exception 'FEHLER: A erfaehrt die Paarung nicht';
  end if;
  perform pg_temp.zurueck(d, 10);
  s := public.duell_stand(d);
  if s->'raetsel'->>'fen' is null or (s->'raetsel'->>'nr')::int <> 1 or jsonb_array_length(s->'raetsel'->'bisher') <> 0 then
    raise exception 'FEHLER: nach dem Start kein erstes Raetsel: %', s;
  end if;
  if s::text ~* 'loesung|seed' then
    raise exception 'FEHLER: Stand verraet Loesung oder Saat: %', s;
  end if;
  if (s->'ich'->>'geloest')::int <> 0 or s->'ich'->>'ende_am' is null or s->>'jetzt' is null then
    raise exception 'FEHLER: eigener Stand unvollstaendig: %', s;
  end if;
end;
$$;
reset role;

-- ---------- 5. Zuege ----------
set local role service_role;
do $$
declare
  a uuid := 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  d uuid := (select id from t_duell);
  l jsonb := public.duell_zug_lage(a, d);
  r jsonb;
  ende_vorher timestamptz;
begin
  if l->>'fen' is null or jsonb_typeof(l->'loesung') <> 'array' or (l->>'idx')::int <> 0 or (l->>'schritt')::int <> 0 then
    raise exception 'FEHLER: Lage fuer die Edge Function falsch: %', l;
  end if;
  ende_vorher := (l->>'ende_am')::timestamptz;
  -- Raetsel 1 richtig und fertig
  r := public.duell_zug_verbuchen(a, d, 0, 0, true, true, pg_temp.start(d) + interval '4 seconds');
  if (r->>'geloest')::int <> 1 or (r->>'idx')::int <> 1 or (r->>'schritt')::int <> 0 or r->'naechstes'->>'fen' is null
     or (r->'naechstes'->>'nr')::int <> 2 then
    raise exception 'FEHLER: richtiger Zug falsch verbucht: %', r;
  end if;
  -- derselbe Zug noch einmal (alter Stand): abgelehnt
  begin
    perform public.duell_zug_verbuchen(a, d, 0, 0, true, true, pg_temp.start(d) + interval '5 seconds');
    raise exception 'FEHLER: veralteter Stand angenommen';
  exception when raise_exception then
    if sqlerrm <> 'DUELL_STAND_VERALTET' then raise; end if;
  end;
  -- Raetsel 2: ein richtiger Zwischenzug (mehrzuegig), dann falsch
  r := public.duell_zug_verbuchen(a, d, 1, 0, true, false, pg_temp.start(d) + interval '8 seconds');
  if (r->>'schritt')::int <> 2 or (r->>'idx')::int <> 1 or (r->>'geloest')::int <> 1 then
    raise exception 'FEHLER: Zwischenzug falsch verbucht: %', r;
  end if;
  r := public.duell_zug_verbuchen(a, d, 1, 2, false, false, pg_temp.start(d) + interval '10 seconds');
  if (r->>'fehler')::int <> 1 or (r->>'idx')::int <> 2 or (r->>'schritt')::int <> 0
     or (r->>'ende_am')::timestamptz <> ende_vorher - interval '5 seconds' then
    raise exception 'FEHLER: falscher Zug kostet nicht 5 s und fuehrt nicht zum naechsten Raetsel: %', r;
  end if;
  -- Ankunft nach dem eigenen Ende (180 - 5 = 175 s): abgelehnt; dafuer die Uhr 170 s weiter
  perform pg_temp.zurueck(d, 170);
  begin
    perform public.duell_zug_verbuchen(a, d, 2, 0, true, true, pg_temp.start(d) + interval '176 seconds');
    raise exception 'FEHLER: Zug nach dem eigenen Ende angenommen';
  exception when raise_exception then
    if sqlerrm <> 'DUELL_ZEIT_UM' then raise; end if;
  end;
  -- eine Ankunft vor dem letzten Zug zaehlt als Zeit des letzten Zugs (keine Zeitreise)
  r := public.duell_zug_verbuchen(a, d, 2, 0, true, true, pg_temp.start(d) + interval '1 second');
  if (r->>'geloest')::int <> 2 then
    raise exception 'FEHLER: dritter Zug nicht verbucht: %', r;
  end if;
  -- B: ein richtiger Zug
  r := public.duell_zug_verbuchen('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', d, 0, 0, true, true, pg_temp.start(d) + interval '6 seconds');
  if (r->>'geloest')::int <> 1 then
    raise exception 'FEHLER: Zug von B nicht verbucht: %', r;
  end if;
  -- Fremde koennen nicht ziehen
  begin
    perform public.duell_zug_verbuchen('ffffffff-ffff-4fff-8fff-ffffffffffff', d, 0, 0, true, true, pg_temp.start(d) + interval '6 seconds');
    raise exception 'FEHLER: Fremder zieht';
  exception when raise_exception then
    if sqlerrm <> 'DUELL_UNBEKANNT' then raise; end if;
  end;
end;
$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","role":"authenticated"}', true);
do $$
declare
  s jsonb := public.duell_stand((select id from t_duell));
begin
  -- B sieht den Stand von A live
  if (s->'gegner'->>'geloest')::int <> 2 or (s->'gegner'->>'fehler')::int <> 1 or (s->'ich'->>'geloest')::int <> 1 then
    raise exception 'FEHLER: Stand des Gegners nicht live: %', s;
  end if;
end;
$$;
reset role;

-- ---------- 6. Auswertung und Kronen ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}', true);
do $$
declare
  d uuid := (select id from t_duell);
  s jsonb;
begin
  perform pg_temp.zurueck(d, 180);
  s := public.duell_stand(d);
  if s->>'status' <> 'beendet' or s->>'ergebnis' <> 'sieg' or (s->>'kronen_delta')::int <> 30 then
    raise exception 'FEHLER: A gewinnt 2 zu 1 nicht mit +30: %', s;
  end if;
  if s ? 'raetsel' and s->'raetsel' <> 'null'::jsonb then
    raise exception 'FEHLER: nach dem Ende noch ein Raetsel: %', s;
  end if;
  s := public.duell_stand(d);
  if pg_temp.kronen('dddddddd-dddd-4ddd-8ddd-dddddddddddd') <> 30 or pg_temp.buchungen('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'duell') <> 1 then
    raise exception 'FEHLER: Kronen nicht genau einmal gebucht';
  end if;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","role":"authenticated"}', true);
do $$
declare
  s jsonb := public.duell_stand((select id from t_duell));
begin
  -- B verliert; mit 0 Kronen haelt der Boden (Buchung mit 0)
  if s->>'ergebnis' <> 'niederlage' or (s->>'kronen_delta')::int <> 0 or pg_temp.buchungen('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'duell') <> 1 then
    raise exception 'FEHLER: Niederlage von B falsch: %', s;
  end if;
end;
$$;
reset role;

-- ---------- 7. Ohne einen einzigen Zug keine Kronen (fuer beide) ----------
do $$
declare
  d uuid := pg_temp.duell('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  vorher integer := pg_temp.buchungen('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'duell');
begin
  -- vor dem Start (3 s Vorlauf) zaehlt kein Zug
  begin
    perform pg_temp.zug('dddddddd-dddd-4ddd-8ddd-dddddddddddd', d, 0, 0, true, true, 0);
    raise exception 'FEHLER: Zug vor dem Start angenommen';
  exception when raise_exception then
    if sqlerrm <> 'DUELL_NICHT_GESTARTET' then raise; end if;
  end;
  perform pg_temp.zurueck(d, 10);
  perform pg_temp.zug('dddddddd-dddd-4ddd-8ddd-dddddddddddd', d, 0, 0, true, true, 5);
  perform pg_temp.zurueck(d, 180);
  perform public.duell_auswerten(d);
  if (select status from public.duelle where id = d) <> 'beendet' or (select ergebnis from public.duelle where id = d) <> 'a' then
    raise exception 'FEHLER: Duell ohne Zug von B nicht als Sieg von A beendet';
  end if;
  if pg_temp.buchungen('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'duell') <> vorher then
    raise exception 'FEHLER: Kronen gebucht, obwohl B keinen Zug gemacht hat';
  end if;
end;
$$;

-- ---------- 8. Paar-Grenze: hoechstens 3 gewertete Duelle am Tag gegen dieselbe Person ----------
do $$
declare
  d uuid;
  i integer;
begin
  -- Duell 1 aus Abschnitt 6 zaehlt schon; zwei weitere werden gebucht, das vierte nicht
  for i in 1..3 loop
    d := pg_temp.duell('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
    perform pg_temp.zurueck(d, 10);
    perform pg_temp.zug('dddddddd-dddd-4ddd-8ddd-dddddddddddd', d, 0, 0, true, true, 5);
    perform pg_temp.zug('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', d, 0, 0, false, false, 5);
    perform pg_temp.zurueck(d, 180);
    perform public.duell_auswerten(d);
  end loop;
  if pg_temp.buchungen('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'duell') <> 3 then
    raise exception 'FEHLER: Paar-Grenze 3 haelt nicht (% Buchungen)', pg_temp.buchungen('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'duell');
  end if;
  -- auch das vierte Duell ist ausgewertet (A gewinnt), nur ohne Kronen
  if (select ergebnis from public.duelle where id = d) <> 'a' then
    raise exception 'FEHLER: bei 1 zu 0 nicht A';
  end if;
end;
$$;
-- Gleichstand in geloest und Fehlern: Remis (zwischen A und C, eigene Paar-Grenze)
do $$
declare
  d uuid := pg_temp.duell('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'ffffffff-ffff-4fff-8fff-ffffffffffff');
  k integer := pg_temp.kronen('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
begin
  perform pg_temp.zurueck(d, 10);
  perform pg_temp.zug('dddddddd-dddd-4ddd-8ddd-dddddddddddd', d, 0, 0, true, true, 5);
  perform pg_temp.zug('ffffffff-ffff-4fff-8fff-ffffffffffff', d, 0, 0, true, true, 7);
  perform pg_temp.zurueck(d, 180);
  perform public.duell_auswerten(d);
  if (select ergebnis from public.duelle where id = d) <> 'remis' or pg_temp.kronen('dddddddd-dddd-4ddd-8ddd-dddddddddddd') <> k + 10 then
    raise exception 'FEHLER: Gleichstand ist kein Remis mit +10';
  end if;
end;
$$;

-- ---------- 9. KI-Gegner nach 10 s Suche ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ffffffff-ffff-4fff-8fff-ffffffffffff","role":"authenticated"}', true);
do $$
declare
  r jsonb;
begin
  perform public.duell_suche_start();
  -- zu frueh: keine KI, Suche beendet
  r := public.duell_suche_ende(true);
  if r ? 'duell' then
    raise exception 'FEHLER: KI-Duell vor 10 s: %', r;
  end if;
end;
$$;
create temp table t_ki (id uuid);
grant select, insert on t_ki to authenticated;
do $$
declare
  r jsonb;
  s jsonb;
begin
  perform public.duell_suche_start();
  perform pg_temp.warte('ffffffff-ffff-4fff-8fff-ffffffffffff', 11);
  r := public.duell_suche_ende(true);
  if not (r ? 'duell') then
    raise exception 'FEHLER: nach 10 s kein KI-Duell: %', r;
  end if;
  insert into t_ki values ((r->>'duell')::uuid);
  s := public.duell_stand((r->>'duell')::uuid);
  if s->>'art' <> 'ki' or not (s->'gegner'->>'ki')::boolean or (s->'gegner'->>'elo')::int is null then
    raise exception 'FEHLER: KI-Duell nicht als KI-Gegner gekennzeichnet: %', s;
  end if;
  -- der Stand der KI waechst mit der Serverzeit
  perform pg_temp.zurueck((r->>'duell')::uuid, 120);
  s := public.duell_stand((r->>'duell')::uuid);
  if (s->'gegner'->>'geloest')::int + (s->'gegner'->>'fehler')::int < 1 then
    raise exception 'FEHLER: KI-Gegner nach 2 Minuten ohne ein einziges Raetsel: %', s;
  end if;
end;
$$;
reset role;
do $$
declare
  d uuid := (select id from t_ki);
  vorher integer := pg_temp.kronen('ffffffff-ffff-4fff-8fff-ffffffffffff');
  erg text;
  soll integer;
begin
  perform pg_temp.zug('ffffffff-ffff-4fff-8fff-ffffffffffff', d, 0, 0, true, true, 100);
  perform pg_temp.zurueck(d, 180);
  perform public.duell_auswerten(d);
  if pg_temp.buchungen('ffffffff-ffff-4fff-8fff-ffffffffffff', 'duell_ki') <> 1 then
    raise exception 'FEHLER: KI-Duell nicht als duell_ki gebucht';
  end if;
  erg := (select ergebnis from public.duelle where id = d);
  soll := case erg when 'a' then 20 when 'remis' then 5 else -10 end; -- nie unter 0 (Boden der ersten Stufe)
  if pg_temp.kronen('ffffffff-ffff-4fff-8fff-ffffffffffff') <> greatest(0, vorher + soll) then
    raise exception 'FEHLER: KI-Kronen falsch (%, % -> %)', erg, vorher, pg_temp.kronen('ffffffff-ffff-4fff-8fff-ffffffffffff');
  end if;
  -- Tagesgrenze 20: mit 20 KI-Duell-Buchungen heute keine weitere
  insert into public.kronen_buchungen (user_id, quelle, ref, delta, woche)
  select 'ffffffff-ffff-4fff-8fff-ffffffffffff', 'duell_ki', 'probe-' || g, 0, public.liga_woche_heute() from generate_series(1, 19) g;
  d := public.duell_anlegen('ki', 'ffffffff-ffff-4fff-8fff-ffffffffffff', null, 1000);
  perform pg_temp.zurueck(d, 10);
  perform pg_temp.zug('ffffffff-ffff-4fff-8fff-ffffffffffff', d, 0, 0, true, true, 5);
  perform pg_temp.zurueck(d, 180);
  perform public.duell_auswerten(d);
  if pg_temp.buchungen('ffffffff-ffff-4fff-8fff-ffffffffffff', 'duell_ki') <> 20 then
    raise exception 'FEHLER: Tagesgrenze 20 fuer KI-Duelle haelt nicht';
  end if;
end;
$$;

-- ---------- 10. Freundschaft per Code ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}', true);
create temp table t_freund (id uuid, code text);
grant select, insert on t_freund to authenticated;
do $$
declare
  r jsonb := public.duell_einladen();
begin
  if r->>'code' !~ '^[A-HJ-NP-Z2-9]{6}$' or r->>'duell' is null then
    raise exception 'FEHLER: Einladung ohne gueltigen Code: %', r;
  end if;
  insert into t_freund values ((r->>'duell')::uuid, r->>'code');
  if public.duell_stand((r->>'duell')::uuid)->>'status' <> 'offen' then
    raise exception 'FEHLER: Einladung nicht offen';
  end if;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","role":"authenticated"}', true);
do $$
declare
  c text := (select code from t_freund);
  r jsonb;
begin
  r := public.duell_beitreten(lower(substr(c, 1, 3)) || '-' || substr(c, 4));
  if (r->>'duell')::uuid is distinct from (select id from t_freund) then
    raise exception 'FEHLER: Beitritt mit klein geschriebenem Code und Bindestrich klappt nicht: %', r;
  end if;
  if public.duell_stand((r->>'duell')::uuid)->>'status' <> 'laeuft' then
    raise exception 'FEHLER: Freundschafts-Duell laeuft nach dem Beitritt nicht';
  end if;
  if public.duell_beitreten('ZZZZZZ') is distinct from '{"fehler": "DUELL_CODE"}'::jsonb then
    raise exception 'FEHLER: falscher Code nicht abgelehnt';
  end if;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"ffffffff-ffff-4fff-8fff-ffffffffffff","role":"authenticated"}', true);
do $$
begin
  if public.duell_beitreten((select code from t_freund)) is distinct from '{"fehler": "DUELL_CODE"}'::jsonb then
    raise exception 'FEHLER: ein Dritter tritt einem vergebenen Duell bei';
  end if;
end;
$$;
reset role;
do $$
declare
  d uuid := (select id from t_freund);
  ka integer := pg_temp.buchungen('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'duell');
begin
  perform pg_temp.zurueck(d, 10);
  perform pg_temp.zug('dddddddd-dddd-4ddd-8ddd-dddddddddddd', d, 0, 0, true, true, 5);
  perform pg_temp.zug('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', d, 0, 0, false, false, 5);
  perform pg_temp.zurueck(d, 180);
  perform public.duell_auswerten(d);
  if (select status from public.duelle where id = d) <> 'beendet' or pg_temp.buchungen('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'duell') <> ka then
    raise exception 'FEHLER: Freundschafts-Duell bucht Kronen';
  end if;
end;
$$;

-- ---------- 11. Start-Liga ist nach einem Duell vorbei (sonst ueberschriebe sie die Duell-Kronen) ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}', true);
do $$
begin
  if public.kronen_start(1800) is distinct from '{"fehler": "KRONEN_START_VORBEI"}'::jsonb then
    raise exception 'FEHLER: kronen_start nach einem gebuchten Duell nicht vorbei';
  end if;
end;
$$;

-- ---------- 12. Fremde sehen nichts ----------
select set_config('request.jwt.claims', '{"sub":"ffffffff-ffff-4fff-8fff-ffffffffffff","role":"authenticated"}', true);
do $$
begin
  if public.duell_stand((select id from t_duell)) is distinct from '{"fehler": "DUELL_UNBEKANNT"}'::jsonb then
    raise exception 'FEHLER: Fremder sieht ein Duell';
  end if;
end;
$$;
reset role;

-- ---------- 13. Gnadenfrist, Auswertung ohne Abfrage, Grenzen fuer Einladungen und Codes ----------
-- (Pruefer-Befunde vom 07.11.2026: Wer nach einem verlorenen KI-Duell nie mehr abfragt, darf der Niederlage nicht
-- entgehen; ein Zug, der vor dem Ende ankam, darf nicht an einer gleichzeitigen Auswertung scheitern.)
create temp table t_gnade (id uuid);
grant select, insert on t_gnade to authenticated;
do $$
declare
  b uuid := 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  d uuid := public.duell_anlegen('ki', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', null, 3000);
  r jsonb;
begin
  insert into t_gnade values (d);
  perform pg_temp.zurueck(d, 10);
  -- B macht einen falschen Zug (eigenes Ende damit 175 s), die starke KI loest viel
  perform pg_temp.zug(b, d, 0, 0, false, false, 5);
  -- Uhr bis kurz nach beiden Enden (KI 180 s, B 175 s), aber noch in der Gnadenfrist von 3 s
  perform pg_temp.zurueck(d, 174);
  perform public.duell_auswerten(d);
  if (select status from public.duelle where id = d) <> 'laeuft' then
    raise exception 'FEHLER: in der Gnadenfrist schon ausgewertet';
  end if;
  -- ein Zug, der bei 174 s ankam (vor dem eigenen Ende 175 s), wird jetzt noch verbucht
  r := pg_temp.zug(b, d, 1, 0, false, false, 174);
  if (r->>'fehler')::int <> 2 then
    raise exception 'FEHLER: rechtzeitig angekommener Zug in der Gnadenfrist verworfen: %', r;
  end if;
  -- Gnadenfrist vorbei; B fragt NICHT ab
  perform pg_temp.zurueck(d, 5);
  if (select status from public.duelle where id = d) <> 'laeuft' or pg_temp.buchungen(b, 'duell_ki') <> 0 then
    raise exception 'FEHLER: Ausgangslage fuer die Auswertung ohne Abfrage stimmt nicht';
  end if;
end;
$$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","role":"authenticated"}', true);
do $$
begin
  -- die naechste Suche wertet das liegen gelassene Duell zuerst aus
  perform public.duell_suche_start();
  perform public.duell_suche_ende(false);
end;
$$;
reset role;
-- geprueft direkt in der Tabelle (duell_stand wertet selbst aus und taugt hier nicht als Beleg)
do $$
begin
  if (select status from public.duelle where id = (select id from t_gnade)) <> 'beendet' then
    raise exception 'FEHLER: liegen gelassenes KI-Duell nicht beendet';
  end if;
  if pg_temp.buchungen('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'duell_ki') <> 1 then
    raise exception 'FEHLER: Niederlage im liegen gelassenen KI-Duell nicht gebucht';
  end if;
end;
$$;
-- ein zweites liegen gelassenes Duell, diesmal ohne jede Abfrage nur ueber duell_einladen ausgewertet
create temp table t_gnade2 (id uuid);
grant select, insert on t_gnade2 to authenticated;
do $$
declare
  d uuid := public.duell_anlegen('ki', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', null, 3000);
begin
  insert into t_gnade2 values (d);
  perform pg_temp.zurueck(d, 10);
  perform pg_temp.zug('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', d, 0, 0, false, false, 5);
  perform pg_temp.zurueck(d, 190);
end;
$$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","role":"authenticated"}', true);
do $$
begin
  perform public.duell_einladen();
end;
$$;
reset role;
do $$
begin
  if (select status from public.duelle where id = (select id from t_gnade2)) <> 'beendet'
     or pg_temp.buchungen('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'duell_ki') <> 2 then
    raise exception 'FEHLER: duell_einladen wertet liegen gelassene Duelle nicht aus';
  end if;
end;
$$;
-- Grenzen: hoechstens 5 offene Einladungen, hoechstens 20 falsche Codes am Tag (danach auch ein richtiger nicht)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}', true);
create temp table t_code (code text);
grant select, insert on t_code to authenticated;
do $$
begin
  insert into t_code values (public.duell_einladen()->>'code');
end;
$$;
select set_config('request.jwt.claims', '{"sub":"ffffffff-ffff-4fff-8fff-ffffffffffff","role":"authenticated"}', true);
do $$
declare
  i integer;
  r jsonb;
begin
  for i in 1..5 loop
    r := public.duell_einladen();
    if not (r ? 'code') then
      raise exception 'FEHLER: Einladung % von 5 abgelehnt: %', i, r;
    end if;
  end loop;
  if public.duell_einladen() is distinct from '{"fehler": "DUELL_ZU_VIELE_EINLADUNGEN"}'::jsonb then
    raise exception 'FEHLER: sechste offene Einladung angenommen';
  end if;
  -- C hat in Abschnitt 10 schon einen falschen Code verbraucht: bis 20 weiter "DUELL_CODE", dann gesperrt
  for i in 2..20 loop
    if public.duell_beitreten('ZZZZZZ') is distinct from '{"fehler": "DUELL_CODE"}'::jsonb then
      raise exception 'FEHLER: falscher Code % nicht als DUELL_CODE abgelehnt', i;
    end if;
  end loop;
  if public.duell_beitreten('ZZZZZZ') is distinct from '{"fehler": "DUELL_ZU_VIELE_VERSUCHE"}'::jsonb
     or public.duell_beitreten((select code from t_code)) is distinct from '{"fehler": "DUELL_ZU_VIELE_VERSUCHE"}'::jsonb then
    raise exception 'FEHLER: nach 20 falschen Codes nicht gesperrt';
  end if;
end;
$$;
reset role;

-- ---------- 14. Server-Lauf (pg_cron) wertet liegen gelassene Duelle ohne jeden Aufruf des Spielers aus ----------
create temp table t_cron (id uuid, jung uuid);
do $$
declare
  d uuid := public.duell_anlegen('ki', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', null, 3000);
  j uuid := public.duell_anlegen('ki', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', null, 3000);
  n integer;
begin
  insert into t_cron values (d, j);
  perform pg_temp.zurueck(d, 10);
  perform pg_temp.zug('dddddddd-dddd-4ddd-8ddd-dddddddddddd', d, 0, 0, false, false, 5);
  perform pg_temp.zurueck(d, 190);
  -- das zweite Duell laeuft noch (gerade gestartet): bleibt unberuehrt
  perform pg_temp.zurueck(j, 10);
  n := public.duell_alle_faelligen_auswerten();
  -- direkt in der Tabelle geprueft (Lehre: duell_stand wertet selbst aus und taugt nicht als Beleg)
  if (select status from public.duelle where id = d) <> 'beendet' then
    raise exception 'FEHLER: Server-Lauf wertet ein liegen gelassenes Duell nicht aus';
  end if;
  if (select status from public.duelle where id = j) <> 'laeuft' then
    raise exception 'FEHLER: Server-Lauf beendet ein laufendes Duell';
  end if;
  if n < 1 then
    raise exception 'FEHLER: Server-Lauf meldet keine Auswertung (%)', n;
  end if;
  -- ein zweiter Lauf aendert nichts mehr (wiederholbar)
  if public.duell_alle_faelligen_auswerten() <> 0 then
    raise exception 'FEHLER: zweiter Server-Lauf wertet erneut aus';
  end if;
end;
$$;
-- nur der Server darf ihn aufrufen
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.duell_alle_faelligen_auswerten();
    raise exception 'FEHLER: Nutzer rufen den Server-Lauf auf';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

rollback;

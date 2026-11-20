-- EINSPIELEN (Flo, nie Claude): Supabase SQL Editor, diese ganze Datei ausfuehren (wiederholbar), DANACH
--   supabase/zwei-ligen-rls-test.sql: kein "FEHLER:", Ende mit ROLLBACK.
--   Rueckweg: supabase/raetsel-duell-ki-sofort-zurueck.sql.
--   Reihenfolge: nach zwei-ligen-schema.sql (dessen duell_auswerten gilt live seit 11.11.2026 und ist hier die Grundlage).
--   Laeuft zwei-ligen-schema.sql oder raetsel-duell-schema.sql spaeter noch einmal, danach diese Datei erneut einspielen,
--   sonst gilt wieder das Warten auf die vollen 180 s.
--
-- Raetsel-Duell gegen die KI wertet sofort aus (R26 AC-05, Flo 20.11.2026): bisher endete ein KI-Duell erst, wenn die
-- KI ihre vollen 180 s "zu Ende gespielt" hatte, auch wenn der Spieler laengst fertig war (Fehler kuerzen seine Zeit um
-- je 5 s, oder alle Raetsel waren durch). Jetzt endet es, sobald der Spieler fertig ist (alle Raetsel durch: sofort, es
-- kommt kein Zug mehr) oder seine eigene Zeit samt Gnadenfrist um ist. Das Ergebnis bleibt dasselbe wie bisher: die KI
-- behaelt ihre vollen 180 s, ihr Verlauf ist rein gerechnet (duell_ki_verlauf, ohne Uhr) und steht deshalb sofort fest.
-- Bewusst NICHT "die KI zaehlt nur mit der Zeit des Spielers": dann koennte ein fuehrender Spieler mit absichtlichen
-- Fehlern (je 5 s) seine Uhr und damit die KI anhalten und so den Sieg samt Kronen festhalten.
-- Ersetzt: duell_auswerten (Fassung aus zwei-ligen-schema.sql, nur die Wartebedingung im KI-Zweig neu),
-- duell_faellige_auswerten und duell_alle_faelligen_auswerten (Fassungen aus raetsel-duell-schema.sql). Neu: ein Helfer.
-- duell_stand bleibt, wie es ist (es zeigt nach dem Ende schon den Verlauf der vollen 180 s). Gewertete Duelle und
-- Freundschaften bleiben unveraendert.

-- Schluss eines Spielers: alle Raetsel durch -> sein letzter Zug (hoechstens sein Ende), sonst sein eigenes Ende
-- (Start + 180 s - 5 s je Fehler)
create or replace function public.duell_spieler_schluss(d public.duelle, s public.duell_spieler)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select case when s.idx >= cardinality(d.raetsel)
              then least(coalesce(s.letzter_zug_am, d.start_am), public.duell_ende_am(d.start_am, d.dauer_s, s.fehler))
              else public.duell_ende_am(d.start_am, d.dauer_s, s.fehler) end;
$$;

-- Duell auswerten (wie zwei-ligen-schema.sql); Kronen gehen ueber kronen_einfach_buchen in die Raetsel-Liga, ein
-- gewertetes Duell gegen einen Menschen aendert zusaetzlich die Raetsel-Elo beider (Elo vor der Buchung gelesen).
create or replace function public.duell_auswerten(duell uuid)
returns public.duelle
language plpgsql
security definer
set search_path = ''
as $$
declare
  k jsonb := public.duell_konstanten();
  d public.duelle;
  sa public.duell_spieler;
  sb public.duell_spieler;
  ki jsonb;
  ga integer;
  gb integer;
  fa integer;
  fb integer;
  erg text;
  paar integer;
  elo_a integer;
  elo_b integer;
  pa numeric;
  ba integer;
  bb integer;
  gnade interval := make_interval(secs => (k->>'gnade_s')::integer);
begin
  select * into d from public.duelle x where x.id = duell_auswerten.duell for update;
  if d.id is null or d.status <> 'laeuft' then
    return d;
  end if;
  select * into sa from public.duell_spieler s where s.duell = d.id and s.user_id = d.a for update;
  if d.art = 'ki' then
    -- R26 AC-05: fertig ist das Duell, sobald der Spieler fertig ist (alle Raetsel durch: sofort) oder seine eigene Zeit
    -- samt Gnadenfrist um ist; die KI zaehlt weiter mit den vollen 180 s (gerechnet, ohne Uhr: steht sofort fest)
    ki := public.duell_ki_verlauf(d.seed, d.ki_elo, public.duell_ratings(d), d.dauer_s);
    gb := (ki->>'geloest')::integer;
    fb := (ki->>'fehler')::integer;
    -- die Klammer ist noetig: PL/pgSQL beendet die Bedingung sonst am ersten "then" (dem im case)
    if now() < public.duell_spieler_schluss(d, sa)
               + (case when sa.idx >= cardinality(d.raetsel) then interval '0 seconds' else gnade end) then
      return d;
    end if;
  else
    select * into sb from public.duell_spieler s where s.duell = d.id and s.user_id = d.b for update;
    gb := sb.geloest;
    fb := sb.fehler;
    if now() < public.duell_ende_am(d.start_am, d.dauer_s, sa.fehler) + gnade
       or now() < public.duell_ende_am(d.start_am, d.dauer_s, sb.fehler) + gnade then
      return d;
    end if;
  end if;
  ga := sa.geloest;
  fa := sa.fehler;
  erg := case when ga > gb then 'a' when gb > ga then 'b' when fa < fb then 'a' when fb < fa then 'b' else 'remis' end;
  update public.duelle x set status = 'beendet', ergebnis = erg where x.id = d.id returning * into d;
  if d.art = 'freundschaft' then
    return d;
  end if;
  if sa.zuege = 0 or (d.art = 'gewertet' and sb.zuege = 0) then
    return d;
  end if;
  if d.art = 'ki' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('kronen-melden:' || d.a::text));
    if public.kronen_heute_anzahl(d.a, 'duell_ki') < (k->>'ki_tagesgrenze')::integer then
      perform public.kronen_einfach_buchen(d.a, 'duell_ki', d.id::text,
        case erg when 'a' then 'sieg' when 'b' then 'niederlage' else 'remis' end);
    end if;
    return d;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('kronen-melden:' || least(d.a, d.b)::text));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('kronen-melden:' || greatest(d.a, d.b)::text));
  select count(*)::integer into paar from public.kronen_buchungen kb
  join public.duelle x on x.id::text = kb.ref
  where kb.user_id = d.a and kb.quelle = 'duell' and x.id <> d.id and d.b in (x.a, x.b)
    and kb.am >= (public.kronen_heute()::timestamp at time zone 'Europe/Berlin');
  if paar >= (k->>'paar_tagesgrenze')::integer then
    return d;
  end if;
  -- Staende in fester Reihenfolge (kleinere ID zuerst) anlegen und sperren, Elo vor der Buchung lesen
  if d.a < d.b then
    elo_a := (public.raetsel_stand_sichern(d.a)).elo;
    elo_b := (public.raetsel_stand_sichern(d.b)).elo;
  else
    elo_b := (public.raetsel_stand_sichern(d.b)).elo;
    elo_a := (public.raetsel_stand_sichern(d.a)).elo;
  end if;
  pa := case erg when 'a' then 1 when 'b' then 0 else 0.5 end;
  select count(*)::integer into ba from public.kronen_buchungen kb where kb.user_id = d.a and kb.quelle = 'duell' and kb.ref = d.id::text;
  select count(*)::integer into bb from public.kronen_buchungen kb where kb.user_id = d.b and kb.quelle = 'duell' and kb.ref = d.id::text;
  perform public.kronen_einfach_buchen(d.a, 'duell', d.id::text,
    case erg when 'a' then 'sieg' when 'b' then 'niederlage' else 'remis' end);
  perform public.kronen_einfach_buchen(d.b, 'duell', d.id::text,
    case erg when 'b' then 'sieg' when 'a' then 'niederlage' else 'remis' end);
  -- Elo nur bei einer neuen Buchung (je Duell und Konto einmal)
  if ba = 0 then
    perform public.raetsel_elo_buchen(d.a, pa, elo_b);
  end if;
  if bb = 0 then
    perform public.raetsel_elo_buchen(d.b, 1 - pa, elo_a);
  end if;
  return d;
end;
$$;

-- Wertet alle laufenden Duelle eines Kontos aus, deren Zeit samt Gnadenfrist um ist (wie raetsel-duell-schema.sql).
-- KI-Duelle immer mit: ob der Spieler fertig ist, prueft duell_auswerten selbst (R26 AC-05).
create or replace function public.duell_faellige_auswerten(uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k jsonb := public.duell_konstanten();
  x uuid;
begin
  for x in
    select d.id from public.duelle d
    where d.status = 'laeuft' and uid in (d.a, d.b)
      and (d.start_am + make_interval(secs => d.dauer_s + (k->>'gnade_s')::integer) <= now()
           or (d.art = 'ki' and d.start_am <= now()))
    order by d.start_am
  loop
    perform public.duell_auswerten(x);
  end loop;
end;
$$;

-- Server-Lauf ueber ALLE Konten (pg_cron alle 10 Minuten, wie raetsel-duell-schema.sql). KI-Duelle immer mit, ob der
-- Spieler fertig ist, prueft duell_auswerten selbst (R26 AC-05). Antwort: Zahl der dabei beendeten Duelle.
create or replace function public.duell_alle_faelligen_auswerten()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  k jsonb := public.duell_konstanten();
  x uuid;
  n integer := 0;
begin
  for x in
    select d.id from public.duelle d
    where d.status = 'laeuft'
      and (d.start_am + make_interval(secs => d.dauer_s + (k->>'gnade_s')::integer) <= now()
           or (d.art = 'ki' and d.start_am <= now()))
    order by d.start_am
    limit 500
  loop
    if (public.duell_auswerten(x)).status = 'beendet' then
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

-- ---------- Rechte (wie bisher; der Helfer nur intern) ----------
revoke all on function public.duell_spieler_schluss(public.duelle, public.duell_spieler) from public, anon, authenticated;
revoke all on function public.duell_auswerten(uuid) from public, anon, authenticated;
revoke all on function public.duell_faellige_auswerten(uuid) from public, anon, authenticated, service_role;
revoke all on function public.duell_alle_faelligen_auswerten() from public, anon, authenticated, service_role;

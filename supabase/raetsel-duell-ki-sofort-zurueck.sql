-- Rueckweg fuer supabase/raetsel-duell-ki-sofort-schema.sql (R26 AC-05): stellt die Fassungen davor wieder her, also
-- duell_auswerten aus zwei-ligen-schema.sql und duell_stand, duell_faellige_auswerten, duell_alle_faelligen_auswerten
-- aus raetsel-duell-schema.sql (wortgleich kopiert), und entfernt die zwei Helfer. KI-Duelle warten danach wieder bis
-- zum Ende der vollen 180 s samt Gnadenfrist. Schon beendete Duelle bleiben, wie sie sind. Im SQL Editor ausfuehren;
-- wiederholbar.

-- aus zwei-ligen-schema.sql
-- Duell auswerten (wie raetsel-duell-schema.sql); Kronen gehen ueber kronen_einfach_buchen in die Raetsel-Liga, ein
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
    ki := public.duell_ki_verlauf(d.seed, d.ki_elo, public.duell_ratings(d), d.dauer_s);
    gb := (ki->>'geloest')::integer;
    fb := (ki->>'fehler')::integer;
    if now() < d.start_am + make_interval(secs => d.dauer_s) + gnade
       or now() < public.duell_ende_am(d.start_am, d.dauer_s, sa.fehler) + gnade then
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

-- aus raetsel-duell-schema.sql
-- Wertet alle laufenden Duelle eines Kontos aus, deren Zeit samt Gnadenfrist um ist. Laeuft am Anfang jeder Suche,
-- Einladung und jedes Beitritts: Wer ein verlorenes Duell liegen laesst und nie mehr abfragt, entgeht der Niederlage
-- damit nicht, sobald er das naechste Duell will (Pruefer-Befund 07.11.2026).
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
      and d.start_am + make_interval(secs => d.dauer_s + (k->>'gnade_s')::integer) <= now()
    order by d.start_am
  loop
    perform public.duell_auswerten(x);
  end loop;
end;
$$;

-- Server-Lauf ueber ALLE Konten (pg_cron alle 10 Minuten, siehe Ende der Datei): wertet jedes laufende Duell aus,
-- dessen Zeit samt Gnadenfrist um ist. So entgeht niemand einer Niederlage, nur weil er nie wieder abfragt oder
-- spielt (Flo, 07.11.2026). Antwort: Zahl der dabei beendeten Duelle. Nur fuer den Besitzer (pg_cron), nie fuer Nutzer.
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
      and d.start_am + make_interval(secs => d.dauer_s + (k->>'gnade_s')::integer) <= now()
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

-- Stand eines Duells fuer einen Teilnehmer (Abfrage alle 1 s). Wertet aus, sobald beide Zeiten um sind.
-- Antwort { duell, art, status, jetzt, start_am, ich, gegner, raetsel, ergebnis, kronen_delta } oder
-- { fehler: 'DUELL_UNBEKANNT' }. ergebnis aus eigener Sicht: 'sieg' | 'remis' | 'niederlage'.
create or replace function public.duell_stand(duell uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  d public.duelle;
  ich public.duell_spieler;
  er public.duell_spieler;
  gegner jsonb;
  ki jsonb;
  erg text;
  delta integer;
  rae jsonb;
begin
  if uid is null then
    raise exception 'DUELL_ANMELDUNG';
  end if;
  select * into d from public.duelle x where x.id = duell_stand.duell;
  if d.id is null or uid not in (d.a, coalesce(d.b, d.a)) then
    return jsonb_build_object('fehler', 'DUELL_UNBEKANNT');
  end if;
  -- auswerten prueft selbst, ob beide Zeiten um sind
  if d.status = 'laeuft' and now() >= d.start_am then
    d := public.duell_auswerten(d.id);
  end if;
  select * into ich from public.duell_spieler s where s.duell = d.id and s.user_id = uid;
  if d.art = 'ki' then
    ki := case when d.status = 'beendet'
               then public.duell_ki_verlauf(d.seed, d.ki_elo, public.duell_ratings(d), d.dauer_s)
               when d.start_am is null or now() < d.start_am then '{"geloest": 0, "fehler": 0}'::jsonb
               else public.duell_ki_jetzt(d) end;
    gegner := public.duell_spieler_json((ki->>'geloest')::integer, (ki->>'fehler')::integer,
                public.duell_ende_am(d.start_am, d.dauer_s, (ki->>'fehler')::integer))
              || jsonb_build_object('ki', true, 'elo', d.ki_elo);
  else
    select * into er from public.duell_spieler s where s.duell = d.id and s.user_id <> uid;
    gegner := case when er.user_id is null then null
                   else public.duell_spieler_json(er.geloest, er.fehler, public.duell_ende_am(d.start_am, d.dauer_s, er.fehler))
                        || jsonb_build_object('ki', false) end;
  end if;
  if d.status = 'laeuft' and now() >= d.start_am and now() < public.duell_ende_am(d.start_am, d.dauer_s, ich.fehler) then
    rae := public.duell_raetsel_anzeige(d, ich);
  end if;
  if d.status = 'beendet' then
    erg := case when d.ergebnis = 'remis' then 'remis'
                when (d.ergebnis = 'a') = (uid = d.a) then 'sieg' else 'niederlage' end;
    delta := coalesce((select kb.delta from public.kronen_buchungen kb
                       where kb.user_id = uid and kb.quelle in ('duell', 'duell_ki') and kb.ref = d.id::text), 0);
  end if;
  return jsonb_build_object(
    'duell', d.id, 'art', d.art, 'status', d.status, 'jetzt', now(), 'start_am', d.start_am, 'dauer_s', d.dauer_s,
    'code', case when d.status = 'offen' then d.code end,
    'ich', public.duell_spieler_json(ich.geloest, ich.fehler, public.duell_ende_am(d.start_am, d.dauer_s, ich.fehler)),
    'gegner', gegner, 'raetsel', rae, 'ergebnis', erg, 'kronen_delta', delta);
end;
$$;

-- ---------- Rechte (wie in den Herkunftsdateien) ----------
revoke all on function public.duell_auswerten(uuid) from public, anon, authenticated;
revoke all on function public.duell_faellige_auswerten(uuid) from public, anon, authenticated, service_role;
revoke all on function public.duell_alle_faelligen_auswerten() from public, anon, authenticated, service_role;
revoke all on function public.duell_stand(uuid) from public, anon, authenticated;
grant execute on function public.duell_stand(uuid) to authenticated;

-- die Helfer zuletzt: die alten Fassungen rufen sie nicht mehr
drop function if exists public.duell_ki_sekunden(public.duelle, public.duell_spieler);
drop function if exists public.duell_spieler_schluss(public.duelle, public.duell_spieler);

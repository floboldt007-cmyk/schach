-- Rueckweg fuer supabase/raetsel-duell-ki-sofort-schema.sql (R26 AC-05): stellt die Fassungen davor wieder her, also
-- duell_auswerten aus zwei-ligen-schema.sql und duell_faellige_auswerten, duell_alle_faelligen_auswerten aus
-- raetsel-duell-schema.sql (wortgleich kopiert), und entfernt den Helfer duell_spieler_schluss. KI-Duelle warten danach
-- wieder bis zum Ende der vollen 180 s samt Gnadenfrist. Schon beendete Duelle bleiben, wie sie sind. Im SQL Editor
-- ausfuehren; wiederholbar.
-- R27 Sofort-Ende (22.11.2026): stellt zusaetzlich duell_stand und duell_zug_verbuchen aus raetsel-duell-schema.sql
-- wortgleich wieder her und entfernt duell_ich_fertig und den Helfer duell_spieler_offen_bis. Duelle gegen Menschen
-- warten danach wieder bis zum Ende beider Uhren + gnade_s. Die App ruft duell_ich_fertig nur als Versuch: fehlt die
-- RPC, spielt sie wie bisher. Die Spalte duell_spieler.fertig_am bleibt stehen (siehe Ende der Datei).

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

-- aus raetsel-duell-schema.sql (R27 Sofort-Ende zurueck: ohne fertig_am)
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

-- aus raetsel-duell-schema.sql (R27 Sofort-Ende zurueck: Zuege nach dem Fertig-Melden zaehlen wieder)

-- Verbucht einen geprueften Zug. idx_vorher/schritt_vorher = Stand, auf dem die Edge Function geprueft hat (sonst
-- DUELL_STAND_VERALTET). richtig + fertig = Raetsel geloest; richtig ohne fertig = Zwischenzug (schritt + 2, die Antwort
-- des Gegners steht danach in bisher); falsch = Fehler, 5 s Abzug, naechstes Raetsel. ankunft misst die Edge Function;
-- sie wird auf [letzter Zug bzw. Start, jetzt] begrenzt. Antwort { idx, schritt, geloest, fehler, ende_am, naechstes }.
-- Fehler (raise): DUELL_UNBEKANNT, DUELL_BEENDET, DUELL_NICHT_GESTARTET, DUELL_ZEIT_UM, DUELL_FERTIG, DUELL_STAND_VERALTET.
create or replace function public.duell_zug_verbuchen(nutzer uuid, duell uuid, idx_vorher integer, schritt_vorher integer,
  richtig boolean, fertig boolean, ankunft timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.duelle;
  s public.duell_spieler;
  zeit timestamptz;
begin
  -- for share: eine gleichzeitige Auswertung (for update) wartet, bis dieser Zug verbucht ist, und umgekehrt
  select * into d from public.duelle x where x.id = duell_zug_verbuchen.duell for share;
  select * into s from public.duell_spieler x where x.duell = duell_zug_verbuchen.duell and x.user_id = nutzer for update;
  if d.id is null or s.user_id is null then
    raise exception 'DUELL_UNBEKANNT';
  end if;
  if d.status <> 'laeuft' then
    raise exception 'DUELL_BEENDET';
  end if;
  if now() < d.start_am then
    raise exception 'DUELL_NICHT_GESTARTET';
  end if;
  zeit := least(greatest(coalesce(ankunft, now()), coalesce(s.letzter_zug_am, d.start_am)), now());
  if zeit >= public.duell_ende_am(d.start_am, d.dauer_s, s.fehler) then
    raise exception 'DUELL_ZEIT_UM';
  end if;
  if s.idx >= cardinality(d.raetsel) then
    raise exception 'DUELL_FERTIG';
  end if;
  if s.idx <> idx_vorher or s.schritt <> schritt_vorher then
    raise exception 'DUELL_STAND_VERALTET';
  end if;
  if richtig and not fertig then
    update public.duell_spieler x set schritt = x.schritt + 2, zuege = x.zuege + 1, letzter_zug_am = zeit
    where x.duell = s.duell and x.user_id = s.user_id returning * into s;
  else
    update public.duell_spieler x
    set idx = x.idx + 1, schritt = 0, zuege = x.zuege + 1, letzter_zug_am = zeit,
        geloest = x.geloest + case when richtig then 1 else 0 end,
        fehler = x.fehler + case when richtig then 0 else 1 end
    where x.duell = s.duell and x.user_id = s.user_id returning * into s;
  end if;
  return jsonb_build_object('idx', s.idx, 'schritt', s.schritt, 'geloest', s.geloest, 'fehler', s.fehler,
    'ende_am', public.duell_ende_am(d.start_am, d.dauer_s, s.fehler),
    'naechstes', public.duell_raetsel_anzeige(d, s));
end;
$$;

-- ---------- Rechte (wie in den Herkunftsdateien) ----------
revoke all on function public.duell_auswerten(uuid) from public, anon, authenticated;
revoke all on function public.duell_faellige_auswerten(uuid) from public, anon, authenticated, service_role;
revoke all on function public.duell_alle_faelligen_auswerten() from public, anon, authenticated, service_role;

revoke all on function public.duell_stand(uuid) from public, anon, authenticated;
grant execute on function public.duell_stand(uuid) to authenticated;
revoke all on function public.duell_zug_verbuchen(uuid, uuid, integer, integer, boolean, boolean, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.duell_zug_verbuchen(uuid, uuid, integer, integer, boolean, boolean, timestamptz) to service_role;

-- R27: die RPC zuerst (die App faellt ohne sie auf das Warten zurueck), dann die Helfer; die alten Fassungen rufen sie
-- nicht mehr. Die Spalte duell_spieler.fertig_am bleibt stehen (additiv, keine alte Fassung liest sie; ein erneutes
-- Vorwaerts nimmt sie wieder auf). Wer sie trotzdem entfernen will: alter table public.duell_spieler drop column fertig_am.
drop function if exists public.duell_ich_fertig(uuid);
drop function if exists public.duell_spieler_offen_bis(public.duelle, public.duell_spieler, interval);
drop function if exists public.duell_spieler_schluss(public.duelle, public.duell_spieler);

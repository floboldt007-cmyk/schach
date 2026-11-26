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
-- kommt kein Zug mehr) oder seine eigene Zeit samt 15 s Nachfrist fuer spaet verbuchte Zuege um ist (hoechstens bis
-- 180 s + gnade_s wie bisher). Das Ergebnis bleibt dasselbe wie bisher: die KI
-- behaelt ihre vollen 180 s, ihr Verlauf ist rein gerechnet (duell_ki_verlauf, ohne Uhr) und steht deshalb sofort fest.
-- Bewusst NICHT "die KI zaehlt nur mit der Zeit des Spielers": dann koennte ein fuehrender Spieler mit absichtlichen
-- Fehlern (je 5 s) seine Uhr und damit die KI anhalten und so den Sieg samt Kronen festhalten.
-- Ersetzt: duell_auswerten (Fassung aus zwei-ligen-schema.sql, nur die Wartebedingung im KI-Zweig neu),
-- duell_faellige_auswerten und duell_alle_faelligen_auswerten (Fassungen aus raetsel-duell-schema.sql). Neu: ein Helfer.
-- duell_stand zeigt nach dem Ende schon den Verlauf der vollen 180 s.
--
-- R27 Sofort-Ende auch gegen Menschen (Flo 22.11.2026): wer fertig ist (alle Raetsel durch, Zeit um oder selbst beendet),
-- meldet das mit duell_ich_fertig. Ab diesem Zeitpunkt (fertig_am, hoechstens das eigene Ende) nimmt der Server von ihm
-- keinen Zug mehr an, sein Ergebnis steht also fest und er sieht es sofort; den Gegner sieht er live mit dessen
-- Restzeit (duell_stand: ich.fertig, gegner.fertig, gegner.ende_am). Sind beide fertig, endet das Duell sofort, statt
-- bis 180 s + gnade_s zu warten. Wer nicht fertig meldet und nicht wiederkommt, wird wie bisher nach seinem Ende + gnade_s
-- gewertet. Ein Fertig-Melden haelt den Gegner nie an: er spielt seine eigene Zeit, jeder Spieler hat seine eigene Uhr.
-- Ersetzt zusaetzlich: duell_zug_verbuchen und duell_stand (Fassungen aus raetsel-duell-schema.sql, je nur um fertig_am
-- ergaenzt). Neu: Spalte duell_spieler.fertig_am, Helfer duell_spieler_offen_bis, RPC duell_ich_fertig.

-- Neu (R27): Zeitpunkt, ab dem ein Spieler keinen Zug mehr abgibt (null = nicht gemeldet). Additiv, Rueckweg laesst sie
-- stehen (die alten Funktionen lesen sie nicht).
alter table public.duell_spieler add column if not exists fertig_am timestamptz;

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

-- Bis wann ein Spieler noch einen Zug verbuchen kann (R27): fertig gemeldet -> fertig_am (hoechstens sein Ende, kein
-- Zug mehr); alle Raetsel durch -> sein letzter Zug; sonst sein Ende + nachfrist fuer spaet verbuchte Zuege, hoechstens
-- 180 s + gnade_s. Das Duell ist auswertbar, sobald dieser Zeitpunkt fuer jeden Menschen darin vorbei ist.
create or replace function public.duell_spieler_offen_bis(d public.duelle, s public.duell_spieler, nachfrist interval)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select case when s.fertig_am is not null
              then least(s.fertig_am, public.duell_ende_am(d.start_am, d.dauer_s, s.fehler))
              when s.idx >= cardinality(d.raetsel) then public.duell_spieler_schluss(d, s)
              else least(public.duell_spieler_schluss(d, s) + nachfrist,
                         d.start_am + make_interval(secs => d.dauer_s + (public.duell_konstanten()->>'gnade_s')::integer)) end;
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
  -- Nachfrist im KI-Duell nach dem eigenen Ende (Kaltreview F-20:05): ein Zug, der vor dem Ende bei der Edge Function
  -- ankam, wird mit seiner Ankunftszeit verbucht, auch wenn die Verbuchung laenger als gnade_s dauert (Kaltstart). Die
  -- alte Fassung hielt dafuer bis 180 s + gnade_s offen; 15 s decken die Verbuchung ab und sind nie spaeter als damals.
  ki_gnade interval := interval '15 seconds';
begin
  select * into d from public.duelle x where x.id = duell_auswerten.duell for update;
  if d.id is null or d.status <> 'laeuft' then
    return d;
  end if;
  select * into sa from public.duell_spieler s where s.duell = d.id and s.user_id = d.a for update;
  if d.art = 'ki' then
    -- R26 AC-05: fertig ist das Duell, sobald der Spieler fertig ist (alle Raetsel durch: sofort) oder seine eigene Zeit
    -- samt KI-Nachfrist um ist (hoechstens bis 180 s + gnade_s wie bisher); die KI zaehlt weiter mit den vollen 180 s
    -- (gerechnet, ohne Uhr: steht sofort fest)
    ki := public.duell_ki_verlauf(d.seed, d.ki_elo, public.duell_ratings(d), d.dauer_s);
    gb := (ki->>'geloest')::integer;
    fb := (ki->>'fehler')::integer;
    -- R27: der Helfer rechnet wie bisher (alle durch: letzter Zug; sonst Ende + Nachfrist, hoechstens 180 s + Gnade)
    -- und nimmt zusaetzlich das Fertig-Melden (fertig_am) als Schluss
    if now() < public.duell_spieler_offen_bis(d, sa, ki_gnade) then
      return d;
    end if;
  else
    select * into sb from public.duell_spieler s where s.duell = d.id and s.user_id = d.b for update;
    gb := sb.geloest;
    fb := sb.fehler;
    -- R27 Sofort-Ende: jeder Mensch ist fertig mit fertig_am, mit allen Raetseln oder nach seinem Ende + gnade_s
    -- (bisher immer Ende + gnade_s); erst wenn beide fertig sind, wird ausgewertet
    if now() < public.duell_spieler_offen_bis(d, sa, gnade) or now() < public.duell_spieler_offen_bis(d, sb, gnade) then
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

-- Wertet alle laufenden Duelle eines Kontos aus, die fertig sind (wie raetsel-duell-schema.sql). Jedes gestartete Duell
-- kommt mit: ob die Spieler fertig sind, prueft duell_auswerten selbst (R26 AC-05 fuer die KI, R27 fuer Menschen).
create or replace function public.duell_faellige_auswerten(uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  x uuid;
begin
  for x in
    select d.id from public.duelle d
    where d.status = 'laeuft' and uid in (d.a, d.b)
      and d.start_am <= now()
    order by d.start_am
  loop
    perform public.duell_auswerten(x);
  end loop;
end;
$$;

-- Server-Lauf ueber ALLE Konten (pg_cron alle 10 Minuten, wie raetsel-duell-schema.sql). Jedes gestartete Duell kommt
-- mit, ob die Spieler fertig sind, prueft duell_auswerten selbst (R26 AC-05, R27). Antwort: Zahl der beendeten Duelle.
create or replace function public.duell_alle_faelligen_auswerten()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  x uuid;
  n integer := 0;
begin
  for x in
    select d.id from public.duelle d
    where d.status = 'laeuft'
      and d.start_am <= now()
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

-- Verbucht einen geprueften Zug (wie raetsel-duell-schema.sql). R27: nach dem Fertig-Melden nimmt der Server keinen Zug
-- mehr an, dessen Ankunft nicht vor fertig_am liegt (DUELL_FERTIG). Antwort und Fehler sonst wie bisher.
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
  if s.idx >= cardinality(d.raetsel) or (s.fertig_am is not null and zeit >= s.fertig_am) then
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

-- Stand eines Duells fuer den Aufrufer (wie raetsel-duell-schema.sql). R27: ich.fertig und gegner.fertig (true, sobald
-- der Spieler keinen Zug mehr abgeben kann: gemeldet, alle Raetsel durch oder Zeit um; die KI erst mit dem Ende des
-- Duells); nach dem eigenen Fertig-Melden kein Raetsel mehr.
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
  -- auswerten prueft selbst, ob beide fertig sind
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
              || jsonb_build_object('ki', true, 'elo', d.ki_elo, 'fertig', d.status = 'beendet');
  else
    select * into er from public.duell_spieler s where s.duell = d.id and s.user_id <> uid;
    gegner := case when er.user_id is null then null
                   else public.duell_spieler_json(er.geloest, er.fehler, public.duell_ende_am(d.start_am, d.dauer_s, er.fehler))
                        || jsonb_build_object('ki', false, 'fertig', d.status = 'beendet' or er.fertig_am is not null
                             or er.idx >= cardinality(d.raetsel)
                             or now() >= public.duell_ende_am(d.start_am, d.dauer_s, er.fehler)) end;
  end if;
  if d.status = 'laeuft' and now() >= d.start_am and now() < public.duell_ende_am(d.start_am, d.dauer_s, ich.fehler)
     and ich.fertig_am is null then
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
    'ich', public.duell_spieler_json(ich.geloest, ich.fehler, public.duell_ende_am(d.start_am, d.dauer_s, ich.fehler))
           || jsonb_build_object('fertig', d.status = 'beendet' or ich.fertig_am is not null
                or ich.idx >= cardinality(d.raetsel)
                or (d.start_am is not null and now() >= public.duell_ende_am(d.start_am, d.dauer_s, ich.fehler))),
    'gegner', gegner, 'raetsel', rae, 'ergebnis', erg, 'kronen_delta', delta);
end;
$$;

-- R27: der Aufrufer ist fertig (alle Raetsel durch, Zeit um oder selbst beendet). Ab jetzt (hoechstens ab seinem Ende)
-- nimmt der Server von ihm keinen Zug mehr an; sein Ergebnis steht fest. Der Gegner spielt seine Zeit weiter. Sind beide
-- fertig, endet das Duell sofort (duell_auswerten ueber duell_stand). Wiederholbar: ein zweiter Aufruf aendert nichts.
-- Den Aufruf schickt die App erst, wenn kein eigener Zug mehr unterwegs ist. Antwort: duell_stand.
-- Fehler (raise): DUELL_ANMELDUNG, DUELL_UNBEKANNT, DUELL_NICHT_GESTARTET.
create or replace function public.duell_ich_fertig(duell uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  d public.duelle;
begin
  if uid is null then
    raise exception 'DUELL_ANMELDUNG';
  end if;
  -- for update wie duell_auswerten (erst Duell, dann Spieler): zwei gleichzeitige Fertig-Meldungen warten aufeinander
  -- statt sich zu verklemmen; ein Zug (for share) wartet ebenso
  select * into d from public.duelle x where x.id = duell_ich_fertig.duell for update;
  if d.id is null or uid not in (d.a, coalesce(d.b, d.a)) then
    raise exception 'DUELL_UNBEKANNT';
  end if;
  if d.status = 'laeuft' then
    if d.start_am is null or now() < d.start_am then
      raise exception 'DUELL_NICHT_GESTARTET';
    end if;
    update public.duell_spieler s
    set fertig_am = least(now(), public.duell_ende_am(d.start_am, d.dauer_s, s.fehler))
    where s.duell = d.id and s.user_id = uid and s.fertig_am is null;
  elsif d.status <> 'beendet' then
    raise exception 'DUELL_NICHT_GESTARTET';
  end if;
  return public.duell_stand(d.id);
end;
$$;

-- ---------- Rechte (wie bisher; der Helfer nur intern) ----------
revoke all on function public.duell_spieler_offen_bis(public.duelle, public.duell_spieler, interval)
  from public, anon, authenticated;
revoke all on function public.duell_zug_verbuchen(uuid, uuid, integer, integer, boolean, boolean, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.duell_zug_verbuchen(uuid, uuid, integer, integer, boolean, boolean, timestamptz) to service_role;
revoke all on function public.duell_stand(uuid) from public, anon, authenticated;
grant execute on function public.duell_stand(uuid) to authenticated;
revoke all on function public.duell_ich_fertig(uuid) from public, anon, authenticated, service_role;
grant execute on function public.duell_ich_fertig(uuid) to authenticated;
revoke all on function public.duell_spieler_schluss(public.duelle, public.duell_spieler) from public, anon, authenticated;
revoke all on function public.duell_auswerten(uuid) from public, anon, authenticated;
revoke all on function public.duell_faellige_auswerten(uuid) from public, anon, authenticated, service_role;
revoke all on function public.duell_alle_faelligen_auswerten() from public, anon, authenticated, service_role;

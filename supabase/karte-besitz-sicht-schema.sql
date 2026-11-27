-- Diese Datei ist die NEUESTE Fassung von karte_konstanten, karte_waehle, karte_von und liga_mitglieder_liste.
-- Wer danach karte-schema, karte-sondertitel, karte-besitz, karte-titel oder zwei-ligen erneut einspielt, setzt sie still
-- zurueck (Motiv/Rahmen wieder ohne Beleg). Danach immer DIESE Datei erneut einspielen und die Fassungs-Probe fahren.
--
-- VORSCHLAG (R30, 26.11.2026, Plan v3 "Gegner sieht Besitz", Review FREIGABE MIT AUFLAGEN 23.11.), NICHT EINGESPIELT.
-- Flo-Regel 22.11.2026: "Was du besitzt und traegst, sieht auch dein Gegner", nur mit Beleg vom Server. Koenig (K), Kronli
-- und der Erfinder-Rahmen (erfinder-blatt-0) kommen in die Listen von karte_konstanten, aber nur mit ihrem Stueck in
-- sonderstuecke (Zuordnung karte_konstanten -> sonder, Helfer karte_sonder_belegt). Gelesen wird ein fremdes Bild nur noch
-- ueber karte_bild, beim Gegner der Partie (karte_von, damit karte_der_partie) und in der Liga (liga_mitglieder_liste).
-- Vorher gaben beide motiv und grund UNGEPRUEFT aus. Ist ein Stueck weg, zeigt das Bild P / standard / ohne; gespeicherte
-- Zeilen in karte_wahl werden NICHT umgeschrieben. Die Weltrangliste (weltrang-schema.sql) zeigt kein Profilbild und bleibt.
--
-- Ersetzt je um genau die R30-Zeilen (Wache: tests/server-karte-besitz-sicht.test.mjs, zeichengleich bis auf die Zusaetze):
--   karte_konstanten       Fassung karte-schema.sql      (+ K, kronli, erfinder-blatt-0, neuer Schluessel sonder)
--   karte_waehle           Fassung karte-titel-schema.sql (+ ein Block karte_sonder_belegt -> KARTE_PROFIL)
--   karte_von              Fassung karte-titel-schema.sql (motiv/grund/rahmen ueber karte_bild)
--   liga_mitglieder_liste  Fassung zwei-ligen-schema.sql  (motiv/grund/rahmen ueber karte_bild)
-- Neu: karte_sonder_belegt, karte_bild (beide ohne jedes Recht). Rechte der ersetzten Funktionen unveraendert.
-- Voraussetzung: karte-, werkstatt-, karte-sondertitel-, karte-besitz-, karte-titel- und zwei-ligen-schema.sql. Fehlt eine
-- Vorstufe, bricht die ganze Datei mit VORSTUFE_FEHLT ab und aendert nichts (ein begin ... commit).
-- Einspielen nur Flo, im SQL Editor, die ganze Datei; danach Fassungs-Probe und Rechte-Probe (unten). Wiederholbar.
-- Rueckweg: supabase/karte-besitz-sicht-zurueck.sql (Sperr-Rueckweg, siehe dort; "ganz zurueck" ist verboten).
--
-- Fassungs-Probe (nur lesend, nach dem Einspielen; erwartet siebenmal true):
--   select
--     position('karte_bild' in pg_get_functiondef('public.karte_von(uuid)'::regprocedure)) > 0 as von_bild,
--     position('karte_titel_belegt' in pg_get_functiondef('public.karte_von(uuid)'::regprocedure)) > 0 as von_titel,
--     position('karte_sonder_belegt' in pg_get_functiondef('public.karte_waehle(text,text,text[],text,text,text)'::regprocedure)) > 0 as waehle_sonder,
--     position('karte_titel_belegt' in pg_get_functiondef('public.karte_waehle(text,text,text[],text,text,text)'::regprocedure)) > 0 as waehle_titel,
--     position('karte_bild' in pg_get_functiondef('public.liga_mitglieder_liste(bigint,uuid)'::regprocedure)) > 0 as liga_bild,
--     public.karte_konstanten() ? 'sonder' as konst_sonder,
--     to_regprocedure('public.karte_bild(uuid,text,text,text)') is not null as bild_da;
-- Rechte-Probe (erwartet viermal false):
--   select has_function_privilege('anon', 'public.karte_bild(uuid,text,text,text)', 'execute'),
--          has_function_privilege('authenticated', 'public.karte_bild(uuid,text,text,text)', 'execute'),
--          has_function_privilege('anon', 'public.karte_sonder_belegt(uuid,text,text)', 'execute'),
--          has_function_privilege('authenticated', 'public.karte_sonder_belegt(uuid,text,text)', 'execute');

begin;

-- Vorstufe (Codex B3): ohne die Fassungen, auf denen diese Datei aufbaut, laeuft nichts
do $$
declare
  f text;
begin
  foreach f in array array['public.karte_titel_belegt(uuid,text)', 'public.karte_rahmen_belegt(uuid,text)',
      'public.karte_sonderstueck(uuid,text)', 'public.liga_mitglieder_liste(bigint,uuid)'] loop
    if pg_catalog.to_regprocedure(f) is null then
      raise exception 'VORSTUFE_FEHLT: %', f;
    end if;
  end loop;
end;
$$;

create or replace function public.karte_konstanten()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'stufen', jsonb_build_array('bronze', 'silber', 'gold'),
    'taler', jsonb_build_object('bronze', 20, 'silber', 50, 'gold', 120),
    -- Familie -> Gold-Lohn (genau ein Titel oder ein Banner); server = Stufen leitet der Server selbst ab
    'familien', jsonb_build_object(
      'siege', jsonb_build_object('titel', 'erfolg-siegesbanner'),
      'bots', jsonb_build_object('banner', 'erfolg-turmbezwinger'),
      'welten', jsonb_build_object('titel', 'erfolg-tiefenlicht'),
      'sterne', jsonb_build_object('titel', 'erfolg-sternenkrone'),
      'endgegner', jsonb_build_object('titel', 'erfolg-weltenbezwinger'),
      'siegesfolge', jsonb_build_object('banner', 'erfolg-seriensieger'),
      'raetsel', jsonb_build_object('banner', 'erfolg-raetselmeister'),
      'serie', jsonb_build_object('titel', 'erfolg-ewige-flamme'),
      'level', jsonb_build_object('titel', 'level-30'),
      'liga', jsonb_build_object('titel', 'erfolg-ligakrone', 'server', true)
    ),
    -- Liga-Stufen (kronen_stand.stufe, 0 = Bauer III) fuer Bronze, Silber, Gold der Familie liga: Laeufer III, Turm III,
    -- Koenig III (gleiche Farben wie frueher Silber III, Gold III, Krone III)
    'liga_ziele', jsonb_build_array(6, 9, 15),
    'start_banner', 'start',
    -- Liga-Banner (Bilder aus assets/banner, Ids bleiben), je Liga eins in der Reihenfolge Bauer bis Koenig (Farben Holz
    -- bis Krone): liga_abrechnen schreibt es ueber karte_banner_gutschreiben gut, sobald eine Woche ein Banner bringt
    -- (Platz 1 der Wochen-Gruppe, erster Aufstieg in eine Liga), immer das Banner der Liga der Gruppe.
    'liga_banner', jsonb_build_array('saison-holz', 'saison-bronze', 'saison-silber', 'saison-gold', 'saison-diamant', 'saison-krone'),
    'titel', jsonb_build_array(
      'level-1', 'level-5', 'level-10', 'level-15', 'level-20', 'level-25', 'level-30', 'level-35', 'level-40', 'level-45',
      'level-50', 'level-60', 'level-75', 'level-100',
      'erfolg-feuertaufe', 'erfolg-sternenglanz', 'erfolg-goldene-aehre', 'erfolg-eichenlaub', 'erfolg-turmzinne',
      'erfolg-brandung', 'erfolg-tiefenlicht', 'erfolg-bot-schreck', 'erfolg-sternenkrone', 'erfolg-goldlorbeer',
      'erfolg-ligakrone', 'erfolg-wochenflamme', 'erfolg-monatsfeuer', 'erfolg-ewige-flamme', 'erfolg-schattenkoenig',
      'erfolg-siegeszug', 'erfolg-bezwinger', 'erfolg-siegesbanner', 'erfolg-weltenbezwinger', 'erfolg-goldene-feder',
      'erfolg-sternenschueler',
      'koennen-blitzschlag', 'koennen-langer-atem', 'koennen-gleichgewicht', 'koennen-feinschliff', 'koennen-eigene-kraft',
      'koennen-stammgast',
      -- Titel vom 08.11.2026 (js/pakete/sammlung/titel.js KOENNEN_TITEL); bis zum Einspielen lehnt der Server sie ab und
      -- die Karte zeigt keinen Titel (js/karte.js abgleichEinmal, zweiter Versuch ohne Titel)
      'koennen-kroenung', 'koennen-raetselfuchs', 'koennen-weltenwanderer', 'koennen-tafelkoenig', 'koennen-rekordjaeger',
      'koennen-sterne-sammler', 'koennen-fehlerjaeger', 'koennen-musterschueler', 'koennen-erzfeind'
    ),
    -- Profilbild ohne Labor-Rahmen; Koenig, Kronli und der Erfinder-Rahmen nur mit ihrem Stueck (sonder, R30)
    'motive', jsonb_build_array('Q', 'R', 'B', 'N', 'P', 'karo', 'stups', 'zinni', 'klippa', 'glimm', 'K', 'kronli'),
    'gruende', jsonb_build_array('standard', 'welt-1', 'welt-2', 'welt-3', 'welt-4', 'welt-5'),
    'rahmen', jsonb_build_array('ohne', 'holz', 'liga-1', 'liga-2', 'liga-3', 'liga-4', 'liga-5', 'liga-6',
      'welt-1', 'welt-2', 'welt-3', 'welt-4', 'welt-5', 'serie-7', 'serie-30', 'serie-100', 'erfinder-blatt-0'),
    -- R30 (Flo 22.11.2026 "Was du besitzt und traegst, sieht auch dein Gegner"): Wert -> noetiges Stueck in sonderstuecke
    -- (karte_sonder_belegt). Wie js/profil.js NUR_ERFINDER und rahmenErlaubt; ein neuer Sonderwert ist eine neue Zeile hier
    'sonder', jsonb_build_object(
      'motiv', jsonb_build_object('K', 'erfinder-titel', 'kronli', 'erfinder-titel'),
      'rahmen', jsonb_build_object('erfinder-blatt-0', 'erfinder-banner-blatt-0')
    )
  );
$$;

-- true, wenn uid den Wert tragen darf: steht wert nicht in karte_konstanten -> sonder -> art, immer; sonst nur mit genau
-- diesem Stueck in sonderstuecke. Ohne Tabelle sonderstuecke (Werkstatt nicht eingespielt) besitzt niemand etwas, daher
-- to_regclass und execute wie karte_sonderstueck. Nur intern (kein grant).
create or replace function public.karte_sonder_belegt(uid uuid, art text, wert text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  stueck text := public.karte_konstanten() -> 'sonder' -> karte_sonder_belegt.art ->> karte_sonder_belegt.wert;
  da boolean;
begin
  if stueck is null then
    return true;
  end if;
  if uid is null or pg_catalog.to_regclass('public.sonderstuecke') is null then
    return false;
  end if;
  execute 'select exists (select 1 from public.sonderstuecke s where s.user_id = $1 and s.stueck_id = $2)'
    into da using uid, stueck;
  return coalesce(da, false);
end;
$$;

-- Das Profilbild, wie andere es sehen: { motiv, grund, rahmen }. Jeder Wert nur, wenn er in seiner Liste steht
-- (karte_konstanten), sein Stueck belegt ist (karte_sonder_belegt) und beim Rahmen zusaetzlich karte_rahmen_belegt; sonst
-- P / standard / ohne. Einzige Stelle fuer fremde Bilder: karte_von (damit karte_der_partie) und liga_mitglieder_liste.
-- Nur intern (kein grant).
create or replace function public.karte_bild(uid uuid, motiv text, grund text, rahmen text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'motiv', case when public.karte_in_liste('motive', karte_bild.motiv) and public.karte_sonder_belegt(uid, 'motiv', karte_bild.motiv)
                  then karte_bild.motiv else 'P' end,
    'grund', case when public.karte_in_liste('gruende', karte_bild.grund) then karte_bild.grund else 'standard' end,
    'rahmen', case when public.karte_in_liste('rahmen', karte_bild.rahmen) and public.karte_sonder_belegt(uid, 'rahmen', karte_bild.rahmen)
                        and public.karte_rahmen_belegt(uid, karte_bild.rahmen)
                   then karte_bild.rahmen else 'ohne' end
  );
$$;

create or replace function public.karte_waehle(banner text, titel text, vitrine text[], motiv text, grund text, rahmen text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v text;
  sauber text[] := '{}';
begin
  perform public.karte_sichern(uid);
  if not exists (select 1 from public.banner_besitz b where b.user_id = uid and b.banner = karte_waehle.banner) then
    raise exception 'KARTE_BANNER';
  end if;
  if titel is not null and not public.karte_in_liste('titel', titel) then
    raise exception 'KARTE_TITEL';
  end if;
  -- R27 Schritt 1: Gold- und Level-Titel nur mit Beleg (karte_titel_belegt)
  if not public.karte_titel_belegt(uid, titel) then
    raise exception 'KARTE_TITEL';
  end if;
  if not public.karte_in_liste('motive', motiv) or not public.karte_in_liste('gruende', grund)
     or not public.karte_in_liste('rahmen', rahmen) then
    raise exception 'KARTE_PROFIL';
  end if;
  -- R27: verdiente Rahmen nur mit Beleg (karte_rahmen_belegt)
  if not public.karte_rahmen_belegt(uid, rahmen) then
    raise exception 'KARTE_PROFIL';
  end if;
  -- R30: Koenig, Kronli und Erfinder-Rahmen nur mit dem Stueck (karte_sonder_belegt, karte_konstanten -> sonder)
  if not public.karte_sonder_belegt(uid, 'motiv', motiv) or not public.karte_sonder_belegt(uid, 'rahmen', rahmen) then
    raise exception 'KARTE_PROFIL';
  end if;
  if vitrine is not null and cardinality(vitrine) > 3 then
    raise exception 'KARTE_VITRINE';
  end if;
  foreach v in array coalesce(vitrine, '{}') loop
    if v is null then
      continue;
    end if;
    if v !~ '^stufe-[a-z]{2,20}$' or v = any(sauber)
       or not exists (select 1 from public.karte_stufen s where s.user_id = uid and s.familie = substr(v, 7)) then
      raise exception 'KARTE_VITRINE';
    end if;
    sauber := sauber || v;
  end loop;
  update public.karte_wahl w
  set banner = karte_waehle.banner, titel = karte_waehle.titel, vitrine = sauber, motiv = karte_waehle.motiv,
      grund = karte_waehle.grund, rahmen = karte_waehle.rahmen, aktualisiert_am = now()
  where w.user_id = uid;
  return public.karte_mein_stand();
end;
$$;

create or replace function public.karte_von(uid uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.karte_wahl;
  name text;
  stufe integer;
  sonder text;
  gezeigt text;
begin
  select * into w from public.karte_wahl x where x.user_id = uid;
  select p.benutzername into name from public.profile p where p.user_id = uid;
  select s.stufe into stufe from public.kronen_stand s where s.user_id = uid;
  -- R27 Schritt 1: ein gespeicherter Titel ohne Beleg gilt wie kein Titel (karte_titel_belegt)
  gezeigt := case when public.karte_titel_belegt(uid, w.titel) then w.titel end;
  -- Sondertitel nur, wenn kein normaler Titel gezeigt wird und das Stueck noch im Besitz ist
  if gezeigt is null then
    sonder := public.karte_sonderstueck(uid, w.sondertitel);
  end if;
  return jsonb_build_object(
    'name', name,
    -- ein Banner, das nicht (mehr) im Besitz ist, zeigt das Start-Banner
    'banner', case when w.banner is not null and exists (select 1 from public.banner_besitz b where b.user_id = uid and b.banner = w.banner)
                   then w.banner else 'start' end,
    'titel', coalesce(gezeigt, case when sonder = 'erfinder-titel' then 'erfinder' else sonder end),
    'vitrine', coalesce((select jsonb_agg(jsonb_build_object('familie', substr(v, 7), 'stufe',
        (select max(s.stufe) from public.karte_stufen s where s.user_id = uid and s.familie = substr(v, 7))) order by o)
      from unnest(w.vitrine) with ordinality as x(v, o)), '[]'::jsonb),
    'kronen_stufe', stufe
  ) || public.karte_bild(uid, w.motiv, w.grund, w.rahmen);  -- R30: motiv, grund, rahmen nur mit Beleg
end;
$$;

create or replace function public.liga_mitglieder_liste(gid bigint, ich uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  liste jsonb;
begin
  if pg_catalog.to_regclass('public.karte_wahl') is not null and pg_catalog.to_regclass('public.banner_besitz') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object(
          'platz', r.platz,
          'name', case when r.ki then b.name else public.liga_name(r.user_id) end,
          'kronen', r.kronen, 'ki', r.ki, 'ich', r.user_id is not distinct from $2)
          || case when r.ki or r.user_id is null then '{}'::jsonb else public.karte_bild(r.user_id, w.motiv, w.grund, w.rahmen) || jsonb_build_object(
               'banner', case when w.banner is not null and exists (select 1 from public.banner_besitz bb
                                                                    where bb.user_id = r.user_id and bb.banner = w.banner)
                              then w.banner else 'start' end) end
          order by r.platz), '[]'::jsonb)
      from public.liga_rangliste($1, false) r
      left join public.liga_bots($1, false) b on r.ki and b.nr = r.nr
      left join public.karte_wahl w on not r.ki and w.user_id = r.user_id
    $q$ into liste using gid, ich;
  else
    select coalesce(jsonb_agg(jsonb_build_object(
        'platz', r.platz,
        'name', case when r.ki then b.name else public.liga_name(r.user_id) end,
        'kronen', r.kronen, 'ki', r.ki, 'ich', r.user_id is not distinct from ich) order by r.platz), '[]'::jsonb)
      into liste
    from public.liga_rangliste(gid, false) r
    left join public.liga_bots(gid, false) b on r.ki and b.nr = r.nr;
  end if;
  return liste;
end;
$$;

revoke all on function public.karte_konstanten() from public, anon, authenticated;
revoke all on function public.karte_sonder_belegt(uuid, text, text) from public, anon, authenticated;
revoke all on function public.karte_bild(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.karte_waehle(text, text, text[], text, text, text) from public, anon, authenticated;
revoke all on function public.karte_von(uuid) from public, anon, authenticated;
revoke all on function public.liga_mitglieder_liste(bigint, uuid) from public, anon, authenticated;
grant execute on function public.karte_waehle(text, text, text[], text, text, text) to authenticated;

commit;

notify pgrst, 'reload schema';

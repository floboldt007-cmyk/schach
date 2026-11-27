-- RUECKWEG zu supabase/karte-besitz-sicht-schema.sql (R30), ein SPERR-Rueckweg, keine volle Umkehrung.
-- Nimmt Koenig, Kronli und den Erfinder-Rahmen wieder aus den Listen und laesst die Lesesperre stehen:
--   karte_konstanten       zurueck auf karte-schema.sql, zeichengleich (Sonderwerte in keiner Liste mehr)
--   karte_waehle           zurueck auf karte-titel-schema.sql, zeichengleich (die Listenpruefung lehnt K, kronli und
--                          erfinder-blatt-0 dann mit KARTE_PROFIL ab)
--   karte_von, liga_mitglieder_liste, karte_bild, karte_sonder_belegt   BLEIBEN. Die alten Fassungen geben motiv (und in
--                          der Liga auch grund und rahmen) ungeprueft aus; ein gespeichertes K oder kronli waere dann
--                          wieder ohne Beleg zu sehen (Codex-Zweitmeinung B2). Mit diesem Rueckweg zeigt karte_bild
--                          gespeicherte Sonderwerte als P / ohne, weil sie in keiner Liste mehr stehen.
-- Keine Zeile in karte_wahl wird umgeschrieben. "Ganz zurueck" hiesse karte-titel-schema.sql und zwei-ligen-schema.sql
-- erneut einspielen: das ist VERBOTEN, weil gespeicherte Sonderwerte dann wieder ohne Beleg zu sehen sind.
-- Einspielen nur Flo, im SQL Editor. Wiederholbar. Wache: tests/server-karte-besitz-sicht.test.mjs.

begin;

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
    -- Profilbild ohne die Stuecke nur fuer den Erfinder (Koenig, Kronli) und ohne Labor-Rahmen
    'motive', jsonb_build_array('Q', 'R', 'B', 'N', 'P', 'karo', 'stups', 'zinni', 'klippa', 'glimm'),
    'gruende', jsonb_build_array('standard', 'welt-1', 'welt-2', 'welt-3', 'welt-4', 'welt-5'),
    'rahmen', jsonb_build_array('ohne', 'holz', 'liga-1', 'liga-2', 'liga-3', 'liga-4', 'liga-5', 'liga-6',
      'welt-1', 'welt-2', 'welt-3', 'welt-4', 'welt-5', 'serie-7', 'serie-30', 'serie-100')
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

revoke all on function public.karte_konstanten() from public, anon, authenticated;
revoke all on function public.karte_waehle(text, text, text[], text, text, text) from public, anon, authenticated;
grant execute on function public.karte_waehle(text, text, text[], text, text, text) to authenticated;

commit;

notify pgrst, 'reload schema';

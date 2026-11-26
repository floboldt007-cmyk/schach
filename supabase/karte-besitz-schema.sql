-- ACHTUNG (R30, 26.11.2026): supabase/karte-besitz-sicht-schema.sql ersetzt Funktionen aus dieser Datei (karte_waehle, karte_von).
-- Wer DIESE Datei erneut einspielt, setzt sie still auf eine aeltere Fassung zurueck (Motiv/Rahmen wieder ohne Beleg).
-- Danach IMMER karte-besitz-sicht-schema.sql erneut einspielen und dort die Fassungs-Probe fahren.
-- VORSCHLAG (R27, 21.11.2026, Kaltreview von PR #271 Befund 2), NICHT EINGESPIELT: verdiente Rahmen der Visitenkarte nur
-- mit Beleg auf dem Server. Bisher prueft karte_waehle motiv/grund/rahmen nur gegen die feste Liste (karte_konstanten);
-- ein direkter Aufruf setzt so z. B. 'serie-100' ohne Serie, und der Gegner sieht es (karte_von / karte_der_partie).
--
-- Belegt werden NUR die Rahmen, fuer die der Server heute einen Beleg hat (Tabelle karte_stufen):
--   liga-6      nur mit karte_stufen liga = 3 (die Familie liga leitet der Server selbst aus kronen_stand und den
--               Wochen-Gruppen ab, karte_sichern; das ist ein ECHTER Beleg)
--   serie-7/30/100  nur mit karte_stufen serie >= 1/2/3 (js/pakete/sammlung/stufen.js: Ziele 7, 30, 100). ACHTUNG: diese
--               Stufen meldet das Geraet selbst (karte_melde_stufen); der Beleg hebt die Huerde nur um diesen einen Aufruf
--   alle anderen (liga-1..5 aus der alten lokalen Liga, welt-1..5, Gruende welt-N, Kreaturen, holz, ohne): weiter nur die
--               Liste. Der Server hat dafuer keinen Beleg; eine Naeherung nahme ehrlichen Spielern ihr Bild weg.
-- Echter Schutz fuer Serie und Welten braucht serverseitig abgeleitete Stufen (Plan: Vault, R27-Plan Stufen am Server).
--
-- Geschrieben UND gelesen: karte_waehle lehnt einen unbelegten Rahmen ab (KARTE_PROFIL), karte_von zeigt einen schon
-- gespeicherten unbelegten Rahmen als 'ohne'. Bestehende Zeilen in karte_wahl werden NICHT umgeschrieben (der Lesepfad
-- genuegt; faellt ein Beleg spaeter nach, erscheint der Rahmen wieder). OPTION, bewusst nicht ausgefuehrt:
--   update public.karte_wahl w set rahmen = 'ohne' where not public.karte_rahmen_belegt(w.user_id, w.rahmen);
-- Ersetzt karte_waehle (Fassung karte-schema.sql) und karte_von (Fassung karte-sondertitel-schema.sql, die live ist) je
-- um genau die R27-Zeilen; Rechte unveraendert. Voraussetzung: karte-schema.sql und karte-sondertitel-schema.sql.
-- Einspielen nur Flo, im SQL Editor; danach  notify pgrst, 'reload schema';
-- Rueckweg: supabase/karte-besitz-zurueck.sql. Wache: tests/server-karte-besitz.test.mjs (PGlite). Wiederholbar.

-- true, wenn uid den Rahmen tragen darf. Nur intern (kein grant).
create or replace function public.karte_rahmen_belegt(uid uuid, rahmen text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when rahmen = 'liga-6' then exists (select 1 from public.karte_stufen s where s.user_id = uid and s.familie = 'liga' and s.stufe = 3)
    when rahmen in ('serie-7', 'serie-30', 'serie-100') then exists (select 1 from public.karte_stufen s where s.user_id = uid
      and s.familie = 'serie' and s.stufe = case rahmen when 'serie-7' then 1 when 'serie-30' then 2 else 3 end)
    else true
  end;
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
begin
  select * into w from public.karte_wahl x where x.user_id = uid;
  select p.benutzername into name from public.profile p where p.user_id = uid;
  select s.stufe into stufe from public.kronen_stand s where s.user_id = uid;
  -- Sondertitel nur, wenn kein normaler Titel gewaehlt ist und das Stueck noch im Besitz ist
  if w.titel is null then
    sonder := public.karte_sonderstueck(uid, w.sondertitel);
  end if;
  return jsonb_build_object(
    'name', name,
    -- ein Banner, das nicht (mehr) im Besitz ist, zeigt das Start-Banner
    'banner', case when w.banner is not null and exists (select 1 from public.banner_besitz b where b.user_id = uid and b.banner = w.banner)
                   then w.banner else 'start' end,
    'titel', coalesce(w.titel, case when sonder = 'erfinder-titel' then 'erfinder' else sonder end),
    'vitrine', coalesce((select jsonb_agg(jsonb_build_object('familie', substr(v, 7), 'stufe',
        (select max(s.stufe) from public.karte_stufen s where s.user_id = uid and s.familie = substr(v, 7))) order by o)
      from unnest(w.vitrine) with ordinality as x(v, o)), '[]'::jsonb),
    'motiv', coalesce(w.motiv, 'P'), 'grund', coalesce(w.grund, 'standard'), 'rahmen', case when public.karte_rahmen_belegt(uid, w.rahmen) then coalesce(w.rahmen, 'ohne') else 'ohne' end,
    'kronen_stufe', stufe
  );
end;
$$;

revoke all on function public.karte_rahmen_belegt(uuid, text) from public, anon, authenticated;
revoke all on function public.karte_waehle(text, text, text[], text, text, text) from public, anon, authenticated;
revoke all on function public.karte_von(uuid) from public, anon, authenticated;
grant execute on function public.karte_waehle(text, text, text[], text, text, text) to authenticated;

-- VORSCHLAG (R27 Schritt 1, 22.11.2026, Plan "Stufen am Server", von Flo am 22.11. freigegeben), NICHT EINGESPIELT:
-- Gold- und Level-Titel der Visitenkarte nur mit Beleg auf dem Server. Bisher prueft karte_waehle den Titel nur gegen die
-- feste Liste (karte-schema.sql:8-10, :341); ein direkter Aufruf setzt so z. B. 'erfolg-ewige-flamme' oder 'level-100' ganz
-- ohne Meldung, und der Gegner sieht es (karte_von / karte_der_partie).
--
-- Belegt werden NUR diese Titel (Beleg: Tabelle karte_stufen):
--   Gold-Titel  der Titel-Lohn von Stufe 3 einer Familie (karte_konstanten -> familien -> titel, gleich
--               js/pakete/sammlung/stufen.js gold.titel), nur mit gebuchter Stufe 3 genau dieser Familie. erfolg-ligakrone
--               belegt der Server selbst (liga aus kronen_stand, karte_sichern); die uebrigen Stufen meldet das Geraet
--               (karte_melde_stufen, Regel vom 07.11.2026), der Beleg hebt die Huerde dort um diesen einen Aufruf.
--   level-N     nur mit der Level-Stufe, deren Ziel unter oder bei N liegt (Ziele 10/20/30 wie stufen.js FAMILIEN level):
--               level-1 und level-5 frei, level-10/15 ab Stufe 1, level-20/25 ab Stufe 2, ab level-30 Stufe 3. Bewusst so
--               und nicht strenger (level-15 erst ab Stufe 2), weil der Server kein genaueres Level kennt und ein ehrlicher
--               Spieler auf Level 15 sonst seinen Titel verloere.
--   alle anderen (Koennen-Titel, die uebrigen Erfolgs-Titel): weiter nur die Liste. Fuer Koennen-Titel hat der Server keinen
--               Beleg. Regel (Flo 22.11.2026): was das Geraet meldet, wird nie gegen Geld oder knappe Dinge getauscht.
--
-- Geschrieben UND gelesen: karte_waehle lehnt einen unbelegten Titel ab (KARTE_TITEL; die App waehlt dann ein zweites Mal ohne
-- Titel, js/karte.js abgleichEinmal, Test tests/karte.test.mjs), karte_von zeigt einen schon gespeicherten unbelegten Titel
-- nicht (dann springt wie ohne Titel ein Sondertitel ein, sonst null). Bestehende Zeilen in karte_wahl werden NICHT
-- umgeschrieben (der Lesepfad genuegt; faellt ein Beleg spaeter nach, erscheint der Titel wieder). OPTION, bewusst nicht
-- ausgefuehrt:  update public.karte_wahl w set titel = null where not public.karte_titel_belegt(w.user_id, w.titel);
-- Ersetzt karte_waehle und karte_von in der Fassung von karte-besitz-schema.sql (#274) je um genau die R27-Titel-Zeilen;
-- Rechte unveraendert. Voraussetzung: karte-schema.sql, karte-sondertitel-schema.sql UND karte-besitz-schema.sql.
-- Einspielen nur Flo, im SQL Editor, nach karte-besitz-schema.sql; danach  notify pgrst, 'reload schema';
-- Rueckweg: supabase/karte-titel-zurueck.sql (zurueck auf #274). Wache: tests/server-karte-titel.test.mjs (PGlite). Wiederholbar.

-- true, wenn uid den Titel tragen darf (null = kein Titel). Nur intern (kein grant).
create or replace function public.karte_titel_belegt(uid uuid, titel text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when karte_titel_belegt.titel is null then true
    when exists (select 1 from jsonb_each(public.karte_konstanten() -> 'familien') f where f.value ->> 'titel' = karte_titel_belegt.titel)
      then exists (select 1 from jsonb_each(public.karte_konstanten() -> 'familien') f
        join public.karte_stufen s on s.familie = f.key
        where f.value ->> 'titel' = karte_titel_belegt.titel and s.user_id = uid and s.stufe = 3)
    -- Level-Ziele wie js/pakete/sammlung/stufen.js (FAMILIEN level: 10, 20, 30); Wache: tests/server-karte-titel.test.mjs
    when karte_titel_belegt.titel ~ '^level-[0-9]{1,3}$'
      then (select count(*) from unnest(array[10, 20, 30]) z where z <= substr(karte_titel_belegt.titel, 7)::integer)
        <= coalesce((select max(s.stufe) from public.karte_stufen s where s.user_id = uid and s.familie = 'level'), 0)
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
    'motiv', coalesce(w.motiv, 'P'), 'grund', coalesce(w.grund, 'standard'), 'rahmen', case when public.karte_rahmen_belegt(uid, w.rahmen) then coalesce(w.rahmen, 'ohne') else 'ohne' end,
    'kronen_stufe', stufe
  );
end;
$$;

revoke all on function public.karte_titel_belegt(uuid, text) from public, anon, authenticated;
revoke all on function public.karte_waehle(text, text, text[], text, text, text) from public, anon, authenticated;
revoke all on function public.karte_von(uuid) from public, anon, authenticated;
grant execute on function public.karte_waehle(text, text, text[], text, text, text) to authenticated;

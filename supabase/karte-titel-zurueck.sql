-- Rueckweg zu supabase/karte-titel-schema.sql (R27 Schritt 1, 22.11.2026): karte_waehle und karte_von wieder wie in
-- karte-besitz-schema.sql (#274, zeichengleich, Wache: tests/server-karte-titel.test.mjs), Hilfsfunktion karte_titel_belegt
-- weg. Der Rahmen-Beleg von #274 bleibt; fuer den Stand ganz ohne Beleg danach supabase/karte-besitz-zurueck.sql. Daten
-- bleiben unberuehrt. Einspielen nur Flo. Wiederholbar.

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

revoke all on function public.karte_waehle(text, text, text[], text, text, text) from public, anon, authenticated;
revoke all on function public.karte_von(uuid) from public, anon, authenticated;
grant execute on function public.karte_waehle(text, text, text[], text, text, text) to authenticated;

drop function if exists public.karte_titel_belegt(uuid, text);

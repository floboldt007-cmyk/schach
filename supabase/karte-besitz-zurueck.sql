-- Rueckweg NUR fuer die Besitz-Pruefung und die Melde-Bremse der Visitenkarte (Stand 09.11.2026): stellt
-- karte_mein_stand, karte_melde_stufen und karte_waehle auf den Stand vom 07.11.2026 zurueck und entfernt die drei
-- neuen Hilfsfunktionen. Es gehen KEINE Daten verloren: Tabellen, gebuchte Stufen, Taler, Banner und gewaehlte Karten
-- bleiben, wie sie sind. Danach gilt wieder die alte Grenze: das Geraet kann Stufen in einem Aufruf bis Gold melden,
-- und Titel, Rahmen, Hintergrund und Profilbild werden nur gegen die feste Liste geprueft.
-- Die neuen Schluessel in karte_konstanten() (melde_tagesgrenze, serie_tage, app_start, alt_liga_bis) stoeren nicht
-- und bleiben stehen. Wiederholbar. Wieder einschalten: supabase/karte-schema.sql noch einmal einspielen.
-- Den ganzen Bereich entfernen (mit Datenverlust): supabase/karte-zurueck.sql.

-- Eigener Stand ohne den Schluessel frei
create or replace function public.karte_mein_stand()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  w public.karte_wahl;
begin
  perform public.karte_sichern(uid);
  select * into w from public.karte_wahl x where x.user_id = uid;
  return jsonb_build_object(
    'taler', coalesce((select sum(t.delta) from public.taler_buchungen t where t.user_id = uid), 0),
    'stufen', coalesce((select jsonb_object_agg(s.familie, s.stufe) from (
      select familie, max(stufe) as stufe from public.karte_stufen where user_id = uid group by familie) s), '{}'::jsonb),
    'banner', coalesce((select jsonb_agg(b.banner order by b.am, b.banner) from public.banner_besitz b where b.user_id = uid), '[]'::jsonb),
    'wahl', jsonb_build_object('banner', w.banner, 'titel', w.titel, 'vitrine', to_jsonb(w.vitrine),
      'motiv', w.motiv, 'grund', w.grund, 'rahmen', w.rahmen)
  );
end;
$$;

-- Meldung wie am 07.11.2026: gebucht wird, was fehlt, der Reihe nach, ohne Bremse
create or replace function public.karte_melde_stufen(stufen jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  k jsonb := public.karte_konstanten();
  fam text;
  wert jsonb;
  ziel integer;
  hat integer;
  i integer;
begin
  perform public.karte_sichern(uid);
  if stufen is null or jsonb_typeof(stufen) <> 'object' then
    raise exception 'KARTE_MELDUNG';
  end if;
  for fam, wert in select * from jsonb_each(stufen) loop
    if not (k -> 'familien') ? fam then
      raise exception 'KARTE_FAMILIE';
    end if;
    if jsonb_typeof(wert) <> 'number' or (wert #>> '{}') !~ '^[0-3]$' then
      raise exception 'KARTE_STUFE';
    end if;
    continue when (k -> 'familien' -> fam) ? 'server';
    ziel := (wert #>> '{}')::integer;
    select coalesce(max(s.stufe), 0) into hat from public.karte_stufen s where s.user_id = uid and s.familie = fam;
    for i in (hat + 1)..ziel loop
      perform public.karte_buche_stufe(uid, fam, i);
    end loop;
  end loop;
  return public.karte_mein_stand();
end;
$$;

-- Wahl wie am 07.11.2026: Titel, Motiv, Grund und Rahmen nur gegen die feste Liste
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

drop function if exists public.karte_stufe_moeglich(uuid, text, integer);
drop function if exists public.karte_frei(uuid);
drop function if exists public.karte_besitz_regeln();

-- Rechte wie zuvor (create or replace behaelt sie; hier noch einmal ausdruecklich)
revoke all on function public.karte_mein_stand() from public, anon, authenticated;
revoke all on function public.karte_melde_stufen(jsonb) from public, anon, authenticated;
revoke all on function public.karte_waehle(text, text, text[], text, text, text) from public, anon, authenticated;
grant execute on function public.karte_mein_stand() to authenticated;
grant execute on function public.karte_melde_stufen(jsonb) to authenticated;
grant execute on function public.karte_waehle(text, text, text[], text, text, text) to authenticated;

-- Rueckweg NUR fuer die Obergrenze der Wochenwertung (Stand 09.11.2026): wochenpunkte_melden nimmt wieder bis zu
-- 100.000 Punkte je Partie an (Stand 30.10.2026), die Hilfsfunktion faellt weg. Es gehen KEINE Daten verloren:
-- Freundschaften, Einladungen und Wochenpunkte bleiben. Wiederholbar. Wieder einschalten: supabase/freunde-schema.sql
-- noch einmal einspielen.

create or replace function public.wochenpunkte_melden(woche date, punkte integer, partien integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  heute date := public.freund_diese_woche();
begin
  if uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  -- diese oder letzte Woche (eine Partie kurz vor Mitternacht am Sonntag darf noch nachkommen)
  if woche is null or extract(isodow from woche) <> 1 or woche not in (heute, heute - 7) then
    return jsonb_build_object('ergebnis', 'woche');
  end if;
  if punkte is null or partien is null or punkte < 0 or partien < 0 or partien > 1000 or punkte > partien * 100000 then
    return jsonb_build_object('ergebnis', 'werte');
  end if;
  insert into public.wochenpunkte as w (user_id, woche, punkte, partien, aktualisiert_am)
  values (uid, wochenpunkte_melden.woche, wochenpunkte_melden.punkte, wochenpunkte_melden.partien, now())
  on conflict (user_id, woche) do update
    set punkte = greatest(w.punkte, excluded.punkte), partien = greatest(w.partien, excluded.partien), aktualisiert_am = now();
  return jsonb_build_object('ergebnis', 'ok');
end;
$$;

drop function if exists public.wochenpunkte_je_partie_max();

revoke all on function public.wochenpunkte_melden(date, integer, integer) from anon, authenticated, service_role, public;
grant execute on function public.wochenpunkte_melden(date, integer, integer) to authenticated;

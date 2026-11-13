-- Rueckweg zu supabase/karte-sondertitel-schema.sql (R15, 13.11.2026): karte_von wieder wie in karte-schema.sql,
-- Funktionen und Tabelle karte_sondertitel weg (verloren geht nur die Meldung des Sondertitels; die Stuecke in
-- sonderstuecke bleiben). Einspielen nur Flo. Test: tests/server-karte-sondertitel.test.mjs. Wiederholbar.

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
begin
  select * into w from public.karte_wahl x where x.user_id = uid;
  select p.benutzername into name from public.profile p where p.user_id = uid;
  select s.stufe into stufe from public.kronen_stand s where s.user_id = uid;
  return jsonb_build_object(
    'name', name,
    -- ein Banner, das nicht (mehr) im Besitz ist, zeigt das Start-Banner
    'banner', case when w.banner is not null and exists (select 1 from public.banner_besitz b where b.user_id = uid and b.banner = w.banner)
                   then w.banner else 'start' end,
    'titel', w.titel,
    'vitrine', coalesce((select jsonb_agg(jsonb_build_object('familie', substr(v, 7), 'stufe',
        (select max(s.stufe) from public.karte_stufen s where s.user_id = uid and s.familie = substr(v, 7))) order by o)
      from unnest(w.vitrine) with ordinality as x(v, o)), '[]'::jsonb),
    'motiv', coalesce(w.motiv, 'P'), 'grund', coalesce(w.grund, 'standard'), 'rahmen', coalesce(w.rahmen, 'ohne'),
    'kronen_stufe', stufe
  );
end;
$$;

revoke all on function public.karte_von(uuid) from public, anon, authenticated;
drop function if exists public.karte_sondertitel_waehle(text);
drop function if exists public.karte_sonderstueck(uuid, text);
drop table if exists public.karte_sondertitel;

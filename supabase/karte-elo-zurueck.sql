-- Rueckweg fuer supabase/karte-elo-schema.sql: karte_der_partie wieder ohne Elo (Fassung aus karte-schema.sql).
-- Daten gehen keine verloren (die Funktion liest nur). Danach notify pgrst, 'reload schema';  Wiederholbar.

create or replace function public.karte_der_partie(partie uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  p public.partien_online;
begin
  if uid is null then
    raise exception 'KARTE_ANMELDUNG';
  end if;
  select * into p from public.partien_online x where x.id = partie;
  if p.id is null or (p.weiss is distinct from uid and p.schwarz is distinct from uid) then
    raise exception 'KARTE_KEINE_PARTIE';
  end if;
  -- du: welche der beiden Karten die eigene ist (statt einer Konto-Kennung)
  return jsonb_build_object(
    'w', case when p.weiss is null then null else public.karte_von(p.weiss) || jsonb_build_object('du', p.weiss = uid) end,
    's', case when p.schwarz is null then null else public.karte_von(p.schwarz) || jsonb_build_object('du', p.schwarz = uid) end
  );
end;
$$;

revoke all on function public.karte_der_partie(uuid) from public, anon, authenticated;
grant execute on function public.karte_der_partie(uuid) to authenticated;

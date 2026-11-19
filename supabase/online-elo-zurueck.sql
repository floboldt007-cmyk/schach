-- Rueckweg fuer supabase/online-elo-schema.sql: kronen_mein_stand() wieder ohne Feld elo (Fassung aus
-- zwei-ligen-schema.sql, wortgleich; tests/server-online-elo.test.mjs prueft das). Daten gehen keine verloren (die
-- Funktion liest nur). Danach notify pgrst, 'reload schema';  Wiederholbar.

-- alte Namen: Online-Liga, Antwort wie bisher (ohne das Feld liga)
create or replace function public.kronen_mein_stand()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.liga_stand('online') - 'liga';
$$;

revoke all on function public.kronen_mein_stand() from public, anon, authenticated;
grant execute on function public.kronen_mein_stand() to authenticated;

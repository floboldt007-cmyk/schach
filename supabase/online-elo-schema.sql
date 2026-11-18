-- VORSCHLAG (14.11.2026, Feinschliff R19), NOCH NICHT EINGESPIELT: kronen_mein_stand() schickt zusaetzlich die EIGENE
-- Online-Elo (Feld elo aus kronen_stand), damit die Online-Seite sie gross zeigen kann (Entwurf "online ruhig" A,
-- js/ui/online.js nimmt das Feld, wenn es da ist, sonst die Liga wie heute).
-- Regeln: nur die Elo des angemeldeten Kontos (auth.uid()), nie eine fremde. Eine Zahl nur, wenn sie echt ist: nach
-- mindestens einer gewerteten Partie (elo_n > 0) oder einem selbst gesetzten Start (start_gesetzt); sonst elo null,
-- denn der Vorgabewert 1000 waere eine erfundene Zahl. Alle bisherigen Felder bleiben (liga_stand('online') - 'liga').
-- Datenschutz: nichts Neues nach aussen, jeder liest nur den eigenen Stand.
-- Einspielen (Flo, nie Claude): nach kronen- und zwei-ligen-schema.sql im SQL Editor; danach
-- notify pgrst, 'reload schema';  Probe: supabase/online-elo-rls-test.sql. Rueckweg: supabase/online-elo-zurueck.sql.
-- Test: tests/server-online-elo.test.mjs. Wiederholbar.

create or replace function public.kronen_mein_stand()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select (public.liga_stand('online') - 'liga')
    || jsonb_build_object('elo', (select st.elo from public.kronen_stand st
                                  where st.user_id = auth.uid() and (st.elo_n > 0 or st.start_gesetzt)));
$$;

revoke all on function public.kronen_mein_stand() from public, anon, authenticated;
grant execute on function public.kronen_mein_stand() to authenticated;

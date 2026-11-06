-- Rueckweg fuer supabase/zaehler-schema.sql (Tageszaehler, Etappe B Task 8).
-- ACHTUNG: Das entfernt die STRUKTUR samt allen Tagessummen; nichts davon kommt durch erneutes Einspielen zurueck.
-- Vorher sichern, wenn es echte Daten gibt (im SQL Editor, Datum einsetzen):
--   create table public._backup_zaehler_tag_JJJJMMTT as select * from public.zaehler_tag;
--   revoke all on table public._backup_zaehler_tag_JJJJMMTT from anon, authenticated, public;
-- Der Schalter (kronen_schalter.zaehler_an) gehoert zu kronen-schema.sql und bleibt; kronen-zurueck.sql raeumt die
-- Zaehler-Teile ebenfalls mit ab, wenn die ganze Liga zurueckgenommen wird. Wiederholbar.

drop function if exists public.zaehler_erhoehe(text, integer);
drop function if exists public.zaehler_an();
drop table if exists public.zaehler_tag;

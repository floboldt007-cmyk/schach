-- Rueckweg fuer supabase/melden-schema.sql (Namensfilter und Melden).
-- Danach gilt fuer Benutzernamen wieder nur das Format (3 bis 20 Zeichen, Buchstaben, Ziffern, _), und die App zeigt
-- den Knopf "Melden" nicht mehr (sie fragt melde_stand, die es dann nicht mehr gibt).
-- ACHTUNG: Die Meldungen sind danach weg. Vorher sichern, wenn es welche gibt (im SQL Editor, Datum einsetzen):
--   create table public._backup_meldungen_JJJJMMTT as select * from public.meldungen;
--   revoke all on table public._backup_meldungen_JJJJMMTT from anon, authenticated, public;
-- Die Sicherung nach 30 Tagen von Hand loeschen. Bestehende Benutzernamen bleiben unveraendert. Wiederholbar.
-- Danach supabase/daten-schema.sql noch einmal ausfuehren ist nicht noetig: die Datenauskunft zeigt ohne die Tabelle
-- eine leere Liste.

drop trigger if exists profile_name_pruefen on public.profile;
drop function if exists public.profile_name_pruefen();
drop function if exists public.name_gesperrt(text);
drop function if exists public.name_lesarten(text);
drop function if exists public.namen_regeln();

drop function if exists public.melde_spieler(text, text, text, uuid);
drop function if exists public.melde_stand();
drop function if exists public.melden_tag();
drop function if exists public.melden_konstanten();
drop table if exists public.meldungen;

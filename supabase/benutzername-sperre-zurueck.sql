-- Rueckweg zu supabase/benutzername-sperre-schema.sql (R19, 15.11.2026): Trigger, Funktion und Spalte
-- profile.name_geaendert_am wieder weg. Verloren geht nur der Zeitpunkt der letzten eigenen Namensaenderung; die Namen
-- selbst bleiben. Danach ist der Name wieder beliebig oft aenderbar, die App zeigt dann keinen Hinweis mehr (sie liest das
-- Feld nur, wenn es da ist). Einspielen nur Flo. Test: tests/server-benutzername-sperre.test.mjs. Wiederholbar.

drop trigger if exists profile_name_sperre on public.profile;
drop function if exists public.profile_name_sperre();
alter table public.profile drop column if exists name_geaendert_am;

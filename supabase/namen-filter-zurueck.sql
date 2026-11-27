-- Rueckweg fuer supabase/namen-filter-schema.sql (Namensfilter, T-012).
-- Danach gilt fuer Benutzernamen wieder nur das Format (3 bis 20 Zeichen, Buchstaben, Ziffern, _); die App sagt bei
-- gesperrten Namen weiter vorab "geht nicht" (js/namen.js), der Server nimmt sie aber wieder an.
-- Bestehende Benutzernamen bleiben unveraendert, es gehen keine Daten verloren. Einspielen nur Flo. Wiederholbar.

drop trigger if exists profile_name_pruefen on public.profile;
drop function if exists public.profile_name_pruefen();
drop function if exists public.name_gesperrt(text);
drop function if exists public.name_lesarten(text);
drop function if exists public.namen_regeln();

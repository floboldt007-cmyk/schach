-- Rueckweg zu supabase/benutzername-bestaetigt-schema.sql (Flo 21.11.2026): Haken-Trigger, Funktionen und Spalte
-- profile.name_bestaetigt wieder weg. Verloren geht nur, wer seinen Namen bestaetigt hat; Namen und die 30-Tage-Frist
-- (benutzername-sperre-schema.sql) bleiben. Danach gilt wieder: das erste Setzen ist frei, erst eine Aenderung sperrt.
-- Die App zeigt dann keinen Haken mehr und speichert den Namen wie vorher (sie fragt die Spalte nur ab, wenn sie da ist).
-- Einspielen nur Flo. Test: tests/server-benutzername-bestaetigt.test.mjs. Wiederholbar.

drop trigger if exists profile_name_zz_bestaetigt on public.profile;
drop function if exists public.profile_name_bestaetigt();
drop function if exists public.name_frei(text);
drop function if exists public.bestaetigte_namen(text[]);
drop function if exists public.verwaltung_name_sperre_aufheben(uuid);
alter table public.profile drop column if exists name_bestaetigt;

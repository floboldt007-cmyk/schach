-- Rueckweg zu supabase/gegner-effekte-schema.sql (R26, 21.11.2026): Funktionen und Tabelle karte_effekte weg. Verloren
-- geht nur die gemeldete Wahl von Figuren, Zug-Animation und Finisher; Sonderstuecke, Visitenkarte und Partien bleiben.
-- Die App faellt danach von selbst auf den Standard zurueck (js/gegner-effekte.js). Einspielen nur Flo.
-- Test: tests/server-gegner-effekte.test.mjs. Wiederholbar.

drop function if exists public.effekte_der_partie(uuid);
drop function if exists public.effekte_von(uuid);
drop function if exists public.effekte_waehle(text, text, text);
drop function if exists public.effekte_besitzt(uuid, text, text);
drop function if exists public.effekte_liste(text);
drop table if exists public.karte_effekte;

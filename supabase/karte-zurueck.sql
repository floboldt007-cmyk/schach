-- Rueckweg fuer supabase/karte-schema.sql (Visitenkarte, Erfolge in Stufen, Taler, Banner; Etappe 4b).
-- ACHTUNG: Das entfernt nur die STRUKTUR. Gebuchte Stufen, Taler, Banner-Besitz und die gewaehlten Karten sind danach
-- weg; nichts davon kommt durch erneutes Einspielen zurueck (die Liga-Stufen leitet der Server beim naechsten Aufruf
-- wieder aus den Kronen ab, die Stufen meldet das Geraet neu, sobald der Spieler die App oeffnet; gutgeschriebene
-- Liga-Banner sind ohne Sicherung weg: ihre Zeilen in liga_belohnungen stehen dann schon auf ausgezahlt).
-- Vorher sichern, wenn es echte Daten gibt (im SQL Editor, Datum einsetzen):
--   create table public._backup_karte_stufen_JJJJMMTT as select * from public.karte_stufen;
--   create table public._backup_taler_buchungen_JJJJMMTT as select * from public.taler_buchungen;
--   create table public._backup_banner_besitz_JJJJMMTT as select * from public.banner_besitz;
--   create table public._backup_karte_wahl_JJJJMMTT as select * from public.karte_wahl;
-- Die Sicherungstabellen bekommen keine Rechte (revoke all ... from anon, authenticated, public) und werden nach 30 Tagen
-- von Hand geloescht. Wiederholbar.

drop function if exists public.karte_der_partie(uuid);
drop function if exists public.karte_von(uuid);
drop function if exists public.karte_waehle(text, text, text[], text, text, text);
drop function if exists public.karte_melde_stufen(jsonb);
drop function if exists public.karte_mein_stand();
drop function if exists public.karte_liga_banner_nachtragen(uuid);
drop function if exists public.karte_banner_gutschreiben(uuid, text);
drop function if exists public.karte_sichern(uuid);
drop function if exists public.karte_buche_stufe(uuid, text, integer);
drop function if exists public.karte_in_liste(text, text);
drop function if exists public.karte_konstanten();

drop table if exists public.karte_wahl;
drop table if exists public.banner_besitz;
drop table if exists public.taler_buchungen;
drop table if exists public.karte_stufen;

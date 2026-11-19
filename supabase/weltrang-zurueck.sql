-- Rueckweg fuer supabase/weltrang-schema.sql: Weltrangliste wieder ganz entfernen (beide Funktionen und die Tabelle der
-- Zustimmungen). Die Zustimmungen gehen dabei verloren; Elo, Liga und Karte bleiben unberuehrt. Die Datenauskunft
-- (daten-schema.sql) prueft die Tabelle mit to_regclass und laeuft ohne sie weiter. Die App zeigt danach im Reiter "Welt"
-- "gerade nicht erreichbar". Wiederholbar.
drop function if exists public.weltrang_mitmachen(boolean);
drop function if exists public.weltrang_liste(integer);
drop table if exists public.weltrang_teilnahme;

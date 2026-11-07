-- Rueckweg fuer supabase/raetsel-duell-schema.sql: entfernt alle Duelle, Duell-Raetsel und Duell-Funktionen.
-- Kronen, die schon aus Duellen gebucht sind, bleiben stehen (Quellen 'duell' und 'duell_ki' in kronen_buchungen);
-- kronen-schema.sql laesst diese Quellen weiter zu. Im SQL Editor ausfuehren; wiederholbar.
drop function if exists public.duell_zug_verbuchen(uuid, uuid, integer, integer, boolean, boolean, timestamptz);
drop function if exists public.duell_zug_lage(uuid, uuid);
drop function if exists public.duell_stand(uuid);
drop function if exists public.duell_beitreten(text);
drop function if exists public.duell_einladen();
drop function if exists public.duell_suche_ende(boolean);
drop function if exists public.duell_suche_stand();
drop function if exists public.duell_suche_start();
drop function if exists public.duell_suche_paaren(uuid);
drop function if exists public.duell_suche_duell(uuid);
drop function if exists public.duell_spieler_json(integer, integer, timestamptz);
drop function if exists public.duell_auswerten(uuid);
drop function if exists public.duell_anlegen(text, uuid, uuid, integer);
drop function if exists public.duell_ende_am(timestamptz, integer, integer);
drop function if exists public.duell_ki_verlauf(text, integer, integer[], numeric);
drop function if exists public.duell_zufall(text, integer, text);
drop function if exists public.duell_folge(text);
drop function if exists public.duell_konstanten();
-- Funktionen mit Zeilen-Typen der Tabellen vor den Tabellen selbst
drop function if exists public.duell_raetsel_anzeige(public.duelle, public.duell_spieler);
drop function if exists public.duell_ki_jetzt(public.duelle);
drop function if exists public.duell_ratings(public.duelle);
drop table if exists public.duell_warteschlange;
drop table if exists public.duell_spieler;
drop table if exists public.duelle;
drop table if exists public.duell_raetsel;

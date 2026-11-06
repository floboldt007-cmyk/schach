-- Rueckweg fuer supabase/kronen-schema.sql (Liga mit Kronen, Etappe B).
-- ACHTUNG: Das entfernt nur die STRUKTUR. Alle Kronen-Staende, Buchungen, das Saison-Archiv, die Suchwarteschlange,
-- die KI-Belege und die Tageszaehler sind danach weg; nichts davon kommt durch erneutes Einspielen zurueck.
-- Vorher sichern, wenn es echte Daten gibt (im SQL Editor, Datum einsetzen):
--   create table public._backup_kronen_stand_JJJJMMTT as select * from public.kronen_stand;
--   create table public._backup_kronen_buchungen_JJJJMMTT as select * from public.kronen_buchungen;
--   create table public._backup_kronen_archiv_JJJJMMTT as select * from public.kronen_archiv;
-- Die Sicherungstabellen haben keine Rechte fuer anon/authenticated (revoke all ... from anon, authenticated, public)
-- und werden nach 30 Tagen von Hand geloescht.
--
-- Umfasst auch, was spaetere Tasks des Plans anlegen (Trigger auf partien_online, Spalte gewertet, Gegnersuche, KI-Belege,
-- Start-Liga, Zaehler); alles mit "if exists", also auch nach einem Teil-Einspielen sicher. Reihenfolge: erst Trigger und
-- Funktionen, dann Tabellen (abhaengige zuerst), zuletzt die Spalte an der bestehenden Tabelle partien_online.
-- Wiederholbar.

do $$
begin
  if to_regclass('public.partien_online') is not null then
    drop trigger if exists kronen_nach_partie on public.partien_online;
  end if;
end;
$$;

-- spaetere Tasks (Plan Task 3 bis 8)
drop function if exists public.kronen_bei_partie_ende();
drop function if exists public.kronen_online_buchen(uuid, uuid, numeric, integer);
drop function if exists public.online_suche_start(text);
drop function if exists public.online_suche_stand();
drop function if exists public.online_suche_ende(boolean);
drop function if exists public.online_suche_paaren(uuid);
drop function if exists public.online_suche_partie(uuid);
drop function if exists public.kronen_bot_ergebnis(text, text, integer);
drop function if exists public.kronen_ki_ergebnis(uuid, text);
drop function if exists public.kronen_start(integer);
drop function if exists public.zaehler_erhoehe(text, integer);
drop function if exists public.zaehler_an();

-- Task 2
drop function if exists public.kronen_mein_stand();
drop function if exists public.kronen_stand_sichern(uuid);
drop function if exists public.kronen_rueckstufen(integer);
drop function if exists public.kronen_liga_boden(integer);
drop function if exists public.kronen_stufe(integer);
drop function if exists public.kronen_saison_heute();
drop function if exists public.kronen_saison_am(date);
drop function if exists public.kronen_heute();
drop function if exists public.kronen_konstanten();

drop table if exists public.zaehler_tag;
drop table if exists public.suche_ki_belege;
drop table if exists public.suche_warteschlange;
drop table if exists public.kronen_buchungen;
drop table if exists public.kronen_archiv;
drop table if exists public.kronen_stand;
drop table if exists public.kronen_schalter;

alter table if exists public.partien_online drop column if exists gewertet;

-- Rueckweg fuer supabase/zwei-ligen-schema.sql (G-005). Im SQL Editor ausfuehren, DANACH in dieser Reihenfolge erneut
-- einspielen: kronen-schema.sql, raetsel-duell-schema.sql, liga-bild-schema.sql (falls karte-schema.sql eingespielt ist)
-- und daten-schema.sql. Die stellen die alten Fassungen der ersetzten Funktionen wieder her (Online-Suche mit Elo-Fenster
-- und freier Zeit, ein Kronen-Topf). Bis dahin sind die Liga-Funktionen nicht nutzbar.
--
-- Was verloren geht: alles der Raetsel-Liga (Wochen-Gruppen, Plaetze, Belohnungen mit liga = 'raetsel', raetsel_stand
-- mit Stufe, Kronen und Raetsel-Elo) und der Tageszaehler der Live-Bewertung (live_bewertung_nutzung). Achtung: mit der
-- alten Suche (60-s-Fenster) kann wieder eine zweite gewertete Partie derselben Konten entstehen (Befund 11.11.2026).
-- Die Online-Liga bleibt vollstaendig. Die Buchungen (kronen_buchungen) bleiben; die
-- Duell-Kronen seit dem Einspielen von zwei-ligen-schema.sql kommen dadurch NICHT nachtraeglich in den Online-Topf.
-- Wiederholbar.

-- nur solange die Spalte liga noch da ist (beim zweiten Lauf ist sie weg)
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'liga_gruppen' and column_name = 'liga') then
    execute 'delete from public.liga_belohnungen l where l.liga = ''raetsel''';
    execute 'delete from public.liga_gruppen g where g.liga = ''raetsel''';   -- die Plaetze gehen mit (on delete cascade)
    execute 'delete from public.liga_mitglieder m where m.liga = ''raetsel''';
  end if;
end;
$$;

alter table public.liga_mitglieder drop constraint if exists liga_mitglieder_einmal;
alter table public.liga_mitglieder add constraint liga_mitglieder_einmal unique (user_id, woche);
alter table public.liga_belohnungen drop constraint if exists liga_belohnungen_einmal;
alter table public.liga_belohnungen add constraint liga_belohnungen_einmal unique (user_id, woche, art);
drop index if exists public.liga_gruppen_liga_woche;
alter table public.liga_gruppen drop constraint if exists liga_gruppen_liga;
alter table public.liga_mitglieder drop constraint if exists liga_mitglieder_liga;
alter table public.liga_belohnungen drop constraint if exists liga_belohnungen_liga;
alter table public.liga_gruppen drop column if exists liga;
alter table public.liga_mitglieder drop column if exists liga;
alter table public.liga_belohnungen drop column if exists liga;

drop function if exists public.liga_pruefen(text);
drop function if exists public.liga_der_quelle(text);
drop function if exists public.raetsel_stand_sichern(uuid);
drop function if exists public.liga_stufe_sichern(uuid, text);
drop function if exists public.liga_buchen_in(uuid, text, integer);
drop function if exists public.liga_mein_platz_in(uuid, text);
drop function if exists public.liga_bot_ki_genutzt_in(uuid, date, text);
drop function if exists public.raetsel_elo_buchen(uuid, numeric, integer);
drop function if exists public.liga_mitglieder_liste(bigint, uuid);
drop function if exists public.liga_staende();
drop function if exists public.liga_stand(text);
drop function if exists public.liga_gruppe(text);
drop function if exists public.online_suche_warten(uuid);
drop function if exists public.duell_suche_warten(uuid);
-- hat hier einen Vorgabewert; kronen-schema.sql legt sie ohne an (das geht mit create or replace nicht)
drop function if exists public.online_suche_start(text);
-- Live-Bewertung (11.11.2026): Funktionen und Zaehler-Tabelle weg (nur Zaehlung je Tag, keine Partiedaten).
-- online_suche_partie bleibt; kronen-schema.sql stellt beim erneuten Einspielen die alte 60-s-Fassung wieder her.
drop function if exists public.online_live_bewertung_nutzen(uuid);
drop function if exists public.online_live_bewertung_frei(uuid);
drop function if exists public.live_bewertung_unbegrenzt(uuid);
drop table if exists public.live_bewertung_nutzung;
-- erst nach den Funktionen: raetsel_stand_sichern gibt den Zeilentyp der Tabelle zurueck
drop table if exists public.raetsel_stand;

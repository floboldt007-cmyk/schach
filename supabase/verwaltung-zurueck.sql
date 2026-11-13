-- Rueckweg fuer supabase/verwaltung-schema.sql (Verwaltung fuer Flo, G-006 M3).
-- ACHTUNG: Danach sind die Liste der Verwalter, das Protokoll und alle Banner, die ueber die Verwaltung vergeben
-- wurden (Quelle 'verwaltung'), weg. Premium-Freischaltungen und geaenderte Benutzernamen BLEIBEN (sie stehen in
-- public.abos und public.profile wie jede andere Zeile). Vorher sichern, wenn es echte Daten gibt (Datum einsetzen):
--   create table public._backup_verwaltung_protokoll_JJJJMMTT as select * from public.verwaltung_protokoll;
--   create table public._backup_banner_verwaltung_JJJJMMTT as select * from public.banner_besitz where quelle = 'verwaltung';
-- Die Sicherungstabellen bekommen keine Rechte (revoke all ... from anon, authenticated, public) und werden nach 30 Tagen
-- von Hand geloescht. Wiederholbar. Danach: notify pgrst, 'reload schema';

drop function if exists public.verwaltung_protokoll_lesen(integer);
drop function if exists public.verwaltung_banner(uuid, text, boolean);
drop function if exists public.verwaltung_name(uuid, text);
drop function if exists public.verwaltung_premium(uuid, timestamptz);
drop function if exists public.verwaltung_kaeufe(uuid);
drop function if exists public.verwaltung_konten(text, integer);
drop function if exists public.verwaltung_banner_gueltig(text);
drop function if exists public.verwaltung_pruefen(uuid);
drop function if exists public.ist_verwalter();

-- Erst die Banner aus der Verwaltung, sonst scheitert der alte Check (wie in karte-schema.sql)
do $$
begin
  if to_regclass('public.banner_besitz') is not null then
    delete from public.banner_besitz where quelle = 'verwaltung';
    alter table public.banner_besitz drop constraint if exists banner_besitz_quelle;
    alter table public.banner_besitz add constraint banner_besitz_quelle check (quelle in ('start', 'erfolg', 'liga'));
  end if;
end
$$;

drop table if exists public.verwaltung_protokoll;
drop table if exists public.verwalter;

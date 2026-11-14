-- Rueckweg zu supabase/saison-schema.sql (VORSCHLAG, NOCH NICHT EINGESPIELT; Einspielen Flo, nie Claude).
-- Stellt liga_abrechnen auf die live Fassung aus zwei-ligen-schema.sql OHNE Saison-Haken zurueck und entfernt alle
-- Saison-Funktionen und -Tabellen (Abzeichen, Titel und Wahl gehen dabei verloren; vorher bei Bedarf sichern).
-- Die Datenauskunft (daten-schema.sql) prueft die Tabelle per to_regclass und braucht nichts. Wiederholbar.
-- Danach ist saison-schema.sql wieder einspielbar (Test: tests/server-saison.test.mjs).

create or replace function public.liga_abrechnen()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k jsonb := public.kronen_konstanten();
  groesse integer := (k ->> 'gruppe_groesse')::integer;
  auf integer := (k ->> 'aufstieg_plaetze')::integer;
  ab integer := (k ->> 'abstieg_plaetze')::integer;
  heute date := public.liga_woche_heute();
  g public.liga_gruppen;
  r record;
  neu integer;
  b jsonb;
begin
  if not exists (select 1 from public.liga_gruppen x where not x.abgerechnet and x.woche < heute) then
    return;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('liga-abrechnen'));
  for g in select * from public.liga_gruppen x where not x.abgerechnet and x.woche < heute order by x.woche, x.id for update
  loop
    for r in select * from public.liga_rangliste(g.id, true) l where not l.ki
    loop
      neu := case
        when r.platz <= auf then least(17, g.stufe + 1)
        when r.platz > groesse - ab then greatest(0, g.stufe - 1)
        else g.stufe end;
      if g.liga = 'raetsel' then
        update public.raetsel_stand s set stufe = neu, aktualisiert_am = now() where s.user_id = r.user_id;
      else
        update public.kronen_stand s set stufe = neu, aktualisiert_am = now() where s.user_id = r.user_id;
      end if;
      select e into b from jsonb_array_elements(k -> 'belohnung') e
      where r.platz between (e ->> 'von')::integer and (e ->> 'bis')::integer limit 1;
      if b is not null then
        insert into public.liga_belohnungen (user_id, woche, stufe, platz, art, menge, liga)
        values (r.user_id, g.woche, g.stufe, r.platz, b ->> 'art', (b ->> 'menge')::integer, g.liga)
        on conflict on constraint liga_belohnungen_einmal do nothing;
      end if;
      if neu > g.stufe and neu % 3 = 0 and not exists (
        select 1 from public.liga_belohnungen x
        where x.user_id = r.user_id and x.art = 'aufstieg-banner' and x.stufe = neu) then
        insert into public.liga_belohnungen (user_id, woche, stufe, platz, art, menge, liga)
        values (r.user_id, g.woche, neu, r.platz, 'aufstieg-banner', 1, g.liga)
        on conflict on constraint liga_belohnungen_einmal do nothing;
      end if;
      if pg_catalog.to_regprocedure('public.karte_liga_banner_nachtragen(uuid)') is not null then
        perform public.karte_liga_banner_nachtragen(r.user_id);
      end if;
    end loop;
    update public.liga_gruppen x set abgerechnet = true where x.id = g.id;
  end loop;
  perform public.liga_alte_wochen_loeschen();
end;
$$;

revoke all on function public.liga_abrechnen() from public, anon, authenticated;

drop function if exists public.saison_karte_der_partie(uuid);
drop function if exists public.saison_karte_von(uuid);
drop function if exists public.saison_titel_waehle(text);
drop function if exists public.saison_mein_stand();
drop function if exists public.saison_abrechnen();
drop function if exists public.saison_beginn(integer);
drop function if exists public.saison_nummer(date);
drop function if exists public.saison_konstanten();
drop table if exists public.saison_wahl;
drop table if exists public.saison_titel;
drop table if exists public.saison_abzeichen;
drop table if exists public.saison_abrechnungen;

-- VORSCHLAG (13.11.2026, Feinschliff R15), NOCH NICHT EINGESPIELT: der Gegner einer Online-Partie sieht die Sondertitel
-- "Der Erfinder" und "Pionier Nr. <n>" auf der Visitenkarte, aber nur, wenn der Server den Besitz bestaetigt. Die feste
-- Titelliste von karte_waehle bleibt unberuehrt (Erfinder und Pionier stehen dort bewusst nicht); der Besitzer meldet
-- den Sondertitel einzeln mit karte_sondertitel_waehle (js/karte.js). Der Server prueft den Besitz in sonderstuecke
-- (supabase/werkstatt-schema.sql, pionier-schema.sql) beim Speichern UND beim Lesen: ist das Stueck weg, zeigt die Karte
-- keinen Sondertitel mehr. Ein gewaehlter normaler Titel geht vor. karte_von wird ersetzt (Fassung aus karte-schema.sql
-- plus der Titelzeile); ihr einziger Aufrufer ist karte_der_partie, die unveraendert bleibt (auch die Elo-Fassung).
-- Gespeichert wird in der neuen Spalte karte_wahl.sondertitel, nicht in einer eigenen Tabelle: so steht die Meldung ohne
-- Aenderung an daten-schema.sql in der Datenauskunft (meine_daten() gibt die ganze Zeile karte_wahl aus), und
-- karte_waehle (schreibt nur ihre eigenen Spalten) laesst sie stehen.
-- Datenschutz: den Sondertitel sieht nur der Gegner derselben Partie; vor dem Einspielen pruefen, ob
-- datenschutz.html / datenschutz-en.html (Abschnitt Visitenkarte) das schon abdecken.
-- Einspielen (Flo, nie Claude): nach karte-, werkstatt- und pionier-schema.sql (und karte-elo-schema.sql, falls
-- gewuenscht, die Reihenfolge der beiden ist egal) im SQL Editor; danach  notify pgrst, 'reload schema';
-- Rueckweg: supabase/karte-sondertitel-zurueck.sql. Test: tests/server-karte-sondertitel.test.mjs. Wiederholbar.

alter table public.karte_wahl add column if not exists sondertitel text;
alter table public.karte_wahl drop constraint if exists karte_wahl_sondertitel;
alter table public.karte_wahl add constraint karte_wahl_sondertitel check (sondertitel is null or sondertitel in ('erfinder', 'pionier'));

-- Stueck-Id des Sondertitels, wenn uid es JETZT besitzt ('erfinder-titel' bzw. 'pionier-NNN'), sonst null. Ohne Tabelle
-- sonderstuecke (Werkstatt nicht eingespielt) besitzt niemand etwas; daher to_regclass und execute.
create or replace function public.karte_sonderstueck(uid uuid, titel text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  stueck text;
begin
  if uid is null or titel is null or to_regclass('public.sonderstuecke') is null then
    return null;
  end if;
  if titel = 'erfinder' then
    execute 'select s.stueck_id from public.sonderstuecke s where s.user_id = $1 and s.stueck_id = ''erfinder-titel'' limit 1'
      into stueck using uid;
  elsif titel = 'pionier' then
    execute 'select s.stueck_id from public.sonderstuecke s where s.user_id = $1 and s.stueck_id ~ ''^pionier-[0-9]{3}$'' order by s.stueck_id limit 1'
      into stueck using uid;
  end if;
  return stueck;
end;
$$;

-- titel null loescht die Meldung; 'erfinder' oder 'pionier' nur mit dem Stueck im Besitz, sonst KARTE_TITEL
create or replace function public.karte_sondertitel_waehle(titel text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'KARTE_ANMELDUNG';
  end if;
  if titel is null then
    update public.karte_wahl w set sondertitel = null where w.user_id = uid;
    return jsonb_build_object('titel', null);
  end if;
  if titel not in ('erfinder', 'pionier') or public.karte_sonderstueck(uid, titel) is null then
    raise exception 'KARTE_TITEL';
  end if;
  insert into public.karte_wahl (user_id, sondertitel) values (uid, titel)
  on conflict (user_id) do update set sondertitel = excluded.sondertitel;
  return jsonb_build_object('titel', titel);
end;
$$;

create or replace function public.karte_von(uid uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.karte_wahl;
  name text;
  stufe integer;
  sonder text;
begin
  select * into w from public.karte_wahl x where x.user_id = uid;
  select p.benutzername into name from public.profile p where p.user_id = uid;
  select s.stufe into stufe from public.kronen_stand s where s.user_id = uid;
  -- Sondertitel nur, wenn kein normaler Titel gewaehlt ist und das Stueck noch im Besitz ist
  if w.titel is null then
    sonder := public.karte_sonderstueck(uid, w.sondertitel);
  end if;
  return jsonb_build_object(
    'name', name,
    -- ein Banner, das nicht (mehr) im Besitz ist, zeigt das Start-Banner
    'banner', case when w.banner is not null and exists (select 1 from public.banner_besitz b where b.user_id = uid and b.banner = w.banner)
                   then w.banner else 'start' end,
    'titel', coalesce(w.titel, case when sonder = 'erfinder-titel' then 'erfinder' else sonder end),
    'vitrine', coalesce((select jsonb_agg(jsonb_build_object('familie', substr(v, 7), 'stufe',
        (select max(s.stufe) from public.karte_stufen s where s.user_id = uid and s.familie = substr(v, 7))) order by o)
      from unnest(w.vitrine) with ordinality as x(v, o)), '[]'::jsonb),
    'motiv', coalesce(w.motiv, 'P'), 'grund', coalesce(w.grund, 'standard'), 'rahmen', coalesce(w.rahmen, 'ohne'),
    'kronen_stufe', stufe
  );
end;
$$;

revoke all on function public.karte_von(uuid) from public, anon, authenticated;
revoke all on function public.karte_sonderstueck(uuid, text) from public, anon, authenticated;
revoke all on function public.karte_sondertitel_waehle(text) from public, anon, authenticated;
grant execute on function public.karte_sondertitel_waehle(text) to authenticated;

-- VORSCHLAG (R27 Online Arena, Flo 21.11.2026: "in der Weltrangliste die Banner UND Profilbilder der anderen sehen"), NICHT
-- eingespielt. Erweitert public.weltrang_liste (supabase/weltrang-schema.sql) je Zeile und im eigenen Stand um das Profilbild:
-- motiv, grund, rahmen aus karte_wahl, genau wie karte_von sie jedem Gegner zeigt. Nur Werte aus den festen Listen von
-- karte_konstanten (karte_in_liste), alles andere wird zum Standard (P, standard, ohne). Das Banner war schon dabei (nur im
-- Besitz, sonst 'start'). Keine Kennung, keine Mail, keine Werkstatt-Sonderstuecke: die stehen nicht in karte_wahl.
-- Voraussetzung: weltrang-schema.sql und karte-schema.sql sind eingespielt. Rechte unveraendert (nur authenticated).
-- Die App kommt ohne diesen Vorschlag aus: fehlt motiv, zeigt der Kopf Banner und Anfangsbuchstaben (js/ui/online.js zeigeRang).
-- Rueckweg: supabase/weltrang-karte-zurueck.sql (stellt die Fassung aus weltrang-schema.sql zeichengleich wieder her).
-- Wache: tests/server-weltrang-karte.test.mjs (PGlite; prueft auch, dass die Funktion hier bis auf die drei Zusaetze und der
-- Rueckweg zeichengleich mit weltrang-schema.sql sind).
-- Wiederholbar.
create or replace function public.weltrang_liste(grenze integer default 100)
returns jsonb
language plpgsql
-- bewusst nicht stable: weltrang_mitmachen ruft sie direkt nach dem eigenen insert/delete auf, eine stable-Funktion
-- saehe noch den Stand vom Beginn der Anfrage
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  ab constant integer := 15;
  ab_start constant integer := 30;
  n integer := least(greatest(coalesce(grenze, 100), 1), 100);
  dabei boolean;
  hat_name boolean;
  partien integer;
  selbst boolean;
  liste jsonb;
  ich jsonb;
begin
  if uid is null then
    raise exception 'WELTRANG_OHNE_KONTO';
  end if;
  dabei := exists (select 1 from public.weltrang_teilnahme t where t.user_id = uid and t.alter_bestaetigt_am is not null);
  hat_name := exists (select 1 from public.profile p where p.user_id = uid);
  select coalesce(s.elo_n, 0), s.start_gesetzt into partien, selbst from public.kronen_stand s where s.user_id = uid;
  partien := coalesce(partien, 0);
  selbst := coalesce(selbst, false);

  with wertung as (
    select t.user_id, p.benutzername as name, s.elo,
           case when w.banner is not null and exists (select 1 from public.banner_besitz b
                                                      where b.user_id = t.user_id and b.banner = w.banner)
                then w.banner else 'start' end as banner,
           -- R27: das Profilbild wie karte_von, nur Werte aus den festen Listen (karte_konstanten), sonst der Standard
           case when public.karte_in_liste('motive', w.motiv) then w.motiv else 'P' end as motiv,
           case when public.karte_in_liste('gruende', w.grund) then w.grund else 'standard' end as grund,
           case when public.karte_in_liste('rahmen', w.rahmen) then w.rahmen else 'ohne' end as rahmen,
           rank() over (order by s.elo desc) as rang
    from public.weltrang_teilnahme t
    join public.profile p on p.user_id = t.user_id
    join public.kronen_stand s on s.user_id = t.user_id
    left join public.karte_wahl w on w.user_id = t.user_id
    where t.alter_bestaetigt_am is not null
      and s.elo_n >= case when s.start_gesetzt then ab_start else ab end
  ),
  oben as (
    select * from wertung order by rang, lower(name), name limit n
  )
  select
    (select coalesce(jsonb_agg(jsonb_build_object('rang', o.rang, 'name', o.name, 'banner', o.banner, 'elo', o.elo,
              'motiv', o.motiv, 'grund', o.grund, 'rahmen', o.rahmen, 'ich', o.user_id = uid) order by o.rang, lower(o.name), o.name), '[]'::jsonb) from oben o),
    (select jsonb_build_object('status', 'dabei', 'rang', x.rang, 'elo', x.elo, 'name', x.name, 'banner', x.banner,
                               'motiv', x.motiv, 'grund', x.grund, 'rahmen', x.rahmen)
       from wertung x where x.user_id = uid)
    into liste, ich;

  if ich is null then
    ich := case
      when not dabei then jsonb_build_object('status', 'nicht_dabei')
      when not hat_name then jsonb_build_object('status', 'ohne_name')
      else jsonb_build_object('status', 'zaehlt_noch', 'fehlen', greatest(case when selbst then ab_start else ab end - partien, 1))
    end;
  end if;
  return jsonb_build_object('ab', ab, 'ab_start', ab_start, 'teilnahme', dabei, 'liste', liste, 'ich', ich);
end;
$$;

revoke all on function public.weltrang_liste(integer) from public, anon, authenticated;
grant execute on function public.weltrang_liste(integer) to authenticated;

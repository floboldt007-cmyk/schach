-- Liga-Gruppe mit Profilbild und Banner (G-002, Auftrag U-2, 08.11.2026; Flos Wahl "Liga Variante A").
-- Ersetzt NUR public.liga_meine_gruppe() aus supabase/kronen-schema.sql: je menschlichem Mitglied kommen dazu
--   motiv, grund, rahmen   das gewaehlte Profilbild (Figur, Hintergrund, Rahmen) aus karte_wahl
--   banner                 das getragene Banner, nur wenn es im Besitz ist (sonst 'start', wie karte_von)
-- Titel, Vitrine, Elo, E-Mail und Nutzerkennungen bleiben aussen vor (Datenschutzerklaerung Abschnitt Liga, "Wer was sieht").
-- KI-Mitspieler bekommen nichts davon (der Client zeichnet sie mit Zeichen KI).
-- Voraussetzung: kronen-schema.sql und karte-schema.sql sind eingespielt. Einspielen: im SQL Editor ausfuehren. Wiederholbar.
-- Rueckweg: supabase/liga-bild-zurueck.sql (stellt die Fassung aus kronen-schema.sql wieder her, Daten bleiben unberuehrt).
-- NICHT von Claude einspielen: Flo spielt Supabase-Aenderungen selbst ein.

-- Die eigene Gruppe dieser Woche fuer den Liga-Reiter: { woche, ende, stufe, gruppe, platz, n, mitglieder, belohnung,
-- offen }. mitglieder [{ platz, name, kronen, ki, ich, motiv?, grund?, rahmen?, banner? }] in Rangfolge; ohne Gruppe gruppe null und mitglieder [].
-- offen sind gemerkte, noch nicht ausgezahlte Belohnungen [{ woche, platz, art, menge }].
create or replace function public.liga_meine_gruppe()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  st public.kronen_stand;
  k jsonb := public.kronen_konstanten();
  wo date := public.liga_woche_heute();
  m public.liga_mitglieder;
  liste jsonb := '[]'::jsonb;
  mein_platz integer;
begin
  st := public.kronen_stand_sichern(auth.uid());
  select * into m from public.liga_mitglieder x where x.user_id = st.user_id and x.woche = wo
    -- Zwei Ligen (zwei-ligen-schema.sql): nur die Online-Gruppe; ohne die Spalte liga ist jede Gruppe online
    and coalesce(to_jsonb(x) ->> 'liga', 'online') = 'online';
  if m.gruppe is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
        'platz', r.platz,
        'name', case when r.ki then b.name else public.liga_name(r.user_id) end,
        'kronen', r.kronen, 'ki', r.ki, 'ich', r.user_id is not distinct from st.user_id)
        -- Profilbild und Banner nur fuer Menschen (G-002); ein Banner ohne Besitz zeigt das Start-Banner wie karte_von
        || case when r.ki or r.user_id is null then '{}'::jsonb else jsonb_build_object(
             'motiv', coalesce(w.motiv, 'P'), 'grund', coalesce(w.grund, 'standard'), 'rahmen', coalesce(w.rahmen, 'ohne'),
             'banner', case when w.banner is not null and exists (select 1 from public.banner_besitz bb
                                                                  where bb.user_id = r.user_id and bb.banner = w.banner)
                            then w.banner else 'start' end) end
        order by r.platz), '[]'::jsonb)
      into liste
    from public.liga_rangliste(m.gruppe, false) r
    left join public.liga_bots(m.gruppe, false) b on r.ki and b.nr = r.nr
    left join public.karte_wahl w on not r.ki and w.user_id = r.user_id;
    select r.platz into mein_platz from public.liga_rangliste(m.gruppe, false) r where r.user_id = st.user_id;
  end if;
  return jsonb_build_object(
    'woche', wo,
    'ende', wo + 6,
    'stufe', st.stufe,
    'gruppe', m.gruppe,
    'platz', mein_platz,
    'n', (k ->> 'gruppe_groesse')::integer,
    'mitglieder', liste,
    'belohnung', k -> 'belohnung',
    -- Schummel-Schutz: Bot- und KI-Gewinne dieser Woche gegen den Deckel (der Client zeigt "diese Woche voll")
    'bot_ki', jsonb_build_object('genutzt', public.liga_bot_ki_genutzt(st.user_id, wo),
      'max', (k ->> 'bot_ki_wochen_max')::integer),
    'offen', coalesce((select jsonb_agg(jsonb_build_object('woche', x.woche, 'platz', x.platz, 'art', x.art, 'menge', x.menge)
                         order by x.woche, x.art)
                       from public.liga_belohnungen x where x.user_id = st.user_id and not x.ausgezahlt
                         and coalesce(to_jsonb(x) ->> 'liga', 'online') = 'online'), '[]'::jsonb)
  );
end;
$$;

-- Rechte: alles zu, nur Stand, Gruppe und Konstanten fuer angemeldete Nutzer

revoke all on function public.liga_meine_gruppe() from public, anon, authenticated;
grant execute on function public.liga_meine_gruppe() to authenticated;

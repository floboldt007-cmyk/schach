-- Rueckweg fuer supabase/liga-bild-schema.sql: liga_meine_gruppe() wieder ohne Profilbild und Banner (Fassung aus
-- supabase/kronen-schema.sql). Aendert keine Daten, nur die Funktion. Danach zeigt die App wieder Initialen statt Bildern.
-- Wiederholbar.

-- Die eigene Gruppe dieser Woche fuer den Liga-Reiter: { woche, ende, stufe, gruppe, platz, n, mitglieder, belohnung,
-- offen }. mitglieder [{ platz, name, kronen, ki, ich }] in Rangfolge; ohne Gruppe gruppe null und mitglieder [].
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
  select * into m from public.liga_mitglieder x where x.user_id = st.user_id and x.woche = wo;
  if m.gruppe is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
        'platz', r.platz,
        'name', case when r.ki then b.name else public.liga_name(r.user_id) end,
        'kronen', r.kronen, 'ki', r.ki, 'ich', r.user_id is not distinct from st.user_id) order by r.platz), '[]'::jsonb)
      into liste
    from public.liga_rangliste(m.gruppe, false) r
    left join public.liga_bots(m.gruppe, false) b on r.ki and b.nr = r.nr;
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
                       from public.liga_belohnungen x where x.user_id = st.user_id and not x.ausgezahlt), '[]'::jsonb)
  );
end;
$$;

-- Rechte: alles zu, nur Stand, Gruppe und Konstanten fuer angemeldete Nutzer

revoke all on function public.liga_meine_gruppe() from public, anon, authenticated;
grant execute on function public.liga_meine_gruppe() to authenticated;

-- VORSCHLAG (11.11.2026, Feinschliff R2), NOCH NICHT EINGESPIELT: karte_der_partie schickt in GEWERTETEN Partien die
-- Online-Elo beider Spieler mit (Feld elo aus kronen_stand), damit Leiste und Duell-Intro die Elo zeigen statt nur
-- die Liga (js/ui/online.js liest roh.elo schon, 100 bis 4000). Freundespartien bleiben ohne Elo. Wer kein
-- kronen_stand hat, bekommt elo null (die App zeigt dann die Liga).
-- Datenschutz: Die Elo sieht nur der Gegner derselben gewerteten Partie; vor dem Einspielen pruefen, ob
-- datenschutz.html / datenschutz-en.html (Abschnitt Visitenkarte) das schon abdecken.
-- Einspielen (Flo, nie Claude): nach karte-, kronen- und zwei-ligen-schema.sql im SQL Editor; danach
-- notify pgrst, 'reload schema';  Rueckweg: supabase/karte-elo-zurueck.sql. Test: tests/server-karte-elo.test.mjs.
-- Wiederholbar.

create or replace function public.karte_der_partie(partie uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  p public.partien_online;
begin
  if uid is null then
    raise exception 'KARTE_ANMELDUNG';
  end if;
  select * into p from public.partien_online x where x.id = partie;
  if p.id is null or (p.weiss is distinct from uid and p.schwarz is distinct from uid) then
    raise exception 'KARTE_KEINE_PARTIE';
  end if;
  -- du: welche der beiden Karten die eigene ist (statt einer Konto-Kennung); elo nur in gewerteten Partien
  return jsonb_build_object(
    'w', case when p.weiss is null then null else public.karte_von(p.weiss) || jsonb_build_object('du', p.weiss = uid)
      || case when p.gewertet then jsonb_build_object('elo', (select st.elo from public.kronen_stand st where st.user_id = p.weiss))
              else '{}'::jsonb end end,
    's', case when p.schwarz is null then null else public.karte_von(p.schwarz) || jsonb_build_object('du', p.schwarz = uid)
      || case when p.gewertet then jsonb_build_object('elo', (select st.elo from public.kronen_stand st where st.user_id = p.schwarz))
              else '{}'::jsonb end end
  );
end;
$$;

revoke all on function public.karte_der_partie(uuid) from public, anon, authenticated;
grant execute on function public.karte_der_partie(uuid) to authenticated;

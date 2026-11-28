-- Obergrenze der Wochenwertung je gemeldeter Partie (T-012, R31 27.11.2026; Gehalt aus PR #206 vom 09.11.2026).
-- Heute nimmt wochenpunkte_melden (freunde-schema.sql) bis zu 100.000 Punkte JE PARTIE an; die Freunde-Rangliste zeigt,
-- was die App meldet. Diese Datei senkt die Grenze auf 50.000 und legt die Zahl in eine eigene Funktion.
--
-- Woher die Zahl kommt (js/pakete/punkte/formel.js, Rechenstand STAND = 1, unveraendert seit dem 09.11.2026):
--   feste Teile hoechstens 10.800 (Sieg 4.000, Verwertung 3.000, Weisse Weste 2.000, Uhr 1.000, Theorie 800),
--   dazu hoechstens 40 offene Zuege (Genial 1.200, Goldrichtig 800, Praezise 500) mit COMBO-Zuschlag bis +200 %.
--   Rechnerisches Maximum 154.800 (40 x Genial mit voller COMBO, nur mit Engine-Hilfe denkbar); 40 x Praezise mit
--   voller COMBO 70.800. Die staerksten Bot-Laeufe im Repo (daten/punkte/bot-laeufe.json, 32 Partien) liegen bei
--   hoechstens 27.150, im Median bei 13.200. Gemeldet wird die Summe der BESTEN Partie je Tafel, geteilt wird durch die
--   Zahl ALLER Partien der Woche: der Schnitt je gemeldeter Partie liegt bei ehrlichem Spiel also noch tiefer.
--   Aendert sich die Formel (STAND), hier nachziehen.
-- Ueber der Grenze lehnt der Server die ganze Meldung ab ('werte'), wie heute bei 100.000; der zuletzt gemeldete Stand
-- bleibt stehen (er sinkt nie).
--
-- WICHTIG: freunde-schema.sql definiert wochenpunkte_melden mit 100.000. Wer freunde-schema.sql erneut einspielt, spielt
-- danach diese Datei noch einmal ein (tests/server-freunde-grenze.test.mjs zeigt, dass sonst wieder 100.000 gelten).
-- Voraussetzung: schema.sql und freunde-schema.sql. Einspielen nur Flo (SQL Editor). Wiederholbar.
-- Rueckweg: freunde-grenze-zurueck.sql (zurueck auf 100.000, es gehen keine Daten verloren).

-- Nur intern (kein Recht fuer anon oder authenticated); wochenpunkte_melden laeuft als security definer.
create or replace function public.wochenpunkte_je_partie_max()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 50000
$$;

create or replace function public.wochenpunkte_melden(woche date, punkte integer, partien integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  heute date := public.freund_diese_woche();
begin
  if uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  -- diese oder letzte Woche (eine Partie kurz vor Mitternacht am Sonntag darf noch nachkommen)
  if woche is null or extract(isodow from woche) <> 1 or woche not in (heute, heute - 7) then
    return jsonb_build_object('ergebnis', 'woche');
  end if;
  if punkte is null or partien is null or punkte < 0 or partien < 0 or partien > 1000 or punkte > partien * public.wochenpunkte_je_partie_max() then
    return jsonb_build_object('ergebnis', 'werte');
  end if;
  insert into public.wochenpunkte as w (user_id, woche, punkte, partien, aktualisiert_am)
  values (uid, wochenpunkte_melden.woche, wochenpunkte_melden.punkte, wochenpunkte_melden.partien, now())
  on conflict (user_id, woche) do update
    set punkte = greatest(w.punkte, excluded.punkte), partien = greatest(w.partien, excluded.partien), aktualisiert_am = now();
  return jsonb_build_object('ergebnis', 'ok');
end;
$$;


revoke all on function public.wochenpunkte_je_partie_max() from anon, authenticated, service_role, public;
revoke all on function public.wochenpunkte_melden(date, integer, integer) from anon, authenticated, service_role, public;
grant execute on function public.wochenpunkte_melden(date, integer, integer) to authenticated;

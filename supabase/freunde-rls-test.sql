-- Prueft die Wochenwertung aus supabase/freunde-schema.sql im Supabase SQL Editor (als Besitzer). Alles wird am Ende
-- zurueckgerollt. Ein kurzlebiger Nutzer. Jeder Fehler bricht mit "FEHLER: ..." ab; ohne Fehler meldet der Lauf
-- "Freunde-RLS-Test erfolgreich" und rollt zurueck.
-- Abschnitte: 1 ehrliche Meldung (zaehlt, sinkt nie); 2 Missbrauch aus dem Audit vom 09.11.2026 (mehr als 50.000 Punkte
-- je Partie, fremde Wochen, negative Werte); 3 Bestand (eine alte Zeile ueber der neuen Grenze bleibt und stoert spaetere
-- ehrliche Meldungen nicht); 4 keine Tabellenrechte, anon darf nichts.
begin;

insert into auth.users (id, email) values ('a2a2a2a2-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'freunde-a@example.invalid');
insert into public.profile (user_id, benutzername) values ('a2a2a2a2-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'freunde_a');

-- der Montag dieser Woche (die Funktion des Schemas ist fuer Nutzer gesperrt)
create function pg_temp.woche()
returns date
language sql
security definer
set search_path = ''
as $$
  select public.freund_diese_woche();
$$;
create function pg_temp.zeile(wo date)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select to_jsonb(w) from public.wochenpunkte w where w.user_id = 'a2a2a2a2-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and w.woche = wo;
$$;
-- eine Zeile aus der Zeit vor der neuen Grenze (letzte Woche, 90.000 Punkte in einer Partie)
create function pg_temp.alte_zeile()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.wochenpunkte (user_id, woche, punkte, partien)
  values ('a2a2a2a2-aaaa-4aaa-8aaa-aaaaaaaaaaaa', pg_temp.woche() - 7, 90000, 1);
$$;
revoke all on function pg_temp.zeile(date), pg_temp.alte_zeile(), pg_temp.woche() from public;
grant execute on function pg_temp.zeile(date), pg_temp.woche() to authenticated, anon;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a2a2a2a2-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);

-- ---------- 1. Ehrliche Meldung ----------
do $$
declare
  wo date := pg_temp.woche();
  r jsonb;
begin
  r := public.wochenpunkte_melden(wo, 27150, 1);
  if r ->> 'ergebnis' <> 'ok' or (pg_temp.zeile(wo) ->> 'punkte')::integer <> 27150 then raise exception 'FEHLER: ehrliche Meldung % %', r, pg_temp.zeile(wo); end if;
  -- genau an der Grenze: 50.000 je Partie
  r := public.wochenpunkte_melden(wo, 150000, 3);
  if r ->> 'ergebnis' <> 'ok' or (pg_temp.zeile(wo) ->> 'punkte')::integer <> 150000 then raise exception 'FEHLER: Meldung an der Grenze % %', r, pg_temp.zeile(wo); end if;
  -- sinkt nie (zweites Geraet mit aelterem Stand)
  r := public.wochenpunkte_melden(wo, 1000, 2);
  if r ->> 'ergebnis' <> 'ok' or (pg_temp.zeile(wo) ->> 'punkte')::integer <> 150000 or (pg_temp.zeile(wo) ->> 'partien')::integer <> 3 then
    raise exception 'FEHLER: Wochenwertung sinkt % %', r, pg_temp.zeile(wo);
  end if;
end;
$$;

-- ---------- 2. Missbrauch ----------
do $$
declare
  wo date := pg_temp.woche();
  r jsonb;
begin
  -- das alte Loch: 100.000 Punkte je Partie
  r := public.wochenpunkte_melden(wo, 100000, 1);
  if r ->> 'ergebnis' <> 'werte' then raise exception 'FEHLER: 100.000 Punkte in einer Partie angenommen %', r; end if;
  r := public.wochenpunkte_melden(wo, 50001, 1);
  if r ->> 'ergebnis' <> 'werte' then raise exception 'FEHLER: 50.001 Punkte in einer Partie angenommen %', r; end if;
  r := public.wochenpunkte_melden(wo, 100000000, 1000);
  if r ->> 'ergebnis' <> 'werte' then raise exception 'FEHLER: 100 Millionen Punkte angenommen %', r; end if;
  r := public.wochenpunkte_melden(wo, 1, 0);
  if r ->> 'ergebnis' <> 'werte' then raise exception 'FEHLER: Punkte ohne Partie angenommen %', r; end if;
  r := public.wochenpunkte_melden(wo, 10, 1001);
  if r ->> 'ergebnis' <> 'werte' then raise exception 'FEHLER: 1001 Partien angenommen %', r; end if;
  r := public.wochenpunkte_melden(wo, -1, 1);
  if r ->> 'ergebnis' <> 'werte' then raise exception 'FEHLER: negative Punkte angenommen %', r; end if;
  r := public.wochenpunkte_melden(wo - 14, 10, 1);
  if r ->> 'ergebnis' <> 'woche' then raise exception 'FEHLER: alte Woche angenommen %', r; end if;
  r := public.wochenpunkte_melden(wo + 7, 10, 1);
  if r ->> 'ergebnis' <> 'woche' then raise exception 'FEHLER: kommende Woche angenommen %', r; end if;
  -- nichts davon hat den Stand veraendert
  if (pg_temp.zeile(wo) ->> 'punkte')::integer <> 150000 or (pg_temp.zeile(wo) ->> 'partien')::integer <> 3 then
    raise exception 'FEHLER: abgelehnte Meldung hat den Stand veraendert %', pg_temp.zeile(wo);
  end if;
end;
$$;

-- ---------- 3. Bestand ----------
reset role;
select pg_temp.alte_zeile();
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a2a2a2a2-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  wo date := pg_temp.woche() - 7;
  r jsonb;
begin
  r := public.wochenpunkte_melden(wo, 20000, 2);
  if r ->> 'ergebnis' <> 'ok' or (pg_temp.zeile(wo) ->> 'punkte')::integer <> 90000 or (pg_temp.zeile(wo) ->> 'partien')::integer <> 2 then
    raise exception 'FEHLER: alte Zeile verloren oder Meldung gescheitert % %', r, pg_temp.zeile(wo);
  end if;
end;
$$;

-- ---------- 4. Keine Tabellenrechte, anon darf nichts ----------
do $$
begin
  begin
    perform count(*) from public.wochenpunkte;
    raise exception 'FEHLER: Nutzer liest wochenpunkte';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.wochenpunkte_je_partie_max();
    raise exception 'FEHLER: Hilfsfunktion vom Geraet aufrufbar';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
set local role anon;
do $$
begin
  perform public.wochenpunkte_melden(pg_temp.woche(), 10, 1);
  raise exception 'FEHLER: anon meldet Wochenpunkte';
exception when insufficient_privilege then null;
end;
$$;
reset role;

do $$ begin raise notice 'Freunde-RLS-Test erfolgreich'; end; $$;
rollback;

-- Prueft supabase/karte-schema.sql im Supabase SQL Editor (als Besitzer, wie dort ueblich). Alles wird am Ende
-- zurueckgerollt. Drei kurzlebige Nutzer A, B, C; A und B spielen eine Online-Partie, C ist unbeteiligt.
-- Jeder Fehler bricht mit "FEHLER: ..." ab; ohne Fehler meldet der Lauf "Karte-RLS-Test erfolgreich" und rollt zurueck.
-- Abschnitte: 1 Start (Start-Banner, leerer Stand); 2 Stufen melden (der Reihe nach, einmal, Taler, Gold-Banner,
-- falsche Meldungen, liga wird ignoriert); 3 Liga-Stufen aus den Kronen, Liga-Banner nur per Server-Gutschrift; 4 Karte waehlen (nur Besitz, feste
-- Listen, Vitrine); 5 Karte der Partie (nur Teilnehmer); 6 keine Tabellenrechte, anon darf nichts.
begin;

insert into auth.users (id, email)
values
  ('a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'karte-a@example.invalid'),
  ('b1b1b1b1-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'karte-b@example.invalid'),
  ('c1c1c1c1-cccc-4ccc-8ccc-cccccccccccc', 'karte-c@example.invalid');
insert into public.profile (user_id, benutzername)
values ('a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'karte_a'), ('b1b1b1b1-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'karte_b');

-- Testhilfen als Besitzer (Nutzer duerfen weder Kronen noch Partien direkt schreiben)
create function pg_temp.setze_stufe(uid uuid, st integer)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.kronen_stand (user_id, stufe) values (uid, st)
  on conflict (user_id) do update set stufe = excluded.stufe;
$$;
-- eine schon abgerechnete Wochen-Gruppe der Vorwoche in Stufe st, ohne Belohnung
create function pg_temp.alte_gruppe(uid uuid, st integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid bigint;
begin
  insert into public.liga_gruppen (woche, stufe, abgerechnet) values (public.liga_woche_heute() - 7, st, true)
  returning id into gid;
  insert into public.liga_mitglieder (gruppe, user_id, woche) values (gid, uid, public.liga_woche_heute() - 7);
end;
$$;
create function pg_temp.partie()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  p uuid;
begin
  -- wie kronen-rls-test.sql: anlegen (der Code entsteht dabei), dann beide Spieler eintragen
  insert into public.partien_online (erstellt_von, fen) values ('a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'egal') returning id into p;
  update public.partien_online set weiss = 'a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa', schwarz = 'b1b1b1b1-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    status = 'laeuft' where id = p;
  return p;
end;
$$;
revoke all on function pg_temp.setze_stufe(uuid, integer), pg_temp.alte_gruppe(uuid, integer), pg_temp.partie() from public;
create temp table karte_test_partie as select pg_temp.partie() as id;
grant select on karte_test_partie to authenticated, anon;

-- ---------- 1. Start ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  s jsonb := public.karte_mein_stand();
begin
  if (s ->> 'taler')::integer <> 0 then raise exception 'FEHLER: neuer Stand hat Taler %', s; end if;
  if s -> 'banner' <> '["start"]'::jsonb then raise exception 'FEHLER: Start-Banner fehlt %', s; end if;
  if s -> 'stufen' <> '{}'::jsonb then raise exception 'FEHLER: neuer Stand hat Stufen %', s; end if;
  if s -> 'wahl' ->> 'banner' <> 'start' then raise exception 'FEHLER: Standard-Banner nicht start %', s; end if;
end;
$$;

-- ---------- 2. Stufen melden ----------
do $$
declare
  s jsonb;
begin
  -- Sprung auf Silber bucht Bronze und Silber (der Reihe nach), zahlt 20 + 50
  s := public.karte_melde_stufen('{"siege": 2}');
  if (s ->> 'taler')::integer <> 70 or (s -> 'stufen' ->> 'siege')::integer <> 2 then raise exception 'FEHLER: Sprung auf Silber %', s; end if;
  -- doppelt gemeldet zahlt nicht doppelt
  s := public.karte_melde_stufen('{"siege": 2}');
  if (s ->> 'taler')::integer <> 70 then raise exception 'FEHLER: doppelte Meldung zahlt doppelt %', s; end if;
  -- niedriger gemeldet nimmt nichts weg
  s := public.karte_melde_stufen('{"siege": 0}');
  if (s -> 'stufen' ->> 'siege')::integer <> 2 then raise exception 'FEHLER: Meldung 0 nimmt Stufen weg %', s; end if;
  -- Gold Raetsel: drei Stufen, 190 Taler, Banner Raetselmeister
  s := public.karte_melde_stufen('{"raetsel": 3}');
  if (s ->> 'taler')::integer <> 260 or not (s -> 'banner') ? 'erfolg-raetselmeister' then raise exception 'FEHLER: Gold Raetsel %', s; end if;
  -- liga meldet niemand: wird ignoriert
  s := public.karte_melde_stufen('{"liga": 3}');
  if s -> 'stufen' ? 'liga' then raise exception 'FEHLER: liga per Meldung gebucht %', s; end if;
end;
$$;
do $$
begin
  begin
    perform public.karte_melde_stufen('{"gibtsnicht": 1}');
    raise exception 'FEHLER: unbekannte Familie angenommen';
  exception when raise_exception then
    if sqlerrm like 'FEHLER%' then raise; end if;
  end;
  begin
    perform public.karte_melde_stufen('{"serie": 4}');
    raise exception 'FEHLER: Stufe 4 angenommen';
  exception when raise_exception then
    if sqlerrm like 'FEHLER%' then raise; end if;
  end;
  begin
    perform public.karte_melde_stufen('{"serie": "2"}');
    raise exception 'FEHLER: Stufe als Text angenommen';
  exception when raise_exception then
    if sqlerrm like 'FEHLER%' then raise; end if;
  end;
  begin
    perform public.karte_melde_stufen('[1]');
    raise exception 'FEHLER: Liste statt Objekt angenommen';
  exception when raise_exception then
    if sqlerrm like 'FEHLER%' then raise; end if;
  end;
end;
$$;
reset role;

-- ---------- 3. Liga-Stufen aus den Kronen, Liga-Banner nur per Gutschrift ----------
select pg_temp.setze_stufe('a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 9);
select pg_temp.alte_gruppe('a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 7);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  s jsonb := public.karte_mein_stand();
begin
  -- Stufe 9 (Turm III): liga Bronze und Silber. Eine fruehere Gruppe ohne Belohnung gibt KEIN Banner (Konzept 5a)
  if (s -> 'stufen' ->> 'liga')::integer <> 2 then raise exception 'FEHLER: Liga-Stufen aus Kronen %', s; end if;
  if (s -> 'banner') ? 'saison-silber' then raise exception 'FEHLER: Banner aus dem Archiv %', s; end if;
  if (s ->> 'taler')::integer <> 260 + 70 then raise exception 'FEHLER: Liga-Stufen zahlen keine Taler %', s; end if;
end;
$$;
-- Das Geraet darf sich kein Banner gutschreiben
do $$
begin
  perform public.karte_banner_gutschreiben('a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'saison-silber');
  raise exception 'FEHLER: Gutschrift vom Geraet moeglich';
exception when insufficient_privilege then null;
end;
$$;
reset role;
-- Der Server (Liga-Umbau) schreibt gut: einmal, nur Liga-Banner, nur echte Konten
do $$
begin
  if not public.karte_banner_gutschreiben('a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'saison-silber') then
    raise exception 'FEHLER: Gutschrift nicht gebucht';
  end if;
  if public.karte_banner_gutschreiben('a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'saison-silber') then
    raise exception 'FEHLER: Gutschrift doppelt';
  end if;
  begin
    perform public.karte_banner_gutschreiben('a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'erfolg-raetselmeister');
    raise exception 'FEHLER: Erfolgs-Banner per Gutschrift';
  exception when raise_exception then
    if sqlerrm <> 'KARTE_BANNER' then raise; end if;
  end;
  begin
    perform public.karte_banner_gutschreiben('d1d1d1d1-dddd-4ddd-8ddd-dddddddddddd', 'saison-gold');
    raise exception 'FEHLER: Gutschrift an unbekanntes Konto';
  exception when raise_exception then
    if sqlerrm <> 'KARTE_KONTO' then raise; end if;
  end;
end;
$$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  s jsonb := public.karte_mein_stand();
begin
  if not (s -> 'banner') ? 'saison-silber' then raise exception 'FEHLER: Gutgeschriebenes Banner fehlt %', s; end if;
  if (s ->> 'taler')::integer <> 260 + 70 then raise exception 'FEHLER: Gutschrift zahlt Taler %', s; end if;
end;
$$;

-- ---------- 4. Karte waehlen ----------
do $$
declare
  s jsonb := public.karte_waehle('saison-silber', 'erfolg-feuertaufe', array['stufe-siege', 'stufe-raetsel', null], 'Q', 'welt-1', 'liga-2');
begin
  if s -> 'wahl' ->> 'banner' <> 'saison-silber' or s -> 'wahl' ->> 'titel' <> 'erfolg-feuertaufe'
     or s -> 'wahl' -> 'vitrine' <> '["stufe-siege", "stufe-raetsel"]'::jsonb then
    raise exception 'FEHLER: Wahl nicht gespeichert %', s;
  end if;
end;
$$;
do $$
declare
  falsch text[][] := array[
    array['shop-kronjuwel', 'erfolg-feuertaufe', 'Q', 'standard', 'ohne', 'stufe-siege'],   -- Banner nicht im Besitz
    array['bot-zahnwerk', 'erfolg-feuertaufe', 'Q', 'standard', 'ohne', 'stufe-siege'],     -- Bot-Banner nie fuer Menschen
    array['start', 'Du Pfeife', 'Q', 'standard', 'ohne', 'stufe-siege'],                    -- Freitext-Titel
    array['start', 'erfinder', 'Q', 'standard', 'ohne', 'stufe-siege'],                     -- Erfinder-Titel nicht waehlbar
    array['start', null, 'K', 'standard', 'ohne', 'stufe-siege'],                           -- Koenig nur fuer den Erfinder
    array['start', null, 'Q', 'standard', 'neon', 'stufe-siege'],                           -- Labor-Rahmen
    array['start', null, 'Q', 'standard', 'ohne', 'stufe-bots']                             -- Familie nicht erreicht
  ];
  i integer;
begin
  for i in 1..array_length(falsch, 1) loop
    begin
      perform public.karte_waehle(falsch[i][1], falsch[i][2], array[falsch[i][6]], falsch[i][3], falsch[i][4], falsch[i][5]);
      raise exception 'FEHLER: falsche Wahl % angenommen', i;
    exception when raise_exception then
      if sqlerrm like 'FEHLER%' then raise; end if;
    end;
  end loop;
  begin
    perform public.karte_waehle('start', null, array['stufe-siege', 'stufe-siege'], 'Q', 'standard', 'ohne');
    raise exception 'FEHLER: doppelte Vitrine angenommen';
  exception when raise_exception then
    if sqlerrm like 'FEHLER%' then raise; end if;
  end;
end;
$$;

-- ---------- 5. Karte der Partie ----------
do $$
declare
  k jsonb := public.karte_der_partie((select id from karte_test_partie));
begin
  if k -> 'w' ->> 'name' <> 'karte_a' or k -> 'w' ->> 'banner' <> 'saison-silber' or k -> 'w' ->> 'titel' <> 'erfolg-feuertaufe' then
    raise exception 'FEHLER: eigene Karte falsch %', k;
  end if;
  if (k -> 'w' -> 'vitrine' -> 0 ->> 'stufe')::integer <> 2 or (k -> 'w' ->> 'kronen_stufe')::integer <> 9 then
    raise exception 'FEHLER: Vitrine oder Kronen-Stufe falsch %', k;
  end if;
  -- B hat noch keine Karte: Standardwerte, Start-Banner, Name aus dem Profil
  if k -> 's' ->> 'name' <> 'karte_b' or k -> 's' ->> 'banner' <> 'start' or k -> 's' -> 'vitrine' <> '[]'::jsonb then
    raise exception 'FEHLER: Gegner-Karte ohne Wahl falsch %', k;
  end if;
  if (k -> 'w' ->> 'du')::boolean is not true or (k -> 's' ->> 'du')::boolean is not false then
    raise exception 'FEHLER: du-Merker falsch %', k;
  end if;
  -- keine Interna in der Karte
  if k -> 'w' ? 'user_id' or k -> 'w' ? 'email' or k -> 'w' ? 'taler' then raise exception 'FEHLER: Karte verraet Interna %', k; end if;
end;
$$;
-- C ist unbeteiligt: keine Karte
select set_config('request.jwt.claims', '{"sub":"c1c1c1c1-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.karte_der_partie((select id from karte_test_partie));
    raise exception 'FEHLER: Unbeteiligter sieht die Karten';
  exception when raise_exception then
    if sqlerrm like 'FEHLER%' then raise; end if;
  end;
  begin
    perform public.karte_der_partie(gen_random_uuid());
    raise exception 'FEHLER: unbekannte Partie liefert Karten';
  exception when raise_exception then
    if sqlerrm like 'FEHLER%' then raise; end if;
  end;
  -- C sieht in seinem eigenen Stand nichts von A
  if (public.karte_mein_stand() ->> 'taler')::integer <> 0 then raise exception 'FEHLER: C sieht fremde Taler'; end if;
end;
$$;

-- ---------- 6. Keine Tabellenrechte, interne Funktionen gesperrt ----------
do $$
declare
  t text;
begin
  foreach t in array array['karte_stufen', 'taler_buchungen', 'banner_besitz', 'karte_wahl'] loop
    begin
      execute format('select count(*) from public.%I', t);
      raise exception 'FEHLER: Nutzer liest %', t;
    exception when insufficient_privilege then
      null;
    end;
  end loop;
  begin
    perform public.karte_buche_stufe('c1c1c1c1-cccc-4ccc-8ccc-cccccccccccc', 'siege', 1);
    raise exception 'FEHLER: Nutzer bucht direkt';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.karte_von('a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    raise exception 'FEHLER: Nutzer liest fremde Karte direkt';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
reset role;
set local role anon;
do $$
begin
  begin
    perform public.karte_mein_stand();
    raise exception 'FEHLER: anon darf karte_mein_stand';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.karte_der_partie((select id from karte_test_partie));
    raise exception 'FEHLER: anon darf karte_der_partie';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
reset role;

-- ---------- 7. Liga-Banner aus der Wochen-Abrechnung ----------
-- C allein in einer Gruppe der Vorwoche (Springer II, Stufe 5) mit uneinholbar vielen Kronen: Platz 1 bringt das
-- Banner der Gruppen-Liga (Springer = saison-bronze), der Aufstieg nach Laeufer III das Banner von Laeufer
-- (saison-silber). liga_abrechnen schreibt beide gut, die Taler bleiben gemerkt.
do $$
declare
  uid uuid := 'c1c1c1c1-cccc-4ccc-8ccc-cccccccccccc';
  gid bigint;
begin
  perform public.karte_sichern(uid);
  insert into public.kronen_stand (user_id, stufe) values (uid, 5) on conflict (user_id) do update set stufe = 5;
  insert into public.liga_gruppen (woche, stufe) values (public.liga_woche_heute() - 7, 5) returning id into gid;
  insert into public.liga_mitglieder (gruppe, user_id, woche, kronen) values (gid, uid, public.liga_woche_heute() - 7, 100000);
  perform public.liga_abrechnen();
  if (select stufe from public.kronen_stand where user_id = uid) <> 6 then
    raise exception 'FEHLER: Liga-Banner: Aufstieg fehlt';
  end if;
  if (select array_agg(banner order by banner) from public.banner_besitz where user_id = uid and quelle = 'liga')
     is distinct from array['saison-bronze', 'saison-silber'] then
    raise exception 'FEHLER: Liga-Banner nicht gutgeschrieben (%)',
      (select array_agg(banner) from public.banner_besitz where user_id = uid);
  end if;
  if exists (select 1 from public.liga_belohnungen where user_id = uid and art <> 'taler' and not ausgezahlt) then
    raise exception 'FEHLER: Liga-Banner nicht als ausgezahlt markiert';
  end if;
  -- Nachtragen ist idempotent: nichts Neues, keine doppelten Banner
  if public.karte_liga_banner_nachtragen(uid) <> 0
     or (select count(*) from public.banner_besitz where user_id = uid and quelle = 'liga') <> 2 then
    raise exception 'FEHLER: Liga-Banner doppelt nachgetragen';
  end if;
end;
$$;
-- Das Geraet darf nicht nachtragen
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1c1c1c1-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
do $$
begin
  perform public.karte_liga_banner_nachtragen('c1c1c1c1-cccc-4ccc-8ccc-cccccccccccc');
  raise exception 'FEHLER: karte_liga_banner_nachtragen vom Geraet aufrufbar';
exception when insufficient_privilege then null;
end;
$$;
reset role;

-- ---------- 8. Aufbewahrung: alte Wochen loeschen nimmt keine Erfolge und keine Banner mit ----------
-- D war vor 53 Wochen in Turm III (Stufe 9), heute Bauer III, hat die Karte seitdem nie geoeffnet, und sein Platz-1-Banner
-- von damals ist noch nicht ausgezahlt. liga_alte_wochen_loeschen (kronen-schema.sql) bucht vorher ueber karte_sichern
-- die Liga-Stufen 1 und 2 (Ziele 6 und 9) und das Banner von Turm (saison-gold); danach ist die alte Woche weg.
insert into auth.users (id, email) values ('d1d1d1d1-dddd-4ddd-8ddd-dddddddddddd', 'karte-d@example.invalid');
do $$
declare
  uid uuid := 'd1d1d1d1-dddd-4ddd-8ddd-dddddddddddd';
  w date := public.liga_woche_heute() - 53 * 7;
  gid bigint;
begin
  insert into public.kronen_stand (user_id, stufe) values (uid, 0);
  insert into public.liga_gruppen (woche, stufe, abgerechnet) values (w, 9, true) returning id into gid;
  insert into public.liga_mitglieder (gruppe, user_id, woche, kronen) values (gid, uid, w, 500);
  insert into public.liga_belohnungen (user_id, woche, stufe, platz, art, menge) values (uid, w, 9, 1, 'banner', 1);
  if exists (select 1 from public.karte_stufen where user_id = uid) then
    raise exception 'FEHLER: Aufbewahrung: Testkonto hat schon Stufen';
  end if;
  perform public.liga_alte_wochen_loeschen();
  if exists (select 1 from public.liga_gruppen where id = gid)
     or exists (select 1 from public.liga_belohnungen where user_id = uid) then
    raise exception 'FEHLER: Aufbewahrung: alte Woche nicht geloescht';
  end if;
  if (select array_agg(stufe order by stufe) from public.karte_stufen where user_id = uid and familie = 'liga')
     is distinct from array[1, 2] then
    raise exception 'FEHLER: Aufbewahrung: Liga-Stufen aus der alten Woche verloren';
  end if;
  if not exists (select 1 from public.banner_besitz where user_id = uid and banner = 'saison-gold' and quelle = 'liga') then
    raise exception 'FEHLER: Aufbewahrung: nicht ausgezahltes Banner verloren';
  end if;
end;
$$;

do $$ begin raise notice 'Karte-RLS-Test erfolgreich'; end; $$;
rollback;

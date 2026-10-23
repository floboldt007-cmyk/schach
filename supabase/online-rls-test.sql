-- Prueft supabase/online-schema.sql im Supabase SQL Editor. Alles wird am Ende zurueckgerollt.
-- Drei kurzlebige Nutzer: A und B spielen, C ist ein Dritter, der nichts sehen darf.
begin;

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'online-a@example.invalid'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'online-b@example.invalid'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'online-c@example.invalid');

set local role authenticated;

-- ---------------------------------------------------------------------------
-- 1. A legt eine Einladung an (Weiss, 5 Minuten + 2 Sekunden). Direkte Schreibzugriffe sind verboten.
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);

do $$
declare
  p public.partien_online;
begin
  p := public.online_erstelle('w', 300, 2);
  if p.status <> 'offen' or p.weiss <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' or p.schwarz is not null
     or p.erstellt_von <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' or p.am_zug <> 'w' or p.zuege <> ''
     or p.uhr_weiss_ms <> 300000 or p.uhr_schwarz_ms <> 300000 or p.bedenkzeit_s <> 300 or p.inkrement_s <> 2
     or p.letzter_zug_am is not null or p.ergebnis is not null then
    raise exception 'FEHLER: online_erstelle legt die Einladung falsch an';
  end if;
  if p.code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$' then
    raise exception 'FEHLER: Code hat nicht das erwartete Format (%)', p.code;
  end if;
  perform set_config('online_test.code1', p.code, true);
  perform set_config('online_test.partie1', p.id::text, true);

  -- direkt fuer einen anderen anlegen: verboten
  begin
    insert into public.partien_online (erstellt_von, weiss, status, fen)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'offen',
            'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    raise exception 'FEHLER: Nutzer A konnte eine Einladung fuer B anlegen';
  exception
    when insufficient_privilege then null;
  end;

  -- direkt aendern oder loeschen: verboten (kein Tabellenrecht)
  begin
    update public.partien_online set status = 'beendet' where id = p.id;
    raise exception 'FEHLER: direktes update war erlaubt';
  exception
    when insufficient_privilege then null;
  end;
  begin
    delete from public.partien_online where id = p.id;
    raise exception 'FEHLER: direktes delete war erlaubt';
  exception
    when insufficient_privilege then null;
  end;

  -- ungueltige Eingaben
  begin
    perform public.online_erstelle('x', null, null);
    raise exception 'FEHLER: ungueltige Farbe angenommen';
  exception
    when others then if sqlerrm <> 'ONLINE_FARBE' then raise; end if;
  end;
  begin
    perform public.online_erstelle('w', 0, 0);
    raise exception 'FEHLER: Bedenkzeit 0 angenommen';
  exception
    when others then if sqlerrm <> 'ONLINE_BEDENKZEIT' then raise; end if;
  end;

  -- der eigenen Einladung beitreten: verboten
  begin
    perform public.online_tritt_bei(p.code);
    raise exception 'FEHLER: A konnte der eigenen Einladung beitreten';
  exception
    when others then if sqlerrm <> 'ONLINE_EIGENE_PARTIE' then raise; end if;
  end;

  -- ziehen, bevor jemand beigetreten ist: verboten
  begin
    perform public.online_zug(p.id, 'e2e4', 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', 'b');
    raise exception 'FEHLER: A konnte vor dem Beitritt ziehen';
  exception
    when others then if sqlerrm <> 'ONLINE_PARTIE_NICHT_GESTARTET' then raise; end if;
  end;

  if (select count(*) from public.online_meine()) <> 1 then
    raise exception 'FEHLER: online_meine zeigt A die offene Einladung nicht';
  end if;
end
$$;

-- Auch fuer sich selbst ist ein direktes insert verboten (kein Tabellenrecht, keine Policy): Partien entstehen
-- nur ueber online_erstelle. Sonst liesse sich eine Partie ohne Spieler oder mit eigener Stellung anlegen.
do $$
declare
  p public.partien_online;
begin
  begin
    insert into public.partien_online (erstellt_von, schwarz, status, fen, bedenkzeit_s, zuege, am_zug, code)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'offen',
            'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 60, 'e2e4 e7e5', 'b', 'XXXXXX');
    raise exception 'FEHLER: direktes insert fuer sich selbst war erlaubt';
  exception
    when insufficient_privilege then null;
  end;
  begin
    insert into public.partien_online (erstellt_von, status, fen)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'offen', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    raise exception 'FEHLER: direktes insert ohne Spieler war erlaubt';
  exception
    when insufficient_privilege then null;
  end;
  -- dieselbe Einladung ueber die Funktion (Schwarz, 1 Minute ohne Zuschlag)
  p := public.online_erstelle('b', 60, null);
  if p.code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$' or p.zuege <> '' or p.am_zug <> 'w'
     or p.schwarz <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' or p.weiss is not null
     or p.uhr_weiss_ms <> 60000 or p.uhr_schwarz_ms <> 60000 or p.inkrement_s <> 0 then
    raise exception 'FEHLER: online_erstelle (Schwarz, 1 Minute) legt falsch an';
  end if;
  -- gleich wieder zurueckziehen, damit der Rest des Tests nur mit Partie 1 arbeitet
  p := public.online_gib_auf(p.id);
  if p.status <> 'beendet' or p.grund <> 'abgebrochen' or p.ergebnis is not null then
    raise exception 'FEHLER: offene Einladung liess sich nicht zurueckziehen';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. C (Dritter) sieht nichts und kann nichts.
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);

do $$
declare
  id1 uuid := current_setting('online_test.partie1')::uuid;
begin
  if (select count(*) from public.partien_online) <> 0 then
    raise exception 'FEHLER: Dritter sieht fremde Partien';
  end if;
  if (select count(*) from public.online_meine()) <> 0 then
    raise exception 'FEHLER: online_meine zeigt dem Dritten fremde Partien';
  end if;
  begin
    perform public.online_zug(id1, 'e2e4', 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', 'b');
    raise exception 'FEHLER: Dritter konnte ziehen';
  exception
    when others then if sqlerrm <> 'ONLINE_PARTIE_UNBEKANNT' then raise; end if;
  end;
  begin
    perform public.online_gib_auf(id1);
    raise exception 'FEHLER: Dritter konnte aufgeben';
  exception
    when others then if sqlerrm <> 'ONLINE_PARTIE_UNBEKANNT' then raise; end if;
  end;
  begin
    perform public.online_biete_remis(id1);
    raise exception 'FEHLER: Dritter konnte Remis anbieten';
  exception
    when others then if sqlerrm <> 'ONLINE_PARTIE_UNBEKANNT' then raise; end if;
  end;
end
$$;

-- ---------------------------------------------------------------------------
-- 3. B tritt bei (Code klein und mit Leerzeichen geschrieben) und ist als Schwarz noch nicht am Zug.
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);

do $$
declare
  p public.partien_online;
  code1 text := current_setting('online_test.code1');
begin
  if exists (select 1 from public.partien_online) then
    raise exception 'FEHLER: B sieht die Partie schon vor dem Beitritt';
  end if;
  begin
    perform public.online_tritt_bei('ZZZZZZ');
    raise exception 'FEHLER: unbekannter Code angenommen';
  exception
    when others then if sqlerrm <> 'ONLINE_CODE_UNGUELTIG' then raise; end if;
  end;

  p := public.online_tritt_bei(' ' || lower(code1) || ' ');
  if p.status <> 'laeuft' or p.weiss <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
     or p.schwarz <> 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' or p.am_zug <> 'w'
     or p.uhr_weiss_ms <> 300000 or p.uhr_schwarz_ms <> 300000 or p.letzter_zug_am is null then
    raise exception 'FEHLER: Beitritt setzt die Partie falsch';
  end if;
  if (select count(*) from public.partien_online) <> 1 or (select count(*) from public.online_meine()) <> 1 then
    raise exception 'FEHLER: B sieht die Partie nach dem Beitritt nicht';
  end if;

  -- noch einmal beitreten: die Partie ist voll
  begin
    perform public.online_tritt_bei(code1);
    raise exception 'FEHLER: Beitritt zu einer laufenden Partie war moeglich';
  exception
    when others then if sqlerrm <> 'ONLINE_CODE_UNGUELTIG' then raise; end if;
  end;

  -- Schwarz ist nicht am Zug
  begin
    perform public.online_zug(p.id, 'e7e5', 'rnbqkbnr/pppp1ppp/8/4p3/8/8/PPPPPPPP/RNBQKBNR w KQkq e6 0 2', 'w');
    raise exception 'FEHLER: B konnte ziehen, obwohl Weiss am Zug ist';
  exception
    when others then if sqlerrm <> 'ONLINE_NICHT_DEIN_ZUG' then raise; end if;
  end;
  begin
    perform public.online_nimm_remis_an(p.id);
    raise exception 'FEHLER: Remis ohne Angebot angenommen';
  exception
    when others then if sqlerrm <> 'ONLINE_KEIN_REMISANGEBOT' then raise; end if;
  end;
end
$$;

-- ---------------------------------------------------------------------------
-- 4. A zieht e2e4. Falsche Formen werden abgewiesen, der erste Zug kostet keine Zeit.
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);

do $$
declare
  p public.partien_online;
  id1 uuid := current_setting('online_test.partie1')::uuid;
  fen_e4 constant text := 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
begin
  begin
    perform public.online_zug(id1, 'e2e9', fen_e4, 'b');
    raise exception 'FEHLER: Zug mit falscher Form angenommen';
  exception
    when others then if sqlerrm <> 'ONLINE_ZUG_FORM' then raise; end if;
  end;
  begin
    perform public.online_zug(id1, 'e2e4 e7e5', fen_e4, 'b');
    raise exception 'FEHLER: zwei Zuege auf einmal angenommen';
  exception
    when others then if sqlerrm <> 'ONLINE_ZUG_FORM' then raise; end if;
  end;
  begin
    perform public.online_zug(id1, 'e2e4', 'kaputt', 'b');
    raise exception 'FEHLER: kaputter FEN angenommen';
  exception
    when others then if sqlerrm <> 'ONLINE_FEN_FORM' then raise; end if;
  end;
  begin
    perform public.online_zug(id1, 'e2e4', fen_e4, 'w');
    raise exception 'FEHLER: am_zug_danach ohne Seitenwechsel angenommen';
  exception
    when others then if sqlerrm <> 'ONLINE_AM_ZUG_FORM' then raise; end if;
  end;
  begin
    perform public.online_zug(id1, 'e2e4', fen_e4, 'b', 'gewonnen');
    raise exception 'FEHLER: ungueltiges Ergebnis angenommen';
  exception
    when others then if sqlerrm <> 'ONLINE_ERGEBNIS_FORM' then raise; end if;
  end;

  p := public.online_zug(id1, 'e2e4', fen_e4, 'b');
  if p.zuege <> 'e2e4' or p.am_zug <> 'b' or p.fen <> fen_e4 or p.status <> 'laeuft'
     or p.uhr_weiss_ms <> 300000 or p.uhr_schwarz_ms <> 300000 or p.letzter_zug_am is null then
    raise exception 'FEHLER: erster Zug falsch verbucht (der erste Zug jeder Seite kostet keine Zeit)';
  end if;

  -- gleich noch einmal: jetzt ist Schwarz dran
  begin
    perform public.online_zug(id1, 'd2d4', 'rnbqkbnr/pppppppp/8/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq d3 0 1', 'b');
    raise exception 'FEHLER: A konnte zweimal hintereinander ziehen';
  exception
    when others then if sqlerrm <> 'ONLINE_NICHT_DEIN_ZUG' then raise; end if;
  end;
end
$$;

-- ---------------------------------------------------------------------------
-- 5. B zieht e7e5 (ebenfalls ohne Zeitabzug).
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);

do $$
declare
  p public.partien_online;
begin
  p := public.online_zug(current_setting('online_test.partie1')::uuid, 'e7e5',
                         'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2', 'w');
  if p.zuege <> 'e2e4 e7e5' or p.am_zug <> 'w' or p.uhr_schwarz_ms <> 300000 then
    raise exception 'FEHLER: zweiter Zug falsch verbucht';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 6. Zeit wird abgezogen: Der letzte Zug liegt (kuenstlich) 5 Sekunden zurueck, A zieht mit 2 s Zuschlag.
reset role;
update public.partien_online
set letzter_zug_am = clock_timestamp() - interval '5 seconds'
where id = current_setting('online_test.partie1')::uuid;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);

do $$
declare
  p public.partien_online;
begin
  p := public.online_zug(current_setting('online_test.partie1')::uuid, 'g1f3',
                         'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2', 'b');
  -- 300000 - 5000 (bis 6000, je nach Rechner) + 2000
  if p.uhr_weiss_ms > 297000 or p.uhr_weiss_ms < 296000 then
    raise exception 'FEHLER: Zeit wurde nicht richtig abgezogen (uhr_weiss_ms = %)', p.uhr_weiss_ms;
  end if;
  if p.uhr_schwarz_ms <> 300000 or p.zuege <> 'e2e4 e7e5 g1f3' then
    raise exception 'FEHLER: Zug mit Zeitabzug falsch verbucht';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 7. Zeitueberschreitung: Schwarz hat 5 Minuten, der letzte Zug liegt 10 Minuten zurueck.
reset role;
update public.partien_online
set letzter_zug_am = clock_timestamp() - interval '10 minutes'
where id = current_setting('online_test.partie1')::uuid;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);

do $$
declare
  p public.partien_online;
  id1 uuid := current_setting('online_test.partie1')::uuid;
begin
  p := public.online_zug(id1, 'b8c6', 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', 'w');
  -- der Zug wird nicht verbucht, Schwarz bleibt (mit leerer Uhr) am Zug
  if p.status <> 'beendet' or p.ergebnis <> '1-0' or p.grund <> 'zeit' or p.uhr_schwarz_ms <> 0
     or p.zuege <> 'e2e4 e7e5 g1f3' or p.am_zug <> 'b' then
    raise exception 'FEHLER: Zeitueberschreitung nicht erkannt (status %, ergebnis %, grund %, uhr %, zuege %, am_zug %)',
      p.status, p.ergebnis, p.grund, p.uhr_schwarz_ms, p.zuege, p.am_zug;
  end if;
  -- danach geht nichts mehr
  begin
    perform public.online_zug(id1, 'b8c6', 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', 'w');
    raise exception 'FEHLER: Zug in beendeter Partie angenommen';
  exception
    when others then if sqlerrm <> 'ONLINE_PARTIE_BEENDET' then raise; end if;
  end;
  begin
    perform public.online_gib_auf(id1);
    raise exception 'FEHLER: Aufgabe in beendeter Partie angenommen';
  exception
    when others then if sqlerrm <> 'ONLINE_PARTIE_BEENDET' then raise; end if;
  end;
  -- beendete Partien bleiben lesbar, stehen aber nicht mehr in online_meine
  if (select count(*) from public.partien_online where id = id1) <> 1 then
    raise exception 'FEHLER: beendete Partie nicht mehr lesbar';
  end if;
  if exists (select 1 from public.online_meine() where id = id1) then
    raise exception 'FEHLER: beendete Partie steht noch in online_meine';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 8. Partie 2 ohne Uhr: B erstellt als Schwarz, A tritt bei. Remis: Angebot, Rueckzug durch Gegenzug, Annahme.
do $$
declare
  p public.partien_online;
begin
  p := public.online_erstelle('b', null, null);
  if p.schwarz <> 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' or p.weiss is not null or p.bedenkzeit_s is not null
     or p.inkrement_s is not null or p.uhr_weiss_ms is not null then
    raise exception 'FEHLER: Einladung ohne Uhr falsch angelegt';
  end if;
  perform set_config('online_test.code2', p.code, true);
  perform set_config('online_test.partie2', p.id::text, true);
end
$$;

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);

do $$
declare
  p public.partien_online;
  id2 uuid;
begin
  p := public.online_tritt_bei(current_setting('online_test.code2'));
  id2 := p.id;
  if p.weiss <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' or p.status <> 'laeuft' or p.uhr_weiss_ms is not null then
    raise exception 'FEHLER: Beitritt als Weiss falsch';
  end if;
  -- A bietet Remis an und zieht dann: das Angebot bleibt stehen
  p := public.online_biete_remis(id2);
  if p.remis_angebot <> 'w' then
    raise exception 'FEHLER: Remisangebot nicht vermerkt';
  end if;
  p := public.online_biete_remis(id2);
  if p.remis_angebot <> 'w' or p.status <> 'laeuft' then
    raise exception 'FEHLER: doppeltes Remisangebot aendert den Zustand';
  end if;
  p := public.online_zug(id2, 'e2e4', 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', 'b');
  if p.remis_angebot <> 'w' or p.uhr_weiss_ms is not null then
    raise exception 'FEHLER: eigener Zug nimmt das Remisangebot zurueck oder startet eine Uhr';
  end if;
  -- das eigene Angebot kann man nicht selbst annehmen
  begin
    perform public.online_nimm_remis_an(id2);
    raise exception 'FEHLER: A konnte das eigene Remisangebot annehmen';
  exception
    when others then if sqlerrm <> 'ONLINE_KEIN_REMISANGEBOT' then raise; end if;
  end;
end
$$;

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);

do $$
declare
  p public.partien_online;
  id2 uuid := current_setting('online_test.partie2')::uuid;
begin
  -- B zieht statt anzunehmen: das Angebot verfaellt
  p := public.online_zug(id2, 'e7e5', 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2', 'w');
  if p.remis_angebot is not null then
    raise exception 'FEHLER: Gegenzug nimmt das Remisangebot nicht zurueck';
  end if;
  -- B bietet selbst an
  p := public.online_biete_remis(id2);
  if p.remis_angebot <> 'b' then
    raise exception 'FEHLER: Remisangebot von B nicht vermerkt';
  end if;
end
$$;

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);

do $$
declare
  p public.partien_online;
begin
  p := public.online_nimm_remis_an(current_setting('online_test.partie2')::uuid);
  if p.status <> 'beendet' or p.ergebnis <> '1/2-1/2' or p.grund <> 'remis' or p.remis_angebot is not null then
    raise exception 'FEHLER: Remisannahme beendet die Partie nicht richtig';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 9. Partie 3 mit Zufallsfarbe: A erstellt, B tritt bei und gibt auf.
do $$
declare
  p public.partien_online;
begin
  p := public.online_erstelle('zufall', 180, 0);
  if (p.weiss is null) = (p.schwarz is null) then
    raise exception 'FEHLER: Zufallsfarbe vergibt nicht genau eine Seite';
  end if;
  perform set_config('online_test.code3', p.code, true);
end
$$;

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);

do $$
declare
  p public.partien_online;
  farbe_b text;
begin
  p := public.online_tritt_bei(current_setting('online_test.code3'));
  if not ((p.weiss = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and p.schwarz = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
       or (p.weiss = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and p.schwarz = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')) then
    raise exception 'FEHLER: nach dem Beitritt sitzen nicht A und B am Brett';
  end if;
  farbe_b := case when p.weiss = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' then 'w' else 'b' end;
  p := public.online_gib_auf(p.id);
  if p.status <> 'beendet' or p.grund <> 'aufgabe' or p.remis_angebot is not null
     or p.ergebnis <> (case when farbe_b = 'w' then '0-1' else '1-0' end) then
    raise exception 'FEHLER: Aufgabe beendet die Partie nicht richtig (ergebnis %, grund %)', p.ergebnis, p.grund;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 10. Abschluss: Niemand hat mehr eine laufende Partie, C sieht weiterhin nichts.
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.online_meine()) <> 0 then
    raise exception 'FEHLER: online_meine zeigt A beendete Partien';
  end if;
  if (select count(*) from public.partien_online) <> 4 then
    raise exception 'FEHLER: A sieht nicht genau die eigenen vier Partien';
  end if;
end
$$;

select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.partien_online) <> 0 then
    raise exception 'FEHLER: Dritter sieht am Ende fremde Partien';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 11. Die Uhr ist durchsetzbar: Wer ueber der Zeit ist, verliert auch, wenn er nichts mehr tut.
--     A (Weiss) gegen B (Schwarz), 1 Minute. Nach 1. e4 e5 2. Sf3 ist Schwarz am Zug und zieht nicht mehr.
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
begin
  p := public.online_erstelle('w', 60, 0);
  perform set_config('online_test.code5', p.code, true);
  perform set_config('online_test.partie5', p.id::text, true);
end
$$;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$ begin perform public.online_tritt_bei(current_setting('online_test.code5')); end $$;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$ begin perform public.online_zug(current_setting('online_test.partie5')::uuid, 'e2e4', 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', 'b'); end $$;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$ begin perform public.online_zug(current_setting('online_test.partie5')::uuid, 'e7e5', 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2', 'w'); end $$;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
  id5 uuid := current_setting('online_test.partie5')::uuid;
begin
  p := public.online_zug(id5, 'g1f3', 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2', 'b');
  -- A bietet gleich Remis an (B koennte es spaeter annehmen wollen)
  p := public.online_biete_remis(id5);
  -- solange die Uhr laeuft, aendert das Reklamieren nichts
  p := public.online_pruefe_zeit(id5);
  if p.status <> 'laeuft' or p.ergebnis is not null or p.remis_angebot <> 'w' then
    raise exception 'FEHLER: online_pruefe_zeit beendet eine Partie mit Restzeit (status %, grund %)', p.status, p.grund;
  end if;
  -- nicht am Zug: ziehen geht weiterhin nicht
  begin
    perform public.online_zug(id5, 'b1c3', 'rnbqkbnr/pppp1ppp/8/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R b KQkq - 2 2', 'b');
    raise exception 'FEHLER: A konnte ziehen, obwohl Schwarz am Zug ist';
  exception
    when others then if sqlerrm <> 'ONLINE_NICHT_DEIN_ZUG' then raise; end if;
  end;
end
$$;

-- C kann keine fremde Zeit reklamieren
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
do $$
begin
  perform public.online_pruefe_zeit(current_setting('online_test.partie5')::uuid);
  raise exception 'FEHLER: Dritter konnte online_pruefe_zeit aufrufen';
exception
  when others then if sqlerrm <> 'ONLINE_PARTIE_UNBEKANNT' then raise; end if;
end
$$;

-- B ist 29 Minuten ueber der Zeit und will jetzt noch das Remis annehmen: die Partie ist auf Zeit verloren.
reset role;
update public.partien_online
set letzter_zug_am = clock_timestamp() - interval '30 minutes'
where id = current_setting('online_test.partie5')::uuid;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
begin
  p := public.online_nimm_remis_an(current_setting('online_test.partie5')::uuid);
  if p.status <> 'beendet' or p.ergebnis <> '1-0' or p.grund <> 'zeit' or p.uhr_schwarz_ms <> 0 or p.remis_angebot is not null then
    raise exception 'FEHLER: Remis-Annahme nach abgelaufener Uhr (status %, ergebnis %, grund %)', p.status, p.ergebnis, p.grund;
  end if;
end
$$;

-- Dasselbe ohne jedes Zutun von B: A reklamiert die Zeit (eigene Partie 6, sonst gleich).
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
begin
  p := public.online_erstelle('w', 60, 0);
  perform set_config('online_test.code6', p.code, true);
  perform set_config('online_test.partie6', p.id::text, true);
end
$$;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$ begin perform public.online_tritt_bei(current_setting('online_test.code6')); end $$;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$ begin perform public.online_zug(current_setting('online_test.partie6')::uuid, 'e2e4', 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', 'b'); end $$;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$ begin perform public.online_zug(current_setting('online_test.partie6')::uuid, 'e7e5', 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2', 'w'); end $$;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$ begin perform public.online_zug(current_setting('online_test.partie6')::uuid, 'g1f3', 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2', 'b'); end $$;
reset role;
update public.partien_online
set letzter_zug_am = clock_timestamp() - interval '10 minutes'
where id = current_setting('online_test.partie6')::uuid;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
  id6 uuid := current_setting('online_test.partie6')::uuid;
begin
  if (select count(*) from public.online_meine() m where m.id = id6) <> 1 then
    raise exception 'FEHLER: Partie 6 fehlt vor dem Reklamieren in online_meine';
  end if;
  p := public.online_pruefe_zeit(id6);
  if p.status <> 'beendet' or p.ergebnis <> '1-0' or p.grund <> 'zeit' or p.uhr_schwarz_ms <> 0 or p.zuege <> 'e2e4 e7e5 g1f3' then
    raise exception 'FEHLER: Zeit-Reklamation nicht erkannt (status %, ergebnis %, grund %)', p.status, p.ergebnis, p.grund;
  end if;
  if (select count(*) from public.online_meine() m where m.id = id6) <> 0 then
    raise exception 'FEHLER: auf Zeit beendete Partie steht noch in online_meine';
  end if;
  -- noch einmal reklamieren: liefert die beendete Zeile, aendert nichts
  p := public.online_pruefe_zeit(id6);
  if p.status <> 'beendet' or p.ergebnis <> '1-0' then
    raise exception 'FEHLER: zweite Reklamation aendert das Ergebnis';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 12. Einladungen laufen nach 24 Stunden ab; eine Partie ohne Spieler (nur mit Besitzerrechten anlegbar) kann
--     niemand starten, und wer nicht am Brett sitzt, kann eine laufende Partie nicht aufgeben.
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
begin
  p := public.online_erstelle('zufall', null, null);
  perform set_config('online_test.code7', p.code, true);
  perform set_config('online_test.partie7', p.id::text, true);
end
$$;
reset role;
update public.partien_online set erstellt_am = now() - interval '25 hours'
where id = current_setting('online_test.partie7')::uuid;
-- Partie 8: ohne Spieler (weiss und schwarz leer), so nur am Recht vorbei denkbar
insert into public.partien_online (erstellt_von, status, fen)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'offen', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
select set_config('online_test.code8', (select code from public.partien_online where weiss is null and schwarz is null and status = 'offen' limit 1), true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.online_meine() m where m.id = current_setting('online_test.partie7')::uuid) <> 0 then
    raise exception 'FEHLER: abgelaufene Einladung steht noch in online_meine';
  end if;
end
$$;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.online_tritt_bei(current_setting('online_test.code7'));
    raise exception 'FEHLER: abgelaufene Einladung angenommen';
  exception
    when others then if sqlerrm <> 'ONLINE_CODE_ABGELAUFEN' then raise; end if;
  end;
  begin
    perform public.online_tritt_bei(current_setting('online_test.code8'));
    raise exception 'FEHLER: Partie ohne Spieler gestartet';
  exception
    when others then if sqlerrm <> 'ONLINE_CODE_UNGUELTIG' then raise; end if;
  end;
end
$$;
-- C legt eine Einladung als Weiss an, B tritt bei; danach wird (nur mit Besitzerrechten) Weiss an A uebergeben.
-- C ist dann Ersteller, aber kein Spieler und darf weder aufgeben noch die Zeit reklamieren.
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
begin
  p := public.online_erstelle('w', null, null);
  perform set_config('online_test.code9', p.code, true);
  perform set_config('online_test.partie9', p.id::text, true);
end
$$;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$ begin perform public.online_tritt_bei(current_setting('online_test.code9')); end $$;
reset role;
update public.partien_online set weiss = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
where id = current_setting('online_test.partie9')::uuid;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
begin
  begin
    perform public.online_gib_auf(current_setting('online_test.partie9')::uuid);
    raise exception 'FEHLER: Ersteller ohne Platz am Brett konnte eine laufende Partie aufgeben';
  exception
    when others then if sqlerrm <> 'ONLINE_PARTIE_UNBEKANNT' then raise; end if;
  end;
  begin
    perform public.online_pruefe_zeit(current_setting('online_test.partie9')::uuid);
    raise exception 'FEHLER: Ersteller ohne Platz am Brett konnte die Zeit reklamieren';
  exception
    when others then if sqlerrm <> 'ONLINE_PARTIE_UNBEKANNT' then raise; end if;
  end;
end
$$;
reset role;
do $$
begin
  if (select status from public.partien_online where id = current_setting('online_test.partie9')::uuid) <> 'laeuft' then
    raise exception 'FEHLER: Partie 9 wurde durch einen Unbeteiligten veraendert';
  end if;
end
$$;
set local role authenticated;

select 'Online-RLS-Test erfolgreich' as ergebnis;
rollback;

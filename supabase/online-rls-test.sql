-- Prueft supabase/online-schema.sql im Supabase SQL Editor. Alles wird am Ende zurueckgerollt.
-- Drei kurzlebige Nutzer: A und B spielen, C ist ein Dritter, der nichts sehen darf.
-- online_tritt_bei liefert seit Anti-Cheat Etappe 0 jsonb: die Zeile oder { "fehler": "ONLINE_..." } (ohne raise).
-- Ab Abschnitt 13: Einladungs-Bremse, Aufraeumen, Fehlversuche, Ergebnis-Regeln, Folgestellung, strittig,
-- Zeitende mit zu wenig Material, haengende Partien, Rechte und search_path.
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
  r jsonb;
  code1 text := current_setting('online_test.code1');
begin
  if exists (select 1 from public.partien_online) then
    raise exception 'FEHLER: B sieht die Partie schon vor dem Beitritt';
  end if;
  -- ein unbekannter Code ist ein Fehlversuch: Antwort { fehler }, kein raise (der Zaehler soll stehen bleiben)
  r := public.online_tritt_bei('ZZZZZZ');
  if r ->> 'fehler' is distinct from 'ONLINE_CODE_UNGUELTIG' or r ? 'id' then
    raise exception 'FEHLER: unbekannter Code angenommen (%)', r;
  end if;

  p := jsonb_populate_record(null::public.partien_online, public.online_tritt_bei(' ' || lower(code1) || ' '));
  if p.status <> 'laeuft' or p.weiss <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
     or p.schwarz <> 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' or p.am_zug <> 'w'
     or p.uhr_weiss_ms <> 300000 or p.uhr_schwarz_ms <> 300000 or p.letzter_zug_am is null then
    raise exception 'FEHLER: Beitritt setzt die Partie falsch';
  end if;
  if (select count(*) from public.partien_online) <> 1 or (select count(*) from public.online_meine()) <> 1 then
    raise exception 'FEHLER: B sieht die Partie nach dem Beitritt nicht';
  end if;

  -- noch einmal beitreten: die Partie ist voll
  r := public.online_tritt_bei(code1);
  if r ->> 'fehler' is distinct from 'ONLINE_CODE_UNGUELTIG' then
    raise exception 'FEHLER: Beitritt zu einer laufenden Partie war moeglich (%)', r;
  end if;

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
  p := jsonb_populate_record(null::public.partien_online, public.online_tritt_bei(current_setting('online_test.code2')));
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
  p := jsonb_populate_record(null::public.partien_online, public.online_tritt_bei(current_setting('online_test.code3')));
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
do $$ begin if public.online_tritt_bei(current_setting('online_test.code5')) ? 'fehler' then raise exception 'FEHLER: Beitritt zu Partie 5 gescheitert'; end if; end $$;
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
do $$ begin if public.online_tritt_bei(current_setting('online_test.code6')) ? 'fehler' then raise exception 'FEHLER: Beitritt zu Partie 6 gescheitert'; end if; end $$;
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
declare
  r jsonb;
begin
  r := public.online_tritt_bei(current_setting('online_test.code7'));
  if r ->> 'fehler' is distinct from 'ONLINE_CODE_ABGELAUFEN' then
    raise exception 'FEHLER: abgelaufene Einladung angenommen (%)', r;
  end if;
  r := public.online_tritt_bei(current_setting('online_test.code8'));
  if r ->> 'fehler' is distinct from 'ONLINE_CODE_UNGUELTIG' then
    raise exception 'FEHLER: Partie ohne Spieler gestartet (%)', r;
  end if;
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
do $$ begin if public.online_tritt_bei(current_setting('online_test.code9')) ? 'fehler' then raise exception 'FEHLER: Beitritt zu Partie 9 gescheitert'; end if; end $$;
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

-- ---------------------------------------------------------------------------
-- 13. Einladungs-Bremse (Anti-Cheat Etappe 0): hoechstens 5 offene und 50 neue Einladungen je Konto in 24 Stunden.
--     C hat bisher nur Partie 9 angelegt (laeuft, keine offene Einladung).
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
  i integer;
  erste uuid;
begin
  for i in 1..5 loop
    p := public.online_erstelle('w', null, null);
    if i = 1 then
      erste := p.id;
    end if;
  end loop;
  begin
    perform public.online_erstelle('b', 300, 0);
    raise exception 'FEHLER: die 6. offene Einladung wurde angenommen';
  exception
    when others then if sqlerrm <> 'ONLINE_ZU_VIELE_EINLADUNGEN' then raise; end if;
  end;
  -- eine zurueckziehen: dann geht wieder eine
  perform public.online_gib_auf(erste);
  p := public.online_erstelle('b', 300, 0);
  if p.status <> 'offen' then
    raise exception 'FEHLER: nach dem Zurueckziehen ging keine neue Einladung';
  end if;
  -- alle offenen zurueckziehen; zurueckgezogene zaehlen bei den neuen weiter mit
  for p in select * from public.partien_online t
           where t.erstellt_von = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' and t.status = 'offen' loop
    perform public.online_gib_auf(p.id);
  end loop;
  -- bis 50 neue in 24 Stunden auffuellen (jede gleich wieder zurueckziehen, damit nie 5 offen sind)
  for i in 1..43 loop
    p := public.online_erstelle('zufall', null, null);
    perform public.online_gib_auf(p.id);
  end loop;
  if (select count(*) from public.partien_online t
      where t.erstellt_von = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' and t.erstellt_am > now() - interval '24 hours') <> 50
     or exists (select 1 from public.partien_online t
                where t.erstellt_von = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' and t.status = 'offen') then
    raise exception 'FEHLER: Testaufbau der Bremse stimmt nicht (nicht genau 50 neue, oder noch eine offen)';
  end if;
  begin
    perform public.online_erstelle('w', null, null);
    raise exception 'FEHLER: die 51. neue Einladung in 24 Stunden wurde angenommen';
  exception
    when others then if sqlerrm <> 'ONLINE_ZU_VIELE_EINLADUNGEN' then raise; end if;
  end;
end
$$;

-- Alte Einladungen werden beim naechsten Anlegen weggeraeumt (aelter als 48 Stunden, offen oder zurueckgezogen).
-- B legt drei Einladungen an (eine davon zurueckgezogen); als Besitzer werden sie 49 bzw. 47 Stunden alt gemacht,
-- dazu die laufende Partie 9 (49 Stunden alt, aber eine Partie, keine Einladung).
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
begin
  p := public.online_erstelle('w', null, null);
  perform set_config('online_test.alt49', p.id::text, true);
  p := public.online_erstelle('b', 600, 0);
  perform set_config('online_test.alt47', p.id::text, true);
  p := public.online_erstelle('w', null, null);
  perform set_config('online_test.alt_zurueck', p.id::text, true);
  perform public.online_gib_auf(p.id);
end
$$;
reset role;
update public.partien_online set erstellt_am = now() - interval '49 hours'
where id in (current_setting('online_test.alt49')::uuid, current_setting('online_test.alt_zurueck')::uuid,
             current_setting('online_test.partie9')::uuid);
update public.partien_online set erstellt_am = now() - interval '47 hours'
where id = current_setting('online_test.alt47')::uuid;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
begin
  p := public.online_erstelle('w', null, null);
  perform public.online_gib_auf(p.id); -- nur fuers Aufraeumen angelegt
end
$$;
reset role;
do $$
begin
  if exists (select 1 from public.partien_online where id = current_setting('online_test.alt49')::uuid) then
    raise exception 'FEHLER: offene Einladung, die aelter als 48 Stunden ist, wurde nicht weggeraeumt';
  end if;
  if exists (select 1 from public.partien_online where id = current_setting('online_test.alt_zurueck')::uuid) then
    raise exception 'FEHLER: zurueckgezogene Einladung, die aelter als 48 Stunden ist, wurde nicht weggeraeumt';
  end if;
  if not exists (select 1 from public.partien_online where id = current_setting('online_test.alt47')::uuid) then
    raise exception 'FEHLER: Einladung von 47 Stunden zu frueh weggeraeumt';
  end if;
  if not exists (select 1 from public.partien_online where id = current_setting('online_test.partie9')::uuid and status = 'laeuft') then
    raise exception 'FEHLER: das Aufraeumen hat eine laufende Partie geloescht';
  end if;
end
$$;
set local role authenticated;

-- ---------------------------------------------------------------------------
-- 14. Fehlversuche beim Beitreten: hoechstens 20 falsche Codes je Konto und Tag. Ein Fehlversuch kommt als jsonb
--     { fehler } ohne raise zurueck, der Zaehler steht danach also wirklich (ein raise rollte ihn zurueck).
--     Ein richtiger Code nach 19 Fehlversuchen geht, nach 20 Fehlversuchen nichts mehr. C hat noch keinen.
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
begin
  p := public.online_erstelle('w', null, null);
  perform set_config('online_test.code_v1', p.code, true);
  p := public.online_erstelle('w', null, null);
  perform set_config('online_test.code_v2', p.code, true);
  perform set_config('online_test.partie_v2', p.id::text, true);
end
$$;
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
do $$
declare
  r jsonb;
begin
  r := public.online_tritt_bei('ZZZZZ2');
  if r ->> 'fehler' is distinct from 'ONLINE_CODE_UNGUELTIG' then
    raise exception 'FEHLER: erster Fehlversuch liefert kein { fehler } (%)', r;
  end if;
end
$$;
reset role;
do $$
begin
  if (select v.anzahl from public.online_versuche v where v.user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc') is distinct from 1 then
    raise exception 'FEHLER: der Fehlversuch wurde nicht gezaehlt';
  end if;
  -- B hatte in den Abschnitten 3 und 12 vier Fehlversuche (unbekannt, voll, abgelaufen, ohne Spieler)
  if (select v.anzahl from public.online_versuche v where v.user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') is distinct from 4 then
    raise exception 'FEHLER: Fehlversuche werden nicht je Konto gezaehlt';
  end if;
end
$$;
set local role authenticated;
do $$
declare
  r jsonb;
  p public.partien_online;
  i integer;
begin
  for i in 2..19 loop
    -- falsche Codes, auch in falscher Form (die App faengt die ab, ein eigenes Werkzeug nicht)
    r := public.online_tritt_bei(case when i % 2 = 0 then 'ZZZZZ3' else 'ab' end);
    if r ->> 'fehler' is distinct from 'ONLINE_CODE_UNGUELTIG' then
      raise exception 'FEHLER: Fehlversuch % liefert kein { fehler } (%)', i, r;
    end if;
  end loop;
  p := jsonb_populate_record(null::public.partien_online, public.online_tritt_bei(current_setting('online_test.code_v1')));
  if p.status is distinct from 'laeuft' or p.schwarz is distinct from 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' then
    raise exception 'FEHLER: richtiger Code nach 19 Fehlversuchen abgelehnt';
  end if;
  r := public.online_tritt_bei('ZZZZZ4'); -- der 20. Fehlversuch zaehlt noch normal
  if r ->> 'fehler' is distinct from 'ONLINE_CODE_UNGUELTIG' then
    raise exception 'FEHLER: 20. Fehlversuch liefert kein { fehler } (%)', r;
  end if;
  begin
    perform public.online_tritt_bei(current_setting('online_test.code_v2'));
    raise exception 'FEHLER: nach 20 Fehlversuchen war Beitreten noch moeglich';
  exception
    when others then if sqlerrm <> 'ONLINE_ZU_VIELE_VERSUCHE' then raise; end if;
  end;
  -- die eigenen Fehlversuche kann C weder lesen noch zuruecksetzen
  begin
    perform 1 from public.online_versuche;
    raise exception 'FEHLER: online_versuche direkt lesbar';
  exception
    when insufficient_privilege then null;
  end;
  begin
    delete from public.online_versuche where user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    raise exception 'FEHLER: online_versuche direkt loeschbar';
  exception
    when insufficient_privilege then null;
  end;
end
$$;
reset role;
do $$
begin
  if (select v.anzahl from public.online_versuche v where v.user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc') is distinct from 20 then
    raise exception 'FEHLER: Zaehler nach 20 Fehlversuchen falsch';
  end if;
  if (select status from public.partien_online where id = current_setting('online_test.partie_v2')::uuid) <> 'offen' then
    raise exception 'FEHLER: ein gesperrter Beitritt hat die Einladung veraendert';
  end if;
end
$$;
set local role authenticated;
-- A zieht die unberuehrte Einladung zurueck (haelt die Zahl offener Einladungen von A klein)
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$ begin perform public.online_gib_auf(current_setting('online_test.partie_v2')::uuid); end $$;

-- ---------------------------------------------------------------------------
-- 15. Ergebnis-Regeln: ein Ergebnis nur mit passendem Grund. Partie E: A (Weiss) gegen B (Schwarz), ohne Uhr.
do $$
declare
  p public.partien_online;
begin
  p := public.online_erstelle('w', null, null);
  perform set_config('online_test.code_e', p.code, true);
  perform set_config('online_test.partie_e', p.id::text, true);
end
$$;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$ begin if public.online_tritt_bei(current_setting('online_test.code_e')) ? 'fehler' then raise exception 'FEHLER: Beitritt zu Partie E gescheitert'; end if; end $$;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
  id_e uuid := current_setting('online_test.partie_e')::uuid;
  fen_f3 constant text := 'rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR b KQkq - 0 1';
  g text;
  e text;
begin
  -- Ergebnis ohne Grund
  begin
    perform public.online_zug(id_e, 'f2f3', fen_f3, 'b', '1-0', null);
    raise exception 'FEHLER: Ergebnis ohne Grund angenommen';
  exception
    when others then if sqlerrm <> 'ONLINE_ERGEBNIS_FORM' then raise; end if;
  end;
  -- "matt" nur als Sieg des Ziehenden, Remis-Gruende nur als Remis
  foreach e in array array['0-1', '1/2-1/2'] loop
    begin
      perform public.online_zug(id_e, 'f2f3', fen_f3, 'b', e, 'matt');
      raise exception 'FEHLER: % mit Grund matt nach einem Zug von Weiss angenommen', e;
    exception
      when others then if sqlerrm <> 'ONLINE_ERGEBNIS_FORM' then raise; end if;
    end;
  end loop;
  foreach g in array array['patt', 'material', 'wiederholung', '50-zuege'] loop
    foreach e in array array['1-0', '0-1'] loop
      begin
        perform public.online_zug(id_e, 'f2f3', fen_f3, 'b', e, g);
        raise exception 'FEHLER: % mit Remis-Grund % angenommen', e, g;
      exception
        when others then if sqlerrm <> 'ONLINE_ERGEBNIS_FORM' then raise; end if;
      end;
    end loop;
  end loop;
  -- Gruende, die nur der Server setzt (und unbekannte), lehnt er vom Browser immer ab
  foreach g in array array['zeit', 'zeit-material', 'aufgabe', 'remis', 'abgebrochen', 'strittig', 'gewonnen'] loop
    foreach e in array array['1-0', '0-1', '1/2-1/2'] loop
      begin
        perform public.online_zug(id_e, 'f2f3', fen_f3, 'b', e, g);
        raise exception 'FEHLER: Grund % (Ergebnis %) vom Browser angenommen', g, e;
      exception
        when others then if sqlerrm <> 'ONLINE_ERGEBNIS_FORM' then raise; end if;
      end;
    end loop;
  end loop;
  -- ohne Ergebnis geht der Zug durch; ein Grund ohne Ergebnis faellt still weg
  p := public.online_zug(id_e, 'f2f3', fen_f3, 'b', null, 'matt');
  if p.zuege <> 'f2f3' or p.status <> 'laeuft' or p.grund is not null or p.ergebnis is not null then
    raise exception 'FEHLER: Zug ohne Ergebnis falsch verbucht';
  end if;
end
$$;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$
declare
  id_e uuid := current_setting('online_test.partie_e')::uuid;
  fen_e5 constant text := 'rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2';
begin
  begin
    perform public.online_zug(id_e, 'e7e5', fen_e5, 'w', '1-0', 'matt');
    raise exception 'FEHLER: "1-0, matt" nach einem Zug von Schwarz angenommen';
  exception
    when others then if sqlerrm <> 'ONLINE_ERGEBNIS_FORM' then raise; end if;
  end;
  begin
    perform public.online_zug(id_e, 'e7e5', fen_e5, 'w', '1-0', 'wiederholung');
    raise exception 'FEHLER: "1-0, wiederholung" angenommen';
  exception
    when others then if sqlerrm <> 'ONLINE_ERGEBNIS_FORM' then raise; end if;
  end;
  perform public.online_zug(id_e, 'e7e5', fen_e5, 'w');
end
$$;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$ begin perform public.online_zug(current_setting('online_test.partie_e')::uuid, 'g2g4', 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2', 'b'); end $$;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
begin
  -- Narrenmatt: "0-1, matt" vom Ziehenden geht durch
  p := public.online_zug(current_setting('online_test.partie_e')::uuid, 'd8h4',
                         'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3', 'w', '0-1', 'matt');
  if p.status <> 'beendet' or p.ergebnis <> '0-1' or p.grund <> 'matt' then
    raise exception 'FEHLER: Matt des Ziehenden nicht verbucht (status %, ergebnis %, grund %)', p.status, p.ergebnis, p.grund;
  end if;
  -- ein Remis mit Remis-Grund nimmt der Server der Form nach an (Partie E2, B als Weiss gegen A)
  p := public.online_erstelle('w', null, null);
  perform set_config('online_test.code_e2', p.code, true);
  perform set_config('online_test.partie_e2', p.id::text, true);
end
$$;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$ begin if public.online_tritt_bei(current_setting('online_test.code_e2')) ? 'fehler' then raise exception 'FEHLER: Beitritt zu Partie E2 gescheitert'; end if; end $$;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
begin
  p := public.online_zug(current_setting('online_test.partie_e2')::uuid, 'e2e4',
                         'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', 'b', '1/2-1/2', 'wiederholung');
  if p.status <> 'beendet' or p.ergebnis <> '1/2-1/2' or p.grund <> 'wiederholung' then
    raise exception 'FEHLER: Remis mit Remis-Grund nicht verbucht';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 16. Grobe Pruefung der Folgestellung (ONLINE_STELLUNG_FALSCH). Partie F: A (Weiss) gegen B (Schwarz), ohne Uhr.
--     Folgestellungen der Sonderzuege stammen aus chess.js.
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
begin
  p := public.online_erstelle('w', null, null);
  perform set_config('online_test.code_f', p.code, true);
  perform set_config('online_test.partie_f', p.id::text, true);
end
$$;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$ begin if public.online_tritt_bei(current_setting('online_test.code_f')) ? 'fehler' then raise exception 'FEHLER: Beitritt zu Partie F gescheitert'; end if; end $$;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
  id_f uuid := current_setting('online_test.partie_f')::uuid;
  fen_e4 constant text := 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
  falsch text[];
  i integer;
begin
  falsch := array[
    -- e2e4, aber die schwarze Dame ist einfach weg
    'e2e4', 'rnb1kbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
    -- ein anderer Zug als der behauptete (d1h5 mit dem Brett von e2e4)
    'd1h5', fen_e4,
    -- Zug von einem leeren Feld
    'e4e5', 'rnbqkbnr/pppppppp/8/4P3/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1',
    -- Weiss zieht einen schwarzen Stein
    'e7e5', 'rnbqkbnr/pppp1ppp/8/4p3/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1',
    -- eigenen Stein schlagen (Turm a1 nimmt Bauer a2)
    'a1a2', 'rnbqkbnr/pppppppp/8/8/8/8/RPPPPPPP/1NBQKBNR b Kkq - 0 1',
    -- richtiger Zug, aber eine weisse Dame mehr auf dem Brett
    'e2e4', 'rnbqkbnr/pppppppp/8/8/4P3/3Q4/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
    -- Brett mit nur 63 Feldern in Reihe 4 (die Form-Pruefung laesst es durch, die Folgestellung nicht)
    'e2e4', 'rnbqkbnr/pppppppp/8/8/4P2/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'];
  for i in 1..array_length(falsch, 1) / 2 loop
    begin
      perform public.online_zug(id_f, falsch[2 * i - 1], falsch[2 * i], 'b');
      raise exception 'FEHLER: falsche Folgestellung % angenommen (%)', i, falsch[2 * i];
    exception
      when others then if sqlerrm <> 'ONLINE_STELLUNG_FALSCH' then raise; end if;
    end;
  end loop;
  -- nur Brett und Seite zaehlen: andere Zaehler im FEN-Text sind kein Fehler
  p := public.online_zug(id_f, 'e2e4', 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 3 9', 'b');
  if p.zuege <> 'e2e4' then
    raise exception 'FEHLER: richtiger Zug (andere Zaehler) abgelehnt';
  end if;
end
$$;

-- Sonderzuege: Stellungen als Besitzer gesetzt (wie im Partieverlauf moeglich), Folgestellungen aus chess.js.
reset role;
update public.partien_online
set fen = 'r3k2r/pppqpppp/8/8/8/8/PPPQPPPP/R3K2R w KQkq - 0 1', am_zug = 'w', zuege = 'e2e4 e7e5'
where id = current_setting('online_test.partie_f')::uuid;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
begin
  p := public.online_zug(current_setting('online_test.partie_f')::uuid, 'e1g1', 'r3k2r/pppqpppp/8/8/8/8/PPPQPPPP/R4RK1 b kq - 1 1', 'b');
  if p.fen <> 'r3k2r/pppqpppp/8/8/8/8/PPPQPPPP/R4RK1 b kq - 1 1' then
    raise exception 'FEHLER: kurze Rochade von Weiss abgelehnt oder falsch verbucht';
  end if;
end
$$;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
  id_f uuid := current_setting('online_test.partie_f')::uuid;
begin
  -- Rochade, bei der der Turm nicht mitspringt
  begin
    perform public.online_zug(id_f, 'e8c8', 'r1k4r/pppqpppp/8/8/8/8/PPPQPPPP/R4RK1 w - - 2 2', 'w');
    raise exception 'FEHLER: Rochade ohne Turm angenommen';
  exception
    when others then if sqlerrm <> 'ONLINE_STELLUNG_FALSCH' then raise; end if;
  end;
  p := public.online_zug(id_f, 'e8c8', '2kr3r/pppqpppp/8/8/8/8/PPPQPPPP/R4RK1 w - - 2 2', 'w');
  if p.fen <> '2kr3r/pppqpppp/8/8/8/8/PPPQPPPP/R4RK1 w - - 2 2' then
    raise exception 'FEHLER: lange Rochade von Schwarz abgelehnt';
  end if;
end
$$;
reset role;
update public.partien_online
set fen = 'rnbqkbnr/ppp1pppp/8/8/3pP3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 3', am_zug = 'b'
where id = current_setting('online_test.partie_f')::uuid;
set local role authenticated;
do $$
declare
  p public.partien_online;
  id_f uuid := current_setting('online_test.partie_f')::uuid;
begin
  -- en passant, bei dem der geschlagene Bauer stehen bleibt
  begin
    perform public.online_zug(id_f, 'd4e3', 'rnbqkbnr/ppp1pppp/8/8/4P3/4p3/PPPP1PPP/RNBQKBNR w KQkq - 0 4', 'w');
    raise exception 'FEHLER: en passant ohne geschlagenen Bauern angenommen';
  exception
    when others then if sqlerrm <> 'ONLINE_STELLUNG_FALSCH' then raise; end if;
  end;
  p := public.online_zug(id_f, 'd4e3', 'rnbqkbnr/ppp1pppp/8/8/8/4p3/PPPP1PPP/RNBQKBNR w KQkq - 0 4', 'w');
  if p.am_zug <> 'w' then
    raise exception 'FEHLER: en passant abgelehnt';
  end if;
end
$$;
-- "en passant" gegen einen Springer: schraeg auf ein leeres Feld nimmt nur einen gegnerischen Bauern mit
reset role;
update public.partien_online
set fen = 'rnbqkbnr/ppp1pppp/8/8/3pN3/8/PPPP1PPP/R1BQKBNR b KQkq - 0 3', am_zug = 'b'
where id = current_setting('online_test.partie_f')::uuid;
set local role authenticated;
do $$
begin
  perform public.online_zug(current_setting('online_test.partie_f')::uuid, 'd4e3',
                            'rnbqkbnr/ppp1pppp/8/8/8/4p3/PPPP1PPP/R1BQKBNR w KQkq - 0 4', 'w');
  raise exception 'FEHLER: en passant hat einen Springer vom Brett genommen';
exception
  when others then if sqlerrm <> 'ONLINE_STELLUNG_FALSCH' then raise; end if;
end
$$;
reset role;
update public.partien_online
set fen = 'r3k3/1P6/8/8/8/8/8/4K3 w - - 0 1', am_zug = 'w'
where id = current_setting('online_test.partie_f')::uuid;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
  id_f uuid := current_setting('online_test.partie_f')::uuid;
begin
  -- Bauer auf der letzten Reihe ohne Umwandlung, oder ein anderer Stein als angegeben
  begin
    perform public.online_zug(id_f, 'b7a8', 'P3k3/8/8/8/8/8/8/4K3 b - - 0 1', 'b');
    raise exception 'FEHLER: Bauer auf der letzten Reihe ohne Umwandlung angenommen';
  exception
    when others then if sqlerrm <> 'ONLINE_STELLUNG_FALSCH' then raise; end if;
  end;
  begin
    perform public.online_zug(id_f, 'b7a8q', 'N3k3/8/8/8/8/8/8/4K3 b - - 0 1', 'b');
    raise exception 'FEHLER: Umwandlung in einen anderen Stein als angegeben angenommen';
  exception
    when others then if sqlerrm <> 'ONLINE_STELLUNG_FALSCH' then raise; end if;
  end;
  p := public.online_zug(id_f, 'b7a8q', 'Q3k3/8/8/8/8/8/8/4K3 b - - 0 1', 'b');
  if p.fen <> 'Q3k3/8/8/8/8/8/8/4K3 b - - 0 1' then
    raise exception 'FEHLER: Umwandlung mit Schlagen abgelehnt';
  end if;
end
$$;
reset role;
update public.partien_online
set fen = '4k3/8/8/8/8/8/1p6/R3K3 b - - 0 1', am_zug = 'b'
where id = current_setting('online_test.partie_f')::uuid;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
begin
  p := public.online_zug(current_setting('online_test.partie_f')::uuid, 'b2a1r', '4k3/8/8/8/8/8/8/r3K3 w - - 0 2', 'w');
  if p.fen <> '4k3/8/8/8/8/8/8/r3K3 w - - 0 2' then
    raise exception 'FEHLER: Unterverwandlung von Schwarz abgelehnt';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 17. Ausgang "strittig": Ein Spieler beendet eine Partie mit kaputter Stellung ohne Ergebnis, auch wenn seine eigene
--     Uhr laeuft. Danach entscheidet die Uhr nicht mehr. Partie S: A (Weiss) gegen B (Schwarz), 1 Minute.
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
begin
  p := public.online_erstelle('w', 60, 0);
  perform set_config('online_test.code_s', p.code, true);
  perform set_config('online_test.partie_s', p.id::text, true);
  -- vor dem Beitritt gibt es nichts zu bestreiten
  begin
    perform public.online_strittig(p.id);
    raise exception 'FEHLER: offene Einladung liess sich als strittig beenden';
  exception
    when others then if sqlerrm <> 'ONLINE_PARTIE_NICHT_GESTARTET' then raise; end if;
  end;
end
$$;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$ begin if public.online_tritt_bei(current_setting('online_test.code_s')) ? 'fehler' then raise exception 'FEHLER: Beitritt zu Partie S gescheitert'; end if; end $$;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$ begin perform public.online_zug(current_setting('online_test.partie_s')::uuid, 'e2e4', 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', 'b'); end $$;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$ begin perform public.online_zug(current_setting('online_test.partie_s')::uuid, 'e7e5', 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2', 'w'); end $$;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$ begin perform public.online_zug(current_setting('online_test.partie_s')::uuid, 'g1f3', 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2', 'b'); end $$;
-- B ist am Zug, seine Uhr laeuft seit 30 Sekunden (noch nicht abgelaufen)
reset role;
update public.partien_online set letzter_zug_am = clock_timestamp() - interval '30 seconds'
where id = current_setting('online_test.partie_s')::uuid;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
do $$
begin
  perform public.online_strittig(current_setting('online_test.partie_s')::uuid);
  raise exception 'FEHLER: ein Dritter konnte eine fremde Partie als strittig beenden';
exception
  when others then if sqlerrm <> 'ONLINE_PARTIE_UNBEKANNT' then raise; end if;
end
$$;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
  id_s uuid := current_setting('online_test.partie_s')::uuid;
begin
  p := public.online_strittig(id_s);
  if p.status <> 'beendet' or p.grund <> 'strittig' or p.ergebnis is not null or p.remis_angebot is not null
     or p.zuege <> 'e2e4 e7e5 g1f3' or p.am_zug <> 'b' then
    raise exception 'FEHLER: strittig beendet die Partie falsch (status %, grund %, ergebnis %)', p.status, p.grund, p.ergebnis;
  end if;
  begin
    perform public.online_strittig(id_s);
    raise exception 'FEHLER: beendete Partie liess sich noch einmal als strittig melden';
  exception
    when others then if sqlerrm <> 'ONLINE_PARTIE_BEENDET' then raise; end if;
  end;
end
$$;
-- Danach entscheidet die Uhr nicht mehr: B ist inzwischen laengst ueber der Zeit, A reklamiert.
reset role;
update public.partien_online set letzter_zug_am = clock_timestamp() - interval '10 minutes'
where id = current_setting('online_test.partie_s')::uuid;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
begin
  p := public.online_pruefe_zeit(current_setting('online_test.partie_s')::uuid);
  if p.status <> 'beendet' or p.grund <> 'strittig' or p.ergebnis is not null or p.uhr_schwarz_ms <> 60000 then
    raise exception 'FEHLER: nach strittig entschied die Uhr (grund %, ergebnis %)', p.grund, p.ergebnis;
  end if;
end
$$;
-- Auch eine Zeile, die (nur am Recht vorbei) noch laeuft, aber "strittig" traegt, entscheidet die Uhr nicht.
reset role;
update public.partien_online set status = 'laeuft', grund = 'strittig'
where id = current_setting('online_test.partie_s')::uuid;
set local role authenticated;
do $$
declare
  p public.partien_online;
begin
  p := public.online_pruefe_zeit(current_setting('online_test.partie_s')::uuid);
  if p.ergebnis is not null or p.grund <> 'strittig' then
    raise exception 'FEHLER: online_uhr_pruefen entschied trotz "strittig" auf Zeit';
  end if;
end
$$;
reset role;
update public.partien_online set status = 'beendet'
where id = current_setting('online_test.partie_s')::uuid;
set local role authenticated;
-- Auch wenn die eigene Uhr schon abgelaufen ist, aber noch niemand reklamiert hat, endet die Partie als strittig
-- (sonst wartete ein Schummler mit einer erfundenen Stellung, bis die Uhr des Opfers ablaeuft). Partie S2, 1 Minute.
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
begin
  p := public.online_erstelle('w', 60, 0);
  perform set_config('online_test.code_s2', p.code, true);
  perform set_config('online_test.partie_s2', p.id::text, true);
end
$$;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$ begin if public.online_tritt_bei(current_setting('online_test.code_s2')) ? 'fehler' then raise exception 'FEHLER: Beitritt zu Partie S2 gescheitert'; end if; end $$;
reset role;
update public.partien_online
set zuege = 'e2e4 e7e5 g1f3', am_zug = 'b', fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
    letzter_zug_am = clock_timestamp() - interval '2 minutes'
where id = current_setting('online_test.partie_s2')::uuid;
set local role authenticated;
do $$
declare
  p public.partien_online;
begin
  p := public.online_strittig(current_setting('online_test.partie_s2')::uuid);
  if p.status <> 'beendet' or p.grund <> 'strittig' or p.ergebnis is not null then
    raise exception 'FEHLER: strittig bei abgelaufener eigener Uhr endet nicht als strittig (grund %, ergebnis %)', p.grund, p.ergebnis;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 18. Zeitende mit zu wenig Mattmaterial des Gegners ist Remis (grund 'zeit-material'). Fuenf Partien T1 bis T5,
--     A (Weiss) gegen B (Schwarz), 1 Minute; Stellung und Zuege als Besitzer gesetzt, Weiss am Zug und 10 Minuten
--     ueber der Zeit.
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
  i integer;
begin
  for i in 1..5 loop
    p := public.online_erstelle('w', 60, 0);
    perform set_config('online_test.partie_t' || i, p.id::text, true);
    -- B tritt gleich bei (die Bremse erlaubt A hoechstens 5 offene Einladungen)
    perform set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
    if public.online_tritt_bei(p.code) ? 'fehler' then
      raise exception 'FEHLER: Beitritt zu Partie T% gescheitert', i;
    end if;
    perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
  end loop;
end
$$;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
reset role;
update public.partien_online t
set zuege = 'e2e4 e7e5 g1f3 b8c6', am_zug = 'w', letzter_zug_am = clock_timestamp() - interval '10 minutes',
    fen = case t.id
      -- T1: Schwarz hat nur den Koenig
      when current_setting('online_test.partie_t1')::uuid then '4k3/8/8/8/8/8/8/4KQ2 w - - 0 40'
      -- T2: Schwarz hat Koenig und Springer, Weiss nur den Koenig
      when current_setting('online_test.partie_t2')::uuid then '4k3/8/8/2n5/8/8/8/4K3 w - - 0 40'
      -- T3: Schwarz hat Koenig und Springer, Weiss noch einen Bauern (ein Matt ist moeglich)
      when current_setting('online_test.partie_t3')::uuid then '4k3/8/8/2n5/8/8/4P3/4K3 w - - 0 40'
      -- T4: nur Laeufer auf dunklen Feldern (c5 und f2)
      when current_setting('online_test.partie_t4')::uuid then '4k3/8/8/2b5/8/8/5B2/4K3 w - - 0 40'
      -- T5: Laeufer auf verschiedenfarbigen Feldern (c5 und e2)
      else '4k3/8/8/2b5/8/8/4B3/4K3 w - - 0 40' end
where t.id in (current_setting('online_test.partie_t1')::uuid, current_setting('online_test.partie_t2')::uuid,
               current_setting('online_test.partie_t3')::uuid, current_setting('online_test.partie_t4')::uuid,
               current_setting('online_test.partie_t5')::uuid);
set local role authenticated;
do $$
declare
  p public.partien_online;
begin
  -- T1 reklamiert B (Zeit-Reklamation), T2 ueber den verspaeteten Zug von A
  p := public.online_pruefe_zeit(current_setting('online_test.partie_t1')::uuid);
  if p.status <> 'beendet' or p.ergebnis <> '1/2-1/2' or p.grund <> 'zeit-material' or p.uhr_weiss_ms <> 0 then
    raise exception 'FEHLER: Zeitende gegen den blanken Koenig ist kein Remis (ergebnis %, grund %)', p.ergebnis, p.grund;
  end if;
  p := public.online_pruefe_zeit(current_setting('online_test.partie_t3')::uuid);
  if p.ergebnis <> '0-1' or p.grund <> 'zeit' then
    raise exception 'FEHLER: Koenig und Springer gegen Koenig und Bauer muss auf Zeit gewinnen (ergebnis %, grund %)', p.ergebnis, p.grund;
  end if;
  p := public.online_pruefe_zeit(current_setting('online_test.partie_t4')::uuid);
  if p.ergebnis <> '1/2-1/2' or p.grund <> 'zeit-material' then
    raise exception 'FEHLER: gleichfarbige Laeufer: Zeitende ist kein Remis (ergebnis %, grund %)', p.ergebnis, p.grund;
  end if;
  p := public.online_pruefe_zeit(current_setting('online_test.partie_t5')::uuid);
  if p.ergebnis <> '0-1' or p.grund <> 'zeit' then
    raise exception 'FEHLER: verschiedenfarbige Laeufer muessen auf Zeit gewinnen (ergebnis %, grund %)', p.ergebnis, p.grund;
  end if;
end
$$;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
begin
  p := public.online_zug(current_setting('online_test.partie_t2')::uuid, 'e1d1', '4k3/8/8/2n5/8/8/8/3K4 b - - 1 40', 'b');
  if p.status <> 'beendet' or p.ergebnis <> '1/2-1/2' or p.grund <> 'zeit-material' or p.zuege <> 'e2e4 e7e5 g1f3 b8c6' then
    raise exception 'FEHLER: Koenig und Springer gegen den blanken Koenig ist auf Zeit kein Remis (ergebnis %, grund %)', p.ergebnis, p.grund;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 19. Haengende Partien: MIT Uhr vor dem 2. Halbzug nach 10 Minuten ohne Zug "abgebrochen" (ohne Ergebnis), OHNE Uhr
--     erst nach 7 Tagen. Ab dem 2. Halbzug entscheidet die Uhr. A (Weiss) gegen B (Schwarz):
--     H1 Uhr, kein Zug, 11 Minuten (B reklamiert)      H2 Uhr, 1 Halbzug, 11 Minuten (Aufraeumen bei online_meine)
--     H3 Uhr, 1 Halbzug, 9 Minuten (laeuft weiter)      H4 ohne Uhr, 1 Halbzug, 11 Minuten (laeuft weiter)
--     H5 ohne Uhr, erst 11 Minuten, dann 8 Tage (Aufraeumen beim Anlegen)
--     H6 Uhr 15 Minuten, 3 Halbzuege, 11 Minuten (laeuft weiter)
--     H7 Uhr, kein Zug, 11 Minuten (der verspaetete erste Zug von A verfaellt)
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
  i integer;
begin
  for i in 1..7 loop
    p := public.online_erstelle('w', case when i in (4, 5) then null when i = 6 then 900 else 300 end, 0);
    perform set_config('online_test.code_h' || i, p.code, true);
    perform set_config('online_test.partie_h' || i, p.id::text, true);
    if i = 4 then
      -- nicht mehr als 4 offene Einladungen gleichzeitig (Bremse): B tritt den ersten vier schon jetzt bei
      perform set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
      for j in 1..4 loop
        if public.online_tritt_bei(current_setting('online_test.code_h' || j)) ? 'fehler' then
          raise exception 'FEHLER: Beitritt zu Partie H% gescheitert', j;
        end if;
      end loop;
      perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
    end if;
  end loop;
end
$$;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$
declare
  i integer;
begin
  for i in 5..7 loop
    if public.online_tritt_bei(current_setting('online_test.code_h' || i)) ? 'fehler' then
      raise exception 'FEHLER: Beitritt zu Partie H% gescheitert', i;
    end if;
  end loop;
end
$$;
reset role;
update public.partien_online t
set zuege = case t.id
      when current_setting('online_test.partie_h1')::uuid then ''
      when current_setting('online_test.partie_h7')::uuid then ''
      when current_setting('online_test.partie_h6')::uuid then 'e2e4 e7e5 g1f3'
      when current_setting('online_test.partie_h5')::uuid then ''
      else 'e2e4' end,
    fen = case t.id
      when current_setting('online_test.partie_h6')::uuid then 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2'
      when current_setting('online_test.partie_h1')::uuid then t.fen
      when current_setting('online_test.partie_h7')::uuid then t.fen
      when current_setting('online_test.partie_h5')::uuid then t.fen
      else 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1' end,
    am_zug = case when t.id in (current_setting('online_test.partie_h1')::uuid, current_setting('online_test.partie_h7')::uuid,
                                current_setting('online_test.partie_h5')::uuid) then 'w' else 'b' end,
    letzter_zug_am = clock_timestamp() - case t.id
      when current_setting('online_test.partie_h3')::uuid then interval '9 minutes'
      else interval '11 minutes' end
where t.id in (select current_setting('online_test.partie_h' || i)::uuid from generate_series(1, 7) i);
set local role authenticated;
-- H1: B reklamiert die Zeit, die Partie endet als abgebrochen (kein Sieg, Weiss hat nie gezogen)
do $$
declare
  p public.partien_online;
begin
  p := public.online_pruefe_zeit(current_setting('online_test.partie_h1')::uuid);
  if p.status <> 'beendet' or p.grund <> 'abgebrochen' or p.ergebnis is not null then
    raise exception 'FEHLER: Partie mit Uhr ohne Zug nach 11 Minuten nicht abgebrochen (status %, grund %, ergebnis %)', p.status, p.grund, p.ergebnis;
  end if;
end
$$;
-- H7: der verspaetete erste Zug von A verfaellt, die Partie endet als abgebrochen
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
begin
  p := public.online_zug(current_setting('online_test.partie_h7')::uuid, 'e2e4', 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', 'b');
  if p.status <> 'beendet' or p.grund <> 'abgebrochen' or p.ergebnis is not null or p.zuege <> '' then
    raise exception 'FEHLER: Zug in einer haengenden Partie wurde verbucht (status %, grund %)', p.status, p.grund;
  end if;
end
$$;
-- H2 und H4: C ruft online_meine auf (sieht die Partien nicht, raeumt aber fuer alle auf)
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
do $$
begin
  if exists (select 1 from public.online_meine() m where m.erstellt_von <> 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
             and 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' not in (m.weiss, m.schwarz)) then
    raise exception 'FEHLER: online_meine zeigt C fremde Partien';
  end if;
end
$$;
reset role;
do $$
declare
  h2 public.partien_online;
  h4 public.partien_online;
  h3 public.partien_online;
  h6 public.partien_online;
begin
  select * into h2 from public.partien_online where id = current_setting('online_test.partie_h2')::uuid;
  select * into h3 from public.partien_online where id = current_setting('online_test.partie_h3')::uuid;
  select * into h4 from public.partien_online where id = current_setting('online_test.partie_h4')::uuid;
  select * into h6 from public.partien_online where id = current_setting('online_test.partie_h6')::uuid;
  if h2.status <> 'beendet' or h2.grund <> 'abgebrochen' or h2.ergebnis is not null then
    raise exception 'FEHLER: Partie mit Uhr und einem Halbzug nach 11 Minuten nicht weggeraeumt (status %, grund %)', h2.status, h2.grund;
  end if;
  if h3.status <> 'laeuft' then
    raise exception 'FEHLER: Partie mit Uhr nach 9 Minuten schon abgebrochen';
  end if;
  if h4.status <> 'laeuft' then
    raise exception 'FEHLER: Partie ohne Uhr nach 10 Minuten abgebrochen (die Regel gilt nur mit Uhr)';
  end if;
  if h6.status <> 'laeuft' then
    raise exception 'FEHLER: Partie mit laufender Uhr (3 Halbzuege, Restzeit) abgebrochen';
  end if;
  if (select status from public.partien_online where id = current_setting('online_test.partie_h5')::uuid) <> 'laeuft' then
    raise exception 'FEHLER: Partie ohne Uhr ohne Zug nach 11 Minuten abgebrochen';
  end if;
end
$$;
-- H5: jetzt seit 8 Tagen ohne Zug (ohne Uhr)
update public.partien_online set letzter_zug_am = clock_timestamp() - interval '8 days'
where id = current_setting('online_test.partie_h5')::uuid;
set local role authenticated;
-- H3, H4 und H6 auch bei der Zeit-Reklamation unveraendert; H5 (8 Tage ohne Zug, ohne Uhr) beim naechsten Anlegen weg
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$
declare
  p public.partien_online;
  i integer;
begin
  foreach i in array array[3, 4, 6] loop
    p := public.online_pruefe_zeit(current_setting('online_test.partie_h' || i)::uuid);
    if p.status <> 'laeuft' then
      raise exception 'FEHLER: Zeit-Reklamation beendet Partie H% (grund %)', i, p.grund;
    end if;
  end loop;
  p := public.online_erstelle('b', null, null);
  perform public.online_gib_auf(p.id);
  select * into p from public.partien_online where id = current_setting('online_test.partie_h5')::uuid;
  if p.status <> 'beendet' or p.grund <> 'abgebrochen' or p.ergebnis is not null then
    raise exception 'FEHLER: Partie ohne Uhr nach 8 Tagen ohne Zug nicht abgebrochen (status %, grund %)', p.status, p.grund;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 20. Rechte und Hygiene: neue Teile nur fuer angemeldete Nutzer, Helfer intern, leerer search_path ueberall.
set local role anon;
do $$
begin
  begin
    perform public.online_strittig(current_setting('online_test.partie_s')::uuid);
    raise exception 'FEHLER: anon darf online_strittig aufrufen';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform public.online_tritt_bei('ABCDEF');
    raise exception 'FEHLER: anon darf online_tritt_bei aufrufen';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.online_versuche;
    raise exception 'FEHLER: anon liest online_versuche';
  exception
    when insufficient_privilege then null;
  end;
end
$$;
reset role;
do $$
declare
  f text;
  offen text;
begin
  -- interne Helfer: weder anon noch angemeldete Nutzer duerfen sie aufrufen
  foreach f in array array['public.online_aufraeumen()', 'public.online_brett(text)',
    'public.online_folge_passt(text, text, text)', 'public.online_kann_nicht_matt_setzen(text, text)',
    'public.online_haengt(public.partien_online)', 'public.online_zeitende(public.partien_online)',
    'public.online_uhr_pruefen(public.partien_online)', 'public.online_hole_laufende(uuid, uuid)',
    'public.online_vor_anlegen()'] loop
    if has_function_privilege('authenticated', f, 'execute') or has_function_privilege('anon', f, 'execute') then
      raise exception 'FEHLER: interner Helfer fuer Nutzer aufrufbar: %', f;
    end if;
  end loop;
  -- Einstiege: nur angemeldete Nutzer
  foreach f in array array['public.online_erstelle(text, integer, integer)', 'public.online_tritt_bei(text)',
    'public.online_zug(uuid, text, text, text, text, text)', 'public.online_strittig(uuid)', 'public.online_gib_auf(uuid)',
    'public.online_biete_remis(uuid)', 'public.online_nimm_remis_an(uuid)', 'public.online_pruefe_zeit(uuid)',
    'public.online_meine()'] loop
    if not has_function_privilege('authenticated', f, 'execute') or has_function_privilege('anon', f, 'execute') then
      raise exception 'FEHLER: falsche Rechte fuer %', f;
    end if;
  end loop;
  -- jede Funktion des Online-Schemas (online_..., auch die Helfer) mit leerem search_path
  select string_agg(f.proname, ', ' order by f.proname) into offen
  from pg_catalog.pg_proc f
  where f.pronamespace = 'public'::regnamespace and f.proname like 'online\_%'
    and not coalesce(f.proconfig @> array['search_path=""'], false);
  if offen is not null then
    raise exception 'FEHLER: search_path nicht leer in: %', offen;
  end if;
  -- und genau die Einstiege laufen als Besitzer (security definer)
  select string_agg(f.proname, ', ' order by f.proname) into offen
  from pg_catalog.pg_proc f
  where f.pronamespace = 'public'::regnamespace and f.proname like 'online\_%' and f.prosecdef;
  if offen is distinct from 'online_biete_remis, online_erstelle, online_gib_auf, online_meine, online_nimm_remis_an, online_pruefe_zeit, online_strittig, online_tritt_bei, online_zug' then
    raise exception 'FEHLER: unerwartete Security-Definer-Funktionen: %', offen;
  end if;
end
$$;
set local role authenticated;

select 'Online-RLS-Test erfolgreich' as ergebnis;
rollback;

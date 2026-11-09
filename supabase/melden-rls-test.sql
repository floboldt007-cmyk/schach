-- Prueft supabase/melden-schema.sql im Supabase SQL Editor (als Besitzer, wie dort ueblich). Alles wird am Ende
-- zurueckgerollt. Drei kurzlebige Nutzer A, B, C und sieben weitere Ziele fuer die Tagesgrenze.
-- Jeder Fehler bricht mit "FEHLER: ..." ab; ohne Fehler meldet der Lauf "Melden-RLS-Test erfolgreich" und rollt zurueck.
-- Abschnitte: 1 Namensfilter (gesperrt, harmlos, bestehende Namen bleiben); 2 Melden (Gruende, Text, selbst, unbekannt,
-- einmal je Tag, Tagesgrenze 5, neuer Tag); 3 niemand liest Meldungen (auch nicht der Gemeldete), anon darf nichts;
-- 4 Meldung aus einer Online-Partie (nur mit online-schema.sql); 5 Aufraeumen nach 12 Monaten, Loeschen mit dem Konto.
begin;

insert into auth.users (id, email)
values
  ('a2a2a2a2-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'melden-a@example.invalid'),
  ('b2b2b2b2-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'melden-b@example.invalid'),
  ('c2c2c2c2-cccc-4ccc-8ccc-cccccccccccc', 'melden-c@example.invalid');
insert into auth.users (id, email)
select ('d2d2d2d2-dddd-4ddd-8ddd-00000000000' || i)::uuid, 'melden-z' || i || '@example.invalid' from generate_series(1, 7) i;

-- ---------- 1. Namensfilter ----------
-- Die Funktion selbst, als Besitzer: gesperrte und harmlose Namen
do $$
declare
  n text;
begin
  foreach n in array array['admin', 'Admin', 'ADMIN_1', '4dm1n', 'a_d_m_i_n', 'TheAdmin', 'Admin_Tom', 'Administrator', 'Support',
      'Support_Team', '5upp0rt', 'CrownmateTeam', 'Cr0wnm4te', 'crown_mate', 'xX_Crownmate_Xx', 'Moderator', 'M0der4tor', 'mod', 'Mod_1',
      'Team', 'T34M', 'Official', '0ff1c14l', 'System', 'Staff', 'Spieler', 'Gegner', 'Player_1', 'Bot', 'Hilfe', 'TeamSupport'] loop
    if public.name_gesperrt(n) is distinct from 'reserviert' then
      raise exception 'FEHLER: reservierter Name % nicht als reserviert erkannt (%)', n, public.name_gesperrt(n);
    end if;
  end loop;
  foreach n in array array['Hurensohn', 'hur3n50hn', 'H_u_r_e_n_s_o_h_n', 'xXfotzeXx', 'Wichser99', 'N1gger', 'nigga_1', 'Schlampe',
      'Arschloch', 'fuck_you', 'F4ggot', 'Hitler', 'H1tler', 'HitIer_no', 'SiegHeil', 'Nazi', 'N4z1', 'Bitch', 'b1tch', 'cunt', 'Cunt_1',
      'Missgeburt', 'Kanake', 'Spasti', 'retard', 'Hure', 'fick_dich'] loop
    if public.name_gesperrt(n) is distinct from 'anstoessig' then
      raise exception 'FEHLER: anstoessiger Name % nicht erkannt (%)', n, public.name_gesperrt(n);
    end if;
  end loop;
  -- harmlose Namen, in denen Sperrwoerter stecken oder die so aehnlich klingen (Scunthorpe-Problem)
  foreach n in array array['Hassan', 'Dickens', 'Analyst', 'Scunthorpe', 'Badminton', 'Essex', 'Sussex', 'Therapist', 'Hancock',
      'Nazir', 'Nazim', 'Ashkenazi', 'Absolut', 'Grapefruit', 'Torpedo', 'Pedro', 'Mongolei', 'Supporter96', 'TeamRocket', 'Steam_Fan',
      'Ecosystem', 'Unofficial_Tom', 'Schwarzenegger', 'Nigeria_Fan', 'Marschall', 'Barsch', 'Kitten', 'VanDyke', 'Cockburn', 'Arsenal', 'Brochure', 'Penistone', 'Schure', 'Lillill', 'Illi',
      'Wichtel', 'Assassin', 'Mittens', 'Popcorn', 'Whitehorse', 'Kiki', 'Mate', 'Dev', 'Modric', 'Botvinnik', 'Freundlich', 'Flo', 'flo_1',
      'lena_spielt', 'Magnus2013', 'Schachmatt', 'karte_a', 'Admiral', 'Helper', 'Systematic', 'Robot_7', 'Anna', 'Butch', 'Shiitake',
      '123', '___', 'Spielerin', 'Gegnerin', 'Teamgeist', 'Hilfreich'] loop
    if public.name_gesperrt(n) is not null then
      raise exception 'FEHLER: harmloser Name % gesperrt (%)', n, public.name_gesperrt(n);
    end if;
  end loop;
end;
$$;

-- Der Trigger, als angemeldeter Nutzer A: gesperrte Namen kommen nicht in die Tabelle, harmlose schon
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a2a2a2a2-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  n text;
begin
  foreach n in array array['Admin', 'Support_1', 'Crownmate', 'M0derator', 'Hurensohn', 'f_u_c_k'] loop
    begin
      insert into public.profile (user_id, benutzername) values ('a2a2a2a2-aaaa-4aaa-8aaa-aaaaaaaaaaaa', n);
      raise exception 'FEHLER: gesperrter Name % angelegt', n;
    exception when raise_exception then
      if sqlerrm like 'FEHLER%' then raise; end if;
      if sqlerrm <> 'NAME_GESPERRT' then raise exception 'FEHLER: falsche Meldung fuer %: %', n, sqlerrm; end if;
    end;
  end loop;
  insert into public.profile (user_id, benutzername) values ('a2a2a2a2-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Hassan');
  update public.profile set benutzername = 'Dickens' where user_id = 'a2a2a2a2-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  update public.profile set benutzername = 'Scunthorpe' where user_id = 'a2a2a2a2-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  update public.profile set benutzername = 'Analyst' where user_id = 'a2a2a2a2-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  begin
    update public.profile set benutzername = 'Admin_Anna' where user_id = 'a2a2a2a2-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    raise exception 'FEHLER: Aendern auf einen gesperrten Namen ging durch';
  exception when raise_exception then
    if sqlerrm like 'FEHLER%' then raise; end if;
  end;
  if (select benutzername from public.profile where user_id = 'a2a2a2a2-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 'Analyst' then
    raise exception 'FEHLER: Name nach abgelehnter Aenderung nicht mehr Analyst';
  end if;
  -- die Funktionen des Filters sind fuer Nutzer nicht aufrufbar
  begin
    perform public.name_gesperrt('x');
    raise exception 'FEHLER: name_gesperrt fuer Nutzer aufrufbar';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- Bestehende Namen bleiben: ein Name von vor dem Filter (hier ohne Trigger angelegt) laesst sich weiter speichern
-- (gleiches Wort, auch mit anderer Gross- und Kleinschreibung), erst ein NEUER gesperrter Name wird abgelehnt.
alter table public.profile disable trigger profile_name_pruefen;
insert into public.profile (user_id, benutzername) values ('b2b2b2b2-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Admin_Alt');
alter table public.profile enable trigger profile_name_pruefen;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b2b2b2b2-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$
begin
  -- so speichert die App (js/konto.js): upsert mit demselben Namen
  insert into public.profile (user_id, benutzername) values ('b2b2b2b2-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Admin_Alt')
  on conflict (user_id) do update set benutzername = excluded.benutzername;
  update public.profile set benutzername = 'admin_alt' where user_id = 'b2b2b2b2-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  begin
    update public.profile set benutzername = 'Admin_Neu' where user_id = 'b2b2b2b2-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    raise exception 'FEHLER: neuer gesperrter Name fuer ein Konto mit altem Namen ging durch';
  exception when raise_exception then
    if sqlerrm like 'FEHLER%' then raise; end if;
  end;
  update public.profile set benutzername = 'Bert_spielt' where user_id = 'b2b2b2b2-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
end;
$$;
reset role;
insert into public.profile (user_id, benutzername)
select ('d2d2d2d2-dddd-4ddd-8ddd-00000000000' || i)::uuid, 'melden_ziel_' || i from generate_series(1, 7) i;

-- ---------- 2. Melden ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a2a2a2a2-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  r jsonb;
begin
  r := public.melde_stand();
  if (r ->> 'rest')::integer <> 5 or (r ->> 'max')::integer <> 5 then raise exception 'FEHLER: Stand am Anfang %', r; end if;
  -- ungueltige Eingaben
  r := public.melde_spieler('Bert_spielt', 'gibtsnicht');
  if r ->> 'fehler' <> 'MELDEN_UNGUELTIG' then raise exception 'FEHLER: unbekannter Grund angenommen %', r; end if;
  r := public.melde_spieler('Bert_spielt', null);
  if r ->> 'fehler' <> 'MELDEN_UNGUELTIG' then raise exception 'FEHLER: Grund null angenommen %', r; end if;
  r := public.melde_spieler('Bert_spielt', 'name', repeat('x', 301));
  if r ->> 'fehler' <> 'MELDEN_UNGUELTIG' then raise exception 'FEHLER: zu langer Text angenommen %', r; end if;
  r := public.melde_spieler('kein gueltiger name!', 'name');
  if r ->> 'fehler' <> 'MELDEN_UNGUELTIG' then raise exception 'FEHLER: Name mit Sonderzeichen angenommen %', r; end if;
  r := public.melde_spieler(null, 'name');
  if r ->> 'fehler' <> 'MELDEN_UNGUELTIG' then raise exception 'FEHLER: Meldung ohne Ziel angenommen %', r; end if;
  r := public.melde_spieler('gibt_es_nicht', 'name');
  if r ->> 'fehler' <> 'MELDEN_UNBEKANNT' then raise exception 'FEHLER: unbekannter Spieler %', r; end if;
  r := public.melde_spieler('ANALYST', 'name');
  if r ->> 'fehler' <> 'MELDEN_SELBST' then raise exception 'FEHLER: sich selbst gemeldet %', r; end if;
  r := public.melde_stand();
  if (r ->> 'rest')::integer <> 5 then raise exception 'FEHLER: abgelehnte Meldungen zaehlen mit %', r; end if;

  -- eine gueltige Meldung (Gross- und Kleinschreibung des Namens egal), Text wird gesaeubert
  r := public.melde_spieler('bert_SPIELT', 'name', E'  beleidigt\nmich  ');
  if r is distinct from '{"ok": true, "rest": 4}'::jsonb then raise exception 'FEHLER: erste Meldung %', r; end if;
  -- derselbe Spieler am selben Tag: freundlich, aber keine zweite Zeile und kein Verbrauch
  r := public.melde_spieler('Bert_spielt', 'verhalten');
  if r is distinct from '{"ok": true, "schon": true}'::jsonb then raise exception 'FEHLER: doppelte Meldung %', r; end if;
  r := public.melde_stand();
  if (r ->> 'rest')::integer <> 4 then raise exception 'FEHLER: Stand nach einer Meldung %', r; end if;
  -- leerer Text zaehlt als kein Text
  r := public.melde_spieler('melden_ziel_1', 'sonstiges', '   ');
  r := public.melde_spieler('melden_ziel_2', 'verhalten', repeat('y', 300));
  r := public.melde_spieler('melden_ziel_3', 'name');
  r := public.melde_spieler('melden_ziel_4', 'name');
  if r is distinct from '{"ok": true, "rest": 0}'::jsonb then raise exception 'FEHLER: fuenfte Meldung %', r; end if;
  -- Tagesgrenze: die sechste geht nicht mehr
  r := public.melde_spieler('melden_ziel_5', 'name');
  if r ->> 'fehler' <> 'MELDEN_GRENZE' then raise exception 'FEHLER: sechste Meldung am selben Tag angenommen %', r; end if;
  -- ein schon gemeldeter Spieler bleibt auch an der Grenze freundlich
  r := public.melde_spieler('Bert_spielt', 'name');
  if r is distinct from '{"ok": true, "schon": true}'::jsonb then raise exception 'FEHLER: doppelte Meldung an der Grenze %', r; end if;
end;
$$;
reset role;
do $$
declare
  m record;
begin
  if (select count(*) from public.meldungen) <> 5 then
    raise exception 'FEHLER: erwartet 5 Meldungen, da sind %', (select count(*) from public.meldungen);
  end if;
  select * into m from public.meldungen where gemeldet = 'b2b2b2b2-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if m.melder <> 'a2a2a2a2-aaaa-4aaa-8aaa-aaaaaaaaaaaa' or m.grund <> 'name' or m.notiz <> 'beleidigt mich'
     or m.gemeldeter_name <> 'Bert_spielt' or m.stand <> 'offen' or m.tag <> public.melden_tag() then
    raise exception 'FEHLER: Inhalt der Meldung %', to_jsonb(m);
  end if;
  if (select notiz from public.meldungen where gemeldeter_name = 'melden_ziel_1') is not null then
    raise exception 'FEHLER: leerer Text nicht als null gespeichert';
  end if;
  -- der Melde-Tag: Europe/Berlin mit Tagesgrenze 4:00 Uhr
  if public.melden_tag() <> ((now() at time zone 'Europe/Berlin') - interval '4 hours')::date then
    raise exception 'FEHLER: melden_tag rechnet nicht Europe/Berlin mit Tagesgrenze 4:00';
  end if;
  -- neuer Tag: die Meldungen von heute liegen jetzt "gestern", dann geht wieder alles
  update public.meldungen set tag = tag - 1;
end;
$$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a2a2a2a2-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  r jsonb;
begin
  r := public.melde_stand();
  if (r ->> 'rest')::integer <> 5 then raise exception 'FEHLER: am neuen Tag nicht wieder 5 frei %', r; end if;
  r := public.melde_spieler('Bert_spielt', 'verhalten');
  if r is distinct from '{"ok": true, "rest": 4}'::jsonb then raise exception 'FEHLER: derselbe Spieler am naechsten Tag %', r; end if;
end;
$$;

-- ---------- 3. Niemand liest Meldungen ----------
do $$
declare
  n integer;
begin
  -- der Meldende selbst
  begin
    select count(*) into n from public.meldungen;
    raise exception 'FEHLER: der Meldende liest die Tabelle (% Zeilen)', n;
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.meldungen (melder, gemeldet, grund, tag)
    values ('a2a2a2a2-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c2c2c2c2-cccc-4ccc-8ccc-cccccccccccc', 'name', current_date);
    raise exception 'FEHLER: Nutzer schreibt direkt in die Tabelle';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.meldungen;
    raise exception 'FEHLER: Nutzer loescht Meldungen';
  exception when insufficient_privilege then null;
  end;
end;
$$;
-- der Gemeldete (B) sieht nichts ueber sich, auch nicht ueber die Funktionen
select set_config('request.jwt.claims', '{"sub":"b2b2b2b2-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$
declare
  n integer;
  r jsonb;
begin
  begin
    select count(*) into n from public.meldungen where gemeldet = 'b2b2b2b2-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    raise exception 'FEHLER: der Gemeldete liest Meldungen ueber sich (% Zeilen)', n;
  exception when insufficient_privilege then null;
  end;
  r := public.melde_stand();
  if r is distinct from '{"max": 5, "rest": 5, "notiz_max": 300}'::jsonb then
    raise exception 'FEHLER: melde_stand des Gemeldeten verraet mehr als den eigenen Stand %', r;
  end if;
  begin
    perform public.melden_konstanten();
    raise exception 'FEHLER: melden_konstanten fuer Nutzer aufrufbar';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
-- anon: keine Funktion, keine Tabelle
set local role anon;
select set_config('request.jwt.claims', '', true);
do $$
begin
  begin
    perform public.melde_spieler('Bert_spielt', 'name');
    raise exception 'FEHLER: anon darf melden';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.melde_stand();
    raise exception 'FEHLER: anon darf melde_stand aufrufen';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.meldungen;
    raise exception 'FEHLER: anon liest Meldungen';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.meldungen'::regclass) then
    raise exception 'FEHLER: RLS an meldungen ist aus';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'meldungen') then
    raise exception 'FEHLER: meldungen hat eine Policy (soll keine haben)';
  end if;
end;
$$;

-- ---------- 4. Meldung aus einer Online-Partie (nur mit online-schema.sql) ----------
do $$
declare
  p uuid;
  r jsonb;
begin
  if to_regclass('public.partien_online') is null then
    raise notice 'Abschnitt 4 uebersprungen: online-schema.sql ist nicht eingespielt';
    return;
  end if;
  -- B gegen C; A ist unbeteiligt
  execute 'insert into public.partien_online (erstellt_von, fen) values ($1, ''egal'') returning id'
    into p using 'b2b2b2b2-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid;
  execute 'update public.partien_online set weiss = $1, schwarz = $2, status = ''laeuft'' where id = $3'
    using 'b2b2b2b2-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, 'c2c2c2c2-cccc-4ccc-8ccc-cccccccccccc'::uuid, p;
  -- Unbeteiligter A: die Partie nennt ihm keinen Gegner
  perform set_config('request.jwt.claims', '{"sub":"a2a2a2a2-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
  r := public.melde_spieler(null, 'verhalten', null, p);
  if r ->> 'fehler' <> 'MELDEN_UNBEKANNT' then raise exception 'FEHLER: Unbeteiligter meldet ueber eine fremde Partie %', r; end if;
  -- Teilnehmer C meldet den Gegner B; C hat keinen Benutzernamen, B schon
  perform set_config('request.jwt.claims', '{"sub":"c2c2c2c2-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
  r := public.melde_spieler(null, 'verhalten', 'laesst die Uhr laufen', p);
  if r is distinct from '{"ok": true, "rest": 4}'::jsonb then raise exception 'FEHLER: Meldung aus der Partie %', r; end if;
  if not exists (select 1 from public.meldungen m where m.melder = 'c2c2c2c2-cccc-4ccc-8ccc-cccccccccccc'
                 and m.gemeldet = 'b2b2b2b2-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and m.partie = p and m.gemeldeter_name = 'Bert_spielt') then
    raise exception 'FEHLER: Meldung aus der Partie nicht richtig gespeichert';
  end if;
  -- eine Partie, die es nicht gibt
  r := public.melde_spieler(null, 'verhalten', null, '00000000-0000-4000-8000-000000000000');
  if r ->> 'fehler' <> 'MELDEN_UNBEKANNT' then raise exception 'FEHLER: unbekannte Partie %', r; end if;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- ---------- 5. Aufraeumen nach 12 Monaten, Loeschen mit dem Konto ----------
insert into public.meldungen (melder, gemeldet, grund, tag, am)
values ('d2d2d2d2-dddd-4ddd-8ddd-000000000001', 'd2d2d2d2-dddd-4ddd-8ddd-000000000002', 'name', current_date - 400, now() - interval '13 months'),
       ('d2d2d2d2-dddd-4ddd-8ddd-000000000001', 'd2d2d2d2-dddd-4ddd-8ddd-000000000003', 'name', current_date - 300, now() - interval '11 months');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d2d2d2d2-dddd-4ddd-8ddd-000000000007","role":"authenticated"}', true);
select public.melde_spieler('melden_ziel_6', 'sonstiges');
reset role;
do $$
declare
  vorher integer;
begin
  if exists (select 1 from public.meldungen where am < now() - interval '12 months') then
    raise exception 'FEHLER: Meldung aelter als 12 Monate nicht geloescht';
  end if;
  if not exists (select 1 from public.meldungen where gemeldet = 'd2d2d2d2-dddd-4ddd-8ddd-000000000003') then
    raise exception 'FEHLER: Meldung juenger als 12 Monate geloescht';
  end if;
  -- Konto des Gemeldeten B weg: seine Meldungen sind weg; Konto des Meldenden A weg: dessen Meldungen auch
  select count(*) into vorher from public.meldungen;
  delete from auth.users where id = 'b2b2b2b2-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if exists (select 1 from public.meldungen where gemeldet = 'b2b2b2b2-bbbb-4bbb-8bbb-bbbbbbbbbbbb') then
    raise exception 'FEHLER: Meldungen ueber ein geloeschtes Konto bleiben stehen';
  end if;
  delete from auth.users where id = 'a2a2a2a2-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if exists (select 1 from public.meldungen where melder = 'a2a2a2a2-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then
    raise exception 'FEHLER: Meldungen eines geloeschten Kontos bleiben stehen';
  end if;
  if (select count(*) from public.meldungen) >= vorher then
    raise exception 'FEHLER: Loeschen der Konten hat keine Meldung entfernt';
  end if;
end;
$$;

do $$ begin raise notice 'Melden-RLS-Test erfolgreich'; end; $$;
rollback;

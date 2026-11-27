-- Prueft supabase/namen-filter-schema.sql im Supabase SQL Editor (als Besitzer). Alles wird am Ende zurueckgerollt.
-- Voraussetzung: schema.sql und namen-filter-schema.sql eingespielt; laeuft mit und ohne benutzername-sperre-schema.sql
-- und benutzername-bestaetigt-schema.sql (jedes Testkonto aendert seinen Namen hoechstens einmal selbst).
-- Jeder Fehler bricht mit "FEHLER: ..." ab; ohne Fehler endet der Lauf mit ROLLBACK.
-- Abschnitte: 1 die Funktion (reserviert, anstoessig, harmlos); 2 Anlegen gesperrt (NAME_UNZULAESSIG mit Grund), harmlos
-- frei; 3 Aendern auf einen gesperrten Namen abgelehnt, Name und Monats-Frist bleiben, danach geht eine harmlose Aenderung;
-- 4 Besitzer frei, ein bestehender Name bleibt auch beim erneuten Sichern; 5 Rechte.
begin;

insert into auth.users (id, email)
values
  ('a8000000-0000-4000-8000-0000000000a8', 'namen-filter-a@example.invalid'),
  ('b8000000-0000-4000-8000-0000000000b8', 'namen-filter-b@example.invalid');

-- 1 die Funktion selbst, als Besitzer
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
      'Ecosystem', 'Unofficial_Tom', 'Schwarzenegger', 'Nigeria_Fan', 'Marschall', 'Barsch', 'Kitten', 'VanDyke', 'Cockburn', 'Arsenal',
      'Brochure', 'Penistone', 'Schure', 'Lillill', 'Illi', 'Wichtel', 'Assassin', 'Mittens', 'Popcorn', 'Whitehorse', 'Kiki', 'Mate',
      'Dev', 'Modric', 'Botvinnik', 'Freundlich', 'Flo', 'flo_1', 'lena_spielt', 'Magnus2013', 'Schachmatt', 'karte_a', 'Admiral',
      'Helper', 'Systematic', 'Robot_7', 'Anna', 'Butch', 'Shiitake', '123', '___', 'Spielerin', 'Gegnerin', 'Teamgeist', 'Hilfreich'] loop
    if public.name_gesperrt(n) is not null then
      raise exception 'FEHLER: harmloser Name % gesperrt (%)', n, public.name_gesperrt(n);
    end if;
  end loop;
end;
$$;

-- 2 und 3 als angemeldeter Nutzer A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a8000000-0000-4000-8000-0000000000a8","role":"authenticated"}', true);
do $$
declare
  n text;
  grund text;
  erwartet text;
begin
  foreach n in array array['Admin', 'Support_1', 'Crownmate', 'M0derator', 'Hurensohn', 'f_u_c_k'] loop
    erwartet := case when n in ('Hurensohn', 'f_u_c_k') then 'anstoessig' else 'reserviert' end;
    begin
      insert into public.profile (user_id, benutzername) values ('a8000000-0000-4000-8000-0000000000a8', n);
      raise exception 'FEHLER: gesperrter Name % angelegt', n;
    exception when raise_exception then
      get stacked diagnostics grund = pg_exception_hint;
      if sqlerrm like 'FEHLER%' then raise; end if;
      if sqlerrm <> 'NAME_UNZULAESSIG' then raise exception 'FEHLER: falsche Meldung fuer %: %', n, sqlerrm; end if;
      if grund is distinct from erwartet then raise exception 'FEHLER: falscher Grund fuer %: %', n, grund; end if;
    end;
  end loop;
  insert into public.profile (user_id, benutzername) values ('a8000000-0000-4000-8000-0000000000a8', 'Hassan');
  -- erneutes Sichern mit demselben Namen (wie "Jetzt sichern") bleibt erlaubt
  insert into public.profile (user_id, benutzername) values ('a8000000-0000-4000-8000-0000000000a8', 'Hassan')
  on conflict (user_id) do update set benutzername = excluded.benutzername;
end;
$$;

-- mit Monats-Sperre und Haken setzt schon das erste eigene Setzen die Frist: als Besitzer aufheben (wie nach 30 Tagen),
-- damit Abschnitt 3 die naechste eigene Aenderung pruefen kann
reset role;
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profile'
             and column_name = 'name_geaendert_am') then
    execute 'update public.profile set name_geaendert_am = null where user_id = $1' using 'a8000000-0000-4000-8000-0000000000a8'::uuid;
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a8000000-0000-4000-8000-0000000000a8","role":"authenticated"}', true);
do $$
declare
  hat_frist boolean;
  frist text;
begin
  hat_frist := exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profile'
                       and column_name = 'name_geaendert_am');
  begin
    update public.profile set benutzername = 'Admin_Anna' where user_id = 'a8000000-0000-4000-8000-0000000000a8';
    raise exception 'FEHLER: Aendern auf einen gesperrten Namen ging durch';
  exception when raise_exception then
    if sqlerrm like 'FEHLER%' then raise; end if;
    if sqlerrm <> 'NAME_UNZULAESSIG' then raise exception 'FEHLER: falsche Meldung beim Aendern: %', sqlerrm; end if;
  end;
  if (select benutzername from public.profile where user_id = 'a8000000-0000-4000-8000-0000000000a8') <> 'Hassan' then
    raise exception 'FEHLER: Name nach abgelehnter Aenderung nicht mehr Hassan';
  end if;
  if hat_frist then
    execute 'select name_geaendert_am::text from public.profile where user_id = $1' into frist
      using 'a8000000-0000-4000-8000-0000000000a8'::uuid;
    if frist is not null then raise exception 'FEHLER: abgelehnter Name hat die Monats-Frist verbraucht (%)', frist; end if;
  end if;
  -- die erste harmlose eigene Aenderung geht danach (auch mit Monats-Sperre)
  update public.profile set benutzername = 'Dickens' where user_id = 'a8000000-0000-4000-8000-0000000000a8';
  if (select benutzername from public.profile where user_id = 'a8000000-0000-4000-8000-0000000000a8') <> 'Dickens' then
    raise exception 'FEHLER: harmlose Aenderung nach der Ablehnung ging nicht';
  end if;
  -- die Rechenfunktionen darf ein Nutzer ausfuehren (der Trigger laeuft mit seinen Rechten)
  if public.name_gesperrt('Scunthorpe') is not null then raise exception 'FEHLER: name_gesperrt als Nutzer falsch'; end if;
end;
$$;

-- 4 Besitzer frei; ein bestehender Name bleibt beim erneuten Sichern durch den Nutzer (nur Gross/Klein anders)
reset role;
insert into public.profile (user_id, benutzername) values ('b8000000-0000-4000-8000-0000000000b8', 'Crownmate');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b8000000-0000-4000-8000-0000000000b8","role":"authenticated"}', true);
do $$
begin
  insert into public.profile (user_id, benutzername) values ('b8000000-0000-4000-8000-0000000000b8', 'crownmate')
  on conflict (user_id) do update set benutzername = excluded.benutzername;
  if (select pg_catalog.lower(benutzername) from public.profile where user_id = 'b8000000-0000-4000-8000-0000000000b8') <> 'crownmate' then
    raise exception 'FEHLER: bestehender Name beim erneuten Sichern verloren';
  end if;
end;
$$;

-- 5 Rechte
reset role;
do $$
begin
  if has_function_privilege('anon', 'public.name_gesperrt(text)', 'execute') then
    raise exception 'FEHLER: anon darf name_gesperrt ausfuehren';
  end if;
  if has_function_privilege('authenticated', 'public.profile_name_pruefen()', 'execute') then
    raise exception 'FEHLER: authenticated darf die Trigger-Funktion direkt ausfuehren';
  end if;
  raise notice 'Namensfilter-RLS-Test erfolgreich';
end;
$$;

rollback;

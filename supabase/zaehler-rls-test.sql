-- Prueft supabase/zaehler-schema.sql im Supabase SQL Editor (als Besitzer, wie dort ueblich). Setzt kronen-schema.sql
-- voraus. Alles wird am Ende zurueckgerollt, auch das Anschalten des Zaehlers fuer den Test.
-- Ein kurzlebiger Nutzer A. Jeder Fehler bricht mit "FEHLER: ..." ab; ohne Fehler endet der Lauf mit ROLLBACK.
-- Abschnitte: 1 Zaehler aus; 2 Zaehler an (zaehlt, begrenzt, auch ohne Anmeldung, nur drei Spalten); 3 unbekannter
-- Schluessel; 4 Nutzer liest nicht (keine Tabellenrechte, auch nicht ohne Anmeldung); 5 kein Personenbezug in den Funktionen.
begin;

insert into auth.users (id, email)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'zaehler-a@example.invalid');

-- Testhilfe (nur in dieser Sitzung, verschwindet mit dem rollback): als Besitzer, weil Nutzer den Schalter nicht aendern
create function pg_temp.setze_zaehler(an boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.kronen_schalter set zaehler_an = an where id;
$$;
revoke all on function pg_temp.setze_zaehler(boolean) from public;

-- Ausgangslage wie nach dem Einspielen: aus, keine Zeilen
select pg_temp.setze_zaehler(false);
delete from public.zaehler_tag;

-- ---------- 1. Zaehler aus: Aufruf liefert false, nichts wird geschrieben ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
begin
  if public.zaehler_an() then
    raise exception 'FEHLER: Zaehler aus: zaehler_an() meldet an';
  end if;
  if public.zaehler_erhoehe('suche.ki_gegner') then
    raise exception 'FEHLER: Zaehler aus: zaehler_erhoehe meldet gezaehlt';
  end if;
  if public.zaehler_erhoehe('suche.mensch', 5) then
    raise exception 'FEHLER: Zaehler aus: zaehler_erhoehe mit Zahl meldet gezaehlt';
  end if;
end;
$$;
reset role;
do $$
begin
  if exists (select 1 from public.zaehler_tag) then
    raise exception 'FEHLER: Zaehler aus: zaehler_tag ist nicht leer';
  end if;
end;
$$;

-- ---------- 2. Zaehler an: zweimal suche.ki_gegner -> wert 2, eine Zeile; begrenzt; auch ohne Anmeldung ----------
select pg_temp.setze_zaehler(true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
begin
  if not public.zaehler_an() then
    raise exception 'FEHLER: Zaehler an: zaehler_an() meldet aus';
  end if;
  if not public.zaehler_erhoehe('suche.ki_gegner') or not public.zaehler_erhoehe('suche.ki_gegner') then
    raise exception 'FEHLER: Zaehler an: zaehler_erhoehe meldet nicht gezaehlt';
  end if;
  perform public.zaehler_erhoehe('suche.wartezeit_s', 5000);
  perform public.zaehler_erhoehe('suche.wartezeit_s', 0);
  perform public.zaehler_erhoehe('suche.wartezeit_s', -3);
end;
$$;
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  if not public.zaehler_erhoehe('suche.mensch') then
    raise exception 'FEHLER: Zaehler an: ohne Anmeldung wird nicht gezaehlt';
  end if;
end;
$$;
reset role;
do $$
declare
  n integer;
  w bigint;
  spalten text;
begin
  select count(*), max(wert) into n, w from public.zaehler_tag where schluessel = 'suche.ki_gegner';
  if n <> 1 or w <> 2 then
    raise exception 'FEHLER: Zaehler an: suche.ki_gegner erwartet eine Zeile mit wert 2, ist % Zeilen, wert %', n, w;
  end if;
  if (select tag from public.zaehler_tag where schluessel = 'suche.ki_gegner') <> (now() at time zone 'Europe/Berlin')::date then
    raise exception 'FEHLER: Zaehler an: Tag ist nicht heute in Europe/Berlin';
  end if;
  -- 5000 -> 1000, 0 -> 1, -3 -> 1
  select wert into w from public.zaehler_tag where schluessel = 'suche.wartezeit_s';
  if w is distinct from 1002 then
    raise exception 'FEHLER: Zaehler an: Begrenzung auf 1..1000 stimmt nicht, wert %', w;
  end if;
  select wert into w from public.zaehler_tag where schluessel = 'suche.mensch';
  if w is distinct from 1 then
    raise exception 'FEHLER: Zaehler an: Zaehlung ohne Anmeldung fehlt, wert %', w;
  end if;
  select string_agg(column_name::text, ',' order by column_name) into spalten
  from information_schema.columns where table_schema = 'public' and table_name = 'zaehler_tag';
  if spalten <> 'schluessel,tag,wert' then
    raise exception 'FEHLER: Zaehler an: zaehler_tag hat andere Spalten als tag, schluessel, wert: %', spalten;
  end if;
end;
$$;

-- ---------- 3. unbekannter Schluessel: false, keine Zeile ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
begin
  if public.zaehler_erhoehe('nutzer.email') or public.zaehler_erhoehe('Suche.KI_Gegner') or public.zaehler_erhoehe(null)
     or public.zaehler_erhoehe('') then
    raise exception 'FEHLER: unbekannter Schluessel: zaehler_erhoehe meldet gezaehlt';
  end if;
end;
$$;
reset role;
do $$
begin
  if exists (select 1 from public.zaehler_tag where schluessel not in ('suche.ki_gegner', 'suche.wartezeit_s', 'suche.mensch')) then
    raise exception 'FEHLER: unbekannter Schluessel: es wurde eine Zeile geschrieben';
  end if;
end;
$$;

-- ---------- 4. Nutzer liest nicht: keine Tabellenrechte, angemeldet oder nicht ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
begin
  begin
    perform 1 from public.zaehler_tag;
    raise exception 'FEHLER: Nutzer liest nicht: A konnte zaehler_tag lesen';
  exception
    when insufficient_privilege then null;
  end;
  begin
    insert into public.zaehler_tag (tag, schluessel, wert) values (current_date, 'suche.mensch', 999);
    raise exception 'FEHLER: Nutzer liest nicht: A konnte direkt in zaehler_tag schreiben';
  exception
    when insufficient_privilege then null;
  end;
  begin
    update public.kronen_schalter set zaehler_an = true where id;
    raise exception 'FEHLER: Nutzer liest nicht: A konnte den Schalter aendern';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    perform 1 from public.zaehler_tag;
    raise exception 'FEHLER: Nutzer liest nicht: anon konnte zaehler_tag lesen';
  exception
    when insufficient_privilege then null;
  end;
  begin
    delete from public.zaehler_tag;
    raise exception 'FEHLER: Nutzer liest nicht: anon konnte zaehler_tag loeschen';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- ---------- 5. kein Personenbezug: die Funktionen lesen weder auth.uid() noch die Anfrage-Daten ----------
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname in ('zaehler_an', 'zaehler_erhoehe')
               and (p.prosrc ilike '%auth.%' or p.prosrc ilike '%request.%' or p.prosrc ilike '%inet_client%')) then
    raise exception 'FEHLER: kein Personenbezug: eine Zaehler-Funktion liest Anmeldung oder Anfrage';
  end if;
end;
$$;

rollback;

-- Monats-Sperre fuer den Benutzernamen (R19, Flo 15.11.2026: "Man kann ihn ja nur einmal im Monat aendern"). Das erste
-- Setzen ist frei, danach hoechstens eine eigene Aenderung je 30 Tage. Die Sperre sitzt NUR hier im Server: ein Trigger
-- auf public.profile, damit auch ein direkter REST-Aufruf an der App vorbei sie nicht umgeht.
--   name_geaendert_am  Zeitpunkt der letzten EIGENEN Namensaenderung; null = noch nie geaendert (nur gesetzt)
--   Fehler NAME_GESPERRT (P0001), detail = Zeitpunkt, ab dem die naechste Aenderung geht (ISO 8601, UTC)
-- Nur die eigene Aenderung zaehlt und sperrt: Laeuft das Update als Rolle "authenticated" (REST der App). Die Verwaltung
-- (verwaltung_name, security definer) und der SQL Editor laufen als Besitzer und bleiben frei, ohne die Frist zu setzen;
-- nur der Besitzer kann die Frist ausdruecklich setzen oder aufheben.
-- Den Namen gleich zu lassen (die App schickt ihn bei "Jetzt sichern" jedes Mal mit) ist keine Aenderung.
-- Voraussetzung: schema.sql. Rueckweg: benutzername-sperre-zurueck.sql. Test: benutzername-sperre-rls-test.sql (SQL
-- Editor) und tests/server-benutzername-sperre.test.mjs (PGlite). Einspielen nur Flo. Wiederholbar.

alter table public.profile add column if not exists name_geaendert_am timestamptz;

create or replace function public.profile_name_sperre()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  bis timestamptz;
begin
  if tg_op = 'INSERT' then
    -- das erste Setzen ist frei; die Frist kann niemand selbst mitschicken
    new.name_geaendert_am := null;
    return new;
  end if;
  if current_user <> 'authenticated' then
    -- Verwaltung oder SQL Editor: frei. Die Frist des Spielers bleibt, wie sie war, ausser sie wird ausdruecklich
    -- gesetzt (z. B. eine Sperre aufheben: update public.profile set name_geaendert_am = null where user_id = ...)
    return new;
  end if;
  if new.benutzername is not distinct from old.benutzername then
    new.name_geaendert_am := old.name_geaendert_am;
    return new;
  end if;
  bis := old.name_geaendert_am + interval '30 days';
  if bis is not null and now() < bis then
    raise exception 'NAME_GESPERRT'
      using errcode = 'P0001', detail = to_char(bis at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  end if;
  new.name_geaendert_am := now();
  return new;
end;
$$;

drop trigger if exists profile_name_sperre on public.profile;
create trigger profile_name_sperre
before insert or update on public.profile
for each row execute function public.profile_name_sperre();

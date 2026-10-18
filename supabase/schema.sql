-- Cloud-Spielstand: Pro Konto gibt es genau einen Datensatz.
create table if not exists public.spielstaende (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stand jsonb not null,
  format_version integer not null,
  geraet text,
  aktualisiert_am timestamptz not null default now()
);

-- Ein Spielstand muss kleiner als 1 MiB bleiben.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.spielstaende'::regclass
      and conname = 'spielstaende_stand_groesse'
  ) then
    alter table public.spielstaende
      add constraint spielstaende_stand_groesse
      check (pg_column_size(stand) < 1024 * 1024);
  end if;
end
$$;

-- Reserviert fuer Freunde: Der Name darf nur A-Z, a-z, 0-9 und _ enthalten (keine Umlaute oder fremden
-- Schriftzeichen, damit niemand einen Namen mit aehnlich aussehenden Zeichen nachbauen kann).
create table if not exists public.profile (
  user_id uuid primary key references auth.users (id) on delete cascade,
  benutzername text not null unique,
  erstellt_am timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profile'::regclass
      and conname = 'profile_benutzername_format'
  ) then
    alter table public.profile
      add constraint profile_benutzername_format
      check (benutzername ~ '^[A-Za-z0-9_]{3,20}$');
  end if;
end
$$;

-- "Flo" und "flo" sollen nicht zwei verschiedene Spieler sein koennen.
create unique index if not exists profile_benutzername_klein on public.profile (lower(benutzername));

-- Der Zeitstempel wird bei jeder Aenderung serverseitig erneuert.
create or replace function public.setze_aktualisiert_am()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.aktualisiert_am = now();
  return new;
end;
$$;

drop trigger if exists spielstaende_setze_aktualisiert_am on public.spielstaende;
create trigger spielstaende_setze_aktualisiert_am
before update on public.spielstaende
for each row execute function public.setze_aktualisiert_am();

alter table public.spielstaende enable row level security;
alter table public.profile enable row level security;

-- Wiederholbares Einspielen: vorhandene Policies werden gezielt ersetzt.
drop policy if exists "Eigenen Spielstand lesen" on public.spielstaende;
create policy "Eigenen Spielstand lesen"
on public.spielstaende for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Eigenen Spielstand anlegen" on public.spielstaende;
create policy "Eigenen Spielstand anlegen"
on public.spielstaende for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Eigenen Spielstand aendern" on public.spielstaende;
create policy "Eigenen Spielstand aendern"
on public.spielstaende for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Eigenen Spielstand loeschen" on public.spielstaende;
create policy "Eigenen Spielstand loeschen"
on public.spielstaende for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Eigenes Profil lesen" on public.profile;
create policy "Eigenes Profil lesen"
on public.profile for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Eigenes Profil anlegen" on public.profile;
create policy "Eigenes Profil anlegen"
on public.profile for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Eigenes Profil aendern" on public.profile;
create policy "Eigenes Profil aendern"
on public.profile for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Eigenes Profil loeschen" on public.profile;
create policy "Eigenes Profil loeschen"
on public.profile for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Nur angemeldete Nutzer erhalten Tabellenrechte; RLS begrenzt sie auf die eigene Zeile.
revoke all on table public.spielstaende, public.profile from anon;
grant select, insert, update, delete on table public.spielstaende, public.profile to authenticated;

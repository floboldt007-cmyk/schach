-- Kuendigen und Widerrufen fuer "Crownmate Trainer" (Edge Function abo-beenden, Logik in
-- supabase/functions/_gemeinsam/abo-beenden.js). Nach abo-schema.sql im Supabase SQL Editor ausfuehren. Wiederholbar.
-- Test danach: supabase/abo-beenden-rls-test.sql.
--
-- Tabellen:
--   abo_vorgaenge          Nachweis jeder Kuendigung und jedes Widerrufs (Zeitpunkt, Weg, wirksam zum, Erstattung,
--                          ob die Bestaetigungs-Mail rausging). Nutzer lesen nur die eigenen, geschrieben wird nur ueber
--                          abo_vorgang_eintragen (Service-Rolle). Bleibt beim Loeschen des Kontos ohne Nutzer-ID stehen
--                          (Nachweispflicht), enthaelt keine E-Mail.
--   abo_kuendigungs_links  Einmal-Links zum Kuendigen ohne Anmeldung. Nur der SHA-256 des Tokens, 60 Minuten gueltig.
--                          Kein Zugriff fuer anon und Nutzer, auch nicht lesend.
--
-- Funktionen (nur Service-Rolle):
--   abo_vorgang_eintragen(...)               ein Vorgang
--   abo_link_anlegen(email, hash, ablauf)    true: Link angelegt (bestaetigte Adresse mit laufendem Stripe-Abo, hoechstens
--                                            3 Links je Konto und Stunde). false sonst. Der Aufrufer antwortet in beiden
--                                            Faellen gleich.
--   abo_link_pruefen(hash)                   (user_id, email) eines gueltigen, unbenutzten Links, sonst keine Zeile
--   abo_link_verbrauchen(hash)               Link nach erfolgreicher Kuendigung entwerten

create table if not exists public.abo_vorgaenge (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  art text not null,
  weg text not null,
  abo_id text,
  wirksam_zum timestamptz,
  erstattet_cent integer,
  mail_gesendet boolean not null default false,
  erstellt_am timestamptz not null default now(),
  constraint abo_vorgaenge_art check (art in ('kuendigung', 'widerruf')),
  constraint abo_vorgaenge_weg check (weg in ('angemeldet', 'link')),
  constraint abo_vorgaenge_abo_form check (abo_id is null or abo_id ~ '^sub_[A-Za-z0-9]{1,200}$'),
  constraint abo_vorgaenge_erstattet check (erstattet_cent is null or erstattet_cent >= 0)
);
create index if not exists abo_vorgaenge_nutzer on public.abo_vorgaenge (user_id, erstellt_am);

create table if not exists public.abo_kuendigungs_links (
  hash text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  ablauf timestamptz not null,
  verbraucht_am timestamptz,
  erstellt_am timestamptz not null default now(),
  constraint abo_kuendigungs_links_hash check (hash ~ '^[0-9a-f]{64}$'),
  constraint abo_kuendigungs_links_email check (char_length(email) between 3 and 320)
);
create index if not exists abo_kuendigungs_links_nutzer on public.abo_kuendigungs_links (user_id, erstellt_am);

alter table public.abo_vorgaenge enable row level security;
alter table public.abo_kuendigungs_links enable row level security;

drop policy if exists "Eigene Abo-Vorgaenge lesen" on public.abo_vorgaenge;
create policy "Eigene Abo-Vorgaenge lesen"
  on public.abo_vorgaenge for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.abo_vorgaenge, public.abo_kuendigungs_links from anon, authenticated, public;
grant select on table public.abo_vorgaenge to authenticated;
grant select, insert, update, delete on table public.abo_vorgaenge, public.abo_kuendigungs_links to service_role;

create or replace function public.abo_vorgang_eintragen(
  p_user uuid, p_art text, p_weg text, p_abo text, p_wirksam timestamptz, p_erstattet integer, p_mail boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.abo_vorgaenge (user_id, art, weg, abo_id, wirksam_zum, erstattet_cent, mail_gesendet)
  values (p_user, p_art, p_weg, p_abo, p_wirksam, p_erstattet, coalesce(p_mail, false));
$$;

create or replace function public.abo_link_anlegen(p_email text, p_hash text, p_ablauf timestamptz)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_email text;
begin
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or p_ablauf is null or p_ablauf > now() + interval '2 hours' then
    return false;
  end if;
  select u.id, u.email into v_user, v_email
    from auth.users u
    where lower(u.email) = lower(trim(p_email)) and u.email_confirmed_at is not null
    limit 1;
  if v_user is null then
    return false;
  end if;
  if not exists (
    select 1 from public.abos a
    where a.user_id = v_user and a.quelle = 'stripe' and a.abo_id is not null and a.status in ('aktiv', 'gekuendigt')
  ) then
    return false;
  end if;
  -- Alte Links aufraeumen, dann Begrenzung: hoechstens 3 je Konto und Stunde
  delete from public.abo_kuendigungs_links where erstellt_am < now() - interval '1 day';
  perform pg_advisory_xact_lock(hashtext('abo_link_' || v_user::text));
  if (select count(*) from public.abo_kuendigungs_links l
      where l.user_id = v_user and l.erstellt_am > now() - interval '1 hour') >= 3 then
    return false;
  end if;
  insert into public.abo_kuendigungs_links (hash, user_id, email, ablauf) values (p_hash, v_user, v_email, p_ablauf);
  return true;
end;
$$;

create or replace function public.abo_link_pruefen(p_hash text)
returns table (user_id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select l.user_id, l.email from public.abo_kuendigungs_links l
  where l.hash = p_hash and l.verbraucht_am is null and l.ablauf > now();
$$;

create or replace function public.abo_link_verbrauchen(p_hash text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.abo_kuendigungs_links set verbraucht_am = now() where hash = p_hash and verbraucht_am is null;
$$;

revoke all on function public.abo_vorgang_eintragen(uuid, text, text, text, timestamptz, integer, boolean) from anon, authenticated, public;
revoke all on function public.abo_link_anlegen(text, text, timestamptz) from anon, authenticated, public;
revoke all on function public.abo_link_pruefen(text) from anon, authenticated, public;
revoke all on function public.abo_link_verbrauchen(text) from anon, authenticated, public;
grant execute on function public.abo_vorgang_eintragen(uuid, text, text, text, timestamptz, integer, boolean) to service_role;
grant execute on function public.abo_link_anlegen(text, text, timestamptz) to service_role;
grant execute on function public.abo_link_pruefen(text) to service_role;
grant execute on function public.abo_link_verbrauchen(text) to service_role;

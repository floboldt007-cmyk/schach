-- Pionier-Titel (Flo 01.11.2026: "die ersten 100 Spieler bekommen einen Titel freigeschaltet").
-- Die ersten 100 Konten (in der Reihenfolge der Anmeldung, Flo als Erfinder zaehlt nicht mit) bekommen das Sonderstueck
-- pionier-001 bis pionier-100 in der Tabelle sonderstuecke (supabase/werkstatt-schema.sql). Die App liest es ueber die
-- vorhandene Policy "Eigene Sonderstuecke lesen" und zeigt den Titel "Pionier Nr. <n>" (js/sonderstuecke.js
-- pionierNummer, js/pakete/sammlung/titel.js). Wer ihn nicht hat, sieht ihn in der App gar nicht: kein Zaehler, kein
-- "nur noch". Eine Nummer wird nie zweimal vergeben, auch nicht nach dem Loeschen eines Kontos (user_id wird dann null,
-- die Zeile bleibt).
--
-- Einspielen: nach supabase/werkstatt-schema.sql im SQL Editor ausfuehren. Wiederholbar (mehrfach ausfuehren schadet
-- nicht). Neue Konten bekommen ihre Nummer beim Anlegen (Trigger auf auth.users); ein Fehler dort haelt die Anmeldung
-- nie auf (die Ausnahme wird verschluckt). Bestehende Konten bekommen ihre Nummer beim Einspielen.

-- Nummer 0 = Erfinder-Stuecke, 1 bis 100 = Pioniere
alter table public.sonderstuecke drop constraint if exists sonderstuecke_nummer;
alter table public.sonderstuecke add constraint sonderstuecke_nummer check (nummer between 0 and 100);

create or replace function public.pionier_vergeben(uid uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if uid is null then
    return null;
  end if;
  -- alle Vergaben nacheinander (zwei gleichzeitige Anmeldungen bekommen nie dieselbe Nummer)
  perform pg_advisory_xact_lock(hashtext('crownmate-pionier'));
  select s.nummer into n from public.sonderstuecke s where s.user_id = uid and s.stueck_id like 'pionier-%';
  if n is not null then
    return n;
  end if;
  -- der Erfinder ist Nr. 0, kein Pionier
  if exists (select 1 from public.sonderstuecke s where s.user_id = uid and s.stueck_id = 'erfinder-titel') then
    return null;
  end if;
  select count(*) + 1 into n from public.sonderstuecke s where s.stueck_id like 'pionier-%';
  if n > 100 then
    return null;
  end if;
  insert into public.sonderstuecke (stueck_id, art, user_id, nummer)
  values ('pionier-' || lpad(n::text, 3, '0'), 'titel', uid, n)
  on conflict (stueck_id) do nothing;
  return n;
end;
$$;

-- nur intern (Trigger und Einspielen), nie aus der App
revoke all on function public.pionier_vergeben(uuid) from public;
revoke all on function public.pionier_vergeben(uuid) from anon;
revoke all on function public.pionier_vergeben(uuid) from authenticated;

create or replace function public.pionier_bei_neuem_konto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform public.pionier_vergeben(new.id);
  exception when others then
    -- die Anmeldung geht immer vor: ohne Nummer weiter
    null;
  end;
  return new;
end;
$$;

revoke all on function public.pionier_bei_neuem_konto() from public;
revoke all on function public.pionier_bei_neuem_konto() from anon;
revoke all on function public.pionier_bei_neuem_konto() from authenticated;

drop trigger if exists pionier_neues_konto on auth.users;
create trigger pionier_neues_konto
after insert on auth.users
for each row execute function public.pionier_bei_neuem_konto();

-- bestehende Konten in der Reihenfolge ihrer Anmeldung
do $$
declare
  r record;
begin
  for r in select u.id from auth.users u order by u.created_at, u.id loop
    perform public.pionier_vergeben(r.id);
  end loop;
end;
$$;

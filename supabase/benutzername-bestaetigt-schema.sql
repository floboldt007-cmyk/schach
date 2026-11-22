-- Benutzername mit gruenem Haken (Flo 21.11.2026): Wer seinen Namen selbst setzt und bestaetigt, ist "bestaetigt" und kann
-- ihn danach 30 Tage nicht aendern, auch beim ersten Mal. Baut auf benutzername-sperre-schema.sql auf (Trigger
-- profile_name_sperre, Spalte name_geaendert_am, Fehler NAME_GESPERRT) und laesst diese Datei unveraendert.
--   name_bestaetigt  true = der Spieler hat diesen Namen selbst gesetzt und bestaetigt (gruener Haken in der App)
-- Regeln, alle im Server, damit ein direkter REST-Aufruf an der App vorbei sie nicht umgeht:
--   Eigene Eingabe (Rolle authenticated): ein neuer Name oder das Bestaetigen des gleichen, noch nicht bestaetigten Namens
--   setzt den Haken und startet die 30-Tage-Frist, auch beim ersten Setzen. Den Haken kann niemand selbst wegnehmen,
--   ein anderer Name als der eigene bleibt per RLS (schema.sql) unerreichbar, die Frist sperrt profile_name_sperre.
--   Server, Verwaltung, SQL Editor (Besitzer): ein vergebener Name traegt keinen Haken und keine Frist (Flo 21.11.,
--   Annahme 7); eine Umbenennung nimmt den Haken weg (Annahme B), die Frist des Spielers bleibt.
--   Beim ersten Einspielen bekommen alle schon gesetzten Namen den Haken, ohne neue Frist (Annahme A: alle selbst gewaehlt).
-- Der Trigger heisst profile_name_zz_bestaetigt, damit er NACH profile_name_sperre laeuft (Postgres feuert gleichartige
-- Trigger nach Namen); dort setzt das erste Setzen die Frist auf null, hier wird sie fuer das eigene Bestaetigen gesetzt.
-- Fuer die App: name_frei(text) beim Tippen, bestaetigte_namen(text[]) fuer den Haken neben fremden Namen (Weltrangliste,
-- Online, Freunde), verwaltung_name_sperre_aufheben(uuid) fuer Flo (braucht verwaltung-schema.sql).
-- Reihenfolge (supabase/ANLEITUNG.md): schema.sql, benutzername-sperre-schema.sql, dann diese Datei; verwaltung-schema.sql
-- davor oder danach. Rueckweg: benutzername-bestaetigt-zurueck.sql. Test: benutzername-bestaetigt-rls-test.sql (SQL
-- Editor) und tests/server-benutzername-bestaetigt.test.mjs (PGlite). Einspielen nur Flo. Wiederholbar.

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'profile' and column_name = 'name_bestaetigt') then
    alter table public.profile add column name_bestaetigt boolean not null default false;
    -- Annahme A, nur beim ersten Einspielen: Bestandsnamen bekommen den Haken, name_geaendert_am bleibt (keine neue Frist)
    update public.profile set name_bestaetigt = true;
  end if;
end
$$;

create or replace function public.profile_name_bestaetigt()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    -- Server, Verwaltung, SQL Editor: ein vergebener Name traegt keinen Haken, eine Umbenennung nimmt ihn weg; ein
    -- ausdruecklich gesetzter Haken (z. B. im SQL Editor) bleibt
    if tg_op = 'INSERT' then
      return new;
    end if;
    if new.benutzername is distinct from old.benutzername and new.name_bestaetigt is not distinct from old.name_bestaetigt then
      new.name_bestaetigt := false;
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- das eigene erste Setzen ist ein Bestaetigen: Haken und Frist ab jetzt (profile_name_sperre hat sie auf null gesetzt)
    new.name_bestaetigt := true;
    new.name_geaendert_am := now();
    return new;
  end if;
  if new.benutzername is distinct from old.benutzername then
    -- profile_name_sperre hat die Frist schon geprueft und auf jetzt gesetzt
    new.name_bestaetigt := true;
    return new;
  end if;
  if not old.name_bestaetigt and new.name_bestaetigt then
    -- einen vergebenen Namen selbst bestaetigen: Haken und Frist ab jetzt
    new.name_geaendert_am := now();
    return new;
  end if;
  -- gleicher Name (Jetzt sichern): der Haken bleibt, wie er war
  new.name_bestaetigt := old.name_bestaetigt;
  return new;
end;
$$;

drop trigger if exists profile_name_zz_bestaetigt on public.profile;
create trigger profile_name_zz_bestaetigt
before insert or update on public.profile
for each row execute function public.profile_name_bestaetigt();

-- Ist der Name frei? Gleiche Regeln wie profile_benutzername_format und profile_benutzername_klein (schema.sql); der eigene
-- Name zaehlt als frei. Nur angemeldet: Namen stehen ohnehin in Weltrangliste und Freunde-Listen, aber nicht fuer anon.
create or replace function public.name_frei(name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and coalesce(name, '') ~ '^[A-Za-z0-9_]{3,20}$'
     and not exists (select 1 from public.profile p where lower(p.benutzername) = lower(name) and p.user_id <> auth.uid());
$$;

-- Welche dieser Namen tragen den Haken? Gibt sie in gespeicherter Schreibweise zurueck; hoechstens die ersten 100 Namen
-- je Aufruf, damit niemand mit einem Aufruf alle Namen abfragt. Unbekannte Namen fallen still heraus.
create or replace function public.bestaetigte_namen(namen text[])
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select p.benutzername
  from public.profile p
  where auth.uid() is not null
    and p.name_bestaetigt
    and lower(p.benutzername) in (select lower(n) from unnest(coalesce(namen, '{}'::text[])) with ordinality as x(n, i) where x.i <= 100);
$$;

-- Verwaltung: die Namens-Sperre eines Spielers aufheben (Frist auf null). Der Haken bleibt. Gleiche Pruefung und gleiches
-- Protokoll wie verwaltung_name (verwaltung-schema.sql, wird erst beim Aufruf gebraucht).
create or replace function public.verwaltung_name_sperre_aufheben(ziel uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  alt timestamptz;
begin
  perform public.verwaltung_pruefen(ziel);
  if ziel is null then
    raise exception 'VERWALTUNG_KEIN_KONTO';
  end if;
  select p.name_geaendert_am into alt from public.profile p where p.user_id = ziel for update;
  update public.profile set name_geaendert_am = null where user_id = ziel;
  insert into public.verwaltung_protokoll (wer, was, ziel_user, vorher, nachher)
  values (auth.uid(), 'name', ziel, jsonb_build_object('name_geaendert_am', alt), jsonb_build_object('sperre_aufgehoben', true));
  return jsonb_build_object('aufgehoben', true);
end;
$$;

revoke all on function public.profile_name_bestaetigt() from public, anon, authenticated;
revoke all on function public.name_frei(text) from public, anon, authenticated;
revoke all on function public.bestaetigte_namen(text[]) from public, anon, authenticated;
revoke all on function public.verwaltung_name_sperre_aufheben(uuid) from public, anon, authenticated;
grant execute on function public.name_frei(text) to authenticated;
grant execute on function public.bestaetigte_namen(text[]) to authenticated;
grant execute on function public.verwaltung_name_sperre_aufheben(uuid) to authenticated;

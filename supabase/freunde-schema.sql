-- Freunde fuer die Bestenliste (Entscheidung des Besitzers vom 30.10.2026, Entwurf "Bestenliste": Reiter Freunde | Welt
-- | Ich; Freunde per Benutzername oder Einladungslink, der andere bestaetigt; Freunde sehen nur Benutzername, Punkte und
-- Profil, nie die E-Mail). Mehrfach ausfuehrbar (Muster: schema.sql). Vorher schema.sql einspielen (profile mit
-- benutzername, auth.users).
--
-- Tabellen (beide nur ueber die Funktionen, keine Rechte fuer anon oder authenticated):
--   freundschaften      je Paar genau eine Zeile; von = wer gefragt hat. status 'offen' bis der andere annimmt, dann
--                       'freunde'. Lehnt der andere ab, bleibt die Zeile 30 Tage als Sperre stehen: als 'abgelehnt' sieht
--                       der Fragende sie weiter als offene Anfrage (er erfaehrt nichts), zieht er sie zurueck, wird sie
--                       'gesperrt' (fuer beide unsichtbar). Eine neue Anfrage in der Zeit erreicht den anderen nicht. Mit dem
--                       Konto geloescht (on delete cascade).
--   freund_einladungen  ein Einladungscode je Konto (16 Zeichen, 7 Tage gueltig, ein neuer ersetzt den alten). Wer den Link
--                       oeffnet und annimmt, ist sofort befreundet: der Einladende hat mit dem Teilen zugestimmt.
--   wochenpunkte        je Konto und Woche (Montag, Kalender Europe/Berlin wie die App) die Wochenwertung fuer die
--                       Freunde-Rangliste: Summe der besten Partie je Bot-Tafel der Woche und die Zahl der gewerteten
--                       Partien. Die App meldet sie; sie sinkt nie (zwei Geraete: der hoehere Stand gilt). Grobe Grenzen in
--                       der Datenbank (hoechstens 1000 Partien, je Partie hoechstens 100.000 Punkte); fuer die Weltrangliste
--                       kommt spaeter eine strengere Pruefung dazu. Freunde sehen nur Name, Punkte und Partien.
--
-- Funktionen (security definer, search_path = ''), alle nur fuer authenticated:
--   freund_anfragen(name text) -> jsonb { ergebnis }   'gesendet' | 'freunde' (der andere hatte schon gefragt, jetzt
--                       befreundet) | 'schon' (befreundet oder Anfrage offen) | 'unbekannt' | 'selbst' | 'kein_name' (eigener
--                       Benutzername fehlt) | 'grenze' (100 Freunde und Anfragen oder 20 neue Anfragen am Tag)
--   freund_antworten(anderer uuid, annehmen boolean) -> jsonb { ergebnis }   'freunde' | 'abgelehnt' | 'unbekannt'
--   freund_entfernen(anderer uuid) -> jsonb { ergebnis }   'entfernt' | 'unbekannt' (auch eine eigene Anfrage zurueckziehen)
--   freunde() -> jsonb [{ id, name, status: 'freunde' | 'eingehend' | 'ausgehend', seit }]   nur Benutzernamen, keine E-Mail
--   freund_einladung() -> jsonb { code, gueltig_bis } | { ergebnis: 'kein_name' }
--   freund_einladung_nutzen(code text) -> jsonb { ergebnis, name? }   'freunde' | 'schon' | 'ungueltig' | 'selbst' |
--                       'kein_name' | 'grenze'
--   wochenpunkte_melden(woche date, punkte integer, partien integer) -> jsonb { ergebnis }   'ok' | 'woche' (nicht diese
--                       oder letzte Woche) | 'werte' (ausserhalb der Grenzen)
--   freunde_rangliste(fenster text) -> jsonb [{ id, name, punkte, partien, ich }]   du und deine Freunde, 'woche' (diese
--                       Woche), 'monat' (die letzten vier Wochen) oder 'allzeit'; sortiert nach Punkten
--
-- Hinweis fuer spaetere Aenderungen: `create or replace function` kann weder Parameternamen noch Rueckgabetyp aendern.

create table if not exists public.freundschaften (
  von uuid not null references auth.users (id) on delete cascade,
  an uuid not null references auth.users (id) on delete cascade,
  status text not null default 'offen',
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  primary key (von, an),
  constraint freundschaften_nicht_selbst check (von <> an),
  constraint freundschaften_status check (status in ('offen', 'freunde', 'abgelehnt', 'gesperrt'))
);
-- ein Paar nur einmal, egal wer gefragt hat
create unique index if not exists freundschaften_paar on public.freundschaften (least(von, an), greatest(von, an));
create index if not exists freundschaften_an on public.freundschaften (an);

create table if not exists public.freund_einladungen (
  von uuid primary key references auth.users (id) on delete cascade,
  code text not null unique,
  gueltig_bis timestamptz not null,
  constraint freund_einladungen_code check (code ~ '^[0-9a-f]{16}$')
);

create table if not exists public.wochenpunkte (
  user_id uuid not null references auth.users (id) on delete cascade,
  woche date not null,
  punkte integer not null default 0,
  partien integer not null default 0,
  aktualisiert_am timestamptz not null default now(),
  primary key (user_id, woche),
  constraint wochenpunkte_montag check (extract(isodow from woche) = 1),
  constraint wochenpunkte_werte check (punkte >= 0 and partien >= 0 and partien <= 1000 and punkte <= partien * 100000)
);

alter table public.freundschaften enable row level security;
alter table public.freund_einladungen enable row level security;
alter table public.wochenpunkte enable row level security;
revoke all on table public.freundschaften, public.freund_einladungen, public.wochenpunkte from anon, authenticated, public;

-- Montag der laufenden Woche im Kalender der App (Europe/Berlin)
create or replace function public.freund_diese_woche()
returns date
language sql
stable
set search_path = ''
as $$
  select ((now() at time zone 'Europe/Berlin')::date - (extract(isodow from (now() at time zone 'Europe/Berlin')::date)::integer - 1))
$$;

-- Grenzen und Aufraeumen (intern)
create or replace function public.freund_grenze_erreicht(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from public.freundschaften f
            where (f.von = uid or f.an = uid) and f.status in ('offen', 'freunde')) >= 100
      or (select count(*) from public.freundschaften f
            where f.von = uid and f.erstellt_am > now() - interval '1 day') >= 20
$$;

create or replace function public.freund_aufraeumen()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.freundschaften where status in ('abgelehnt', 'gesperrt') and geaendert_am < now() - interval '30 days';
  delete from public.freund_einladungen where gueltig_bis < now();
$$;

-- ---------------------------------------------------------------------------
-- Anfrage per Benutzername
-- ---------------------------------------------------------------------------
create or replace function public.freund_anfragen(name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  ziel uuid;
  f public.freundschaften;
begin
  if uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  perform public.freund_aufraeumen();
  if not exists (select 1 from public.profile p where p.user_id = uid) then
    return jsonb_build_object('ergebnis', 'kein_name');
  end if;
  select p.user_id into ziel from public.profile p where lower(p.benutzername) = lower(trim(coalesce(name, '')));
  if ziel is null then
    return jsonb_build_object('ergebnis', 'unbekannt');
  end if;
  if ziel = uid then
    return jsonb_build_object('ergebnis', 'selbst');
  end if;
  select * into f from public.freundschaften x
    where least(x.von, x.an) = least(uid, ziel) and greatest(x.von, x.an) = greatest(uid, ziel)
    for update;
  if found then
    -- der andere hatte schon gefragt: annehmen
    if f.status = 'offen' and f.von = ziel then
      update public.freundschaften set status = 'freunde', geaendert_am = now() where von = f.von and an = f.an;
      return jsonb_build_object('ergebnis', 'freunde');
    end if;
    -- eigene Anfrage abgelehnt (auch zurueckgezogen): still, der andere erfaehrt nichts neues; die Sperrfrist laeuft weiter
    if f.status in ('abgelehnt', 'gesperrt') and f.von = uid then
      update public.freundschaften set status = 'abgelehnt' where von = f.von and an = f.an;
      return jsonb_build_object('ergebnis', 'gesendet');
    end if;
    -- man selbst hatte die Anfrage des anderen abgelehnt: neue Anfrage in die andere Richtung
    if f.status in ('abgelehnt', 'gesperrt') and f.von = ziel then
      if public.freund_grenze_erreicht(uid) then
        return jsonb_build_object('ergebnis', 'grenze');
      end if;
      delete from public.freundschaften where von = f.von and an = f.an;
      insert into public.freundschaften (von, an) values (uid, ziel);
      return jsonb_build_object('ergebnis', 'gesendet');
    end if;
    return jsonb_build_object('ergebnis', 'schon');
  end if;
  if public.freund_grenze_erreicht(uid) then
    return jsonb_build_object('ergebnis', 'grenze');
  end if;
  insert into public.freundschaften (von, an) values (uid, ziel);
  return jsonb_build_object('ergebnis', 'gesendet');
end;
$$;

-- ---------------------------------------------------------------------------
-- Anfrage annehmen oder ablehnen (nur die angefragte Seite)
-- ---------------------------------------------------------------------------
create or replace function public.freund_antworten(anderer uuid, annehmen boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  update public.freundschaften
    set status = case when coalesce(annehmen, false) then 'freunde' else 'abgelehnt' end, geaendert_am = now()
    where von = anderer and an = uid and status = 'offen';
  if not found then
    return jsonb_build_object('ergebnis', 'unbekannt');
  end if;
  return jsonb_build_object('ergebnis', case when coalesce(annehmen, false) then 'freunde' else 'abgelehnt' end);
end;
$$;

-- ---------------------------------------------------------------------------
-- Freund entfernen oder eigene offene Anfrage zurueckziehen
-- ---------------------------------------------------------------------------
create or replace function public.freund_entfernen(anderer uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  -- eine abgelehnte eigene Anfrage zieht der Fragende zurueck, die Sperre bleibt (gesperrt, fuer beide unsichtbar)
  update public.freundschaften set status = 'gesperrt'
    where von = uid and an = anderer and status = 'abgelehnt';
  if found then
    return jsonb_build_object('ergebnis', 'entfernt');
  end if;
  -- Freundschaft oder offene Anfrage (eigene oder erhaltene); eine erhaltene, abgelehnte bleibt als Sperre stehen
  delete from public.freundschaften
    where ((von = uid and an = anderer) or (von = anderer and an = uid)) and status in ('offen', 'freunde');
  if not found then
    return jsonb_build_object('ergebnis', 'unbekannt');
  end if;
  return jsonb_build_object('ergebnis', 'entfernt');
end;
$$;

-- ---------------------------------------------------------------------------
-- Liste fuer die App: Freunde, eingehende und eigene Anfragen, nur Benutzernamen
-- ---------------------------------------------------------------------------
create or replace function public.freunde()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', z.id, 'name', z.name, 'status', z.status, 'seit', z.seit)
                     order by z.status, lower(z.name))
    from (
      select case when f.von = uid then f.an else f.von end as id,
             p.benutzername as name,
             case when f.status = 'freunde' then 'freunde'
                  when f.von = uid then 'ausgehend'     -- auch 'abgelehnt': der Fragende sieht sie weiter als offen
                  else 'eingehend' end as status,
             f.geaendert_am as seit
      from public.freundschaften f
      join public.profile p on p.user_id = case when f.von = uid then f.an else f.von end
      where f.status <> 'gesperrt' and (f.von = uid or (f.an = uid and f.status <> 'abgelehnt'))
        and not (f.status = 'abgelehnt' and f.geaendert_am < now() - interval '30 days')
    ) z
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Einladungslink
-- ---------------------------------------------------------------------------
create or replace function public.freund_einladung()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  e public.freund_einladungen;
begin
  if uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profile p where p.user_id = uid) then
    return jsonb_build_object('ergebnis', 'kein_name');
  end if;
  insert into public.freund_einladungen as t (von, code, gueltig_bis)
  values (uid, substr(replace(gen_random_uuid()::text, '-', ''), 1, 16), now() + interval '7 days')
  on conflict (von) do update set code = excluded.code, gueltig_bis = excluded.gueltig_bis
  returning * into e;
  return jsonb_build_object('code', e.code, 'gueltig_bis', e.gueltig_bis);
end;
$$;

create or replace function public.freund_einladung_nutzen(code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  e public.freund_einladungen;
  f public.freundschaften;
  name text;
begin
  if uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  select * into e from public.freund_einladungen x where x.code = lower(trim(coalesce(freund_einladung_nutzen.code, '')))
    and x.gueltig_bis > now();
  if not found then
    return jsonb_build_object('ergebnis', 'ungueltig');
  end if;
  select p.benutzername into name from public.profile p where p.user_id = e.von;
  if e.von = uid then
    return jsonb_build_object('ergebnis', 'selbst');
  end if;
  if not exists (select 1 from public.profile p where p.user_id = uid) then
    return jsonb_build_object('ergebnis', 'kein_name', 'name', name);
  end if;
  select * into f from public.freundschaften x
    where least(x.von, x.an) = least(uid, e.von) and greatest(x.von, x.an) = greatest(uid, e.von)
    for update;
  if found and f.status = 'freunde' then
    return jsonb_build_object('ergebnis', 'schon', 'name', name);
  end if;
  if public.freund_grenze_erreicht(uid) then
    return jsonb_build_object('ergebnis', 'grenze', 'name', name);
  end if;
  -- der Einladende hat mit dem Teilen zugestimmt: offene oder abgelehnte Zeilen zwischen beiden ersetzt die Freundschaft
  if found then
    delete from public.freundschaften where von = f.von and an = f.an;
  end if;
  insert into public.freundschaften (von, an, status) values (e.von, uid, 'freunde');
  return jsonb_build_object('ergebnis', 'freunde', 'name', name);
end;
$$;

-- ---------------------------------------------------------------------------
-- Wochenwertung melden und Freunde-Rangliste
-- ---------------------------------------------------------------------------
create or replace function public.wochenpunkte_melden(woche date, punkte integer, partien integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  heute date := public.freund_diese_woche();
begin
  if uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  -- diese oder letzte Woche (eine Partie kurz vor Mitternacht am Sonntag darf noch nachkommen)
  if woche is null or extract(isodow from woche) <> 1 or woche not in (heute, heute - 7) then
    return jsonb_build_object('ergebnis', 'woche');
  end if;
  if punkte is null or partien is null or punkte < 0 or partien < 0 or partien > 1000 or punkte > partien * 100000 then
    return jsonb_build_object('ergebnis', 'werte');
  end if;
  insert into public.wochenpunkte as w (user_id, woche, punkte, partien, aktualisiert_am)
  values (uid, wochenpunkte_melden.woche, wochenpunkte_melden.punkte, wochenpunkte_melden.partien, now())
  on conflict (user_id, woche) do update
    set punkte = greatest(w.punkte, excluded.punkte), partien = greatest(w.partien, excluded.partien), aktualisiert_am = now();
  return jsonb_build_object('ergebnis', 'ok');
end;
$$;

create or replace function public.freunde_rangliste(fenster text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  heute date := public.freund_diese_woche();
  ab date := case coalesce(fenster, 'woche') when 'allzeit' then date '2000-01-03' when 'monat' then heute - 21 else heute end;
begin
  if uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', z.id, 'name', z.name, 'punkte', z.punkte, 'partien', z.partien, 'ich', z.id = uid)
                     order by z.punkte desc, z.partien asc, lower(coalesce(z.name, '')))
    from (
      select k.id, p.benutzername as name,
             coalesce((select sum(w.punkte) from public.wochenpunkte w where w.user_id = k.id and w.woche >= ab), 0)::bigint as punkte,
             coalesce((select sum(w.partien) from public.wochenpunkte w where w.user_id = k.id and w.woche >= ab), 0)::bigint as partien
      from (
        select uid as id
        union
        select case when f.von = uid then f.an else f.von end
        from public.freundschaften f where (f.von = uid or f.an = uid) and f.status = 'freunde'
      ) k
      left join public.profile p on p.user_id = k.id
    ) z
  ), '[]'::jsonb);
end;
$$;

-- Funktionen: nie fuer anon oder public. Erst alles entziehen (auch Supabase-Standardrechte), dann genau vergeben.
revoke all on function public.freund_grenze_erreicht(uuid) from anon, authenticated, service_role, public;
revoke all on function public.freund_aufraeumen() from anon, authenticated, service_role, public;
revoke all on function public.freund_anfragen(text) from anon, authenticated, service_role, public;
revoke all on function public.freund_antworten(uuid, boolean) from anon, authenticated, service_role, public;
revoke all on function public.freund_entfernen(uuid) from anon, authenticated, service_role, public;
revoke all on function public.freunde() from anon, authenticated, service_role, public;
revoke all on function public.freund_einladung() from anon, authenticated, service_role, public;
revoke all on function public.freund_einladung_nutzen(text) from anon, authenticated, service_role, public;
revoke all on function public.freund_diese_woche() from anon, authenticated, service_role, public;
revoke all on function public.wochenpunkte_melden(date, integer, integer) from anon, authenticated, service_role, public;
revoke all on function public.freunde_rangliste(text) from anon, authenticated, service_role, public;

grant execute on function public.freund_anfragen(text) to authenticated;
grant execute on function public.freund_antworten(uuid, boolean) to authenticated;
grant execute on function public.freund_entfernen(uuid) to authenticated;
grant execute on function public.freunde() to authenticated;
grant execute on function public.freund_einladung() to authenticated;
grant execute on function public.freund_einladung_nutzen(text) to authenticated;
grant execute on function public.wochenpunkte_melden(date, integer, integer) to authenticated;
grant execute on function public.freunde_rangliste(text) to authenticated;

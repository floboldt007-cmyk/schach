-- Verwaltung fuer Flo (G-006 M3, AC-06 bis AC-09): Konten sehen, Premium freischalten und zuruecknehmen, Kaeufe sehen,
-- Benutzername aendern, Banner vergeben und wegnehmen. Die App zeigt das Blatt unter Einstellungen nur, wenn
-- ist_verwalter() true meldet; die Sicherheit haengt allein an diesen Funktionen: jede prueft zuerst, ob das
-- angemeldete Konto in public.verwalter steht, sonst VERWALTUNG_KEIN_RECHT.
--
-- Reihenfolge (supabase/ANLEITUNG.md): nach schema.sql, abo-schema.sql, werkstatt-schema.sql, pionier-schema.sql und
-- karte-schema.sql. Wiederholbar. Danach EINMAL von Hand im SQL Editor das eigene Konto eintragen:
--   insert into public.verwalter (user_id) values ('<deine user_id aus Authentication > Users>');
--   notify pgrst, 'reload schema';
-- Pruefen mit verwaltung-rls-test.sql, Rueckweg verwaltung-zurueck.sql.
--
-- Bewusst NICHT hier: Taler, Kronen, Liga, Editionen und Sonderstuecke (Erfinder, Pionier) werden nur angezeigt, nie
-- geaendert. Kein Aufruf an Stripe; ein laufendes Stripe-Abo wird nie ueberschrieben (VERWALTUNG_STRIPE_ABO).
-- Getestet in PGlite: tests/server-verwaltung.test.mjs.

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------
-- Wer verwalten darf. Eintragen nur im SQL Editor; RLS an und keine Policy: kein Konto liest oder schreibt sie.
create table if not exists public.verwalter (
  user_id uuid primary key references auth.users (id) on delete cascade,
  seit timestamptz not null default now()
);
alter table public.verwalter enable row level security;
revoke all on table public.verwalter from public, anon, authenticated;

-- Jede Aenderung ueber die Verwaltung, mit Stand vorher und nachher. Lesen nur ueber verwaltung_protokoll_lesen().
create table if not exists public.verwaltung_protokoll (
  id bigint generated always as identity primary key,
  wer uuid references auth.users (id) on delete set null,
  was text not null,
  ziel_user uuid references auth.users (id) on delete set null,
  vorher jsonb,
  nachher jsonb,
  am timestamptz not null default now(),
  constraint verwaltung_protokoll_was check (was in ('premium', 'name', 'banner'))
);
create index if not exists verwaltung_protokoll_am on public.verwaltung_protokoll (am desc);
alter table public.verwaltung_protokoll enable row level security;
revoke all on table public.verwaltung_protokoll from public, anon, authenticated;

-- Banner aus der Verwaltung bekommen die Quelle 'verwaltung' (der Rueckweg loescht genau diese)
alter table public.banner_besitz drop constraint if exists banner_besitz_quelle;
alter table public.banner_besitz add constraint banner_besitz_quelle
  check (quelle in ('start', 'erfolg', 'liga', 'verwaltung'));

-- ---------------------------------------------------------------------------
-- Hilfen (nur innerhalb dieser Funktionen)
-- ---------------------------------------------------------------------------
create or replace function public.ist_verwalter()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (select 1 from public.verwalter v where v.user_id = auth.uid());
$$;

create or replace function public.verwaltung_pruefen(ziel uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.ist_verwalter() then
    raise exception 'VERWALTUNG_KEIN_RECHT';
  end if;
  if ziel is not null and not exists (select 1 from auth.users u where u.id = ziel) then
    raise exception 'VERWALTUNG_KEIN_KONTO';
  end if;
end;
$$;

-- Gueltige Banner: Start-Banner, Liga-Banner und die Banner der Erfolgs-Familien (alles aus karte_konstanten())
create or replace function public.verwaltung_banner_gueltig(b text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(b = (k ->> 'start_banner')
    or coalesce((k -> 'liga_banner') ? b, false)
    or exists (select 1 from jsonb_each(k -> 'familien') f where f.value ->> 'banner' = b), false)
  from (select public.karte_konstanten() as k) x;
$$;

-- ---------------------------------------------------------------------------
-- AC-06 Wer hat sich angemeldet (neueste zuerst)
-- ---------------------------------------------------------------------------
create or replace function public.verwaltung_konten(suche text default null, grenze integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s text := nullif(btrim(coalesce(suche, '')), '');
  muster text;
  n integer := case when grenze between 1 and 500 then grenze else 100 end;
begin
  perform public.verwaltung_pruefen(null);
  -- % und _ in der Suche sind Zeichen, keine Joker
  muster := '%' || replace(replace(replace(s, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return coalesce((select jsonb_agg(to_jsonb(k) order by k.angelegt desc, k.user_id) from (
    select u.id as user_id, u.email, u.created_at as angelegt, u.last_sign_in_at as zuletzt,
      coalesce(u.raw_app_meta_data ->> 'provider', '') as anbieter,
      p.benutzername,
      public.ist_premium_von(u.id) as premium,
      a.status as abo_status, a.gueltig_bis as abo_bis, a.quelle as abo_quelle,
      (select count(*) from public.besitz b where b.user_id = u.id)::integer as kaeufe
    from auth.users u
    left join public.profile p on p.user_id = u.id
    left join public.abos a on a.user_id = u.id
    where s is null
       or u.email ilike muster escape '\'
       or p.benutzername ilike muster escape '\'
       or u.id::text = lower(s)
    order by u.created_at desc, u.id
    limit n) k), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- AC-08 Wer hat gekauft (nur lesend: Abo, Editionen, Sonderstuecke, Banner)
-- ---------------------------------------------------------------------------
create or replace function public.verwaltung_kaeufe(ziel uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.verwaltung_pruefen(ziel);
  return jsonb_build_object(
    'premium', public.ist_premium_von(ziel),
    -- ohne Stripe-Kennungen, nur ob es einen Stripe-Kunden gibt
    'abo', (select jsonb_build_object('status', a.status, 'plan', a.plan, 'gueltig_bis', a.gueltig_bis, 'quelle', a.quelle,
        'stripe_kunde', a.kunde_id is not null, 'erstellt_am', a.erstellt_am, 'aktualisiert_am', a.aktualisiert_am)
      from public.abos a where a.user_id = ziel),
    'editionen', coalesce((select jsonb_agg(jsonb_build_object('produkt_id', b.produkt_id, 'name', e.name, 'nummer', b.nummer,
        'status', b.status, 'erworben_am', b.erworben_am) order by b.erworben_am, b.produkt_id)
      from public.besitz b join public.editionen e on e.produkt_id = b.produkt_id where b.user_id = ziel), '[]'::jsonb),
    'sonderstuecke', coalesce((select jsonb_agg(jsonb_build_object('stueck_id', s.stueck_id, 'art', s.art, 'nummer', s.nummer,
        'vergeben_am', s.vergeben_am) order by s.vergeben_am, s.stueck_id)
      from public.sonderstuecke s where s.user_id = ziel), '[]'::jsonb),
    'banner', coalesce((select jsonb_agg(jsonb_build_object('banner', b.banner, 'quelle', b.quelle, 'am', b.am) order by b.am, b.banner)
      from public.banner_besitz b where b.user_id = ziel), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- AC-07 Premium freischalten (bis = Datum) und zuruecknehmen (bis = null)
-- ---------------------------------------------------------------------------
create or replace function public.verwaltung_premium(ziel uuid, bis timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.abos;
  vorher jsonb;
  nachher jsonb;
begin
  perform public.verwaltung_pruefen(ziel);
  if bis is not null and (bis <= now() or bis > now() + interval '5 years') then
    raise exception 'VERWALTUNG_DATUM';
  end if;
  select * into a from public.abos x where x.user_id = ziel for update;
  -- Ein laufendes Stripe-Abo gehoert Stripe: weder verlaengern noch wegnehmen (sonst stimmt die Abrechnung nicht)
  if found and a.quelle = 'stripe' and a.status in ('aktiv', 'gekuendigt') and a.gueltig_bis > now() then
    raise exception 'VERWALTUNG_STRIPE_ABO';
  end if;
  vorher := case when found then jsonb_build_object('status', a.status, 'gueltig_bis', a.gueltig_bis, 'quelle', a.quelle) end;

  if bis is null then
    if not found or not public.ist_premium_von(ziel) then
      return jsonb_build_object('geaendert', false, 'premium', false);
    end if;
    update public.abos x set status = 'abgelaufen', gueltig_bis = now(), quelle = 'manuell' where x.user_id = ziel;
  else
    insert into public.abos as t (user_id, status, gueltig_bis, quelle)
    values (ziel, 'aktiv', bis, 'manuell')
    on conflict (user_id) do update set status = 'aktiv', gueltig_bis = excluded.gueltig_bis, quelle = 'manuell';
  end if;

  select jsonb_build_object('status', x.status, 'gueltig_bis', x.gueltig_bis, 'quelle', x.quelle) into nachher
  from public.abos x where x.user_id = ziel;
  insert into public.verwaltung_protokoll (wer, was, ziel_user, vorher, nachher)
  values (auth.uid(), 'premium', ziel, vorher, nachher);
  return jsonb_build_object('geaendert', true, 'premium', public.ist_premium_von(ziel));
end;
$$;

-- ---------------------------------------------------------------------------
-- AC-09 Benutzername aendern (gleiche Regeln wie profile_benutzername_format und profile_benutzername_klein)
-- ---------------------------------------------------------------------------
create or replace function public.verwaltung_name(ziel uuid, neu text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  n text := btrim(coalesce(neu, ''));
  alt text;
begin
  perform public.verwaltung_pruefen(ziel);
  if n !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'VERWALTUNG_NAME_FORMAT';
  end if;
  if exists (select 1 from public.profile p where lower(p.benutzername) = lower(n) and p.user_id <> ziel) then
    raise exception 'VERWALTUNG_NAME_VERGEBEN';
  end if;
  select p.benutzername into alt from public.profile p where p.user_id = ziel for update;
  begin
    insert into public.profile (user_id, benutzername) values (ziel, n)
    on conflict (user_id) do update set benutzername = excluded.benutzername;
  exception when unique_violation then
    raise exception 'VERWALTUNG_NAME_VERGEBEN';
  end;
  insert into public.verwaltung_protokoll (wer, was, ziel_user, vorher, nachher)
  values (auth.uid(), 'name', ziel, jsonb_build_object('benutzername', alt), jsonb_build_object('benutzername', n));
  return jsonb_build_object('geaendert', true, 'benutzername', n);
end;
$$;

-- ---------------------------------------------------------------------------
-- AC-09 Banner vergeben (an = true) und wegnehmen (an = false). Weggenommen werden nur Banner aus der Verwaltung;
-- verdiente (Start, Erfolg, Liga) bleiben, sonst kaeme das Start-Banner beim naechsten karte_sichern ohnehin zurueck.
-- ---------------------------------------------------------------------------
create or replace function public.verwaltung_banner(ziel uuid, banner text, an boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  q text;
  n integer;
begin
  perform public.verwaltung_pruefen(ziel);
  if an is null or not public.verwaltung_banner_gueltig(banner) then
    raise exception 'VERWALTUNG_BANNER_UNBEKANNT';
  end if;
  select b.quelle into q from public.banner_besitz b where b.user_id = ziel and b.banner = verwaltung_banner.banner;
  if an then
    insert into public.banner_besitz (user_id, banner, quelle) values (ziel, verwaltung_banner.banner, 'verwaltung')
    on conflict do nothing;
  else
    if q is not null and q <> 'verwaltung' then
      raise exception 'VERWALTUNG_BANNER_VERDIENT';
    end if;
    delete from public.banner_besitz b where b.user_id = ziel and b.banner = verwaltung_banner.banner and b.quelle = 'verwaltung';
  end if;
  get diagnostics n = row_count;
  if n = 0 then
    return jsonb_build_object('geaendert', false);
  end if;
  insert into public.verwaltung_protokoll (wer, was, ziel_user, vorher, nachher)
  values (auth.uid(), 'banner', ziel, jsonb_build_object('banner', verwaltung_banner.banner, 'besitz', q is not null),
    jsonb_build_object('banner', verwaltung_banner.banner, 'besitz', an));
  return jsonb_build_object('geaendert', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Protokoll lesen (neueste zuerst)
-- ---------------------------------------------------------------------------
create or replace function public.verwaltung_protokoll_lesen(grenze integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n integer := case when grenze between 1 and 500 then grenze else 50 end;
begin
  perform public.verwaltung_pruefen(null);
  return coalesce((select jsonb_agg(to_jsonb(z) order by z.am desc, z.id desc) from (
    select x.id, x.wer, x.was, x.ziel_user, x.vorher, x.nachher, x.am
    from public.verwaltung_protokoll x order by x.am desc, x.id desc limit n) z), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte: nur angemeldete Konten duerfen aufrufen (die Funktion selbst prueft den Verwalter), Hilfen niemand
-- ---------------------------------------------------------------------------
revoke all on function public.ist_verwalter() from public, anon, authenticated;
revoke all on function public.verwaltung_pruefen(uuid) from public, anon, authenticated, service_role;
revoke all on function public.verwaltung_banner_gueltig(text) from public, anon, authenticated, service_role;
revoke all on function public.verwaltung_konten(text, integer) from public, anon, authenticated;
revoke all on function public.verwaltung_kaeufe(uuid) from public, anon, authenticated;
revoke all on function public.verwaltung_premium(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.verwaltung_name(uuid, text) from public, anon, authenticated;
revoke all on function public.verwaltung_banner(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.verwaltung_protokoll_lesen(integer) from public, anon, authenticated;
grant execute on function public.ist_verwalter() to authenticated;
grant execute on function public.verwaltung_konten(text, integer) to authenticated;
grant execute on function public.verwaltung_kaeufe(uuid) to authenticated;
grant execute on function public.verwaltung_premium(uuid, timestamptz) to authenticated;
grant execute on function public.verwaltung_name(uuid, text) to authenticated;
grant execute on function public.verwaltung_banner(uuid, text, boolean) to authenticated;
grant execute on function public.verwaltung_protokoll_lesen(integer) to authenticated;

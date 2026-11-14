-- Weltrangliste nach Online-Elo (G-006 AC-11, 14.11.2026; Flos Regeln aus der Grill-Runde):
--   nur wer selbst zustimmt   eigene Zeile in weltrang_teilnahme, Vorgabe AUS; ohne Zustimmung erscheint niemand
--   nur bestaetigte Elo       kronen_stand.elo_n >= 15 (ab da rechnet kronen_online_buchen mit K 32 statt 40); die selbst
--                             gemeldete Start-Elo (kronen_start) zaehlt erst, wenn 15 echte Online-Partien sie ersetzt haben
--   nur mit Benutzername      ohne Zeile in profile kein Eintrag
--   Banner nur im Besitz      sonst 'start', dieselbe Regel wie karte_von (karte-schema.sql)
-- Gezeigt werden Rang, Name, Banner und Elo. Keine Kennung, keine Mail, keine Liga-Stufe, kein Titel.
-- Voraussetzung: schema.sql, kronen-schema.sql und karte-schema.sql sind eingespielt. Danach daten-schema.sql noch einmal
-- (die Datenauskunft nimmt die Zustimmung mit auf, sobald es die Tabelle gibt). Einspielen: im SQL Editor ausfuehren.
-- Wiederholbar, bestehende Zustimmungen bleiben. Probe: supabase/weltrang-rls-test.sql. Rueckweg: supabase/weltrang-zurueck.sql.
-- NICHT von Claude einspielen: Flo spielt Supabase-Aenderungen selbst ein.

-- Eine Zeile je Konto, das in der Weltrangliste erscheinen will. Zuruecknehmen loescht die Zeile.
create table if not exists public.weltrang_teilnahme (
  user_id uuid primary key references auth.users (id) on delete cascade,
  seit timestamptz not null default now()
);
alter table public.weltrang_teilnahme enable row level security;
-- Keine Policies und keine Tabellenrechte: lesen und schreiben nur ueber die beiden Funktionen unten
revoke all on table public.weltrang_teilnahme from public, anon, authenticated;

-- Die Liste fuer den Reiter "Welt": { ab, teilnahme, liste, ich }.
--   liste  [{ rang, name, banner, elo, ich }] die besten grenze (1 bis 100, Vorgabe 100) nach Elo; gleiche Elo, gleicher Rang
--   ich    { status } mit status 'dabei' (dazu rang, elo, name, banner), 'zaehlt_noch' (dazu fehlen = Partien bis 15),
--          'ohne_name' oder 'nicht_dabei'. Die eigene Elo steht nur bei 'dabei' darin.
create or replace function public.weltrang_liste(grenze integer default 100)
returns jsonb
language plpgsql
-- bewusst nicht stable: weltrang_mitmachen ruft sie direkt nach dem eigenen insert/delete auf, eine stable-Funktion
-- saehe noch den Stand vom Beginn der Anfrage
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  ab constant integer := 15;
  n integer := least(greatest(coalesce(grenze, 100), 1), 100);
  dabei boolean;
  hat_name boolean;
  partien integer;
  liste jsonb;
  ich jsonb;
begin
  if uid is null then
    raise exception 'WELTRANG_OHNE_KONTO';
  end if;
  dabei := exists (select 1 from public.weltrang_teilnahme t where t.user_id = uid);
  hat_name := exists (select 1 from public.profile p where p.user_id = uid);
  select coalesce(s.elo_n, 0) into partien from public.kronen_stand s where s.user_id = uid;
  partien := coalesce(partien, 0);

  with wertung as (
    select t.user_id, p.benutzername as name, s.elo,
           case when w.banner is not null and exists (select 1 from public.banner_besitz b
                                                      where b.user_id = t.user_id and b.banner = w.banner)
                then w.banner else 'start' end as banner,
           rank() over (order by s.elo desc) as rang
    from public.weltrang_teilnahme t
    join public.profile p on p.user_id = t.user_id
    join public.kronen_stand s on s.user_id = t.user_id
    left join public.karte_wahl w on w.user_id = t.user_id
    where s.elo_n >= ab
  ),
  oben as (
    select * from wertung order by rang, lower(name), name limit n
  )
  select
    (select coalesce(jsonb_agg(jsonb_build_object('rang', o.rang, 'name', o.name, 'banner', o.banner, 'elo', o.elo,
              'ich', o.user_id = uid) order by o.rang, lower(o.name), o.name), '[]'::jsonb) from oben o),
    (select jsonb_build_object('status', 'dabei', 'rang', x.rang, 'elo', x.elo, 'name', x.name, 'banner', x.banner)
       from wertung x where x.user_id = uid)
    into liste, ich;

  if ich is null then
    ich := case
      when not dabei then jsonb_build_object('status', 'nicht_dabei')
      when not hat_name then jsonb_build_object('status', 'ohne_name')
      else jsonb_build_object('status', 'zaehlt_noch', 'fehlen', greatest(ab - partien, 1))
    end;
  end if;
  return jsonb_build_object('ab', ab, 'teilnahme', dabei, 'liste', liste, 'ich', ich);
end;
$$;

-- Zustimmung geben (an = true) oder zuruecknehmen (an = false), nur fuer das eigene Konto. Antwort wie weltrang_liste().
create or replace function public.weltrang_mitmachen(an boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'WELTRANG_OHNE_KONTO';
  end if;
  if an is true then
    insert into public.weltrang_teilnahme (user_id) values (uid) on conflict (user_id) do nothing;
  else
    delete from public.weltrang_teilnahme t where t.user_id = uid;
  end if;
  return public.weltrang_liste();
end;
$$;

revoke all on function public.weltrang_liste(integer) from public, anon, authenticated;
revoke all on function public.weltrang_mitmachen(boolean) from public, anon, authenticated;
grant execute on function public.weltrang_liste(integer) to authenticated;
grant execute on function public.weltrang_mitmachen(boolean) to authenticated;

-- VORSCHLAG (21.11.2026, Feinschliff R26), NOCH NICHT EINGESPIELT: Effekte vom Gegner. Flos Wahl: der Gegner einer
-- Online-Partie sieht meine Figuren in meinem Satz, meine Zug-Animation bei meinen Zuegen und meinen Finisher, wenn ich
-- gewinne. Brett und Klangset bleiben bei jedem die eigenen. Nur was der Server als Besitz belegt, geht an den Gegner;
-- alles andere wird null, und der Gegner zeigt den Standard. Was ein Geraet ueber den Fortschritt freischaltet (Finisher
-- nach dem Endgegner einer Welt), kennt der Server nicht und zeigt er deshalb nicht.
-- Besitz heute: der Standard gehoert allen; der Erfinder (Sonderstueck 'erfinder-titel') hat alles Ausruestbare
-- (js/sonderstuecke.js istErfinder); Figurensatz 'blaupause' und Finisher 'signatur' haengen an ihrem eigenen Sonderstueck.
-- Eigene Datei, karte_von und karte-schema.sql bleiben unberuehrt (PR #206 karte-besitz arbeitet dort).
-- Die festen Listen stehen nur in effekte_liste; tests/server-gegner-effekte.test.mjs vergleicht sie mit js/figurensatz.js,
-- js/pakete/finisher/index.js und assets/shop/vorrat.json.
-- Datenschutz: die Wahl sieht nur der Gegner derselben Partie (wie die Visitenkarte).
-- Einspielen (Flo, nie Claude): nach online- und werkstatt-schema.sql im SQL Editor; danach  notify pgrst, 'reload schema';
-- Rueckweg: supabase/gegner-effekte-zurueck.sql. Test: tests/server-gegner-effekte.test.mjs. Wiederholbar.

create table if not exists public.karte_effekte (
  user_id uuid primary key references auth.users (id) on delete cascade,
  figuren text,
  zug text,
  finisher text,
  aktualisiert_am timestamptz not null default now()
);
alter table public.karte_effekte enable row level security;
-- keine Policy: lesen und schreiben nur ueber die Funktionen unten
revoke all on table public.karte_effekte from anon, authenticated;

-- Feste Listen je Art; der erste Eintrag ist der Standard, den jeder besitzt
create or replace function public.effekte_liste(art text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case art
    when 'figuren' then array['cburnett', 'blaupause', 'goldelfenbein', 'drachen', 'zombies', 'geister', 'lavagolem', 'piraten',
      'aegypten', 'wikinger', 'dinos', 'feuer', 'stein', 'halloween', 'weihnachten', 'ostern', 'weltraum', 'roboter',
      'naschwerk', 'moosgeister', 'tiefsee', 'elfenbein', 'holz', 'marmor', 'gold', 'glas', 'neon', 'frost', 'kuerbis',
      'pixel', 'geo']
    when 'zug' then array['aus', 'wellenring', 'funkenspur', 'blattwirbel', 'pixelstaub']
    when 'finisher' then array['aus', 'krone', 'welle', 'koenig', 'kronensturz', 'blitzschlag', 'goldregen', 'schockwelle',
      'signatur']
    else array[]::text[]
  end;
$$;

-- Besitzt uid das Stueck JETZT? Ohne Tabelle sonderstuecke (Werkstatt nicht eingespielt) nur den Standard.
create or replace function public.effekte_besitzt(uid uuid, art text, id text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  liste text[] := public.effekte_liste(art);
  noetig text[];
  treffer boolean := false;
begin
  if uid is null or id is null or not (id = any(liste)) then
    return false;
  end if;
  if id = liste[1] then
    return true;
  end if;
  if to_regclass('public.sonderstuecke') is null then
    return false;
  end if;
  noetig := array['erfinder-titel'];
  if art = 'figuren' and id = 'blaupause' then noetig := array['erfinder-figuren-blaupause']; end if;
  if art = 'finisher' and id = 'signatur' then noetig := array['erfinder-finisher-signatur']; end if;
  execute 'select exists (select 1 from public.sonderstuecke s where s.user_id = $1 and s.stueck_id = any($2))'
    into treffer using uid, noetig;
  return coalesce(treffer, false);
end;
$$;

-- Eigene Wahl melden: nur Kennungen aus der festen Liste (null = Standard), sonst EFFEKTE_WAHL. Besitz prueft erst das
-- Lesen (effekte_der_partie), damit ein spaeter verlorenes Stueck sofort verschwindet.
create or replace function public.effekte_waehle(figuren text, zug text, finisher text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'EFFEKTE_ANMELDUNG';
  end if;
  if (figuren is not null and not (figuren = any(public.effekte_liste('figuren'))))
     or (zug is not null and not (zug = any(public.effekte_liste('zug'))))
     or (finisher is not null and not (finisher = any(public.effekte_liste('finisher')))) then
    raise exception 'EFFEKTE_WAHL';
  end if;
  insert into public.karte_effekte as k (user_id, figuren, zug, finisher)
  values (uid, effekte_waehle.figuren, effekte_waehle.zug, effekte_waehle.finisher)
  on conflict (user_id) do update set figuren = excluded.figuren, zug = excluded.zug, finisher = excluded.finisher,
    aktualisiert_am = now();
  return true;
end;
$$;

-- Effekte EINES Kontos, nur Besessenes (sonst null). Nur intern.
create or replace function public.effekte_von(uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.karte_effekte;
begin
  select * into e from public.karte_effekte x where x.user_id = uid;
  return jsonb_build_object(
    'figuren', case when public.effekte_besitzt(uid, 'figuren', e.figuren) then e.figuren end,
    'zug', case when public.effekte_besitzt(uid, 'zug', e.zug) then e.zug end,
    'finisher', case when public.effekte_besitzt(uid, 'finisher', e.finisher) then e.finisher end
  );
end;
$$;

-- Beide Seiten einer Online-Partie, nur fuer ihre beiden Spieler (wie karte_der_partie). Unbeteiligte: Fehler.
create or replace function public.effekte_der_partie(partie uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  p public.partien_online;
begin
  if uid is null then
    raise exception 'EFFEKTE_ANMELDUNG';
  end if;
  select * into p from public.partien_online x where x.id = partie;
  if p.id is null or (p.weiss is distinct from uid and p.schwarz is distinct from uid) then
    raise exception 'EFFEKTE_KEINE_PARTIE';
  end if;
  return jsonb_build_object(
    'w', case when p.weiss is null then null else public.effekte_von(p.weiss) end,
    's', case when p.schwarz is null then null else public.effekte_von(p.schwarz) end
  );
end;
$$;

revoke all on function public.effekte_liste(text) from public, anon, authenticated;
revoke all on function public.effekte_besitzt(uuid, text, text) from public, anon, authenticated;
revoke all on function public.effekte_waehle(text, text, text) from public, anon, authenticated;
revoke all on function public.effekte_von(uuid) from public, anon, authenticated;
revoke all on function public.effekte_der_partie(uuid) from public, anon, authenticated;
grant execute on function public.effekte_waehle(text, text, text) to authenticated;
grant execute on function public.effekte_der_partie(uuid) to authenticated;

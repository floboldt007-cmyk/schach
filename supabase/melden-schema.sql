-- Namensfilter und Melden (Stand 09.11.2026; Entscheidung 17.10.2026 "Benutzername mit Namensfilter ... Melden").
-- Zwei Teile, beide rein additiv:
--
-- 1. NAMENSFILTER. Neue und geaenderte Benutzernamen (public.profile) prueft der Server gegen eine kurze Sperrliste:
--    Namen, die nach Crownmate, Verwaltung oder Hilfe-Team klingen (admin, support, moderator, crownmate ...), und klar
--    beleidigende oder diskriminierende Begriffe (Deutsch und Englisch). Verglichen wird nach einer Normalisierung:
--    klein geschrieben, ohne Unterstriche, mit den ueblichen Ersetzungen 0 -> o, 1 -> i oder l, 3 -> e, 4 -> a, 5 -> s,
--    7 -> t, uebrige Ziffern fallen weg. i und l gelten dabei als derselbe Buchstabe (so faengt die Liste auch ein
--    grosses I anstelle eines kleinen l). Geprueft werden zwei Lesarten: mit den Ersetzungen und ganz ohne Ziffern. Dieselbe Liste und dieselbe Rechnung stehen in js/namen.js (freundliche Meldung
--    vor dem Absenden); tests/server-melden.test.mjs vergleicht beide Seiten.
--    Die Liste ist mit Absicht kurz: nur Begriffe, die in harmlosen Namen kaum vorkommen. Jeder Begriff hat eine Art:
--      ueberall  als Teil des Namens, egal wo
--      rand      nur am Anfang oder am Ende (so bleibt "Badminton" trotz "admin" frei, "Scunthorpe" trotz der Mitte)
--      genau     nur, wenn der Name (ohne Ziffern und _) genau so heisst ("Nazir", "Ashkenazi", "Absolut", "Brochure"
--                und "Penistone" bleiben frei)
--      ganz      nur, wenn der Name ganz aus solchen Woertern besteht ("Team", "Support_Team"; "TeamRocket" bleibt frei)
--    BESTEHENDE NAMEN bleiben, wie sie sind: Geprueft wird nur beim Anlegen und wenn sich der Name aendert (Gross- und
--    Kleinschreibung zaehlt nicht als Aenderung). Was die Liste nicht faengt, faengt das Melden.
--
-- 2. MELDEN. melde_spieler(name, grund, notiz, partie) legt eine Meldung an. Der Meldende kommt aus auth.uid(), der
--    Gemeldete ueber seinen Benutzernamen oder als Gegner einer gemeinsamen Online-Partie. Gruende aus fester Liste
--    (name, verhalten, sonstiges), dazu ein freiwilliger kurzer Text (hoechstens 300 Zeichen). Grenzen: hoechstens 5
--    Meldungen je Tag und denselben Spieler nur einmal je Tag. Der Tag ist der App-Tag: Europe/Berlin mit Tagesgrenze
--    4:00 Uhr (wie js/tag.js und coach_tag in coach-schema.sql).
--    NIEMAND liest Meldungen ueber die App: RLS an, keine Policy, kein Tabellenrecht, auch nicht fuer den Gemeldeten.
--    Flo liest sie im Supabase-Dashboard (Abfragen in supabase/ANLEITUNG.md). Es passiert nichts von selbst: keine
--    Sperre, kein Umbenennen ohne Flo. Meldungen, die aelter als 12 Monate sind, loescht der naechste Aufruf.
--    Mit dem Konto des Meldenden oder des Gemeldeten verschwinden die Meldungen (on delete cascade).
--
-- Einspielen: nach supabase/schema.sql im SQL Editor. Wiederholbar. Pruefen: supabase/melden-rls-test.sql (rollt alles
-- zurueck). Rueckweg: supabase/melden-zurueck.sql. Danach supabase/daten-schema.sql noch einmal ausfuehren (die
-- Datenauskunft zeigt dann die eigenen Meldungen).

-- ---------- 1. Namensfilter ----------

-- Die Liste an einer Stelle (Vertrag mit js/namen.js NAMEN_REGELN). Alles klein, nur a-z.
create or replace function public.namen_regeln()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    -- klingt nach Betreiber oder Hilfe-Team
    'ueberall_reserviert', jsonb_build_array('crownmate', 'moderator', 'administrator'),
    'rand_reserviert', jsonb_build_array('admin', 'support'),
    -- nur gesperrt, wenn der ganze Name aus diesen Woertern besteht; die letzten sind Platzhalter der App
    -- ("Spieler", "Gegner", "Du"), die sonst wie ein Konto ohne Namen aussaehen
    'ganz', jsonb_build_array('admin', 'support', 'team', 'official', 'offiziell', 'system', 'staff', 'service', 'mod',
      'mods', 'developer', 'entwickler', 'owner', 'root', 'help', 'hilfe', 'kundendienst',
      'spieler', 'player', 'gegner', 'opponent', 'freund', 'friend', 'gast', 'guest', 'anonym', 'anonymous', 'bot',
      'computer', 'you'),
    -- beleidigend oder diskriminierend
    'ueberall', jsonb_build_array('nigger', 'nigga', 'neger', 'kanake', 'zigeuner', 'judensau', 'untermensch', 'hitler',
      'siegheil', 'neonazi', 'whitepower', 'faggot', 'schwuchtel', 'tranny', 'retard', 'spast', 'behindert', 'missgeburt',
      'hurensohn', 'schlampe', 'nutten', 'fotze', 'wichser', 'arschloch', 'asshole', 'bastard',
      'bitch', 'whore', 'fuck', 'fick', 'porn', 'vagina', 'titten', 'vergewaltig', 'paedo', 'pedophil'),
    'rand', jsonb_build_array('cunt', 'wixer'),
    'genau', jsonb_build_array('nazi', 'nazis', 'slut', 'nutte', 'hure', 'huren', 'penis'),
    -- "supporter" ist ein gewoehnliches Wort: am Anfang nur gesperrt, wenn danach nicht "er" kommt
    'ausnahme_anfang', jsonb_build_object('support', 'supporter')
  );
$$;

-- Die Lesarten eines Namens: [1] mit den Ersetzungen 0 -> o, 1 -> i, 3 -> e, 4 -> a, 5 -> s, 7 -> t, [2] ganz ohne
-- Ziffern; beide klein, ohne Unterstriche, und l wird zu i (i und l gelten als ein Buchstabe; name_gesperrt vergleicht
-- mit den ebenso umgeschriebenen Woertern der Liste). Wie js/namen.js nameLesarten.
create or replace function public.name_lesarten(name text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    pg_catalog.regexp_replace(pg_catalog.translate(pg_catalog.lower(coalesce(name, '')), '013457l', 'oieasti'), '[^a-z]', '', 'g'),
    pg_catalog.regexp_replace(pg_catalog.translate(pg_catalog.lower(coalesce(name, '')), 'l', 'i'), '[^a-z]', '', 'g')
  ];
$$;

-- null = erlaubt, sonst 'reserviert' oder 'anstoessig'. Prueft nur die Sperrliste, nicht das Format (das macht der
-- Constraint profile_benutzername_format). Wie js/namen.js nameGesperrt.
create or replace function public.name_gesperrt(name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  r jsonb := public.namen_regeln();
  n text;
  w text;
  ganz text;
begin
  -- i und l gelten als ein Buchstabe: jedes Wort der Liste wird vor dem Vergleich ebenso umgeschrieben
  select '^(' || pg_catalog.string_agg(pg_catalog.replace(x, 'l', 'i'), '|') || ')+$' into ganz from pg_catalog.jsonb_array_elements_text(r -> 'ganz') x;
  foreach n in array public.name_lesarten(name) loop
    if n = '' then
      continue;
    end if;
    if n ~ ganz then
      return 'reserviert';
    end if;
    for w in select pg_catalog.replace(x, 'l', 'i') from pg_catalog.jsonb_array_elements_text(r -> 'ueberall_reserviert') x loop
      if pg_catalog.strpos(n, w) > 0 then
        return 'reserviert';
      end if;
    end loop;
    for w in select pg_catalog.replace(x, 'l', 'i') from pg_catalog.jsonb_array_elements_text(r -> 'rand_reserviert') x loop
      if pg_catalog.right(n, pg_catalog.length(w)) = w
         or (pg_catalog.left(n, pg_catalog.length(w)) = w
             and not (r -> 'ausnahme_anfang' ? w
                      and pg_catalog.left(n, pg_catalog.length(r -> 'ausnahme_anfang' ->> w)) = (r -> 'ausnahme_anfang' ->> w))) then
        return 'reserviert';
      end if;
    end loop;
    for w in select pg_catalog.replace(x, 'l', 'i') from pg_catalog.jsonb_array_elements_text(r -> 'ueberall') x loop
      if pg_catalog.strpos(n, w) > 0 then
        return 'anstoessig';
      end if;
    end loop;
    for w in select pg_catalog.replace(x, 'l', 'i') from pg_catalog.jsonb_array_elements_text(r -> 'rand') x loop
      if pg_catalog.left(n, pg_catalog.length(w)) = w or pg_catalog.right(n, pg_catalog.length(w)) = w then
        return 'anstoessig';
      end if;
    end loop;
    if exists (select 1 from pg_catalog.jsonb_array_elements_text(r -> 'genau') x where pg_catalog.replace(x, 'l', 'i') = n) then
      return 'anstoessig';
    end if;
  end loop;
  return null;
end;
$$;

-- Trigger auf public.profile: nur neue und geaenderte Namen. Die Meldung NAME_GESPERRT uebersetzt js/konto.js.
create or replace function public.profile_name_pruefen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and pg_catalog.lower(new.benutzername) = pg_catalog.lower(old.benutzername) then
    return new;
  end if;
  -- Die App speichert mit "insert ... on conflict do update" (js/konto.js): der Insert-Trigger laeuft dann auch, wenn
  -- das Konto den Namen schon traegt. Ein bestehender Name bleibt auch auf diesem Weg.
  if tg_op = 'INSERT' and exists (select 1 from public.profile p where p.user_id = new.user_id
                                  and pg_catalog.lower(p.benutzername) = pg_catalog.lower(new.benutzername)) then
    return new;
  end if;
  if public.name_gesperrt(new.benutzername) is not null then
    raise exception 'NAME_GESPERRT' using errcode = 'P0001', hint = public.name_gesperrt(new.benutzername);
  end if;
  return new;
end;
$$;

drop trigger if exists profile_name_pruefen on public.profile;
create trigger profile_name_pruefen
before insert or update of benutzername on public.profile
for each row execute function public.profile_name_pruefen();

revoke all on function public.namen_regeln() from public, anon, authenticated;
revoke all on function public.name_lesarten(text) from public, anon, authenticated;
revoke all on function public.name_gesperrt(text) from public, anon, authenticated;
revoke all on function public.profile_name_pruefen() from public, anon, authenticated;

-- ---------- 2. Melden ----------

create table if not exists public.meldungen (
  id bigserial primary key,
  melder uuid not null references auth.users (id) on delete cascade,
  gemeldet uuid not null references auth.users (id) on delete cascade,
  grund text not null,
  notiz text,
  -- der Name, wie er beim Melden hiess (danach kann er sich aendern)
  gemeldeter_name text,
  -- die gemeinsame Online-Partie, wenn aus einer Partie gemeldet wurde (ohne Fremdschluessel: Partien werden aufgeraeumt)
  partie uuid,
  tag date not null,
  am timestamptz not null default now(),
  -- fuer Flo: 'offen', 'erledigt' oder 'abgelehnt' (im Dashboard gesetzt, die App liest das nie)
  stand text not null default 'offen',
  constraint meldungen_grund check (grund in ('name', 'verhalten', 'sonstiges')),
  constraint meldungen_notiz check (notiz is null or char_length(notiz) between 1 and 300),
  constraint meldungen_stand check (stand in ('offen', 'erledigt', 'abgelehnt')),
  constraint meldungen_nicht_selbst check (melder <> gemeldet),
  constraint meldungen_einmal_je_tag unique (melder, gemeldet, tag)
);
create index if not exists meldungen_gemeldet on public.meldungen (gemeldet, am);
create index if not exists meldungen_am on public.meldungen (am);

alter table public.meldungen enable row level security;
-- keine Policy und kein Tabellenrecht (Supabase vergibt sonst Standardrechte): niemand liest Meldungen ueber die App
revoke all on table public.meldungen from anon, authenticated, public;
revoke all on sequence public.meldungen_id_seq from anon, authenticated, public;

create or replace function public.melden_konstanten()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('max_je_tag', 5, 'notiz_max', 300, 'gruende', jsonb_build_array('name', 'verhalten', 'sonstiges'),
    'monate', 12);
$$;

-- Der Melde-Tag: Europe/Berlin, Tagesgrenze 4:00 Uhr (wie js/tag.js und coach_tag). Die 4 Stunden gehen von der
-- Wanduhr ab, damit auch am Tag der Zeitumstellung 3:59 Ortszeit zum Vortag gehoert.
create or replace function public.melden_tag()
returns date
language sql
stable
set search_path = ''
as $$
  select ((now() at time zone 'Europe/Berlin') - interval '4 hours')::date;
$$;

-- Wie viele Meldungen heute noch gehen. Die App fragt das, bevor sie den Knopf "Melden" zeigt: Fehlt diese Datei auf
-- dem Server, gibt es die Funktion nicht und der Knopf bleibt weg.
create or replace function public.melde_stand()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  k jsonb := public.melden_konstanten();
  n integer;
begin
  if uid is null then
    return jsonb_build_object('fehler', 'MELDEN_ANMELDEN');
  end if;
  select count(*) into n from public.meldungen m where m.melder = uid and m.tag = public.melden_tag();
  return jsonb_build_object('max', (k ->> 'max_je_tag')::integer, 'rest', greatest(0, (k ->> 'max_je_tag')::integer - n),
    'notiz_max', (k ->> 'notiz_max')::integer);
end;
$$;

-- Meldet einen Spieler. Antwort { ok: true, rest } oder { ok: true, schon: true } (heute schon gemeldet) oder
-- { fehler: 'MELDEN_...' }: ANMELDEN, UNGUELTIG (Grund oder Text), UNBEKANNT (kein Spieler mit diesem Namen, keine
-- gemeinsame Partie), SELBST, GRENZE (5 je Tag).
create or replace function public.melde_spieler(name text, grund text, notiz text default null, partie uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  k jsonb := public.melden_konstanten();
  ziel uuid;
  ziel_name text;
  heute date := public.melden_tag();
  text_sauber text;
  n integer;
begin
  if uid is null then
    return jsonb_build_object('fehler', 'MELDEN_ANMELDEN');
  end if;
  if grund is null or not (k -> 'gruende' ? grund) then
    return jsonb_build_object('fehler', 'MELDEN_UNGUELTIG');
  end if;
  -- Steuerzeichen raus, Raender weg; leer zaehlt als kein Text
  text_sauber := nullif(pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(notiz, ''), '[[:cntrl:]]+', ' ', 'g')), '');
  if text_sauber is not null and pg_catalog.char_length(text_sauber) > (k ->> 'notiz_max')::integer then
    return jsonb_build_object('fehler', 'MELDEN_UNGUELTIG');
  end if;

  if partie is not null then
    -- der Gegner der gemeinsamen Online-Partie (nur fuer Teilnehmer; ohne Online-Schema gibt es keine Partie)
    if pg_catalog.to_regclass('public.partien_online') is not null then
      execute 'select case when p.weiss = $1 then p.schwarz when p.schwarz = $1 then p.weiss end
               from public.partien_online p where p.id = $2' into ziel using uid, partie;
    end if;
  elsif name is not null and name ~ '^[A-Za-z0-9_]{3,20}$' then
    select p.user_id into ziel from public.profile p where pg_catalog.lower(p.benutzername) = pg_catalog.lower(name);
  else
    return jsonb_build_object('fehler', 'MELDEN_UNGUELTIG');
  end if;
  if ziel is null then
    return jsonb_build_object('fehler', 'MELDEN_UNBEKANNT');
  end if;
  if ziel = uid then
    return jsonb_build_object('fehler', 'MELDEN_SELBST');
  end if;
  select p.benutzername into ziel_name from public.profile p where p.user_id = ziel;

  -- zwei gleichzeitige Meldungen desselben Kontos nacheinander, damit die Tagesgrenze haelt
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('melden:' || uid::text, 0));
  -- Speicherdauer: aeltere Meldungen als 12 Monate loescht jeder Aufruf mit
  delete from public.meldungen m where m.am < now() - pg_catalog.make_interval(months => (k ->> 'monate')::integer);

  if exists (select 1 from public.meldungen m where m.melder = uid and m.gemeldet = ziel and m.tag = heute) then
    return jsonb_build_object('ok', true, 'schon', true);
  end if;
  select count(*) into n from public.meldungen m where m.melder = uid and m.tag = heute;
  if n >= (k ->> 'max_je_tag')::integer then
    return jsonb_build_object('fehler', 'MELDEN_GRENZE');
  end if;
  insert into public.meldungen (melder, gemeldet, grund, notiz, gemeldeter_name, partie, tag)
  values (uid, ziel, grund, text_sauber, ziel_name, partie, heute);
  return jsonb_build_object('ok', true, 'rest', (k ->> 'max_je_tag')::integer - n - 1);
end;
$$;

revoke all on function public.melden_konstanten() from public, anon, authenticated;
revoke all on function public.melden_tag() from public, anon, authenticated;
revoke all on function public.melde_stand() from public, anon, authenticated;
revoke all on function public.melde_spieler(text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.melde_stand() to authenticated;
grant execute on function public.melde_spieler(text, text, text, uuid) to authenticated;

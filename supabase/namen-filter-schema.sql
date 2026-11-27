-- Namensfilter fuer Benutzernamen (T-012, R31 27.11.2026; Entscheidung 17.10.2026 "Benutzername mit Namensfilter").
-- Gehalt aus PR #204 (Teil 1 von melden-schema.sql), ohne das Melden. Rein additiv: drei Funktionen und ein Trigger.
--
-- Neue und geaenderte Benutzernamen (public.profile) prueft der Server gegen eine kurze Sperrliste: Namen, die nach
-- Crownmate, Verwaltung oder Hilfe-Team klingen (admin, support, moderator, crownmate ...), und klar beleidigende oder
-- diskriminierende Begriffe (Deutsch und Englisch). Verglichen wird nach einer Normalisierung: klein geschrieben, ohne
-- Unterstriche, mit den Ersetzungen 0 -> o, 1 -> i, 3 -> e, 4 -> a, 5 -> s, 7 -> t, uebrige Ziffern fallen weg; i und l
-- gelten als derselbe Buchstabe. Zwei Lesarten: mit den Ersetzungen und ganz ohne Ziffern. Dieselbe Liste und Rechnung
-- stehen in js/namen.js (freundliche Meldung vor dem Absenden); tests/server-namen-filter.test.mjs vergleicht beide.
-- Arten: ueberall (irgendwo im Namen), rand (nur Anfang oder Ende: "Badminton" bleibt frei), genau (der ganze Name ohne
-- Ziffern und _: "Nazir" bleibt frei), ganz (der Name besteht nur aus solchen Woertern: "Support_Team" ja, "TeamRocket" nein).
--
-- Wer geprueft wird: nur die eigene Eingabe, also ein Schreiben als Rolle "authenticated" (REST der App, auch ein
-- direkter Aufruf an der App vorbei). Die Verwaltung (verwaltung_name, security definer) und der SQL Editor laufen als
-- Besitzer und bleiben frei, wie bei der Monats-Sperre (benutzername-sperre-schema.sql).
-- BESTEHENDE NAMEN bleiben, wie sie sind: geprueft wird nur beim Anlegen und wenn sich der Name aendert (Gross- und
-- Kleinschreibung zaehlt nicht als Aenderung). Bestehende Namen prueft Flo einmal lesend (Abfrage in der PR-Beschreibung).
--
-- Fehler: NAME_UNZULAESSIG (P0001), hint = 'reserviert' | 'anstoessig'. Bewusst NICHT "NAME_GESPERRT": das ist schon die
-- Kennung der Monats-Sperre (js/konto.js liest dort detail als Datum).
-- Monats-Sperre: Trigger feuern alphabetisch, profile_name_pruefen laeuft vor profile_name_sperre und
-- profile_name_zz_bestaetigt. Ein abgelehnter Name bricht die ganze Anweisung ab, die Frist (name_geaendert_am) bleibt
-- also unveraendert; der Test belegt das mit und ohne eingespielte Sperre.
--
-- Voraussetzung: schema.sql. Einspielen nur Flo (SQL Editor). Wiederholbar. Pruefen: namen-filter-rls-test.sql (rollt
-- alles zurueck). Rueckweg: namen-filter-zurueck.sql. Test: tests/server-namen-filter.test.mjs (PGlite).

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
-- Trigger auf public.profile: nur neue und geaenderte Namen, nur die eigene Eingabe. Die Meldung NAME_UNZULAESSIG
-- uebersetzt js/konto.js. Ohne security definer, damit current_user die Rolle des Schreibenden ist (wie
-- profile_name_sperre); darum duerfen authenticated die drei reinen Rechenfunktionen ausfuehren (die Liste steht
-- ohnehin offen in js/namen.js).
create or replace function public.profile_name_pruefen()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  grund text;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'UPDATE' and pg_catalog.lower(new.benutzername) = pg_catalog.lower(old.benutzername) then
    return new;
  end if;
  -- Die App speichert mit "insert ... on conflict do update" (js/konto.js): der Insert-Trigger laeuft dann auch, wenn
  -- das Konto den Namen schon traegt. Ein bestehender Name bleibt auch auf diesem Weg.
  if tg_op = 'INSERT' and exists (select 1 from public.profile p where p.user_id = new.user_id
                                  and pg_catalog.lower(p.benutzername) = pg_catalog.lower(new.benutzername)) then
    return new;
  end if;
  grund := public.name_gesperrt(new.benutzername);
  if grund is not null then
    raise exception 'NAME_UNZULAESSIG' using errcode = 'P0001', hint = grund;
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
grant execute on function public.namen_regeln() to authenticated;
grant execute on function public.name_lesarten(text) to authenticated;
grant execute on function public.name_gesperrt(text) to authenticated;

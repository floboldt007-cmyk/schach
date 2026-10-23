-- "Frag den Coach" (Welle B2): Tageszaehler fuer die KI-Fragen. Mehrfach ausfuehrbar (Muster: schema.sql,
-- abo-schema.sql). Vorher schema.sql und abo-schema.sql einspielen: Die Edge Function coach fragt ueber
-- ist_premium_von (abo-schema.sql), ob jemand den Trainer hat.
--
-- Grundsatz: Gespeichert wird nur, WIE VIELE Fragen ein Nutzer an einem Tag gestellt hat. Nie die Frage, die Stellung,
-- die Zuege oder die Antwort. Die Zeilen sind nach 7 Tagen weg (jede neue Frage raeumt aeltere Tage aller Nutzer auf),
-- und mit dem Konto verschwinden sie sofort (on delete cascade).
--
-- Tabelle:
--   coach_nutzung   (user_id, tag, anzahl): eine Zeile je Nutzer und Coach-Tag. Nutzer lesen nur die eigenen Zeilen
--                   (fuer eine spaetere Anzeige und die Datenauskunft) und schreiben nie. Geschrieben wird nur ueber
--                   die Funktionen unten, und die darf nur die Service-Rolle aufrufen.
--
-- Funktionen (nur Service-Rolle, also die Edge Function coach; supabase/functions/_gemeinsam/coach.js):
--   coach_tag()                       der Coach-Tag: Datum in Europe/Berlin mit Tagesgrenze 4:00 Uhr (wie js/tag.js in
--                                     der App; wer um 1 Uhr nachts noch analysiert, zaehlt zum Vortag)
--   coach_nimm_frage(nutzer, grenze)  zaehlt eine Frage, wenn heute noch eine frei ist. Rueckgabe: wie viele danach heute
--                                     noch frei sind (0 bis grenze-1), oder -1, wenn die Grenze schon erreicht war; dann
--                                     wird nichts gezaehlt. Atomar: Auch zwei gleichzeitige Fragen kommen nie ueber die
--                                     Grenze (insert ... on conflict do update ... where sperrt die Zeile und prueft den
--                                     neuesten Stand).
--   coach_gib_zurueck(nutzer)         nimmt eine heute gezaehlte Frage zurueck, wenn die KI nicht geantwortet hat (Fehler,
--                                     Ablehnung). Nie unter 0. Rueckgabe: neue Anzahl, -1 ohne Zeile. Faellt die Antwort
--                                     genau auf die Tagesgrenze, trifft das Zurueckgeben den neuen Tag und tut nichts.
--
-- Fehler-Kennungen (Vertrag mit supabase/functions/_gemeinsam/coach.js, dort fuehren sie zu 503):
--   COACH_GRENZE_UNGUELTIG   grenze nicht zwischen 1 und 1000
--   COACH_NUTZER_FEHLT       nutzer ist null
--
-- Hinweis fuer spaetere Aenderungen: `create or replace function` kann weder Parameternamen noch Rueckgabetyp aendern.
-- Dann vorher `drop function public.<name>(<typen>)` ausfuehren.

create table if not exists public.coach_nutzung (
  user_id uuid not null references auth.users (id) on delete cascade,
  tag date not null,
  anzahl integer not null default 0,
  primary key (user_id, tag),
  constraint coach_nutzung_anzahl check (anzahl between 0 and 1000)
);

-- Fuer das Aufraeumen alter Tage (delete ... where tag < ...)
create index if not exists coach_nutzung_tag on public.coach_nutzung (tag);

-- Der Coach-Tag: Europe/Berlin, Tagesgrenze 4:00 Uhr (die App rechnet ihre Tage genauso, js/tag.js). Die 4 Stunden
-- gehen von der Wanduhr ab (`now() at time zone` liefert die Ortszeit ohne Zone), nicht von einem Zeitstempel: Auch am
-- Tag der Zeitumstellung gehoert 3:59 Ortszeit zum Vortag und 4:00 zum neuen Tag.
create or replace function public.coach_tag()
returns date
language sql
stable
set search_path = ''
as $$
  select ((now() at time zone 'Europe/Berlin') - interval '4 hours')::date;
$$;

create or replace function public.coach_nimm_frage(nutzer uuid, grenze integer)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_tag date := public.coach_tag();
  v_anzahl integer;
begin
  if nutzer is null then
    raise exception 'COACH_NUTZER_FEHLT';
  end if;
  if grenze is null or grenze < 1 or grenze > 1000 then
    raise exception 'COACH_GRENZE_UNGUELTIG';
  end if;
  -- Datensparsam: Tage, die aelter als eine Woche sind, braucht niemand mehr (gilt fuer alle Nutzer)
  delete from public.coach_nutzung where tag < v_tag - 7;
  insert into public.coach_nutzung as n (user_id, tag, anzahl)
  values (nutzer, v_tag, 1)
  on conflict (user_id, tag) do update
    set anzahl = n.anzahl + 1
    where n.anzahl < grenze
  returning n.anzahl into v_anzahl;
  if v_anzahl is null then
    return -1;
  end if;
  return greatest(grenze - v_anzahl, 0);
end;
$$;

create or replace function public.coach_gib_zurueck(nutzer uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_anzahl integer;
begin
  if nutzer is null then
    raise exception 'COACH_NUTZER_FEHLT';
  end if;
  update public.coach_nutzung
    set anzahl = anzahl - 1
    where user_id = nutzer and tag = public.coach_tag() and anzahl > 0
  returning anzahl into v_anzahl;
  return coalesce(v_anzahl, -1);
end;
$$;

alter table public.coach_nutzung enable row level security;

-- Wiederholbares Einspielen: die eigene Policy wird gezielt ersetzt.
drop policy if exists "Eigene Coach-Nutzung lesen" on public.coach_nutzung;
create policy "Eigene Coach-Nutzung lesen"
on public.coach_nutzung for select
to authenticated
using ((select auth.uid()) = user_id);

-- Tabellenrechte: Nutzer lesen (nur die eigenen Zeilen, siehe Policy), schreiben nie. Schreiben nur die Service-Rolle.
revoke all on table public.coach_nutzung from anon, authenticated, public;
grant select on table public.coach_nutzung to authenticated;
grant select, insert, update, delete on table public.coach_nutzung to service_role;

-- Funktionen: nur die Service-Rolle (Supabase vergibt neue Funktionen sonst an anon und authenticated). Ein Nutzer, der
-- coach_gib_zurueck selbst aufrufen koennte, haette kein Tageslimit mehr.
revoke all on function public.coach_tag() from anon, authenticated, public;
revoke all on function public.coach_nimm_frage(uuid, integer) from anon, authenticated, public;
revoke all on function public.coach_gib_zurueck(uuid) from anon, authenticated, public;
grant execute on function public.coach_tag() to service_role;
grant execute on function public.coach_nimm_frage(uuid, integer) to service_role;
grant execute on function public.coach_gib_zurueck(uuid) to service_role;

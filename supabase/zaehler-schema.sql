-- Tageszaehler (Etappe B, Task 8; Konzept 5d): Tagessummen je Schluessel, OHNE Personenbezug.
-- VORAUSSETZUNG: supabase/kronen-schema.sql ist eingespielt (Tabelle public.kronen_schalter mit der Spalte zaehler_an).
-- Reihenfolge: online-schema.sql -> kronen-schema.sql -> diese Datei.
--
-- Gebaut, aber AUS: Gezaehlt wird nur, wenn public.kronen_schalter.zaehler_an = true. Die Vorgabe ist false (gesetzt in
-- kronen-schema.sql); diese Datei schaltet nie an. Anschalten erst nach Rechtspruefung (§ 25 TDDDG, DSGVO) und einem
-- Absatz in der Datenschutzerklaerung, von Hand im SQL Editor.
--
-- Was gespeichert wird: je Tag (Europe/Berlin) und Schluessel eine Zahl. Keine Nutzer-ID, keine Geraete-Kennung, keine
-- Adresse, keine Uhrzeit; die Funktionen lesen auth.uid() nicht. Erlaubt sind nur die festen Schluessel unten (weitere
-- kommen mit ihren Etappen, die Liste steht gleich in js/zaehler.js, Vertrag in tests/zaehler.test.mjs).
-- Nutzer haben keine Tabellenrechte; sie duerfen nur zaehler_an() und zaehler_erhoehe() aufrufen (auch ohne Anmeldung,
-- der Client sendet bewusst ohne Anmeldung).
--
-- Einspielen: im SQL Editor ausfuehren, wiederholbar. Pruefen: supabase/zaehler-rls-test.sql (rollt am Ende alles
-- zurueck). Rueckweg: supabase/zaehler-zurueck.sql. Rein additiv: eine neue Tabelle, zwei neue Funktionen.

create table if not exists public.zaehler_tag (
  tag date not null,
  schluessel text not null check (schluessel ~ '^[a-z0-9_.-]{1,48}$'),
  wert bigint not null default 0 check (wert >= 0),
  primary key (tag, schluessel)
);

alter table public.zaehler_tag enable row level security;
revoke all on table public.zaehler_tag from anon, authenticated, public;

-- Ist der Zaehler an? (fuer den Client; ohne Schalter-Zeile: aus)
create or replace function public.zaehler_an()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.zaehler_an from public.kronen_schalter s where s.id), false);
$$;

-- Zaehlt um 1..1000 hoch (begrenzt). Liefert false und schreibt nichts, solange der Schalter aus ist oder der Schluessel
-- nicht erlaubt ist.
create or replace function public.zaehler_erhoehe(schluessel text, um integer default 1)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.zaehler_an() then
    return false;
  end if;
  if schluessel is null or not (schluessel = any (array['suche.wartezeit_s', 'suche.ki_gegner', 'suche.mensch',
      'kronen.online', 'kronen.ki', 'kronen.bot']::text[])) then
    return false;
  end if;
  insert into public.zaehler_tag as z (tag, schluessel, wert)
  values ((now() at time zone 'Europe/Berlin')::date, zaehler_erhoehe.schluessel, least(greatest(coalesce(um, 1), 1), 1000))
  on conflict (tag, schluessel) do update set wert = z.wert + excluded.wert;
  return true;
end;
$$;

revoke all on function public.zaehler_an() from public, anon, authenticated;
revoke all on function public.zaehler_erhoehe(text, integer) from public, anon, authenticated;
grant execute on function public.zaehler_an() to anon, authenticated;
grant execute on function public.zaehler_erhoehe(text, integer) to anon, authenticated;

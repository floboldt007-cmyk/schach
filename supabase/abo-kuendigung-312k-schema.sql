-- Kuendigungserklaerung nach Paragraf 312k BGB speichern (T-068, 26.11.2026). Ergaenzt abo-beenden-schema.sql um die
-- Angaben der Bestaetigungsseite: Art der Kuendigung, Grund, Name, gewuenschter Zeitpunkt, Adresse fuer die Bestaetigung
-- und den vollen Text der abgegebenen Erklaerung (Paragraf 312k Abs. 4: speichern mit Datum und Uhrzeit, so dass die
-- Person ihn wiedergeben kann). Nach abo-beenden-schema.sql im Supabase SQL Editor ausfuehren. Wiederholbar.
-- Nur additiv: neue Spalten (alle duerfen leer sein), eine neue Funktion, ein Ausloeser. Rueckweg:
-- abo-kuendigung-312k-zurueck.sql. Fehlt diese Datei auf dem Server, traegt abo-beenden.js den Vorgang wie bisher ueber
-- abo_vorgang_eintragen ein (ohne diese Angaben) und schreibt "nachweis_ohne_312k" ins Protokoll.
--
-- Spalten an abo_vorgaenge (nur bei art = 'kuendigung' gefuellt):
--   kuendigung_art   'ordentlich' | 'ausserordentlich'
--   grund            Grund einer ausserordentlichen Kuendigung, hoechstens 500 Zeichen (leer = keiner angegeben)
--   name             Name, wie eingetragen (freiwillig), hoechstens 200 Zeichen
--   wunsch_zum       gewuenschter Kalendertag, leer = fruehestmoeglich
--   bestaetigung_an  Adresse, an die die Bestaetigung ging, falls sie von der Kontoadresse abweicht
--   pruefung         true: ausserordentlich oder Wunschtermin vor dem Ende des bezahlten Zeitraums, Flo entscheidet von
--                    Hand. Die Kuendigung wirkt mindestens ordentlich zum fruehestmoeglichen Zeitpunkt.
--   erklaerung       der Text der Erklaerung, wie ihn Seite und Mail zeigen, hoechstens 4000 Zeichen
--
-- Datenschutz: Beim Loeschen des Kontos setzt der Fremdschluessel user_id auf null (Nachweispflicht, wie bisher). Der
-- Ausloeser abo_vorgaenge_konto_weg leert dabei name und bestaetigung_an und ersetzt die Namenszeile der Erklaerung.

alter table public.abo_vorgaenge
  add column if not exists kuendigung_art text,
  add column if not exists grund text,
  add column if not exists name text,
  add column if not exists wunsch_zum date,
  add column if not exists bestaetigung_an text,
  add column if not exists pruefung boolean,
  add column if not exists erklaerung text;

alter table public.abo_vorgaenge drop constraint if exists abo_vorgaenge_kuendigung_art;
alter table public.abo_vorgaenge add constraint abo_vorgaenge_kuendigung_art
  check (kuendigung_art is null or kuendigung_art in ('ordentlich', 'ausserordentlich'));
alter table public.abo_vorgaenge drop constraint if exists abo_vorgaenge_312k_laengen;
alter table public.abo_vorgaenge add constraint abo_vorgaenge_312k_laengen check (
  (grund is null or char_length(grund) <= 500)
  and (name is null or char_length(name) <= 200)
  and (bestaetigung_an is null or char_length(bestaetigung_an) between 3 and 320)
  and (erklaerung is null or char_length(erklaerung) <= 4000));

create or replace function public.abo_kuendigung_eintragen(
  p_user uuid, p_weg text, p_abo text, p_wirksam timestamptz, p_mail boolean,
  p_kuendigung_art text, p_grund text, p_name text, p_wunsch_zum date, p_bestaetigung_an text,
  p_pruefung boolean, p_erklaerung text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.abo_vorgaenge (user_id, art, weg, abo_id, wirksam_zum, erstattet_cent, mail_gesendet,
    kuendigung_art, grund, name, wunsch_zum, bestaetigung_an, pruefung, erklaerung)
  values (p_user, 'kuendigung', p_weg, p_abo, p_wirksam, null, coalesce(p_mail, false),
    coalesce(p_kuendigung_art, 'ordentlich'), nullif(p_grund, ''), nullif(p_name, ''), p_wunsch_zum,
    nullif(p_bestaetigung_an, ''), coalesce(p_pruefung, false), p_erklaerung);
$$;

revoke all on function public.abo_kuendigung_eintragen(uuid, text, text, timestamptz, boolean, text, text, text, date, text,
  boolean, text) from public, anon, authenticated;
grant execute on function public.abo_kuendigung_eintragen(uuid, text, text, timestamptz, boolean, text, text, text, date, text,
  boolean, text) to service_role;

-- Konto weg (user_id wird null): Name und abweichende Adresse gehen mit, der Rest bleibt als pseudonymer Nachweis
create or replace function public.abo_vorgaenge_konto_weg()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.user_id is not null and new.user_id is null then
    new.name := null;
    new.bestaetigung_an := null;
    if new.erklaerung is not null then
      new.erklaerung := regexp_replace(new.erklaerung, '(^|\n)Name: [^\n]*', '\1Name: (mit dem Konto gelöscht)', 'g');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists abo_vorgaenge_konto_weg on public.abo_vorgaenge;
create trigger abo_vorgaenge_konto_weg
  before update of user_id on public.abo_vorgaenge
  for each row execute function public.abo_vorgaenge_konto_weg();

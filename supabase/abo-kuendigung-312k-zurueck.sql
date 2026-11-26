-- Rueckweg zu abo-kuendigung-312k-schema.sql (T-068). Entfernt Ausloeser, Funktion und die neuen Spalten wieder.
-- ACHTUNG: Die Spalten tragen gespeicherte Kuendigungserklaerungen (Nachweis nach Paragraf 312k Abs. 4). Vor dem Lauf
-- sichern, z. B. "select id, erstellt_am, kuendigung_art, grund, name, wunsch_zum, pruefung, erklaerung
-- from public.abo_vorgaenge where erklaerung is not null;" als CSV exportieren.
drop trigger if exists abo_vorgaenge_konto_weg on public.abo_vorgaenge;
drop function if exists public.abo_vorgaenge_konto_weg();
drop function if exists public.abo_kuendigung_eintragen(uuid, text, text, timestamptz, boolean, text, text, text, date, text,
  boolean, text);
alter table public.abo_vorgaenge drop constraint if exists abo_vorgaenge_kuendigung_art;
alter table public.abo_vorgaenge drop constraint if exists abo_vorgaenge_312k_laengen;
alter table public.abo_vorgaenge
  drop column if exists kuendigung_art,
  drop column if exists grund,
  drop column if exists name,
  drop column if exists wunsch_zum,
  drop column if exists bestaetigung_an,
  drop column if exists pruefung,
  drop column if exists erklaerung;

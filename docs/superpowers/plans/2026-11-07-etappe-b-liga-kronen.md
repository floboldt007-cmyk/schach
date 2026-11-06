# Etappe B: Liga mit Kronen – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kronen sind die einzige sichtbare Rang-Zahl: der Server bucht sie fuer Online-Siege und (weniger) fuer Bot-Siege, ordnet daraus eine von 18 Liga-Stufen (Holz bis Krone, je 3) zu, fuehrt 4-Wochen-Saisons mit Rueckstufung, findet Gegner per Warteschlange mit Bot nach 10 Sekunden ("KI-Gegner") und zaehlt Tagessummen, die bis zur Rechtspruefung AUS bleiben.

**Architecture:** Eine reine Rechen-Datei `js/pakete/liga/kronen.js` (Node-testbar) legt Stufen, Saison und Buchungsregeln fest; dieselben Zahlen stehen in `supabase/kronen-schema.sql`, ein Vertragstest haelt beide gleich. Der Server entscheidet: Online-Ergebnisse bucht ein Trigger auf `partien_online`, Bot-Ergebnisse eine RPC mit Tagesgrenze, alles `security definer` mit Zeilenschutz wie `online-schema.sql`. Eine neue Edge Function ist nicht noetig (alle Eingaben sind schon serverseitig oder werden per RPC begrenzt); das Muster bleibt Supabase-RPC wie bei `online_*`. Die App liest den Stand ueber `js/kronen.js` und zeigt ihn auf der Startseite (`js/ui/heim.js`) und in der Lobby.

**Tech Stack:** Vanilla JS (ES-Module), Supabase Postgres (plpgsql, RLS), Tests per `node tests/<name>.test.mjs`, SQL-Tests im Supabase SQL Editor (Rollback am Ende) bzw. PGlite-Pruefer im Scratchpad. Playwright 1.64.1 fuer UI-Tests.

**Spec:** Privat im Vault, `Claude Code/Schach-App/Konzept 2026-11-06 Spiel und Design.md`, Abschnitte 5, 5d Punkt 1, 10b. Preise und Geschaeftszahlen daraus gehoeren NIE in dieses Repo.

## Global Constraints

- Oeffentliches Repo: keine Preise, keine persoenlichen Daten, keine Schluessel, keine /exec- oder Projekt-URLs ausser den schon vorhandenen in `js/konto-config.js`.
- Nichts wird gegen die echte Datenbank ausgefuehrt. SQL-Dateien werden geschrieben und mit `*-rls-test.sql` (begin ... rollback) geprueft; das Einspielen macht Flo nach `supabase/ANLEITUNG.md`.
- Ligen: Holz, Bronze, Silber, Gold, Diamant, Krone, je 3 Stufen (III, II, I aufsteigend) = 18 Stufen.
- Saison 4 Wochen (28 Tage), Start montags 00:00 Europe/Berlin, Serverzeit (`now() at time zone 'Europe/Berlin'`), nie Geraetezeit.
- Elo bleibt unsichtbar (nur fuer die Gegnersuche, Anzeige im Profil kommt mit Etappe 4b).
- Bot-Ersatz nach 10 Sekunden Suche, sichtbar markiert mit "KI-Gegner" / "AI opponent", nie als Mensch getarnt. Sieg gegen Bot gibt weniger Kronen als gegen Menschen.
- Zaehler (5d): nur Tagessummen je Schluessel, keine Nutzer-ID, keine Geraete-Kennung, keine Cookies, kein Dritter. Gebaut, aber AUS (`kronen_schalter.zaehler_an = false`) bis Rechtspruefung und Datenschutz-Absatz.
- Fairness bleibt: `tests/fairness.test.mjs` Regel 9 und 10 (keine Druck- und Schuldgefuehl-Texte) muss gruen bleiben; innerhalb einer Saison faellt niemand unter den Boden seiner erreichten Stufe.
- Zahlen, die Flo noch bestaetigen muss, tragen im Code den Vermerk `// [E]` (wie in `js/pakete/liga/wertung.js`) und stehen in der Liste am Ende.
- Texte DE und EN; nach jeder Aenderung an App-Dateien `node tests/sw.test.mjs --aktualisieren` (VERSION +1, STAND neu, nur in einem LF-Arbeitsbaum rechnen), neue Dateien in `DATEIEN` in `sw.js`.
- Commits Deutsch, Umlaute als ae/oe/ue/ss.

## Review Focus

1. Saisonwechsel genau um Mitternacht Montag (Europe/Berlin) und ueber die Sommerzeit-Umstellung: eine Partie, die 23:59 endet, zaehlt zur alten Saison, 00:00 zur neuen. Test in Task 1 (`saisonAm`) und Task 2 (SQL-Abschnitt "Saisongrenze").
2. Doppelt gemeldetes Ergebnis (Trigger feuert bei zweitem Update, Bot-Ergebnis wird erneut gesendet, Netz wiederholt): Kronen genau einmal. Eindeutiger Schluessel `(user_id, quelle, ref)`, Tests in Task 3 und Task 5.
3. Spieler ohne Konto oder offline: Startseite zeigt keinen Fehler, kein `NaN`, sondern Holz III mit 0 und den Hinweis zum Anmelden. Test in Task 7.
4. Beide Spieler suchen gleichzeitig: genau eine Partie, keiner wird doppelt gepaart, keiner bekommt nach Paarung noch einen Bot. Test in Task 4 (SQL) und Task 4 (UI, Bot erst nach 10 s und nur ohne Paarung).
5. Abgebrochene oder strittige Online-Partien (`ergebnis is null`, `grund = 'abgebrochen'`): keine Kronen, keine Elo-Aenderung. Test in Task 3.

---

## Dateiuebersicht

| Datei | Neu/Aendern | Aufgabe |
|---|---|---|
| `js/pakete/liga/kronen.js` | neu | reine Rechnung: Stufen, Saison, Buchung, Rueckstufung, Start aus Elo |
| `tests/kronen.test.mjs` | neu | Node-Tests der Rechnung |
| `supabase/kronen-schema.sql` | neu | Tabellen, Trigger, RPCs, Rechte |
| `supabase/kronen-zurueck.sql` | neu | macht `kronen-schema.sql` rueckgaengig (umgekehrte Reihenfolge) |
| `supabase/kronen-rls-test.sql` | neu | Rechte- und Logiktest mit Rollback |
| `tests/kronen-vertrag.test.mjs` | neu | gleiche Zahlen in JS und SQL, alle RPCs im RLS-Test erwaehnt |
| `js/kronen.js` | neu | Client: Stand holen, Suche, Bot-Ergebnis, Start-Liga |
| `js/online.js` | aendern | `rpc` exportieren (heute privat, Zeile 146) |
| `js/pakete/lobby/index.js`, `js/ui/lobby.js` | aendern | echte Suche, Bot nach 10 s mit "KI-Gegner" |
| `js/pakete/liga/index.js` | aendern | Bot-Ergebnis an den Server melden |
| `js/ui/heim.js` | aendern | Ring zeigt Kronen statt Liga-Punkte |
| `js/zaehler.js` | neu | Tageszaehler-Client, sendet nur wenn der Server "an" sagt |
| `supabase/ANLEITUNG.md` | aendern | Abschnitt "Liga mit Kronen" (Einspielen, Pruefen, Zurueck) |
| `tests/alle.mjs`, `sw.js` | aendern | neue Suiten und Dateien |

---

### Task 1: Reine Kronen-Rechnung

**Files:**
- Create: `js/pakete/liga/kronen.js`
- Test: `tests/kronen.test.mjs`

**Interfaces:**
- Produces (alle rein, ohne DOM, ohne Uhr):
  - `LIGEN = ['holz','bronze','silber','gold','diamant','krone']`
  - `STUFEN_JE_LIGA = 3`, `STUFE_KRONEN = 100` `// [E]` (Kronen je Stufe), `STUFEN_ANZAHL = 18`
  - `KRONEN = { sieg: 30, remis: 10, niederlage: -15, botSieg: 15, botRemis: 5, botNiederlage: 0 }` `// [E]`
  - `BOT_TAGESGRENZE = 10` `// [E]` (gewertete Bot-Ergebnisse je Tag)
  - `SAISON_TAGE = 28`, `SAISON_1_START = '2026-11-30'` `// [E]` (Montag)
  - `RUECKSTUFUNG_STUFEN = 3` `// [E]`
  - `stufeVon(kronen: number) -> { index: 0..17, liga: string, rang: 3|2|1, boden: number, naechste: number|null }`
  - `bucheKronen(stand: {kronen:number, boden:number}, delta: number) -> {kronen, boden}` (nie unter `boden`, `boden` steigt mit erreichter Stufe)
  - `kronenFuer(quelle: 'online'|'bot', ergebnis: 'sieg'|'remis'|'niederlage') -> number`
  - `saisonAm(tag: 'YYYY-MM-DD') -> { nr: number, start: string, ende: string }`
  - `neueSaisonKronen(kronen: number) -> number` (Rueckstufung um `RUECKSTUFUNG_STUFEN`, mindestens 0, landet auf dem Boden der Zielstufe)
  - `startKronenAusElo(elo: number) -> number` (Bestandsspieler, Tabelle unten)

- [ ] **Step 1: Failing tests** in `tests/kronen.test.mjs` (Stil wie `tests/liga.test.mjs`: eigene `pruefe(name, bedingung)`, Exitcode 1 bei Fehler):
  - `stufeVon(0)` → `{ index: 0, liga: 'holz', rang: 3, boden: 0, naechste: 100 }`; `stufeVon(99).index === 0`; `stufeVon(100).index === 1`; `stufeVon(1700)` → `{ index: 17, liga: 'krone', rang: 1, naechste: null }`; `stufeVon(99999).index === 17`; `stufeVon(-5).index === 0`; `stufeVon(NaN).index === 0`.
  - `bucheKronen({kronen: 105, boden: 100}, -15)` → `{kronen: 100, boden: 100}`; `bucheKronen({kronen: 190, boden: 100}, 30)` → `{kronen: 220, boden: 200}`.
  - `kronenFuer('bot','sieg') < kronenFuer('online','sieg')`; `kronenFuer('online','x') === 0`.
  - `saisonAm('2026-11-30')` → `{nr: 1, start: '2026-11-30', ende: '2026-12-28'}`; `saisonAm('2026-12-27').nr === 1`; `saisonAm('2026-12-28').nr === 2`; `saisonAm('2026-11-01').nr === 0`.
  - `neueSaisonKronen(1750) === 1400` (Krone I → Diamant I Boden); `neueSaisonKronen(250) === 0`; `neueSaisonKronen(0) === 0`.
  - `startKronenAusElo`: `<1000 → 0`, `1000 → 300` (Bronze), `1200 → 600` (Silber), `1400 → 900` (Gold), `1600 → 1200` (Diamant), `>=1900 → 1200` (nie direkt Krone), `NaN → 0`.
- [ ] **Step 2:** `node tests/kronen.test.mjs` → FAIL (Modul fehlt).
- [ ] **Step 3:** `js/pakete/liga/kronen.js` mit den Signaturen oben; `startKronenAusElo` nutzt die Elo-Grenzen aus `KLASSEN_GRENZEN` in `wertung.js` (`[0,1000,1200,1400,1600,1900]`) und setzt auf den Boden der Liga-Stufe III, gedeckelt bei Diamant III.
- [ ] **Step 4:** `node tests/kronen.test.mjs` → alle ok.
- [ ] **Step 5:** Commit `Kronen: reine Rechnung fuer Stufen, Saison und Buchung`.

### Task 2: Schema, Rueckweg und RLS-Grundtest

**Files:**
- Create: `supabase/kronen-schema.sql`, `supabase/kronen-zurueck.sql`, `supabase/kronen-rls-test.sql`
- Test: `tests/kronen-vertrag.test.mjs`

**Interfaces:**
- Consumes: Konstanten aus Task 1.
- Produces (SQL, Schema `public`):
  - `kronen_stand (user_id uuid pk references auth.users on delete cascade, saison int not null, kronen int not null default 0 check (kronen >= 0), boden int not null default 0, elo int not null default 1000, elo_n int not null default 0, start_gesetzt boolean not null default false, aktualisiert_am timestamptz not null default now())`
  - `kronen_buchungen (id bigserial pk, user_id uuid not null references auth.users on delete cascade, quelle text check (quelle in ('online','bot','start','saison')), ref text not null check (char_length(ref) <= 64), delta int not null, saison int not null, am timestamptz not null default now(), unique (user_id, quelle, ref))`
  - `kronen_archiv (user_id uuid, saison int, kronen int, stufe int, primary key (user_id, saison))` (Grundlage fuer Saison-Belohnungen in Etappe 4b)
  - `kronen_schalter (id boolean pk default true check (id), zaehler_an boolean not null default false)` mit genau einer Zeile
  - `kronen_konstanten()` returns jsonb mit allen Zahlen aus Task 1 (fuer den Vertragstest und den Client)
  - `kronen_saison_heute() returns int` (Europe/Berlin)
  - `kronen_stufe(kronen int) returns int` (0..17)
  - `kronen_mein_stand() returns jsonb` `{ saison, kronen, stufe, boden, naechste }` (legt die Zeile bei Bedarf an und fuehrt den Saisonwechsel aus: Archivzeile, `neueSaisonKronen`, Buchung `quelle='saison'`)
  - Rechte: `revoke all ... from anon, authenticated, public`; nur `execute` auf `kronen_mein_stand` fuer `authenticated`; Tabellen ohne direkte Lese-/Schreibrechte fuer Nutzer.
- `kronen-zurueck.sql`: `drop function` aller `kronen_*` und `drop trigger` aus Task 3, dann `drop table kronen_buchungen, kronen_archiv, kronen_stand, kronen_schalter`, dann `alter table partien_online drop column if exists gewertet` (aus Task 3) und `drop table if exists suche_warteschlange, zaehler_tag` (aus Task 4 und 8). Nur Strukturen, keine Daten zurueck: Kopf-Kommentar sagt das ausdruecklich.

- [ ] **Step 1: Failing test** `tests/kronen-vertrag.test.mjs`:
  - liest `supabase/kronen-schema.sql`, zieht den `jsonb_build_object` aus `kronen_konstanten()` per Regex und vergleicht jeden Wert mit dem Export aus `js/pakete/liga/kronen.js` (`STUFE_KRONEN`, `KRONEN.*`, `BOT_TAGESGRENZE`, `SAISON_TAGE`, `SAISON_1_START`, `RUECKSTUFUNG_STUFEN`).
  - jede `create or replace function public.kronen_*` und `online_suche_*`/`zaehler_*` aus dem Schema kommt in `kronen-rls-test.sql` vor.
  - jede Tabelle aus `kronen-schema.sql` hat `enable row level security` und steht in `kronen-zurueck.sql` in einem `drop`.
  - `kronen-schema.sql` enthaelt kein `zaehler_an boolean not null default true`.
- [ ] **Step 2:** `node tests/kronen-vertrag.test.mjs` → FAIL (Dateien fehlen).
- [ ] **Step 3:** Schema schreiben; Funktionen `security definer`, `set search_path = ''` wie `online-schema.sql` Zeile 77-ff.; Saison in SQL: `floor((datum - date '2026-11-30') / 28) + 1`, Datum aus `(now() at time zone 'Europe/Berlin')::date`.
- [ ] **Step 4:** `kronen-rls-test.sql` (Aufbau wie `online-rls-test.sql`: `begin`, drei Testnutzer A/B/C in `auth.users`, `set local role authenticated` + `request.jwt.claims`, am Ende `rollback`). Abschnitte:
  1. A ruft `kronen_mein_stand()` → saison = `kronen_saison_heute()`, kronen 0, stufe 0.
  2. A darf `kronen_stand`, `kronen_buchungen`, `kronen_schalter` weder lesen noch schreiben (`insufficient_privilege` erwartet).
  3. anon darf `kronen_mein_stand()` nicht aufrufen.
  4. "Saisongrenze": Testhilfe `pg_temp.setze_saison(uid, nr, kronen)` (security definer) setzt A auf Saison-1 mit 1750 Kronen → `kronen_mein_stand()` liefert 1400, `kronen_archiv` hat die Zeile (1750, Stufe 17), Buchung `saison` genau einmal; zweiter Aufruf bucht nichts.
- [ ] **Step 5:** `node tests/kronen-vertrag.test.mjs` → ok. SQL im PGlite-Pruefer laufen lassen (wie bei `online-rls-test.sql`, Scratchpad); Erwartung: kein Fehler, letzte Zeile `ROLLBACK`.
- [ ] **Step 6:** Commit `Kronen: Schema, Rueckweg und Rechtetest`.

### Task 3: Online-Ergebnis bucht Kronen und Elo

**Files:**
- Modify: `supabase/kronen-schema.sql`, `supabase/kronen-rls-test.sql`, `tests/kronen-vertrag.test.mjs`

**Interfaces:**
- Consumes: `partien_online` (`supabase/online-schema.sql:81`), `kronen_stand`, `kronen_buchungen`.
- Produces:
  - `alter table partien_online add column if not exists gewertet boolean not null default false` (nur Partien aus der Gegnersuche, Task 4; Einladungs-Partien unter Freunden bleiben ohne Kronen)
  - Trigger `kronen_nach_partie` `after update of status on partien_online for each row when (new.status = 'beendet' and old.status <> 'beendet' and new.gewertet and new.ergebnis is not null)` → Funktion `kronen_bei_partie_ende()`
  - Buchung je Spieler mit `quelle='online'`, `ref = partie.id::text`, Delta aus `kronenFuer('online', …)` ueber `bucheKronen`-Logik (Boden), Elo nach Standardformel K=32 (`elo_n < 15`: K=40) fuer beide.

- [ ] **Step 1: Failing SQL-Abschnitte** in `kronen-rls-test.sql`:
  - "Online-Sieg": gewertete Partie A (weiss) gegen B endet `1-0` → A +30, B -15 aber nicht unter 0, Elo A steigt, B sinkt, Summe der Elo-Aenderung 0 (bei gleicher n-Klasse).
  - "Nur einmal": zweites `update ... set status='beendet'` und erneuter Trigger-Lauf → Buchungen je Spieler weiter genau 1.
  - "Abgebrochen": `ergebnis null`, `grund 'abgebrochen'` → keine Buchung, Elo unveraendert.
  - "Ungewertet": `gewertet = false` (Einladungs-Partie) → keine Buchung.
  - "Remis": `1/2-1/2` → beide +10.
- [ ] **Step 2:** Vertragstest um "Trigger `kronen_nach_partie` existiert und prueft `new.gewertet`" erweitern → FAIL.
- [ ] **Step 3:** Spalte, Trigger-Funktion und Trigger schreiben; Buchung per `insert ... on conflict (user_id, quelle, ref) do nothing` und nur bei echtem Insert `kronen_stand` aendern.
- [ ] **Step 4:** Vertragstest + PGlite-Lauf → ok.
- [ ] **Step 5:** Commit `Kronen: Online-Ergebnis bucht Kronen und Elo auf dem Server`.

### Task 4: Gegnersuche mit Bot nach 10 Sekunden

**Files:**
- Modify: `supabase/kronen-schema.sql`, `supabase/kronen-rls-test.sql`, `js/online.js:146`, `js/pakete/lobby/index.js`, `js/ui/lobby.js:129-160`, `js/pakete/lobby/texte.js`
- Create: `js/kronen.js`
- Test: `tests/lobby.test.mjs`, `tests/kronen-vertrag.test.mjs`

**Interfaces:**
- Produces (SQL):
  - `suche_warteschlange (user_id uuid pk references auth.users on delete cascade, zeit text not null check (zeit ~ '^[0-9]{1,3}\+[0-9]{1,2}$'), elo int not null, seit timestamptz not null default now())`
  - `online_suche_start(zeit text) returns jsonb`: sucht unter `for update skip locked` den aeltesten Wartenden mit gleicher `zeit` und `abs(elo - eigene) <= 200 + 50 * Sekunden_gewartet` `// [E]`; gefunden → legt `partien_online` mit `gewertet = true`, `status = 'laeuft'`, Farben zufaellig an, loescht beide Zeilen, liefert `{ partie: uuid }`; sonst eigene Zeile anlegen und `{ wartet: true }`.
  - `online_suche_stand() returns jsonb`: `{ partie }` wenn man inzwischen gepaart wurde (letzte gewertete laufende Partie mit eigener Beteiligung juenger als 60 s), sonst `{ wartet: true }`.
  - `online_suche_ende() returns void`: eigene Zeile loeschen (Abbruch oder Bot-Ersatz).
  - Zeilen aelter als 2 Minuten raeumt `online_suche_start` mit weg.
- Produces (JS, `js/kronen.js`):
  - `holeStand() -> Promise<{saison,kronen,stufe,boden,naechste}>` (ruft `kronen_mein_stand`)
  - `suche(zeit: string, { warteMs = 10000, alleMs = 1000, beiTreffer, beiBot }) -> { stopp(): void }`; ruft `online_suche_start`, fragt `online_suche_stand` alle `alleMs`; nach `warteMs` ohne Treffer `online_suche_ende` und dann `beiBot()`; nach einem Treffer nie mehr `beiBot`.
  - `BOT_ERSATZ_MS = 10000`
- `js/online.js`: `export async function rpc(name, daten)` (heute ohne export).
- Lobby: `ui/lobby.js` nutzt `suche` statt der reinen Vorschau; `beiBot` startet wie heute `passenderBot(...)` und setzt in der Partie die Kennzeichnung `ki: true`, die Spielerleiste zeigt das Abzeichen mit `t('p-lobby.ki')` = "KI-Gegner" / "AI opponent".

- [ ] **Step 1: Failing SQL-Abschnitte** in `kronen-rls-test.sql`: "Paarung" (A sucht `3+2`, B sucht `3+2` → genau eine Partie mit `gewertet`, Warteschlange leer), "andere Zeit" (A `3+2`, B `10+0` → beide warten), "Elo-Fenster" (Unterschied 600, sofort → keine Paarung), "Abbruch" (`online_suche_ende` → Zeile weg), "Fremde Zeile" (C kann A's Zeile weder sehen noch loeschen).
- [ ] **Step 2: Failing UI-Tests** in `tests/lobby.test.mjs` mit gefaelschtem `fetch` (`setzeOnlineFetch` aus `js/online.js`):
  - `suche: Bot erst nach 10 s` – Fake antwortet immer `{wartet:true}`; nach 9 s kein Bot, nach 10,2 s Partie mit `.ki-abzeichen` und Text "KI-Gegner".
  - `suche: Treffer schlaegt Bot` – Fake liefert nach 3 s `{partie: 'p1'}`; Online-Partie oeffnet, nach 12 s noch kein Bot.
  - `suche: Abbruch ruft online_suche_ende` – Abbrechen-Knopf, Fake hat genau einen Aufruf `online_suche_ende`.
  - `suche: ohne Konto` – keine Sitzung → Hinweis "Zum Suchen anmelden", kein RPC.
- [ ] **Step 3:** `node tests/lobby.test.mjs` → FAIL; Vertragstest → FAIL (neue RPCs fehlen im RLS-Test bzw. Schema).
- [ ] **Step 4:** SQL, `js/kronen.js`, Export in `online.js`, Lobby-Umbau, Texte DE/EN schreiben.
- [ ] **Step 5:** `node tests/lobby.test.mjs`, `node tests/online.test.mjs`, `node tests/online-ui.test.mjs`, `node tests/kronen-vertrag.test.mjs` → alle ok; PGlite-Lauf ok.
- [ ] **Step 6:** Commit `Liga: Gegnersuche auf dem Server, Bot nach 10 Sekunden als KI-Gegner`.

### Task 5: Bot-Ergebnis an den Server melden

**Files:**
- Modify: `supabase/kronen-schema.sql`, `supabase/kronen-rls-test.sql`, `js/kronen.js`, `js/pakete/liga/index.js:84-96`
- Test: `tests/liga.test.mjs`, `tests/kronen-vertrag.test.mjs`

**Interfaces:**
- Produces (SQL): `kronen_bot_ergebnis(ref text, ergebnis text, bot_elo int) returns jsonb` → `{ delta, kronen, stufe }` oder `{ fehler: 'KRONEN_GRENZE' | 'KRONEN_EINGABE' }`. Prueft `ergebnis in ('sieg','remis','niederlage')`, `bot_elo between 200 and 3200`, `char_length(ref) between 8 and 64`; zaehlt `quelle='bot'`-Buchungen des Tages (Europe/Berlin) gegen `BOT_TAGESGRENZE`; `on conflict do nothing` auf `(user_id,'bot',ref)`.
- Produces (JS): `meldeBotErgebnis({ partieId: string, ergebnis, botElo }) -> Promise<{delta,kronen,stufe}|null>` in `js/kronen.js`; ohne Konto oder offline `null` ohne Fehler, Meldung wird nicht gespeichert und nicht nachgeholt `// [E]` (siehe offene Entscheidung 6).
- `liga/index.js`: im vorhandenen `partie:beendet`-Hoerer nach `buchePartie` zusaetzlich `meldeBotErgebnis({ partieId: p.id, ergebnis, botElo: bot.elo })`, nur wenn `wertet(p)` und Bot in `LEITER` oder Bot-Ersatz (`p.ki === true`).

- [ ] **Step 1: Failing SQL-Abschnitte**: "Bot-Sieg" (+15), "Bot-Doppelt" (gleiche `ref` zweimal → eine Buchung), "Bot-Grenze" (11. Meldung am Tag → `KRONEN_GRENZE`, Stand unveraendert), "Bot-Eingabe" (`bot_elo 9999` → `KRONEN_EINGABE`), "anon" (kein Aufruf).
- [ ] **Step 2: Failing Node-Test** in `tests/liga.test.mjs`: `liga meldet Bot-Sieg an den Server` – Fake-`fetch` faengt `/rest/v1/rpc/kronen_bot_ergebnis` ab; nach gewerteter Leiter-Partie genau ein Aufruf mit `{ref: partieId, ergebnis: 'sieg', bot_elo: <elo>}`; ungewertete Partie (Hinweis-Modus) → kein Aufruf; Fake wirft Netzfehler → keine Ausnahme, lokale Liga trotzdem gebucht.
- [ ] **Step 3:** Run → FAIL.
- [ ] **Step 4:** Implementieren.
- [ ] **Step 5:** `node tests/liga.test.mjs`, Vertragstest, PGlite → ok.
- [ ] **Step 6:** Commit `Kronen: Bot-Ergebnis mit Tagesgrenze auf dem Server`.

### Task 6: Start-Liga fuer Bestandsspieler

**Files:**
- Modify: `supabase/kronen-schema.sql`, `supabase/kronen-rls-test.sql`, `js/kronen.js`
- Test: `tests/kronen.test.mjs` (Client mit Fake-fetch), Vertragstest

**Interfaces:**
- Produces (SQL): `kronen_start(elo int) returns jsonb`: nur wenn `start_gesetzt = false` und noch keine `online`-/`bot`-Buchung; setzt `kronen = startKronenAusElo(elo)` (SQL-Gegenstueck, Elo auf `[400, 2800]` begrenzt), `boden` = Stufenboden, `elo` = Eingabe, `start_gesetzt = true`, Buchung `quelle='start'`, `ref='start'`. Sonst `{ fehler: 'KRONEN_START_VORBEI' }` ohne Aenderung.
- Produces (JS): `setzeStartLiga() -> Promise<void>`: liest die lokale Elo aus `normalisiereStand(ladeModul('liga')).wertung.wert` (`js/pakete/liga/wertung.js`), ruft `kronen_start` genau einmal je Geraet (Merker `kronen:start-gemeldet` im Modul-Speicher), wird bei `app:bereit` und `app:sichtbar` (Ereignisse aus `js/app.js`, gehoert in `js/pakete/liga/index.js`) aufgerufen, sobald `sitzung()` aus `js/konto.js` eine Sitzung liefert; ein eigenes Anmelde-Ereignis gibt es heute nicht.
- Funken und Level: unveraendert (Level bleibt laut 10b); die alten Liga-Punkte der lokalen Saison werden nicht mehr angezeigt, bleiben aber gespeichert.

- [ ] **Step 1: Failing**: SQL "Start einmal" (1450 → 900 Kronen, zweiter Aufruf `KRONEN_START_VORBEI`), "Start nach Partie" (nach einer Bot-Buchung → `KRONEN_START_VORBEI`), "Start-Grenze" (99999 → wie 2800 → 1200, nie Krone). Node: `setzeStartLiga sendet lokale Elo einmal` (zwei Aufrufe → ein RPC).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implementieren. **Step 4:** Run → ok.
- [ ] **Step 5:** Commit `Kronen: Start-Liga aus der vorhandenen Elo`.

### Task 7: Startseite zeigt Kronen

**Files:**
- Modify: `js/ui/heim.js:67-83` (`ligaLage`), Texte in `js/ui/heim.js` bzw. `js/pakete/liga/texte.js`, `css/heim.css` nur falls noetig (nur Tokens)
- Test: `tests/heim.test.mjs`, `tests/fairness.test.mjs` (unveraendert, muss gruen bleiben)

**Interfaces:**
- Consumes: `holeStand()` (Task 4), `stufeVon()` (Task 1).
- Produces: `kronenLage(stand | null) -> { kronen, stufe: 0..17, liga, rang, naechste: number|null, fehlt, anteil: 0..1, ohneKonto: boolean }` (rein, exportiert, ersetzt `ligaLage` in der Anzeige; `ligaLage` bleibt fuer die Arena). Ring zeigt Kronen-Zahl mit Kronen-Symbol (`icon('krone')`), darunter `Gold II` / `Gold II`, Anteil bis zur naechsten Stufe. Erst lokal gemerkter letzter Stand (`kronen:letzter` im Modul-Speicher) sofort zeichnen, dann Server-Stand nachladen.

- [ ] **Step 1: Failing tests** in `tests/heim.test.mjs`:
  - `kronenLage(null)` → `{kronen: 0, stufe: 0, liga: 'holz', rang: 3, ohneKonto: true, anteil: 0}`.
  - `kronenLage({kronen: 1750, ...})` → `naechste: null, anteil: 1`.
  - Browser: Fake-fetch liefert `{kronen: 640, stufe: 6, ...}` → Ring-Text enthaelt `640` und `Silber III`; kein `NaN`, kein `undefined` im Text.
  - Browser ohne Sitzung: Ring zeigt `0` und den Hinweis "Mit Konto sammelst du Kronen" (EN "Sign in to collect crowns"), keine Konsolenfehler.
  - Browser offline (Fake wirft): letzter gemerkter Stand wird gezeigt.
- [ ] **Step 2:** `node tests/heim.test.mjs` → FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** `node tests/heim.test.mjs`, `node tests/fairness.test.mjs`, `node tests/thema.test.mjs` → ok; `BROWSER=webkit node tests/heim.test.mjs` → ok.
- [ ] **Step 5:** Commit `Startseite: Ring zeigt Kronen und Liga-Stufe`.

### Task 8: Tageszaehler (gebaut, AUS)

**Files:**
- Modify: `supabase/kronen-schema.sql`, `supabase/kronen-rls-test.sql`
- Create: `js/zaehler.js`
- Test: `tests/kronen.test.mjs` (Client-Teil), Vertragstest

**Interfaces:**
- Produces (SQL):
  - `zaehler_tag (tag date not null, schluessel text not null check (schluessel ~ '^[a-z0-9_.-]{1,48}$'), wert bigint not null default 0, primary key (tag, schluessel))` – KEINE Nutzer-Spalte.
  - `zaehler_erhoehe(schluessel text, um int default 1) returns boolean`: liefert `false` und schreibt nichts, solange `kronen_schalter.zaehler_an = false`; sonst `um` auf `[1, 1000]` begrenzt, `insert ... on conflict do update set wert = wert + um`, `true`.
  - `zaehler_an() returns boolean` (fuer den Client).
  - Erlaubte Schluessel als feste Liste in der Funktion: `suche.wartezeit_s`, `suche.ki_gegner`, `suche.mensch`, `kronen.online`, `kronen.bot` (weitere kommen mit ihren Etappen) `// [E]`.
- Produces (JS, `js/zaehler.js`): `zaehle(schluessel: string, um = 1) -> void` – fragt `zaehler_an` einmal pro Sitzung, sendet sonst nichts; nie mit Nutzerdaten im Koerper ausser Schluessel und Zahl; Fehler werden geschluckt.
- Aufrufer in Task 4 (`suche`: Wartezeit in Sekunden, `ki_gegner` oder `mensch`).

- [ ] **Step 1: Failing**: SQL "Zaehler aus" (Aufruf → `false`, `zaehler_tag` leer), "Zaehler an" (Testhilfe setzt Schalter → zweimal `suche.ki_gegner` → `wert = 2`, eine Zeile, keine Spalte mit `user`), "unbekannter Schluessel" (→ `false`), "Nutzer liest nicht" (A darf `zaehler_tag` nicht lesen). Node: `zaehle sendet nichts, wenn der Server aus sagt` (Fake: `zaehler_an → false`, danach kein `zaehler_erhoehe`). Vertragstest: Schema hat `zaehler_an boolean not null default false`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implementieren. **Step 4:** Run → ok.
- [ ] **Step 5:** Commit `Zaehler: Tagessummen ohne Personenbezug, bis zur Rechtspruefung aus`.

### Task 9: Anleitung, Service Worker, Gesamtlauf

**Files:**
- Modify: `supabase/ANLEITUNG.md` (neuer Abschnitt nach "Freunde und Freunde-Rangliste"), `tests/alle.mjs` (Suiten `kronen`, `kronen-vertrag`), `sw.js` (`DATEIEN`: `js/kronen.js`, `js/zaehler.js`, `js/pakete/liga/kronen.js`; VERSION/STAND per `node tests/sw.test.mjs --aktualisieren` im LF-Baum)

- [ ] **Step 1:** Abschnitt "Liga mit Kronen (Stand <Datum>)": Reihenfolge `online-schema.sql` vorhanden → `kronen-schema.sql` einspielen → `kronen-rls-test.sql` laufen lassen (Erwartung: kein Fehler, endet mit Rollback) → Rueckweg `kronen-zurueck.sql` (loescht Kronen-Daten, nur nach Sicherung) → Hinweis: Zaehler bleibt aus, Schalter erst nach Rechtspruefung und Datenschutz-Absatz.
- [ ] **Step 2:** `node tests/alle.mjs --schnell` → Zusammenfassung ohne Fehler (WebKit-Klangpruefungen in `board`, die schon auf dem Ausgangsstand rot sind, gesondert benennen, nicht verschweigen).
- [ ] **Step 3:** Commit `Liga mit Kronen: Anleitung, Service Worker, Testliste`.

---

## Offene Entscheidungen fuer Flo

Diese Punkte hat der Plan nicht geraten, sondern mit `// [E]` als Vorschlag markiert. Bis Flo entscheidet, gilt der Vorschlag.

1. **Kronen je Ergebnis:** Vorschlag Mensch Sieg +30, Remis +10, Niederlage -15; Bot Sieg +15, Remis +5, Niederlage 0. Sollen Niederlagen ueberhaupt Kronen kosten (nie unter den Boden der erreichten Stufe)?
2. **Kronen je Stufe:** Vorschlag 100 je Stufe, Krone I ab 1700. Damit braucht ein Spieler ohne Niederlagen etwa 57 Online-Siege bis Krone I.
3. **"Ein Stueck zurueck" am Saisonende:** Vorschlag 3 Stufen (eine ganze Liga), auf den Boden der Zielstufe.
4. **Start der ersten Saison:** Vorschlag Montag 30.11.2026, danach alle 28 Tage.
5. **Bot-Tagesgrenze:** Vorschlag 10 gewertete Bot-Ergebnisse pro Tag (gegen Kronen-Farmen gegen schwache Bots).
6. **Ohne Konto:** Kronen gibt es nur mit Konto, Bot-Siege ohne Konto werden nicht nachgebucht. Oder lokal sammeln und bei der Anmeldung einmal uebertragen (leichter zu faelschen)?
7. **Freundes-Partien:** Vorschlag: Partien ueber Einladungscode geben keine Kronen (nur die Gegnersuche), damit sich niemand Siege zuschiebt.
8. **Elo-Fenster der Gegnersuche:** Vorschlag +-200, alle 1 s um 50 breiter; nach 10 s Bot. Passt das, oder lieber laenger auf Menschen warten?
9. **Saison-Belohnungen** (Rahmen, Abzeichen, Banner je Liga): Der Plan speichert nur das Saison-Archiv; die Belohnungen selbst kommen mit Etappe 4b. Einverstanden?
10. **Rechtspruefung Zaehler:** Der Schalter `zaehler_an` bleibt aus. Freigabe erst nach Pruefung (§ 25 TDDDG, DSGVO) und Absatz in der Datenschutzerklaerung.

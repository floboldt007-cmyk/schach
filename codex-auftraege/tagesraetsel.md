# Auftrag für Codex: Paket „Tagesrätsel“ mit eigenen Rätseln

Die gemeinsamen Regeln stehen in `codex-auftraege/REGELN-CODEX.md` und gelten vollständig. Zusätzlich gilt hier:

- **Arbeitszweig:** `codex/tagesraetsel`. **Pull Request gegen `claude/integration`.**
- **Voraussetzung:** Welle A ist im Sammelzweig, also der Rätsel-Bildschirm `js/ui/raetsel.js` mit
  `registriereRaetselQuelle` und das Paket `kartei`. Fehlt `js/ui/raetsel.js`, brich ab und schreib das in den PR.
- **Keine fremden Rätsel.** Nichts aus der Lichess-Datenbank, nichts von chess.com, keine Rätsel aus Büchern. Alle
  Stellungen entstehen hier: aus Partien der App-Bots gegeneinander oder als eigene Lehr-Stellungen. Gemeinfreie
  Studien (vor 1900, Urheber seit über 70 Jahren tot) sind erlaubt, mit Quelle.

## Was es schon gibt

- `js/ui/raetsel.js`: Bildschirm für Aufgaben `{ id, fen, loesung: [uci, ...], vorZug?, titel?, text?, hinweis?,
  erklaerung? }`. Lies den Kopfkommentar ganz.
- `js/tag.js`: Tagesgrenze 4:00 (`tagSchluessel`). `js/ereignisse.js`: `raetsel:geloest` zählt für die Serie (P3).
- `vendor/stockfish` läuft im Browser als Worker. `tests/engine-bots.test.mjs` zeigt, wie Node über Playwright damit
  rechnet.
- Konzept: `design/runde4/SPIELKONZEPT.md` 3.6 (Tagesrätsel, Fair zählen), 3.10 (Feier-Budget), 5 (Fairness).

## Was zu tun ist

1. **Rätsel-Fabrik** `werkzeuge/raetsel-fabrik.mjs` (Node, Playwright, Stockfish aus `vendor/`):
   - Quellen:
     - Partien der App-Bots gegeneinander, mit festem Seed, damit jeder Lauf dieselben Rätsel liefert
     - eigene Lehr-Stellungen in `daten/raetsel/eigene.json`
   - Ein Kandidat zählt, wenn alles davon stimmt:
     - Die Stellung ist legal.
     - Der beste Zug ist eindeutig: Stockfish mit zwei Linien, Abstand zum zweitbesten mindestens 0,15 Gewinnchance.
     - Die Lösung hat 1 bis 4 eigene Züge.
     - Am Ende steht Matt oder ein gehaltener Gewinn von mindestens 2 Bauerneinheiten.
   - **Motiv** nur, wenn eine einfache geometrische Prüfung sicher ist: Gabel, Fesselung, Spieß, Abzug,
     Grundreihenmatt, Matt in n. Sonst `motiv: null`.
   - **Stufe 1 bis 7** aus Lösungslänge, Zahl der plausiblen Fehlzüge und der Stärke der Bots in der Partie. Es gibt
     keine fremden Wertungen.
   - Ausgabe: `daten/raetsel/tagesraetsel.json` mit mindestens 120 Tagen, je Tag ein Rätsel. Das Format ist eine
     Aufgabe wie oben plus `motiv` und `stufe`. Die Wochenkurve: Montag Stufe 1 bis 2, dann jeden Tag schwerer bis
     Samstag Stufe 6 bis 7, Sonntag ein zweiteiliges Rätsel.
   - Die Fabrik ist deterministisch. Ein zweiter Lauf liefert dieselbe Datei.
2. **Paket** `js/pakete/tagesraetsel/` (nur Orte, Ereignisse, Register und der Modul-Speicher `tagesraetsel`):
   - Quelle `tagesraetsel` für `registriereRaetselQuelle`. Das Rätsel des Tages kommt aus dem Datum: für alle gleich,
     Grenze 4:00.
   - Ein Eintrag am Ort `training:karten`, dazu eine Zeile an `arena:heute`, die zum Rätsel führt.
   - Nach dem Lösen die Frage „Ein Wort“: drei Wörter zur Wahl. Die zwei falschen sind Motive, die das Rätsel nicht
     hat. Nur bei Rätseln mit `motiv`.
   - Text zum Teilen ohne Link und ohne Lösung, Form wie in 3.6, aber eigener Name „Crownmate · Rätsel 291“.
   - Archiv der letzten 30 Tage. Das Archiv zählt nicht als Lösung des Tages.
   - Fehlversuche ohne Abzug, keine Uhr. `raetsel:geloest` senden.
   - Speicher mit Rechenstand-Nummer. Alte und kaputte Stände bleiben gültig. `MODUL_BUDGET` nur erweitern.
   - In den Einstellungen unter Quellen: „Eigene Rätsel, mit Stockfish geprüft“.
3. **Tests** `tests/tagesraetsel.test.mjs`:
   - Node-Teil:
     - Jedes Rätsel der Datei ist legal, die Lösung ist spielbar.
     - Die IDs sind eindeutig.
     - Die Wochenkurve stimmt.
     - Der Tageswechsel um 4:00 stimmt (3:59 gehört zum Vortag).
     - Der Speicher hat einen Rechenstand, alte und kaputte Stände bleiben gültig.
   - Browser-Teil (`?test&erw=pakete/tagesraetsel/index`):
     - Karte, Lösen, „Ein Wort“ und Teilen-Text, hell und dunkel, iPad quer (1180 x 820) und Handy hoch (390 x 844).
   - Die Suite kommt in `tests/alle.mjs`, ein kurzer Absatz in `ARCHITEKTUR.md`.
   - Danach `node tests/sw.test.mjs --aktualisieren`.
4. **Nicht editieren:** `js/ui/partie.js`, `js/ui/arena.js`, `js/board.js`, `js/ui/raetsel.js`, `css/app.css`,
   `css/arena.css`. Fehlt dir ein Ort oder Ereignis, schreib die genaue Lücke unter „Offen“.

## Ausdrücklich später (nicht in diesem Auftrag)

- „Fair zählen“ mit Stockfish im Gerät (ein anderer, gleich starker Zug gilt auch). Wenn es sich ohne Änderung an
  `js/ui/raetsel.js` nicht machen lässt, schreib die genaue Lücke unter „Offen“.
- Grundpool, Treppenlauf und Lernpfad (3.5). Dafür kommt ein eigener Auftrag.

## Grün sein müssen

- `node tests/tagesraetsel.test.mjs`
- `node tests/fairness.test.mjs`, `node tests/ereignisse.test.mjs`, `node tests/storage.test.mjs`
- `node tests/sw.test.mjs`
- am Ende `node tests/alle.mjs` oder die CI des PR (Jobs `chromium` und `webkit`)

## PR-Text

Wie in `REGELN-CODEX.md`. Unter „Offen“ zusätzlich:
- wie viele Kandidaten die Fabrik geprüft und wie viele sie behalten hat
- welche Motive die Prüfung sicher erkennt
- was aus 3.6 noch fehlt

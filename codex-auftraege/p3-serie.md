# Auftrag für Codex: Paket 3 „Serie“ fertigstellen (Bauernmarsch und Siegeslauf)

Flo hat entschieden, dass Codex dieses Paket fertig baut. Die gemeinsamen Regeln stehen in
`codex-auftraege/REGELN-CODEX.md` und gelten vollständig. Abweichend davon gilt hier:

- **Arbeitszweig:** `codex/p3-serie`. **Pull Request gegen `claude/integration`.**
- Auf diesem Zweig liegen schon die fertigen und geprüften Pakete **Funken** (P1, `js/pakete/funken/`) und
  **Punkte** (P2, `js/pakete/punkte/`, Screen `js/ui/bestenliste.js`) sowie die **Liga** (P4, `js/pakete/liga/`).
  Diese drei nicht ändern. Fällt dir dort ein Fehler auf, schreib ihn unter „Offen“ in den PR-Text.
- Funken und Punkte stehen noch **nicht** in `PAKETE` (`js/erweiterungen.js`). Das macht Claude bei der Zusammenführung.
  Die Liga steht schon drin. Serie trägst du ebenfalls **nicht** in `PAKETE` ein; deine Tests laden das Paket über
  `?test&erw=pakete/serie/index`.

## Was es schon gibt

Ein Claude-Agent hat Serie zu großen Teilen gebaut und wurde dann vom Sitzungslimit gestoppt:

- `js/pakete/serie/`: `tag.js` (Tageslogik), `lauf.js` (Siegeslauf), `stand.js` (Speicher), `ansicht.js`,
  `index.js` (Einstieg). `css/pakete/serie.css`.
- Ereignis `serie:geaendert` in `js/ereignisse.js` und in `tests/ereignisse.test.mjs`.
- `tests/serie.test.mjs`: der Node-Teil ist grün (`node tests/serie.test.mjs --nur-node`: 120/120). Der Browser-Teil
  ist geschrieben, aber nie gelaufen.
- Der letzte Commit „Serie: Zwischenstand“ enthält unfertige Änderungen (Ansicht, CSS, `tests/fairness.test.mjs`).
  Prüfe sie, bevor du darauf aufbaust.

## Was zu tun ist

1. **Lesen:** `design/runde4/SPIELKONZEPT.md` Abschnitte 1, 2.2, 3.1, 3.10, **3.14 (Bauernmarsch)**, **3.15
   (Siegeslauf)**, 3.18 und 5 (Fairness). Dazu `ARCHITEKTUR.md` Teil „Runde 4: Erweiterungspunkte“ und die Kopfkommentare
   von `js/erweiterungen.js`, `js/orte.js`, `js/ereignisse.js`, `js/feier.js`, `js/storage.js` (Modul-Speicher),
   `js/ui/abrechnung.js` und `js/tag.js`.
2. **Gegen das Konzept prüfen:** Jede Regel aus 3.14 und 3.15 ist umgesetzt und hat mindestens eine Prüfung. Fehlt
   etwas, baue es nach. Wichtig sind vor allem diese Punkte:
   - Tagesgrenze 4:00: Eine Partie um 3:59 zählt zum Vortag.
   - Lücken, Ruhetage und Schutz: Die Serie zerbricht nie mit einem Schuldgefühl-Text.
   - Meilensteine, Umwandlung am Ende der Strecke.
   - Siegeslauf-Grenzen: Zeitreisen dürfen nichts kaputt machen.
3. **Browser-Teil von `tests/serie.test.mjs` grün machen** gegen die echte App (`?test&erw=pakete/serie/index`). Er
   prüft diese Orte und Momente:
   - Heute-Karte an `arena:heute`
   - Chip an `arena:kopf` (Tagzahl, ab 3 Siegen in Folge die Flamme)
   - Abrechnungszeile an `ergebnis:abrechnung` (nur beim ersten Tageswerk)
   - Meilenstein-Moment über `feier.melde`: Den Speicher so vorbereiten, dass die nächste Partie den Meilenstein
     erreicht.

   Das Ganze hell und dunkel, iPad quer (1180 x 820) und Handy hoch (390 x 844).
4. **Harte Paket-Regeln:**
   - Nur über Orte, Ereignisse, Register (`registriereKlang`, `registriereIcon`) und den Modul-Speicher `serie`
     einhängen.
   - **Nicht editieren:** `js/ui/partie.js`, `js/ui/arena.js`, `js/board.js`, `js/ui/einstellungen.js`,
     `js/ui/verlauf.js`, `js/ui/analyse.js`, `css/app.css`, `css/partie.css`, `css/arena.css`.
   - Fehlt dir ein Ort oder Ereignis, schreib die genaue Lücke unter „Offen“ (Name, wo, warum).
   - **Zahlenruhe (3.1):** drei Hauptzahlen, den Rest auf Antippen.
   - **Feier-Budget (3.10):** ein großer Moment, drei Zeilen je Partie.
   - **Während der Partie hat das Brett Vorrang.**
   - Alles im Modul-Speicher hat eine Rechenstand-Nummer. Alte und kaputte Speicherstände bleiben gültig.
5. **Eintragen:**
   - Suite `serie` in `tests/alle.mjs`
   - kurzer Absatz „P3 Serie“ in `ARCHITEKTUR.md` (Orte, Ereignis, Speicherform, Rechenstand), hinten im Abschnitt
     Runde 4 anhängen
   - `MODUL_BUDGET` in `js/storage.js` nur erweitern, falls `serie` fehlt
   - danach `node tests/sw.test.mjs --aktualisieren` und `node tests/sw.test.mjs`
6. **Grün sein müssen:**
   - `node tests/serie.test.mjs`
   - `node tests/fairness.test.mjs` (prüft Texte)
   - `node tests/ereignisse.test.mjs`
   - `node tests/storage.test.mjs`
   - `node tests/app.test.mjs --erweiterungen`
   - am Ende `node tests/alle.mjs` (oder die CI des PR, Jobs `chromium` und `webkit`)

## PR-Text

Wie in `REGELN-CODEX.md`. Unter „Offen“ bitte auch: Was aus 3.14/3.15 bewusst noch fehlt und warum.

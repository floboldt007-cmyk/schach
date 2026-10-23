# Auftrag für Codex: Paket 4 „Liga“ (Arena-Wertung, Spielklasse, Saison-Liga mit Saison-Reset)

Stand 23.10.2026. Auftraggeber ist der Besitzer Flo, den Auftrag geschrieben hat Claude Code. Danach prüft Claude
den Pull Request.

## Rahmen

- **Arbeitszweig:** `codex/p4-liga`. Dieser Zweig ist schon angelegt, er enthält diese Datei.
- **Basis:** `claude/integration`. Das ist der Stand von `main` plus Weltkarte (U5), Brett (U6), Partie und Handy (U7),
  Online, Daten und App-Hülle.
- **Pull Request:** gegen `claude/integration`, nicht gegen `main`.
- Nie auf `main` oder `claude/*` pushen (`AGENTS.md`). Deutsch in Oberfläche, Kommentaren und Commits. In
  Code-Kommentaren und Commit-Nachrichten stehen Umlaute als ae/oe/ue/ss, in Oberflächentexten echte Umlaute.
- Parallel bauen Claude-Agenten die Pakete Funken (P1), Punkte (P2) und Serie (P3) auf einem anderen Zweig. Fasse
  deren Dateien nicht an und lege keine eigenen Dateien mit diesen Namen an.

## Erst lesen

1. `AGENTS.md`, `design/runde4/ENTSCHEIDUNGEN.md`.
2. `design/runde4/SPIELKONZEPT.md`:
   - **3.4 Arena-Wertung und Spielklasse** (komplett)
   - 2.2 (Meta-Schleife, Saison = 12 Wochen)
   - 2b.2 (Vereinsmeisterschaft: kein Abstieg, die besten Partien zählen)
   - 3.1 (Zahlenruhe), 3.10 (Feier-Budget), 3.12, 3.13 (Rekordbuch mit Rechenstand)
   - 5 (Fairness)
3. Paket-Architektur, bitte vollständig lesen:
   - `js/erweiterungen.js`: Kopfkommentar, `PAKETE`. Dort trägst du `'pakete/liga/index'` ein.
   - `js/orte.js`: `ORTE`, `anbieten(ort, fn, { reihenfolge, paket })`
   - `js/ereignisse.js`: `EREIGNISSE`, `hoere`, `sende`. Ein neues Ereignis trägst du in die Liste ein.
   - `js/feier.js`: `melde`, Budget von höchstens 1 großen Moment und 3 Zeilen je Partie
   - `js/storage.js`: Modul-Speicher `schach-arena:v1:modul:<name>`, `MODUL_BUDGET`, darin ist `liga: 10000` schon
     vorhanden. Ab etwa Zeile 850 steht die API der Modul-Einstellungen.
   - `js/ui/abrechnung.js`: `anbieterAbrechnung`, `ABRECHNUNG_MAX`
   - `js/tag.js`: Tagesgrenze 4:00 Uhr, `tagSchluessel`, `wochenSchluessel`, `kalenderwoche`. **Nie** `toISOString`
     für Tage verwenden.
   - Register: `registriereKlang` in `js/sounds.js` (vorhanden sind `level` und `rekord`), `registriereIcon` in
     `js/ui/icons.js`
   - `ARCHITEKTUR.md`: Abschnitte zu Paketen, Orten und Bühne
   - `tests/app.test.mjs`, Teil `--erweiterungen`: zeigt mit einem Test-Paket per `page.route`, wie jeder Ort bedient
     wird. Nimm das als Vorlage für deinen Browser-Test.

## Harte Regeln

- **Nur über Orte, Ereignisse, Register und Modul-Speicher einhängen.**
- **Nicht editieren:** `js/ui/partie.js`, `js/ui/arena.js`, `js/ui/duell.js`, `js/board.js`, `js/ui/einstellungen.js`,
  `js/ui/verlauf.js`, `js/ui/analyse.js`, `css/app.css`, `css/partie.css`, `css/arena.css`.
  Fehlt ein Ort oder ein Ereignis, baue so weit wie möglich und nenne die Lücke im PR-Text (Name, wo, warum).
- **Erlaubt in gemeinsamen Dateien:**
  - `js/erweiterungen.js`: nur der Eintrag in `PAKETE`
  - `js/ereignisse.js`: nur der neue Name
  - `sw.js`: nur über `node tests/sw.test.mjs --aktualisieren`
  - `tests/alle.mjs`: Suite `liga` eintragen
  - `ARCHITEKTUR.md`: ein Absatz
- **Paket-Dateien:**
  - `js/pakete/liga/index.js` ist der Einstieg. Er arbeitet defensiv: Ein Fehler im Paket darf die App nie stoppen.
  - Die Formeln liegen rein in `js/pakete/liga/wertung.js` (ohne DOM).
  - Das CSS liegt in `css/pakete/liga.css`. Es nutzt nur Tokens aus `css/tokens.css` und `css/themes/modern.css`, hell
    und dunkel. `tests/thema.test.mjs` prüft die Lint-Regeln.
- **Zahlenruhe:**
  - Im Kopf der Arena gibt es höchstens drei Hauptzahlen: Sterne, Level und Serie.
  - Die Liga bekommt deshalb **keinen eigenen Chip** in `arena:kopf`. Sie steht in der Saison-Karte an
    `arena:panel-oben`.
  - Während der Partie hat das Brett Vorrang: Über dem Brett erscheint nichts aus der Liga.
- **Fairness:**
  - keine Druck- oder Schuldgefühl-Texte
  - nichts läuft davon
  - kein Kauf
  - **niemals Verlust** von Level, Funken, Spielklasse oder Wertung
- **Feier:** Momente nur mit Beleg, Klang über das Register, Federn über `js/bewegung.js`, Look A ohne Neon und ohne
  Konfetti. Bewegung „aus“ und `prefers-reduced-motion` werden respektiert.
- **Speicherformat:**
  - Alte Spielstände bleiben gültig.
  - Alles liegt im Modul-Speicher und trägt eine Rechenstand-Nummer (`stand: 1`), damit sich Formeln später
    nachrechnen lassen.
- **Repo-Regeln:** Nichts von chess.com oder Lichess kopieren, also keine Texte, Namen oder Grafiken. Keine Preise,
  keine persönlichen Daten, keine Zugangsdaten.

## Was gebaut wird

1. **Arena-Wertung** (`wertung.js`, rein):
   - Elo gegen die Bot-Stärke (`js/bots.js`, Feld `elo`).
   - K = 40 in den ersten 15 wertenden Partien, danach 24. Mit Hinweis wird K halbiert.
   - Es werten nur Partien aus der Grundstellung. Prüfe dazu das Feld `wertet` in `partie:beendet` und
     `partie:gestartet`.
   - Unsicherheit `max(50, round(350/√(n+1)))`. Bis 10 Partien gilt die Wertung als „vorläufig“.
   - Blitz zählt getrennt: Grundzeit unter 10 Minuten, also `tempo.grund < 600` (Sekunden) im Partie-Datensatz
     (`js/storage.js`, Kopfkommentar). Ohne `tempo` ist die Partie ohne Uhr und zählt zur normalen Wertung.
   - Startwert 800 als Konstante mit dem Kommentar `[E]` (Platzhalter bis zur Eichung). Rechenstand `1`.
2. **Spielklasse:**
   - Bauern-, Springer-, Läufer-, Turm-, Damen- und Königsklasse.
   - Grenzen 1000, 1200, 1400, 1600 und 1900 (Platzhalter `[E]`).
   - Angezeigt wird immer die höchste je erreichte Klasse.
   - Ein Aufstieg ist erst ab 10 wertenden Partien möglich.
   - Je Klasse gibt es genau einmal einen großen Moment, zum Beispiel „AUFSTIEG: Läuferklasse“, mit Klang `rekord`
     oder `level`.
3. **Saison-Liga (Ranked):**
   - **Ablauf:**
     - Eine Saison dauert 12 Wochen ab einem festen Startmontag.
     - Konstante `SAISON_1_START`: Montag, 19.10.2026, Kalenderwoche 43. Das ist ein Platzhalter, beim Livegang wird
       er angepasst.
     - Gerechnet wird über `js/tag.js`.
     - Angezeigt werden Saison-Nummer und Countdown, zum Beispiel „noch 23 Tage“.
   - **Stufen:**
     - Holz, Bronze, Silber, Gold, Platin, Diamant, Meister.
     - Schwellen: 0, 100, 250, 450, 700, 1000, 1400 Liga-Punkte. Sie stehen als Tabelle im Code, mit Rechenstand `1`.
   - **Liga-Punkte:**
     - Liga-Punkte kommen nur aus wertenden Partien der laufenden Saison.
     - Sieg: +(10 + Bonus nach Bot-Elo relativ zur eigenen Wertung), höchstens +25.
     - Remis: +4. Niederlage: −3.
     - Genauigkeit ab 80 % bringt +2.
     - **Nie unter die Schwelle der erreichten Stufe:** Innerhalb einer Saison gibt es keinen Abstieg.
   - **Saison-Ende (Reset):**
     - Die Stufe kommt ins Saison-Archiv und wird als Abzeichen freigeschaltet, zum Beispiel „Saison 1: Gold“.
     - Die neue Saison startet eine Stufe unter der erreichten, auf deren Schwelle. Meister wird zu Diamant, Holz
       bleibt Holz.
     - Ruhiger Text: „Neue Saison, neue Chance. Dein Level und deine Spielklasse bleiben.“
     - Den Saisonwechsel beim App-Start (`app:bereit`) erkennen und als ruhige Karte melden. Eine laufende Partie wird
       nie unterbrochen.
4. **Vereinsmeisterschaft** (je Saison, gegen die 10 Bots der Leiter):
   - Kreuztabelle „Du gegen die Bots“.
   - Je Bot zählt das beste Ergebnis: Sieg 3 Punkte, Remis 1 Punkt.
   - Keine Frist, keine Drucktexte.
5. **Speicher** im Modul `liga`, innerhalb des Budgets:

   ```js
   {
     stand: 1,
     wertung: { n, wert, blitz: { n, wert } },
     klasse: { erreicht, momente: [] },
     saison: { nr, start, punkte, stufe, partien },
     archiv: [{ nr, stufe, punkte }],
     meisterschaft: { [botId]: bestes }
   }
   ```

   Die vorhandene Prüfung `pruefeLiga` in `js/storage.js` liest das Feld `liga` der Partie, das ist etwas anderes.
   Lass sie unverändert.
6. **Orte:**
   - `arena:panel-oben`, die Saison-Karte:
     - Stufe mit Symbol, Punkte-Balken zur nächsten Stufe und Countdown
     - die Vereinsmeisterschaft kurz, zum Beispiel „7 von 10 Bots geschlagen“
     - die Wertung „≈ 1184 ± 60“ mit Spielklasse
     - Details auf Antippen
   - `ergebnis:abrechnung`: eine Zeile, zum Beispiel „Liga +18 · Gold“, oder die Wertung ±.
   - `verlauf:seite`: Wertungs-Verlauf als Mini-Kurve und das Saison-Archiv.
   - `arena:panel-bot`: die Bilanz gegen diesen Bot, zum Beispiel „Du gegen Rudi: 2 Siege, 1 Remis“. Halte den Platz
     klein, das Paket „Punkte“ zeigt dort ebenfalls eine Zeile.
   - Feier für Liga-Aufstieg und Klassen-Aufstieg, jeweils einmal, innerhalb des Feier-Budgets.
7. **Ereignis** `liga:geaendert` mit `{ wertung, klasse, saison, stufe, aufstieg }`, in `js/ereignisse.js` eingetragen.
8. **Tests** `tests/liga.test.mjs`, eingetragen in `tests/alle.mjs`:
   - **Node-Teil**, deterministisch:
     - Elo-Formel mit Rechenbeispielen, K-Faktor, Unsicherheit, Blitz getrennt
     - Spielklasse sinkt nie, Aufstieg erst ab 10 Partien
     - Liga-Punkte und Schwellen, kein Abstieg in der Saison
     - Saisonwechsel mit Archiv und Reset um eine Stufe
     - Countdown über die Tagesgrenze von 4:00 Uhr
     - Kreuztabelle
   - **Browser-Teil** gegen die echte App (`?test`, Paket per `page.route` wie in `app.test.mjs --erweiterungen`):
     Saison-Karte, Abrechnungszeile, Aufstiegs-Moment, Verlaufskarte, Bot-Bilanz. Er läuft in 1180 × 820 und 390 × 844,
     hell und dunkel.
   - Grün sein müssen:
     - `node tests/sw.test.mjs` nach `--aktualisieren`
     - `node tests/storage.test.mjs`
     - `node tests/fairness.test.mjs` (prüft Texte!)
     - `node tests/thema.test.mjs`
     - `node tests/app.test.mjs --erweiterungen`
   - Geht Playwright in deiner Umgebung nicht, laufen die Browser-Teile in der CI auf GitHub. Sag das dann im PR-Text.
   - **Tests nie abschwächen, überspringen oder löschen.**

## PR-Text

Bitte mit diesen Abschnitten:

- **Was gebaut ist:** Dateien, Orte, Ereignis, Speicherform, Formeln mit Rechenstand
- **Tests:** wörtliche Ergebnisse
- **Offen:** ehrlich, lieber zu viel. Dazu ein Vorschlag, was der Server später braucht: Welt-Tafeln und Saison-Punkte
  je Konto, als Idee für eine Tabelle `saison_punkte`. Nur beschreiben, nicht bauen.
- **Konfliktstellen:** in gemeinsamen Dateien, für die Zusammenführung durch Claude

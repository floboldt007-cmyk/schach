# Crownmate

Schach gegen **30 Bots in fünf Welten**, mit angezeigter Elo von 100 bis 3000 und einem
Endgegner je Welt. Die Live-Bewertung ordnet deine Züge ein und der Coach erklärt sie.
Nach der Partie zeigt die Spielanalyse Genauigkeit, Bewertungskurve, Schlüsselmomente und
bessere Züge zum Durchklicken. Dazu gibt es ein Tagesrätsel und ein Archiv zum Weiterüben.

Die Oberfläche ist auf **Deutsch und Englisch** verfügbar. Ohne eigene Sprachwahl folgt sie
der Sprache des Geräts; in den Einstellungen lässt sie sich ändern.

**Spielen:** https://floboldt007-cmyk.github.io/schach/

Bot-Partien und Spielanalyse laufen direkt auf deinem Gerät, auch ohne Internet.
Deine Partien und Sterne werden im Browser gespeichert.

## Auf dem iPad installieren

Voraussetzung ist **iPadOS 16.4 oder neuer** (Stockfish braucht WebAssembly mit SIMD). Auf einem
älteren iPad sagt die App beim Start Bescheid; das Update gibt es unter Einstellungen → Allgemein →
Softwareupdate.

1. Den Link oben in **Safari** öffnen.
2. Auf **Teilen** tippen (das Quadrat mit dem Pfeil nach oben).
3. **Zum Home-Bildschirm** wählen und mit **Hinzufügen** bestätigen.
4. Ab jetzt startet Crownmate über das App-Icon wie eine normale App,
   ohne Adressleiste. Nach dem ersten Start klappt das auch im Flugmodus.

Gut zu wissen:
- Spiel am besten **immer über das Icon**. Die App vom Home-Bildschirm hat auf dem iPad ihren
  eigenen Speicher, getrennt vom Safari-Tab: Was du im Tab spielst, wird nicht übernommen. In der
  App bleibt dein Fortschritt auch dauerhaft erhalten. Im Safari-Tab erinnert die App einmal daran.
- **Updates** kommen von selbst: Gibt es eine neue Version, erscheint oben der Hinweis
  „Neue Version verfügbar“. Tippe auf **Neu laden**, oder starte die App einfach später neu.
  Eine laufende Partie wird vorher gespeichert.
- Hoch- und Querformat gehen beide. Ziehen kannst du durch Tippen (Figur, dann Zielfeld)
  oder durch Ziehen mit dem Finger.

## So läuft eine Partie

- In der **Arena** wählst du einen freigeschalteten Bot, die Farbe (Weiß, Schwarz oder Zufall)
  und tippst auf **Spielen**.
- Nach jedem deiner Züge erscheint das **Symbol** der Zug-Klasse am Zielfeld, das Feld leuchtet
  in der Klassenfarbe und der **Coach** erklärt den Zug. Bei einem Fehler zeigt er die Bewertung
  vorher und nachher (zum Beispiel „+3,3 → +2,7“) und mit **Besser?** den stärkeren Zug.
- Drei sehr gute Züge in Folge (Präzise, Goldrichtig oder Genial) starten eine **COMBO**.
- Knöpfe: **Hinweis** (1. Tippen markiert die Figur, 2. Tippen zeigt den Zug),
  **Zurücknehmen**, **Drehen**, **Aufgeben**. Hinweis und Zurücknehmen kosten den 3. Stern.
- Über **Zurück** kannst du eine Partie pausieren und später in der Arena fortsetzen.
  Auch nach dem Neuladen oder einem Neustart geht es an derselben Stelle weiter.

## Die Bewertung

Für jede Stellung rechnet Stockfish aus, wie hoch deine **Gewinnchance** ist (0 bis 100 %,
dieselbe Formel wie bei Lichess). Ein Zug wird danach eingeordnet, wie viel Gewinnchance er im
Vergleich zum besten Zug verschenkt. Die Prozentangaben in der Tabelle sind Prozentpunkte
Gewinnchance.

| Symbol | Klasse | Bedeutung |
|---|---|---|
| !! | **Genial** | Bester oder fast bester Zug, bei dem du eine Figur opferst. Die Stellung bleibt danach gut und war vorher noch nicht entschieden. |
| ! | **Goldrichtig** | Der einzige gute Zug: Jeder andere Zug wäre mindestens 10 Punkte schlechter gewesen. |
| ⊙ | **Präzise** | Genau der Zug, den auch Stockfish spielen würde (oder ein Zug, der wirklich gleich gut ist). |
| ✓ | **Sauber** | Fast so gut wie der beste Zug (höchstens 2 Punkte schlechter). |
| = | **Solide** | Ein solider Zug (höchstens 5 Punkte schlechter). |
| ▮ | **Theorie** | Ein bekannter Eröffnungszug aus der Eröffnungstabelle (nur in den ersten Zügen). |
| ?! | **Unscharf** | Verschenkt etwas (bis 10 Punkte). |
| ? | **Daneben** | Verschenkt deutlich (bis 20 Punkte). |
| 🎁 | **Verschenkt** | Der Bot hatte gerade einen Fehler gemacht und du hättest klar besser stehen können, hast die Chance aber liegen lassen. Auch ein ausgelassenes Matt in 1 bis 3 Zügen zählt so. |
| ?? | **Weit daneben** | Ein schwerer Fehler (mehr als 20 Punkte). |
| → | **Pflichtzug** | Es gab nur einen einzigen erlaubten Zug. |

Ist eine Stellung schon klar gewonnen oder klar verloren, gibt es höchstens „Unscharf“, wie bei
chess.com. Aus allen Zügen zusammen ergibt sich deine **Genauigkeit** (0 bis 100 %) und daraus
eine Schätzung, wie stark du gespielt hast („spielte wie ≈ 1150“).

In der **Spielanalyse** siehst du beide Genauigkeiten, wie oft jede Klasse vorkam (Zeile
antippen springt zu diesen Zügen), die Bewertungskurve (antippen springt zum Zug), die
Schlüsselmomente und zu jedem Zug den besten Zug als Pfeil. **Variante zeigen** spielt die
beste Fortsetzung auf dem Brett vor.

## Sterne und Freischalten

Jeder Bot hat **drei Sterne**. Jeder Stern bleibt für immer, du musst nicht alle in derselben
Partie holen:

1. ★ **Sieg** gegen den Bot.
2. ★ **Sieg mit mindestens 80 % Genauigkeit.**
3. ★ **Sieg ohne Hinweis und ohne Zurücknehmen.**

Besiegst du einen Bot, wird der **nächste Bot frei**. In jeder offenen Welt kannst du den
Endgegner direkt herausfordern. Ein Sieg gegen ihn schaltet alle Bots dieser Welt und die
nächste Welt frei. Insgesamt gibt es **90 Sterne**; alle 18 Sterne einer Welt ergeben ihr Weltsiegel.
Deine genialen Züge sammelt die **Schatzkiste** im Verlauf.

Jede Welt hat sechs Bots mit jeweils 100 Elo Abstand:

| Welt | Stufen | Angezeigte Elo |
|---|---|---|
| Die Karofelder | 1 bis 6 | 100 bis 600 |
| Der Springerforst | 7 bis 12 | 700 bis 1200 |
| Die Turmstadt | 13 bis 18 | 1300 bis 1800 |
| Die Gezeitenküste | 19 bis 24 | 1900 bis 2400 |
| Die Stockfisch-Tiefe | 25 bis 30 | 2500 bis 3000 |

In den **Einstellungen** kannst du Klang, Bewertungsbalken, Live-Bewertung, Koordinaten,
Brettfarbe (Nacht, Grün, Holz) und die Rechentiefe einstellen und den Fortschritt zurücksetzen.

## Für Entwickler

Statische Web-App ohne Build-Schritt: HTML, CSS und JavaScript-Module, keine Abhängigkeiten aus
dem Netz. Bauplan und Schnittstellen stehen in `ARCHITEKTUR.md`.

| Ordner/Datei | Inhalt |
|---|---|
| `index.html`, `js/app.js` | Einstieg, Routing (`#arena`, `#partie`, `#analyse/<id>`, `#verlauf`, `#einstellungen`) |
| `js/ui/` | Ansichten und Bedienung |
| `js/` | Engine-Wrapper, Bots, Bewertung, Eröffnungen, Brett, Klänge, Speicher |
| `css/` | Design-Tokens, Theme „Modern und klar“, Brett und Ansichten |
| `sw.js`, `manifest.webmanifest`, `assets/icons/` | Offline-Cache, App-Daten und Icons fürs iPad |
| `vendor/` | Stockfish 19 (WebAssembly) und chess.js |
| `daten/` | Statische Inhalte als JSON, darunter Tagesrätsel; `daten/beispiel/` nur Format-Beispiele |
| `tests/` | Alle Tests |

**Lokal starten:** im Projektordner `python3 -m http.server 8000` und dann
http://localhost:8000/ öffnen. Mit `?test` in der Adresse ist der Offline-Cache aus, so siehst du
Änderungen sofort.

**Tests** brauchen Node.js und Playwright mit Chromium (Pfad notfalls per `PLAYWRIGHT_PFAD`).

```
node tests/alle.mjs              alle Testsuiten nacheinander, mit Zusammenfassung
node tests/alle.mjs --schnell    kurze Fassung (ohne Viewport-Runden und Bilder)
node tests/alle.mjs --nur=sw,e2e nur einzelne Suiten
```

Einzeln: `storage`, `review`, `ereignisse`, `fairness`, `spiel`, `engine-bots --schnell`, `board`, `sw`, `thema`, `klang`,
`navigation`, `app`, `screens`, `e2e` (jeweils `node tests/<name>.test.mjs`; `klang --nur-node` ohne Browser). Der Ende-zu-Ende-Test `e2e` liefert die App wie GitHub
Pages unter `/schach/` aus, spielt einen ganzen Ablauf auf dem iPad-Viewport durch, lädt die App
offline neu und prüft das Update auf eine neue Version. Bilder landen in `design/app-shots/`.

**Pakete (Runde 4):** Erweiterungen klinken sich nur über die Erweiterungspunkte ein (`ARCHITEKTUR.md`,
Abschnitt „Runde 4: Erweiterungspunkte“). In der App lädt `js/app.js` die Pakete aus der Liste `PAKETE` in
`js/erweiterungen.js` einzeln per `import()`: Ein kaputtes Paket landet nur in der Konsole, die App startet trotzdem.
Im Testmodus lädt `index.html?test&erw=pakete/<paket>/index` ein Paket auch ohne Eintrag in dieser Liste. Nur die Erweiterungspunkte prüfen:
`node tests/app.test.mjs --erweiterungen`. Nur die Nachbesserungen an Analyse, Nachholen und Engine-Start:
`node tests/app.test.mjs --nachpruefung`. Nur das Spiel-Fundament W0+a (neue Orte, Matt-Hook, Abrechnung, Boss-Modus,
untere Leiste): `node tests/app.test.mjs --spiel`; Tag, Inhalte, Spielplan und Bot-Register ohne Browser:
`node tests/spiel.test.mjs`. Statische Inhalte (Spielplan, später Rätsel und Bosse) liegen als JSON unter `daten/`
(Format in `ARCHITEKTUR.md`, Abschnitt „W0+a: Spiel-Fundament“): die eines Pakets unter `daten/<paket>/`, sie kommen mit
dem Paket in `DATEIEN` in `sw.js`; Dateien direkt unter `daten/` sofort. Anbieter für Orte, deren Screen es noch nicht
gibt (`bestenliste:reiter`, `training:karten`, `ich:vitrine`, `spielplan:tage`), lassen sich im Browser in der Test-Hülle
ansehen: `tests/orte-huelle.html?ort=ich:vitrine&erw=pakete/<paket>/index` (lokaler Server wie oben).

**Neue Version veröffentlichen:** Der Offline-Cache liefert immer die gespeicherte Version aus.
Damit das iPad ein Update bekommt, muss sich `sw.js` ändern. Nach jeder Änderung an einer
App-Datei deshalb:

```
node tests/sw.test.mjs --aktualisieren   zählt VERSION in sw.js hoch
node tests/alle.mjs                      alles grün?
```

Danach committen und pushen, GitHub Pages veröffentlicht automatisch (Repo-Einstellungen →
Pages → „Deploy from a branch“, `main`, Ordner `/`). Vergisst du das Hochzählen, meldet
`tests/sw.test.mjs` einen Fehler. Kommt eine neue Datei dazu, gehört sie in die Liste `DATEIEN`
in `sw.js` (auch das prüft der Test).

**Icons neu bauen:** `node assets/icons/baue-icons.mjs`

## Lizenzen

Der Code der Schach-Arena ist freie Software unter der **GPL-3.0** (siehe `LICENSE`). Ausgenommen sind Flos
eigene Klänge (siehe unten und `assets/LIZENZ-KUNST.md`).

- **Stockfish 19** als WebAssembly ([stockfish.js](https://github.com/nmrugg/stockfish.js),
  lite, single-threaded): GPL-3.0, siehe `vendor/stockfish/COPYING.txt`. Quellen:
  https://github.com/nmrugg/stockfish.js und https://github.com/official-stockfish/Stockfish. Genaue Herkunft,
  Prüfsummen, NNUE-Netz und Nachbau: [`vendor/stockfish/QUELLE.md`](vendor/stockfish/QUELLE.md).
- **chess.js** 1.4.0 ([jhlywa/chess.js](https://github.com/jhlywa/chess.js)): BSD-2-Clause,
  siehe `vendor/chess/LICENSE`. Herkunft und Prüfsumme:
  [`vendor/chess/QUELLE.md`](vendor/chess/QUELLE.md).
- **Figuren** „cburnett“ von Colin M.L. Burnett: GPLv2 oder neuer (derselbe Satz wie bei Lichess).
- **Schriften** (Look „Modern und klar“): **Manrope** (The Manrope Project Authors) und **Bricolage Grotesque**
  (The Bricolage Grotesque Project Authors), beide unter der SIL Open Font License 1.1, Lizenztexte in
  `assets/schriften/OFL-Manrope.txt` und `assets/schriften/OFL-Bricolage-Grotesque.txt`. Quelle: npm
  `@fontsource-variable/manrope@5.3.0` (`manrope-latin-wght-normal.woff2`) und
  `@fontsource-variable/bricolage-grotesque@5.3.0` (`bricolage-grotesque-latin-opsz-normal.woff2`), unverändert.
  Die Schriften liegen im Repo und im Offline-Cache, es gibt keine Anfrage an fremde Server.
- **Klänge** (Klangpakete „Holz“ und „Arcade“, `assets/klang/`): eigene Werke von Flo, eigene Synthese ohne
  fremde Aufnahmen. **Alle Rechte vorbehalten**, Nutzung nur in der Schach-Arena; sie stehen nicht unter der
  GPL-3.0. Einzelheiten in `assets/klang/LIZENZEN.md` und `assets/LIZENZ-KUNST.md`.
- Avatare, Zug-Symbole, App-Icon und Design sind für dieses Projekt entstanden und stehen
  ebenfalls unter der GPL-3.0.

Zu jeder veröffentlichten Version der Schach-Arena gibt es einen Git-Tag mit dem dazugehörigen Quellcode und den
Quellangaben der ausgelieferten Drittsoftware.

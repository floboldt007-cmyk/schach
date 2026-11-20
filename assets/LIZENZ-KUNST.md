# Lizenz für eigene Klänge und Bilder der Schach-Arena

Der **Code** der Schach-Arena steht unter der GPL-3.0 (siehe `LICENSE`). Für die **eigenen Werke von Flo**,
die in dieser Datei aufgeführt sind, gilt etwas anderes:

> Eigene Werke von Flo, alle Rechte vorbehalten. Die Nutzung ist nur in der Schach-Arena erlaubt.
> Kein Kopieren, Bearbeiten oder Weitergeben außerhalb der Schach-Arena ohne Flos schriftliche Erlaubnis.

Diese Werke gehören nicht zum Programm im Sinne der GPL. Sie liegen nur neben dem Code, damit die App sie
offline laden kann.

## Was unter diese Regel fällt

| Pfad | Was | Herkunft |
|---|---|---|
| `assets/klang/holz/*.mp3` | Klangpaket „Holz“ (40 Dateien) | eigene Synthese, Einzelheiten in `assets/klang/LIZENZEN.md` |
| `assets/klang/arcade/*.mp3` | Klangpaket „Arcade“ (40 Dateien) | eigene Synthese, Einzelheiten in `assets/klang/LIZENZEN.md` |
| `assets/klang/melodien.json` | Melodien der Lobby-Musik (fünf Weltstimmungen) | selbst geschrieben, von Flo am 30.10.2026 so festgelegt, Abspieler `js/musik.js` bleibt GPL-3.0; Einzelheiten und Stand in `assets/klang/MUSIK-LIZENZ.md` |

Neue eigene Klänge und Bilder kommen erst in diese Tabelle, wenn Flo das für die Datei so festlegt.

## Was nicht darunter fällt

- Alles, was im README unter „Lizenzen“ mit einer anderen Lizenz steht, behält diese Lizenz: Stockfish
  (GPL-3.0), chess.js (BSD-2-Clause), die Figuren „cburnett“ und die daraus abgeleiteten Sätze „Blaupause“ und „Gold und Elfenbein“ (GPLv2 oder neuer), die eigenen Figurensätze „Elfenbein“, „Holz“, „Marmor“, „Gold“, „Glas“, „Neon“, „Frost“, „Kürbis“, „Moosgeister“, „Tiefsee“ (gedrechselte Formen, die letzten beiden mit Gesichtern, `werkzeuge/figuren-3d.mjs`), die Themen „Feuer“, „Stein“, „Halloween“, „Weihnachten“, „Ostern“, „Weltraum“, „Roboter“, „Naschwerk“, „Zombies“, „Geister“, „Drachen“, „Lava-Golem“, „Piraten“, „Ägypten“, „Wikinger“, „Dinos“ (`werkzeuge/figuren-themen.mjs`), „Pixel“ und „Geo“ (`werkzeuge/figuren-stile.mjs`; alle GPL-3.0 wie der Code), die Schriften Manrope und
  Bricolage Grotesque (SIL OFL 1.1) sowie Avatare, Zug-Symbole, App-Icon und Design, die schon unter der
  GPL-3.0 veröffentlicht sind.

## Herkunft der Figurensätze (belegt, 18.11. und 19.11.2026)

Nur Tatsachen aus dem Repo, keine Festlegung im Namen von Flo; an der Lizenz oben ändert dieser Abschnitt nichts.
Jeder Ordner unter `assets/pieces/` hat hier eine Zeile (`tests/info-lizenzen.test.mjs` prüft das). Gemessen am
19.11.2026 auf Stand 95e73487: jedes genannte Werkzeug lief in einer frischen Kopie (`git archive`) und erzeugte alle
12 Dateien des Satzes byte-gleich zu den Dateien im Repo; „eingeführt“ ist der erste Commit der Datei `wK.svg`
(`git log --diff-filter=A`). Die Lizenzspalte gibt wieder, was der Kopf des Werkzeugs sagt; die Werkzeuge und Sätze
hat Claude im Auftrag von Flo geschrieben (Autor aller Commits der Werkzeuge).

| Pfad | Herkunft | Lizenz | Beleg |
|---|---|---|---|
| `assets/pieces/goldelfenbein/` („Gold und Elfenbein“, 12 Dateien) | Bearbeitung von „cburnett“ (Colin M.L. Burnett). Die Umrisse bleiben unverändert, neu ist das Material: Verlauf, Glanz, Spiegelstreif, Schatten und Umriss mit Verlauf | GPLv2 oder neuer | `node werkzeuge/figuren-material.mjs --app` erzeugt alle 12 Dateien byte-gleich neu |
| `assets/pieces/blaupause/` („Blaupause“) | Bearbeitung von „cburnett“ (Colin M.L. Burnett): Farben getauscht, Hilfslinien (Mittelachse, Grundlinie, Maßpfeile) dahinter | GPLv2 oder neuer | `node werkzeuge/blaupause.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in 5e0bb9d1 (30.10.2026) |
| `assets/pieces/elfenbein/` („Elfenbein“) | eigenes Werk: gedrechselte Formen, Material Elfenbein, erzeugt mit `werkzeuge/figuren-3d.mjs` | GPL-3.0 | `node werkzeuge/figuren-3d.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in c487b14b (31.10.2026) |
| `assets/pieces/holz/` („Holz“) | eigenes Werk: gedrechselte Formen, Material Holz, erzeugt mit `werkzeuge/figuren-3d.mjs` | GPL-3.0 | `node werkzeuge/figuren-3d.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in c3bfc600 (31.10.2026) |
| `assets/pieces/marmor/` („Marmor“) | eigenes Werk: gedrechselte Formen, Material Marmor, erzeugt mit `werkzeuge/figuren-3d.mjs` | GPL-3.0 | `node werkzeuge/figuren-3d.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in c487b14b (31.10.2026) |
| `assets/pieces/gold/` („Gold“) | eigenes Werk: gedrechselte Formen, Material Gold, erzeugt mit `werkzeuge/figuren-3d.mjs`; die erste Fassung (3e74040d) war aus „cburnett“ abgeleitet und wurde in c487b14b ersetzt | GPL-3.0 | `node werkzeuge/figuren-3d.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in 3e74040d (31.10.2026) |
| `assets/pieces/glas/` („Glas“) | eigenes Werk: gedrechselte Formen, Material Glas, erzeugt mit `werkzeuge/figuren-3d.mjs` | GPL-3.0 | `node werkzeuge/figuren-3d.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in c3bfc600 (31.10.2026) |
| `assets/pieces/neon/` („Neon“) | eigenes Werk: gedrechselte Formen, Material Neon, erzeugt mit `werkzeuge/figuren-3d.mjs` | GPL-3.0 | `node werkzeuge/figuren-3d.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in c3bfc600 (31.10.2026) |
| `assets/pieces/frost/` („Frost“) | eigenes Werk: gedrechselte Formen, Material Frost, erzeugt mit `werkzeuge/figuren-3d.mjs`; die erste Fassung (3e74040d) war aus „cburnett“ abgeleitet und wurde in c487b14b ersetzt | GPL-3.0 | `node werkzeuge/figuren-3d.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in 3e74040d (31.10.2026) |
| `assets/pieces/kuerbis/` („Kürbis“) | eigenes Werk: gedrechselte Formen, Material Kürbis, erzeugt mit `werkzeuge/figuren-3d.mjs`; die erste Fassung (3e74040d) war aus „cburnett“ abgeleitet und wurde in c487b14b ersetzt | GPL-3.0 | `node werkzeuge/figuren-3d.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in 3e74040d (31.10.2026) |
| `assets/pieces/moosgeister/` („Moosgeister“) | eigenes Werk: gedrechselte Formen mit Gesichtern und Wald-Zubehör, erzeugt mit `werkzeuge/figuren-3d.mjs` | GPL-3.0 | `node werkzeuge/figuren-3d.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in 30c2ba22 (31.10.2026) |
| `assets/pieces/tiefsee/` („Tiefsee“) | eigenes Werk: gedrechselte Formen mit Gesichtern und Meeres-Zubehör, erzeugt mit `werkzeuge/figuren-3d.mjs` | GPL-3.0 | `node werkzeuge/figuren-3d.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in 30c2ba22 (31.10.2026) |
| `assets/pieces/feuer/` („Feuer“) | eigenes Werk: Themen-Köpfe aus `werkzeuge/figuren-themen.mjs`, geschrieben von `werkzeuge/figuren-3d.mjs` | GPL-3.0 | `node werkzeuge/figuren-3d.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in 1863dc79 (31.10.2026) |
| `assets/pieces/stein/` („Stein“) | eigenes Werk: ganz eigene kantige Figuren aus `werkzeuge/figuren-themen.mjs`, geschrieben von `werkzeuge/figuren-3d.mjs` | GPL-3.0 | `node werkzeuge/figuren-3d.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in 1863dc79 (31.10.2026) |
| `assets/pieces/halloween/` („Halloween“) | eigenes Werk: Themen-Köpfe aus `werkzeuge/figuren-themen.mjs`, geschrieben von `werkzeuge/figuren-3d.mjs` | GPL-3.0 | `node werkzeuge/figuren-3d.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in 1863dc79 (31.10.2026) |
| `assets/pieces/weihnachten/` („Weihnachten“) | eigenes Werk: Themen-Köpfe aus `werkzeuge/figuren-themen.mjs`, geschrieben von `werkzeuge/figuren-3d.mjs` | GPL-3.0 | `node werkzeuge/figuren-3d.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in 1863dc79 (31.10.2026) |
| `assets/pieces/ostern/` („Ostern“) | eigenes Werk: Themen-Köpfe aus `werkzeuge/figuren-themen.mjs`, geschrieben von `werkzeuge/figuren-3d.mjs` | GPL-3.0 | `node werkzeuge/figuren-3d.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in 1863dc79 (31.10.2026) |
| `assets/pieces/weltraum/` („Weltraum“) | eigenes Werk: Themen-Köpfe aus `werkzeuge/figuren-themen.mjs`, geschrieben von `werkzeuge/figuren-3d.mjs` | GPL-3.0 | `node werkzeuge/figuren-3d.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in 72fa8aa6 (31.10.2026) |
| `assets/pieces/roboter/` („Roboter“) | eigenes Werk: Themen-Köpfe aus `werkzeuge/figuren-themen.mjs`, geschrieben von `werkzeuge/figuren-3d.mjs` | GPL-3.0 | `node werkzeuge/figuren-3d.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in 72fa8aa6 (31.10.2026) |
| `assets/pieces/naschwerk/` („Naschwerk“) | eigenes Werk: Themen-Köpfe aus `werkzeuge/figuren-themen.mjs`, geschrieben von `werkzeuge/figuren-3d.mjs` | GPL-3.0 | `node werkzeuge/figuren-3d.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in 72fa8aa6 (31.10.2026) |
| `assets/pieces/zombies/` („Zombies“) | eigenes Werk: Themen-Köpfe aus `werkzeuge/figuren-themen.mjs`, geschrieben von `werkzeuge/figuren-3d.mjs` | GPL-3.0 | `node werkzeuge/figuren-3d.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in 2a83912b (31.10.2026) |
| `assets/pieces/geister/` („Geister“) | eigenes Werk: ganz eigene Formen aus `werkzeuge/figuren-themen.mjs`, geschrieben von `werkzeuge/figuren-3d.mjs` | GPL-3.0 | `node werkzeuge/figuren-3d.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in 2a83912b (31.10.2026) |
| `assets/pieces/drachen/` („Drachen“) | eigenes Werk: Themen-Köpfe aus `werkzeuge/figuren-themen.mjs`, geschrieben von `werkzeuge/figuren-3d.mjs` | GPL-3.0 | `node werkzeuge/figuren-3d.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in 2a83912b (31.10.2026) |
| `assets/pieces/lavagolem/` („Lava-Golem“) | eigenes Werk: die Stein-Golems aus `werkzeuge/figuren-themen.mjs` in neuen Farben, geschrieben von `werkzeuge/figuren-3d.mjs` | GPL-3.0 | `node werkzeuge/figuren-3d.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in 2a83912b (31.10.2026) |
| `assets/pieces/piraten/` („Piraten“) | eigenes Werk: Themen-Köpfe aus `werkzeuge/figuren-themen.mjs`, geschrieben von `werkzeuge/figuren-3d.mjs` | GPL-3.0 | `node werkzeuge/figuren-3d.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in 30f5cac4 (31.10.2026) |
| `assets/pieces/aegypten/` („Ägypten“) | eigenes Werk: Themen-Köpfe aus `werkzeuge/figuren-themen.mjs`, geschrieben von `werkzeuge/figuren-3d.mjs` | GPL-3.0 | `node werkzeuge/figuren-3d.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in 30f5cac4 (31.10.2026) |
| `assets/pieces/wikinger/` („Wikinger“) | eigenes Werk: Themen-Köpfe aus `werkzeuge/figuren-themen.mjs`, geschrieben von `werkzeuge/figuren-3d.mjs` | GPL-3.0 | `node werkzeuge/figuren-3d.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in 30f5cac4 (31.10.2026) |
| `assets/pieces/dinos/` („Dinos“) | eigenes Werk: Themen-Köpfe aus `werkzeuge/figuren-themen.mjs`, geschrieben von `werkzeuge/figuren-3d.mjs` | GPL-3.0 | `node werkzeuge/figuren-3d.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in 30f5cac4 (31.10.2026) |
| `assets/pieces/pixel/` („Pixel“) | eigenes Werk: 8-Bit-Zeichnungen auf 16 × 16, erzeugt mit `werkzeuge/figuren-stile.mjs` | GPL-3.0 | `node werkzeuge/figuren-stile.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in c3bfc600 (31.10.2026) |
| `assets/pieces/geo/` („Geo“) | eigenes Werk: flache Grundformen, erzeugt mit `werkzeuge/figuren-stile.mjs` | GPL-3.0 | `node werkzeuge/figuren-stile.mjs` erzeugt alle 12 Dateien byte-gleich neu; eingeführt in c3bfc600 (31.10.2026) |
| `assets/shop/figuren/lampion/`, `sternwarte/`, `uhrwerk/`, `kristall/`, `origami/`, `kronjuwel/` (je 12 Dateien) | erzeugt von `werkzeuge/shop-vorrat.mjs`; der Kopf des Werkzeugs sagt, dass Claude die Shop-Inhalte als SVG zeichnet und die Formen eigene sind | **offen:** Der Kopf des Werkzeugs nennt GPL-3.0, eine Bestätigung durch den Inhaber steht aus | `node werkzeuge/shop-vorrat.mjs` erzeugt alle 72 Dateien byte-gleich neu |

## Herkunft der Avatare und Bot-Daten (belegt, 14.11.2026)

Nur Tatsachen aus dem Repo, keine Festlegung im Namen von Flo; an der Lizenz oben ändert dieser Abschnitt nichts.
Gemessen am Stand `sammel-1114-r17` (1b52b06), Bericht im Vault: R18-Rechte-Nachweise.

| Pfad | Herkunft | Beleg |
|---|---|---|
| `assets/avatare/01-…10-*.svg` (10 Pixel-Avatare) | erzeugt von `design/neon/werkzeug/baue-avatare.mjs` | das Skript erzeugt alle 10 Dateien byte-gleich neu (git hash-object gleich den Dateien im Repo) |
| `assets/avatare/modern/` benno, delia, greta, hilde, kalle, koenig, lisa, rudi, stockfisch, turm | aus `AV.svg(id)` in `design/runde4/umbau/entwurf-a/index.html` herausgelöst (Commit 4cae3af) | gleich der Ausgabe von `AV.svg(id)` bis auf das Attribut `aria-hidden="true"`, den XML-Kopf und den Zeilenumbruch; das Herauslöse-Werkzeug liegt nicht im Repo |
| `assets/avatare/modern/` die übrigen 20 (alva bis wiebke) | von Claude als SVG geschrieben (Commit b5e4cca; ottilie.svg und ragna.svg in e66d49c neu gezeichnet) | kein Werkzeug im Repo; Bestätigung durch den Inhaber offen |
| `assets/avatare/bosse/` (4) | von Claude als SVG geschrieben (Commit ccf3744); die Figur ist ein Schriftzeichen (♜ u. a.), gezeichnet von der Schrift des Geräts | kein Werkzeug im Repo; Bestätigung durch den Inhaber offen |
| `daten/punkte/bot-laeufe.json` | eigen: erzeugt von `werkzeuge/nachbar-laeufe.mjs` aus Partien der eigenen Bots, ausgewertet mit Stockfish | die Eingabe (`eichung/messung/roh/botpartien.jsonl`) liegt nur lokal, nicht im Repo |

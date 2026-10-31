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
  (GPL-3.0), chess.js (BSD-2-Clause), die Figuren „cburnett“ und die daraus abgeleitete „Blaupause“ (GPLv2 oder neuer), die eigenen Figurensätze „Elfenbein“, „Holz“, „Marmor“, „Gold“, „Glas“, „Neon“, „Frost“, „Kürbis“, „Moosgeister“, „Tiefsee“ (gedrechselte Formen, die letzten beiden mit Gesichtern, `werkzeuge/figuren-3d.mjs`), die Themen „Feuer“, „Stein“, „Halloween“, „Weihnachten“, „Ostern“, „Weltraum“, „Roboter“, „Naschwerk“, „Zombies“, „Geister“, „Drachen“, „Lava-Golem“ (`werkzeuge/figuren-themen.mjs`), „Pixel“ und „Geo“ (`werkzeuge/figuren-stile.mjs`; alle GPL-3.0 wie der Code), die Schriften Manrope und
  Bricolage Grotesque (SIL OFL 1.1) sowie Avatare, Zug-Symbole, App-Icon und Design, die schon unter der
  GPL-3.0 veröffentlicht sind.

# Lizenz und Herkunft: Klangpakete „Holz“ und „Arcade“

## Kurzfassung

Alle 80 Klangdateien in `holz/` und `arcade/` (je 40) sind **eigene Werke von Flo**, entstanden für die
Schach-Arena. **Alle Rechte vorbehalten.** Die Nutzung ist nur in der Schach-Arena erlaubt. Die Klänge
stehen **nicht** unter der GPL-3.0 des Codes und **nicht** unter CC0. Die gemeinsame Regel für eigene Klänge
und Bilder steht in `assets/LIZENZ-KUNST.md`.

| Was | Herkunft | Lizenz |
|---|---|---|
| `holz/*.mp3` (40 Dateien) | eigene Synthese (Marimba, Handglocke, Klangschale, Holzbrett) | eigene Werke von Flo, alle Rechte vorbehalten, Nutzung nur in der Schach-Arena |
| `arcade/*.mp3` (40 Dateien) | eigene Synthese (Sinus-Punch, Supersaw, Kristalltöne) | eigene Werke von Flo, alle Rechte vorbehalten, Nutzung nur in der Schach-Arena |

Es steckt keine fremde Aufnahme, kein Sample und kein Klang aus einer anderen App darin (weder chess.com
noch lichess noch eine Klangbibliothek). Rechte Dritter an den Klängen gibt es deshalb nicht.

## Wie die Klänge entstanden sind

Offline mit eigenen Python-Werkzeugen (numpy), ohne Material aus dem Netz:

- **Holz-Klack** (Zug, Schlagen, Rochade): Modalsynthese einer Walnussplatte und einer Buchsbaumfigur, angeregt
  mit einem kurzen Kontaktimpuls, dazu ein leiser Tisch-Wumms. Jede Variante hat leicht verschobene Moden.
- **Marimba, Handglocke, Klangschale, Celesta, Tempelblock**: additive Synthese aus physikalisch üblichen
  Teiltonverhältnissen. Holz bleibt in D-Dur.
- **Arcade**: Sinus-Punch mit fallender Tonhöhe, gefärbte Rauschimpulse, bandbegrenzte Oszillatoren,
  Supersaw-Flächen, Kristalltöne, Plattenhall und Echo. Arcade bleibt in A-Dur.
- **Neu für den Premium-Umbau** (9 je Paket): `finisher-tinte`, `finisher-kreide`, `finisher-glocke`,
  `treffer`, `level`, `rekord`, `siegel`, `bauer`, `feier`. Feder- und Kreidestriche sind Bandrauschen mit
  gleitender Mittenfrequenz, der Tinten-Klecks ist ein Sinus mit schnell steigender Tonhöhe.
- **Hall**: Faltung mit selbst erzeugten Impulsantworten.
- **Mastering**: Pegel nach Kurzzeit-Lautheit (die Rangfolge steckt in den Dateien: Brillant am lautesten,
  Patzer am leisesten), Echtspitze unter -1 dBFS, MP3 44,1 kHz, 128 kbit/s, stereo.

Die Messwerte jeder Datei (Länge, Echtspitze, Lautheit) prüft `tests/klang.test.mjs`.

## Benutzte Werkzeuge (nur zum Erzeugen, nicht in den Dateien enthalten)

| Werkzeug | Zweck | Lizenz des Werkzeugs |
|---|---|---|
| Python 3, numpy | Rechnen | PSF-Lizenz, BSD-3-Clause |
| FFmpeg mit libmp3lame | MP3 kodieren, Pegel messen | LGPL-2.1 (keine Rechte an den Ausgaben) |

Die MP3-Patente sind seit 2017 abgelaufen, das Format ist frei nutzbar.

## Geprüft und bewusst nicht verwendet

- **lichess**: Die Klangsätze stehen unter AGPLv3+ bzw. CC BY-NC-SA 4.0, beides nicht auf der erlaubten Liste.
- **chess.com**: nichts übernommen, auch nicht nachgebaut. Schach ist ein feiner Glockenton statt eines
  zweiten Klacks, alle Bewertungsklänge sind Marimba, Glocken oder Kristalltöne in einer festen Tonart.

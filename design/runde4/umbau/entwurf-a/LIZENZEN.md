# Lizenzen: Entwurf A „Modern und klar“

Alles läuft offline. Es gibt keine CDNs und keine externen Anfragen. Jede fremde Datei steht hier mit Quelle und Lizenz.

| Was | Datei(en) im Entwurf | Quelle | Lizenz |
|---|---|---|---|
| Schachfiguren „cburnett“ (unverändert aus der App kopiert) | `figuren/*.svg` | `/home/user/schach/assets/pieces/*.svg`, Original von Colin M.L. Burnett (derselbe Satz wie bei Lichess) | GPLv2 oder neuer (laut `README.md` der App) |
| Brettfarben Nacht, Grün, Holz | in `index.html` (CSS) | aus der App (`js/ui/einstellungen.js`) | eigener Code der App |
| Schrift Manrope (variabel) | `schriften/manrope.woff2`, Lizenztext `schriften/OFL-Manrope.txt` | npm `@fontsource-variable/manrope@5.3.0` (registry.npmjs.org), Projekt github.com/googlefonts/manrope | SIL Open Font License 1.1 |
| Schrift Bricolage Grotesque (variabel) | `schriften/bricolage-grotesque.woff2`, Lizenztext `schriften/OFL-Bricolage-Grotesque.txt` | npm `@fontsource-variable/bricolage-grotesque@5.3.0` (registry.npmjs.org), Projekt github.com/ateliertriay/bricolage | SIL Open Font License 1.1 |
| Bot-Porträts (10 flache Vektor-Porträts) | in `index.html` (SVG aus Code) | eigene Zeichnungen für diesen Entwurf, angelehnt an Figur und Farbe der heutigen Pixel-Avatare | eigenes Werk, keine fremden Teile |
| Symbole (Pokal, Uhr, Zahnrad, Lautsprecher usw.) | in `index.html` (SVG-Pfade) | eigene, einfache Strichzeichnungen | eigenes Werk |
| Flos Porträt im Duell und in der Partie | in `index.html` | sein König aus dem cburnett-Satz (`figuren/wK.svg`, `figuren/bK.svg`) auf eigener Fläche | GPLv2 oder neuer (Figur), Rest eigenes Werk |
| Klänge (je Paket 31 Dateien, 24 Namen plus Varianten) | `../klang/holz/*.mp3`, `../klang/arcade/*.mp3` | eigene Synthese des Klang-Designers dieses Durchlaufs, keine fremden Aufnahmen | eigene Arbeit, Vorschlag CC0 1.0, siehe `../klang/LIZENZEN.md` |

## Nur als Werkzeug benutzt, nicht ausgeliefert

| Was | Wozu | Lizenz |
|---|---|---|
| chess.js (npm) | Gegenprobe der eigenen, kompakten Zugregeln (Perft) und der Demo-Partie | BSD-2-Clause |
| Playwright, Chromium, ffmpeg | Screenshots, Video, Prüfung auf Konsolenfehler und Überlauf | Apache-2.0 bzw. BSD bzw. LGPL (nur lokal) |

## Bewusst nicht verwendet

Nichts von chess.com (keine Grafiken, Symbole, Klänge, Texte, Farbschemata). Kein grün-weißes Standardbrett als Hauptlook:
„Grün“ ist nur eine der drei wählbaren Brettfarben der App, Standard ist „Nacht“.

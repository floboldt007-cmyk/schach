# Lizenzen und Quellen: Entwurf C "Verspielt und saftig"

| Was | Datei(en) | Quelle | Lizenz |
|---|---|---|---|
| Schachfiguren "cburnett" (Flos heutiger Satz, unverändert kopiert) | `figuren/*.svg` | `/home/user/schach/assets/pieces/`, ursprünglich Colin M. L. Burnett (wie bei Lichess) | GPLv2 oder neuer (passt zur GPL-3.0 des Schach-Repos) |
| Schrift Fredoka (Display) | `schriften/fredoka.woff2`, Lizenztext `schriften/OFL-Fredoka.txt` | npm `@fontsource-variable/fredoka@5.3.0` (Dateien von Google Fonts, Upstream github.com/hafontia/Fredoka-One) | SIL Open Font License 1.1 |
| Schrift Nunito (Text) | `schriften/nunito.woff2`, Lizenztext `schriften/OFL-Nunito.txt` | npm `@fontsource-variable/nunito@5.3.0` (Dateien von Google Fonts, Upstream github.com/googlefonts/nunito) | SIL Open Font License 1.1 |
| Klänge (Pakete "arcade" und "holz") | `../klang/<paket>/<name>.mp3` (nicht in diesem Ordner) | Klang-Designer der Design-Werkstatt, eigene Synthese, siehe `../klang/LIZENZEN.md` | eigene Arbeit (Vorschlag CC0 1.0) |
| Bot-Porträts (10 SVG-Illustrationen), Welt-Karte, Icons, Partikel, Band, Medaillons | eingebettet in `index.html` | selbst gezeichnet für diesen Entwurf | eigene Arbeit, frei wählbar (z. B. GPL-3.0 wie das Repo) |
| Zugklassen-Symbole | eingebettet in `index.html` | Formen aus Flos `js/symbole.js` übernommen, Farben neu | Flos eigenes Projekt (GPL-3.0) |
| Bot-Namen, Elo, Sprüche | eingebettet in `index.html` | aus Flos `js/bots.js` und `js/ui/arena.js` | Flos eigenes Projekt |
| Demo-Partie (Zugfolge) | eingebettet in `index.html` | Morphy gegen Herzog von Braunschweig und Graf Isouard, Paris 1858 ("Opernpartie"), gemeinfrei; jeder Zug ab Zug 9 mit Stockfish 18 (Tiefe 14) geprüft | gemeinfrei |
| Brettfarben Nacht, Grün, Holz | CSS in `index.html` | Flos `js/ui/einstellungen.js` | Flos eigenes Projekt |

Nichts stammt von chess.com: keine Grafiken, Icons, Klänge, Texte oder Farbschemata. Keine CDNs, keine
externen Anfragen; die Seite lädt nur Dateien aus diesem Ordner und aus `../klang/`.

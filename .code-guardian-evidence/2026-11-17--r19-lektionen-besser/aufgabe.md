# Aufgabe: r19-lektionen-besser · 2026-11-17
Ziel: Die 13 Lektionen ohne schnelles Geschafft (6 lange Matts, 7 Endspiele) werden schwerer und lehrreicher: drei Runden je Lektion (Lernen, Ueben, Meisterprobe ohne Hinweis), jede Stellung und jede Textbehauptung mit Stockfish nachgerechnet
Modus: BUILD · Klasse: large · Trace: 2026-11-17--r19-lektionen-besser
Sitzung: e27e4e92-593a-45ea-b752-1b60dfc06749
Todo: 
Graph: ja (T-1643: Abschluss erst, wenn jeder Knoten belegt ist)
Kriterien: ja (T-1712: Abschluss erst, wenn jedes Pflichtkriterium belegt ist)

## Plan
- [ ] Messung vorher (Zuege, Aufgaben, Anteil denkfreier Zuege) und Bilder vorher
- [x] roter Test r19-lektionen-besser
- [ ] Runden-Daten fuer 13 Lektionen, Stellungen per Engine gesucht und belegt
- [ ] Lektions-Screen: Rundenanzeige, Runde 3 ohne Hinweis, Sterne = Runden
- [ ] Texte DE/EN je Runde, wenig Text
- [ ] Messung nachher und Bilder nachher, Varianten Belohnung
- [ ] Suiten mit Ampel
- [ ] Audit
- [ ] KALTREVIEW-Meldung

## Zusagen
<!-- was der Auftrag verlangt. Abgehakt NUR mit Beleg — ein Haken ohne Kommando ist Kernregel 1 auf die eigene Liste angewandt. -->
- [ ] Messung vorher/nachher je Lektion
- [ ] Bilder vorher/nachher iPhone 13, SE, PC nach R19-Kritik/lektionen-besser
- [ ] Engine-Beleg je Stellung, Loesungszug und Textbehauptung
- [ ] neue Dateien in der Uebergabe gemeldet
- [ ] Geschmack als Bild-Varianten, Empfehlung gebaut und Rueckholbar markiert

## Verbote
<!-- was NICHT passieren darf. Abgehakt heisst: GEPRUEFT und nicht verletzt, mit dem Kommando, das es zeigt. -->
- [ ] sw.js nicht anfassen
- [ ] nichts an Punkten/Belohnungen fuer Kauf, nichts an Preisen
- [ ] kein PR, nichts nach main, nie git stash, nichts loeschen, kein Supabase

## Dateien
```
js/pakete/lernen/*.js
js/ui/lektion.js
css/pakete/lernen.css
tests/r19-lektionen-*.mjs
tests/lektion-engine.mjs
tests/lernen.test.mjs
tests/alle.mjs
werkzeuge/lektionen-messen.mjs
tests/bilder-lektionen-besser.mjs
```

## Kernprobe
- kern · 13 schwere Lektionen haben 3 engine-belegte Runden · pruefung: lauf · node tests/r19-lektionen-besser.test.mjs
Arbeitsbaum: C:\Users\Flo\Documents\KI\schach-R19-lektionen-besser
Gesetzt: 2026-11-17T20:01:19+01:00 · Siegel 0ef8f0ea7644189b
Start: geprueft
Stand: rot seit 2026-11-17T20:01:22+01:00 · gemessen 2026-11-17T20:01:22+01:00 · exit=1 · datei C:\Users\Flo\Documents\KI\schach-R19-lektionen-besser\.code-guardian-evidence\2026-11-17--r19-lektionen-besser\kernprobe-20261117T200120465453.log

## Kriterien
Kennungen bis: K4 · Siegel e7fc20af84255975
Arbeitsbaum: C:\Users\Flo\Documents\KI\schach-R19-lektionen-besser · Zweig so/R19-lektionen-besser · Basis e9abb828ab5c37ad4cabb83af8d7bdea02250f6e
Eingefroren: 2026-11-17T20:03:09+01:00 · Hash 2b5c3408fd2b9be2 · Siegel 4f7e77241e9ac7c7 · trotz Code: die unsauberen Pfade sind nur der Rot-Test, sein Engine-Helfer und das Messwerkzeug fuer den Vorher-Stand, kein Produktionscode
- K1 · pflicht · 13 Lektionen mit je 3 Runden, jede Stellung legal, Ziel und jede Textbehauptung von Stockfish bestaetigt, Runde 2/3 nicht leichter als Runde 1 · pruefung: lauf · node tests/r19-lektionen-besser.test.mjs · stand: offen
- K2 · pflicht · Lektions-Screen zeigt Runde x von 3, Runde 3 ohne Hinweis-Knopf, Sterne = geschaffte Runden, alte Staende bleiben, 4 Geraete hell/dunkel · pruefung: lauf · node tests/r19-lektionen-runden.test.mjs · stand: offen
- K3 · pflicht · Meisterschule-Suiten bleiben gruen (lernen, Probe aller Lektionen, zu zweit lernen, Ich-Lektion, Sprache) · pruefung: lauf · node tests/alle.mjs --nur=lernen,r19-lektionen-probe,funktion-zuzweit-lernen,r15-ich-lektion,sprache · stand: offen
- K4 · pflicht · Kaltreview ohne kritischen Befund · pruefung: review · kaltreview · stand: offen

## Graph
Graph-Start: 2026-11-17T20:01:22+01:00
<!-- belegt setzt nur `aufgabe.py beleg` (geprueft); behauptet zaehlt beim Abschluss wie offen -->
- plan: offen
- preflight: offen
- edit: offen
- audit: offen
- kaltreview: offen
- suite: offen
- abschluss: offen

## Erkenntnisse
- WIP-Stand 17.11. abends (unterbrochen fuer Vorrang Paket 2a): Messung vorher steht in messung-vorher.log (13 Lektionen, 171 Zuege, 117/171 = 68 % ohne Nachdenken nach der lockeren Regel "Haelfte der Zuege haelt das Ziel"); Bilder vorher fehlen noch, darum Kaestchen 1 offen.
- Die lockere Regel zaehlt bei viel Material jeden Zug als gut (zwei-tuerme 23/23): fuer Matts muss "gut" heissen "Mattdistanz hoechstens bester Zug + 1", sonst misst die Zahl nichts. Messung vorher wird mit der strengen Regel wiederholt, bevor sie in einen Text geht.
- Handgebaute Kandidaten waren zu 7 von 13 ungueltig (Schwarz im Schach): Stellungen werden erzeugt (kandidaten/erzeuge.mjs, Zufall mit Saat) und je mit Mattsuche 3M Knoten + Selbstspiel 150k/400k belegt; erste Ernte in kandidaten/gen-*.log (dame bis Matt 9, turm bis 16, laeufer-springer bis 31; zwei-laeufer ohne Treffer).
- Befund Vorher: opposition endet im Selbstspiel zuViele (28 Zuege bei Ziel 9) und dame-bauer nach 3 Zuegen (Ziel 22): Ziele und Wertung dieser Lektionen pruefen, bevor Runden darauf aufbauen.

## Fertig-wenn
node tests/r19-lektionen-besser.test.mjs

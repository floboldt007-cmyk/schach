# Aufgabe: r19-exklusiv-kontrast · 2026-11-18
Ziel: Marke Exklusiv im Shop A (.shf-selten) mit mindestens 4,5:1 Kontrast in hell und dunkel, in Ruhe, Hover und Fokus der Karte, gleiche Form, Farbton nur so weit wie noetig
Modus: BUILD · Klasse: normal · Trace: 2026-11-18--r19-exklusiv-kontrast
Sitzung: 1638d2c8-1b19-4aec-bf28-40febb9cf56c
Todo: 
Graph: ja (T-1643: Abschluss erst, wenn jeder Knoten belegt ist)
Kriterien: ja (T-1712: Abschluss erst, wenn jedes Pflichtkriterium belegt ist)

## Plan
- [x] ROT: tests/r19-exklusiv-kontrast.test.mjs misst jede Seltenheits-Marke (SE, iPhone 13, PC, hell und dunkel, Ruhe/Hover/Fokus) · rot.log 84/91, die 7 Fehler genau Exklusiv hell 4,18:1
- [x] Fix in css/pakete/sammlung.css nur fuer die Marke · 501ae58, eine Regel .shf-karte[data-seltenheit="exklusiv"] .shf-selten
- [x] Nachbar-Suiten ueber den Beleg-Weg · k2.log 4/4 Suiten, 276/276
- [x] Bilder vorher/nachher nach Vault R19-Kritik/exklusiv-kontrast, Pixelvergleich RGB · pixelvergleich.log, pixel-rauschen.log (0)
- [x] design-beweis vorher/nachher · design-vergleich.md
- [x] Audit, Commit, Push nur dieser Zweig, Kaltreview anfordern · audit.log findings=0, Push so/R19-exklusiv-kontrast

## Dateien
```
css/pakete/sammlung.css
tests/r19-exklusiv-kontrast.test.mjs
tests/alle.mjs
```

## Kriterien
Kennungen bis: K4 · Siegel a37ae78d9e72ad20
Arbeitsbaum: C:\Users\Flo\Documents\KI\schach-R19-exklusiv-kontrast · Zweig so/R19-exklusiv-kontrast · Basis c03c590a9ec4389cc89e1da08c656734abdf52d7
Eingefroren: 2026-11-18T00:10:04+01:00 · Hash 8e8a9f587eda77f3 · Siegel f21368a7e96b68ff
- K1 · pflicht · Neuer Test r19-exklusiv-kontrast gruen: jede Seltenheits-Marke >= 4,5:1 auf ihrer Karte, hell und dunkel, Ruhe/Hover/Fokus, SE/iPhone 13/PC · pruefung: lauf · 'C:/Program Files/Git/usr/bin/timeout.exe' 900 node tests/r19-exklusiv-kontrast.test.mjs · stand: belegt datei C:\Users\Flo\Documents\KI\schach-R19-exklusiv-kontrast\.code-guardian-evidence\2026-11-18--r19-exklusiv-kontrast\k1.log
- K2 · pflicht · Nachbar-Suiten gruen · pruefung: lauf · 'C:/Program Files/Git/usr/bin/timeout.exe' 900 node tests/alle.mjs --nur=r19-shop-fortnite,funktion-shop-skin,sammlung,r19-exklusiv-kontrast · stand: belegt datei C:\Users\Flo\Documents\KI\schach-R19-exklusiv-kontrast\.code-guardian-evidence\2026-11-18--r19-exklusiv-kontrast\k2.log
- K3 · pflicht · Bilder vorher/nachher SE, iPhone 13, PC hell und dunkel im Vault R19-Kritik/exklusiv-kontrast, nur die Marke veraendert, Charakter (Gold) erhalten · pruefung: review · kaltreview · stand: offen
- K4 · pflicht · design-beweis auf dem Shop ohne neuen Befund, der Exklusiv-Befund 4,16:1 ist weg · pruefung: review · kaltreview · stand: offen

## Graph
Graph-Start: 2026-11-18T00:09:54+01:00
<!-- belegt setzt nur `aufgabe.py beleg` (geprueft); behauptet zaehlt beim Abschluss wie offen -->
- plan: entfaellt · Auftrag mit Ziel und Dateizaun vom Hauptfenster claude-code-6f (18.11.)
- preflight: belegt · datei C:\Users\Flo\Documents\KI\schach-R19-exklusiv-kontrast\.code-guardian-evidence\2026-11-18--r19-exklusiv-kontrast\preflight-3f.log
- edit: belegt · sha fe37580
- audit: belegt · datei C:\Users\Flo\Documents\KI\schach-R19-exklusiv-kontrast\.code-guardian-evidence\2026-11-18--r19-exklusiv-kontrast\audit.log
- kaltreview: offen
- suite: belegt · datei C:\Users\Flo\Documents\KI\schach-R19-exklusiv-kontrast\.code-guardian-evidence\2026-11-18--r19-exklusiv-kontrast\k2.log
- abschluss: offen

## Erkenntnisse
<!-- Befund · Beleg (Kommando -> Ausgabe) · verworfene Wege — waehrend der Arbeit, nicht am Ende -->
- Ursache: .shf-selten mischt 78 % Seltenheitsfarbe mit --text. Gold #c38f22 ist viel heller als Gruen/Blau/Lila; auf weisser Karte rgb(158,117,32) = 4,18:1 (Probe 4,16). Dunkel bestand die Marke schon. Alle anderen Marken bestehen in beiden Modi (rot.log).
- Fix: nur fuer exklusiv 70 % statt 78 %. Mehr Textfarbe macht die Marke hell dunkler (rgb 145,108,31, 4,81:1) und dunkel heller (rgb 209,172,95, 7,52:1); Farbton 40 -> 41 Grad, Gold bleibt (marke-vorher-links-nachher-rechts.png). Rahmen und Bildverlauf der Karte nutzen --shf-farbe weiter unveraendert.
- Verbraucher der Regel (preflight-3f.log): .shf-selten nur in shop-entwurf.js:115 (Shop A); data-seltenheit="exklusiv" nur auf .shf-karte. Auf c03c590 traegt EINE Karte (Brett) Exklusiv; der Auftrag nannte vier (Stand im Zweig emotes-finisher), der Selektor gilt fuer jede.
- Pixel (RGB, Schwelle 8): nur der kleine Kasten der Marke in hell (iPhone 13 1536 px, SE 555, PC 76), dunkel unter der Schwelle; Rauschen zweier Laeufe auf der Basis 0.
- design-beweis: hell 4 Text-Befunde Exklusiv weg (ruhe/hover/focus/active), sonst nichts neu oder weg; dunkel identisch.
- Kaltreview 6b (1 Warnung): die Regel griff nur bei .shf-karte; die Regal-Karten aus emotes (.shf-rk, shop-entwurf.js:170) tragen dieselbe .shf-selten und blieben hell 4,18:1. Nachweis auf einer Wegwerf-Kopie von ec965f9 (Shop c03c590 und Emotes ec965f9 haben vier Konflikte in fremden Dateien, die loest das Hauptfenster im Sammel): rot-rk.log 336/357, genau 21 Fehler alle Regal-Finisher hell 4,18; gruen-rk.log 357/357 mit :is(.shf-karte, .shf-rk), Regal hell 4,81 / dunkel 7,52. Eigener Zweig k1.log 91/91 (fe37580). Nach dem Sammel einmal auf dem Sammelstand nachfahren (Auftrag Hauptfenster).

## Fertig-wenn
Fertig-Kommando: node tests/r19-exklusiv-kontrast.test.mjs (alle Marken >= 4,5:1), K1-K4 belegt, Kaltreview angefragt

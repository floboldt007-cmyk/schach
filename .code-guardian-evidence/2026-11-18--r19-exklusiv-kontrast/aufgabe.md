# Aufgabe: r19-exklusiv-kontrast · 2026-11-18
Ziel: Marke Exklusiv im Shop A (.shf-selten) mit mindestens 4,5:1 Kontrast in hell und dunkel, in Ruhe, Hover und Fokus der Karte, gleiche Form, Farbton nur so weit wie noetig
Modus: BUILD · Klasse: normal · Trace: 2026-11-18--r19-exklusiv-kontrast
Sitzung: 1638d2c8-1b19-4aec-bf28-40febb9cf56c
Todo: 
Graph: ja (T-1643: Abschluss erst, wenn jeder Knoten belegt ist)
Kriterien: ja (T-1712: Abschluss erst, wenn jedes Pflichtkriterium belegt ist)

## Plan
- [ ] ROT: tests/r19-exklusiv-kontrast.test.mjs misst jede Seltenheits-Marke (SE, iPhone 13, PC, hell und dunkel, Ruhe/Hover/Fokus)
- [ ] Fix in css/pakete/sammlung.css nur fuer die Marke
- [ ] Nachbar-Suiten ueber den Beleg-Weg
- [ ] Bilder vorher/nachher nach Vault R19-Kritik/exklusiv-kontrast, Pixelvergleich RGB
- [ ] design-beweis vorher/nachher
- [ ] Audit, Commit, Push nur dieser Zweig, Kaltreview anfordern

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
- K1 · pflicht · Neuer Test r19-exklusiv-kontrast gruen: jede Seltenheits-Marke >= 4,5:1 auf ihrer Karte, hell und dunkel, Ruhe/Hover/Fokus, SE/iPhone 13/PC · pruefung: lauf · 'C:/Program Files/Git/usr/bin/timeout.exe' 900 node tests/r19-exklusiv-kontrast.test.mjs · stand: offen
- K2 · pflicht · Nachbar-Suiten gruen · pruefung: lauf · 'C:/Program Files/Git/usr/bin/timeout.exe' 900 node tests/alle.mjs --nur=r19-shop-fortnite,funktion-shop-skin,sammlung,r19-exklusiv-kontrast · stand: offen
- K3 · pflicht · Bilder vorher/nachher SE, iPhone 13, PC hell und dunkel im Vault R19-Kritik/exklusiv-kontrast, nur die Marke veraendert, Charakter (Gold) erhalten · pruefung: review · kaltreview · stand: offen
- K4 · pflicht · design-beweis auf dem Shop ohne neuen Befund, der Exklusiv-Befund 4,16:1 ist weg · pruefung: review · kaltreview · stand: offen

## Graph
Graph-Start: 2026-11-18T00:09:54+01:00
<!-- belegt setzt nur `aufgabe.py beleg` (geprueft); behauptet zaehlt beim Abschluss wie offen -->
- plan: offen
- preflight: offen
- edit: offen
- audit: offen
- kaltreview: offen
- suite: offen
- abschluss: offen

## Erkenntnisse
<!-- Befund · Beleg (Kommando -> Ausgabe) · verworfene Wege — waehrend der Arbeit, nicht am Ende -->

## Fertig-wenn
Fertig-Kommando: node tests/r19-exklusiv-kontrast.test.mjs (alle Marken >= 4,5:1), K1-K4 belegt, Kaltreview angefragt

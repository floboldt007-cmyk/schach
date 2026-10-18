# WebKit-Stand

Stand: 17. Oktober 2026. Aufruf lokal mit dem von Playwright installierten WebKit:

```sh
BROWSER=webkit node tests/board.test.mjs
BROWSER=webkit node tests/screens.test.mjs --ohne-bilder
```

WebKit wird tatsächlich gestartet und führt die Prüfungen aus. Folgende Prüfungen sind derzeit rot; sie werden
weder übersprungen noch abgeschwächt:

- `board`: Fünf Unterschiede bei Positionen beziehungsweise Animationen (`Bauer steht auf e4`, Zurückschnappen
  nach einem illegalen Zug, Überstand des Abzeichens auf h8, Zug e7–e5 bei gedrehtem Brett und
  `setzeStellung` ohne Animation).
- `board`: Der anschließende iPad-Teil bricht bei `browserContext.newCDPSession()` ab, weil Playwright CDP-Sitzungen
  nur für Chromium anbietet.
- `screens`: Beim kleinen Handy-Viewport hat der Analyse-Screen 8 px waagrechten Überlauf.
- `screens`: Der anschließende iPad-Touch-Teil bricht aus demselben Grund bei
  `browserContext.newCDPSession()` ab.

Der CI-Job bewahrt die vollständige Ausgabe und erzeugte Screenshots bei einem Fehlschlag als Artefakt auf. Damit
bleiben diese Abweichungen sichtbar, bis die Testtreiber ohne Chromium-spezifisches CDP auskommen und die
Darstellungsunterschiede behoben sind.

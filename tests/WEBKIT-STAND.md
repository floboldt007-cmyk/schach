# WebKit-Stand

Stand: 22. Oktober 2026 (Premium-Umbau U6, Brett). Aufruf lokal mit dem von Playwright installierten WebKit:

```sh
BROWSER=webkit node tests/board.test.mjs
BROWSER=webkit node tests/screens.test.mjs --ohne-bilder
```

Die CI (`.github/workflows`, Job `webkit`) lässt `storage`, `board`, `screens` und `e2e` mit WebKit laufen und
bewahrt Ausgabe und Screenshots bei einem Fehlschlag als Artefakt auf. Hier ist die Entwicklungsumgebung ohne
WebKit (Download gesperrt), deshalb zeigt nur die CI, ob die Punkte unten wirklich grün sind.

## Erledigt mit U6 (im Code, in Chromium geprüft)

- **Kein CDP mehr in den Touch-Teilen.** `tests/board.test.mjs` (Teil „iPad“, Finger-Teil in „W0+a“, neue Teile
  „Pfeile (Finger)“, „Zwei Finger“, „Schwelle“) und `tests/screens.test.mjs` (Teil „Touch (iPad)“, Wischen in der
  Analyse) nutzen `fingerTreiber(seite)` aus `tests/browser.mjs`: synthetische `PointerEvent`s mit
  `pointerType: 'touch'` per `page.evaluate`, pointermove/pointerup gehen an das Element des pointerdown (wie beim
  echten Zeiger-Fang). `page.touchscreen.tap` bleibt für einfache Tipps (gibt es in WebKit). Die Prüfungen sind
  inhaltlich unverändert streng. Damit bricht der iPad-Teil nicht mehr bei `browserContext.newCDPSession()` ab.
- **Keine browserabhängige Rundung mehr bei der Figuren-Lage.** `js/board.js` setzt für Felder, Figuren,
  Überlagerungen, Abzeichen, Umwandlungs-Auswahl und Rand-Koordinaten `left`/`top` als fertig berechnete
  Prozentwerte (`prozent()`), nicht mehr `calc(var(--x) * 12.5%)`. Animiert werden nur `transform` und `opacity`
  (Web Animations API über `js/bewegung.js`). Die fünf Abweichungen vom 17. Oktober sind damit im Code beseitigt:
  - „Bauer steht auf e4“ und „Zug e7–e5 bei gedrehtem Brett“: Lage aus festen Prozenten, Gleiten per `transform`,
    nach dem Ende steht die Figur ohne Transform exakt auf dem Feld.
  - „Zurückschnappen nach einem illegalen Zug“: `_schnappeZurueck` gleitet aus dem Zieh-Transform (px-Text)
    zurück auf `none`; es gibt keine CSS-Transition mehr auf der Figur, die dazwischenfunken könnte (nur noch im
    Zustand `.angehoben`).
  - „Überstand des Abzeichens auf h8“: `_platziereAbzeichen` schiebt das Abzeichen am Rand in die Brett-Box
    (`right: 0` bzw. `top: 0`); Prüfungen für h8, a1 und h1 verlangen jetzt „bleibt in der Box“.
  - „`setzeStellung` ohne Animation“: `animieren: false` setzt `--brett-dauer: 0ms` und platziert ohne jede
    Animation; die Grund-Transition auf `.figur` ist weg.

## Nur die CI kann es zeigen

- Ob WebKit die synthetischen Pointer-Ereignisse im `page.evaluate` genau wie Chromium an das Brett liefert
  (`setPointerCapture` wirft dort bei unbekannter pointerId, das fängt `board.js` ab).
- Ob die Prozent-Lage in WebKit wirklich auf den Pixel mit Chromium übereinstimmt (`figurSitzt` erlaubt 1,5 px).
- `screens`: Beim kleinen Handy-Viewport hat der Analyse-Screen 8 px waagrechten Überlauf (unverändert, gehört zu
  Paket U9/U7, nicht zum Brett).
- `:has()` in `css/app.css` (`.brett-rahmen:has(> .brett.koord-rand)` für die Rand-Koordinaten) braucht Safari ab
  15.4; Zielgerät ist iPadOS ab 16.4, das reicht.

# WebKit-Stand

Stand: 22. Oktober 2026 (Premium-Umbau U6, Brett). Aufruf lokal mit dem von Playwright installierten WebKit:

```sh
BROWSER=webkit node tests/board.test.mjs
BROWSER=webkit node tests/screens.test.mjs --ohne-bilder
```

Die CI (`.github/workflows`, Job `webkit`) lässt `storage`, `board`, `screens`, `e2e`, `notfall`, `bericht` und seit 01.11.2026 `lobby` (Gegnersuche mit dem
Finger, danach reagieren Lobby und Partie; Flo am Handy: "konnte danach nichts mehr anklicken") mit WebKit laufen und
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
- **Schichten ohne Browser-Zufall.** `.brett-felder` ist ausdrücklich ein eigener Stapelkontext (`z-index: 0`), die
  Überlagerungen (Auswahl, Schach-Hof, letzter Zug, Flos Marken) liegen darin und damit unter den Figuren. Vorher hing
  das daran, ob `container-type` einen Stapelkontext bildet (Chromium tut es nicht, für WebKit ist das nicht
  gesichert): in Chromium lagen Auswahl und Schach-Hof über der Figur. Prüfung per Pixelvergleich
  (Teil „Optik“).
- **Finger-Tipp aufs Ziel zieht beim Loslassen** (vorher beim Aufsetzen), damit ein zweiter Finger oder ein
  `pointercancel` von iPadOS (Systemgeste) den Zug noch zurücknehmen kann. `page.touchscreen.tap` und der
  `fingerTreiber` liefern beide `pointerup`, die Tests laufen in beiden Engines gleich.
- **Bewertungsbalken** (`css/app.css`): der Weiß-Anteil ist volle Höhe und wird per `translateY(calc(100% - var(--w)))`
  verschoben, statt `height` zu animieren (nur `transform`); `--w` setzt die Partie wie bisher.

## Nur die CI kann es zeigen

- Ob WebKit die synthetischen Pointer-Ereignisse im `page.evaluate` genau wie Chromium an das Brett liefert
  (`setPointerCapture` wirft dort bei unbekannter pointerId, das fängt `board.js` ab).
- Ob die Prozent-Lage in WebKit wirklich auf den Pixel mit Chromium übereinstimmt (`figurSitzt` erlaubt 1,5 px).
- `screens`: Beim kleinen Handy-Viewport hat der Analyse-Screen 8 px waagrechten Überlauf (unverändert, gehört zu
  Paket U9/U7, nicht zum Brett).
- `:has()` in `css/app.css` (`.brett-rahmen:has(> .brett.koord-rand)` für die Rand-Koordinaten) braucht Safari ab
  15.4; Zielgerät ist iPadOS ab 16.4, das reicht.
- Ob ein echter Finger auf dem iPad beim Malen (Halten 400 ms, dann ziehen) dieselben Ereignisse liefert wie der
  Treiber; die Zeichen-Geste stoppt `pointermove`/`pointerup` an der Brett-Grenze (`stopPropagation`), das Aufsetzen
  geht noch an die Umgebung (Wischen der Analyse setzt dort nur seinen Startpunkt).
- Synthetische Ereignisse lösen keine Standard-Aktionen des Browsers aus (Scrollen, Zoom, Klick-Nachzügler). Ob ein
  echter Finger auf dem iPad dabei etwas anderes tut, zeigt erst Flos Test auf dem Gerät (`touch-action: none` am
  Brett soll genau das verhindern).

## Bewusst offen (anderes Paket)

- `.effekt-ort` (Welle, Ringe, Funken der Partie) liegt weiter über `calc(var(--x) * 12.5%)`, weil `js/ui/partie.js`
  die Lage setzt (Paket U7). Für Pixel-Gleichheit in WebKit dort `left`/`top` als fertige Prozente setzen wie in
  `board.js` (`x * 12.5 + '%'`). Bei Effekten fällt ein Bruchteil eines Pixels nicht auf, deshalb kein Blocker.

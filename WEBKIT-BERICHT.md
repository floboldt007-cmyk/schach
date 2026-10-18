# WebKit-Prüfung (Safari-Engine)

Geprüft am 17. Oktober 2026 mit Playwright/WebKit. Das Prüfskript startet die App unter `/schach/` auf Port 8890
und spielt in jeder Größe eine vollständige Partie gegen Bauer Benno per Touch (Schäfermatt nach sieben
Halbzügen). Geprüfte Größen: iPad quer (1180 × 820), iPad hoch (820 × 1180) und iPhone (390 × 844).

## Befund

### Ergebnis · iPhone 390 × 844: Schaltfläche „Brett ansehen“ ragt rechts heraus

Nach dem Matt liegt die rechte Kante der runden Augen-Schaltfläche etwa 2 px außerhalb des Viewports. Der Inhalt
der Seite erzeugt zwar keine horizontale Scrollleiste, die Schaltfläche wird am rechten Rand jedoch sichtbar
angeschnitten. Das Problem trat reproduzierbar nach allen vier per Touch eingegebenen weißen Zügen auf.

Screenshot: [`tests/webkit-shots/iphone-ergebnis.png`](tests/webkit-shots/iphone-ergebnis.png)

**Vermutete Ursache:** Die Ergebnis-Karte nutzt `width: min(100%, 580px)` innerhalb eines Overlays mit 16 px
Seitenabstand. Zusammen mit Rahmen bzw. Boxmodell wird die Karte auf dem 390-px-Viewport geringfügig breiter als
der verfügbare Inhaltsbereich. Die absolut mit `right: 8px` platzierte `.erg-zu`-Schaltfläche folgt dieser rechten
Kartenkante und landet dadurch außerhalb des Viewports. Dies ist eine Vermutung; App-Dateien wurden entsprechend
dem Prüfauftrag nicht verändert.

## Was funktioniert

- WebKit unterstützt WebAssembly-SIMD; Stockfish lädt seine WASM-Datei in allen drei Größen und liefert eine Suche
  bis mindestens Tiefe 6 samt bestem Zug.
- Jede Partie ließ sich vollständig durch Antippen von Ausgangs- und Zielfeld spielen und endete erwartungsgemäß
  mit „SIEG!“ gegen Bauer Benno.
- Der erste echte Touch entsperrte WebAudio in allen drei Durchläufen (`klang.zustand() === 'bereit'`), ohne
  Konsolen- oder Seitenfehler.
- Arena, Partie, Analyse, Verlauf und Einstellungen hatten in allen drei Größen keinen horizontalen Überlauf.
  Namen und Titel wurden nicht abgeschnitten.
- Alle sichtbaren Schaltflächen waren in jeder geprüften Ansicht mindestens 44 × 44 px groß und erreichbar.
- Analyse, Verlauf und Einstellungen ließen sich nach der Partie in allen drei Größen öffnen. Während der gesamten
  Prüfung gab es keine Konsolenfehler, unbehandelten Seitenfehler oder HTTP-Antworten ab Status 400.

## Screenshots

Für jede Größe liegen sechs Aufnahmen unter `tests/webkit-shots/`: `arena`, `partie`, `ergebnis`, `analyse`,
`verlauf` und `einstellungen`. Die Dateinamen beginnen mit `ipad-quer-`, `ipad-hoch-` bzw. `iphone-`.

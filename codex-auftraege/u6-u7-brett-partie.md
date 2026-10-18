# Auftrag für Codex: Brett, Partie und Handy (Umbau-Pakete U6 und U7)

Basis: Zweig `codex/u6-u7-brett-partie`, abgezweigt von `main`.
Der Umbau-Plan liegt jetzt im Repo: `design/runde4/umbau/PLAN.md`. Pfade darin übersetzen:
`entwuerfe/a-modern/...` = `design/runde4/umbau/entwurf-a/...`, `entwuerfe/c-arcade/...` = `design/runde4/umbau/entwurf-c/...`
(Bilder von C unter `entwurf-c/vorschau/`), `umbau-a/shots/soll-*.png` = `design/runde4/umbau/soll/`.
Entscheidungen des Besitzers: `design/runde4/ENTSCHEIDUNGEN.md` (gilt vor dem Plan). Zeilenangaben im Plan sind alt, selbst suchen.
Schon fertig und live, nicht neu bauen: U1, U2, U3, U4 (Klartext-Namen), Vorzüge (Premoves), Sicherung (Export/Import).
Andere Pakete nicht anfassen. Speicherformat nur erweitern, alte Spielstände müssen gültig bleiben.

Pflicht am Ende: `node tests/sw.test.mjs --aktualisieren`, dann `node tests/alle.mjs` komplett grün (Chromium).
Keine Prüfung abschwächen oder überspringen; Selektoren nur dort anpassen, wo der Plan es vorsieht.
Du kannst nicht pushen: setze ans Ende deiner Antwort eine kurze Liste der geänderten Dateien und der Testergebnisse.
Diese Auftragsdatei löschen. Halte dich an `AGENTS.md`.

## Was zu tun ist

Plan Abschnitt 6, Pakete **U6 Brett: Optik und Komfort** und danach **U7 Partie, Ergebnis, Handy**, mit allen dort
genannten Unterabschnitten (2.4, 2.5, 2.6, 3.7, 4). U6 zuerst, U7 baut darauf auf.

Wünsche des Besitzers, die besonders zählen:
1. **Pfeile und Markierungen malen** wie bei Lichess: Rechtsklick ziehen = Pfeil, Rechtsklick auf ein Feld = Feld
   markieren, erneut = weg, Linksklick ins Brett löscht alles. Auf Touch: langes Drücken und Ziehen = Pfeil (darf
   Vorzüge und Ziehen nicht stören). Farben aus den Tokens von A, keine festen Farben.
2. **Brett auf dem Handy groß**: Die Maße aus 2.5 sind harte Prüfungen (Brett ≥ Breite − 2 × 12 − 8 bei 390 × 844,
   375 × 667 und 390 × 664), alles in einer Spalte, Balken über dem Brett.
3. Die Vorzüge (Premoves) aus `js/ui/partie.js` und `js/board.js` bleiben voll erhalten und getestet.

Neue Tests für die Pfeile in `tests/board.test.mjs` (Maus und Touch, beide Ausrichtungen).

## Zusätzlich: WebKit (iPhone/iPad des Besitzers)

Der CI-Job `webkit` ist rot (siehe `tests/WEBKIT-STAND.md`). Im Rahmen von U6/U7 bitte beheben:
- Die fünf Positions-/Animationsunterschiede in `board` unter WebKit (echte Ursache finden, nicht die Prüfung lockern).
- Die Touch-Teile von `board` und `screens` brauchen einen Treiber ohne `newCDPSession()` (z. B. synthetische
  Pointer-/Touch-Ereignisse per `dispatchEvent`), der in Chromium und WebKit gleich läuft; die Chromium-Prüfungen
  bleiben inhaltlich gleich streng.
Prüfen mit `BROWSER=webkit node tests/alle.mjs --nur=storage,board,screens,e2e`; `tests/WEBKIT-STAND.md` nachführen.

# Auftrag für Codex: „Zu zweit am Brett“ (zwei Menschen an einem iPad)

Erst `codex-auftraege/REGELN-CODEX.md` lesen. Arbeitszweig `codex/zu-zweit`, PR gegen `claude/integration`.

## Was es ist

`design/runde4/SPIELKONZEPT.md`, Abschnitt 3.7 (Spielmodi mit Schachuhr, Tabelle der Spielhalle), Zeile „Zu zweit am Brett“:

> zwei Menschen an einem iPad, mit Schachuhr, Brett dreht sich auf Wunsch; danach Analyse für beide Seiten. Zählt nur
> fürs Tageswerk (wie eine freie Partie), nie für Wertung, Funken oder Tafeln.

## So umsetzen

Begründe Abweichungen im PR-Text.

1. **Einstieg:** eine Karte „Zu zweit“ im Training (Ort `training:karten`).
   - Sie wird von einem kleinen Paket `js/pakete/zuzweit/index.js` angeboten und in `js/erweiterungen.js` (`PAKETE`)
     eingetragen.
   - Wie Orte bedient werden, zeigt `tests/app.test.mjs`, Teil `--erweiterungen`.
   - Die Karte öffnet ein kurzes Startblatt:
     - **Namen:** zwei Felder, vorbelegt mit „Weiß“ und „Schwarz“, höchstens 20 Zeichen, nur lokal gespeichert
     - **Bedenkzeit:** ohne Uhr, 5+0, 10+0, 15+10
     - **„Brett nach jedem Zug drehen“:** an oder aus, Standard aus
     - Knopf „Los“
2. **Partie:** Der Partie-Screen (`js/ui/partie.js`, `#partie`) bekommt den Modus `zuzweit`.
   - Kein Bot, keine Engine-Antwort. Beide Seiten ziehen per Tippen und Ziehen.
   - Die zwei Spielerkarten zeigen die Namen und eine Figur als Bild statt eines Bot-Porträts.
   - Uhr wie bei der Bot-Partie (W0+b), beide Seiten laufen.
   - **Während der Partie keine Hilfe:** kein Bewertungsbalken, keine Live-Zugbewertung, keine Coach-Sätze, keine
     Hinweise, keine Rücknahme. Das ist fair zwischen zwei Menschen.
   - Erlaubt sind „Remis anbieten“ (die andere Person tippt „Annehmen“) und „Aufgeben“ für die Seite am Zug.
   - **Drehen:** Mit der Option dreht sich das Brett nach jedem Zug zur Seite am Zug, ruhig und mit `js/bewegung.js`.
     Ohne die Option steht Weiß unten, und die Spielerkarte oben ist zur Lesbarkeit um 180° gedreht.
3. **Speicher:**
   - `partie.modus = 'zuzweit'`, `MODI` in `js/storage.js` entsprechend erweitern. Alte Stände bleiben gültig.
   - `wertet()` liefert dafür `false`. Damit gibt es keine Sterne, keine Freischaltung, keine Wertung, keine Funken.
   - Die Namen kommen in ein Feld der Partie, zum Beispiel `zuzweit: { weiss, schwarz }`, in `pruefe...` mit
     Längenbegrenzung.
   - Die Partie erscheint im Verlauf als „Zu zweit: Anna gegen Ben“.
4. **Ergebnis:**
   - Das Ergebnis nennt den Sieger beim Namen, ohne Sterne und ohne Freischaltung.
   - Knöpfe: „Analyse“, „Revanche“ (gleiche Namen, Farben getauscht), „Fertig“.
5. **Analyse:**
   - Der vorhandene Analyse-Screen zeigt beide Seiten mit Genauigkeit und Klassen-Tabelle.
   - Die Texte sprechen niemanden mit „du“ an, sondern nennen die Namen oder die Farbe.
   - Prüfe, wo `js/ui/analyse.js` von Flos Farbe ausgeht, und behandle `zuzweit` neutral.
6. **Tageswerk:** Eine Partie zu zweit ab 10 Zügen zählt als Partie fürs Tageswerk, wie eine freie Partie. Wenn das
   heute noch nirgends gezählt wird, unter „Offen“ nennen und nichts erfinden.
7. **Tests** `tests/zuzweit.test.mjs`, eingetragen in `tests/alle.mjs`:
   - Startblatt mit Namen, Uhr und Drehen
   - beide Seiten ziehen, kein Bot-Zug
   - Uhr läuft für die Seite am Zug
   - Drehen an und aus
   - Remis-Angebot und Annahme, Aufgabe
   - Ergebnis ohne Sterne, Verlaufseintrag, Analyse beider Seiten
   - `wertet() === false`, alte Spielstände bleiben gültig (`storage.test.mjs`)
   - Bildschirme 1180 × 820 und 820 × 1180, hell und dunkel, sowie 390 × 844
   - `tests/app.test.mjs`, `screens.test.mjs`, `e2e.test.mjs`, `fairness.test.mjs` und `thema.test.mjs` bleiben grün

## Nicht anfassen

- Weltkarte: `js/ui/arena.js`, `js/ui/duell.js`
- Pakete anderer Zweige
- `js/board.js`. Das Brett kann schon `setzeAusrichtung`, nutze es nur.

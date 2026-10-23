# Auftrag für Codex: Oberfläche für Online-Partien gegen Freunde

Erst `codex-auftraege/REGELN-CODEX.md` lesen. Arbeitszweig `codex/online-oberflaeche`, PR gegen `claude/integration`.

## Was schon da ist

- **Server:** Supabase, im echten Projekt schon eingespielt.
  - Schema: `supabase/online-schema.sql`
  - RLS-Test: `supabase/online-rls-test.sql`
  - Erklärung: `supabase/ANLEITUNG.md`, Abschnitt „Online gegen Freunde“
  - Die SQL-Dateien **nicht ändern.** Fehlt etwas auf dem Server, im PR-Text beschreiben, Claude spielt es ein.
- **Client:** `js/online.js`, nur `fetch`, getestet in `tests/online.test.mjs`. Exporte:
  - `erstelleEinladung({ farbe, bedenkzeit, inkrement })`: `farbe` ist `'w' | 'b' | 'zufall'`, Zeiten in Sekunden,
    `null` heißt ohne Uhr
  - `tritteBei(code)`, `ladePartie(id)`, `meinePartien()`
  - `sendeZug(id, { uci, fenDanach, amZugDanach, ergebnis, grund })`
  - `gibAuf`, `bieteRemis`, `nimmRemisAn`, `pruefeZeit`
  - `beobachte(id, { beiAenderung, beiFehler, bisEnde })`: Abfrage alle 2 s, pausiert bei verborgener Seite, wächst
    bei Fehlern
  - `einladungsLink`, `codeAusLink`, `uebernimmEinladungsLink`, `gemerkteEinladung`, `vergissEinladung`
  - `meineFarbe`, `binAmZug`, `zuegeListe`
  - `FEHLER_TEXTE`: freundliche deutsche Sätze
- **Konto:** `js/konto.js` mit Anmeldung per E-Mail-Code, Google und `sitzung()`.
- **Regeln:** Der Server prüft Zugrecht, Reihenfolge und Uhr, aber nicht die Schachregeln. Beide Clients prüfen mit
  chess.js. `ARCHITEKTUR.md`, Abschnitt „Online gegen Freunde“, beschreibt den Datensatz und die Uhr-Regeln.

## So umsetzen

Begründe Abweichungen im PR-Text.

1. **Screen `online`** (`js/ui/online.js`, `css/online.css`): Eintrag in `SCREENS` und `TITEL` in `js/app.js`, Route
   `#online`.
   - **Ohne Anmeldung:** ruhiger Hinweis „Für Partien gegen Freunde brauchst du ein Konto“ mit Knopf zu
     Einstellungen, Konto.
   - **Startseite des Screens:**
     - **„Freund einladen“:** Farbe (Weiß, Schwarz, Zufall) und Bedenkzeit (ohne Uhr, 5+0, 10+0, 15+10). Mehr als 3 h
       erlaubt der Server nicht.
     - **„Code eingeben“:** 6 Zeichen, normalisiert über `normalisiereCode`
     - **„Meine Partien“:** offen, laufend, beendet, aus `meinePartien()`
   - **Nach dem Erstellen:** Code groß anzeigen, dazu den Link mit „Teilen“ (`navigator.share`, sonst Kopieren). Hinweis:
     „Die Einladung gilt 24 Stunden.“ Warten auf den Freund über `beobachte`.
2. **Einladungslink:**
   - `js/app.js` liest `#online/CODE` **vor** dem Routing über `uebernimmEinladungsLink()`. Der Code wird gemerkt, dann
     geht es zum Screen `online`, der den Beitritt anbietet.
   - Ohne Anmeldung bleibt die Einladung gemerkt (`gemerkteEinladung`) und kommt nach der Anmeldung wieder.
   - Heute fällt `#online/CODE` still auf die Arena zurück. Prüfe die Tests, die das voraussetzen, und passe sie
     gleich streng an.
3. **Partie:** eigener Ablauf im Screen `online`, nicht in `js/ui/partie.js`. Das hält die Bot-Partie unberührt.
   - Brett über `js/board.js` wie in der Partie, die eigene Farbe unten.
   - Zwei Spielerkarten: Gegner oben mit Benutzernamen, sonst „Freund“, und mir unten. Dazu die Uhren aus
     `uhr_weiss_ms`, `uhr_schwarz_ms` und `letzter_zug_am`. Die Uhr der Seite am Zug läuft lokal herunter.
   - Ein eigener Zug wird mit chess.js geprüft, dann `sendeZug` mit `fenDanach`, `amZugDanach` und bei Matt, Patt,
     Remis durch Material oder dreifacher Wiederholung mit `ergebnis` und `grund`. Schlägt das Senden fehl, kommt der
     Zug zurück, dazu eine Meldung aus `FEHLER_TEXTE`.
   - Gegnerzüge kommen über `beobachte`. Jede neue Stellung wird mit chess.js nachgespielt. Passt sie nicht, gibt es
     einen ruhigen Hinweis, und die Partie bleibt stehen.
   - Läuft die Uhr des Gegners auf 0, ruft der Client `pruefeZeit(id)`.
   - Knöpfe: „Remis anbieten“, „Remis annehmen“ (nur wenn ein Angebot da ist) und „Aufgeben“ mit Rückfrage.
   - **Kein Chat**, keine Emotes. Die kommen später.
   - Ergebnis-Karte mit Sieg, Niederlage oder Remis und Grund, ohne Sterne und ohne Wertung. Knopf „Revanche“ (neue
     Einladung, Farben getauscht).
   - Verbindung weg: Die Partie steht auf dem Server, und beim nächsten Öffnen geht sie weiter.
4. **Lokaler Verlauf:**
   - In dieser ersten Fassung werden Online-Partien **nicht** in den lokalen Verlauf geschrieben. Sie liegen auf dem
     Server und stehen unter „Meine Partien“.
   - Wenn du eine Analyse anbieten willst, gilt: nur lokal, und `modus: 'online'` muss in `wertet()` falsch sein.
5. **Einstieg:** eine Karte „Gegen Freunde“ im Training (Ort `training:karten`), angeboten von einem kleinen Paket
   `js/pakete/online/index.js` in `PAKETE`. Sie öffnet `#online`.
6. **Datenschutz:** In `datenschutz.html` kommt ein Abschnitt „Online-Partien gegen Freunde“:
   - Was gespeichert wird: beide Konto-IDs, Züge, Stellung, Uhr, Einladungscode, Zeitpunkte.
   - Wer es sieht: nur die beiden Spieler.
   - Löschen: mit dem Konto, per Kaskade.
   - Auskunft: in „Meine Daten herunterladen“.

   Im gleichen Ton wie der Rest der Seite. `tests/daten.test.mjs` prüft die Seite, halte sie grün.
7. **Tests** `tests/online-ui.test.mjs`, eingetragen in `tests/alle.mjs`. Der Browser-Teil fängt alle Anfragen an
   `*.supabase.co` per `page.route` ab. Das Muster zeigt `tests/konto.test.mjs`. Zu prüfen:
   - ohne Anmeldung: Hinweis
   - Einladung erstellen: Code und Link, Teilen-Rückfall Kopieren
   - Beitritt per `#online/CODE`, mit und ohne Anmeldung
   - Zug senden, Fehlerfall: Zug kommt zurück
   - Gegnerzug kommt an
   - illegale Server-Stellung führt zum Hinweis
   - Uhr läuft und `pruefeZeit` bei 0
   - Remis anbieten und annehmen, Aufgabe
   - Ergebnis
   - Bildschirme 1180 × 820, 820 × 1180, 390 × 844, hell und dunkel
   - `online.test.mjs`, `app.test.mjs`, `e2e.test.mjs`, `daten.test.mjs`, `fairness.test.mjs` und `thema.test.mjs`
     bleiben grün

## Nicht anfassen

- `js/ui/partie.js`, `js/ui/arena.js`, `js/ui/duell.js`, `js/board.js`. Das Brett nur benutzen.
- `supabase/*.sql`
- Pakete anderer Zweige

# Auftrag für Codex: WebKit-Prüfung (Safari-Engine)

Der Besitzer spielt die App auf dem iPad in Safari. Die Testsuiten im Repo laufen nur mit Chromium. Bitte prüfe die
App mit WebKit und schreibe einen Bericht. **Keine App-Dateien ändern.**

1. Playwright mit WebKit nutzen (die Umgebung installiert es im Setup: `npm install --no-save playwright` und
   `npx playwright install --with-deps webkit chromium`).
2. Neues Prüfskript `tests/webkit.test.mjs` (Stil wie die anderen Suiten, eigener Port, z. B. `PORT=8890`): App über
   einen lokalen Server öffnen, in drei Größen mit Touch: iPad quer 1180x820, iPad hoch 820x1180, iPhone 390x844.
   Eine ganze Partie gegen den ersten Bot (Bauer Benno) spielen, dann Ergebnis, Analyse, Verlauf, Einstellungen.
3. Prüfen: keine Konsolenfehler; Stockfish lädt (WebAssembly mit SIMD); Züge per Tippen funktionieren; nichts läuft
   über den Rand; Namen und Titel werden nicht abgeschnitten; Knöpfe sind erreichbar und mindestens 44 px groß;
   Klang-Freischaltung nach dem ersten Tipp ohne Fehler.
4. Screenshots jeder Ansicht nach `tests/webkit-shots/`.
5. Bericht `WEBKIT-BERICHT.md` (Datei gibt es schon als Platzhalter): je Befund Ansicht, Größe, was passiert,
   Screenshot, Vermutung zur Ursache. Was funktioniert, kurz auflisten.
6. Diese Auftragsdatei am Ende löschen. Halte dich an `AGENTS.md`.

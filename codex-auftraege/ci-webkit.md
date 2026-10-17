# Auftrag für Codex: Automatische Tests auf GitHub (Chromium und WebKit)

Ziel: Jeder Push und jeder Pull Request wird auf GitHub selbst getestet, auch mit WebKit (Safari-Engine), weil der
Besitzer auf dem iPad spielt. Das ist für öffentliche Repos kostenlos.

1. Neue Datei `.github/workflows/tests.yml`:
   - Auslöser: `push` (alle Zweige) und `pull_request`.
   - Ubuntu, Node 22, `npm install --no-save playwright`, `npx playwright install --with-deps chromium webkit`.
   - Bei Push: `node tests/alle.mjs --schnell`. Bei Pull Request: `node tests/alle.mjs` (volle Suite).
   - Zusätzlicher Job: WebKit-Lauf für die Browser-Suiten `storage`, `board`, `screens`, `e2e`.
   - Bei Fehlern Logs und Screenshots als Artefakte hochladen.
2. Damit WebKit geht: Die Suiten starten heute fest `chromium.launch()`. Füge einen Schalter über die
   Umgebungsvariable `BROWSER` hinzu (`chromium` als Standard, `webkit` wahlweise), ohne bestehende Prüfungen zu
   ändern oder abzuschwächen. Ohne `BROWSER` verhält sich alles genau wie vorher.
3. Lokal prüfen, dass `node tests/alle.mjs --schnell` weiter grün ist und mindestens eine Suite mit `BROWSER=webkit`
   läuft. Was unter WebKit rot ist, nicht verstecken, sondern in `tests/WEBKIT-STAND.md` auflisten.
4. Diese Auftragsdatei am Ende löschen. Halte dich an `AGENTS.md`.

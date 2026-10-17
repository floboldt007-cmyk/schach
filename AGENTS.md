# AGENTS.md

Hinweise für KI-Agenten in diesem Repository, vor allem für OpenAI Codex. Gebaut wird hauptsächlich mit Claude Code,
Codex ist der unabhängige Prüfer. Die beiden prüfen sich gegenseitig, damit Fehler auffallen, die einer allein übersieht.

## Projekt

- Schach-Arena: Web-App (PWA) ohne Build-Schritt, Vanilla-JS mit ES-Modulen, Stockfish als WASM-Worker (`vendor/`),
  chess.js. Lizenz GPL-3.0.
- Live über GitHub Pages aus `main`: https://floboldt007-cmyk.github.io/schach/
- Aufbau und Schnittstellen: `ARCHITEKTUR.md`.
- Verbindliche Entscheidungen des Besitzers: `design/runde4/ENTSCHEIDUNGEN.md` (gilt vor allen älteren Plänen).
  Spielkonzept mit Fairness-Regeln: `design/runde4/SPIELKONZEPT.md`.

## Tests

- Alles: `node tests/alle.mjs` (braucht Node und Playwright mit Chromium; Pfad notfalls über `PLAYWRIGHT_PFAD`).
  Die Suiten nutzen feste Ports, also nicht zwei Läufe gleichzeitig starten.
- Nach jeder Änderung an Dateien der App: `node tests/sw.test.mjs --aktualisieren` (Offline-Cache im Service Worker).

## Zusammenarbeit

- Claude Code arbeitet auf Zweigen `claude/*` und merged nach `main`, wenn alle Tests grün sind.
- Codex pusht nie auf `claude/*` und nie auf `main`. Eigene Änderungen kommen auf einen Zweig `codex/*` mit
  Pull Request. Claude prüft ihn, bevor er gemergt wird.
- Ein Befund braucht einen Beleg: Datei und Zeile, dazu ein Weg, wie man den Fehler nachstellt. Vermutungen als
  solche kennzeichnen.
- Sprache: Deutsch, Commit-Nachrichten auf Deutsch.

## Regeln

- Öffentliches Repo: keine Preise, Geschäftszahlen, Zugangsdaten oder persönlichen Daten.
- Nichts von anderen Schach-Apps kopieren (Texte, Grafiken, Klänge, Namen). Fremde Dateien nur unter MIT, Apache,
  CC0, CC BY, CC BY-SA oder OFL, mit Quellenangabe.
- Fairness: keine Lootboxen oder Zufallskäufe, kein Pay-to-win, keine Fantasie-Währung, keine versteckten Preise,
  keine Druck- oder Schuldgefühl-Texte, keine Werbung. Bots spielen nie heimlich schwächer, als angegeben.

## Code Review Rules

- Melde Änderungen, die gegen die Fairness-Regeln oben verstoßen, auch in Texten und Knöpfen.
- Melde Tageslogik über `toISOString()` oder UTC-Datum. Tage und Wochen kommen aus `js/tag.js` (Tagesgrenze 4:00 Uhr
  Ortszeit).
- Melde Änderungen am Speicherformat in `js/storage.js` ohne Weg für alte Spielstände.
- Melde gelöschte, übersprungene oder abgeschwächte Tests.
- Melde Zugangsdaten im Code. Erlaubt im Browser ist nur ein öffentlicher Supabase-Schlüssel (publishable oder
  anon), nie ein service_role- oder Secret-Schlüssel.
- Formatierung und Stil nicht melden.

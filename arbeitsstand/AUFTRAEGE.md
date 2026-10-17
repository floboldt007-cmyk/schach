# Aufträge für Codex (Sparmodus, Flo 17.10.)

Start erst, wenn Flo die Codex-Umgebung für `floboldt007-cmyk/schach` angelegt hat. Pro Auftrag: Zweig `codex/<name>`
mit Platzhalter, Entwurfs-PR, Auftrag als `@codex`-Kommentar. Flo: diese PRs nicht selbst mergen.
Höchstens zwei Codex-Aufträge gleichzeitig (Codex-Kontingent).

## 1. webkit-pruefung (Bericht, keine App-Änderung)
Basis `main`, PR nach `main`. Text wie in PR #3 (Kommentar 6236956451): Playwright mit WebKit, eigenes
`tests/webkit.test.mjs`, ganze Partie in iPad quer/hoch und iPhone, Screenshots, `WEBKIT-BERICHT.md`.

## 2. ci-webkit (GitHub Actions)
Basis `main`, PR nach `main`. Neue Datei `.github/workflows/tests.yml`:
- bei jedem Push und PR: Node 22, `npm install --no-save playwright`, `npx playwright install --with-deps chromium webkit`
- `node tests/alle.mjs --schnell` bei Push, volle Suite bei PR
- zusätzlich WebKit-Lauf für storage, board, screens, e2e (Suiten bekommen einen Schalter für die Browser-Engine,
  z. B. Umgebungsvariable `BROWSER=webkit`, ohne bestehende Chromium-Läufe zu ändern)
- Artefakte: Screenshots und Logs bei Fehlern
Danach Hinweis an Flo: Branch-Schutz für `main` (PR nötig, Prüfung grün) in den Repo-Einstellungen.

## 3. lektorat (nur Dokumente)
Basis `claude/umbau-look-a`, PR nach `claude/umbau-look-a`. `design/runde4/SPIELKONZEPT.md` an
`design/runde4/ENTSCHEIDUNGEN.md` angleichen (ENTSCHEIDUNGEN gilt). Liste der Widersprüche aus der Gesamtschau:
siehe widersprueche.txt (wird in den Auftrag kopiert). Nur Dokumente ändern, keine App-Dateien. Am Ende Tabelle:
Stelle, alt, neu.

## 4. stockfish-quelle (GPL-Pflicht)
Basis `main`, PR nach `main`. `vendor/stockfish/QUELLE.md`: Version, Commit, Netz-Datei mit Lizenz, wie man die
Dateien selbst baut; „Info und Lizenzen“ in der App verlinkt auf das Quell-Tag (nur Text in README, App-Code nicht
ändern, das macht der Umbau).

## Später (nach dem Umbau)
- Sicherheitsprüfung „@codex security review“ vor dem Online-Teil
- Rätsel-Fabrik (`werkzeuge/raetsel-fabrik.mjs`, S1-5), wenn die Datenquelle geklärt ist

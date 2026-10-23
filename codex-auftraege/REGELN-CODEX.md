# Gemeinsame Regeln für Codex-Aufträge (Crownmate)

Gilt für jeden Auftrag unter `codex-auftraege/`. Den Auftrag hat Claude Code für den Besitzer Flo geschrieben.
Claude prüft danach den Pull Request und führt ihn zusammen.

## Rahmen

- **Basis:** `claude/integration`. Das ist `main` plus alles aus Stufe 2: Weltkarte, Brett und Partie, Liga, Funken,
  Punkte, Serie, Teilen, Gedächtnis, Kartei, Willkommen, Zu zweit, Online, Abo, Coach und Schule.
- **Arbeitszweig:** der im Auftrag genannte `codex/...`-Zweig. Zweig ihn von `claude/integration` ab, falls es ihn noch
  nicht gibt.
- **Pull Request:** gegen `claude/integration`. Nie auf `main` oder `claude/*` pushen (`AGENTS.md`).
- **Parallel** arbeitet Claude am Sammelzweig:
  - Livegang von Stufe 2: `js/erweiterungen.js` (PAKETE, REITER), `sw.js`, Kopfzeile in `css/navigation.css`
  - danach die Welten mit 30 Bots

  Diese Stellen änderst du nur, wenn dein Auftrag es ausdrücklich sagt. `sw.js` stempelst du mit
  `node tests/sw.test.mjs --aktualisieren`, Konflikte dort löst Claude beim Zusammenführen.
- **Sprache:** Deutsch in Oberfläche, Kommentaren und Commits. In Code-Kommentaren und Commit-Nachrichten stehen
  Umlaute als ae/oe/ue/ss, in Oberflächentexten echte Umlaute.

## Erst lesen

- `AGENTS.md`
- `design/runde4/ENTSCHEIDUNGEN.md`: Entscheidungen des Besitzers, sie gelten vor allen Plänen
- `ARCHITEKTUR.md`: die Teile zu den Dateien, die du änderst
- die Dateien, die du änderst, vollständig, und die Tests, die sie prüfen

## Unverrückbar

- **Tests nie abschwächen, überspringen oder löschen.** Jede `pruefe(...)`-Prüfung bleibt mindestens so streng. Neue
  Funktionen bekommen neue Prüfungen.
- **Test-Haken bleiben:** Klassen, IDs, `data-*`-Attribute, `window.__partie`, `window.__app`, `window.demo`,
  Ereignis- und Ortsnamen. Bevor du einen Selektor entfernst, suche ihn in `tests/` (`grep`).
- **Speicherformat** (`js/storage.js`): nur erweitern, alte Spielstände bleiben gültig.
- **Nur Tokens** aus `css/tokens.css` und `css/themes/modern.css`, hell und dunkel. `tests/thema.test.mjs` prüft
  die Lint-Regeln.
- **Look A:**
  - kein Neon, kein Glow, kein Konfetti
  - nur `transform` und `opacity` animieren, über `js/bewegung.js`
  - Bewegung „aus“ und `prefers-reduced-motion` werden respektiert
- **Fairness** (`AGENTS.md`, `design/runde4/SPIELKONZEPT.md` Abschnitt 5):
  - keine Druck- oder Schuldgefühl-Texte
  - kein Kauf, keine Lootboxen
  - Bots spielen nie heimlich schwächer
- **Repo-Regeln:** Nichts von chess.com oder Lichess kopieren. Keine Preise, keine persönlichen Daten, keine
  Zugangsdaten. Erlaubt ist nur der öffentliche Supabase-Schlüssel, der schon in `js/konto-config.js` steht.
- **Tageslogik** nur über `js/tag.js`, nie über `toISOString()`.
- Tippflächen mindestens 44 px. Zielgerät ist das iPad mit Safari, quer und hoch. Das Handy muss ebenfalls gehen.

## Tests

- **Nach jeder Änderung an App-Dateien:**
  1. `node tests/sw.test.mjs --aktualisieren` (Offline-Cache)
  2. danach `node tests/sw.test.mjs`
- **Volle Suite:** `node tests/alle.mjs`. Sie braucht Playwright mit Chromium. Für WebKit:
  `npx playwright install --with-deps webkit`, dann `BROWSER=webkit node tests/<suite>.test.mjs`.
- **Ports:** Die Suiten nutzen feste Ports. Starte keine zwei Läufe gleichzeitig. `PORT=<Zahl>` vor dem Aufruf
  verschiebt sie.
- **Fehlt Playwright** in deiner Umgebung, laufen die Browser-Teile in der CI des Pull Requests (Jobs `chromium` und
  `webkit`). Lies deren Ergebnis und sag im PR-Text ehrlich, was nur die CI geprüft hat.

## PR-Text

Bitte mit diesen Abschnitten:

- **Was gebaut ist:** Dateien und Schnittstellen
- **Tests:** wörtliche Ergebnisse
- **Offen:** ehrlich, lieber zu viel
- **Konfliktstellen:** in gemeinsamen Dateien, für die Zusammenführung durch Claude
- **Bewusste Abweichungen vom Auftrag:** mit Begründung

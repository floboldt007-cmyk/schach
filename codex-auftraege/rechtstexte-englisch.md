# Auftrag für Codex: Datenschutz und Impressum auf Englisch

Die gemeinsamen Regeln stehen in `codex-auftraege/REGELN-CODEX.md` und gelten vollständig.

- **Arbeitszweig:** `codex/rechtstexte-englisch`, abgezweigt von `claude/integration`. **Pull Request gegen
  `claude/integration`.**
- **Nur diese Dateien:** neu `datenschutz-en.html` und `impressum-en.html`, dazu je ein Sprachlink in
  `datenschutz.html` und `impressum.html`, die Stellen der App, die auf die Rechtstexte verlinken (nur die Adresse
  je nach `sprache()`), Tests, `ARCHITEKTUR.md` (ein Absatz), `sw.js` (nur per `--aktualisieren`).

## Was gebaut wird

1. **Englische Fassungen** von `datenschutz.html` (Privacy Policy) und `impressum.html` (Legal Notice):
   - Gleicher Aufbau, gleiche Gestaltung, gleiche Abschnitte, sinngemäß übersetzt.
   - Oben steht der Hinweis: „This is a courtesy translation. The German version is legally binding.“ Er verlinkt
     auf die deutsche Fassung. Auf der deutschen Seite steht ein Link „English version“.
   - **Platzhalter bleiben Platzhalter** (`<span class="platz">[...]</span>`), englisch beschriftet, z. B.
     `[Full name]`. Trag niemals echte Namen, Adressen, E-Mail-Adressen oder Telefonnummern ein.
   - Gesetzesangaben bleiben deutsch zitiert, mit kurzer Erklärung, z. B. „§ 5 DDG (German Digital Services Act)“.
2. **Verlinkung in der App:** Wo die App auf `datenschutz.html` oder `impressum.html` verweist (Einstellungen, Konto,
   Abo-Blatt, Fußzeilen), zeigt sie bei `sprache() === 'en'` auf die `-en`-Fassung. Alles andere bleibt gleich.
3. Keine langen Gedankenstriche. Keine Texte von anderen Seiten oder Generatoren übernehmen.

## Tests

- Ein kleiner Test, neu oder in einer passenden bestehenden Suite:
  - beide Seiten laden ohne Konsolenfehler;
  - auf den englischen Seiten keine Umlaute außerhalb von Gesetzeszitaten und Platzhaltern;
  - dieselbe Zahl Abschnitte (`h2`) wie die deutsche Fassung;
  - die Platzhalter sind noch da;
  - der Sprachlink geht in beide Richtungen.
- `tests/sprache.test.mjs` und `tests/screens.test.mjs` bleiben grün.

## PR-Text

Unter „Offen“ alle Stellen auflisten, bei denen die Übersetzung juristisch unsicher ist. Flo lässt das vor dem
Verkauf prüfen.

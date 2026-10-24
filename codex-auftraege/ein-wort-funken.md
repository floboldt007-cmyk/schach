# Auftrag für Codex: Funken für ein richtiges „Ein Wort“

Die gemeinsamen Regeln stehen in `codex-auftraege/REGELN-CODEX.md` und gelten vollständig.

- **Arbeitszweig:** `codex/ein-wort-funken`, abgezweigt von `claude/integration`. **Pull Request gegen `claude/integration`.**
- **Nur diese Dateien:** `js/pakete/tagesraetsel/index.js`, `js/pakete/funken/{index,stand,rechnung,texte}.js`, die
  Tests dazu, `ARCHITEKTUR.md` (je ein Satz bei Tagesrätsel und Funken), `sw.js` (nur per `--aktualisieren`).

## Was gebaut wird

Nach dem Tagesrätsel fragt „Ein Wort“, welches Motiv es war (`einWort()` in `js/pakete/tagesraetsel/index.js`).
Wer das Motiv richtig erkennt, bekommt **5 Funken**.

1. **Ereignis:** `einWort()` sendet nach der Wahl `sende('raetsel:wort', { tag: td.tag, richtig })`, eingepackt in
   `sicher(...)` wie `raetsel:geloest`. Gesendet wird höchstens einmal je Tag, denn der Stand hat danach `wort`.
2. **Funken:** `js/pakete/funken/index.js` hört auf `raetsel:wort`, genau wie bei `raetsel:geloest` über
   `lernEreignis`. Die neue Funktion `lernWort(st, d, ctx)` in `stand.js` funktioniert so:
   - Nur mit `d.richtig === true` gibt es Funken: **5**, als Wert in `rechnung.js`, nicht verstreut im Code.
   - Je Tag höchstens einmal. Der Schlüssel ist `d.tag`, das Format kommt aus `js/pakete/tagesraetsel/logik.js`.
     Gemerkt wird er in einer neuen Liste `st.lernen.wort`: die letzten 60 Einträge, alte Stände ohne die Liste bleiben
     gültig.
   - Gebucht wird über `lernBuchung` wie bei `lernRaetsel`. Es gelten also dieselben Tagesgrenzen für Lern-Funken.
   - In der Abrechnung oder im Spiegel steht eine eigene Zeile, Text in `funken/texte.js`, Deutsch und Englisch.
     Vorschläge: „Motiv erkannt“ und „Motif spotted“.
3. Kein Druck und keine Strafe: Bei einem falschen Wort gibt es 0 Funken und keinen Hinweis auf entgangene Funken.

## Tests

- Node, in der bestehenden Funken-Suite:
  - richtig gibt 5 Funken, falsch gibt 0;
  - derselbe Tag bucht nur einmal;
  - ein alter Stand ohne `lernen.wort` bleibt gültig;
  - die Tagesgrenze der Lern-Funken greift.
- Browser, in `tests/tagesraetsel.test.mjs`: Ein Wort richtig wählen, danach ist der Funkenstand um 5 höher. Ein
  zweiter Klick am selben Tag bringt nichts mehr.
- `tests/fairness.test.mjs` bleibt grün (keine Verlust- oder Drucksprache).

## Grün sein müssen

- `node tests/alle.mjs` oder die CI des PR (chromium und webkit)
- `node tests/sw.test.mjs --aktualisieren`, danach `node tests/sw.test.mjs`

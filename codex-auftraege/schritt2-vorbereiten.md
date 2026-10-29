# Auftrag für Codex: Schritt 2 vorbereiten (Online nur mit Konto, Englisch für Konto, Online, Schule, Abo, Coach)

Die gemeinsamen Regeln stehen in `codex-auftraege/REGELN-CODEX.md` und gelten vollständig.

- **Arbeitszweig:** `codex/schritt2-vorbereiten`, abgezweigt von `claude/integration`. **Pull Request gegen
  `claude/integration`.**
- **Nicht anfassen:** `js/erweiterungen.js` (PAKETE und REITER). Das Einschalten macht Claude nach deinem PR.
  Ausserdem bleiben unberuehrt: Abläufe, Klassen, IDs, `data-*`-Attribute, Ereignisse und die Server-Verträge
  (`supabase/*.sql`).

## Lage (24.10.)

- **Server:** Supabase ist eingerichtet, alle Schemata und RLS-Tests sind grün. Die Anmeldung per E-Mail-Code und per
  Google ist an.
- **Mailversand:** Es gibt noch keinen eigenen SMTP. Codes kommen nur beim Besitzer an, und Google steht im Testmodus.
- **Ergebnis:** Online, Schule, Abo und Coach dürfen vorerst **nur hinter dem freigeschalteten Konto** erscheinen.
  Freigeschaltet ist das Konto über `#konto`, siehe `kontoFreigeschaltet()` in `js/konto.js`.
- **Englisch:** Die App ist seit dem 24.10. zweisprachig (`js/sprache.js`, `t()`). Die Pakete des zweiten Schritts
  haben aber noch feste deutsche Texte.

## Was gebaut wird

1. **Online nur mit freigeschaltetem Konto:**
   - Die Karte „Gegen Freunde“ (`js/pakete/online/index.js`, Ort `training:karten`) und die Einladungs-Gruppe in den
     Einstellungen erscheinen nur, wenn `kontoFreigeschaltet()` wahr ist. Vorbild ist `js/pakete/schule/index.js`.
   - Ein Einladungslink, den ein Freund schickt, schaltet das Konto frei, genau wie `#konto`. Sonst sähe der
     Eingeladene nichts. Die Einladung bleibt gemerkt wie heute.
   - Prüfe dasselbe für Abo (`js/pakete/abo/`) und Coach (`js/pakete/coach-ki/`): Ohne freigeschaltetes Konto zeigen
     sie nichts. Ist das schon so, nichts ändern.
2. **Englisch** für alles, was mit freigeschaltetem Konto sichtbar wird:
   - Dateien: `js/konto.js`, `js/ui/online.js`, `js/online.js` (Meldungen), `js/pakete/online/index.js`,
     `js/ui/schule.js`, `js/schule.js` (Fehlersätze), `js/pakete/schule/index.js`, `js/abo.js`,
     `js/pakete/abo/index.js`, `js/pakete/abo/trainer.js`, `js/pakete/coach-ki/index.js`.
   - Dazu die Gruppen „Daten“ und „Sicherung“, falls sie noch deutsch sind.
   - Wörterbücher wie in Englisch Teil 2: je Paket `js/pakete/<paket>/texte.js` als Bereich `p-<paket>`, für den Kern
     `js/sprachen/<bereich>.js`.
   - Die deutschen Texte bleiben **zeichengleich**: Alle deutschsprachigen Suiten müssen unverändert grün bleiben.
   - `t()` nie auf Modulebene aufrufen, nur beim Zeichnen.
   - Englisch kurz, freundlich und ohne Druck. Schachbegriffe nach englischer Schachsprache. Nichts von chess.com oder
     Lichess übernehmen. Keine langen Gedankenstriche.
   - Der Verkaufstext im Trainer-Blatt verspricht nur, was es gibt. Inhalte nicht ändern, nur übersetzen.
   - Preise stehen nie im Code (sie kommen aus der Tabelle `produkte`).
3. **Sprachtest erweitern** (`tests/sprache.test.mjs`):
   - Die vier Pakete im Browser mit `?test&erw=pakete/online/index,pakete/schule/index,pakete/abo/index,pakete/coach-ki/index`
     und freigeschaltetem Konto (`#konto` einmal öffnen) auf Englisch durchgehen:
     - Konto-Gruppe (abgemeldet)
     - Online-Screen
     - Klasse beitreten
     - Trainer-Blatt
     - Coach-Hinweis
   - Server-Antworten mit einem gefälschten `fetch`, wie in den bestehenden Online- und Schule-Tests. Kein echter
     Server.
   - Prüfungen wie bisher: keine deutschen Wörter, keine Umlaute, keine rohen Schlüssel, kein Überlauf (iPad quer
     und Handy hoch).
   - Die Liste „Wörterbücher der live geschalteten Pakete“ um online, schule, abo und coach-ki erweitern.
   - Dazu eine Prüfung: Ohne freigeschaltetes Konto zeigt keines der vier Pakete etwas.

## Grün sein müssen

- `node tests/sprache.test.mjs` und `node tests/sprache.test.mjs --pakete`
- `node tests/alle.mjs` oder die CI des PR (chromium und webkit)
- `node tests/sw.test.mjs --aktualisieren`, danach `node tests/sw.test.mjs`

## PR-Text

Wie in `REGELN-CODEX.md`. Unter „Offen“ aufführen:
- Texte, die du unsicher übersetzt hast
- Stellen, die ohne Konto doch noch etwas zeigen
- alles, was du am Gating nicht ändern konntest, ohne Abläufe anzufassen

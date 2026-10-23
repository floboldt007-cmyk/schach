# Auftrag für Codex: Vorzug-Kette sichtbar machen und Pfeile leichter finden

Die gemeinsamen Regeln stehen in `codex-auftraege/REGELN-CODEX.md` und gelten vollständig. Zusätzlich gilt hier:

- **Arbeitszweig:** `codex/vorzuege-kette`, abgezweigt von `claude/integration`. **Pull Request gegen `claude/integration`.**
- Diesmal geht es um den Kern. `js/ui/partie.js`, `js/board.js`, `css/board.css` und `css/partie.css` darfst du ändern.
  Pakete (`js/pakete/**`) und `js/erweiterungen.js` änderst du nicht.

## Flos Wunsch (23.10.2026)

> „Ich möchte Pre-Pre-Moves machen können, mehr als nur Pre-Moves. Ein Pre-Move, noch ein Pre-Move. Und ich möchte auch
> Pfeile zeichnen können.“

## Was es schon gibt (erst lesen)

- **Vorzüge** in `js/ui/partie.js`:
  - `z.vorzuege` ist eine Liste mit höchstens 5 Einträgen.
  - `merkeVorzug`, `fuehreVorzugAus`, `loescheVorzuege`, `vorzugZiele`
  - `beiLeer` bricht alle ab.
  - Einstellung `vorzuege`.
  - Markierungen `vorzug-start` und `vorzug-ziel` (`css/board.css`, Tokens `--vorzug-start` und `--vorzug-ziel`).
  - Tests in `tests/board.test.mjs` (Abschnitt „Vorzüge wie in der Partie“) und in `tests/app.test.mjs`.
- **Pfeile und Marken** in `js/board.js`. Flo kann sie zeichnen:
  - Finger: 400 ms halten und ziehen = Pfeil, nur halten = Marke, Tipp ins leere Brett löscht.
  - Maus: Rechtsklick.

  Siehe den Kopfkommentar von `js/board.js`. Nur weiß das kaum jemand.

## Was fehlt (das ist der Auftrag)

1. **Die Kette sichtbar spielen:**
   - Nach jedem Vorzug zeigt das Brett die Stellung so, als wären alle vorgemerkten eigenen Züge schon gespielt. Die
     Figur steht also auf ihrem Zielfeld, die echte Stellung bleibt in `z.chess` unverändert.
   - Die Ziele für den nächsten Vorzug kommen aus dieser gedachten Stellung. Damit geht e2-e4 und danach e4-e5 mit
     derselben Figur. Die Gegnerzüge dazwischen sind unbekannt: Erlaubt ist, was die Figur auf dem gedachten Brett
     regelgerecht ziehen könnte (wie heute `vorzugZiele`, nur auf der gedachten Stellung).
   - **Nummern:** Jeder vorgemerkte Zug trägt am Zielfeld eine kleine Zahl 1 bis 5. Nur Tokens benutzen, hell und
     dunkel lesbar, kein Leuchten (Look A).
2. **Ausführen wie heute:**
   - Je eigener Zug wird der vorderste Vorzug ausgeführt.
   - Ist er dann regelwidrig (der Gegner hat etwas geändert), fallen er und alle danach weg, mit einem leisen Klang
     und ohne Fehlermeldung.
   - Danach zeigt das Brett wieder die echte Stellung plus die verbliebene Kette.
3. **Abbrechen:**
   - Ein Tipp ins leere Brett oder auf eine gegnerische Figur ohne Auswahl löscht die ganze Kette. Das gibt es schon,
     es muss auch mit der gedachten Stellung stimmen.
   - Zurücknehmen, Aufgeben und das Partie-Ende löschen sie ebenfalls.
4. **Grenzen bleiben:**
   - Höchstens 5 Vorzüge.
   - Nicht in Rätseln.
   - Nicht in Partien zu zweit (`modus 'zuzweit'`) oder online.
   - Die Einstellung „Vorzüge“ aus heißt: keine Kette.
5. **Pfeile leichter finden:**
   - Einmal je Gerät, in der zweiten eigenen Partie, eine ruhige Zeile unter dem Brett: „Tipp: Finger auf ein Feld
     halten und ziehen zeichnet einen Pfeil.“ Am Rechner: „Rechtsklick und ziehen zeichnet einen Pfeil.“
   - Sie verschwindet nach dem ersten gezeichneten Pfeil oder mit „Verstanden“.
   - Dazu in den Einstellungen bei „Brett“ eine Zeile, die Pfeile und Marken erklärt.
   - Keine neue Farbe, kein Stift-Knopf (das entscheidet Flo später).
6. **Tests:** Erweitere `tests/board.test.mjs` oder `tests/app.test.mjs` um:
   - Kette e2-e4 und danach e4-e5 mit derselben Figur: Nummern 1 und 2 sind zu sehen, die Figur steht auf e5.
   - Ausführung über zwei Bot-Züge.
   - Ungültig gewordener Vorzug: er und der Rest fallen weg.
   - Tipp ins leere Brett löscht alles.
   - Grenze 5.
   - Hinweis zu Pfeilen nur einmal, weg nach dem ersten Pfeil.
   - Alles hell und dunkel, iPad quer (1180 x 820) und Handy hoch (390 x 844).

## Grün sein müssen

- `node tests/board.test.mjs`, `node tests/app.test.mjs`, `node tests/screens.test.mjs`, `node tests/e2e.test.mjs`
- `node tests/fairness.test.mjs` (Texte), `node tests/thema.test.mjs` (nur Tokens)
- `node tests/sw.test.mjs --aktualisieren` und danach `node tests/sw.test.mjs`
- am Ende `node tests/alle.mjs` oder die CI des PR (Jobs `chromium` und `webkit`)

## PR-Text

Wie in `REGELN-CODEX.md`. Unter „Offen“ bitte: was du bewusst nicht gebaut hast und warum.

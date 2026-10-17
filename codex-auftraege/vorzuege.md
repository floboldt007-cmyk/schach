# Auftrag für Codex: Vorzüge (Premoves) in jeder Partie

Basis: Zweig `codex/vorzuege`, abgezweigt von `claude/umbau-look-a`. Entscheidung vom 18.10. in
`design/runde4/ENTSCHEIDUNGEN.md` (Zeile „Das Premoven fehlt“). Der Besitzer spielt auf iPhone und iPad, vor allem
per Tippen, auch per Ziehen.

Verhalten:
1. Während der Bot am Zug ist (er denkt sichtbar, siehe Bot-Denkzeit), darf der Spieler seine eigenen Figuren
   antippen bzw. ziehen und einen Zug vormerken. Erlaubt sind alle pseudo-legalen Züge der eigenen Figur aus der
   Stellung, die nach den bereits vorgemerkten Zügen entstünde (gegnerische Züge unbekannt, Schlagen auf jedes
   besetzte oder freie Feld zulassen, wie es Vorzüge üblich machen).
2. Mehrere Vorzüge hintereinander sind möglich (Kette, höchstens z. B. 5). Die vorgemerkten Züge sind deutlich
   markiert (eigene Farbe für Start- und Zielfeld, Figur sichtbar am Zielfeld als Vorschau), Farben aus den Tokens
   des Looks (`css/tokens.css`, `css/themes/modern.css`), kein Neon.
3. Abbrechen: Tippen auf ein leeres Feld, das kein Ziel ist, oder neben das Brett löscht alle Vorzüge. Ebenso
   Zurücknehmen, Aufgeben, Partieende, Hinweis und Brett drehen.
4. Ist der Spieler wieder am Zug, wird der erste Vorzug sofort ausgeführt, wenn er jetzt legal ist, sonst verfallen
   still alle Vorzüge (kein Fehlerton, nur die Markierung verschwindet). Danach geht es mit dem nächsten Vorzug weiter,
   sobald der Bot geantwortet hat.
5. Ein Vorzug läuft ohne „Zug bestätigen“ (Einstellung `zugBestaetigen` gilt nur für normale Züge). Umwandlung im
   Vorzug: automatisch Dame (wie `autoDame`).
6. Die Live-Bewertung, Sterne, Fairness und Wertung behandeln einen ausgeführten Vorzug wie einen normalen Zug.
7. Neue Einstellung `vorzuege` (Standard `true`) in `js/storage.js` (wie die anderen Einstellungen mit erlaubten
   Werten, alte Speicherstände bekommen den Standard) und ein Schalter in den Einstellungen („Vorzüge“, Untertext
   „Züge vormerken, während der Gegner denkt“). Texte deutsch, echte Umlaute, keine langen Gedankenstriche.
8. Klang: beim Vormerken der leise Bedien-Klang, beim Ausführen der normale Zug-Klang (Klang-Register in
   `js/sounds.js` nutzen, nichts Neues erzeugen).

Technik: Eingabe in `js/board.js` (öffentliche Schnittstelle in `ARCHITEKTUR.md` erweitern, nicht umbauen), Ablauf
in `js/ui/partie.js`. Bestehende Prüfungen nicht ändern oder abschwächen. Neue Tests: Vorzug per Tippen und per
Ziehen, Kette aus zwei Vorzügen, illegaler Vorzug verfällt, Abbrechen per Tippen daneben, Einstellung aus, Zurücknehmen
löscht Vorzüge, Umwandlung, Bewertung des ausgeführten Vorzugs. Danach `node tests/sw.test.mjs --aktualisieren` und
`node tests/alle.mjs` komplett grün.

Du kannst aus deinem Container nicht pushen. Setze ans Ende deiner Antwort den vollständigen Patch
(`git format-patch --stdout` gegen die Basis). Ist er länger als 55.000 Zeichen, schreibe stattdessen die geänderten
Abschnitte je Datei als Codeblock mit Dateipfad und Funktionsname davor. Diese Auftragsdatei löschen. Halte dich an
`AGENTS.md`.

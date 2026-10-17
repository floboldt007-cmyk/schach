# Auftrag für Codex: Quellangabe für Stockfish (GPL-Pflicht)

Basis: Zweig `codex/stockfish-quelle`, abgezweigt von `main`. Keine App-Dateien ändern (`js/`, `css/`, `index.html`, `sw.js` bleiben unverändert).

Die App liefert `vendor/stockfish/stockfish-19-lite-single.js` und `.wasm` aus (GPL-3.0). Für jede verteilte
Version muss klar sein, woher die Dateien stammen und wie man sie selbst baut.

1. Lege `vendor/stockfish/QUELLE.md` an: Projekt (stockfish.js / Stockfish), Version, genaue Herkunft der beiden
   Dateien (Paket, Version, Commit oder Tag, soweit aus den Dateien selbst, `COPYING.txt`, README oder Git-Historie
   ableitbar), welches NNUE-Netz eingebettet ist und unter welcher Lizenz, und Schritt für Schritt, wie man die
   Dateien aus dem Quellcode selbst baut. Was du nicht sicher belegen kannst, als „ungeprüft“ kennzeichnen. Du hast
   kein Internet: arbeite mit dem, was im Repo liegt (z. B. Kopfzeilen der .js-Datei, Zeichenketten in der .wasm).
2. Prüfe, dass `vendor/chess/` eine Lizenzdatei und eine Quellangabe hat, sonst ergänzen (`vendor/chess/QUELLE.md`).
3. In `README.md` im Abschnitt zu Lizenzen einen kurzen Verweis auf beide QUELLE-Dateien ergänzen und festhalten,
   dass es zu jeder veröffentlichten Version einen Git-Tag mit dem passenden Quellcode gibt.
4. Diese Auftragsdatei löschen. Halte dich an `AGENTS.md`.

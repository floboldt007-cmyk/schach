| Suite | Ergebnis | Hinweis |
| --- | --- | --- |
| `storage` | 195/195 | Node |
| `review --nur-node` | 296/296 | Node; Browser-Teil (Port 8932): 317/317 |
| `spiel` | 92/92 | Node; drei Erwartungen an `staerkeFuerElo` angepasst |
| `bots-mensch` (neu) | 30/30 | Node, ohne Engine |
| `fairness`, `ereignisse` | 31/31, 123/123 | Node, unverändert |
| `sw` | 32/33, nach `--aktualisieren` 33/33 | erwarteter Punkt: STAND des Service Workers |
| `engine-bots --schnell` | 60/60 | Chromium mit App-Stockfish, Port 8931; Greta im Mittel 51 ms Suchzeit je Zug |
| `app --schnell` | 385/385 | Chromium, Port 8933; eine W0+a-Erwartung an den Boss-Kopf angepasst ("≈ 1100" statt "≈ 1000") |

Geprüft auf einem frischen Abzug von `main` (`git archive`, 57a159b = 455eb34 plus eine Markdown-Datei); die Patches
passen auch auf 455eb34 selbst und ergeben dort dieselben Dateien. Nicht gelaufen: `screens`, `e2e`, `board` (vom Patch
nicht berührt) und der lange Stärke-Teil von `engine-bots` (ohne `--schnell`). Die Prüfung "freie Dame" im
Browser-Test war mit den neuen Bots wackelig (Grenzen zu nah an den Wahrscheinlichkeiten); sie ruft jetzt `botZug`
mit dem vorigen Zug auf wie die App, die Grenzen halten mit 20 Proben in mehr als 99 % der Läufe.

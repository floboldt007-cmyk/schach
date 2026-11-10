# CLAUDE.md

Hinweise für Claude Code in diesem Repository. Die gemeinsamen Regeln für alle KI-Sitzungen stehen in
[AGENTS.md](AGENTS.md) und gelten auch hier, vor allem der Abschnitt „Zusammenarbeit“.

## Wer stellt live

- Läuft ein Zweig `feinschliff-*` mit Commits von heute, stellt nur dessen Hauptsitzung am PC live. Jede andere
  Sitzung (Cloud, iPad, zweites Fenster) arbeitet auf einem eigenen Zweig, öffnet einen Pull Request gegen den
  Feinschliff-Zweig und mergt weder dorthin noch nach `main`.
- Eine Cloud-Sitzung stellt nur live, wenn der Eigentümer es ihr in genau dieser Sitzung sagt.
- Vor jedem Push nach `main` prüfen, dass `origin/main` noch der Stand ist, den die Sitzung zuletzt gelesen hat.
  Hat er sich bewegt: nicht drüberschreiben, erst nachsehen.
- `stabil` (Rückfallstand) nur vorwärts: neuer Commit mit dem Inhalt von `main` und `origin/stabil` als Eltern,
  nie Force-Push.

## Kennzeichnung

Cloud-Sitzungen committen als Autor `Claude Cloud`, damit man ihre Arbeit von der PC-Sitzung (`Claude`) und von
Codex (`Codex`) unterscheiden kann.

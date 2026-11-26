#!/usr/bin/env bash
# CI-Vorpruefung (R30, 26.11.2026): muss dieser Lauf die volle Testkette fahren?
#
# Anlass: Ein Live-Gang startete die Kette viermal fuer denselben Baum (stabil, main, zweimal claude/integration)
# und blockierte #285 am 23.11. rund eine Stunde in der Warteschlange. Flo 23.11.: push auf stabil und der
# Gleichstand-Merge in claude/integration laufen ohne Tests, wenn ihr Baum schon gruen war; main behaelt seinen Lauf.
#
# Uebersprungen wird NUR, wenn beides gilt:
#   1. Ereignis push auf stabil, oder push auf claude/integration, dessen Baum gleich dem Baum vor dem Push ist
#      (das ist der Gleichstand-Merge `git merge -s ours`, er aendert keine Datei).
#   2. Fuer genau diesen Baum gibt es ein Artefakt "gruener-baum-<baum>", das der Job gruen-merken nur nach einem
#      VOLL gruenen pull_request-Lauf (chromium 1-3, webkit, sql) hochlaedt, aus diesem Repo (kein Fork).
# Alles andere laeuft voll: jeder pull_request, jeder push auf main und auf andere Zweige, und jeder Zweifel
# (API-Fehler, neuer Zweig ohne Vorgaenger, Artefakt abgelaufen). Die Fehlerrichtung ist immer "testen".
#
# Eingaben (Umgebung): EREIGNIS, REF, SHA, VORHER, REPO; GH_TOKEN fuer gh. GH_BEFEHL ersetzt gh im Test.
# Ausgabe: laufen=true|false nach $GITHUB_OUTPUT (ohne GITHUB_OUTPUT auf die Standardausgabe), Grund im Protokoll.

set -u
GH="${GH_BEFEHL:-gh}"

melde() {
  local laufen="$1" grund="$2"
  echo "Vorpruefung: laufen=$laufen ($grund)"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "laufen=$laufen" >> "$GITHUB_OUTPUT"; else echo "laufen=$laufen"; fi
  exit 0
}

baum_von() {
  "$GH" api "repos/$REPO/commits/$1" --jq '.commit.tree.sha' 2>/dev/null
}

gruener_lauf() {
  # Erster nicht abgelaufener Treffer aus diesem Repo (kein Fork), Ausgabe: Lauf-Nummer.
  "$GH" api "repos/$REPO/actions/artifacts?name=gruener-baum-$1" \
    --jq '[.artifacts[] | select(.expired == false and .workflow_run.head_repository_id == .workflow_run.repository_id)][0].workflow_run.id // empty' 2>/dev/null
}

ist_hash() { [[ "$1" =~ ^[0-9a-f]{40}$ ]]; }

case "${EREIGNIS:-}" in
  push) ;;
  *) melde true "Ereignis ${EREIGNIS:-leer} testet immer voll" ;;
esac

case "${REF:-}" in
  refs/heads/stabil) ZWEIG=stabil ;;
  refs/heads/claude/integration) ZWEIG=integration ;;
  *) melde true "push auf ${REF:-leer} testet immer" ;;
esac

BAUM="$(baum_von "${SHA:-}")"
ist_hash "$BAUM" || melde true "Baum von ${SHA:-leer} nicht lesbar"

if [ "$ZWEIG" = integration ]; then
  ist_hash "${VORHER:-}" && [ "$VORHER" != 0000000000000000000000000000000000000000 ] \
    || melde true "integration ohne Vorgaenger"
  BAUM_VORHER="$(baum_von "$VORHER")"
  ist_hash "$BAUM_VORHER" || melde true "Baum von $VORHER nicht lesbar"
  [ "$BAUM" = "$BAUM_VORHER" ] || melde true "integration aendert Dateien (kein Gleichstand-Merge)"
fi

LAUF="$(gruener_lauf "$BAUM")"
[[ "$LAUF" =~ ^[0-9]+$ ]] || melde true "Baum $BAUM hat keinen belegten gruenen PR-Lauf"

melde false "Baum $BAUM war schon voll gruen in Lauf $LAUF (https://github.com/$REPO/actions/runs/$LAUF)"

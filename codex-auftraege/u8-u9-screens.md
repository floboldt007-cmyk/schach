# Auftrag für Codex: Einstellungen, Analyse und Verlauf (Umbau-Pakete U8 und U9)

Basis: Zweig `codex/u8-u9-screens`, abgezweigt von `main`.
Der Umbau-Plan liegt jetzt im Repo: `design/runde4/umbau/PLAN.md`. Pfade darin übersetzen:
`entwuerfe/a-modern/...` = `design/runde4/umbau/entwurf-a/...`, `entwuerfe/c-arcade/...` = `design/runde4/umbau/entwurf-c/...`
(Bilder von C unter `entwurf-c/vorschau/`), `umbau-a/shots/soll-*.png` = `design/runde4/umbau/soll/`.
Entscheidungen des Besitzers: `design/runde4/ENTSCHEIDUNGEN.md` (gilt vor dem Plan). Zeilenangaben im Plan sind alt, selbst suchen.
Schon fertig und live, nicht neu bauen: U1, U2, U3, U4 (Klartext-Namen), Vorzüge (Premoves), Sicherung (Export/Import).
Andere Pakete nicht anfassen. Speicherformat nur erweitern, alte Spielstände müssen gültig bleiben.

Pflicht am Ende: `node tests/sw.test.mjs --aktualisieren`, dann `node tests/alle.mjs` komplett grün (Chromium).
Keine Prüfung abschwächen oder überspringen; Selektoren nur dort anpassen, wo der Plan es vorsieht.
Du kannst nicht pushen: setze ans Ende deiner Antwort eine kurze Liste der geänderten Dateien und der Testergebnisse.
Diese Auftragsdatei löschen. Halte dich an `AGENTS.md`.

## Was zu tun ist

Plan Abschnitt 6, Pakete **U8 Einstellungen** und **U9 Analyse und Verlauf**, mit den dort genannten Abschnitten
(2.7, 2.8, 2.9, 4). Die Konto-Gruppe in den Einstellungen (falls schon vorhanden) und die Gruppe „Sicherung“
bleiben erhalten. Lizenzen: Schriften OFL, eigene Klänge und Bilder „alle Rechte vorbehalten“ (nicht GPL).
`js/board.js`, `js/ui/partie.js` und die Arena nicht anfassen (dort arbeiten parallel andere Pakete).
- Unter WebKit hat die Analyse auf dem kleinen Handy 8 px waagrechten Überlauf (`tests/WEBKIT-STAND.md`): beim Analyse-Umbau beheben.

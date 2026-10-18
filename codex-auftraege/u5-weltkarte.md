# Auftrag für Codex: Arena als Weltkarte (Umbau-Paket U5)

Basis: Zweig `codex/u5-weltkarte`, abgezweigt von `main`.
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

Plan Abschnitt 6, Paket **U5 Arena und Duell-Intro**, mit der Änderung vom 18.10.: Die Arena wird eine **Weltkarte**
nach Entwurf C (`design/runde4/umbau/entwurf-c/index.html`, `SYSTEM.md` Ebene „Himmel und Welt“, Bilder
`entwurf-c/vorschau/arena-quer.png`, `arena-hoch.png`, `arena-handy.png`, `intro-*.png`, `freischalten-1180.png`):
Karte mit Hügeln, Pfad und 10 Bot-Stationen (besiegt / nächster / gesperrt), Orte für Wochen-Boss und Events.
Umgesetzt mit den Tokens, Schriften und Formen von Look A (kein Neon, keine 3D-Lippen von C), hell und dunkel.
Handy: Karte senkrecht scrollbar, Spielen-Knopf über der Leiste. Test-Haken `.stufe.knoten` beibehalten, damit
`app.test.mjs` und `e2e.test.mjs` ohne Änderung an ihren Arena-Schritten grün bleiben.
Das Duell-Intro (`js/ui/duell.js`) wie im Plan, mit Einstellung `immer`/`besondere`/`aus` und reduzierter Bewegung.
Neue Suite `tests/arena.test.mjs` wie im Plan beschrieben, in `tests/alle.mjs` eintragen.

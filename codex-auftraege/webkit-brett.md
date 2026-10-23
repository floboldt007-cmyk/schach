# Auftrag für Codex: Brett und Bedienung in Safari (WebKit) grün

Erst `codex-auftraege/REGELN-CODEX.md` lesen. Arbeitszweig `codex/webkit-brett`, PR gegen `claude/integration`.

## Warum

Flo spielt auf dem iPad, also in Safari (WebKit). Die CI lässt `storage`, `board`, `screens` und `e2e` auch mit WebKit
laufen (Job `webkit` in `.github/workflows/tests.yml`). Auf `claude/integration` sind `storage`, `screens` und `e2e`
dort grün, **`board` ist rot.** Ziel: `board` in WebKit grün, ohne eine Prüfung abzuschwächen, und Chromium bleibt grün.

## Bekannte Abweichungen

Stand: WebKit-CI auf 4ee2ccd, gleicher Code wie die Basis.

- **Maus:** Das Abzeichen am Zielfeld ist in WebKit 0 × 0 px groß, also unsichtbar. Das gilt auch am Rand auf h8, wo es
  in die Brett-Box geschoben wird. Sitz: `_platziereAbzeichen` in `js/board.js` und die Abzeichen-CSS.
- **Klang:** „Nach erster Berührung bereit“ kommt nicht. Das Freischalten der Audio-Ausgabe nach dem ersten Tipp steht
  in `js/sounds.js` (`klang.zustand()`).
- **iPad:** Nach einem illegalen Zug per Finger sitzt die Figur nach 600 ms nicht wieder auf ihrem Feld.
- **Optik:** Bei `prefers-reduced-motion` müsste `gleitDauer` 0 sein und das Brett sofort setzen. Sitz: `reduziert()` in
  `js/bewegung.js` und `gleitDauer` im Brett.
- **Pfeile (Finger)**, mehrere Prüfungen:
  - „eigene Figur ohne Zug (Ta1) halten markiert das Feld“
  - „eigene ziehbare Figur halten und ziehen malt den Pfeil e2-e4“
  - „eigene Figur lange halten und loslassen bleibt ein Tipp“
  - „Finger, gedreht: Pfeil e2-e4“ (dort fehlte der Pfeil ganz)

  Gemalt wird so: Finger 400 ms still halten, dann ziehen.

Die Suite bricht seit ead8e88 nicht mehr ab, wenn etwas fehlt. **Die WebKit-CI deines PRs zeigt deshalb die
vollständige Liste.** Lies sie zuerst, sie kann mehr enthalten als die Liste hier.

## Vorgehen

1. Wenn möglich WebKit lokal installieren (`npx playwright install --with-deps webkit`), dann
   `BROWSER=webkit node tests/board.test.mjs` laufen lassen. Geht das nicht, iterierst du über die CI deines PRs.
2. Je Abweichung entscheiden, ob es ein **echter Safari-Fehler** der App ist oder ein **Unterschied im Test-Treiber**.
   - **Echter Fehler:** in `js/board.js`, `js/bewegung.js`, `js/sounds.js` oder der Brett-CSS beheben. Er würde auf
     dem iPad genauso auftreten.
   - **Test-Treiber:** `fingerTreiber` in `tests/browser.mjs` erzeugt synthetische `PointerEvent`s. Ihn darfst du
     korrigieren, wenn er sich in WebKit anders verhält als ein echter Finger. Begründe das im PR-Text. Die Prüfungen
     selbst bleiben unverändert streng.
3. `tests/WEBKIT-STAND.md` nachführen: was behoben ist, wie, und was nur ein echtes iPad zeigen kann.
4. Am Ende müssen grün sein:
   - Chromium: `node tests/alle.mjs`
   - WebKit: `BROWSER=webkit node tests/alle.mjs --nur=storage,board,screens,e2e`

   Wenn WebKit lokal nicht läuft, gilt die CI.

## Nicht anfassen

- `js/ui/partie.js`, `js/ui/arena.js` und `js/ui/duell.js`, außer ein echter Safari-Fehler sitzt genau dort. Dann
  begründen.
- Pakete unter `js/pakete/`.

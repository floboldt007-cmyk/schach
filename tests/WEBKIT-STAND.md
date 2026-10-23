# WebKit-Stand

Stand: 23. Oktober 2026, PR #25 (`codex/webkit-brett`).

## Geprüfter Stand

Der Anwendungscode in `3f10852762b9b8eb0030168eec309f809ca758e8` besteht die unveränderten Prüfungen in beiden
Browsern. [Vollständiger PR-Lauf](https://github.com/floboldt007-cmyk/schach/actions/runs/39926458127):

- Chromium: **20/20 Suiten bestanden, 2952/2952 Prüfungen**.
- WebKit: **4/4 Suiten bestanden, 828/828 Prüfungen**: storage 218/218, board 280/280, screens 205/205,
  e2e 125/125.
- Auch der unabhängige [Push-Lauf](https://github.com/floboldt007-cmyk/schach/actions/runs/39926450380) besteht die
  vier WebKit-Suiten mit **828/828 Prüfungen**.

Aufrufe:

```sh
node tests/alle.mjs
BROWSER=webkit node tests/alle.mjs --nur=storage,board,screens,e2e
```

WebKit konnte in der Entwicklungsumgebung nicht installiert werden: Der Browser-Download wurde mit HTTP 403
gesperrt. Die WebKit-Ergebnisse stammen deshalb aus der CI. Lokal wurde System-Chromium über `PLAYWRIGHT_PFAD`
verwendet. Der Bretttest bestand dort mit 279/279 Prüfungen; die zusätzliche CI-Prüfung kontrolliert die
Screenshot-Galerie bei gesetztem `BILDER`.

Der lokale Gesamtlauf hatte zunächst 19/20 Suiten und 2947/2951 Prüfungen: Vier Konsolenprüfungen in `screens`
meldeten eine fehlende `/favicon.ico`. Die Testseite bindet nun das vorhandene SVG-Favicon der App ausdrücklich ein.
Fehlermeldungen werden weiterhin gesammelt und geprüft; keine Prüfung wurde entfernt oder abgeschwächt.
Der erneute lokale Lauf von `node tests/screens.test.mjs` besteht mit **205/205 Prüfungen**.

## Änderungen an der App

- **Abzeichen:** `js/board.js` setzt Breite und Höhe als Prozentwerte. `css/board.css` hält auch die Mindestgröße
  quadratisch. Die CSS-Feder wird beim Einsetzen an die Dokument-Zeit gebunden, sodass ein später Render-Schritt
  den unsichtbaren Anfang `scale(0)` nicht festhält. Sichtbarkeit, Lage und Brettgrenzen werden weiterhin geprüft.
- **Figuren und Zurückschnappen:** `js/bewegung.js` bindet neue Web-Animations an die aktuelle Dokument-Zeit.
  Der Zeitwächter in `_gleiteVon` beendet außerdem die tatsächliche Animation, bevor er `.gleitet` entfernt.
  Dadurch bleibt auch bei einem verspäteten Animationsende kein alter Zieh-Transform auf der Figur liegen.
- **Weniger Bewegung:** `systemReduziert()` liest die aktuelle Media-Abfrage direkt. Die Antwort hängt nicht davon
  ab, ob WebKit das `change`-Ereignis der gespeicherten MediaQueryList bereits zugestellt hat. Der bestehende
  Listener aktualisiert weiterhin die CSS-Tokens. `gleitDauer()` ist bei reduzierter Bewegung sofort 0.
- **Erster Klang:** `js/sounds.js` bereitet den Audio-Kontext beim Aufsetzen vor. Die Freigabe bleibt an
  `touchend`, `pointerup`, Klick oder Taste gebunden; `zustand()` meldet weiterhin den tatsächlichen Zustand.
  Die bestehenden Regeln für stummgeschalteten Klang und unterbrochene Audio-Kontexte bleiben erhalten.

## Korrektur am Finger-Treiber

`fingerTreiber` in `tests/browser.mjs` bringt die Seite vor dem Aufsetzen nach vorn und lässt danach einen
Render-Schritt durchlaufen. Synthetische `PointerEvent`s aus `evaluate()` aktivieren die Browser-Seite nicht wie
native Eingaben. Die zusätzliche Synchronisation verhindert, dass Halte-Timer und Animationen in einer noch
inaktiven Seite starten. Die Halteschwelle bleibt bei 400 ms; alle Gesten, Prüfungen und Zeitgrenzen bleiben bestehen.

Der Treiber sendet weiterhin ohne CDP an das Element des Aufsetzens, entsprechend dem Zeiger-Fang. Zwei Finger,
Abbruch, Pfeile auf eigenen und leeren Feldern sowie ein gedrehtes Brett sind Teil der bestandenen Bretttests.

## Noch auf einem echten iPad prüfen

Die CI verwendet Playwright-WebKit unter Linux. Sie ersetzt diese Geräteprüfungen nicht:

- Tippen, Ziehen und 400 ms Halten mit einem echten Finger, einschließlich zweitem Finger und `pointercancel`.
- Scrollen, Zoom, Systemgesten und nachgelieferte Klicks rund um das Brett. Synthetische Pointer-Ereignisse lösen
  diese Browser-Standardaktionen nicht aus.
- Erster Klang nach Laden, Stummschalten sowie Audio nach App-Wechsel, Unterbrechung und Rückkehr aus dem Hintergrund.
- „Bewegung reduzieren“ in iPadOS während einer geöffneten Partie ändern.
- Safari und installierte PWA, Hoch- und Querformat. Ziel bleibt iPadOS ab 16.4; `:has()` benötigt Safari ab 15.4.

## Andere Pakete

`.effekt-ort` der Partie wird weiterhin in `js/ui/partie.js` über `calc(var(--x) * 12.5%)` positioniert. Dieser PR
ändert weder die Partie-Effekte noch die Weltkarte oder Pakete anderer Zweige.

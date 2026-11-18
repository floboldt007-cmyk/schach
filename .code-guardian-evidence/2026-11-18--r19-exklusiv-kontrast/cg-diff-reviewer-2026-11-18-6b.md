# Kaltreview so/R19-exklusiv-kontrast · c03c590..f4df5ba · 2026-11-18 · 6b (blind, nur lesend)

Kennung: 2026-11-18--r19-exklusiv-kontrast · HERKUNFT: Auftrag (Hauptfenster 6f)
Gepruefte Quelle: git diff c03c590..f4df5ba im Worktree schach-R19-exklusiv-kontrast (Kopf f4df5ba). Code-Aenderung: css/pakete/sammlung.css +3 (eine Regel plus Kommentar), tests/alle.mjs +1, tests/r19-exklusiv-kontrast.test.mjs neu; der Rest sind Belege.
Kriterien-Hash: 8e8a9f587eda77f3 (aufgabe.py graph --id 2026-11-18--r19-exklusiv-kontrast), keine Auswege gelistet.

## Proben
1. Selektor gegen emotes-finisher ec965f9 (Auftrag: auch gegen die vier Exklusiv-Karten aus emotes pruefen).
   - git merge-base --is-ancestor ec965f9 f4df5ba: nicht enthalten (gemeinsame Basis d767538).
   - ec965f9 css/pakete/sammlung.css:353-358: Karten im Shop sind .shf-karte (fuenf Plaetze) UND .shf-rk (Regale), die Farben je Seltenheit stehen als :is(.shf-karte, .shf-rk)[data-seltenheit=...].
   - ec965f9 js/pakete/sammlung/shop-entwurf.js:112 und :170: die Regal-Karte rendert dieselbe <span class="shf-selten">, Klasse 'shf-rk'.
   - Neue Regel (sammlung.css, f4df5ba): .shf-karte[data-seltenheit="exklusiv"] .shf-selten erreicht .shf-rk nicht.
   - Ausfuehrung: Probe kontrast-rk.mjs (Scratchpad 6b) stellt den Worktree schach-R19-emotes-finisher (ec965f9) bereit, oeffnet Shop A (390x844, angemeldet, Server simuliert), misst jede [data-seltenheit="exklusiv"] .shf-selten (Farbe gegen den ersten deckenden Grund darunter), spielt dann genau die neue Regel per addStyleTag ein und misst erneut. rc=0, 0 Seitenfehler:
     hell shf-karte "Exklusiv" vorher 4.18:1 -> mit Regel 4.81:1
     hell shf-rk "Exklusiv" vorher 4.18:1 -> mit Regel 4.18:1   (dreimal, die drei Exklusiv-Finisher im Regal)
     dunkel shf-karte 7.01:1 -> 7.52:1; dunkel shf-rk 7.01:1 -> 7.01:1 (dreimal)
2. Farbton: aus den gemessenen Farben (G-B)/(R-B) = 0.677 vorher und nachher, hell (0.6206/0.4607/0.1256 -> 0.5682/0.4243/0.1227) und dunkel (0.8061/0.6453/0.3076 -> 0.8212/0.6761/0.3710): Farbton gleich (~40.6 Grad), nur die Helligkeit wandert. Form: die Regel setzt nur color. Vertrag "Farbton nur minimal, Form gleich" eingehalten.
3. K3 Bilder: eigener RGB-Vergleich (Schwelle >0) vorher-c03c590 gegen nachher im Vault R19-Kritik/exklusiv-kontrast: in allen sechs Bildern liegt die Abweichungs-Box nur an der Marke (z. B. iphone13 (32,471,211,499), pc (10,163,71,173)), hell 393 bis 2420 Pixel, dunkel 411 bis 2465 Pixel. Dunkel ist echt dunkel (Mittelwert 50 bis 84). Rauschlauf vorher gegen rauschen-c03c590 in 3fs Log: 0. Nur die Marke veraendert: belegt.
4. K4 design-vergleich.md gelesen: hell fallen die 4 Zeilen 4.16:1 an der Karte "Mitternacht & Gold" weg, neu 0, dunkel 0/0. Stimmig mit Probe 1 fuer .shf-karte.
5. K1 (k1.log 91/91, gesiegelt) und K2 (k2.log 4/4 Suiten, 276/276) gelesen, nicht selbst gefahren (Browser-Suiten nur mit Ampel). Der Test misst nur '.sa-blatt .shf-karte' (tests/r19-exklusiv-kontrast.test.mjs:79, :96, :133), Ruhe/Zeiger (nur PC)/Fokus, SE/13/PC, hell/dunkel.

## Hinweise (kein Befund)
- pixelvergleich.log zeigt fuer die dunklen Bilder box=None, weil die Box hinter der Schwelle 8 gerechnet wird. Die dunkle Marke aendert sich tatsaechlich (7.01 -> 7.52:1, Probe 1; Box an der Marke, Probe 3), nur schwaecher als 8 je Kanal. "dunkel unveraendert" waere daraus falsch gelesen; der K3-Satz "nur die Marke veraendert" stimmt.

## Befunde
🟡 CONFIRMED css/pakete/sammlung.css:377
Code:    .shf-karte[data-seltenheit="exklusiv"] .shf-selten { color: color-mix(in srgb, var(--shf-farbe) 70%, var(--text)); }
Failure: Sobald emotes-finisher (ec965f9) mit diesem Zweig zusammenkommt, tragen die drei Exklusiv-Finisher im Regal (.shf-rk, shop-entwurf.js:170) weiter die Marke mit 78 %: hell 4.18:1 unter 4.5:1. Der Vertrag "Selektor greift fuer jede Exklusiv-Karte, auch die aus emotes-finisher" ist verletzt; der Test r19-exklusiv-kontrast sieht es nicht, weil er nur .shf-karte misst.
Fix:     Selektor wie die Farb-Regeln daneben (sammlung.css:354-357) schreiben: :is(.shf-karte, .shf-rk)[data-seltenheit="exklusiv"] .shf-selten { ... }; im Test '.sa-blatt :is(.shf-karte, .shf-rk)' messen (greift nach dem Zusammenfuehren mit emotes, auf c03c590 gibt es kein Regal).
Klasse:  Selektor nur fuer eine der Karten-Klassen — Geschwister: .shf-karte[data-seltenheit in css/pakete/
Proof:   PLAYWRIGHT_PFAD=... timeout 300 node kontrast-rk.mjs im Worktree schach-R19-emotes-finisher (ec965f9): "hell shf-rk "Exklusiv" grund=shf-rk vorher ... 4.18:1 -> mit Regel ... 4.18:1" (3x), "hell shf-karte ... 4.18:1 -> mit Regel ... 4.81:1", SEITENFEHLER 0

Offene Fragen: keine
REVIEW: CHANGES | 1 Befund(e) — 0 kritisch (CONFIRMED), 1 Warnung(en)

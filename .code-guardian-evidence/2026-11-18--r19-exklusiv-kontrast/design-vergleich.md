# design-beweis Shop A vorher (c03c590) gegen nachher (501ae58) · 2026-11-18 · 3f

Aufruf je Stand und Modus (statischer Server, angemeldet mit Testkonto, Server simuliert, Vorlauf oeffnet den Shop):
`node ~/.claude/skills/design-beweis/tools/zustands-probe.mjs "http://127.0.0.1:<port>/index.html?test#heim" --playwright C:/Users/Flo/Documents/KI/schach-R19-arena-figur --vorlauf vorlauf-shop-<modus>.js`

| Stand | Modus | SUMMARY |
|---|---|---|
| vorher c03c590 | hell | probe=219 ok=63 befunde=85 unbekannt=71 |
| nachher 501ae58 | hell | probe=219 ok=63 befunde=85 unbekannt=71 |
| vorher c03c590 | dunkel | probe=219 ok=63 befunde=85 unbekannt=71 |
| nachher 501ae58 | dunkel | probe=219 ok=63 befunde=85 unbekannt=71 |

Befundzeilen ohne Zahlen, sortiert, comm:
- hell, weggefallen: 4 Zeilen `button.shf-karte "ExklusivMitternacht & Go" — Text 4.16:1 unter 4.5:1` (ruhe, hover, focus, active). Neu: 0.
- dunkel: weggefallen 0, neu 0 (dunkel gab es den Text-Befund nicht).
- Die Zahl befunde=85 bleibt, weil dieselbe Karte weiter den Bestandsbefund "Flaeche gegen Umgebung 1.00:1" (strenger als WCAG) traegt; die Probe zaehlt Elemente, nicht Zeilen.
Dunkel ist wirklich dunkel gemessen: die Zahlen weichen von hell ab (z. B. kopf-knopf 1.13 hell, 1.11 dunkel).
Protokolle: design-vorher-hell.log, design-vorher-dunkel.log, design-nachher-hell.log, design-nachher-dunkel.log.

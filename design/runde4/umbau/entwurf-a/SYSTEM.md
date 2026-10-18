# Richtung A: „Modern und klar“: visuelles System

Leitsatz: ruhige Flächen, eine kräftige Farbe, große Schrift, weiche Tiefe. Das Brett bleibt Flos Brett
(Figuren „cburnett“, Feldfarben Nacht, Grün, Holz), neu sind Rahmen, Schatten, Markierungen und alles drumherum.

## Farben (CSS-Variablen auf `:root`, umschaltbar über `data-thema`)

| Rolle | Papier (hell) | Schiefer (dunkel) |
|---|---|---|
| `--grund` Hintergrund | `#F4F1EC` warmes Papier | `#15171B` Schiefer |
| `--grund-2` vertieft | `#ECE8E1` | `#0F1114` |
| `--flaeche` Karten | `#FFFFFF` | `#1E2126` |
| `--flaeche-2` Karten 2. Ebene | `#F8F6F2` | `#262A30` |
| `--text` / `--text-2` / `--text-3` | `#1C1B19` / `#6E6A63` / `#7A746B` | `#F3F1EC` / `#A4A7AE` / `#8B8F97` |
| `--akzent` (die eine Farbe: Zinnober) | `#CC4820` (Weiß darauf 4,7:1) | `#C8441E` (4,9:1) |
| `--akzent-text` (Text auf Fläche) | `#C2441D` | `#FF825F` |
| `--gold` (nur Sterne, Material) | `#E0A22B` | `#F2BE4A` |

**Akzent-Regel (Runde 2):** Zinnober nur für die eine Primäraktion pro Screen (Spielen, Nächster Gegner, Lösen)
und für „Nächster Gegner“ auf der Leiter. Schalter, aktive Navigation, laufende Uhren, Haken, Regler und Auswahlringe
sind Tinte. Kleine Texte nutzen `--text-2`, `--text-3` nur noch für Deko.

Kein Neon: keine Leuchtränder, kein Glow, keine Verläufe als Hauptmittel. Bot-Farben sind
gedämpfte Fassungen der heutigen Farben und erscheinen nur als Tönung hinter dem Avatar.

Zugklassen (eigene, ruhigere Palette; Form verrät die Gruppe wie heute: Raute = Brillant,
Sechseck = Großartig, Achteck = Patzer, Kreis = Rest): Brillant `#17A398`, Großartig `#4C6EF5`,
Bester Zug `#2E9E63`, Exzellent `#6AAE3E`, Gut `#8A9E92`, Buchzug `#B0885E`, Ungenau `#D9A520`,
Fehler `#E3822F`, Chance verpasst `#9C6ADE`, Patzer `#D9434E`, Erzwungen `#8C93A3`.
Als Text (Coach-Titel, Rätsel) gelten eigene Fassungen `--kt-*` mit mindestens 4,5:1, z. B. Ungenau `#8C6A10`,
Brillant `#0D7D74`; im Dunkeln hellere Fassungen.

## Brett

Feldfarben exakt wie in der App (`js/ui/einstellungen.js`): Nacht `#e4e8f6`/`#7c87b6` (Standard),
Grün `#eeeed2`/`#769656`, Holz `#f0d9b5`/`#b58863`. Verfeinert: Rahmen als schmaler Sockel in
Kartenfarbe mit Haarlinie, Ecken 14 px, dreistufiger weicher Schatten darunter. Letzter Zug als
warme Tönung, Auswahl als Akzent-Tönung mit angehobener Figur, Zielpunkte als weiche Scheiben,
Schlagziele als Ringecken, Schach als ruhiger roter Hof. Auswahl (Runde 2): ruhige Abdunklung mit heller Innenkante
statt Akzent-Tönung. Abzeichen verschwinden, sobald ihr Feld geschlagen oder verlassen wird. Koordinaten in Manrope 700, klein, innen.

## Schrift (beide SIL OFL, lokal unter `schriften/`)

- Display: **Bricolage Grotesque** (variabel, optische Größe), 700 bis 800, Laufweite -0,02 bis -0,035 em.
- Text: **Manrope** (variabel), 500 bis 800, Ziffern tabellarisch für Uhren und Zahlen.
- Skala: Display 44 bis 64 px · H1 30 px · H2 22 px · Text 16 px · Klein 13,5 px · Überzeile 11,5 px (700, Versalien, +0,08 em).

## Ebenen und Schatten

| Ebene | Einsatz | Schatten (hell) |
|---|---|---|
| 0 Grund | Seite | keiner |
| 1 Karte | Listen, Felder | `0 1px 2px` + `0 1px 1px` (sehr leicht) |
| 2 Schwebend | Detail-Panel, Coach | `0 1px 2px` + `0 4px 10px -2px` + `0 12px 24px -8px` |
| 3 Bühne | Brett, Sheets, Ergebnis | `0 2px 4px` + `0 10px 24px -6px` + `0 32px 64px -16px` |

Im Dunkeln dieselben Stufen mit tieferem Schwarz und 1 px Lichtkante oben (`inset 0 1px 0 rgba(255,255,255,.05)`).
Mattes Glas nur für die Tab-Leiste (`-webkit-backdrop-filter`), sonst deckende Flächen. Overlays (Ergebnis, Sheet)
nutzen KEINEN Weichzeichner mehr: Schleier als reines rgba, der Screen darunter tritt per `scale(.975)` zurück.
Schatten nie als `filter` auf großen, bewegten Flächen (kostete im Intro und in der Feier 50 bis 67 ms pro Bild).

Radien: 10 / 16 / 24 / 30 px, Pillen 999 px. Abstände: 4er-Raster (4, 8, 12, 16, 24, 32, 48).

## Bewegung

Eine Sprache für alles: **Federn** für Dinge, die ankommen (Karten, Abzeichen, Sterne, Schalter),
**Gleiten** (Expo-Out) für Dinge, die reisen (Figuren, Bildschirme, Balken), **nie linear**.

| Variable | Wert | Einsatz |
|---|---|---|
| `--feder` | Feder k=420, d=30 (leichtes Überschwingen), Ersatz `cubic-bezier(.34,1.36,.64,1)` | Druck, Schalter, Chips |
| `--feder-weich` | k=210, d=24, Ersatz `cubic-bezier(.22,1.12,.36,1)` | Karten, Panels |
| `--feder-hupf` | k=520, d=18, Ersatz `cubic-bezier(.34,1.7,.5,1)` | Abzeichen, Sterne |
| `--gleiten` | `cubic-bezier(.16,1,.3,1)` | Figuren, Seitenwechsel, Balken |
| `--sanft` | `cubic-bezier(.65,0,.35,1)` | Überblendungen |
| Dauern | 120 / 200 / 320 / 520 / 800 ms × `--tempo` | xs / s / m / l / xl |

Federn werden zur Laufzeit als echte Federkurve (`linear()`) berechnet, wo der Browser das kann.
`--tempo`: langsam 1,5 · normal 1 · schnell 0,6 · aus 0. `prefers-reduced-motion` setzt „aus“
(nur Überblendungen, Klang bleibt). Druck-Feedback: jeder Knopf 0,96 mit Feder zurück.
Gestaffelte Eintritte: 40 bis 60 ms Versatz. Gemeinsame Elemente: Detail-Karte wächst zur Duell-Bühne,
Avatar und Monogramm fliegen an ihren Platz in der Partie. Klang sitzt auf dem Moment der Ankunft
(Figur landet, Stern schlägt ein), nicht auf dem Start.

## Klang

Vertrag wie vorgegeben: `spiele(name)` lädt `../klang/<paket>/<name>.mp3` per fetch und
`decodeAudioData`, vorgeladen, fehlende Datei bleibt still. Standardpaket: Holz, Arcade wählbar (wirkt sofort).

- **Pegel:** Die Dateien sind gemastert, die Hierarchie steckt drin (Brillant am lautesten, Patzer am leisesten).
  Im Code kein zweites Gewicht mehr; der Regler wirkt gehörrichtig (Pegel = Wert²).
- **Mischen nach Vorrang** (höchstens 4 Stimmen): 3 = Sieg, Brillant, Sterne, Start, Niederlage, Remis,
  Rätsel gelöst (werden nie abgebrochen) · 2 = Bewertungen, Schach, Umwandlung, Zeitwarnung · 1 = Zug, Schlagen,
  Rochade · 0 = Klick, Schalter, Wechsel, Zurück (werden zuerst geopfert).
- **Ein führender Klang pro Moment:** Figur landet (Zug/Schlagen/Schach), 150 ms später der Bewertungsklang.
  Gut, Buchzug, Exzellent, Erzwungen bleiben still. Die Combo steckt im Bewertungsklang (combo, combo-2, combo-3
  ersetzen „bester“ ab der zweiten Serie).
- **Takt statt Tempo:** Klang-Abstände (Demo, Feier) skalieren mit dem Animationstempo, aber nie unter 0,6.
  Bei reduzierter Bewegung erklingen Fanfare und drei Sterne vollständig.
- **iOS:** entsperrt auf touchend, click, keydown, pointerup; erst als entsperrt markiert, wenn der Kontext läuft.
- **Klang-Schalter** im Kopf jeder Hauptseite, der Partie und des Rätsels (stumm, ohne die Lautstärke zu verlieren).
- Klangstufe „Nur wichtige“: Start, Brillant, Sterne, Ergebnis, Zeitwarnung.

## Inszenierte Momente (Stand 17.10., Runde 2)

| Moment | Was passiert | Dauer |
|---|---|---|
| Arena-Eintritt | Kopf gleitet ein, die zehn Stufen der Leiter wachsen von unten (Feder weich, 48 ms Versatz), Porträts fallen federnd auf ihre Stufe, Detail-Karte gestaffelt | ca. 1,1 s |
| Die Leiter | sichtbar aufsteigende Treppe: besiegt = Tinte mit Sternen, nächster Gegner = Zinnober mit „Los“, gesperrt = hell mit Schloss. Gewählte Stufe hebt sich, Namensschild federt auf. Auf dem Handy waagrecht wischbar | |
| Bot wählen | Stufe hebt sich, Porträt federt, Detail blendet alt aus (130 ms) und neu gestaffelt ein | 0,5 s |
| Duell-Bühne | Bot-Hälfte in satter Bot-Farbe wächst aus der Detail-Karte (nur transform), Flos Hälfte (Schiefer, sein König) schiebt sich mit schräger Naht herein, beide Porträts fliegen dabei schon zur Mitte, „gegen“ schlägt auf der Naht ein, genau dann der Start-Klang. Haltephase: beide Seiten treiben 11 px aufeinander zu. Dann fliegen die Porträts an ihren Platz in der Partie | 1,3 s, Tippen überspringt |
| Zug | Figur gleitet (Expo-Out), Klang beim Landen, Abzeichen federt am Zielfeld, Balken gleitet, Coach-Karte wechselt | 0,3 bis 0,5 s |
| Brillant | einziger großer Moment der Partie: Feld-Puls, Ring, acht Funken (0,6 bis 0,9 Feldbreiten), ein Lichtstreif über das ganze Brett, Brett hebt sich 1,2 %. Das Etikett „Brillant!“ sitzt als Pille in der Coach-Karte (nie über den Figuren), Karte mit Brillant-Ring, COMBO wird Brillant-grün | 1 s |
| Patzer | kleines rotes Abzeichen, ruhig eingeblendet (kein Wackeln), leiser Klang, sachlicher Coach-Text | 0,4 s |
| Uhr | laufend = Tinte; unter 20 s = Rot gefüllt mit Uhr-Symbol und Sekundenpuls (nur dann Rot) | |
| Ergebnis Sieg | Karte federt auf, Titel sofort, Fanfare; drei Sterne schlagen nacheinander ein (je ein Klang, steigend), Feier-Zeilen (Brillant, Serie, neu freigeschaltet) gleiten gestaffelt ein. Alles vorab geplant, daher kein Aufblitzen | ca. 1,8 s |
| Ergebnis Niederlage | ruhig: kleinerer Titel, „Lichtblick“-Karte zuerst, leiser Klang | 0,8 s |
| Zurück in der Arena | alte Stufe wird besiegt (Sterne fallen ein), das Schloss der neuen springt ab, Stufe färbt sich Zinnober, ein Stern-Klang | ca. 1,4 s |

Ruhe-Regeln: keine Endlos-Animationen, Uhren pausieren bei verstecktem Tab, `prefers-reduced-motion` setzt Tempo „aus“
(Intro entfällt, Klang bleibt im Takt).

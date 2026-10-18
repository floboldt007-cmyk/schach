# Entwurf C "Verspielt und saftig": visuelles System

Leitbild: ein hochwertiges Brettspiel zum Anfassen. Hell, warm, kräftige Farben, runde Formen,
Knöpfe mit echter Drucktiefe, Bewegungen mit Federn und Überschwingen. Kein Neon, kein Leuchten,
keine Pixel. Das Brett ist Flos Brett (Figuren cburnett, Feldfarben Nacht/Grün/Holz) in einem
runden Spielzeug-Rahmen.

## Farben (CSS-Variablen in `:root`)

| Rolle | Variable | Wert | Lippe (3D-Unterkante) |
|---|---|---|---|
| Himmel oben | `--himmel` | #CFE2FF | |
| Grund (Creme) | `--grund` | #FFF4E4 | |
| Karte / Fläche | `--papier` | #FFFCF6 | `--papier-lippe` #EADCC4 |
| Tinte (Text) | `--tinte` | #2B2459 | |
| Tinte leise | `--tinte-2` / `--tinte-3` | #5E5888 / #9C97BA | |
| Mandarine (Hauptaktion) | `--orange` | #FF7A3D | #D65A1F |
| Sonne (Sterne) | `--gelb` | #FFC531 | #D9980C |
| Minze (gut, Erfolg) | `--minze` | #2EC4A0 | #1D977B |
| Himmel (Info, Training) | `--blau` | #4AA8F5 | #2A80CB |
| Traube (Auswahl) | `--traube` | #7C6CF0 | #5847CC |
| Beere (Kartei, Warnung) | `--beere` | #F2557A | #C53658 |

Bot-Farben sind entsättigte, freundliche Fassungen der heutigen Bot-Farben (Benno Wiese, Hilde Rosé,
Kalle Senf, Lisa Himmel, Rudi Orange, Turm Periwinkel, Delia Himbeere, König Kamel, Greta Violett,
Stockfisch Meer). Zugklassen behalten Flos Symbolformen (Raute, Sechseck, Kreis, Achteck), aber mit
erdigeren Farben: Brillant #1DB9B0, Großartig #5C7CFA, Bester Zug #36B864, Exzellent #8CC63F,
Gut #93B5A6, Buchzug #C8925C, Ungenau #F2B630, Fehler #F28B30, Chance verpasst #BF6BDE,
Patzer #E5484D, Erzwungen #9AA1B9.

Brett: Feldfarben unverändert aus `js/ui/einstellungen.js` (Nacht #e4e8f6/#7c87b6 Standard, Grün
#eeeed2/#769656, Holz #f0d9b5/#b58863). Rahmen je Brett: Nacht #4A4F86, Grün #4E6E37, Holz #8A5B3A,
jeweils mit heller Oberkante, dunkler Lippe und weichem Schlagschatten. Koordinaten stehen auf dem
Rahmen statt in den Feldern.

## Schrift

- **Fredoka** (SIL OFL, variabel 300 bis 700): Logo, Titel, Knöpfe, Zahlen, Uhren.
- **Nunito** (SIL OFL, variabel): Fließtext, Beschriftungen.
- Stufen: Riesig 56 bis 84 px (Ergebnis), Titel 28 bis 34 px, Kartentitel 20 bis 22 px,
  Text 15 bis 17 px, Etikett 12 bis 13 px fett mit Sperrung.

## Ebenen und Tiefe

1. Himmel und Welt (Karte mit Hügeln, Pfad, Stationen)
2. Flächen (Karten): Creme mit 5 px Lippe und weichem Schatten `--schatten-1`
3. Schwebend (Bot-Detail, Blätter, Coach-Karte bei Brillant): `--schatten-2`
4. Überlagerungen (Duell-Intro, Ergebnis, Bestätigung): abgedunkelter Grund + Federn

Radien: 12 / 18 / 26 / 34 px. Knöpfe: 3D mit Lippe (`--lippe` 5 bis 6 px). Beim Drücken sinkt der
Knopf um die Lippe ein (90 ms), beim Loslassen federt er mit Überschwingen zurück.

## Bewegung

| Token | Wert | Wofür |
|---|---|---|
| `--feder` | Feder-Kurve per `linear()` (Ersatz `cubic-bezier(.34,1.56,.64,1)`) | Eintritte, Auswahl, Abzeichen |
| `--feder-weich` | `cubic-bezier(.22,1.18,.36,1)` | Blätter, Seitenwechsel |
| `--rein` | `cubic-bezier(.2,.8,.2,1)` | Gleiten, Kamerafahrt |
| `--raus` | `cubic-bezier(.5,0,.75,0)` | Abgänge |
| `--t-druck` | 90 ms | Knopfdruck |
| `--t-kurz` | 180 ms | Wechsel, Schalter |
| `--t-mittel` | 320 ms | Karten, Seiten |
| `--t-lang` | 560 ms | große Momente |
| `--staffel` | 45 ms | Versatz gestaffelter Eintritte |
| `--tempo` | 1,5 / 1 / 0,6 / 0 | Einstellung Animationstempo (multipliziert alle Dauern) |

Regeln: nur `transform` und `opacity` animieren; gestaffelte Eintritte von oben nach unten bzw. in
Leserichtung; gemeinsame Elemente fliegen zwischen Bildschirmen (Logo, Bot-Medaillon); höchstens ein
großer Moment pro Partie (Brillant bzw. Sieg-Konfetti); einziges Dauerelement ist das sanfte Atmen
des nächsten Gegners, es pausiert bei verstecktem Tab. `prefers-reduced-motion` setzt das Tempo
auf 0: Inhalte erscheinen sofort, Klänge bleiben.

## Klang an Bewegung

Klang startet im Moment der Landung (Figur setzt auf, Stern rastet ein, Abzeichen ploppt), nicht beim
Antippen. Höchstens zwei Klänge gleichzeitig. Klangstufe "Nur wichtige" lässt Bedienklänge und leise
Bewertungen weg. Standardpaket: arcade.

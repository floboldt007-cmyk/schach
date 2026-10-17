# Eichung Schach-Arena: Messbericht (Menschen, Elo-Schaetzung, Bots)

Stand: 17.10.2026, abgeschlossen nach Neustart (11:50 UTC). Messer-Teil des Eichungs-Auftrags. Alles liegt unter
`/tmp/claude-0/-home-user/462c3180-85d9-520a-9c74-b32ac8320084/scratchpad/eichung/messung/`
(Skripte, Rohdaten, Ergebnisse). Im Repo `/home/user/schach` wurde nichts veraendert.
Alle ausfuehrlichen Tabellen mit Intervallen stehen in `ergebnisse/tabellen.md`, hier stehen die
wichtigsten Zahlen und ihre Deutung.

## Kurzfassung

Alle Zahlen auf der **Lichess-Rapid-Skala** (Januar 2024, CC0), gemessen an echten Partien mit bekannter
Wertung, mit den unveraenderten App-Funktionen. 95-%-Intervalle in Klammern.

1. **Die Elo-Schaetzung der App ist bei schwachen Spielern deutlich zu hoch und bei starken zu niedrig.**
   Mit genau der App-Pipeline (Stockfish 19 lite, Tiefe 14) bewertet, wird Lichess 535 im Mittel als 934
   geschaetzt (**+400**, +245 bis +559) und Lichess 733 als 983 (**+250**, +83 bis +431). Um 900 bis 1300
   stimmt das Mittel ungefaehr (+80 bis -60, Intervalle schliessen null ein). Ab 1500 wird zunehmend
   unterschaetzt (Lichess 1915: -440, Lichess 2472: -680). `ELO_TABELLE` staucht echte 540 bis 2470 auf
   800 bis 1600 zusammen (Abschnitt 3). Die grosse Lichess-Stichprobe (5594 Seiten) bestaetigt das.
2. **Gegen die schwachen Bots kommt ein Gegner-Effekt dazu.** Wer gegen einen Gegner spielt, der Figuren
   verschenkt, spielt genauer. Maia-3 als menschenaehnlicher Stellvertreter wird gegen Benno, Hilde, Kalle
   und Rudi um **+390 bis +560** ueber seiner Wertungs-Eingabe geschaetzt (12 bis 24 Seiten je Zeile,
   Abschnitt 4.4). In der App zaehlen ausserdem Partien mit Bewertungsbalken, Live-Symbol, Hinweisen und
   Zuruecknahmen voll fuer die Schaetzung (Code-Befund). Wer nur seine Patzer zuruecknimmt, steigt
   rechnerisch um mehrere hundert Punkte. **Flos Eindruck "zu hoch" ist fuer den unteren Bereich klar
   bestaetigt.** Auf einer niedrigeren Skala (chess.com, Verein) waere die Ueberschaetzung noch groesser.
3. **Eine einzelne Partie sagt wenig.** Die Einzelschaetzung streut mit 320 bis 560 Punkten (SD), nur
   15 bis 47 Prozent liegen innerhalb von plus/minus 200 Punkten der echten Wertung.
4. **Nach Zugqualitaet sind die Bots nicht zu schwach fuer ihr Label, ab Rudi eher zu stark.** Gemessen in
   3035 echten Menschen-Stellungen: Hilde 430, Kalle 760 und Lisa 1080 treffen ihr Label im Rahmen der
   Intervalle. Rudi 1400, Turm 1650, Delia 1840, Koenig 2170 und Greta 2330 liegen 200 bis 370 darueber.
   Benno ist schwaecher als das schwaechste Lichess-Band und hier nicht messbar. Die Leiter ist ungleich:
   Hilde zu Kalle (+100) und Koenig zu Greta (+40) sind fast keine Stufe.
5. **Aber die Bots ziehen nicht wie Menschen, und das erklaert vermutlich Flos Gefuehl "zu schlecht".**
   13 bis 38 Prozent ihrer Zuege sind Zuege, die Menschen ihrer Staerke fast nie spielen (bei echten
   Menschen 3 Prozent). Bei Hilde bis Rudi stammt die Haelfte bis zwei Drittel aller Patzer aus gewichteten
   Zufallszuegen ohne Rechnung. Im Endspiel spielen die Bots dagegen fast fehlerfrei wie eine Engine.
   Gegen den menschenaehnlichen Maia-3 holen die Bots (Stufe 2 bis 9, 96 Partien) 58,5 statt der nach
   Zugqualitaet erwarteten 73,4 Punkte, im Mittel etwa **170 Elo weniger** (KI -340 bis +10; ein Hinweis,
   kein Beweis). Ein Bot kann also im Durchschnitt gut ziehen und trotzdem Partien durch einen einzigen
   ziellosen Zug verschenken.
6. **Vorbehalte:** Lichess ist nicht FIDE, chess.com oder Verein und liegt bei schwachen Spielern hoeher.
   Die Labels 250 und 500 sind auf dieser Skala nicht eichbar. Band 400 ist duenn. Die Referenz-Analyse
   umfasst 30 Partien je Band. Flos eigene Partien wurden nicht gemessen.

Maschinenlesbare Zielwerte fuer das Bot- und das Analyse-Team (je Band Genauigkeit der App-Pipeline,
Patzer/Fehler/Ungenau je 100, Phasen, Verteilung, Verzerrung der App-Schaetzung, gemessene Elo je Bot, alle
mit Intervallen): `ergebnisse/zielwerte.json`.

## 1. Daten und Methode

**Menschen-Daten** (vom Daten-Scout, CC0 aus der Lichess-Datenbank): Rapid-Partien vom Januar 2024 mit
Lichess-Wertung beider Spieler, Baender 400 bis 2400 in 200er-Schritten, beide Spieler im Band, mindestens
40 Halbzuege, keine BOT-Konten. Band 400 ist duenn (23 Partien mit beiden Spielern im Band, dazu 95 Partien,
in denen nur eine Seite im Band liegt). Blitz wurde nicht ausgewertet (keine Bewertungen in den Daten, und
Rapid passt besser zur App, die ohne Uhr spielt).

**Zwei Bewertungsquellen fuer Menschen**, beide durch die unveraenderte App-Funktion `analysierePartie`
(Kopie von `js/review.js`, Klassen, Verlust, Genauigkeit und Gewichte exakt wie in der App):

| Quelle | Engine | Umfang | Wofuer |
| --- | --- | --- | --- |
| Referenz-Analyse | natives Stockfish 18 (avx2), feste Tiefe 14, MultiPV 2 (wie die App, deren Standard-Tiefe 14 ist) | 330 Partien, 653 Spielerseiten, 30 Partien je Band | exakte App-Regeln inkl. "bester Zug" |
| Lichess-Serverbewertung | die %eval-Werte in den PGNs, ueber eine Schein-Engine in dieselbe App-Funktion | 2833 Partien, 5594 Spielerseiten | grosse Stichprobe; kennt keinen besten Zug, liegt daher im Mittel 2,4 Punkte Genauigkeit unter der Referenz |

**Vergleichskurve fuer Bots** ("kombiniert"): Lichess-Stichprobe plus gepaarter Abstand Referenz minus
Lichess auf denselben Partien. Das ist die Referenz-Skala mit der Stichprobengroesse der Lichess-Daten.

**Aufgabe-Punkt:** Menschen geben verlorene Partien auf, Bots spielen bis zum Matt. Fuer alle Vergleiche
Bot gegen Mensch endet die Auswertung deshalb dort, wo die Partie 6 Stellungen in Folge entschieden war
(Bewertung mindestens 10 Bauern oder Matt fuer dieselbe Seite). Genauigkeit und Gewichte werden fuer die
gekuerzte Partie exakt wie in der App neu gerechnet.

**Unsicherheit:** 95-%-Intervalle (KI) per Bootstrap mit 1000 Wiederholungen, gezogen werden ganze Partien
(beide Seiten einer Partie gehoeren zusammen). Samen fest, alles reproduzierbar.

**Kennzahlen** (alle nach App-Regeln, je Zug ohne erzwungene Zuege): Genauigkeit (App-Formel, wie
Lichess), ACPL (Zentibauernverlust, auf plus/minus 10 Bauern begrenzt), Verlust an Gewinnchance in
Prozentpunkten, Patzer/Fehler/Ungenau je 100 Zuege (App-Grenzen 20/10/5 Prozentpunkte), "exzellent+"
(Verlust hoechstens 2 Punkte), Verteilung der Verluste, Spielphasen nach `spielphasen()` der App.

## 2. Menschen: Band zu Kennzahlen

Ganze Partien, wie die App sie bewertet. R = Referenz-Analyse (30 Partien je Band), L = Lichess-Bewertung
(bis 300 Partien je Band). In Klammern das 95-%-Intervall.

| Band | Elo (Mittel) | Seiten R / L | Genauigkeit R | Genauigkeit L | ACPL R | ACPL L | Verlust % je Zug (L) | Patzer/100 L | Fehler/100 L | Ungenau/100 L | exzellent+ % (L) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 400 | 543 | 53 / 118 | 65,5 (58,6 bis 72,0) | 63,5 (59,5 bis 67,2) | 127 (93 bis 172) | 117 (98 bis 142) | 6,3 | 8,5 (7,0 bis 10,3) | 5,7 | 9,5 | 64 |
| 600 | 718 | 60 / 478 | 67,3 (62,1 bis 72,5) | 65,7 (63,7 bis 67,8) | 101 (81 bis 121) | 106 (98 bis 113) | 5,9 | 7,6 (6,8 bis 8,3) | 6,8 | 10,1 | 61 |
| 800 | 913 | 60 / 600 | 69,4 (65,0 bis 73,9) | 67,7 (66,0 bis 69,3) | 86 (75 bis 98) | 93 (88 bis 98) | 5,5 | 6,9 (6,3 bis 7,5) | 7,2 | 9,8 | 61 |
| 1000 | 1107 | 60 / 600 | 75,2 (71,1 bis 78,8) | 70,3 (68,8 bis 71,7) | 75 (66 bis 84) | 82 (78 bis 87) | 5,0 | 5,8 (5,3 bis 6,4) | 7,2 | 10,1 | 62 |
| 1200 | 1303 | 60 / 600 | 76,9 (74,0 bis 79,5) | 74,0 (72,7 bis 75,4) | 69 (63 bis 75) | 73 (69 bis 77) | 4,5 | 5,2 (4,7 bis 5,7) | 6,6 | 9,8 | 63 |
| 1400 | 1501 | 60 / 600 | 78,4 (74,3 bis 82,3) | 75,5 (74,3 bis 76,7) | 64 (57 bis 74) | 66 (63 bis 69) | 4,2 | 4,5 (4,1 bis 4,9) | 6,2 | 10,3 | 64 |
| 1600 | 1698 | 60 / 600 | 81,5 (79,3 bis 83,6) | 78,1 (77,0 bis 79,2) | 52 (46 bis 58) | 58 (55 bis 61) | 3,8 | 3,7 (3,3 bis 4,0) | 6,1 | 10,6 | 64 |
| 1800 | 1895 | 60 / 600 | 81,2 (78,2 bis 83,6) | 79,0 (78,1 bis 80,0) | 50 (44 bis 56) | 55 (52 bis 57) | 3,6 | 3,3 (3,0 bis 3,7) | 5,8 | 9,8 | 65 |
| 2000 | 2084 | 60 / 600 | 83,8 (81,5 bis 86,2) | 81,9 (81,0 bis 82,7) | 41 (36 bis 47) | 47 (45 bis 49) | 3,1 | 2,7 (2,5 bis 3,0) | 4,8 | 8,5 | 68 |
| 2200 | 2292 | 60 / 598 | 85,8 (84,1 bis 87,5) | 84,0 (83,2 bis 84,9) | 37 (32 bis 42) | 40 (39 bis 42) | 2,7 | 2,2 (1,9 bis 2,4) | 4,2 | 7,9 | 71 |
| 2400 | 2473 | 60 / 200 | 86,4 (84,0 bis 88,6) | 85,1 (83,5 bis 86,6) | 34 (30 bis 39) | 36 (33 bis 39) | 2,4 | 2,1 (1,7 bis 2,5) | 3,5 | 6,3 | 74 |

Elo = Mittel der Lichess-Wertungen der Seiten (Referenz-Stichprobe: 535, 733, 916, 1099, 1301, 1493, 1714,
1915, 2103, 2288, 2472). Bei Band 400 enthalten beide Stichproben auch Seiten, deren Gegner hoeher steht.

**Genauigkeit genau so, wie die App sie misst** (App-Pipeline: dieselben 330 Partien mit dem App-Stockfish
19 lite, Tiefe 14; Intervalle in `tabellen.md`, M0): Band 400: 62,6 / 600: 64,5 / 800: 66,1 / 1000: 71,1 /
1200: 74,3 / 1400: 75,5 / 1600: 79,8 / 1800: 79,3 / 2000: 81,9 / 2200: 83,9 / 2400: 85,3. Das ist die
Zahlenreihe, an der eine neue Genauigkeit-zu-Elo-Tabelle der App ansetzen muesste (mit den Intervallen von
plus/minus 2,5 bis 7 Punkten je Band).

**Spielphasen und Art der Fehler** (Lichess-Bewertung, ganze Partien; Intervalle in `tabellen.md`, M5 bis M8):

| Band | Patzer/100 Eroeffnung | Mittelspiel | Endspiel | Zuege mit mehr als 20 P. Verlust (%) | Anteil grober Patzer (mehr als 40 P.) an allen Patzern (%) | Ungenauigkeiten je Patzer |
| --- | --- | --- | --- | --- | --- | --- |
| 400 | 11,4 | 8,6 | 3,8 | 9,7 | 49 | 1,1 |
| 600 | 9,0 | 8,5 | 4,4 | 8,7 | 40 | 1,3 |
| 800 | 7,6 | 8,3 | 4,1 | 7,9 | 35 | 1,4 |
| 1000 | 5,3 | 7,5 | 4,4 | 6,6 | 35 | 1,7 |
| 1200 | 4,2 | 7,3 | 4,0 | 5,9 | 29 | 1,9 |
| 1400 | 3,1 | 5,8 | 4,6 | 5,1 | 29 | 2,3 |
| 1600 | 2,0 | 5,2 | 3,6 | 4,1 | 23 | 2,9 |
| 1800 | 1,3 | 4,8 | 3,6 | 3,8 | 25 | 2,9 |
| 2000 | 0,9 | 3,8 | 3,1 | 3,1 | 20 | 3,2 |
| 2200 | 0,4 | 2,9 | 2,9 | 2,5 | 18 | 3,6 |
| 2400 | 0,4 | 2,6 | 2,9 | 2,4 | 21 | 3,0 |

Was die Menschen-Daten zeigen:

- **Alle Kennzahlen fallen bzw. steigen glatt mit der Wertung**, aber flach: die Genauigkeit steigt nur um
  etwa 1,1 Punkte je 100 Elo (Ausgleichsgerade ueber alle Seiten), von rund 64 bis 66 (Band 400 bis 600)
  auf 85 bis 86 (Band 2400). Die Baender 600 und 800 liegen in der Genauigkeit fast gleich auf
  (Unterschied innerhalb der Intervalle); die Patzerquote trennt sie besser.
- **Menschen spielen in jedem Band zu etwa 60 bis 74 Prozent fast perfekte Zuege** (Verlust hoechstens
  2 Punkte). Schwaechere Spieler unterscheiden sich vor allem durch mehr grobe Fehler, nicht durch weniger
  gute Zuege.
- **Typisch menschliches Fehlerbild:** Schwache Spieler patzen am meisten in der Eroeffnung (Band 400:
  11 Patzer je 100 Zuege), starke fast nur noch im Mittel- und Endspiel. Bei schwachen Spielern ist fast
  jeder zweite Patzer ein sehr grober (mehr als 40 Prozentpunkte), bei starken nur jeder fuenfte. Je
  staerker der Spieler, desto mehr kleine Ungenauigkeiten kommen auf einen Patzer (1,1 bei 400, 3 bis 3,6
  ab 2000).
- **Gegner-Effekt:** Die Genauigkeit einer Seite haengt stark vom Gegner ab (Korrelation mit der
  Genauigkeit des Gegners 0,56 bis 0,58 innerhalb der Baender). Wer gegen einen patzenden Gegner spielt,
  bekommt leichtere Stellungen und eine hoehere Genauigkeit.

## 3. Die Elo-Schaetzung der App an echten Partien

`schaetzeSpielstaerke()` aus der Kopie von `js/review.js`, aufgerufen wie in der App nach einer Partie:
Genauigkeit der Seite, Gegner-Elo (hier die echte Lichess-Wertung des Gegners, in der App das Bot-Label,
geht mit 20 Prozent ein), Zahl der eigenen Zuege. Abweichung = App-Schaetzung minus echte Lichess-Wertung
derselben Seite. "Arena" = Anzeige "Spielstaerke" in `statistik()`: Mittel der letzten 10 Schaetzungen,
auf 50 gerundet (simuliert mit 10 zufaelligen Seiten desselben Bandes, 2000 Mal).

**Hauptspalte ist die App-Pipeline:** dieselben 330 Partien, bewertet mit genau der Engine der App
(Stockfish 19 lite WASM aus `vendor/stockfish`, Tiefe 14, MultiPV 2) und den App-Regeln. Zum Vergleich
die Referenz (Stockfish 18 nativ, gleiche Partien) und die grosse Lichess-Stichprobe.

| Band | echte Elo (Mittel) | Genauigkeit App-Pipeline | App sagt (Mittel) | **Abweichung App-Pipeline (KI)** | Abweichung Referenz | Abweichung Lichess-Stichprobe (KI) | Streuung einer Partie (SD) | Einzelpartie innerhalb plus/minus 200 | Einzelpartie mehr als 200 zu hoch | Arena (10 Partien) innerhalb plus/minus 200 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 400 | 535 | 62,6 | 934 | **+399 (+245 bis +559)** | +462 | +400 (+302 bis +498) | 517 | 36 % | 57 % | 9 % |
| 600 | 733 | 64,5 | 983 | **+250 (+83 bis +431)** | +311 | +276 (+221 bis +330) | 556 | 38 % | 43 % | 41 % |
| 800 | 916 | 66,1 | 997 | **+81 (-27 bis +197)** | +153 | +140 (+96 bis +183) | 393 | 43 % | 30 % | 82 % |
| 1000 | 1099 | 71,1 | 1145 | **+46 (-84 bis +183)** | +151 | +19 (-20 bis +57) | 417 | 47 % | 25 % | 85 % |
| 1200 | 1301 | 74,3 | 1239 | **-61 (-166 bis +43)** | +6 | -42 (-83 bis -3) | 372 | 45 % | 17 % | 88 % |
| 1400 | 1493 | 75,5 | 1338 | **-154 (-290 bis -21)** | -63 | -176 (-214 bis -135) | 460 | 37 % | 15 % | 60 % |
| 1600 | 1714 | 79,8 | 1467 | **-247 (-332 bis -161)** | -184 | -273 (-310 bis -236) | 324 | 33 % | 7 % | 33 % |
| 1800 | 1915 | 79,3 | 1473 | **-441 (-558 bis -336)** | -371 | -421 (-456 bis -387) | 361 | 22 % | 3 % | 2 % |
| 2000 | 2103 | 81,9 | 1617 | **-486 (-596 bis -368)** | -412 | -481 (-514 bis -446) | 441 | 15 % | 8 % | 3 % |
| 2200 | 2288 | 83,9 | 1691 | **-597 (-691 bis -503)** | -506 | -570 (-606 bis -532) | 333 | 15 % | 0 % | 0 % |
| 2400 | 2472 | 85,3 | 1792 | **-680 (-811 bis -559)** | -626 | -674 (-749 bis -606) | 427 | 17 % | 0 % | 0 % |

(App-Pipeline und Referenz: 53 bzw. 60 Seiten je Band aus 30 Partien; Lichess-Stichprobe 118 bis 600
Seiten je Band. Die App-Engine misst im Mittel 2,5 Punkte Genauigkeit weniger als die Referenz,
Abschnitt 5; die Lichess-Serverbewertung liegt im Mittel fast genau auf der App-Pipeline, deshalb ist
ihre groessere Stichprobe eine gute Bestaetigung.)

**Antwort auf Flos Eindruck "zu hoch":**

1. **Ja, fuer schwache Spieler, und deutlich.** Unterhalb von etwa Lichess 800 schaetzt die App im Mittel
   klar zu hoch: +250 (Band 600) bis +400 (Band 400), beide Intervalle weit ueber null. Um Lichess 800
   bis 1200 liegt die App im Mittel ungefaehr richtig (+80 bis -60, Intervalle schliessen null ein), darueber
   schaetzt sie zunehmend zu niedrig (bis -680 bei 2400). Die Tabelle ist also nicht einfach verschoben,
   sondern **staucht den ganzen menschlichen Bereich zur Mitte**: auf die mittlere Genauigkeit der Baender
   (App-Pipeline) angewandt, macht `ELO_TABELLE` aus Lichess 540 bis 2470 nur 800 bis 1600. Zwischen den
   Bandmitteln bringt ein Punkt Genauigkeit rund 85 Elo, in der Tabelle nur 25 bis 60. Fuer eine EINZELNE
   Partie ist eine gewisse Stauchung statistisch sogar richtig (die Partie streut so stark, dass die beste
   Einzelvorhersage zur Mitte gezogen wird; die Ausgleichsgerade echte Elo ueber Genauigkeit hat nur 16 bis
   22 Elo je Punkt), dann muss aber die Mitte zur Spielerschaft passen. Fuer das 10-Partien-Mittel der
   Arena ist die Stauchung zu stark.
2. **Die Skala verstaerkt das.** Lichess-Wertungen liegen bei schwachen Spielern nach allgemeiner
   Erfahrung deutlich ueber FIDE- und chess.com-Zahlen (eine amtliche Umrechnung gibt es nicht). Meint die
   App "Elo" im Sinne von chess.com oder Verein, ist jede Abweichung in der Tabelle um diesen Abstand noch
   groesser. Beispiel: liegt die gemeinte Skala bei einem Spieler 300 Punkte unter Lichess, wird aus +80
   eine Ueberschaetzung von +380.
3. **Eine einzelne Partie sagt wenig.** Die Streuung einer Einzelschaetzung betraegt rund 320 bis 560
   Punkte (SD). Nur 15 bis 47 Prozent der Einzelschaetzungen liegen innerhalb von 200 Punkten der echten
   Wertung. Die Korrelation zwischen App-Schaetzung und echter Wertung ueber alle Seiten ist 0,56
   (App-Pipeline; Lichess-Stichprobe 0,51). Das liegt nicht nur an der Tabelle: die Genauigkeit einer
   Partie haengt stark vom Gegner und vom Partieverlauf ab (Abschnitt 2).
4. **Das Arena-Mittel aus 10 Partien** nimmt die Streuung weitgehend heraus, aber nicht die Verzerrung:
   im Band 800 bis 1200 liegt es zu 82 bis 88 Prozent innerhalb plus/minus 200, im Band 400 nur zu
   9 Prozent und ab Band 1800 so gut wie nie.
5. **Gegen Bots kommt der Gegner-Effekt dazu** (Abschnitt 4.4): wer gegen patzende Bots spielt, hat
   leichtere Stellungen und eine hoehere Genauigkeit als gegen Menschen gleicher Staerke, und das
   Bot-Label zieht die Schaetzung mit 20 Prozent zu sich.
6. **In der App kommt etwas hinzu, das die Lichess-Spieler nicht hatten** (Code-Befund, nicht an Flos
   Partien gemessen, die liegen nur in seinem Browser): Im Standard sind waehrend einer gewerteten Partie
   der Bewertungsbalken (`balken: true`) und das Symbol mit Coach nach jedem eigenen Zug
   (`liveBewertung: true`) an, es gibt keine Uhr, und Zuruecknahmen und Hinweise sind erlaubt; die Partie
   zaehlt trotzdem fuer "Spielte wie" und "Spielstaerke" (`wertet()` prueft nur Modus und Startstellung,
   nur Stern 3 verlangt "ohne Hilfe"). Grobe Was-waere-wenn-Rechnung (`skripte/zuruecknahme.mjs`,
   App-Pipeline): nimmt ein Spieler jeden Patzer zurueck und spielt stattdessen einen fuer ihn
   durchschnittlichen Zug, steigt die Schaetzung im Mittel um **+280 bis +730** (Band 400 bis 1000: +460
   bis +730); nimmt er auch Fehler zurueck, um +560 bis +1190. Das ist nur eine Naeherung (die Partie
   liefe danach anders weiter), zeigt aber die Groessenordnung: schon wenige Zuruecknahmen schieben die
   Schaetzung weit nach oben, und Bots wirken dann schwaecher, weil ihre Gewinnchancen aus Flos Patzern
   wieder verschwinden.

Umgekehrt gelesen (App-Pipeline, alle Baender gleich stark besetzt, also kein Abbild der echten
Spielerschaft): Seiten mit 60 bis 65 Prozent Genauigkeit (42 Seiten) sind im Median Lichess 1100, die App
sagt 850; Seiten mit 70 bis 75 Prozent (82 Seiten) sind im Median 1250, die App sagt 1100; Seiten mit 85
bis 90 Prozent (97 Seiten) sind im Median 2010, die App sagt 1750. Die mittlere Haelfte jeder Stufe ist
viele hundert Punkte breit (E0 bis E2 in `tabellen.md`), eine Partie legt also wenig fest.

## 4. Bots: gemessene Staerke und wie menschlich sie ziehen

### 4.1 Wie gemessen

Die Zuege kommen aus der unveraenderten `botZug()` (Kopie von `js/bots.js`) mit dem App-Stockfish
(19 lite WASM) unter Node, Zufall je Zug mit festem Samen. Stufe 10 (Stockfisch 3000) ist ungebremstes
Stockfish und wurde nicht gemessen. Drei unabhaengige Wege:

- **Weg A (Hauptmass): Bots ziehen in echten Menschen-Stellungen.** 3035 Stellungen: 1100 aus den
  330 Partien der Referenz-Analyse (100 je Band) und 1935 weitere, jede aus einer anderen Partie der
  grossen Lichess-Stichprobe (200 je Band, Band 400 nur 65, Band 2400 nur 70), frisch bewertet. Nur
  Stellungen ab Halbzug 10, ohne Buchzug, nicht erzwungen, vor dem Aufgabe-Punkt. Jeder Bot zieht
  einmal in jeder Stellung; sein Zug und der Zug des Menschen, der dort wirklich gezogen hat, werden mit
  derselben Referenz-Engine nach App-Regeln bewertet. Je Band ergibt das den Abstand "Bot minus Mensch"
  (Verlust je Zug bzw. Patzer je 100). Eine Ausgleichsgerade ueber die Baender (nach Stellungszahl
  gewichtet) zeigt, ab welcher Wertung Menschen in ihren eigenen Stellungen genauso viel verlieren wie der
  Bot: das ist die **gemessene Elo**. Intervalle per Bootstrap ueber Partien. Vorteil: Bot und Mensch
  werden in denselben Stellungen verglichen.
- **Weg B: Selbstpartien** (180 Partien, 20 je Stufe, beide Seiten gleich stark wie in den
  Menschen-Baendern), Kennzahlen gegen die menschliche Kurve. Nachteil: die Stellungen erzeugen die Bots
  selbst; nach Spontanzuegen kippen die Partien frueh, und in schiefen Stellungen kosten weitere Fehler
  weniger Gewinnchance. Weg B ueberschaetzt die Bots deshalb (siehe 4.2), er steht nur zum Vergleich da.
- **Weg C: Ergebnisse.** Leiter (40 Partien je Nachbarpaar), Anker gegen Stockfish mit `UCI_Elo`
  (16 Partien je Paar, Engine-Skala CCRL, nicht menschlich) und Anker gegen Maia-3 mit der Label-Wertung
  des Bots (12 Partien je Stufe; wie stark Maia-R wirklich spielt, wurde mit Weg A gemessen).

### 4.2 Gemessene Elo je Stufe (Lichess-Skala)

| Stufe | Bot | Label | **A: nach Verlust je Zug (KI)** | A: nach Patzer/100 (KI) | B: Selbstpartien nach Genauigkeit | C: gegen Stockfish UCI_Elo (Engine-Skala) | C: gegen Maia-3 (Punkte, Maia effektiv, Bot effektiv) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Bauer Benno | 250 | **weit unter 400** (Gerade kreuzt erst bei -350; nicht messbar) | unter 400 | unter 543 | - | 1,0 / 12 gegen M600; Maia 430; Bot weit unter 400 |
| 2 | Oma Hilde | 500 | **430 (150 bis 630)** | 390 (90 bis 600) | 1080 | - | 5,5 / 12 gegen M600; Maia 430; Bot 400 |
| 3 | Kalle vom Stammtisch | 800 | **760 (490 bis 930)** | 650 (310 bis 860) | 1230 | - | 3,5 / 12 gegen M800; Maia 510; Bot 360 |
| 4 | Lisa Läufer | 1000 | **1080 (880 bis 1220)** | 1150 (930 bis 1320) | 1290 | - | 6,0 / 12 gegen M1000; Maia 1140; Bot 1140 |
| 5 | Ritter Rudi | 1200 | **1400 (1280 bis 1510)** | 1390 (1220 bis 1540) | 1530 | 1360 (1180 bis 1580) | 4,5 / 12 gegen M1200; Maia 1280; Bot 1190 |
| 6 | Professor Turm | 1400 | **1650 (1530 bis 1780)** | 1650 (1490 bis 1830) | 2020 | 1510 (1320 bis 1790) | 9,5 / 12 gegen M1400; Maia 1330; Bot 1570 |
| 7 | Dame Delia | 1600 | **1840 (1730 bis 1960)** | 1980 (1800 bis 2230) | 2190 | 1580 bis 1790 | 8,5 / 12 gegen M1600; Maia 1430; Bot 1580 |
| 8 | Kommissar König | 1800 | **2170 (2030 bis 2380)** | 2300 (2070 bis 2710) | 2460 | mind. 1890 | 11,0 / 12 gegen M1800; Maia 1560; Bot 1970 |
| 9 | Großmeisterin Greta | 2100 | **2330 (2190 bis 2540)** | 2410 (2200 bis 2810) | 2330 | mind. 2290 | 10,0 / 12 gegen M2100; Maia 1680; Bot 1960 |

Werte auf 10 gerundet. Oberhalb von Lichess 2470 (oberstes Band) ist die Gerade verlaengert, dort sind
die Werte unsicherer. Die zwei Stellungssaetze von Weg A stimmen unabhaengig voneinander ueberein
(nach Verlust, erster Satz / zweiter Satz: Stufe 2: 620 / 310, 3: 820 / 720, 4: 1140 / 1050,
5: 1340 / 1430, 6: 1620 / 1660, 7: 1810 / 1860, 8: 2360 / 2080, 9: 2450 / 2250).

**Leiter (Weg C, 40 Partien je Paar):** Wertungsabstand der hoeheren Stufe aus der Punktquote:
1-2 +190, 2-3 **+100** (Label 300), 3-4 +240, 4-5 +170, 5-6 **+300**, 6-7 +110, 7-8 +200, 8-9 **+40**
(Label 300). Die Abstaende sind ungleich; Hilde zu Kalle und vor allem König zu Greta sind fast keine
Stufe (Intervalle in `tabellen.md`, B3).

Was das heisst:

1. **"Die Bots sind fuer ihre Elo zu schlecht" bestaetigt sich auf der Lichess-Skala nicht.** Nach der
   Zugqualitaet in echten Menschen-Stellungen treffen Hilde, Kalle und Lisa ihr Label (innerhalb der
   Intervalle), Rudi bis Greta liegen 200 bis 370 Punkte DARUEBER. Nur Benno (250) ist schwaecher als
   jeder Lichess-Spieler und damit hier nicht eichbar. Meint die App eine niedrigere Skala (chess.com,
   Verein), sind die Bots ab Hilde eher zu stark als zu schwach. Das gilt fuer die Zugqualitaet; in den
   Ergebnissen gegen einen menschenaehnlichen Gegner schneiden sie schlechter ab (Punkt 4).
2. **Selbstpartien (Weg B) liessen die Bots noch staerker aussehen** (Hilde 1080, Turm 2020). Das ist ein
   Artefakt der Stellungen: Bots erzeugen gegen sich selbst frueh schiefe Partien, in denen weitere Fehler
   wenig Gewinnchance kosten. Weg A vermeidet das.
3. **Gegen Stockfish mit UCI_Elo** (Engine-Skala, nicht menschlich) liegen Rudi bis Greta auf oder leicht
   ueber ihrem Label; die Reihenfolge passt.
4. **Gegen einen menschenaehnlichen Gegner holen die Bots weniger Punkte, als ihre Zugqualitaet
   verspricht.** Dafuer wurde Maia-3 selbst in denselben 1100 Menschen-Stellungen gemessen wie die Bots
   (Weg A, Spalte "Maia" oben). Ergebnis: Maia-3 (5M, Zug aus der Verteilung gezogen) spielt gestaucht.
   R 1000 spielt wie 1140, R 1200 wie 1280, R 1600 wie 1430, R 2100 wie 1680; R 600 und 800 liegen am
   unteren Rand der Daten und sind kaum messbar (Intervalle ueber 1000 Punkte breit). Aus beiden gemessenen
   Staerken (Bot und Maia) erwartet man fuer die Stufen 2 bis 9 zusammen 73,4 Punkte aus 96 Partien, die
   Bots holten 58,5. Das entspricht einem gemeinsamen Abschlag von **etwa -170 Elo** (95-%-KI -340 bis +10,
   wenn man die Unsicherheit beider Staerken einrechnet; nur aus den Partien -250 bis -80). Fuer die Stufen
   4 bis 9 allein: -150 (-300 bis +40). Am deutlichsten Kalle (3,5 statt erwarteter 9,7 Punkte) und Rudi
   (4,5 statt 8,0). Das ist ein Hinweis, kein Beweis (12 Partien je Stufe, Maia ist ein Modell und kein
   Mensch). Eine naheliegende Erklaerung, die zu 4.3 passt, aber nicht gesondert gemessen ist: Die Bots
   verlieren Partien durch einzelne ziellose Spontanzuege, die Material verschenken, und ein
   menschenaehnlicher Gegner nimmt das Geschenk an. Der Mittelwert ueber alle Zuege sieht dann besser aus
   als das Ergebnis. Fuer Flo heisst das: Ein Bot kann nach Zugqualitaet auf
   oder ueber seinem Label liegen und sich am Brett trotzdem schwach anfuehlen. Tabellen: `tabellen.md`,
   B4b und "Ergebnisse gegen Maia im Vergleich zur Zugqualitaet"; Skript `skripte/ergebnis_gegen_zugqualitaet.mjs`.
5. **Fuer ein spaeteres Bot-Modell mit Maia** (Lizenzfrage offen): Maias Wertungs-Eingabe ist nicht die
   Staerke, mit der Maia beim Ziehen aus der Verteilung spielt. Oberhalb von etwa 1200 muesste Maia hoeher
   eingestellt werden als die gewuenschte Staerke, und das reicht nach diesen Daten nur bis etwa 1700.

### 4.3 Ziehen die Bots wie Menschen?

**Nein, und das ist vermutlich der Kern von Flos Eindruck.** Die Staerke stimmt grob, die Art der Zuege
nicht:

- **Zugwahl (Maia-3 als Modell menschlicher Zuege, 1100 Stellungen):** Echte Menschen spielen nur
  3,1 Prozent Zuege, denen Maia (bei ihrer eigenen Wertung) weniger als 1 Prozent Wahrscheinlichkeit gibt.
  Bei den Bots sind es 13,5 (Greta) bis 38 Prozent (Benno), bei Lisa und Rudi 17 Prozent, und zwar selbst
  bei der Maia-Wertung, die zu ihren Zuegen am besten passt. Maias Lieblingszug ist bei Menschen in
  52 Prozent der gespielte Zug, bei den Bots in 18 bis 42 Prozent. In derselben Stellung spielen die Bots
  den Zug des Menschen nur zu 15 bis 32 Prozent. Die mittlere Log-Wahrscheinlichkeit ihrer Zuege liegt
  0,66 (Greta) bis 2,4 (Benno) unter der echter Menschen (Intervalle in `tabellen.md`, H2); fuer Lisa
  bedeutet -1,29, dass ein typischer Bot-Zug etwa 3,6-mal unwahrscheinlicher ist als ein typischer
  Menschenzug. Gleichzeitig erkennt Maia die Wertung der echten Menschen grob richtig (die am besten
  passende Wertung steigt mit dem Band, H1), die Messung traegt also.
- **Spontanzuege sind der unmenschlichste Teil.** Der gewichtete Zufallszug ohne Rechnung (Anteil an
  allen Zuegen in Weg A: Benno 49, Hilde 37, Kalle 21, Lisa 15, Rudi 9, Turm 6 Prozent) ist in echten
  Stellungen in 25 bis 35 von 100 Faellen ein Patzer. Der schwaechste Mensch (Band 400) patzt in 10 bis
  12 von 100 Zuegen. Bei Hilde bis Rudi stammen 49 bis 67 Prozent aller Patzer aus diesen Zuegen. Ein Mensch
  verschenkt Material, weil er eine Drohung uebersieht; der Bot verschenkt es, weil er "irgendeinen
  plausiblen" Zug zieht. In den Selbstpartien ist ein Patzer von Benno bis Turm deutlich oefter ein Zug
  der eigenen Figur auf ein angegriffenes Feld (34 bis 48 Prozent ihrer Patzer, Menschen 12 bis
  30 Prozent, B7).
- **Die Verteilung der Verluste ist dagegen bei passender Staerke recht menschlich**
  (`ergebnisse/fingerabdruck.json`): Kalle in Stellungen der Baender 400 bis 800 hat 8,4 Patzer je 100
  (Menschen dort 9,4; grob, also mehr als 40 Punkte, sind 34 Prozent seiner und 42 Prozent der
  menschlichen Patzer); Rudi in Stellungen von 1000 bis 1400 hat 4,8 (Menschen 5,1). Das Fehler-Niveau
  passt also, die Fehler-Art nicht.
- **Ungleichmaessige Staerke ueber die Partie:** Bots spielen in einfachen Stellungen fast fehlerfrei
  und brechen in komplexen staerker ein als Menschen gleicher Gesamtstaerke (Kalle: 8,4 Patzer je 100 in
  Stellungen von 400-800-Spielern, 15,9 in Stellungen von 1600-2000-Spielern; Delia 2,1 bzw. 3,6).
- **Spielphasen (Selbstpartien, gekuerzt):** In der Eroeffnung patzen die Bots etwa so oft wie Menschen
  ihrer Staerke (Kalle 6,6 je 100 Eroeffnungszuege, Menschen um 800: 7,0). Im Endspiel sind sie dagegen
  viel sicherer als Menschen: Rudi 1,1 und Koenig 0,7 Patzer je 100 Endspielzuege, Menschen um 1200: 4,6,
  um 1600 bis 2000: 3,7 bis 5,9. Menschen bleiben im Endspiel bis in hohe Baender fehleranfaellig, die
  Bots rechnen es wie eine Engine. (Einschraenkung: Endspiele aus Bot-Partien sind oft schon entschieden.)

### 4.4 Was die App sagt, wenn ein "Mensch" gegen die Bots spielt (Maia als Stellvertreter)

In den 108 Maia-Anker-Partien spielt Maia-3 mit Wertung R gegen den Bot mit Label R. Nach jeder Partie
wurde die App-Schaetzung fuer Maias Seite berechnet, genau wie die App es fuer Flo tut (Gegner-Elo =
Bot-Label; Referenz-Engine, gekuerzt am Aufgabe-Punkt; je Zeile 12 Seiten, bei 600 sind es 24).

| Maia-R (gemessen) | gegen | Seiten | Genauigkeit (KI) | App sagt (Mittel) | Abweichung von R (KI) | Abweichung von Maias gemessener Staerke | gegen sich selbst: Genauigkeit / Abweichung von R (KI) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 600 (430) | Benno, Hilde | 24 | 72,9 (66,0 bis 79,7) | 1160 | **+560 (+333 bis +804)** | +730 | 68,3 / +428 (+128 bis +741) |
| 800 (510) | Kalle | 12 | 76,4 (70,7 bis 81,7) | 1188 | **+388 (+208 bis +558)** | +680 | - |
| 1000 (1140) | Lisa | 12 | 74,0 (66,9 bis 79,2) | 1150 | +150 (0 bis +271) | +10 | - |
| 1200 (1280) | Rudi | 12 | 84,9 (78,4 bis 89,7) | 1675 | **+475 (+233 bis +692)** | +400 | - |
| 1400 (1330) | Turm | 12 | 76,3 (67,5 bis 83,2) | 1346 | -54 (-321 bis +171) | +10 | - |
| 1600 (1430) | Delia | 12 | 82,0 (76,5 bis 86,9) | 1563 | -38 (-267 bis +213) | +140 | - |
| 1800 (1560) | Koenig | 12 | 79,4 (74,7 bis 83,5) | 1458 | -342 (-504 bis -183) | -100 | - |
| 2100 (1680) | Greta | 12 | 80,8 (73,1 bis 87,0) | 1583 | -517 (-763 bis -300) | -90 | - |
| 1100 | nur sich selbst | 16 | - | - | - | - | 66,5 / -28 (-219 bis +172) |
| 1500 | nur sich selbst | 16 | - | - | - | - | 71,1 / -203 (-550 bis +150) |
| 1900 | nur sich selbst | 16 | - | - | - | - | 80,3 / -344 (-622 bis -75) |

"Maia-R (gemessen)" = Maias Wertungs-Eingabe, in Klammern die in Menschen-Stellungen gemessene Staerke
(Abschnitt 4.2, Punkt 4; unter 1000 sehr unsicher).

Deutung: **Gegen die schwachen Bots (Stufe 1 bis 3, dazu Rudi) schaetzt die App den Stellvertreter klar zu
hoch: +390 bis +560 ueber Maias Wertungs-Eingabe, gemessen an Maias tatsaechlicher Staerke sogar +400 bis
+730. Gegen die starken Bots (6 bis 9) wirkt sie an der Eingabe gemessen zu niedrig, an Maias gemessener
Staerke aber ungefaehr richtig (-100 bis +140).** Lisa (Stufe 4) faellt aus der Reihe (+10 bzw. +150). Dahinter steckt neben der Tabelle der Gegner-Effekt aus
Abschnitt 2: wer gegen einen Gegner spielt, der Figuren verschenkt, bekommt leichte Stellungen und eine
hohe Genauigkeit (Maia-600 gegen Benno und Hilde 72,9 Prozent, gegen sich selbst 68,3). Weil Flo
vermutlich vor allem gegen die unteren und mittleren Stufen spielt, wirken Tabelle und Gegner-Effekt bei
ihm in dieselbe Richtung. Die Stichprobe ist klein (12 Partien je Zeile), die Intervalle sind breit.

## 5. Gegenproben: haengt das Ergebnis an der Engine?

Dieselben Partien zweimal bewertet, gepaart je Spielerseite (Stichprobe: 2 Menschen-Partien je Band und
eine Selbstpartie je Bot-Stufe).

| Vergleich | Partien / Zuege | Genauigkeit A zu B | Abstand B minus A (Standardfehler) | Patzer/100 A zu B | gleiche Klasse | Elo-Schaetzung B minus A |
| --- | --- | --- | --- | --- | --- | --- |
| Menschen: Referenz Tiefe 14 (A) gegen Tiefe 18 (B) | 22 / 1689 | 78,5 zu 78,0 | -0,5 (0,2) | 4,2 zu 4,1 | 75 % | -14 (SD 56) |
| Bots: Tiefe 14 gegen Tiefe 18 | 9 / 714 | 75,5 zu 74,7 | -0,9 (0,2) | 5,0 zu 5,2 | 72 % | - |
| Menschen: Referenz (SF 18 nativ) gegen App-Engine (SF 19 lite WASM), beide Tiefe 14, Stichprobe | 22 / 1689 | 78,5 zu 75,0 | -3,5 (0,5) | 4,2 zu 4,9 | 70 % | -106 (SD 79) |
| **Menschen: Referenz gegen App-Engine, alle Partien** | 330 / 23601 | 77,5 zu 75,1 | **-2,5 (0,1)** | 4,1 zu 4,8 | 69 % | **-74 (SD 95)** |
| Bots: Referenz gegen App-Engine | 9 / 676 | 75,4 zu 72,9 | -2,5 (0,9) | 5,2 zu 5,6 | 67 % | - |
| Menschen: Referenz gegen Lichess-Serverbewertung | 330 / 23601 | 77,5 zu 75,1 | -2,4 (0,1) | 4,1 zu 4,7 | 58 % | -78 (SD 97) |

Deutung:

- **Tiefe 14 reicht.** Tiefe 18 aendert Genauigkeit und Patzerquote kaum; die Klassen einzelner Zuege
  wechseln vor allem zwischen Nachbarn (exzellent und bester, gut und exzellent).
- **Die App-Engine misst strenger.** Das kleine Netz von Stockfish 19 lite bewertet unruhiger; weil ein
  Verlust nie negativ wird, macht Unruhe die Verluste im Mittel groesser. Ueber alle 330 Partien liegt die
  Genauigkeit 2,5 Punkte niedriger (Band 400 bis 1400: 2,6 bis 4,1; ab 1600: 1,1 bis 2,0), die
  App-Schaetzung im Mittel 74 Punkte tiefer als mit der Referenz. Deshalb nutzt Abschnitt 3 die
  App-Pipeline selbst (Tabelle E0 in `tabellen.md`).
- **Fuer den Vergleich Bot gegen Mensch spielt die Engine wenig Rolle**, solange beide mit derselben
  Engine bewertet werden: Bots und Menschen verschieben sich gleich (Bots -2,5 in einer kleinen Stichprobe
  von 9 Partien, Menschen -2,5 ueber alle 330 Partien). Die Bot-Zuordnung in Abschnitt 4 nutzt deshalb die
  schnellere Referenz.

## 6. Grenzen (ehrlich)

1. **Skala.** Alle Wertungen sind Lichess-Glicko-2 (Rapid, Januar 2024). Das ist weder FIDE noch
   chess.com noch Vereins-Elo. Bei schwachen Spielern liegen Lichess-Zahlen nach allgemeiner Erfahrung
   deutlich hoeher als die anderen Skalen; eine belastbare, amtliche Umrechnung gibt es nicht, deshalb wird
   hier nicht umgerechnet. Welche Skala die App meint, ist eine Entscheidung, keine Messung.
2. **Untere Labels nicht eichbar.** Unter Lichess 400 gibt es keine Spieler, Band 400 ist duenn
   (Referenz 53 Seiten, Lichess 118 Seiten, Erweiterung 65 Stellungen). Die Labels 250 und 500 lassen sich
   auf dieser Skala nicht pruefen, nur "liegt unter Band 400" feststellen.
3. **Online-Wertung ist nicht Spielstaerke im Verein.** Glicko-Wertungen schwanken je Spieler um
   50 bis 100 Punkte; die Wertung beim Partiebeginn ist eine Momentaufnahme.
4. **Auswahl der Partien.** Die Rapid-Partien 2024 (Quelle B des Scouts) sind solche, fuer die jemand eine
   Server-Analyse angefordert hat. Ob das die Kennzahlen verschiebt, ist ungemessen. Die Partien tragen keine
   Lichess-ID und sind einzeln nicht nachpruefbar. Blitz wurde nicht ausgewertet.
5. **Engine.** Referenz ist natives Stockfish 18 bei Tiefe 14, die App nutzt Stockfish 19 lite (WASM) bei
   Tiefe 14. Die Gegenproben (Abschnitt 5) zeigen, wie gross der Unterschied ist.
6. **Stichproben.** Referenz-Analyse 30 Partien je Band; die Intervalle sind entsprechend breit (z. B.
   Genauigkeit Band 400: 58,6 bis 72,0). Die Lichess-Stichprobe ist zehnmal groesser, aber ohne "besten Zug".
7. **Aufgabe-Punkt.** Das Kuerzen bei 6 entschiedenen Stellungen ist eine Naeherung fuer "Mensch gibt
   auf" (`skripte/k_empfindlichkeit.mjs`). K = 4 statt 6 aendert die Bot-Kennzahlen um hoechstens
   1 Punkt Genauigkeit und 0,5 Patzer je 100; groessere K sind fuer Bots nicht pruefbar, weil ihre Analyse
   bei K = 6 endete. Bei Menschen wirkt das Kuerzen fast nur im Band 400 (Genauigkeit 61,0 bei K = 4,
   61,5 bei 6, 63,4 bei 10, 65,5 ungekuerzt). Die Hauptmessung der Bots (Abschnitt 4, Weg A) haengt davon
   nur ueber die Auswahl der Stellungen ab.
8. **Bots in Node statt im Browser.** Bot-Zuege kommen aus der unveraenderten `botZug()` mit dem
   App-Stockfish (WASM) unter Node auf einer Server-CPU. Auf dem iPad ist die Engine langsamer; die
   Tiefen-Suchen der Bots erreichen ihre Tiefe trotzdem meist weit vor den Zeitdeckeln (4000 ms, Greta
   2500 ms), ungemessen ist das aber auf dem Geraet.
9. **Maia-3** ist selbst nur ein Modell menschlicher Zuege, trainiert auf Lichess-Partien (wahrscheinlich
   inklusive des Testzeitraums), und kein Mensch. Lizenz AGPL-3.0, deshalb nur Mess-Werkzeug, nicht fuer
   die App. Gezogen aus der Verteilung (Temperatur 1) spielt das 5M-Modell gestaucht (R 2100 wie Lichess
   1680, Abschnitt 4.2). Seine Wertungs-Eingabe ist deshalb kein Massstab; ueberall, wo Maia als Anker dient,
   wird seine in Menschen-Stellungen gemessene Staerke benutzt, und die ist unter 1000 sehr unsicher. Der
   Vergleich Ergebnis gegen Zugqualitaet (4.2, Punkt 4) beruht auf 12 Partien je Stufe.
10. **Flos eigene Partien** wurden nicht gemessen (sie liegen nur in seinem Browser). Die Aussagen zu
    Bewertungsbalken, Live-Symbol, Zuruecknahmen und fehlender Uhr sind ein Code-Befund plus eine grobe
    Was-waere-wenn-Rechnung, keine Messung an seinem Spiel.
11. **Die Kreuzungs-Methode (Weg A)** ist nur auf Rangfolge geprueft: Sie ordnet die Maia-Wertungen
    richtig an (600 bis 2100 streng steigend), eine absolute Pruefung gegen echte Menschen ausserhalb der
    Stichprobe gibt es nicht. Sie vergleicht den mittleren Verlust je Zug; wie sich Fehler auf Partien
    verteilen (ein grober Patzer statt vieler kleiner), bildet sie nur ueber die Patzer-Spalte ab.

## 7. Dateien und Nachrechnen

Wurzel: `/tmp/claude-0/-home-user/462c3180-85d9-520a-9c74-b32ac8320084/scratchpad/eichung/messung/`

- `app/` Kopien aus dem Repo: `js/review.js` und `js/bots.js` (unveraendert, identisch mit dem Repo-Stand
  vom 17.10.), `js/engine.js`, `js/openings.js`, `js/storage.js`, `vendor/stockfish` (Stockfish 19 lite
  WASM der App), `vendor/chess/chess.js`.
- `lib/` Werkzeug: `engine-node.mjs` (die unveraenderte App-Klasse `Engine` unter Node, wahlweise mit dem
  App-Stockfish oder dem nativen Stockfish 18; alle Prozesse mit nice 19), `kennzahlen.mjs` (Seiten,
  Kennzahlen, Bootstrap ueber Partien, Umkehrung der Kurve), `kuerzen.mjs` (Aufgabe-Punkt), `pgn.mjs`,
  `laden.mjs`.
- `skripte/` (Reihenfolge zum Nachrechnen):
  1. `baue_auftraege.mjs` (Auswahl der Partien, Samen 20261017)
  2. `analysiere.mjs` (Referenz bzw. App-Pipeline: `--engine=nativ|app --tiefe=14`, fortsetzbar)
  3. `lichess_eval.mjs` (grosse Stichprobe mit Lichess-Bewertung)
  4. `menschen.mjs --quelle=nativ14|lichess|app14 [--kuerzen=6]`, `kurve.mjs`, `treffer.mjs`,
     `zusammenhang.mjs`, `zuruecknahme.mjs`
  5. `botpartien.mjs` (Selbst-, Nachbar- und UCI_Elo-Partien), Analyse mit `analysiere.mjs
     --entschieden=6`, Auswertung `bots.mjs`, `fehlerart.mjs`
  6. `botstellungen.mjs` und `botstellungen_gross.mjs` (Bots in Menschen-Stellungen),
     `stellungen_auswerten.mjs`, `fingerabdruck.mjs`
  7. Maia-3 (nur Mess-Werkzeug, AGPL): `maia_stellungen.mts` + `maia_auswerten.mjs` (Menschlichkeit),
     `maia_zuege.mts` (Maia in Menschen-Stellungen), `maiaanker.mts` (Bot gegen Maia, Maia gegen Maia),
     `roh_auftrag.mjs`, `stellvertreter.mjs`
  8. `gegenprobe.mjs` (Tiefe 18, App-Engine, Lichess)
  9. `stellungen_auswerten.mjs --satz=beide` (Bots und Maia in Menschen-Stellungen, nach Ende von Kette L),
     danach `bots.mjs`, `stellvertreter.mjs`, `ergebnis_gegen_zugqualitaet.mjs`
  10. `tabellen.mjs` schreibt `ergebnisse/tabellen.md`, `zielwerte.mjs` schreibt `ergebnisse/zielwerte.json`
  Die Ketten `kette-*.sh` zeigen die tatsaechlich gelaufene Reihenfolge.
- `roh/` alle Analysen als JSON-Zeilen (je Stellung Bewertung, beste Zuege, Hauptvariante; je Zug Klasse,
  Verlust, Genauigkeit, Gewicht), `ergebnisse/` alle Kennzahlen als JSON plus `tabellen.md`,
  `logs/` Laufprotokolle, `logs/pid-bots.txt` die gemerkten Prozess-Nummern.

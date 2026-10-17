# Eichung der Bots und der Elo-Schätzung: Vorschlag

Stand: 17.10.2026, abends (nach dem Neustart fertiggestellt). Konstrukteur-Teil des Eichungs-Auftrags. Grundlage sind
die Daten des Daten-Scouts und der Messbericht (`../messung/BERICHT.md`). Im Repo `/home/user/schach` wurde nichts
verändert; alles liegt unter `/tmp/claude-0/-home-user/462c3180-85d9-520a-9c74-b32ac8320084/scratchpad/eichung/konstruktion/`.
Die Patches passen auf `main` = `455eb34` (mit W0+a).

## Für Flo: das Wichtigste in Kürze

**Dein Eindruck hat echte Ursachen, aber eine davon ist anders als gedacht.**

1. **Die eigene Elo wurde zu hoch geschätzt, aus zwei Gründen.**
   - Die alte Formel hat jede Partie stark zur Mitte (um 1100) gezogen. Schwächere Spieler wurden um 250 bis 400
     Punkte zu hoch geschätzt, starke um bis zu 650 zu niedrig.
   - Gegen die Bots spielt man genauer als gegen Menschen gleicher Stärke. Gemessen mit Maia (einer KI, die wie
     Menschen zieht, Wertung 1500): Gegen die Bots war Maia um 5,4 Genauigkeitspunkte genauer als gegen sich
     selbst. Die neue Schätzung ohne Korrektur hätte Maia deshalb gegen die Bots auf 1900 geschätzt, gegen sich
     selbst auf 1250. Diesen Bot-Aufschlag zieht die neue Schätzung jetzt ab (dann 1250).
2. **Die Bots haben nicht wie Menschen gefehlt.** Sie haben zu oft grob gepatzt (eine Figur eingestellt) und dafür zu
   selten kleine Fehler gemacht, dazu kamen Zufallszüge. Partien entscheiden aber gerade die groben Patzer: Wie oft
   ein Bot grob patzt, sagt sein Ergebnis gegen Maia viel besser voraus als seine durchschnittliche Zugqualität.
3. **Überraschung: Auf der Lichess-Skala waren die alten Bots ab Professor Turm nicht zu schwach, sondern zu stark.**
   In Partien gegen Maia spielten Turm, Delia und König wie 1720, 1760 und 2120 statt 1400, 1600 und 1800. Wenn sie
   sich trotzdem schwach anfühlten, liegt das wohl an der zu hohen eigenen Schätzung (man sucht sich Gegner auf der
   falschen Höhe) und an der Skala: Bei "1600" denken viele an chess.com oder den Verein, wo dieselbe Spielstärke
   eine niedrigere Zahl hat als auf Lichess.

**Was ich vorschlage:**

- **Eine klare Skala: "Arena-Elo" = Lichess-Schnellschach.** Nur dafür gibt es offene, echte Partien mit bekannter
  Wertung, an denen man eichen kann. Text für die App: *"Arena-Elo ist an echten Schnellschach-Partien von Lichess
  geeicht. Ein Bot mit 1200 spielt wie ein Lichess-Spieler mit etwa 1200. Andere Plattformen und Vereine zählen
  anders, bei Hobbyspielern liegen ihre Zahlen oft niedriger. Eine offizielle Umrechnung gibt es nicht."*
- **Entscheidung für dich:** Willst du, dass die Zahlen eher wie bei chess.com oder im Verein wirken, müssen alle Bots
  um einen festen Betrag stärker eingestellt werden (zum Beispiel "Lichess = Arena + 200"). Diesen Betrag kann ich
  nicht messen, es gibt dafür keine offenen Daten. Technisch ist es eine Zeile (Abschnitt 5g). Ohne deine
  Entscheidung bleibt es bei Lichess.
- **Die Bot-Namen und ihre Elo bleiben.** Jede Stufe ist jetzt so eingestellt, dass sie bei drei Maßen gleichzeitig
  zu Menschen ihrer Stärke passt: durchschnittlicher Verlust je Zug, Patzer und grobe Patzer. Es gibt keine
  Zufallszüge mehr; Fehler entstehen aus naheliegenden Zügen, deren Folgen der Bot nicht ganz durchschaut. Ausnahmen:
  Benno (250) liegt unter dem schwächsten Lichess-Spieler (eine Schätzung nach unten, keine Messung), Stockfisch
  (3000) ist eine Engine.
- **Ehrliche Schätzung der eigenen Stärke.**
  - "Spielte wie" (eine Partie) zeigt eine Zahl **und eine Spanne**, und ob die Partie besser oder schwächer als dein
    Schnitt war. Eine einzelne Partie verrät wenig, das sagt die App jetzt auch.
  - "Spielstärke" wird aus bis zu 20 Partien gerechnet und ist anfangs **"vorläufig"**.
  - Es zählen nur Züge in offenen Stellungen. Partien gegen Bots werden um den gemessenen Bot-Aufschlag gesenkt,
    Partien gegen viel schwächere Bots zählen weniger, Partien mit Zurücknahme oder Hinweis gar nicht.

**Wie gut ist das?** Stärke der Bots auf der Lichess-Skala. "Zugqualität": in 3035 echten Stellungen aus
Lichess-Partien, Mittel aus drei Maßen (Abschnitt 5a). "In Partien": aus Ergebnissen gegen Maia-3 (Abschnitt 5c);
jede Zahl dort ist allein wegen der kleinen Partienzahl auf etwa ±75 bis ±130 genau.

| Bot | Etikett | alte Bots: in Partien | neue Bots: Zugqualität (exakt) | neue Bots: in Partien (Partien) |
| --- | --- | --- | --- | --- |
| Oma Hilde | 500 | 124 | 525 | 175 (22) |
| Kalle | 800 | 559 | 799 | 754 (22) |
| Lisa Läufer | 1000 | 1115 | 999 | 853 (22) |
| Ritter Rudi | 1200 | 1270 | 1200 | 1307 (22) |
| Professor Turm | 1400 | 1720 | 1400 | 1408 (22) |
| Dame Delia | 1600 | 1756 | 1600 | 1491 (22) |
| Kommissar König | 1800 | 2118 | 1798 | 1711 (22) |
| Großmeisterin Greta | 2100 | 2102 | 2086 | 2064 (22) |

Hilde und Kalle spielten gegen Maia-600 und Maia-800, deren eigene Stärke sehr unsicher ist (±300); ihre Zahlen "in Partien" sind nur grob. Hildes Partien liefen noch mit einer Vorfassung (alle Züge als Kandidaten), siehe 5c.

Die neuen Bots treffen ihr Etikett in den Partien insgesamt fast (Abweichung über alle Stufen -64 [-126; -8] Elo, also
höchstens etwas zu schwach). Einzeln streuen sie noch: Lisa und Delia lagen in je 22 Partien etwa 100 bis 150 darunter,
Rudi etwa 100 darüber; das liegt bei so wenigen Partien noch im Rahmen des Zufalls (je etwa ±75 bis ±110), ist aber der
erste Punkt zum Nachmessen.

**Was offen bleibt:** Die Skalen-Entscheidung (oben). Eine echte Prüfung mit deinen eigenen Partien fehlt (die liegen
nur in deinem Browser). Unter Lichess 600 sind die Daten dünn. Die Bots ziehen menschlicher als vorher, aber immer
noch nicht ganz wie Menschen (Abschnitt 5e). Der Bot-Aufschlag ist mit Maia gemessen, nicht mit Menschen. Ob der
Bewertungsbalken während der Partie (in den Einstellungen standardmäßig an) die Schätzung hebt, ist ungemessen.

**Was zu tun ist:** Die drei Patches einspielen (Abschnitt 7), danach `node tests/sw.test.mjs --aktualisieren`. Die
Anzeige der Spanne und von "vorläufig" in der Oberfläche ist noch zu bauen (Vorschlag in Abschnitt 7).

---

## Technik

### 1. Daten, Skala und Vorgehen

- **Menschen:** Lichess-Schnellschach, Januar 2024 (CC0), Bänder 400 bis 2400 (Daten-Scout). Für die Zugwahl: 5388
  Trainings-Stellungen aus Partien, die **nicht** in den Prüfsätzen liegen. Für die Bot-Eichung: Satz "klein" (1100
  Stellungen aus den 330 Referenz-Partien) und Satz "groß" (1935 Stellungen aus anderen Partien), zusammen 3035.
- **Bewertung aller Züge:** natives Stockfish 18 (nur Werkzeug), Tiefe 10, MultiPV = alle Züge ("Zug-Tabellen").
  Verlust eines Zugs = Verlust an Gewinnchance in Prozentpunkten (Lichess-Formel, wie `review.js`).
- **Skala:** Lichess-Glicko-2 (Schnellschach). Nicht FIDE, nicht chess.com, nicht DWZ. Eine amtliche Umrechnung gibt
  es nicht, deshalb wird nicht umgerechnet.
- **Stärke eines Bots** (Weg A der Messung): Bot und Menschen ziehen in denselben Stellungen; je Band wird die
  Differenz Bot minus Mensch gebildet, die Nullstelle der Ausgleichsgeraden über die Band-Elo ist die gemessene
  Elo ("Kreuzung"). Neu: drei Maße statt einem, nämlich mittlerer Verlust (v), Patzer über 20 Punkte (p) und grobe
  Patzer über 40 Punkte (g).
- **Mensch-Ähnlichkeit und Gegner:** Maia-3 (5M, AGPL, nur Messwerkzeug). Volle Zugverteilung für die 1100
  Stellungen des Satzes klein; Partien gegen die Bots mit Zug aus der Verteilung (Temperatur 1).

### 2. Welches Maß sagt Partie-Ergebnisse voraus? (neu)

Die erste Fassung der neuen Bots (im Folgenden "Zwischenstand") traf ihr Etikett nach mittlerem Verlust, holte aber in
96 Partien gegen Maia-3 nur 35,5 statt der erwarteten 67,5 Punkte (Versatz -296 Elo). Auch die alten Bots lagen in
der Messung 173 Elo unter ihrer Zugqualität. Daraufhin habe ich für Bots **und** Maia alle drei Maße bestimmt (Maia
exakt aus seiner Zugverteilung) und geprüft, mit welchem Maß die erwarteten Punkte zu den tatsächlichen passen
(`py/vorhersage.py`, Versatz = so viel Elo fehlt den Bots gegenüber der Erwartung; 0 = perfekt):

| Bots (Partien gegen Maia) | Stufen | Partien | Punkte ist / erwartet nach g | Versatz nach mittlerem Verlust (v) | nach Patzern (p) | nach groben Patzern (g) |
| --- | --- | --- | --- | --- | --- | --- |
| alte Bots (main), Messung | 2 bis 9 | 96 | 58,5 / 60,2 | -193 [-258; -124] | -253 [-332; -170] | -17 [-91; +67] |
| alte Bots (main), Messung | 4 bis 9 | 72 | 49,5 / 52,9 | -168 [-254; -76] | -299 [-390; -204] | -44 [-125; +45] |
| Zwischenstand (E1) | 2 bis 9 | 96 | 35,5 / 35,1 | -267 [-331; -204] | -214 [-275; -154] | +3 [-58; +64] |
| Zwischenstand (E1) | 4 bis 9 | 72 | 24,0 / 22,6 | -237 [-318; -165] | -208 [-289; -137] | +16 [-64; +86] |
| neue Bots (E1b und E3) | 2 bis 9 | 176 | 75,5 / 87,1 | -146 [-204; -95] | -180 [-240; -126] | -64 [-126; -8] |
| neue Bots (E1b und E3) | 4 bis 9 | 132 | 58,0 / 63,1 | -134 [-198; -80] | -193 [-263; -136] | -34 [-102; +22] |

In Klammern 95-%-Intervalle (Bootstrap über die Partien; die Unsicherheit der Stärke-Maße selbst kommt dazu). Maias Stärke je Maß exakt aus seiner Zugverteilung (Satz klein): Maia-600 v 195, g 153; Maia-900 v 855, g 993; Maia-1200 v 1218, g 1359; Maia-1500 v 1439, g 1552; Maia-1800 v 1634, g 1702; Maia-2100 v 1821, g 1823 (dazwischen linear).

**Ergebnis:** Nur das Maß "grobe Patzer" sagt die Ergebnisse aller drei Bot-Generationen richtig voraus (Versatz
nahe 0). Der mittlere Verlust überschätzt Bots systematisch um 130 bis 270 Elo. Eine plausible Erklärung: Kleine
Verluste misst die Referenz-Engine (Tiefe 10) bei Bots, die selbst mit Stockfish rechnen, zu günstig, weil beide
dieselben Dinge übersehen; ein grober Patzer ist dagegen eindeutig. Maia ist im Verhältnis zu seinem mittleren
Verlust arm an groben Patzern (Maia-1500: v 1439, g 1552), Bots waren reich daran. Deshalb ist die Eichung jetzt so
gebaut, dass **alle drei Maße** das Etikett treffen; dann ist es gleich, welches Maß recht hat.

### 3. Das Bot-Modell

**Zugwahl (`menschenWahl` in `js/bots.js`)** für Stufe 1 bis 9:

1. Matt in 1 wie bisher (`mattInEins`, ab Stufe 4 immer gesehen).
2. Eine Engine-Suche mit Tiefe `tiefe` und MultiPV `breite` (Stufe 1 bis 6 alle Züge); mit Wahrscheinlichkeit
   `kurzChance` nur mit `kurzTiefe` (Aussetzer, übersehene Taktik).
3. **Kandidaten wie bei Menschen:** die `kandidaten` besten Züge der eigenen Suche (Benno alle, Hilde und Kalle 8,
   Lisa bis Turm 5, Delia bis Greta 3) plus die naheliegenden forcierenden Züge (Schlagen, Schach, angegriffene Figur
   wegziehen). **Neu: Züge außerhalb der MultiPV-Liste sind keine Kandidaten.** Vorher galten sie als "schlechtester
   bewerteter Zug + 5 Punkte"; als Schlag- oder Schachzug wurden sie dann oft gewählt, obwohl sie Material
   einstellten. Das war die Hauptquelle der groben Patzer von Delia, König und Greta (Diagnose
   `skripte/grob_diagnose.mjs`: 1,2 von 1,8, 0,8 von 1,7 und 1,0 von 1,1 groben Patzern je 100 Züge).
4. Jeder Kandidat bekommt einen Reiz `u = -sorgfalt · phasenFaktor · ((v + 1)^biss - 1) + natur(Zug) + stil`,
   v = Verlust an Gewinnchance laut eigener Suche. Gezogen wird mit Wahrscheinlichkeit proportional zu `exp(u)`
   (Gumbel-Trick mit der Zufallsquelle des Bots, also reproduzierbar).
5. `natur` = 22 Merkmale ("wie naheliegend ist der Zug für Menschen dieser Wertung"), bedingtes Logit-Modell,
   gefittet an 5388 echten Zügen (`py/fit_zugwahl.py`; Log-Likelihood je Zug im Prüfsatz -2,058, Training -2,069,
   ohne Natur-Merkmale -2,345; Maia-3 erreicht -1,45).
6. `stil` = Vorlieben des Charakters, nur für Züge, die höchstens 3 Prozentpunkte kosten.

**Neu je Bot geeicht:** `sorgfalt`, `biss` (Form der Strafkurve: groß = grobe Patzer werden viel stärker bestraft als
kleine Fehler) und `kandidaten`. Muster der Eichung: Schwache Stufen betrachten mehr Züge und haben eine steilere
Strafkurve bei sehr kleiner Sorgfalt (viele kleine und mittlere Fehler, verhältnismäßig wenige grobe), starke Stufen
betrachten wenige Züge.

### 4. Eichung

- **Exakter Auswerter** (`skripte/gitter.mjs`): Die Bot-Suchen sind je Stellung und Einstellung einmal gerechnet
  (`skripte/suchen.mjs`, App-Stockfish, `roh/suchen-klein.jsonl`, `roh/suchen-gross.jsonl`). Für jede Kombination aus
  sorgfalt, biss und Kandidaten rechnet der Auswerter die **volle Zugverteilung** je Stellung (keine Ziehung, kein
  Zufall) und daraus die drei Kreuzungs-Elo auf allen 3035 Stellungen. Das beseitigt die Schwankung von ±100 bis 150
  Punkten, die eine einzelne gezogene Simulation hat.
- **Gitter:** je Bot biss 0,25 bis 1,2 und Kandidaten 3, 5, 8 oder alle; sorgfalt jeweils so gewählt (Goldener
  Schnitt), dass die drei Elo zusammen möglichst nah am Etikett liegen. Gewählt wurde je Bot die Kombination mit dem
  kleinsten Abstand (`ergebnisse/gitter-r7.json`), bei Hilde mit der Nebenbedingung, dass höchstens etwa 16 % ihrer
  Züge für Maia "selten" sind (`ergebnisse/gitter-r8.json`; mit allen Zügen als Kandidaten wären es 24 %).
- **Aussetzer** (kurzChance) halbieren änderte bei neu geeichter sorgfalt kaum etwas (±5 Elo); sie bleiben.

| Stufe | Bot | Elo | Tiefe | Aussetzer (Tiefe, Anteil) | MultiPV | Kandidaten | biss | sorgfalt | eloJeLn | Phasen-Faktor Eröffnung / Endspiel | Vorlieben (cp) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Bauer Benno | 250 | 1 | 1, 0 % | alle | alle | 0,25 | 0,109 | - | 1,452 / 5,366 | schlagen 90 |
| 2 | Oma Hilde | 500 | 1 | 1, 0 % | alle | 8 | 1,0 | 0,0145 | 466 | 1,243 / 2,172 | schlagen 60 |
| 3 | Kalle | 800 | 2 | 1, 30 % | alle | 8 | 1,0 | 0,0165 | 430 | 1,196 / 1,46 | schach 80, vorwärts 30, dame 20, schlagen 25 |
| 4 | Lisa Läufer | 1000 | 3 | 1, 25 % | alle | 5 | 0,6 | 0,1515 | 702 | 1,182 / 1,256 | läufer 60 |
| 5 | Ritter Rudi | 1200 | 4 | 2, 25 % | alle | 5 | 0,4 | 0,4574 | 781 | 1,174 / 1,129 | springer 55, gabel 80 |
| 6 | Professor Turm | 1400 | 5 | 2, 10 % | alle | 5 | 0,25 | 1,3065 | 868 | 1,168 / 1,041 | rochade 50, turm 15, ruhig 10 |
| 7 | Dame Delia | 1600 | 6 | 3, 10 % | 20 | 3 | 0,25 | 0,7312 | 389 | 1,164 / 0,977 | schach 45, opfer 40 |
| 8 | Kommissar König | 1800 | 7 | 3, 8 % | 16 | 3 | 0,4 | 0,4789 | 434 | 1,161 / 0,928 | königEndspiel 15 |
| 9 | Großmeisterin Greta | 2100 | 8 | 4, 5 % | 12 | 3 | 1,0 | 0,0718 | 315 | 1,157 / 0,874 | - (maxZeit 2500) |

Tiefe, Aussetzer, MultiPV, Phasen-Faktoren und Vorlieben sind unverändert gegenüber dem Zwischenstand. `eloJeLn` =
lokale Steigung der Eichkurve (so viele Elo bringt ein Faktor e auf sorgfalt, gemessen für die Faktoren 0,7 bis 1,4;
`ergebnisse/steigung.json`), gebraucht von `staerkeFuerElo`.

### 5. Ergebnisse der Bots

**(a) Exakt, 3035 Menschen-Stellungen** (Kreuzungs-Elo je Maß; "selten" = Anteil der Züge, denen Maia-3 bei der
Wertung nahe dem Etikett weniger als 1 % gibt, Satz klein; echte Menschen 3,1 %):

| Bot | Ziel | Verlust (v) | Patzer (p) | grobe Patzer (g) | Mittel | selten (Maia) | Zwischenstand v / p / g | Zwischenstand selten | alte Bots v / p / g (gezogen) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Bauer Benno | 250 | -88 | 1 | -941 | -342 | 27,4 % | -88 / 1 / -941 | 27,4 % | -388 / -253 / -939 |
| Oma Hilde | 500 | 566 | 588 | 421 | 525 | 15,6 % | 555 / 562 / 151 | 12,5 % | 414 / 402 / -386 |
| Kalle | 800 | 803 | 800 | 796 | 799 | 18,9 % | 930 / 878 / 746 | 14,7 % | 737 / 708 / 756 |
| Lisa Läufer | 1000 | 993 | 999 | 1006 | 999 | 17,1 % | 1025 / 990 / 877 | 15,2 % | 1089 / 1234 / 1084 |
| Ritter Rudi | 1200 | 1199 | 1199 | 1201 | 1200 | 17,5 % | 1246 / 1199 / 1147 | 15,6 % | 1395 / 1437 / 1530 |
| Professor Turm | 1400 | 1410 | 1394 | 1396 | 1400 | 17,6 % | 1397 / 1339 / 1315 | 16,3 % | 1660 / 1737 / 1737 |
| Dame Delia | 1600 | 1594 | 1599 | 1608 | 1600 | 14,5 % | 1590 / 1510 / 1456 | 14,6 % | 1879 / 2082 / 1794 |
| Kommissar König | 1800 | 1789 | 1820 | 1787 | 1798 | 14,3 % | 1844 / 1764 / 1649 | 13,5 % | 2151 / 2245 / 1986 |
| Großmeisterin Greta | 2100 | 2066 | 2156 | 2035 | 2086 | 13,4 % | 2076 / 1957 / 1792 | 12,5 % | 2317 / 2331 / 2096 |

Benno liegt wie gewollt unter dem schwächsten Lichess-Band (dort ist die Kreuzung eine Extrapolation). Bei Hilde verfehlen die groben Patzer das Etikett (Abwägung gegen seltene Züge, Abschnitt 4).

**(b) Gegenprobe mit der echten `botZug`-Funktion** (App-Stockfish WASM unter Node, Live-Suche, ein gezogener Lauf
je Bot auf allen 3035 Stellungen; 95-%-Intervall per Bootstrap über Partien):

| Bot | Ziel | Verlust (v) [95 %] | Patzer (p) [95 %] | grobe Patzer (g) [95 %] |
| --- | --- | --- | --- | --- |
| Oma Hilde (Endwerte) | 500 | 464 [166; 701] | 519 [34; 776] | 275 [-1616; 801] |
| Kalle | 800 | 867 [624; 1004] | 885 [608; 1049] | 879 [288; 1181] |
| Lisa Läufer | 1000 | 729 [334; 935] | 655 [-86; 949] | 793 [-411; 1188] |
| Ritter Rudi | 1200 | 1201 [1010; 1343] | 1226 [1037; 1352] | 1088 [587; 1360] |
| Professor Turm | 1400 | 1458 [1341; 1556] | 1454 [1289; 1580] | 1444 [1191; 1610] |
| Dame Delia | 1600 | 1629 [1506; 1731] | 1607 [1421; 1784] | 1690 [1504; 1882] |
| Kommissar König | 1800 | 1804 [1684; 1938] | 1833 [1658; 2029] | 1785 [1569; 1973] |
| Großmeisterin Greta | 2100 | 2073 [1942; 2243] | 2184 [2000; 2446] | 2018 [1845; 2295] |

Die Live-Suchen stimmen mit den vorab gerechneten überein: Die mittlere Log-Wahrscheinlichkeit der gezogenen Züge
unter der exakten Verteilung ist so groß wie erwartet (Lisa -1,58 gegen -1,56, Kalle -1,70 gegen -1,69, Rudi -1,53
gegen -1,52, Turm -1,47 gegen -1,48; `skripte/sim_gegen_exakt.mjs`). Abweichungen eines gezogenen Laufs vom exakten
Wert sind also Ziehungs-Zufall (Standardfehler des mittleren Verlusts etwa 0,17 Punkte; im flachen Teil der
Menschenkurve um 1000 werden daraus leicht ±150 Elo, so bei Lisa: gezogen 6,74, exakt 6,32).

**(c) Partien gegen Maia-3** (Bot gegen Maia mit der Wertung seines Etiketts, Farben abwechselnd: alte Bots 12
Partien aus der Messung, Zwischenstand 12 Partien (E1), neue Bots 16 Partien (E1b) plus 6 gegen Maia-1500 aus E3.
Ergebnis-Elo = die Bot-Stärke, bei der die erwarteten Punkte gegen Maias Stärke nach dem Maß "grobe Patzer" den
erzielten entsprechen; in Klammern der Standardfehler allein aus der Zahl der Partien, dazu kommt die Unsicherheit
von Maias eigener Stärke):

| Bot | Etikett | gegen Maia | alte Bots: Punkte, Ergebnis-Elo | Zwischenstand: Punkte, Ergebnis-Elo | neue Bots: Punkte, Ergebnis-Elo |
| --- | --- | --- | --- | --- | --- |
| Oma Hilde | 500 | 600/1500 | 5,5/12, 124 (±101) | 6,5/12, 182 (±101) | 8,5/22, 175 (±76) |
| Kalle | 800 | 800/1500 | 3,5/12, 559 (±110) | 5,0/12, 655 (±102) | 9,0/22, 754 (±75) |
| Lisa Läufer | 1000 | 1000/1500 | 6,0/12, 1115 (±100) | 4,5/12, 1026 (±104) | 3,0/22, 853 (±108) |
| Ritter Rudi | 1200 | 1200/1500 | 4,5/12, 1270 (±104) | 4,0/12, 1238 (±106) | 8,0/22, 1307 (±77) |
| Professor Turm | 1400 | 1400/1500 | 9,5/12, 1720 (±123) | 3,5/12, 1334 (±110) | 8,0/22, 1408 (±77) |
| Dame Delia | 1600 | 1500/1600 | 8,5/12, 1756 (±110) | 2,0/12, 1323 (±135) | 8,0/22, 1491 (±77) |
| Kommissar König | 1800 | 1500/1800 | 11,0/12, 2118 (±181) | 3,0/12, 1511 (±116) | 12,5/22, 1711 (±75) |
| Großmeisterin Greta | 2100 | 1500/2100 | 10,0/12, 2102 (±135) | 7,0/12, 1881 (±102) | 18,5/22, 2064 (±101) |

Insgesamt (`py/vorhersage.py`, Stufen 2 bis 9): alte Bots -17 [-91; +67], Zwischenstand +3 [-58; +64], neue Bots -64 [-126; -8]
(Versatz zur Erwartung nach groben Patzern).
Hildes neue Partien liefen noch mit einer Vorfassung (alle Züge als Kandidaten, biss 0,8); ihre Endwerte (8 Kandidaten, biss 1,0) sind nur in Menschen-Stellungen geprüft (5a, 5b). Am deutlichsten unter der Erwartung liegt Lisa (3,0 aus 22, Ergebnis-Elo 853, etwa 1,5 Standardfehler); sollte sich das in weiteren Partien bestätigen, ihre sorgfalt um den Faktor 1,2 anheben (etwa +130 Elo nach ihrer Eichkurve). Benno verlor alle 6 Partien gegen Maia-1500 (erwartet, ohne Aussage über seine Stärke).

**(d) Fehlerbild nach Phase** (Patzer über 20 Punkte je 100 Züge in den 3035 Stellungen, gezogener Lauf aus (b);
Bot | Menschen in genau diesen Stellungen):

| Bot | Eröffnung | Mittelspiel | Endspiel |
| --- | --- | --- | --- |
| Oma Hilde | 12,2 \| 5,8 | 15,3 \| 5,9 | 9,5 \| 4,5 |
| Kalle | 7,9 \| 5,8 | 12,9 \| 5,9 | 8,6 \| 4,5 |
| Lisa Läufer | 9,1 \| 5,8 | 12,9 \| 5,9 | 7,0 \| 4,5 |
| Ritter Rudi | 6,3 \| 5,8 | 9,3 \| 5,9 | 6,5 \| 4,5 |
| Professor Turm | 5,0 \| 5,8 | 7,4 \| 5,9 | 4,2 \| 4,5 |
| Dame Delia | 3,3 \| 5,8 | 6,1 \| 5,9 | 4,5 \| 4,5 |
| Kommissar König | 2,8 \| 5,8 | 4,1 \| 5,9 | 3,8 \| 4,5 |
| Großmeisterin Greta | 1,0 \| 5,8 | 2,7 \| 5,9 | 2,1 \| 4,5 |

Die Spalte "Menschen" mischt alle Bänder (dieselben 3035 Stellungen); der Vergleich zeigt das Muster, nicht die Stärke: Die schwachen Bots patzen wie schwache Menschen in jeder Phase, die starken wie Menschen eher im Mittelspiel und kaum in der Eröffnung. Im Endspiel patzen die neuen Bots nicht mehr fast nie (alte Bots 0,5 bis 2,0 je 100).

**(e) Wie menschlich?** Anteil "seltener" Züge nach Maia (siehe (a)): alte Bots 14 bis 38 %, Zwischenstand 12 bis
28 %, neue Bots 13 bis 19 % (Benno 27 %), echte Menschen 3 %. Die neuen Bots ziehen also klar menschlicher als die alten, aber
noch nicht wie Menschen. Ein Modell aus 22 Merkmalen kennt menschliche Zugwahl nur grob; auch ein Bot, der immer den
besten Engine-Zug spielt, hätte nach Maia 6 bis 10 % seltene Züge.

**(f) Suchzeit je Bot-Zug** (Engine plus Zugwahl, App-Stockfish WASM unter Node auf einer voll ausgelasteten
Server-CPU, Mittel über 3035 Stellungen, ohne Denkpause):

| Bot | main (ms) | neu (ms) | Faktor |
| --- | --- | --- | --- |
| Oma Hilde | 4,7 | 10,1 | 2,1 |
| Kalle | 6,6 | 11,4 | 1,7 |
| Lisa Läufer | 6,7 | 15,1 | 2,3 |
| Ritter Rudi | 9,9 | 19,2 | 1,9 |
| Professor Turm | 13,2 | 27,7 | 2,1 |
| Dame Delia | 20,1 | 30,9 | 1,5 |
| Kommissar König | 34,1 | 44,1 | 1,3 |
| Großmeisterin Greta | 27,4 | 64,9 | 2,4 |

"main" wurde früher auf einer weniger belasteten CPU gemessen; die Faktoren sind deshalb eher zu hoch.

Die Last steigt gegenüber main um den Faktor 1,3 bis 2,4, absolut auf höchstens etwa 65 ms (Greta). Gründe: eine
Stufe tiefere Suche ab Lisa, MultiPV über alle Züge bis Turm, die Merkmale in JavaScript. Die Bots warten danach
ohnehin eine menschliche Denkpause von 400 bis 1500 ms ab; auf dem iPad ist das nicht gemessen. Selbst eine drei- bis
fünffache Verlangsamung bliebe unter der Denkpause.

**(g) `staerkeFuerElo(elo)`** (Boss "etwa deine Wertung"): Zwischen 500 und 2100 das Profil des näheren Leiter-Bots,
nur `sorgfalt` entlang seiner gemessenen Eichkurve verschoben (`sorgfalt · exp((elo - botElo) / eloJeLn)`); außerhalb
der nächstliegende Leiter-Bot (wie main). Rückgabe `elo` = Anfrage auf 50 gerundet. Ein erster Versuch, zusätzlich die
Natur-Gewichte der Ziel-Elo zu nehmen und die Vorlieben wegzulassen, spielte messbar schwächer (Anfrage 650: etwa
405, 900: etwa 570, 1500: etwa 1440; `ergebnisse/gitter-sfe.json`); deshalb bleibt das Profil sonst unverändert.
**Skalen-Versatz (Option B, nicht im Patch):** Soll "Arena-Elo" niedriger als Lichess sein, genügt es, in `BOTS`
jedes `staerke` einmalig durch `staerkeFuerElo(elo + X).staerke` zu ersetzen (bis etwa X = 300 innerhalb der
gemessenen Kurven) und bei der Spielstärke X abzuziehen. X ist nicht messbar und müsste als Annahme in der App stehen.

### 6. Die neue Schätzung

**Beleg einer Partie** (`staerkeBeleg` in `js/review.js`): die mittlere Zuggenauigkeit (Lichess-Formel) über die
**offenen** Züge der Seite (ohne Buch- und erzwungene Züge, Gewinnchance vor dem Zug zwischen 10 und 90 %) und deren
Anzahl. Diese Größe trennt die Spielstärken besser als die Partie-Genauigkeit (Korrelation mit der Wertung 0,56 gegen
0,44 auf den Lichess-Seiten, 0,67 gegen 0,50 an den 330 Partien der App-Engine) und zählt entschiedene Stellungen nicht
mit. Patzer-, Fehler- und Ungenau-Quote brachten in der Kreuzvalidierung nichts dazu.

**Modell** (`STAERKE_MODELL`): Bei Wertung R ist der Beleg im Mittel mu(R) (11 Stützpunkte = Bandmittel) mit Streuung
`exp(6,5 - 0,9 · (R - 1500) / 1000) / n + 6`, gefittet an allen 5594 Lichess-Seiten (`py/staerke_fit.py`). Eine Partie
liefert eine Likelihood über R (Gitter 0 bis 3200); die Streuung wird bei der zuletzt geschätzten Stärke festgehalten.

- **Spielstärke** (`spielstaerkeAusPartien`): Produkt der Likelihoods der letzten 20 wertenden Partien, sehr schwaches
  Vorwissen N(1300, 1000), Partien mit Hinweis oder Zurücknahme zählen nicht, Partien gegen Gegner mehr als 300 Punkte
  unter der eigenen Stärke weniger (linear bis 0,25 ab 900). Ergebnis: Median, 80-%-Spanne (mit 130 Punkten Modell-
  und Skalenunsicherheit), "vorläufig" bei weniger als 5 Partien oder Streuung über 250.
- **Spielte wie** (`spielteWie`): dieselbe Likelihood für eine Partie, mit der bisherigen Spielstärke als Vorwissen
  (plus 350 Punkte Tagesform); dazu `tendenz` (besser, wie immer, schwächer). Ohne frühere Partien: N(1300, 700),
  "vorläufig".
- **Neu: Bot-Aufschlag** (`STAERKE_MODELL.botAufschlag` = 5,4 Punkte, Standardfehler `botAufschlagSd` = 1,6,
  Kennung `gegenBot`): Der Beleg einer Partie gegen einen App-Bot wird um diesen Betrag gesenkt. In der App gilt das
  für jede wertende Partie
  (`storage.spielstaerkeDetail`) und für "Spielte wie" (in `analysierePartie`, wenn die Elo des Bot-Gegners bekannt
  ist). Seine Unsicherheit verbreitert die Spanne der Spielstärke (bei 1500 um etwa ±200 Elo), ändert aber nicht,
  ab wann sie "vorläufig" ist. Die Lichess-Prüfungen unten betrifft das nicht (Menschen gegen Menschen).

**Gegner-Effekt (Messung E2 und E3).** Dieselbe Maia-3 (Wertung 1500) spielt 6 Partien gegen jede Stufe. E2 mit dem
Zwischenstand der Bots, E3 mit den neuen Bots. Vergleich: 24 Partien von Maia-1500 gegen sich selbst (6 aus E2/E3, 10
neue mit anderen Zufallssaaten, 8 aus der Messung). Alle Partien mit der App-Engine analysiert wie in der App
(Stockfish 19 lite, Tiefe 14, MultiPV 2); zur Kontrolle E3 auch mit nativem Stockfish 18 (Tiefe 14, 14 Selbst-Partien):
Aufschlag 6,2 [1,9; 9,8]. Beleg = offene Genauigkeit von Maia, nach Zügen gewichtet:

E3 (neue Bots):

| Gegner | Partien | Punkte Maia | Beleg | Differenz zu "selbst" | alt: Mittel "Spielte wie" | neu ohne Aufschlag [80 %] | neu mit Aufschlag [80 %] |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Bauer Benno | 6 | 6,0 | 84,8 | 2,8 | 1700 | 1600 [800; 2550] | 1350 [600; 2300] |
| Oma Hilde | 6 | 6,0 | 82,6 | 0,6 | 1525 | 1450 [800; 2350] | 1000 [650; 1650] |
| Kalle | 6 | 6,0 | 91,8 | 9,8 | 2142 | 2100 [1300; 2850] | 1700 [950; 2600] |
| Lisa Läufer | 6 | 5,5 | 88,0 | 6,0 | 1658 | 1850 [1100; 2750] | 1400 [900; 2050] |
| Ritter Rudi | 6 | 5,0 | 90,4 | 8,3 | 1617 | 2100 [1450; 2800] | 1600 [1100; 2100] |
| Professor Turm | 6 | 4,0 | 90,1 | 8,1 | 1658 | 2150 [1500; 2800] | 1600 [1100; 2150] |
| Dame Delia | 6 | 5,0 | 87,7 | 5,7 | 1733 | 1950 [1350; 2500] | 1400 [900; 2050] |
| Kommissar König | 6 | 3,0 | 85,8 | 3,8 | 1442 | 1650 [1150; 2200] | 1150 [800; 1650] |
| Großmeisterin Greta | 6 | 0,0 | 84,5 | 2,5 | 1583 | 1550 [1100; 2100] | 1050 [750; 1450] |
| Maia-1500 selbst | 24 | 11,0 | 82,0 | 0,0 | 1206 | 1250 [1050; 1550] | 1250 [1050; 1550] |

Alle Bot-Partien zusammen (wie ein Spieler, der gegen alle Stufen spielt): ohne Aufschlag 1900 [1450; 2300], mit Aufschlag 1250 [1000; 1600]; gegen sich selbst 1250. Gemessener Aufschlag: 5,41 Punkte, 95 % [1,95; 8,35] (Bootstrap über Partien). E2 mit dem Zwischenstand ergab gegen dieselben 24 Selbst-Partien 5,12 [1,90; 7,99]; dort: alle Bot-Partien ohne Aufschlag 1850, mit 1200, gegen sich selbst 1250.

Der Effekt hängt nicht klar von der Stärke des Bots ab (auch gegen stärkere Bots war Maia genauer als gegen sich
selbst) und verschwindet nicht, wenn man Züge direkt nach einem Fehler des Gegners weglässt (geprüft mit Schwellen 3,
5 und 10 Punkte). Gegen die Bots entstehen offenbar insgesamt leichtere Stellungen als gegen Menschen. Ein fester
Aufschlag ist die einfachste ehrliche Korrektur; er ist mit Maia gemessen, nicht mit Menschen, und nur bei 1500.

**Prüfung des Modells an Menschen** (unverändert gültig, weil der Aufschlag Partien zwischen Menschen nicht betrifft;
`skripte/eval_staerke.mjs` mit genau dem Patch-Code): (a) 5-fache Kreuzvalidierung über die Lichess-Seiten ohne die
330 Referenz-Partien (Faltung nach Partie), (b) extern an den 330 Partien, die mit der App-Engine bewertet sind (Modell
ohne diese Partien gefittet). Spielstärke aus N Partien = N zufällige Seiten desselben Bandes, 300 Ziehungen.

Kurz: **Die alte Schätzung ist in jedem Band verzerrt** (Band 400 um etwa +400, Band 2400 um etwa -650), und das
Mittel der letzten 10 Partien behält diese Verzerrung. **Die neue Spielstärke aus 10 Partien liegt in allen Bändern im
Mittel innerhalb von etwa ±110 Punkten** (Kreuzvalidierung), aus 20 Partien innerhalb von ±60. Dafür streut sie mehr
als die alte (die alte war "ruhig, aber falsch"). Die 80-%-Spanne trifft in 78 bis 92 % der Fälle. Eine einzelne
Partie ohne Vorgeschichte bleibt wenig aussagekräftig; mit 10 früheren Partien als Vorwissen ist "Spielte wie" im
Mittel auf ±125 Punkte genau. Extern (nur 30 Partien je Band): aus 10 Partien in 10 von 11 Bändern im Mittel innerhalb
von ±150 (Ausnahme Band 400 mit -273); die alte lag in 7 von 11 Bändern um mehr als 150 daneben.

#### Eine Partie ("Spielte wie"), Kreuzvalidierung (Lichess-Seiten, 5-fach)

| Band | Seiten | alt: Verzerrung | alt: Streuung | alt: innerhalb ±200 | neu ohne Vorgeschichte: Verzerrung | neu ohne: ±200 | neu mit 10 früheren Partien: Verzerrung | neu mit: Streuung | neu mit: ±200 | neu mit: 80-%-Spanne trifft |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 400 | 64 | +418 | 490 | 39 % | +535 | 6 % | +122 | 202 | 72 % | 91 % |
| 600 | 416 | +273 | 481 | 37 % | +406 | 25 % | +43 | 233 | 63 % | 93 % |
| 800 | 540 | +144 | 459 | 38 % | +277 | 39 % | +5 | 236 | 59 % | 95 % |
| 1000 | 540 | +13 | 414 | 40 % | +202 | 42 % | +104 | 255 | 48 % | 91 % |
| 1200 | 540 | -41 | 432 | 37 % | +107 | 41 % | +124 | 287 | 46 % | 88 % |
| 1400 | 540 | -182 | 407 | 34 % | -22 | 47 % | +69 | 230 | 61 % | 96 % |
| 1600 | 540 | -273 | 389 | 32 % | -132 | 44 % | +30 | 247 | 58 % | 95 % |
| 1800 | 540 | -417 | 384 | 24 % | -276 | 33 % | -42 | 242 | 58 % | 95 % |
| 2000 | 540 | -480 | 389 | 18 % | -368 | 25 % | -38 | 233 | 62 % | 94 % |
| 2200 | 538 | -565 | 420 | 19 % | -450 | 18 % | -26 | 225 | 62 % | 94 % |
| 2400 | 140 | -648 | 455 | 16 % | -523 | 18 % | -39 | 221 | 61 % | 91 % |

#### Spielstärke aus mehreren Partien, Kreuzvalidierung (Lichess-Seiten, 5-fach)

| Band | alt (Mittel der letzten 10): Verzerrung | alt: Streuung | alt: ±200 | neu, 10 Partien: Verzerrung | neu 10: Streuung | neu 10: ±200 | neu 10: 80-%-Spanne trifft | neu 10: "vorläufig" | neu, 20 Partien: Verzerrung | neu 20: ±200 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 400 | +421 | 146 | 7 % | +68 | 169 | 77 % | 90 % | 68 % | +46 | 81 % |
| 600 | +272 | 161 | 33 % | -5 | 216 | 66 % | 89 % | 66 % | -26 | 74 % |
| 800 | +150 | 143 | 64 % | -39 | 237 | 57 % | 82 % | 78 % | -39 | 75 % |
| 1000 | +6 | 126 | 88 % | +79 | 206 | 65 % | 81 % | 75 % | +58 | 81 % |
| 1200 | -26 | 128 | 87 % | +111 | 237 | 57 % | 78 % | 83 % | +60 | 70 % |
| 1400 | -176 | 128 | 56 % | +62 | 197 | 68 % | 92 % | 92 % | +23 | 79 % |
| 1600 | -266 | 123 | 27 % | +23 | 211 | 63 % | 91 % | 80 % | +10 | 76 % |
| 1800 | -424 | 125 | 4 % | -84 | 204 | 60 % | 89 % | 64 % | -48 | 81 % |
| 2000 | -474 | 142 | 3 % | -37 | 212 | 61 % | 85 % | 32 % | -28 | 84 % |
| 2200 | -574 | 135 | 0 % | -47 | 178 | 73 % | 89 % | 10 % | -4 | 89 % |
| 2400 | -648 | 146 | 0 % | -48 | 159 | 76 % | 87 % | 0 % | -17 | 92 % |

#### Eine Partie ("Spielte wie"), Extern (330 Partien, App-Engine)

| Band | Seiten | alt: Verzerrung | alt: Streuung | alt: innerhalb ±200 | neu ohne Vorgeschichte: Verzerrung | neu ohne: ±200 | neu mit 10 früheren Partien: Verzerrung | neu mit: Streuung | neu mit: ±200 | neu mit: 80-%-Spanne trifft |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 400 | 52 | +370 | 474 | 37 % | +434 | 25 % | -177 | 110 | 50 % | 96 % |
| 600 | 60 | +250 | 552 | 38 % | +389 | 35 % | -68 | 170 | 72 % | 98 % |
| 800 | 60 | +81 | 390 | 43 % | +248 | 52 % | -7 | 223 | 62 % | 95 % |
| 1000 | 60 | +46 | 413 | 47 % | +159 | 35 % | -26 | 211 | 58 % | 100 % |
| 1200 | 60 | -61 | 368 | 45 % | +88 | 45 % | +59 | 212 | 63 % | 97 % |
| 1400 | 60 | -154 | 456 | 37 % | -101 | 47 % | -113 | 214 | 62 % | 97 % |
| 1600 | 60 | -247 | 321 | 33 % | -148 | 40 % | +64 | 243 | 68 % | 92 % |
| 1800 | 60 | -441 | 358 | 22 % | -315 | 33 % | -172 | 193 | 57 % | 93 % |
| 2000 | 60 | -486 | 437 | 15 % | -298 | 17 % | +113 | 247 | 50 % | 83 % |
| 2200 | 60 | -597 | 330 | 15 % | -437 | 20 % | -2 | 160 | 77 % | 100 % |
| 2400 | 60 | -680 | 424 | 17 % | -518 | 20 % | -31 | 213 | 68 % | 95 % |

#### Spielstärke aus mehreren Partien, Extern (330 Partien, App-Engine)

| Band | alt (Mittel der letzten 10): Verzerrung | alt: Streuung | alt: ±200 | neu, 10 Partien: Verzerrung | neu 10: Streuung | neu 10: ±200 | neu 10: 80-%-Spanne trifft | neu 10: "vorläufig" | neu, 20 Partien: Verzerrung | neu 20: ±200 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 400 | +368 | 159 | 15 % | -273 | 130 | 21 % | 79 % | 53 % | -368 | 6 % |
| 600 | +273 | 186 | 36 % | -69 | 243 | 53 % | 89 % | 98 % | -139 | 61 % |
| 800 | +79 | 128 | 82 % | -11 | 215 | 66 % | 84 % | 74 % | -41 | 82 % |
| 1000 | +45 | 132 | 87 % | -51 | 211 | 63 % | 87 % | 82 % | -69 | 78 % |
| 1200 | -64 | 116 | 86 % | +26 | 173 | 77 % | 96 % | 82 % | +25 | 86 % |
| 1400 | -150 | 146 | 60 % | -146 | 204 | 54 % | 84 % | 86 % | -179 | 52 % |
| 1600 | -234 | 100 | 37 % | +28 | 192 | 70 % | 95 % | 99 % | +28 | 82 % |
| 1800 | -436 | 120 | 2 % | -144 | 191 | 58 % | 86 % | 35 % | -165 | 60 % |
| 2000 | -477 | 135 | 2 % | +98 | 195 | 60 % | 77 % | 6 % | +105 | 74 % |
| 2200 | -595 | 110 | 0 % | -27 | 146 | 84 % | 94 % | 1 % | +4 | 96 % |
| 2400 | -676 | 134 | 0 % | -38 | 173 | 76 % | 86 % | 1 % | -5 | 92 % |

### 7. Patches, Anbindung und Tests

Drei Patches gegen `main` = `455eb34` (frischer Abzug per `git archive`, Konflikte mit W0+a per 3-Wege-Zusammenführung
gelöst, Arbeitsbaum `rebase/`), geprüft mit `git apply --check` auf einem sauberen Abzug und danach mit den Tests:

| Suite | Ergebnis | Hinweis |
| --- | --- | --- |
| `storage` | 195/195 | Node |
| `review --nur-node` | 296/296 | Node; Browser-Teil (Port 8932): 317/317 |
| `spiel` | 92/92 | Node; drei Erwartungen an `staerkeFuerElo` angepasst |
| `bots-mensch` (neu) | 30/30 | Node, ohne Engine |
| `fairness`, `ereignisse` | 31/31, 123/123 | Node, unverändert |
| `sw` | 32/33, nach `--aktualisieren` 33/33 | erwarteter Punkt: STAND des Service Workers |
| `engine-bots --schnell` | 60/60 | Chromium mit App-Stockfish, Port 8931; Greta im Mittel 51 ms Suchzeit je Zug |
| `app --schnell` | 385/385 | Chromium, Port 8933; eine W0+a-Erwartung an den Boss-Kopf angepasst ("≈ 1100" statt "≈ 1000") |

Geprüft auf einem frischen Abzug von `main` (`git archive`, 57a159b = 455eb34 plus eine Markdown-Datei); die Patches
passen auch auf 455eb34 selbst und ergeben dort dieselben Dateien. Nicht gelaufen: `screens`, `e2e`, `board` (vom Patch
nicht berührt) und der lange Stärke-Teil von `engine-bots` (ohne `--schnell`). Die Prüfung "freie Dame" im
Browser-Test war mit den neuen Bots wackelig (Grenzen zu nah an den Wahrscheinlichkeiten); sie ruft jetzt `botZug`
mit dem vorigen Zug auf wie die App, die Grenzen halten mit 20 Proben in mehr als 99 % der Läufe.

| Datei | Inhalt |
| --- | --- |
| `eichung.patch` | **Kern.** `js/bots.js`: menschliche Zugwahl (`menschenWahl`, `menschenReize`, `naturMerkmale`, `NATUR`, `phaseVon`, `verlusteAusAnalyse`), nicht bewertete Züge keine Kandidaten, neue Profile der Stufen 1 bis 9 (mit `eloJeLn`), `botZug(..., { vorigerZug })` zusätzlich zu `nodes` und `vorliebe` aus W0+a (beide gelten auch für die menschliche Zugwahl), geeichte `staerkeFuerElo` (ersetzt die vorläufige aus W0+a, wie dort vorgesehen; `eloDerPartie` nutzt sie unverändert). Profile ohne `staerke.mensch` (Gäste) spielen wie bisher. `js/review.js`: `STAERKE_MODELL` (mit `botAufschlag`), `staerkeBeleg`, `staerkeMittel`, `staerkeStreuung`, `staerkeLikelihood`, `gegnerGewicht`, `spielteWie`, `spielstaerkeAusPartien`; `analysierePartie` liefert zusätzlich `staerke` (je Seite Wert, Spanne, Tendenz, vorläufig) und `belege`, nimmt `opts.vorwissen`. `spielstaerke` bleibt eine Zahl. `schaetzeSpielstaerke` bleibt erhalten. |
| `eichung-anbindung.patch` | `js/storage.js`: speichert `staerkeBeleg` und `spielstaerkeSpanne` aus der ersten vollen Analyse (wie die übrigen Felder in W0+a), `spielstaerkeDetail()` nur aus wertenden Partien, `statistik().spielstaerkeDetail` (geeicht; ohne Belege wie früher). `js/ui/partie.js`: übergibt `vorigerZug` an `botZug` (neben Seed, `nodes`, `vorliebe`) und `vorwissen` an `analysierePartie`. `js/ui/analyse.js`: `vorwissen` beim Nachrechnen. |
| `eichung-tests.patch` | `tests/bots-mensch.test.mjs` (neu, 30 Prüfungen ohne Engine, in `tests/alle.mjs`), `tests/review.test.mjs` (Stärke-Modell und Bot-Aufschlag), `tests/storage.test.mjs` (Spielstärke im Speicher), `tests/spiel.test.mjs` (drei Erwartungen an `staerkeFuerElo`/`eloDerPartie` an die geeichte Fassung angepasst: 1080 spielt jetzt mit 1100 statt 1000), `tests/engine-bots.html` (keine Spontanzüge, Suchzeit; zwei Grenzen nach den Menschen-Daten: "freie Dame" nach Maia-3 und den genauen Bot-Wahrscheinlichkeiten, Patzerquote Stufe 1), `tests/app.test.mjs` (Boss-Kopf zeigt die geeichte Elo "≈ 1100"). |

**Nach dem Einspielen:** `node tests/sw.test.mjs --aktualisieren` (VERSION und STAND des Service Workers neu, sonst
bekommt das iPad die neuen Dateien nicht). `sw.js` ist bewusst nicht im Patch, weil es im Bau-Durchlauf ständig
wechselt.

**Feste Knotenzahlen (`nodes`, W0+a):** Die Eichung setzt voraus, dass die Suche ihre Tiefe erreicht. Mit `nodes`
bleibt die Tiefe die Obergrenze; zu wenige Knoten machen den Bot schwächer. Wer `nodes` für prüfbare Partien nutzt,
sollte mit `skripte/sim.mjs` und `py/sim_auswerten2.py` neu messen (S3-0).

**Noch zu bauen (Oberfläche, nicht im Patch):** Anzeige der Spanne und von "vorläufig" bei "Spielstärke"
(`statistik().spielstaerkeDetail`) und bei "Spielte wie" (`review.staerke[farbe]`), zum Beispiel "Spielstärke ≈ 1150
(900 bis 1400), vorläufig" und "Spielte wie ≈ 1250, besser als dein Schnitt"; der Info-Text zur Skala in Arena und
Analyse; in `ARCHITEKTUR.md` die neuen Funktionen und Felder eintragen (bots.js: `menschenWahl`, `eloJeLn`, geeichte
`staerkeFuerElo`; review.js: `STAERKE_MODELL` mit Bot-Aufschlag, `spielteWie`, `spielstaerkeAusPartien`; storage.js:
`spielstaerkeDetail`). **Empfehlung:** im Partie-Datensatz speichern, ob Bewertungsbalken oder Live-Bewertung an waren,
damit man ihren Einfluss auf die Schätzung später messen und notfalls abziehen kann.

### 8. Grenzen

1. **Skala.** Alles ist Lichess-Schnellschach (Januar 2024). Für chess.com, FIDE oder DWZ gibt es keine offene
   Umrechnung. Flos Eindruck "zu schwach" lässt sich auf der Lichess-Skala nicht durch stärkere Bots beheben, ohne die
   Etiketten zu verfehlen (Abschnitt 5c).
2. **Unter Lichess 600 dünn, unter 400 nichts.** Benno (250) ist nicht geeicht, nur "schwächer als die schwächsten
   Lichess-Spieler". Hildes Werte (500) liegen am Rand der Daten, ihre Intervalle sind ±300 breit.
3. **Messgenauigkeit.** Die exakte Rechnung hat keinen Ziehungs-Zufall mehr, aber die Stellungen sind eine Stichprobe:
   Das 95-%-Intervall der Kreuzungs-Elo liegt je Bot bei etwa ±100 bis ±200 (grobe Patzer bei den oberen Stufen
   breiter, weil Menschen ab 2000 selten grob patzen). Genauer als auf etwa 100 Punkte lässt sich so nicht eichen.
4. **Partien gegen Maia** sind ein Stellvertreter für Menschen, nicht Menschen. 12 bis 22 Partien je Bot geben je
   ±75 bis ±130 allein aus dem Zufall; Maias eigene Stärke ist unter 1000 sehr unsicher (Hilde und Kalle).
5. **Menschlich, aber nicht ganz** (Abschnitt 5e). Kein Eröffnungsbuch je Stärke; das wäre der nächste Schritt (Daten
   beim Daten-Scout, CC0).
6. **iPad nicht gemessen.** Alle Zeiten unter Node auf einer Server-CPU.
7. **Schätzung.** Gefittet an Lichess-Serverbewertungen, die im Mittel fast genau auf der App-Engine liegen. Der
   Bot-Aufschlag ist mit Maia bei 1500 gemessen; ob er bei anderen Stärken gleich ist, ist offen. Echte Verläufe
   eines Spielers (Form, Lernen) sind nicht nachgebildet. Flos eigene Partien sind nicht gemessen.
8. **Maia-3** ist nur Messwerkzeug (AGPL-3.0) und kommt nicht in die App.

### 9. Dateien und Nachrechnen

Wurzel: `/tmp/claude-0/-home-user/462c3180-85d9-520a-9c74-b32ac8320084/scratchpad/eichung/konstruktion/`

- **Ergebnis:** `VORSCHLAG.md`, `eichung.patch`, `eichung-anbindung.patch`, `eichung-tests.patch`, `bots.js` und
  `review.js` (fertige Dateien auf main 455eb34 zum Ansehen), `rebase/` (main 455eb34 mit allen Patches, git).
- **Bot-Eichung:** `skripte/gitter.mjs` (exakt, alle Maße, seltene Züge) mit `roh/gitter-*.json` ->
  `ergebnisse/gitter-r7.json`, `gitter-r8.json`, `gitter-final.json`, `gitter-steigung*.json`, `gitter-sfe.json`;
  `py/steigung.py`, `py/lokal.py`; Endwerte `konfig-final2.json`.
- **Maß-Prüfung:** `py/vorhersage.py` -> `ergebnisse/vorhersage*.json`; `skripte/exakt.mjs`; `skripte/grob_diagnose.mjs`.
- **Gegenproben:** `skripte/sim.mjs` -> `roh/sim-{klein,gross}.jsonl`, `py/sim_auswerten2.py` ->
  `ergebnisse/sim-beide-r7.json`, `sim-beide-hilde-final.json`, `sim-beide-alt-end-g.json`; `skripte/sim_gegen_exakt.mjs`.
- **Partien gegen Maia:** `skripte/maiaspiele.mts` (mit `--praefix` für neue Zufallssaaten) -> `roh/maia-e1.jsonl`
  (Zwischenstand), `roh/maia-e1b-1.jsonl`, `roh/maia-e1b-2.jsonl`, `roh/maia-e3.jsonl` (neu); Analyse
  `roh/maia-e1.nativ12.jsonl`, `skripte/e1_ingame.mjs` -> `ergebnisse/e1-ingame.json`.
- **Gegner-Effekt:** `roh/maia-e2.app14.jsonl`, `roh/maia-e3.app14.alle.jsonl`, `roh/maia-e3.nativ14.alle.jsonl`,
  `roh/maia-e4-selbst.jsonl`, `roh/maia-selbst.app14.jsonl`; `skripte/e3_auswerten.mjs` -> `ergebnisse/e3.json` (App-Engine),
  `ergebnisse/e3-nativ.json`, `ergebnisse/e2-aufschlag.json`; `skripte/e2_seiten.mjs`, `skripte/e3_zusammen.sh`,
  `skripte/e3_app_zusammen.sh`; Ketten `skripte/kette-{b,c,d,e}.sh`.
- **Freie Dame:** `skripte/dame_exakt.mjs` (genaue Wahrscheinlichkeiten mit der App-Engine).
- **VORSCHLAG-Tabellen:** `py/tabellen_final.py` (füllt die Zahlen aus `ergebnisse/*.json`).
- **Schätzung:** wie bisher `skripte/seiten_tabelle.mjs`, `py/staerke_fit.py`, `skripte/eval_staerke.mjs`,
  `ergebnisse/staerke-bewertung.json`, `ergebnisse/tabellen-staerke.md`.
- **Patches bauen und prüfen:** `skripte/baue_patches2.sh`.
- `STAND.md` (Arbeitsprotokoll), `logs/`, `logs/pid-*.txt` (gemerkte Prozessnummern).

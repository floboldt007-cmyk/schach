# Bot-Eichung: Messung, Anpassungen und Grenzen

Stand: 27.10.2026. Messungen vom 26. und 27.10.2026. Auftrag #40, Basis main 115c610. Gemessen wurde die echte Zugwahl aus js/bots.js mit dem unveränderten Stockfish-Worker der App.

## Ergebnis und Geltungsbereich

Die Tabelle enthält Schätzwerte auf einer **Stockfish-UCI-Vergleichsskala**. Sie belegt keine menschliche chess.com-Elo. Es fehlen Partien gegen Menschen mit bekannter Wertung und gleicher Bedenkzeit. Die Übertragung auf chess.com bleibt offen; aus UCI_Elo lässt sich dafür keine belastbare feste Umrechnung ableiten. SPIELKONZEPT.md 3.12 nennt frühere Daten unter eichung/, diese Dateien liegen im untersuchten Basisstand aber nicht vor und die dortigen Zusammenfassungen betreffen die alte Zehnerleiter. Sie werden nicht als Anker der neuen 30 Bots ausgegeben.

Die Rückmeldung, die Bots seien zu schwach, wird durch diesen Engine-Vergleich nicht pauschal bestätigt: Vorher lagen viele Schätzwerte über den angezeigten Zahlen. Deshalb wurden Fehlerhäufigkeit, Bewertungsrauschen und kurze Suchen anhand der gemessenen Kurve angepasst. Diese Änderung ist ein Entwurf für die Prüfung, keine Behauptung einer abgeschlossenen menschlichen Eichung. Namen, angezeigte Elo, Welten, Sätze, Engine und Testgrenzen bleiben unverändert.

Hildes Schlagvorliebe und Delias Schachvorliebe sind in gepaarten Stellungsproben deutlich messbar. Die Elo-Tabelle misst jeweils das vollständige Profil einschließlich dieser Vorlieben; ihr Einfluss wird nicht aus den Partien herausgerechnet.
Die Punktschätzungen steigen über alle 30 Bots und damit innerhalb sowie zwischen allen fünf Welten streng an. Benno/Paula liegen dabei nur etwa fünf Punkte auseinander; das Ziel von 100 Elo je Nachbar ist damit noch nicht erreicht. Auch die großen Sprünge Johann/Keetan und Alva/Stockfisch bleiben offen. Das ist eine Eigenschaft dieser Stichprobe; benachbarte Konfidenzintervalle überlappen vielfach. Eine statistisch abgesicherte Reihenfolge jedes einzelnen Paars ist damit noch nicht bewiesen.

**Stockfisch bleibt unbegrenzt:** Sein Steckbrief verspricht „ohne jede Bremse“. Der Auftrag verbietet Textänderungen; eine heimliche Begrenzung würde diesem Versprechen widersprechen. Der Messwert liegt deshalb deutlich über der Anzeige 3000. Diesen Widerspruch kann eine reine Anpassung der erlaubten Stärke-Werte bei unverändertem Steckbrief nicht lösen.

## Alle 30 Bots

Notation: Schätzwert [untere; obere Grenze des bedingten 95-%-Intervalls]. N ist die Zahl der Partien, an denen der jeweilige Bot beteiligt war, einschließlich Nachbarpaaren und eigenen Referenzpartien. Eine Nachbarpartie zählt bei beiden Bots. Negative Intervallgrenzen unten sind mathematische Unsicherheit, keine angezeigten Elo.

| Stufe | Bot | Ziel | Vorher [95 %] | N vorher | Nachher [95 %] | N nachher |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Vogelscheuche Fridolin | 100 | 471 [132; 810] | 64 | 414 [88; 740] | 64 |
| 2 | Bauer Benno | 200 | 571 [244; 899] | 128 | 515 [201; 828] | 128 |
| 3 | Postbotin Paula | 300 | 495 [178; 811] | 128 | 520 [218; 822] | 128 |
| 4 | Imker Gustav | 400 | 778 [483; 1074] | 128 | 598 [308; 888] | 128 |
| 5 | Oma Hilde | 500 | 873 [591; 1156] | 128 | 648 [371; 925] | 128 |
| 6 | Janine vom Scheunenclub | 600 | 1018 [750; 1285] | 128 | 749 [485; 1012] | 128 |
| 7 | Holzfäller Bodo | 700 | 1102 [848; 1355] | 128 | 856 [607; 1104] | 128 |
| 8 | Kalle vom Stammtisch | 800 | 1054 [814; 1293] | 128 | 969 [736; 1201] | 128 |
| 9 | Waldläufer Leo | 900 | 1192 [970; 1414] | 128 | 1126 [912; 1340] | 128 |
| 10 | Lisa Läufer | 1000 | 1243 [1037; 1449] | 128 | 1216 [1020; 1412] | 128 |
| 11 | Köhlerin Edda | 1100 | 1351 [1165; 1537] | 128 | 1306 [1130; 1482] | 128 |
| 12 | Ritter Rudi | 1200 | 1477 [1313; 1641] | 128 | 1413 [1260; 1566] | 128 |
| 13 | Luke vom Marktplatz | 1300 | 1512 [1371; 1653] | 128 | 1527 [1402; 1651] | 128 |
| 14 | Professor Turm | 1400 | 1530 [1417; 1643] | 144 | 1561 [1470; 1652] | 160 |
| 15 | Zauberer Moritz | 1500 | 1649 [1550; 1748] | 144 | 1656 [1578; 1734] | 160 |
| 16 | Dame Delia | 1600 | 1713 [1619; 1806] | 144 | 1670 [1597; 1743] | 160 |
| 17 | Bibliothekarin Ottilie | 1700 | 1853 [1760; 1946] | 144 | 1770 [1698; 1841] | 160 |
| 18 | Kommissar König | 1800 | 2004 [1912; 2097] | 144 | 1809 [1739; 1880] | 160 |
| 19 | Fischer Lasse | 1900 | 2047 [1954; 2139] | 144 | 1887 [1817; 1958] | 160 |
| 20 | Hafenmeisterin Wiebke | 2000 | 2245 [2152; 2339] | 144 | 2000 [1929; 2070] | 160 |
| 21 | Großmeisterin Greta | 2100 | 2288 [2197; 2379] | 144 | 2043 [1969; 2117] | 160 |
| 22 | Wattführer Henning | 2200 | 2169 [2079; 2258] | 144 | 2211 [2139; 2283] | 160 |
| 23 | Seenotretterin Ilka | 2300 | 2225 [2119; 2331] | 144 | 2281 [2203; 2359] | 160 |
| 24 | Johann vom Leuchtturm | 2400 | 2356 [2263; 2448] | 144 | 2342 [2267; 2416] | 160 |
| 25 | Taucher Keetan | 2500 | 2393 [2297; 2489] | 144 | 2621 [2545; 2697] | 160 |
| 26 | Lotsin Ragna | 2600 | 2550 [2462; 2639] | 144 | 2701 [2627; 2774] | 160 |
| 27 | Schatzsucher Silas | 2700 | 2668 [2578; 2758] | 144 | 2810 [2737; 2883] | 160 |
| 28 | Forscherin Merle | 2800 | 2820 [2726; 2915] | 144 | 2844 [2770; 2918] | 160 |
| 29 | Hüterin Alva | 2900 | 2871 [2765; 2977] | 144 | 2894 [2811; 2978] | 160 |
| 30 | Der Stockfisch | 3000 | 3590 [3303; 3876] | 80 | 3480 [3301; 3659] | 96 |

Insgesamt 2128 Partien vorher und 2400 Partien im abschließenden Datensatz. Vorher: 64 je Nachbarpaar und 16 je UCI-Anker (Stufen 14 bis 30). Nachher: 64 je Nachbarpaar und 32 je UCI-Anker. Bei der Arbeit gab es zusätzliche verworfene Zwischenstände; diese gehen nicht als Partien veränderter Profile in die Endtabelle ein.

## Nachbarpaare

100 Elo entsprechen nach der logistischen Elo-Formel 64,0 % erwarteten Punkten für den stärkeren Bot. Punkte sind Sieg + halbes Remis. Der Modellabstand nutzt zusätzlich die Referenzpartien, daher entspricht er nicht immer genau dem direkten Paarergebnis. Alle Intervalle sind zweiseitig, ohne nachträgliche Korrektur für die 29 Paarvergleiche.

| Stufen | N | Aus Sicht der höheren Stufe | Punktequote | Modellabstand [95 %] |
| --- | --- | --- | --- | --- |
| 1/2 | 64 | +19 =44 -1 | 64.1 % | 101 [12; 189] |
| 2/3 | 64 | +9 =47 -8 | 50.8 % | 6 [-79; 91] |
| 3/4 | 64 | +21 =36 -7 | 60.9 % | 78 [-10; 165] |
| 4/5 | 64 | +17 =39 -8 | 57.0 % | 50 [-36; 136] |
| 5/6 | 64 | +28 =26 -10 | 64.1 % | 101 [12; 190] |
| 6/7 | 64 | +35 =13 -16 | 64.8 % | 107 [18; 196] |
| 7/8 | 64 | +35 =14 -15 | 65.6 % | 113 [24; 203] |
| 8/9 | 64 | +41 =9 -14 | 71.1 % | 157 [64; 251] |
| 9/10 | 64 | +38 =4 -22 | 62.5 % | 90 [2; 177] |
| 10/11 | 64 | +36 =8 -20 | 62.5 % | 90 [2; 178] |
| 11/12 | 64 | +40 =3 -21 | 64.8 % | 108 [19; 197] |
| 12/13 | 64 | +42 =0 -22 | 65.6 % | 114 [24; 203] |
| 13/14 | 64 | +34 =2 -28 | 54.7 % | 34 [-51; 119] |
| 14/15 | 64 | +41 =1 -22 | 64.8 % | 95 [18; 172] |
| 15/16 | 64 | +26 =7 -31 | 46.1 % | 14 [-58; 86] |
| 16/17 | 64 | +34 =4 -26 | 56.2 % | 100 [28; 172] |
| 17/18 | 64 | +29 =5 -30 | 49.2 % | 40 [-31; 110] |
| 18/19 | 64 | +36 =0 -28 | 56.2 % | 78 [7; 149] |
| 19/20 | 64 | +37 =3 -24 | 60.2 % | 112 [40; 184] |
| 20/21 | 64 | +35 =2 -27 | 56.2 % | 43 [-27; 114] |
| 21/22 | 64 | +43 =5 -16 | 71.1 % | 168 [93; 243] |
| 22/23 | 64 | +30 =7 -27 | 52.3 % | 70 [-1; 141] |
| 23/24 | 64 | +37 =5 -22 | 61.7 % | 60 [-16; 136] |
| 24/25 | 64 | +53 =5 -6 | 86.7 % | 280 [196; 364] |
| 25/26 | 64 | +36 =11 -17 | 64.8 % | 80 [7; 152] |
| 26/27 | 64 | +34 =17 -13 | 66.4 % | 109 [36; 182] |
| 27/28 | 64 | +25 =22 -17 | 56.2 % | 34 [-37; 105] |
| 28/29 | 64 | +25 =27 -12 | 60.2 % | 51 [-23; 124] |
| 29/30 | 64 | +57 =7 -0 | 94.5 % | 586 [408; 764] |

## Vorlieben: gepaarte Probe mit und ohne Gewichte

Für jeden Bot wurden dieselben 20 vorhandenen Teststellungen mit zehn festen Seeds pro Stellung gespielt, jeweils das echte Profil und eine Kopie mit leerem staerke.vorlieben. Beide Varianten erhalten vor jedem Zug ucinewgame und 20000 Knoten. Hilde zählt Schlagzüge, Delia Schach einschließlich Matt. Das isoliert den Stil innerhalb desselben Profils; es ist keine Schlag- oder Schachquote in beliebigen ganzen Partien.

| Stand | Bot | Zugpaare | Mit Vorliebe | Ohne Vorliebe | Differenz in Prozentpunkten [95 %] |
| --- | --- | --- | --- | --- | --- |
| Vorher | Oma Hilde | 200 | 52/200 | 20/200 | 16.0 [9.5; 22.5] |
| Vorher | Dame Delia | 200 | 3/200 | 2/200 | 0.5 [-0.5; 1.5] |
| Nachher | Oma Hilde | 200 | 76/200 | 25/200 | 25.5 [17.0; 34.0] |
| Nachher | Dame Delia | 200 | 32/200 | 1/200 | 15.5 [2.5; 28.5] |

Die Stilintervalle verwenden die 20 Stellungen als Cluster, die Standardabweichung ihrer mittleren Differenzen und t(19)=2,093. Sie beschreiben die ausgewählten Stellungen. Delias größere Schachgewichte werden durch die übrigen Stärke-Werte mit abgestimmt; die Partieergebnisse zeigen, wie stark sie damit insgesamt spielt.

## Methode

### Partien und Anker

- Node 24.19.0, Debian 13, Chromium 154.0.8037.57, ein Stockfish-Thread je Worker. Zwei Worker, getrennte Engines; keine Schachuhr. Der App-Worker und chess.js aus diesem Repository bleiben unverändert.
- Jeder Zug geht durch botZug mit ohnePause:true und nodes:20000. Bei eigenen Profilen gilt zusätzlich ihre kurze oder normale Suchtiefe. Knoten ersetzen die Rechenzeit, nicht die Profilregeln. Bei Stufen ab 2200 greift die interne UCI-Bremse; beim Stockfisch keine.
- Referenzen ab Stufe 14 sind direkte Stockfish-Profile mit UCI_Elo gleich der angezeigten Zielzahl, ebenfalls 20000 Knoten. Die Engine begrenzt UCI_Elo nach unten auf 1320. Deshalb wird für Stufen unter 1400 keine angeblich direkte schwache UCI-Referenz erfunden.
- Acht eigene kurze Eröffnungen: Grundstellung; e4 e5; d4 d5; c4 e5; Sf3 d5; e4 c5; d4 Sf6; e4 e6. Je zwei Partien erhalten dieselbe Eröffnung und denselben Seed, mit vertauschten Farben. Die acht Eröffnungen wiederholen sich über unabhängige Seeds.
- Für Stufe a und Partie i: pair=floor(i/2), seed=(0x6b8b4567+a*65537+pair*104729)>>>0. Vor jedem Zug wird zugZufall(seed, Anzahl bisheriger Halbzüge einschließlich Eröffnung) neu erzeugt. Das vermeidet unterschiedliche Zufallsfortschritte durch abweichende Partielängen.
- Jede Partie beginnt mit ucinewgame. Innerhalb einer Partie benutzen beide Spieler dieselbe Engine, entsprechend dem vorhandenen Paarvergleich. Der gemeinsame Hash kann beide beeinflussen; getrennte Engines pro Spieler sind eine sinnvolle Nachmessung.
- Matt, Patt, Wiederholung, unzureichendes Material und 50-Züge-Regel werden mit chess.js gewertet. Nach höchstens 200 zusätzlich gespielten Halbzügen analysiert die unbegrenzte Referenz mit 100000 Knoten: mehr als +300 cp ergibt Weißsieg, weniger als -300 Schwarzsieg, sonst Remis. Mattwerte erhalten das Vorzeichen des Matts. Diese Abbruchwertung ist eine Näherung und wird nicht als tatsächlich ausgespielter Sieg ausgegeben.
- Der eigene Zufall ist fest. Stockfishs interne UCI-LimitStrength-Auswahl besitzt eine eigene, hier nicht gesetzte Zufallsquelle. Die UCI-Partien sind daher trotz fester Knoten und eigener Seeds nicht bitweise wiederholbar. Ein erneuter Lauf darf andere Ergebnisse liefern.

### Modell und Unsicherheit

Geschätzt werden 30 freie Zahlen mit P(A)=1/(1+10^((R_B-R_A)/400)); ein Remis zählt 0,5. Die UCI-Referenzzahlen bleiben fest. Maximiert wird die logistische Pseudo-Likelihood der Ergebnisse. Ein sehr schwacher normaler Prior je Bot, Mittelwert Zielzahl und Standardabweichung 2000, verhindert unendliche Werte bei perfekten Serien. Es gibt **keine Ordnungsbedingung**. Vorherige Umkehrungen und verbleibende unsichere Nachbarn werden nicht geglättet.

Die Varianz stammt aus der inversen Hesse-Matrix sowie einer Sandwich-Schätzung, die alle Partien desselben Seeds gemeinsam clustert, einschließlich beider Farben und Nachbar-/Referenzgegner. Pro Bot bzw. Differenz wird die größere der beiden Standardabweichungen verwendet. Die Intervalle sind Schätzwert ±1,96 Standardfehler. Sie enthalten weder die Unsicherheit der UCI-Skala noch eine unbekannte Übertragung auf menschliche Elo, Geräteunterschiede oder die Auswahl nach Messungen.

Die Profile wurden in mehreren Durchgängen auf denselben Seeds abgestimmt. Der Enddatensatz ist deshalb eine Messung der abgestimmten Profile, kein unabhängiger Blindtest. Neue Seeds, weitere Eröffnungen und menschliche Gegner sind für eine belastbare Freigabe nötig. 64 Partien pro Paar erlauben eine sinnvolle erste Kurve, aber keinen Beweis von exakt 100 Elo Abstand bei allen 29 Nachbarn.

### Unveränderte Profile wiederverwenden

Partien bereits gemessener Profile wurden nur übernommen, wenn die vollständigen staerke-Objekte beider Spieler identisch blieben; bei einer UCI-Referenz wurde das eine Bot-Profil geprüft. Knotenzahl und Zuglimit müssen ebenfalls identisch sein. Abweichende Profildaten führen zum Abbruch des Messskripts. Ursprüngliche Quellhashes und Resultate wurden beibehalten; nach einer Änderung wurden betroffene Partien neu gespielt.
| SHA256 von js/bots.js im ursprünglichen Lauf | Partien im Enddatensatz |
| --- | --- |
| 088058da7f3da77e301994276cdbce332265048a4f7a07affc5e08864c123afb | 975 |
| 2261960b146fe3e2bead50100b737046dd9b9ad62fe8c9e158c18ac2a594dc65 | 673 |
| 24735af8cbafcd3d14b10c17f3e2ba8e5a8c248946b0443041524e0421739afa | 128 |
| 60132dc4b0face78941d04ab281f267d5bd177d28a2527bd5b4953bb497fc1aa | 158 |
| fd76aa0f2a398358264312f2cacae8924b618dd3a799b59466c8b9b7f1de147c | 466 |

Aktueller Quellhash: 24735af8cbafcd3d14b10c17f3e2ba8e5a8c248946b0443041524e0421739afa. Vorheriger Quellhash: 60132dc4b0face78941d04ab281f267d5bd177d28a2527bd5b4953bb497fc1aa. Die Partienzahlen oben enthalten diese unveränderten Wiederverwendungen nur einmal; Schlüssel typ/stufe/partie sind eindeutig.

## Prüfungen

Der vorhandene vollständige Engine-Test lief auf dem finalen Profilstand mit unveränderten Assertions:
```text
PLAYWRIGHT_PFAD=/tmp/crownmate-playwright.cjs PORT=19057 node tests/engine-bots.test.mjs --anker --ankerpartien=8 --parallel=2
66/66 bestanden in 530 s
```

Die lokale Playwright-Datei wählt lediglich das installierte Chromium aus. Sie ändert keine Tests. Die Weltmittel des Chancenverlusts waren 0,158 > 0,078 > 0,053 > 0,034 > 0,017. Fridolin: 27 % grobe Patzer; Stockfisch: 0 % grobe Patzer, 11 cp mittlerer Verlust. Die vier vorhandenen Paarvergleiche holten zusammen 21.5/24 Punkte (90 %). Die zusätzlichen alten Anker-Proben mit je acht Partien sind ein separater Bericht mit anderem Zeitbudget; sie sind nicht Teil der obigen Elo-Schätzung.

```text
node tests/sw.test.mjs --aktualisieren
node tests/sw.test.mjs
42 von 42 Pruefungen bestanden.
```

Die vollständigen Chromium- und WebKit-Ergebnisse stehen beim Pull Request. Diese Messung ersetzt deren UI- und Offline-Prüfungen nicht.

## Offene Punkte

1. **Menschliche chess.com-Elo:** Für keinen der 30 Bots ist sie mit diesem Verfahren belegt. Es fehlen echte Vergleichspartien, die Bedenkzeit und eine nachvollziehbare Zuordnung des Menschenpools. Eine Lichess- oder UCI-Zahl wird nicht einfach als chess.com-Zahl umbenannt.
2. **Untere Bots:** Ihre absoluten Werte entstehen über eine lange Kette von Nachbarvergleichen. Die Unsicherheit kumuliert. Insbesondere Stufen 1 bis 13 brauchen mehr direkte Kreuzvergleiche und Menschen als zusätzliche Anker.
3. **Einzelne Nachbarn:** Überlappende Intervalle und Paarquoten nahe 50 % bleiben unsicher. Die Tabelle legt auch Abweichungen von den erwarteten 64 % offen. Eine streng ansteigende Punktschätzung beweist keine streng ansteigende wahre Spielstärke.
4. **Stockfisch:** Die Anzeige 3000 und „ohne jede Bremse“ beschreiben unterschiedliche Ziele. Bei unveränderten Texten bleibt er unbegrenzt; seine Zahl kann so nicht als genaue Spielstärke gelten. Eine Begrenzung erfordert die bewusste Änderung des Versprechens, eine unbegrenzte Variante eine ehrliche Kennzeichnung bzw. andere Zahl.
5. **Geräte und Zeit:** Das Messbudget ist fest in Knoten. Die normale App benutzt zum Teil Millisekunden und eine menschliche Pause. Vor allem schnelle obere Bots müssen zusätzlich auf dem iPad unter ihren echten Zeitgrenzen gemessen werden.
6. **Methodeneffekte:** Gemeinsamer Engine-Hash innerhalb einer Partie, acht Eröffnungen, Abbruchwertung nach 200 Halbzügen, interne Stockfish-Zufallswahl und Anpassung anhand derselben Seeds begrenzen die Übertragbarkeit. Die statistischen Intervalle decken diese systematischen Effekte nicht ab.

## Nachvollziehbarkeit

Die folgenden Ergebnisfolgen enthalten alle Resultate, die in die beiden Tabellen eingegangen sind. Je Zeile steht eine Serie in aufsteigender Partienummer i, beginnend bei 0. w = Sieg des links genannten Bots a, d = Remis, l = Niederlage. „paar a“ bedeutet a gegen a+1; „anker a“ bedeutet a gegen UCI_Elo a*100. Gerade i spielt a Weiß, ungerade Schwarz. Damit lassen sich alle Punktquoten, Schätzwerte und Farbpaare ohne private Arbeitsdateien nachrechnen.
<details>
<summary>Alle Ergebnisse vorher</summary>

```text
anker 14 wwlwwwllwlwlwwlw
anker 15 wwlwwwwwwdwlwwlw
anker 16 llwwlwwlwwlwwllw
anker 17 wlwwwlwwlllwwlww
anker 18 lwwwwwlwwlwwlwww
anker 19 wwwlwllwllwlwwwl
anker 20 wlwlwlwwwlwwwwww
anker 21 wwwwwwwwlwlddwww
anker 22 wlllwwldllldllll
anker 23 wdlllldwwlwwwwww
anker 24 llwllldlwllllldw
anker 25 lllwdwlwwdllwwww
anker 26 wwwlwwwwldldwdww
anker 27 llwldwlllldlwwdd
anker 28 llwwlwwwwdwldlwl
anker 29 lwwdllwddwwddlll
anker 30 wwdwwwwwwwwwwwww
paar 01 dllldddddlwdldldwlddddllllwlddlldwdldddlldlddwlddlldddldllwddddd
paar 02 dwwddddwddwwdddddddddldlwlwddwddwlwdwldwwlddddwddwdwwlwddwddwwdd
paar 03 lllwdlwdllllllllllllwddllllllldddlllllldddldlldlllllddllllllllld
paar 04 dwwllwddllllwlwldwddddwlwlwlwddlddllldldlldlddldlllllwwldldldllw
paar 05 ddllllllldldllddwwdwldwllllldldldwdwdllllldldlddwddlldlldldwlldl
paar 06 dldlwlwdlllwllllllwwdlwlwwlwlllllwllwldwddlllwlllwddwdlwldlwllww
paar 07 lwwdwwddwwlwlwdlllwwwlddwdwdwldwwwlwwldwwdlwwwwdwlddwlwlldldldll
paar 08 llwwlwlwlllwlwwwldlwlllwllllwllwllwlllldlllwlwllllwdlwllllldlwll
paar 09 lwllwwlwwlwlwwwwdllllwlwlllwlwwlddllwlllwllldlwwllllwwlwllwldlww
paar 10 lwllwllwlwlwllllllllllllllwlwllwllwllwllwwlllldlwwlwwwllwwlwllww
paar 11 lwwlllwlwwlllwlwllllllwlllllwwwlllwwlwwlllllwwllllllwlwlwllllwll
paar 12 wwllwldllllwllwllwlwwllwwwldlllwllwwwldllwwllwlwwwwllldwlwlwwlwl
paar 13 llwlwlllwwllwwllwwllwdwlwwllwwllwlwlwwwwlwllllwllwlwwlwwwlllllww
paar 14 ldlwwlllwlllwlwwlllllwlwlllwllwwllllwllllwwllwwlwllllwdldlwlwllw
paar 15 wldllllllwlwldlwlllwllwlllllllwlwwwwdlwwwllwllwllwlwwwlwllwwdlwl
paar 16 wlwlwwllllldlllllwwwlwwwllllllwlllllllwlwlwllllwwlllllwlllwldwwl
paar 17 lwllwlllwllllldllllldllllwllwlwwwllwllldwlwlwwlwwwwlllwlllwlwlll
paar 18 llwwllwlllwlwllwwlwlwldlwwlwlwlwlwwllwllldllwlwwlwwwwwlwwdldllww
paar 19 lwwlwllwllllldlwwlllldllllllwllldlwlwllldlwlwlwllwwwdllwllwlwlll
paar 20 wlwdlwwlddlwdlddlwwldlldlwwwldwwwlwlwwwlwlllwwlwddwwwllwwwdlllwl
paar 21 wwwwwwwlwwwllwwwlwwwdwwddwwwlwdlwwwwwlwwwwwlwldwwwwwwlwwwwlldlwd
paar 22 wwwwwdllwlddwwwwdwwlwdlllldwlllwwwwlwwwwllwdlwlwlllldwlwwlwwllwl
paar 23 wwwlwlwwwlllwwlwwdwwllllllwwldlldlllwlwldwwlllllwllllwlllwllwlll
paar 24 lllwwwlwdwwllldwwllwwlwdldwldlwwlwwlllwwwwwwwwwlwllddwlldwwdwdlw
paar 25 ldwllldwwdlllldwldwdllwdldllllllllldwldwlwwlwlwwlllllwlllddwwlld
paar 26 llwlldwldlllldlddllldllwdldwldldllwlldwlwdwlllwllwdwlllldldldwlw
paar 27 llwdllwlllwlddddlllwwdwlddllllldllwlllwllldwlllwllwdlddlllwldlld
paar 28 ldwllddlwdwllllldwdlwlwlwwwdllwddlwlddllllwwdwwlldldldldwddwldwl
paar 29 llldlllllllllllllllllllllllllllllllllllllllllllllllllllllldlllll
```

</details>

<details>
<summary>Alle Ergebnisse nachher</summary>

```text
anker 14 lwwwwlwwwlwwwlwlwwwllwwwwwwwwwlw
anker 15 wlwlwllwlwlwwllwlwlwlwwwlwwwwllw
anker 16 ldwlwwlwwllwldlwwwlwwwwwlwlwlllw
anker 17 lwllwwwwwldlwwwwwwwwlwwwlwdllwll
anker 18 wwdlwwllwllwllllwwwwwwlwwwlwlllw
anker 19 llwwwwlwlwwlwllwllwwlwlwwlllwlll
anker 20 wdwdwlwwwwwlwwwlllwwlllldlwwlwww
anker 21 lwllwwlwllwwllllldllwddlwlwwlllw
anker 22 dlwlwlwlllldllllwldlwldllwdwwwwl
anker 23 llwdwwlwwlwwwwwwwldwllwwwwwllwww
anker 24 wwdwlldlwllllldwwlwlllwdlldwwwll
anker 25 dwllwwwddllwwwlwlwwwwwdlwldwwwww
anker 26 wwdlwdlwddddwdwdlwddwdldldlwdwww
anker 27 wwwdwldwwlddwwllddwwlwdwwllwwdww
anker 28 wlddddwwwdwldlwllwwlwlwwwlwdwdwl
anker 29 ldlllwddddwddlldwlddlldlldlwwldw
anker 30 wdwwwwwwwwwwwwwwwwwwwwwwwwwwwwww
paar 01 ddddddlddddldddddwldddddlldlldddlddddlldlddlldddddldddldddlldldl
paar 02 dddldddlddddddlddddwwddddddddldddldwddddddwdlwdwdldwdwdddddllddd
paar 03 ldwlldddddddlwwldllldddldlwdlddldllddlwwddddldldldddddddddlwdldl
paar 04 ldddwdddddldllwddddddddwldddlwdldwlddldddwddwdddddlldlldldldwldl
paar 05 dddlldlllwddllwddwwldllddddllldlldwwwlddwdlldwlllddwdlllddlllldd
paar 06 lllllldwdlwdlwddwdddwlwwlllwwllwllwllwdllllwddlllldwllwwldllllll
paar 07 lwllwdwwdlldlwlllwddllllllwllllllllddwlddllwdwllwlwwlldlldlwwldd
paar 08 lwdlllldllllwdlwlllllwlwdwlldldwdllwwllllwlllwwlllldlllllllldwwl
paar 09 llwllwlwdwlllllwlldlwllllwlwwlwlllwwwllwwlwwdllwllwwllldwlwlllll
paar 10 lwllllwllwwwdllldlwlllwllllldwdwlwlllwlwlllwdldlwlwwwwwldlwlldll
paar 11 llwldwllwllllwwllwdldlwlwllllwwlwllwlwwllwllwlllllllllwllwlwwwll
paar 12 llllllwlwllllwlllwlwwwwwwwwllllllllwlllwwllllllwwllwlwwllwlllwll
paar 13 lwwlwllldlllwlwllllwwwwlwllwwdwwllllwlwlwllwlwlwwllwwllwlwlwwwll
paar 14 lwlwwlllllllllwllwlwlwlwlwwlllwwwwlllllllwwlllwlwllllwlllwdlwllw
paar 15 lwdlldwlwlwwlllwwllwwwwdlwdwwlwwdwlwwwlwwlllllwlldlwwdwwwlllwwlw
paar 16 lwlwlwdlwwllwdlllllwlwlwwllwwwlllwlllwlllwldwlwlwdlwwwwlllwlwlwl
paar 17 llwllwllwdlldllwlwwwdlwdwwwwwllwdllwlwwwlwwlwwlwwlllwllwlwwlwlwl
paar 18 lwwwwlwlwlwlllwlwlllllwlwllwlwlwlwlwllwwwlwllwwlllllwlwwwllllwlw
paar 19 wlllwlwwlwwlllllwllwlwdwwlldwlllwlwwwllwwwlwwllllwlwlllllldlwlll
paar 20 wlllwlwllwlwwllwdlwlwllwwwllwwwlwlllwllwldwllwlwlllwlllllwwlwlww
paar 21 llwlwwldlllwllllllllllwlllldlwwllllwwldwdlllllwlwllwdllwwllllllw
paar 22 lllwllllwlddwwwwdwwlwdlllldwlllwwwwlwwwwllwdlwlwlllldwlwwlwwllwl
paar 23 ldwwwwwlwlllwwlwwdwwllllllwwldlldlllwlwldwwlllllwllllwlllwllwlll
paar 24 lllllllllwlllldlllwlllllddlllllllllllldlllllwlllllwlllwlllldwlll
paar 25 wldlwlllldlwwlllwlllwdlwdlldlwllwlllwllwlwwlwlldldlllldldlwldwwd
paar 26 wlwlwlddldllwlllldwllddllllwdlldlwldllddllldwllwlwdwlldddllwdwll
paar 27 dllwwdwldddldwllllwlwdddlwldwlllwdddlllwwlwlddwlddlldwdwldwwdldl
paar 28 wlddwldllddlldddllldlwddwlwllldlwdwdwllddlddlldlldldddwlwldddwwd
paar 29 lllldllllllllllddlllllllllldlllllldllldlllllllllllllllllllllldll
```

</details>

### Auswertung der Ergebnisfolgen

Eine der beiden Folgen als resultate.txt speichern. Das folgende Skript als auswertung.py speichern und mit Python, NumPy und SciPy ausführen. Es rekonstruiert die Partien einschließlich Farb-Clustern und verwendet dasselbe Modell. Die Resultate sind gerundet; negative Elo-Untergrenzen werden nicht bei null abgeschnitten.
```sh
python3 auswertung.py resultate.txt fit.json
```

```python
import json, sys, math
import numpy as np
from scipy.optimize import minimize
from scipy.special import expit
from collections import defaultdict
rows=[]
for line in open(sys.argv[1]):
 typ,a,codes=line.split()
 a=int(a)
 for i,code in enumerate(codes):
  r=dict(key=f'{typ}-{a}-{i}',a=a,i=i,score={'w':1,'d':.5,'l':0}[code],reason='Ergebnisfolge')
  r.update({'b':a+1} if typ=='paar' else {'elo':a*100})
  rows.append(r)
source='Ergebnisfolge'
hashes={source}
q=np.log(10)/400
X=np.zeros((len(rows),30));anchor=np.zeros(len(rows));y=np.zeros(len(rows))
for n,r in enumerate(rows):
 X[n,r['a']-1]=q;y[n]=r['score']
 if r.get('b'):X[n,r['b']-1]=-q
 else:anchor[n]=r['elo']*q
prior=np.arange(100,3001,100);precision=1/2000**2
# Schwacher Prior nur gegen unendliche Schaetzwerte, keine erzwungene Reihenfolge.
def objective(v):
 z=X@v-anchor
 return np.logaddexp(0,z).sum()-y@z+precision*((v-prior)**2).sum()/2

def jac(v):return X.T@(expit(X@v-anchor)-y)+precision*(v-prior)

def hess(v):
 p=expit(X@v-anchor)
 return X.T@((p*(1-p))[:,None]*X)+np.eye(30)*precision
fit=minimize(objective,prior,jac=jac,hess=hess,method='trust-exact',options={'gtol':1e-7,'maxiter':500})
v=fit.x
if np.linalg.norm(jac(v))>1e-5:raise ValueError('Modell nicht konvergiert')
cov=np.linalg.inv(hess(v));p=expit(X@v-anchor)
# Sandwich-Schaetzung clustert gleiche Saat ueber Farben und Gegner hinweg.
clusters=defaultdict(lambda:np.zeros(30))
for n,r in enumerate(rows):clusters[(r['a'],r['i']//2)]+=X[n]*(y[n]-p[n])
meat=sum(np.outer(g,g) for g in clusters.values());robust=cov@meat@cov
se=np.maximum(np.sqrt(np.diag(cov)),np.sqrt(np.maximum(0,np.diag(robust))))
counts=np.sum(X!=0,axis=0)
print('Partien',len(rows),'Quellhash',source,'Quellstaende',len(hashes),'Gradient',round(np.linalg.norm(jac(v)),8))
print('Bot | N | Proxy | 95%-Intervall')
for i in range(30):print(f'{i+1:2d} | {counts[i]:3d} | {v[i]:.0f} | {v[i]-1.96*se[i]:.0f}..{v[i]+1.96*se[i]:.0f}')
print('Nachbarn: Punkte des staerkeren Soll-Bots; Modellabstand und 95%-Intervall')
for i in range(1,30):
 r=[r for r in rows if r.get('b')==i+1 and r['a']==i]
 if not r:continue
 sd=max(math.sqrt(cov[i,i]+cov[i-1,i-1]-2*cov[i,i-1]),math.sqrt(max(0,robust[i,i]+robust[i-1,i-1]-2*robust[i,i-1])))
 print(i,i+1,'N',len(r),'P',round(100*(1-sum(x['score'] for x in r)/len(r)),1),'Abstand',round(v[i]-v[i-1]),'CI',round(v[i]-v[i-1]-1.96*sd),round(v[i]-v[i-1]+1.96*sd))
result={'cov':cov.tolist(),'robust':robust.tolist(),'n':len(rows),'hash':source,'source_hashes':sorted(hashes),'elo':v.tolist(),'se':se.tolist(),'counts':counts.tolist(),'clusters':len(clusters),'reason':{s:sum(r['reason'].split()[0]==s for r in rows) for s in ['Matt','Patt','Wiederholung','Material','50-Zuege','Limit-Referenz']}}
if len(sys.argv)>2:json.dump(result,open(sys.argv[2],'w'),indent=2)
```

### Neue Partien mit dem gleichen Verfahren

Das folgende Skript als eichung.mjs speichern, vom Repository-Verzeichnis aus starten und Playwright bereitstellen. Es nutzt die aktuellen Profile. Für den alten Stand kann js/bots.js aus Commit 115c610 separat gespeichert und über --bots-file angegeben werden. Leere Ausgabedateien benutzen; beim frischen Nachlauf können die UCI-Ergebnisse wegen des internen Zufalls abweichen. Die Profilprüfung für alte Arbeitsstände ist hier mit enthalten, wird aber ohne --profiles nicht benötigt.
```sh
node eichung.mjs --root=. --out=nachher.jsonl --games=64 --anchors=32 --anchors-upper=32 --workers=2
node eichung.mjs --root=. --bots-file=/tmp/bots-vorher.js --out=vorher.jsonl --games=64 --anchors=16 --workers=2
```

```js
import http from 'node:http';
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let playwright;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { playwright = require(p); break; } catch {}
}
if (!playwright) throw Error('Playwright fehlt; PLAYWRIGHT_PFAD setzen');
const { chromium } = playwright;
const arg = (k, d) => process.argv.find(a => a.startsWith('--' + k + '='))?.slice(k.length + 3) ?? d;
const root = path.resolve(arg('root', process.cwd()));
const out = arg('out', 'eichung.jsonl');
const port = Number(arg('port', 19040));
const games = Number(arg('games', 64)), anchorGames = Number(arg('anchors', 16));
const upperAnchors = Number(arg('anchors-upper', anchorGames));
const workers = Number(arg('workers', 2)), nodes = Number(arg('nodes', 20000));
const maxply = Number(arg('maxply', 200));
const botsFile = arg('bots-file', path.join(root, 'js/bots.js'));
const hash = createHash('sha256').update(readFileSync(botsFile)).digest('hex');
const previous = existsSync(out) ? readFileSync(out, 'utf8').trim().split('\n').filter(Boolean).map(s => JSON.parse(s)) : [];
const registryFile = arg('profiles', null);
const registry = registryFile ? JSON.parse(readFileSync(registryFile, 'utf8')) : null;
function valid(row) {
  if (row.nodes !== nodes || row.maxply !== maxply) return false;
  if (!registry) return row.hash === hash;
  const old = registry[row.hash], current = registry[hash];
  return !!old && !!current && old[row.a] === current[row.a] && (!row.b || old[row.b] === current[row.b]);
}
if (previous.some(x => !valid(x))) throw Error('Messdatei enthaelt andere Profile oder Suchgrenzen');
const done = new Set(previous.map(x => x.key));
const tasks = [];
// Gleiche Saat und Eroeffnung fuer ein Farbwechsel-Paar; unabhaengige Saetze je Paar.
for (let a = 1; a < 30; a++) for (let i = 0; i < games; i++) tasks.push({ key: `paar-${a}-${i}`, a, b: a + 1, i });
for (let a = 14; a <= 30; a++) for (let i = 0; i < (a >= 22 ? upperAnchors : anchorGames); i++) tasks.push({ key: `anker-${a}-${i}`, a, elo: a * 100, i });
// Zuerst je ein Farbwechsel-Paar aller Stufen, dann die naechste Runde.
tasks.sort((a, b) => Math.floor(a.i / 2) - Math.floor(b.i / 2) || a.a - b.a || a.key.localeCompare(b.key));
const focus = new Set(arg('focus', '').split(',').filter(Boolean).map(Number));
if (focus.size) tasks.sort((a,b) => Number(!focus.has(a.a)) - Number(!focus.has(b.a)) || Math.floor(a.i/2)-Math.floor(b.i/2) || a.a-b.a || a.key.localeCompare(b.key));
const todo = tasks.filter(t => !done.has(t.key));
const mime = { '.js': 'text/javascript', '.html': 'text/html', '.wasm': 'application/wasm', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  if (req.url === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<!doctype html><title>Eichung</title>'); return; }
  const requestPath = new URL(req.url, 'http://x').pathname;
  const file = path.resolve(root, '.' + requestPath);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  try { const data = readFileSync(requestPath === '/js/bots.js' ? botsFile : file); res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(data); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.exposeFunction('messung', row => {
    appendFileSync(out, JSON.stringify({ hash, nodes, maxply, ...row }) + '\n');
    console.log(`${row.key}: ${row.score} (${row.reason}, ${row.plies} Halbzuege, ${row.seconds}s)`);
  });
  await page.goto(`http://127.0.0.1:${port}/`);
  console.log(JSON.stringify({ hash, games, anchorGames, upperAnchors, workers, nodes, maxply, remaining: todo.length }));
  await page.evaluate(async ({ tasks, workers, nodes, maxply }) => {
    const { Engine } = await import('/js/engine.js');
    const { BOTS, botZug } = await import('/js/bots.js');
    const { Chess } = await import('/vendor/chess/chess.js');
    const { zugZufall } = await import('/js/tag.js');
    // Eigene kurze Eroeffnungen; beide Farben eines Paares erhalten dieselbe Stellung.
    const openings = [[], ['e2e4','e7e5'], ['d2d4','d7d5'], ['c2c4','e7e5'], ['g1f3','d7d5'], ['e2e4','c7c5'], ['d2d4','g8f6'], ['e2e4','e7e6']];
    let next = 0;
    async function worker() {
      const e = new Engine();
      await e.init();
      try {
        while (next < tasks.length) {
          const t = tasks[next++], start = performance.now();
          const pair = Math.floor(t.i / 2), seed = (0x6b8b4567 + t.a * 65537 + pair * 104729) >>> 0;
          const c = new Chess();
          for (const u of openings[pair % openings.length]) c.move({ from: u.slice(0,2), to: u.slice(2,4) });
          await e.newGame();
          const left = BOTS[t.a - 1];
          const right = t.b ? BOTS[t.b - 1] : { id: 'anker', elo: t.elo, staerke: { voll: true, elo: t.elo, movetime: 200 } };
          const leftWhite = t.i % 2 === 0;
          let plies = 0;
          const styles = {}, moves = [];
          let reason, score;
          while (plies < maxply && !c.isGameOver()) {
            const bot = (c.turn() === 'w') === leftWhite ? left : right;
            const r = await botZug(e, c.fen(), bot, { ohnePause: true, nodes, zugNummer: c.history().length, zufall: zugZufall(seed, c.history().length) });
            const m = c.move({ from: r.uci.slice(0,2), to: r.uci.slice(2,4), promotion: r.uci[4] });
            const stats = styles[bot.id] ??= { moves: 0, captures: 0, checks: 0 };
            stats.moves++; if (m.captured) stats.captures++; if (/[+#]/.test(m.san)) stats.checks++;
            moves.push(r.uci); plies++;
          }
          if (c.isCheckmate()) { score = ((c.turn() === 'w') !== leftWhite) ? 1 : 0; reason = 'Matt'; }
          else if (c.isGameOver()) { score = .5; reason = c.isStalemate() ? 'Patt' : c.isThreefoldRepetition() ? 'Wiederholung' : c.isInsufficientMaterial() ? 'Material' : '50-Zuege'; }
          else {
            // Am Limit keine blossen Bauern zaehlen: eigene, deutlich tiefere Referenzanalyse.
            const a = await e.analyse(c.fen(), { nodes: nodes * 5, multipv: 1 });
            const ev = a.lines[0].eval;
            const cp = ev.mate != null ? Math.sign(ev.mate) * 10000 : ev.cp;
            const whiteScore = cp > 300 ? 1 : cp < -300 ? 0 : .5;
            score = leftWhite ? whiteScore : 1 - whiteScore;
            reason = 'Limit-Referenz ' + cp;
          }
          await window.messung({ ...t, seed, leftWhite, score, reason, plies, styles, moves, seconds: Math.round((performance.now() - start) / 100) / 10 });
        }
      } finally { e.terminate(); }
    }
    await Promise.all(Array.from({ length: workers }, worker));
  }, { tasks: todo, workers, nodes, maxply });
  console.log('MESSUNG FERTIG');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
```


## Runde 2: Nachkalibrierung und Blindprobe (29.10.2026)

### Änderungen gegenüber der vorläufigen Fassung

Die zweite Runde verändert weiterhin ausschließlich `staerke`-Werte. Benno wurde durch mehr Rauschen und spontane Züge abgeschwächt, Paula zugleich durch weniger Rauschen und Patzer gestärkt. Damit wird der in Runde 1 gemessene Abstand von nur 6 Elo nicht bloß auf einer Seite der Grenze korrigiert. Bei den gebremsten Stockfish-Profilen entsprechen Keetan, Ragna und Silas nun wieder ihren angezeigten 2500, 2600 und 2700 UCI_Elo. Der unbegrenzte Stockfisch bleibt unverändert. Alva nutzt als letzte gebremste Gegnerin die vom eingebauten Stockfish angebotene Obergrenze UCI_Elo 3190; das macht den unvermeidlichen Sprung zum unbegrenzten Profil so klein wie mit der erlaubten Stärke-Konfiguration möglich.

| Übergang | Vor Runde 2 | Nach Runde 2 | Begründung |
| --- | ---: | ---: | --- |
| Benno/Paula | Modellabstand 6 Elo; direkt 50,8 % (64 Partien) | blind direkt 68,8 % für Paula (16 Partien), entsprechend 137 Elo | getrennte Profile statt statistischem Gleichstand |
| Johann/Keetan | Modellabstand 280 Elo; Keetan mit UCI_Elo 2600 | UCI-Regler 2400/2500, also 100 Elo Sollabstand | versehentliche Zusatzstufe entfernt |
| Keetan/Ragna/Silas | UCI_Elo 2600/2670/2770 | UCI_Elo 2500/2600/2700 | Anzeige und Bremse wieder deckungsgleich |
| Alva/Stockfisch | Modellabstand 586 Elo; Alva UCI_Elo 2970 | Alva UCI_Elo 3190; Stockfisch weiterhin unbegrenzt | kleinster technisch möglicher Sprung ohne Begrenzung des Endgegners |

Die Punktschätzung für Benno/Paula ist `400 log10(p/(1-p))` mit p = 11/16. Ein ungefähres 95-%-Wilson-Intervall für Paulas Quote ist 44,4 bis 85,8 %. Die Richtung und der gewünschte Abstand sind damit in der neuen Stichprobe sichtbar, aber bei nur 16 Partien noch nicht statistisch scharf bewiesen. Für die UCI-Profile bezeichnet „100 Elo Sollabstand“ die konfigurierte Stockfish-Bremse, nicht eine aus 16 Partien zurückgerechnete menschliche Wertung.

### Unabhängige Blindprobe

Die endgültigen Benno-/Paula-Werte wurden nach ihrer Festlegung nicht mehr anhand der folgenden Partien verändert. Der Lauf verwendete eine neue, zuvor nicht zur Abstimmung verwendete Zufallsfolge der vorhandenen Paarprüfung, beide Farben gleich oft und ein Zuglimit von 120 Halbzügen. Paula erzielte **11/16 Punkte (68,8 %, +11 =0 -5)**. Die stärkere Stufe liegt damit klar vorn und sehr nah an den nach der Elo-Formel für 100 Punkte erwarteten 64,0 %.

Der gesamte Aufruf meldete dennoch 62/63 Prüfungen: Die generische Sammelgrenze der Paarprüfung verlangt mindestens 70 % und wurde mit 68,8 % um einen halben Punkt verfehlt. Diese Grenze prüft im regulären Lauf wesentlich weiter auseinanderliegende Stufen und ist für ein einzelnes 100-Elo-Nachbarpaar strenger als das Eichziel. Die Prüfung wurde ausdrücklich **nicht** abgeschwächt. Der reguläre Testlauf mit seinen unveränderten Standardpaaren bleibt davon getrennt.

Für Johann/Keetan ist der unabhängige Beleg die unveränderte UCI-Schnittstelle selbst: Beide Profile verwenden `voll: true` und nun die benachbarten UCI_Elo-Werte 2400/2500. Für Alva/Stockfisch kann ein Abstand von 100 Elo nicht hergestellt werden: UCI_Elo endet laut Engine-Probe bei 3190, während Stockfisch laut Besitzerentscheidung ohne `elo`-Bremse bleibt. Die Runde verkleinert den Abstand deshalb maximal, behauptet aber keinen nicht messbaren 100-Elo-Abstand.

### Offen nach Runde 2

1. Die Blindprobe Benno/Paula bestätigt Richtung und Größenordnung, ihr breites Intervall schließt einen kleinen Abstand aber weiterhin ein. Eine Freigabemessung mit mindestens 64 neuen, protokollierten Seeds und mehreren Eröffnungen bleibt sinnvoll.
2. Die interne Zufallswahl von Stockfish mit `UCI_LimitStrength` ist nicht vollständig über den App-Seed steuerbar. Auch bei festem App-Seed sind UCI-Partien deshalb nicht bitgenau wiederholbar.
3. Alva/Stockfisch bleiben zwangsläufig weiter als 100 Elo auseinander. Das ist die direkte Folge aus maximaler UCI-Bremse 3190 und dem ausdrücklich unbegrenzten Endgegner, nicht ein noch abstimmbarer Profilfehler.
4. Die menschliche chess.com-Skala bleibt mangels Partien gegen passend gewertete Menschen offen. Runde 2 verbessert die interne Leiter; sie macht aus UCI_Elo keine menschliche Messung.

## Stand 30.10.2026 (Ultracode-Pruefung vor dem Live-Gang)

Uebernommen: Benno schwaecher, Keetan, Ragna und Silas mit UCI_Elo gleich der Anzeige. Zurueckgestellt, bis neu gemessen ist:
Paula (die neuen Werte machten sie so stark wie Gustav, die Leiter waere am Einstieg umgekehrt) und Alva (3190 statt der
Anzeige 2900 widerspricht "ehrliche Zahlen"; Flo entscheidet, ob Anzeige oder Staerke angepasst wird). Beide bleiben auf dem
bisherigen Live-Stand.

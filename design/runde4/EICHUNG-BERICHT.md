# Bot-Eichung: Messung, Anpassungen und Grenzen

Stand: 29.10.2026. Neue Messungen abgeschlossen am 28.10.; Auswertung und Uebergabe am 29.10. Auftrag #40, PR #50, Ausgang b0c8f5b auf main 115c610. Der historische Bericht vom 27.10. steht am Ende getrennt.

## Aktuelles Ergebnis

3.456 neue Partien: 2.400 Ausgangspartien, 352 Vergleichspartien mit dem festgelegten Kandidaten, danach 704 Pruefpartien mit neuer Zufallsbasis. Drei Engines pro Partie trennen die Gegner und die Abbruchanalyse. 16 eigene kurze Eroeffnungen, 20.000 Knoten pro Zug und 400 zusaetzliche Halbzuege. Keine fremden Spielerdaten oder Plattformpartien wurden abgerufen.

Uebernommen sind ausschliesslich drei weitere `staerke.elo`-Aenderungen gegenueber dem bisherigen PR-Stand:

| Bot | Bisheriger Parameter | Neuer Parameter | Angezeigte Zahl |
| --- | --- | --- | --- |
| Keetan | 2600 | 2500 | 2500 |
| Ragna | 2670 | 2600 | 2600 |
| Silas | 2770 | 2700 | 2700 |

Die staerke-Objekte aller anderen Bots bleiben identisch. Namen, Anzeigen, Welten, Texte und Engine sind unveraendert. **Stockfisch bleibt nach der Besitzerentscheidung vom 27.10. unbegrenzt.** Die Zahl 3000 ist keine gemessene Obergrenze. Die Frage nach einer Begrenzung ist entschieden.

Die neue unabhaengige Pruefung stuetzt die Richtung der Korrektur: Keetan erzielt gegen Johann 54,7 % statt 82,0 % Punkte, Ragna gegen Keetan 70,7 %, Silas gegen Ragna 70,3 %, Merle gegen Silas 62,1 %. 100 Elo entspraechen 64,0 %. Der grosse erste Sprung ist reduziert, aber die vier Abstaende sind noch nicht gleichmaessig. Im gesamten Endmodell sinkt Johann/Keetan von 272 auf 53 Vergleichspunkte; die Schaetzungen aller 30 Bots steigen weiterhin ohne Ordnungszwang. Einzelne Paarintervalle enthalten weiterhin null.

Das sind **Stockfish-UCI-Vergleichswerte**, keine nachgewiesenen menschlichen Elo und keine Zertifizierung durch chess.com. Der Besitzer hat Rapid/Schnellschach als menschliches Vergleichsziel gewaehlt; eine geeignete Menschenstichprobe fehlt weiterhin. Es wird keine feste UCI-/Lichess-/chess.com-Umrechnung behauptet. #40 bleibt deshalb offen.

## Alle 30 Bots: neue Ausgangsmessung und Enddatensatz

Wert [bedingtes 95-%-Intervall], N = Partien des jeweiligen Bots einschliesslich Nachbarn und Referenzen. Nachbarpartien zaehlen fuer beide Bots. Intervalle enthalten keine Unsicherheit der UCI-Skala oder Uebertragung auf Menschen und sind nicht fuer Mehrfachvergleiche korrigiert.

| Stufe | Bot | Anzeige | Ausgang [95 %] | N | Final [95 %] | N |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Vogelscheuche Fridolin | 100 | 472 [152; 793] | 64 | 472 [152; 793] | 64 |
| 2 | Bauer Benno | 200 | 527 [218; 836] | 128 | 527 [218; 836] | 128 |
| 3 | Postbotin Paula | 300 | 577 [280; 873] | 128 | 577 [280; 873] | 128 |
| 4 | Imker Gustav | 400 | 666 [382; 950] | 128 | 666 [382; 950] | 128 |
| 5 | Oma Hilde | 500 | 710 [439; 981] | 128 | 710 [439; 981] | 128 |
| 6 | Janine vom Scheunenclub | 600 | 788 [530; 1046] | 128 | 788 [530; 1046] | 128 |
| 7 | Holzfäller Bodo | 700 | 872 [629; 1115] | 128 | 872 [629; 1115] | 128 |
| 8 | Kalle vom Stammtisch | 800 | 961 [734; 1189] | 128 | 961 [734; 1189] | 128 |
| 9 | Waldläufer Leo | 900 | 1051 [841; 1262] | 128 | 1051 [841; 1262] | 128 |
| 10 | Lisa Läufer | 1000 | 1183 [992; 1374] | 128 | 1183 [992; 1374] | 128 |
| 11 | Köhlerin Edda | 1100 | 1206 [1034; 1377] | 128 | 1206 [1034; 1377] | 128 |
| 12 | Ritter Rudi | 1200 | 1290 [1142; 1438] | 128 | 1290 [1142; 1438] | 128 |
| 13 | Luke vom Marktplatz | 1300 | 1352 [1230; 1473] | 128 | 1352 [1230; 1473] | 128 |
| 14 | Professor Turm | 1400 | 1419 [1333; 1505] | 160 | 1419 [1333; 1505] | 160 |
| 15 | Zauberer Moritz | 1500 | 1513 [1439; 1587] | 160 | 1513 [1439; 1587] | 160 |
| 16 | Dame Delia | 1600 | 1597 [1525; 1668] | 160 | 1597 [1525; 1668] | 160 |
| 17 | Bibliothekarin Ottilie | 1700 | 1667 [1596; 1738] | 160 | 1668 [1597; 1738] | 160 |
| 18 | Kommissar König | 1800 | 1693 [1622; 1765] | 160 | 1694 [1622; 1766] | 160 |
| 19 | Fischer Lasse | 1900 | 1814 [1741; 1886] | 160 | 1815 [1743; 1887] | 160 |
| 20 | Hafenmeisterin Wiebke | 2000 | 1899 [1827; 1972] | 160 | 1901 [1829; 1974] | 160 |
| 21 | Großmeisterin Greta | 2100 | 1962 [1888; 2036] | 160 | 1966 [1893; 2040] | 160 |
| 22 | Wattführer Henning | 2200 | 2149 [2076; 2222] | 160 | 2158 [2086; 2230] | 160 |
| 23 | Seenotretterin Ilka | 2300 | 2174 [2100; 2248] | 160 | 2192 [2120; 2263] | 160 |
| 24 | Johann vom Leuchtturm | 2400 | 2348 [2272; 2424] | 160 | 2386 [2324; 2449] | 224 |
| 25 | Taucher Keetan | 2500 | 2620 [2544; 2697] | 160 | 2439 [2385; 2493] | 320 |
| 26 | Lotsin Ragna | 2600 | 2742 [2667; 2816] | 160 | 2580 [2527; 2632] | 320 |
| 27 | Schatzsucher Silas | 2700 | 2807 [2734; 2881] | 160 | 2711 [2657; 2766] | 320 |
| 28 | Forscherin Merle | 2800 | 2893 [2818; 2969] | 160 | 2834 [2770; 2899] | 224 |
| 29 | Hüterin Alva | 2900 | 2931 [2846; 3017] | 160 | 2892 [2811; 2974] | 160 |
| 30 | Der Stockfisch | 3000 | 3743 [3403; 4082] | 96 | 3722 [3383; 4060] | 96 |

Final sind es 2.752 Partien: 2.048 unveraenderte Ausgangspartien plus alle 704 neuen Pruefpartien. Die 352 ersten Kandidatenpartien sind getrennt und nicht Teil der Endtabelle. Die alte Messung vom 26./27.10. ist ebenfalls nicht enthalten. Allein durch neue Randmessungen koennen sich auch Schaetzungen unveraenderter Bots im gemeinsamen Modell verschieben.

Stockfisch gewinnt 63 der 64 Partien gegen Alva bei einem Remis. Seine hohe Schaetzung und deren Intervall sind bei fast perfektem Ergebnis stark modell-/priorabhaengig; daraus folgt keine genaue menschliche Spielstaerke.

## Nachbarpaare im Enddatensatz

Aus Sicht der hoeheren Stufe: Sieg + halbes Remis ergibt die Punktequote. Modellabstaende nutzen auch die Referenzpartien und muessen nicht der isolierten Paarquote entsprechen.

| Stufen | N | +S =R -N | Punkte | Modellabstand [95 %] |
| --- | --- | --- | --- | --- |
| 1/2 | 64 | +11 =52 -1 | 57.8 % | 55 [-31; 141] |
| 2/3 | 64 | +9 =55 -0 | 57.0 % | 50 [-36; 135] |
| 3/4 | 64 | +20 =40 -4 | 62.5 % | 89 [1; 177] |
| 4/5 | 64 | +17 =38 -9 | 56.2 % | 44 [-41; 130] |
| 5/6 | 64 | +23 =32 -9 | 60.9 % | 78 [-9; 165] |
| 6/7 | 64 | +30 =19 -15 | 61.7 % | 84 [-4; 171] |
| 7/8 | 64 | +30 =20 -14 | 62.5 % | 90 [2; 177] |
| 8/9 | 64 | +30 =20 -14 | 62.5 % | 90 [2; 178] |
| 9/10 | 64 | +37 =13 -14 | 68.0 % | 132 [41; 223] |
| 10/11 | 64 | +30 =8 -26 | 53.1 % | 23 [-62; 108] |
| 11/12 | 64 | +37 =5 -22 | 61.7 % | 84 [-3; 172] |
| 12/13 | 64 | +35 =5 -24 | 58.6 % | 62 [-25; 148] |
| 13/14 | 64 | +37 =2 -25 | 59.4 % | 67 [-19; 154] |
| 14/15 | 64 | +36 =6 -22 | 60.9 % | 94 [19; 170] |
| 15/16 | 64 | +31 =12 -21 | 57.8 % | 84 [12; 156] |
| 16/17 | 64 | +29 =10 -25 | 53.1 % | 71 [-0; 142] |
| 17/18 | 64 | +29 =3 -32 | 47.7 % | 26 [-44; 97] |
| 18/19 | 64 | +34 =6 -24 | 57.8 % | 121 [48; 194] |
| 19/20 | 64 | +35 =4 -25 | 57.8 % | 87 [15; 159] |
| 20/21 | 64 | +30 =6 -28 | 51.6 % | 65 [-10; 140] |
| 21/22 | 64 | +43 =3 -18 | 69.5 % | 191 [111; 272] |
| 22/23 | 64 | +30 =9 -25 | 53.9 % | 34 [-40; 107] |
| 23/24 | 64 | +42 =8 -14 | 71.9 % | 195 [120; 269] |
| 24/25 | 128 | +59 =22 -47 | 54.7 % | 53 [-0; 106] |
| 25/26 | 128 | +79 =23 -26 | 70.7 % | 141 [87; 194] |
| 26/27 | 128 | +77 =26 -25 | 70.3 % | 132 [79; 185] |
| 27/28 | 128 | +61 =37 -30 | 62.1 % | 123 [67; 178] |
| 28/29 | 64 | +24 =21 -19 | 53.9 % | 58 [-15; 131] |
| 29/30 | 64 | +63 =1 -0 | 99.2 % | 829 [491; 1167] |

## Getrennte Kandidaten- und Pruefauswertung

Hier sind nur Stufen 24 bis 28 gemessen. Andere Werte aus einem isolierten Fit haetten keine Partien und werden nicht als Messwerte ausgegeben. Die Randbots 24 und 28 haben hier keine eigenen Anker; deshalb weichen diese Werte vom vollstaendigen Modell ab.

| Stufe | Kandidat [95 %] | N | Neue Zufallsbasis [95 %] | N |
| --- | --- | --- | --- | --- |
| 24 | 2408 [2284; 2532] | 64 | 2416 [2328; 2503] | 128 |
| 25 | 2414 [2323; 2504] | 160 | 2448 [2385; 2511] | 320 |
| 26 | 2540 [2458; 2621] | 160 | 2572 [2515; 2628] | 320 |
| 27 | 2714 [2624; 2804] | 160 | 2682 [2619; 2744] | 320 |
| 28 | 2809 [2683; 2935] | 64 | 2768 [2680; 2856] | 128 |

Die drei Parameter waren vor beiden Laeufen festgelegt und wurden nach Sichtung der Pruefdaten nicht weiter angepasst. Die neue Zufallsbasis ist unabhaengig von der vorherigen eigenen Zugzufallsfolge; dieselben 16 Eroeffnungen und dieselbe Engine bleiben erhalten. Es ist kein Blindversuch gegen einen neuen Menschenpool und kein unabhaengiger Test aller 30 Bots.

## Methode und Wiederverwendung

- Echte `botZug`-Logik mit `ohnePause:true`, 20.000 Knoten, Profil-Suchtiefen weiter wirksam. Keine menschliche Schachuhr. Chromium 154.0.8037.57, Node 24.19.0, drei gleichzeitig laufende Partien, je eigene Engine fuer jeden Gegner und eine dritte fuer die Abbruchanalyse. Vor jeder Partie `newGame()` fuer alle drei Engines.
- Eigene Eroeffnungen stehen vollstaendig im Messskript. Farbpaare nutzen dieselbe Stellung und dieselbe eigene Saat. Seedbasis 2026102801 fuer Ausgang/Kandidat, 2026102802 fuer die Pruefung. `seed=(seedBase+a*65537+floor(i/2)*104729)>>>0`.
- Stockfishs interner Zufall bei `UCI_LimitStrength` ist damit weiterhin nicht gesetzt. Neue Laeufe koennen andere Resultate liefern. Die gewaehlte Saat wird nicht als bitgenaue Reproduzierbarkeit des Workers ausgegeben.
- Anker fuer Stufen 14 bis 30: Stockfish-UCI_Elo gleich Stufe mal 100 bei gleichem Knotenbudget. Unter 1320 begrenzt die Engine den Parameter; es werden keine erfundenen direkten Anker fuer die unteren 13 Bots verwendet.
- Reale Spielenden durch chess.js. Nach 400 zusaetzlichen Halbzuegen: separate Analyse mit 100.000 Knoten; Weiss gewinnt nur ueber +300 cp, Schwarz unter -300 cp, sonst Remis. Das ist eine Abbruchwertung, kein ausgespieltes Matt.
- 30 freie Parameter, logistische Elo-Pseudo-Likelihood mit Remis als 0,5. Schwacher Normalprior um die Anzeige, SD 2000, gegen unendliche Schaetzungen; keine Monotoniebedingung. Standardfehler aus inverser Hesse-Matrix und Sandwich-Schaetzung; Cluster `(a,seedBase,floor(i/2))` fasst Farbpaare und gleich gesaete Nachbar-/Ankerpartien zusammen. Je Wert/Differenz wird der groessere Standardfehler benutzt.
- Wiederverwendung nur nach vollstaendigem Objektvergleich beider Bot-Profile, einschliesslich aller staerke-Felder. Nur Stufen 25,26,27 unterscheiden sich, ausschliesslich in `staerke.elo`. Ausgeschlossen werden vier Paare (24/25 bis 27/28) mit je 64 Partien und drei Anker (25,26,27) mit je 32 Partien: 2400-256-96=2048. Methode, Engine, Knotenzahl und Zuglimit stimmen ueberein; alle 704 neuen Pruefpartien kommen hinzu. Urspruengliche Quellenhashes bleiben erhalten.

### Spielenden und Datenpruefung

Alle 3.456 neuen Partien wurden mit chess.js Zug fuer Zug nachgespielt. Schlussstellung, Farbzuordnung, Ergebnis, Halbzugzahl und eindeutige IDs wurden geprueft. Alle Serien sind vollstaendig und farbgleich verteilt. Die Analyseproben und CI-Testpartien zaehlen nicht zu diesen Daten.

| Datensatz | Partien | Endgruende |
| --- | --- | --- |
| v2-ausgang | 2400 | 50-Zuege: 53, Limit-Referenz: 1, Material: 316, Matt: 1864, Patt: 26, Wiederholung: 140 |
| v2-kandidat | 352 | 50-Zuege: 19, Limit-Referenz: 1, Material: 18, Matt: 278, Wiederholung: 36 |
| v2-blind | 704 | 50-Zuege: 31, Limit-Referenz: 2, Material: 20, Matt: 562, Patt: 3, Wiederholung: 86 |
| v2-final | 2752 | 50-Zuege: 65, Limit-Referenz: 2, Material: 315, Matt: 2160, Patt: 27, Wiederholung: 183 |

## Tests auf dem neuen Profilstand

- Service Worker automatisch aktualisiert (Version 86); anschliessend **42/42 bestanden**.
- Vollstaendiger bestehender Engine-Test mit `--anker --ankerpartien=8 --parallel=2`: **64/66 bestanden in 522 s**. Zwei Fehler in der unveraenderten Zufallsprobe: Stufe 21 gegen 16 nur 1/6 Punkte und Gesamtsumme 15/24 (63 % statt mindestens 70 %). Diese Profile wurden in dieser Fortsetzung nicht geaendert. Die Auswertung des Kontrolllaufs auf dem bisherigen Commitstand steht im PR-Text; dieser fehlgeschlagene Lauf bleibt dokumentiert.
- Vollstaendige Chromium-/WebKit-CI: Ergebnis auf dem neuen Commit steht im PR-Text; fruehere gruene Runs gelten nicht automatisch fuer diesen Stand.
- Vollstaendiger Profilvergleich: nur die drei genannten Parameter geaendert. Keine Test-Assertions geaendert, entfernt oder uebersprungen.

## Was noch offen ist

1. **Menschliche Rapid-Eichung:** Referenzpool, festgelegte Bedenkzeit und geeignete freiwillige Testpartien direkt in Crownmate fehlen. 15+10 ist ein moegliches Protokoll, keine bereits durchgefuehrte Messung. Kein Scraping fremder Partien/Profile, kein automatisiertes Spielen auf fremden Plattformen und keine Behauptung einer Partnerschaft. Keine personenbezogenen Teilnehmerdaten gehoeren ins oeffentliche Repo.
2. **Gleichmaessige Abstaende:** Besonders Lisa/Edda, Ottilie/Koenig und Henning/Ilka bleiben eng oder unsicher; die unteren 13 absoluten Werte haben die Unsicherheit einer langen Vergleichskette. Mehr Kreuzvergleiche und menschliche Anker sind sinnvoller als weiteres Abstimmen derselben Stichprobe. Auch Johann/Keetan ist jetzt eher eng. 100 Elo pro Schritt sind noch nicht belegt.
3. **Geraete-/Zeitgrenzen:** Normale App-Partien verwenden teilweise Millisekunden statt fixer Knoten. Die Messung auf einem echten iPad unter den App-Zeitlimits fehlt. Die UCI-Skala und deren systematische Abweichung werden von den angegebenen Intervallen nicht abgedeckt.
4. **Spieler-Elo-Schaetzung:** Die Anzeige nach einer menschlichen Partie in `review.js` ist ein gesonderter offener Auftrag. Diese Aenderung validiert sie nicht.
5. **Wiedergefundene Altdaten:** Der Sicherungszweig enthaelt inzwischen gefundene [Messdaten vom alten Zehner-System](https://github.com/floboldt007-cmyk/schach/blob/ae9f931c113f925936eb91da046f02214fd8599b/arbeitsstand/eichung/messung/BERICHT.md). Der bisherige Hinweis auf im Basisstand fehlende Dateien ist deshalb kein allgemeiner Verlust dieser Daten. Sie betreffen Lichess-Rapid und die alte Leiter, nicht die aktuelle 30er-Leiter oder den gewaehlten menschlichen Rapid-Vergleich.

## Nachvollziehbarkeit der neuen Messung

Alle Ergebnisfolgen stehen unten: `w` Sieg des linken Bots a, `d` Remis, `l` Niederlage. Pro Serie i aufsteigend ab 0; gerade i spielt a Weiss. `paar a` = a gegen a+1, `anker a` = a gegen UCI_Elo a*100. Das Exportskript rekonstruiert die vollstaendige numerische Auswertung ohne private Dateien. Es rekonstruiert keine Zugprotokolle; deren lokale JSONL-Dateien enthalten zusaetzlich alle Zuege/Endstellungen und sind durch folgende Pruefsummen identifiziert.

| Datei | SHA-256 |
| --- | --- |
| v2-ausgang.jsonl | `a1e22fdbfc738034e6f1c777fbf8e9e560e0e459bd0beeb4c79271fc162aa87d` |
| v2-kandidat.jsonl | `60ba11f48cf54723db5f4aa58246bc08c038e71c496177de7524438cef04e5f6` |
| v2-blind.jsonl | `157825243cd85c27213390ef8229542730daae66605d913141f4192f3662c18f` |
| v2-final.jsonl | `59bc2673ee066c23e5f504ea50903d1c2b114bb0366790349f7f95dbf7fb7933` |
| bots-27-10.js | `24735af8cbafcd3d14b10c17f3e2ba8e5a8c248946b0443041524e0421739afa` |
| bots-kandidat.js | `6d4f93a1e27d861cbacaef524c73bce771ae68961b23a66cf4de1f34c3666162` |
| js/engine.js (beide Profile) | `6a705b1bae74934ae17558bef5f551a2ca6effe23be8aee10c5e4c9c26c40578` |
| js/tag.js (beide Profile) | `4b737a85b954da59c207147b9e506f33afeb496ed052dda3d1dc4dcfabc86264` |
| vendor/chess/chess.js (beide Profile) | `76c7c34f0e2e9ab076521a5d6fe786a9cce537bb1b6f29d32a9c9970b5b232d2` |
| vendor/stockfish/stockfish-19-lite-single.js (beide Profile) | `ccb130d7ff29408531c47d859a49f91d59d4f482d05a53eb1a3231a4f624c91a` |
| vendor/stockfish/stockfish-19-lite-single.wasm (beide Profile) | `ee4f115bdb2d32cadf96cada104a05b5ec257d7ad6f57582190b49bc71f096de` |

<details>
<summary>Ergebnisfolgen v2-ausgang</summary>

<!-- v2-ausgang-start -->
```text
anker 14 wllwlddwlllwwlwlwlwwllwlldwwwllw
anker 15 wwlwlwwlwllwwwllllwllldwlwllwwlw
anker 16 lldwldwwwdwwwlwlwdllllwllwdlldll
anker 17 wwldllwwwllwlllwlwwwwdlwllwlwlll
anker 18 lwllwllllwlwllwlwwlwllllldlwllll
anker 19 dllwwwlllwllllwlwwwlwwllwdlwwllw
anker 20 llwwlllllwllwlwwdlllwlllddlllllw
anker 21 lwlllwllwlwlwllwlwllwllwllllwwld
anker 22 dwwdwwlwlwlllwwldwwwddlwllldwlwl
anker 23 wlwwllwllllwlllllwllllllddwllwld
anker 24 lwdlwlwwwllllwlwlwllwdllwdwdllwl
anker 25 wwwlwlwdwdwlldlwwwwwwwwlwwlddwdw
anker 26 lwdwwdwwwdwwwwwwwwwwwwdlwwwwlldl
anker 27 dwlldlwldwdldwwdwwwdlldlwddldwlw
anker 28 wlwlwwdldlddwdwwlwwwwlwwwdlwwwdd
anker 29 llwldddwwdldlwlwwlwdwlddwdwwdwwd
anker 30 wwdwwwwwwwwwwwwwwwwwwwwwwwwwwwww
paar 1 ddlddddddldddddddddlddldddddddldddddddlldldddddddddwdldddldddldd
paar 2 lddddddddlddddlddddddllddddddldddddddddddlddldddddlddddddddddddd
paar 3 dldddddlldddldwdddwlllwddldddddllldlddddddddddddldlllddwlldldldd
paar 4 dldwldwllddwdddldddlldlldwdddddddlwldddlldldwdddldwdddwdddddldlw
paar 5 dlldllllwlddddldddlwwllddddlldwdddddldlddlddldlwlddlwdldddlwlwdw
paar 6 wwldllwwdwllllllwwllddldlllwldldldldldlwldlllwddllwldddwlldwwwdd
paar 7 lllwdddwdllddwdllwlldwlldlwdldlllddlwlwdldwlldwddlldwldwlllwlwll
paar 8 dldwlldlddwdwldldlllwwldwlldlldddlwllwwdlwdddlllldlwllwdlwdllllw
paar 9 lwwdlwlllllllwllwlwlldlwlldwllllwwlddldlwldlldllldldllwlwlddwldl
paar 10 wwllwlddlwlwllllwwldlwlwddwwlwwlwwwwldllllwwlwlwdllllwlwwlwllwdl
paar 11 wwwlwdldwlllwwlwlllwlllwwllwlldlwldlwlwllwlwldlwlwwlwlllwlllllll
paar 12 ldwllwwlldldldwwldllwlwllwllwwwlllllllwwwwwlwlllwllllwwlllwlwwlw
paar 13 lwwllwdlwlllllwdlwlllwwllwwllwlwlwlwwllllwwwlllwlwllwllwwwlllllw
paar 14 lldwlwlwlwlwllldwllllwlwwlwwllwllwdlllwwwdlwlllldwwldlllllwlwlwl
paar 15 dwlldllwlwdllwlwwldldldlwlllwlwlddwwwwlllwwlldlwdllwlllwdlwldwlw
paar 16 lwlwllwwlwdlwwwllwlwdldlwddldwllllwwdwlwlwwlwllwddldwwwwlllwllll
paar 17 wllwldlwlwwllllwldllwwwwwlwwlllwwllwldlwwwwlwwlwwlwwwwlwwllllwlw
paar 18 wlwlwdlllwlwwwwllwwllllwldwwlldldlwlwlllllwllwwwlwldwllllwlwlwld
paar 19 lllwlwlllllllwdwlllwlwlwlwwlwlllwwwlwlldlwwwldwllwlwlwwldlwllwlw
paar 20 wwwwlwlllwllwllwlwllwwwwwlwdldwwwdwwlwllllwlwddwlldlllwllwwllllw
paar 21 lllwlwllwlllllllwllllllwllwwlwllwllwlllwwwlwddlwllllllllwwlllldw
paar 22 wwwwwlwwllwldlwwllllwwllddllwwlllddldwwwlllwldwwdllllwwdlllwwlwl
paar 23 lllllddlwlwlllllwwlllwllllllddwwlwldddllwllllllllwlwllwwwlldllll
paar 24 llllllwldlwwlllllllwllllllllllddllllllldlllwllwwwlldlldllldlllll
paar 25 ldllwwdwldldddwlwlldllddllllwlwlwllldlwlllwlllwddddllddlwllllwll
paar 26 lwldwdllddldwldlddwllldwwlwdllddwdllwldwllllllwwldlwwlllddlldldl
paar 27 wwllldddlddlldllllwdddlddddlldllwlwllwlddlwdwdldllwwwlwllwdwwddl
paar 28 dldlwdldldwldwdwlwldlddwdwlwllddlwwwllwwlldldwldwlwdwdlddlllwlwd
paar 29 lllllllllllllllllllllllllllllllllllllllllllllllllllllllllldlllll
```
<!-- v2-ausgang-ende -->

</details>

<details>
<summary>Ergebnisfolgen v2-kandidat</summary>

<!-- v2-kandidat-start -->
```text
anker 25 lwlwlllllwllwldldwlwwdldllwwddll
anker 26 lwllwlwlldldlwllldlwwwdllwlwwlwl
anker 27 dldwdddllwwldldwwlddwwldwldlwwwd
paar 24 wwllldlllllwwlwwdwwllwllwwddwwdwlwllwllldlldwlwldwwwwlwwdwwlwlll
paar 25 lllllllldwlldldlwdllldllwlwldldlwlllwdldwlwldlldddwldwlldwwldlwl
paar 26 lldddllllwwllldllldlllllllwlwlllwwlldlllllllwldlwdldlwlwwldwdlll
paar 27 dlllldwwldlwdwlwdddlllddwlllddlllwlldlwdlllldlwwlllwwllllwllwwwd
```
<!-- v2-kandidat-ende -->

</details>

<details>
<summary>Ergebnisfolgen v2-blind</summary>

<!-- v2-blind-start -->
```text
anker 25 lwlwwldldlwwllllwllwlwwldllwwdwwwlwwwwwwllddllwwwdwlwlwlllwllldw
anker 26 wwwdwlllwdlldwwwlldwwldlwddlllwwlwdlldlldwdlwlwlwlllwwllwdwwdwld
anker 27 ldwwwlllllllllwlwwdlwwlwwlwldldddwllllldwldldllwllwwllwdwllllddl
paar 24 wlldwlwlwwllwllwlwlwwwwdllwldlldlllldlwwlldwwwwwwwwdllllllwldlwlllwllwwldlldwllwllwwlwwwdldlwwdlwddwwllwlldlwdwwdwdllllldldllwdw
paar 25 ddlldlllwllldlllwllwldwwlwwllwlllwwwllldlllllldllwllddlllwwwwddlldllwldldldldwllllllwllldwllwldllllwdllwllllwllwdlwllddllldlllll
paar 26 lwlwlldlwdllldwlllllwllwwlwdddwllllddllllwlllllwllllwdlllwdlwllllwdllldwllwlwlldlllddwwdwldlldllwldllwwllllddddldldlldlllllwllll
paar 27 llldwlldwldlwldwlwlllllldlllwwldldwldllllwwldddddllldldlllwlddlddlllwlddllwdwdllwwwdlwwdldllwlwlwlwddldldldlwwldlddlwdwlwlwlddlw
```
<!-- v2-blind-ende -->

</details>

### Ergebnisfolgen exportieren und nachrechnen

Code als `export-v2.py` speichern, mit Python 3 ausfuehren; danach `auswertung-v2.py` aus dem naechsten Block speichern (braucht NumPy und SciPy).

```python
import re, json, sys
from pathlib import Path
report=Path(sys.argv[1]).read_text()
allrows={}
hashes={'ausgang':'24735af8cbafcd3d14b10c17f3e2ba8e5a8c248946b0443041524e0421739afa','kandidat':'6d4f93a1e27d861cbacaef524c73bce771ae68961b23a66cf4de1f34c3666162','blind':'6d4f93a1e27d861cbacaef524c73bce771ae68961b23a66cf4de1f34c3666162'}
for name,n in [('ausgang',2400),('kandidat',352),('blind',704)]:
    block=report.split('<!-- v2-'+name+'-start -->')[1].split('<!-- v2-'+name+'-ende -->')[0]
    rows=[]
    for kind,a,seq in re.findall(r'^(paar|anker) (\d+) ([wdl]+)$',block,re.M):
        a=int(a)
        for i,s in enumerate(seq):
            r={'a':a,'i':i,'score':{'w':1,'d':.5,'l':0}[s],'seedBase':2026102802 if name=='blind' else 2026102801,'hash':hashes[name],'reason':'NichtImKompaktexport'}
            r.update({'b':a+1} if kind=='paar' else {'elo':a*100})
            rows.append(r)
    assert len(rows)==n
    allrows[name]=rows
allrows['final']=[r for r in allrows['ausgang'] if r['a'] not in (25,26,27) and r.get('b') not in (25,26,27)]+allrows['blind']
assert len(allrows['final'])==2752
for name,rows in allrows.items():
    Path('export-v2-'+name+'.jsonl').write_text(''.join(json.dumps(r)+'\n' for r in rows))
```

```sh
python3 export-v2.py design/runde4/EICHUNG-BERICHT.md
python3 auswertung-v2.py export-v2-final.jsonl export-v2-final-fit.json
```

<details>
<summary>Vollstaendiger Auswertungscode</summary>

```python
import json, sys, math
import numpy as np
from scipy.optimize import minimize
from scipy.special import expit
from collections import defaultdict
rows=[json.loads(x) for x in open(sys.argv[1]) if x.strip()]
source=sys.argv[1]
hashes=set(r['hash'] for r in rows)
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
for n,r in enumerate(rows):clusters[(r['a'],r.get('seedBase',0),r['i']//2)]+=X[n]*(y[n]-p[n])
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

</details>

### Neue Partien erzeugen

Den folgenden Code als `eichung-v2.mjs` ausserhalb der App speichern, Playwright/Chromium installieren oder `PLAYWRIGHT_PFAD` auf eine vorhandene Installation setzen. `--root` verweist auf diesen Repo-Stand. Um den alten Ausgang erneut zu messen, `js/bots.js` aus Commit b0c8f5b separat als `bots-27-10.js` speichern und per `--bots-file` laden. Ergebnisse verschiedener Profilstaende nie in dieselbe Datei schreiben.

```sh
node eichung-v2.mjs --root=/pfad/zum/repo --bots-file=/pfad/bots-27-10.js --out=v2-ausgang.jsonl --games=64 --anchors=32 --anchor-stages=14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30 --workers=3 --seed=2026102801
node eichung-v2.mjs --root=/pfad/zum/repo --out=v2-kandidat.jsonl --pairs=24-25,25-26,26-27,27-28 --games=64 --anchors=32 --anchor-stages=25,26,27 --workers=3 --seed=2026102801
node eichung-v2.mjs --root=/pfad/zum/repo --out=v2-blind.jsonl --pairs=24-25,25-26,26-27,27-28 --games=128 --anchors=64 --anchor-stages=25,26,27 --workers=3 --seed=2026102802
```

<details>
<summary>Vollstaendiger Messcode (getrennte Engines)</summary>

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
const maxply = Number(arg('maxply', 400));
const seedBase = Number(arg('seed', 2026102801));
const timed = arg('timed', 'false') === 'true';
const pairs = arg('pairs', '').split(',').filter(Boolean).map(x => x.split('-').map(Number));
const anchorStages = new Set(arg('anchor-stages', '').split(',').filter(Boolean).map(Number));
const method = 'getrennte-engines-v2';
const botsFile = arg('bots-file', path.join(root, 'js/bots.js'));
const hash = createHash('sha256').update(readFileSync(botsFile)).digest('hex');
const previous = existsSync(out) ? readFileSync(out, 'utf8').trim().split('\n').filter(Boolean).map(s => JSON.parse(s)) : [];
const registryFile = arg('profiles', null);
const registry = registryFile ? JSON.parse(readFileSync(registryFile, 'utf8')) : null;
function valid(row) {
  if (row.method !== method || row.seedBase !== seedBase || row.timed !== timed || row.nodes !== nodes || row.maxply !== maxply) return false;
  if (!registry) return row.hash === hash;
  const old = registry[row.hash], current = registry[hash];
  return !!old && !!current && old[row.a] === current[row.a] && (!row.b || old[row.b] === current[row.b]);
}
if (previous.some(x => !valid(x))) throw Error('Messdatei enthaelt andere Profile oder Suchgrenzen');
const done = new Set(previous.map(x => x.key));
const tasks = [];
// Gleiche Saat und Eroeffnung fuer ein Farbwechsel-Paar; unabhaengige Saetze je Paar.
for (const [a,b] of pairs.length ? pairs : Array.from({length:29},(_,i)=>[i+1,i+2])) for (let i=0;i<games;i++) tasks.push({key:`paar-${a}-${b}-${i}`,a,b,i});
for (let a = 14; a <= 30; a++) if (anchorStages.has(a)) for (let i = 0; i < (a >= 22 ? upperAnchors : anchorGames); i++) tasks.push({ key: `anker-${a}-${i}`, a, elo: a * 100, i });
// Zuerst je ein Farbwechsel-Paar aller Stufen, dann die naechste Runde.
tasks.sort((a, b) => Math.floor(a.i / 2) - Math.floor(b.i / 2) || a.a - b.a || a.key.localeCompare(b.key));
const focus = new Set(arg('focus', '').split(',').filter(Boolean).map(Number));
if (focus.size) tasks.sort((a,b) => Number(!focus.has(a.a)) - Number(!focus.has(b.a)) || Math.floor(a.i/2)-Math.floor(b.i/2) || a.a-b.a || a.key.localeCompare(b.key));
const todo = tasks.filter(t => !done.has(t.key));
for(const t of todo) if(!Number.isInteger(t.a)||t.a<1||t.a>30||(t.b&&(!Number.isInteger(t.b)||t.b<1||t.b>30))) throw Error('Ungueltige Stufe');
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
    appendFileSync(out, JSON.stringify({ method, seedBase, timed, hash, nodes, maxply, ...row }) + '\n');
    console.log(`${row.key}: ${row.score} (${row.reason}, ${row.plies} Halbzuege, ${row.seconds}s)`);
  });
  await page.goto(`http://127.0.0.1:${port}/`);
  console.log(JSON.stringify({ method, seedBase, timed, hash, games, anchorGames, upperAnchors, workers, nodes, maxply, remaining: todo.length }));
  const heartbeat = setInterval(() => console.log('MESSUNG LAEUFT ' + new Date().toISOString()), 30000);
  try { await page.evaluate(async ({ tasks, workers, nodes, maxply, seedBase, timed }) => {
    const { Engine } = await import('/js/engine.js');
    const { BOTS, botZug } = await import('/js/bots.js');
    const { Chess } = await import('/vendor/chess/chess.js');
    const { zugZufall } = await import('/js/tag.js');
    // Eigene kurze Eroeffnungen; beide Farben eines Paares erhalten dieselbe Stellung.
    const openings = [[], ['e2e4','e7e5'], ['d2d4','d7d5'], ['c2c4','e7e5'], ['g1f3','d7d5'], ['e2e4','c7c5'], ['d2d4','g8f6'], ['e2e4','e7e6'], ['e2e4','c7c6','d2d4','d7d5'], ['e2e4','e7e5','g1f3','b8c6','f1c4','g8f6'], ['d2d4','d7d5','c2c4','e7e6'], ['g1f3','g8f6','g2g3','d7d5'], ['c2c4','c7c5','g1f3','b8c6'], ['d2d4','g8f6','c2c4','g7g6'], ['e2e4','e7e5','g1f3','g8f6'], ['e2e4','e7e5','g1f3','b8c6','f1b5','a7a6']];
    let next = 0;
    async function worker() {
      const es = [new Engine(), new Engine(), new Engine()];
      await Promise.all(es.map(e => e.init()));
      try {
        while (next < tasks.length) {
          const t = tasks[next++], start = performance.now();
          const pair = Math.floor(t.i / 2), seed = (seedBase + t.a * 65537 + pair * 104729) >>> 0;
          const c = new Chess();
          for (const u of openings[pair % openings.length]) c.move({ from: u.slice(0,2), to: u.slice(2,4) });
          await Promise.all(es.map(e => e.newGame()));
          const left = BOTS[t.a - 1];
          const right = t.b ? BOTS[t.b - 1] : { id: 'anker', elo: t.elo, staerke: { voll: true, elo: t.elo, movetime: 200 } };
          const leftWhite = t.i % 2 === 0;
          let plies = 0;
          const styles = {}, moves = [];
          let reason, score;
          while (plies < maxply && !c.isGameOver()) {
            const isLeft = (c.turn() === 'w') === leftWhite;
            const bot = isLeft ? left : right;
            const r = await botZug(es[isLeft ? 0 : 1], c.fen(), bot, { ohnePause: true, nodes: timed ? null : nodes, zugNummer: c.history().length, zufall: zugZufall(seed, c.history().length) });
            const m = c.move({ from: r.uci.slice(0,2), to: r.uci.slice(2,4), promotion: r.uci[4] });
            const stats = styles[bot.id] ??= { moves: 0, captures: 0, checks: 0 };
            stats.moves++; if (m.captured) stats.captures++; if (/[+#]/.test(m.san)) stats.checks++;
            moves.push(r.uci); plies++;
          }
          if (c.isCheckmate()) { score = ((c.turn() === 'w') !== leftWhite) ? 1 : 0; reason = 'Matt'; }
          else if (c.isGameOver()) { score = .5; reason = c.isStalemate() ? 'Patt' : c.isThreefoldRepetition() ? 'Wiederholung' : c.isInsufficientMaterial() ? 'Material' : '50-Zuege'; }
          else {
            // Am Limit keine blossen Bauern zaehlen: eigene, deutlich tiefere Referenzanalyse.
            const a = await es[2].analyse(c.fen(), { nodes: nodes * 5, multipv: 1 });
            const ev = a.lines[0].eval;
            const cp = ev.mate != null ? Math.sign(ev.mate) * 10000 : ev.cp;
            const whiteScore = cp > 300 ? 1 : cp < -300 ? 0 : .5;
            score = leftWhite ? whiteScore : 1 - whiteScore;
            reason = 'Limit-Referenz ' + cp;
          }
          await window.messung({ ...t, seed, opening: openings[pair % openings.length], finalFen: c.fen(), leftWhite, score, reason, plies, styles, moves, seconds: Math.round((performance.now() - start) / 100) / 10 });
        }
      } finally { es.forEach(e => e.terminate()); }
    }
    await Promise.all(Array.from({ length: workers }, worker));
  }, { tasks: todo, workers, nodes, maxply, seedBase, timed }); } finally { clearInterval(heartbeat); }
  console.log('MESSUNG FERTIG');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
```

</details>

## Historischer Bericht vom 27.10.2026

Nur zur Herkunft der bereits vorher in PR #50 enthaltenen Aenderungen und Stilproben. Die alten Tabellen, offenen Entscheidungen und Testzahlen gelten fuer den damaligen Stand. Die aktuelle Messung, die wiedergefundenen Altdaten, die Rapid-Auswahl und die Entscheidung zum unbegrenzten Stockfisch oben ersetzen die entsprechenden alten Aussagen. Historische Partien werden nicht in den neuen Enddatensatz gemischt.

<details>
<summary>Unveraenderte historische Messung und damalige Ergebnisfolgen</summary>

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


</details>

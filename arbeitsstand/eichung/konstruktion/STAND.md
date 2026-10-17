# Konstrukteur: Arbeitsstand (fuer einen Neustart)

- 12:05 UTC: origin/main geklont nach origin-main/ (Patch-Basis). Repo /home/user/schach unberuehrt.
- Maia-Politik (alle Zuege, 1100 Stellungen x 7 Wertungen) laeuft: logs/pid-maia-politik.txt, roh/maia-politik.jsonl
- Kette A (Zug-Tabellen MultiPV alle, Tiefe 10: training 5388, klein 1100, gross 1935): logs/pid-kette-a.txt, roh/zugtabelle-*.jsonl
- 12:30: Schaetzer-Prototyp py/schaetzer.py (Aoff = mittlere Zuggenauigkeit in offenen Stellungen 0,10..0,90,
  ohne Buch/erzwungen). Befund: eine Partie traegt wenig Information (r ~ 0,56); Ergebnis und Qualitaet
  derselben Partie sind abhaengig, nicht multiplizieren. Plan: Spielstaerke = Produkt der Partie-Likelihoods
  (Qualitaet) mit schwachem Prior; Spielte-wie = Posterior mit Prior aus den anderen Partien (+Tagesform).
- Bot-Modell: menschenWahl() in app/js/bots.js (Reiz = -sorgfalt*g(verlust) + natur + stil, Gumbel-Wahl).
  Natur-Gewichte aus py/fit_zugwahl.py (bedingtes Logit auf roh/fit-training.jsonl).
- 12:50: Zugwahl-Modell gefittet (py/fit_zugwahl.py, 5388 Trainings-Stellungen, gamma 0,35, 18 Natur-Merkmale
  inkl. gewinnSchlag/haengtWert). Gueltig auf Satz klein (LL -2,077, Klassen-Verteilung je Band passt).
  NATUR in app/js/bots.js eingetragen (py/setze_natur.py). Start-Varianten: konfig-start.json -> varianten-start.json.
- Schaetzer in app/js/review.js (STAERKE_MODELL, staerkeBeleg, spielteWie, spielstaerkeAusPartien), Modell aus
  py/staerke_fit.py (alle Lichess-Seiten), Bewertung skripte/eval_staerke.mjs -> ergebnisse/staerke-bewertung.json.
- 14:10: Kandidaten-Modell (beste 3 der eigenen Suche + forcierende Zuege) eingebaut; Eichung k je Bot
  (py/tune_fein.py, offline mit roh/suchen-klein.jsonl). Echte Laeufe: neu-* (k aus klein), neu2-* (k nach
  beiden Saetzen) in roh/sim-klein/gross.jsonl; Auswertung py/sim_auswerten.py beide, py/profil.py.
  Kreuzungs-Elo streut je Lauf +-150; Benno/Hilde nicht per Kreuzung messbar (Profil Band 400 nutzen).
- Schaetzer final: Streuung fest bei Bezugswertung (iteriert), Tests in testbaum/tests (review 228/228,
  storage 50/50, bots-mensch 24/24). Verdrahtung storage/partie/analyse in testbaum/js.
- Kette B (Maia-Partien E1/E2) wurde mit neu2 gestartet und abgebrochen (11 Partien in
  roh/maia-e1-neu2-abgebrochen.jsonl); Neustart mit final3 geplant.
- 14:30: Endgueltige Parameter: konfig-final.json (k: Benno 0,5, Hilde 0,55, Kalle 0,47, Lisa 0,56, Rudi 0,56,
  Turm 0,55, Delia 0,62, Koenig 0,78, Greta 0,83; Aussetzer Turm/Delia 10 %, Koenig 8 %, Greta 5 %).
  Laeufe: neu3-* (alle) und neu4-turm/neu4-delia (nach Korrektur). Kette B neu gestartet mit end-* (aktuelle BOTS).
- NEUSTART 17.10. ab 16:45 UTC (nach Nutzungslimit):
  - E1 (end-Bots gegen Maia) war fertig: 35,5 statt 67,5 Punkte (v-Skala -296). E2 (60 Partien) zu Ende gerechnet und
    mit App-Engine Tiefe 14 analysiert (roh/maia-e2.app14.jsonl, ergebnisse/e2.json).
  - Befund py/vorhersage.py: Ergebnisse gegen Maia folgen der Kreuzungs-Elo nach groben Patzern (> 40 Punkte), nicht
    dem mittleren Verlust (alt -17/-44, end -6/+42 auf der g-Skala; v-Skala -190/-300).
  - Fehler gefunden: Zuege ausserhalb der MultiPV-Liste galten als "schlechtester + 5" (grobe Patzer Delia/Koenig/
    Greta). Behoben in menschenReize (nicht gelistete Zuege sind keine Kandidaten).
  - Exakter Auswerter skripte/gitter.mjs (ohne Ziehungs-Zufall, Suchen fuer Satz gross neu: roh/suchen-gross.jsonl).
    Gitter r7: je Bot biss, Kandidaten, sorgfalt so, dass v, p, g gemeinsam am Label liegen. Hilde aus r8 (seltene
    Zuege nach Maia als Nebenbedingung). Werte: konfig-final2.json, in app/js/bots.js und rebase/js/bots.js.
  - rebase/ = git-Arbeitsbaum: main 455eb34 + Eichung (3-Wege-Merge, Konflikte geloest). Patches daraus bauen.
  - staerkeFuerElo: Profil des naeheren Bots, sorgfalt entlang eloJeLn (ergebnisse/steigung.json).
  - review.js: botAufschlag (Genauigkeitspunkte) fuer Partien gegen App-Bots (gegenBot), Wert aus E3.
  - Laeufe: kette-c (sim r7 fertig, E1b Teil 2), e1b-1 fertig, kette-d (E3 Partien + native Analyse).
  - Alte Bots lagen auf der Lichess-Skala in Partien ueber dem Label (Turm 1720, Delia 1756, Koenig 2118 g-Skala).
- FERTIG 17.10. ca. 19:00 UTC:
  - Endwerte der Bots in rebase/js/bots.js (= bots.js), exakt geprueft (ergebnisse/gitter-final.json), echte botZug-
    Simulation (sim-beide-r7.json, sim-beide-hilde-final.json), Partien gegen Maia: E1b (16 je Bot) + E3 (6 je Bot gegen
    Maia-1500); Versatz nach groben Patzern -64 [-126; -8] (Stufen 2-9), -34 [-102; +22] (4-9).
  - Bot-Aufschlag 5,4 Punkte (SE 1,6) aus E3 mit App-Engine gegen 24 Maia-Selbstpartien (ergebnisse/e3.json);
    E2 5,1, nativ 6,2. In review.js (botAufschlag, botAufschlagSd, gegenBot).
  - Patches: eichung.patch, eichung-anbindung.patch, eichung-tests.patch aus rebase/ (skripte/baue_patches2.sh), passen
    auf 455eb34 und auf main 57a159b. Tests im Pruefbaum pruefbaum2/: storage 195, review 296 (+317 Browser), spiel 92,
    bots-mensch 30, fairness 31, ereignisse 123, sw 33 nach --aktualisieren, engine-bots --schnell 60, app --schnell 385.
  - VORSCHLAG.md fertig (Zahlen per py/tabellen_final.py aus ergebnisse/*.json; Vorlage VORSCHLAG.vor-fuellen.md).
  - Veraltet (alte Patch-Basis 4342fd1): origin-main/, testbaum/, pruefbaum/, konfig-final.json, varianten-final.json.

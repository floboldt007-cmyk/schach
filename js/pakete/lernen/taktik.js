// Meisterschule, Bereich Taktik (Lehrplan im Vault Schach-App/Meisterschule.md, "Taktik": Gabel, Fesselung, Spiess, Abzug
// ...). Reine Daten, keine Importe. Eigene Stellungen, mit Stockfish nachgeprueft (Schluesselzug klar vorn, MultiPV 3).
//
//   art 'taktik'   Flo gewinnt Material: nach dem Gegenzug mindestens gewinn Punkte mehr als am Anfang (Bauer 1,
//                  Leichtfigur 3, Turm 5, Dame 9), oder Matt. ziel = Flos Zuege dafuer bei bester Verteidigung.
//   gewinn         Punkte, die nach der besten Verteidigung bleiben (z. B. Bauerngabel: Springer gegen Bauer = 2)
//   opfer          (Teil 2) Punkte, die Flo unterwegs bewusst hergibt (Hinlenkung: Turm); so lange gilt der Rueckstand
//                  nicht als verloren (pruefeZiel in mattbilder.js)
// Teil 2 (31.10.2026 abends): jede Antwort des Gegners durchgerechnet (alle Zuege, zwei Zuege tief), dazu Stockfish MultiPV 3.
// 01.11.2026 (Flo: "Doppeldrohung gibt keinen Sinn"): Vollsuche ueber alle Verteidigungen (tests/lernen.test.mjs) fand
// zwei Fehler. Doppeldrohung: nach De4 rettete Td8 (droht Td1#), neu mit Dd3. Turm-Gabel: nach Tb6 Lf4, Txa6 Lxh2+ blieben
// nur 2 Punkte, neu mit Bauer g3. Jetzt prueft der Test jede Lektion: Loesung in ziel Zuegen gegen jede Verteidigung.
// 11.11.2026 (Feinschliff R5): Figur fangen, Zwischenzug, Verteidiger beseitigen, Roentgen, Linie oeffnen; jeweils genau ein
// erster Zug loest gegen jede Verteidigung (Vollsuche), Stockfish (Tiefe 18, MultiPV 3) sieht ihn klar vorn.
const t = (id, stufe, fen, ziel, gewinn, opfer = 0) => Object.freeze({ id, art: 'taktik', stufe, fen, ziel, gewinn, opfer });

export const TAKTIK = Object.freeze([
  t('gabel-springer', 'leicht', '8/q3k3/8/8/3N4/8/5PPP/6K1 w - - 0 1', 2, 5),          // Sc6+ und Sxa7
  t('koenigsgabel', 'leicht', 'r3k3/8/8/1N6/8/8/5PPP/6K1 w - - 0 1', 2, 5),           // Sc7+ und Sxa8
  t('gabel-bauer', 'leicht', '4k3/8/2n1n3/8/3P4/8/1B3PPP/6K1 w - - 0 1', 2, 2),       // d5, ein Springer faellt
  t('gabel-dame', 'leicht', 'r5k1/6pp/8/8/8/8/5PPP/3Q2K1 w - - 0 1', 2, 5),           // Dd5+ und Dxa8
  t('turm-gabel', 'leicht', '7k/8/n6b/8/8/6P1/5P1P/1R4K1 w - - 0 1', 2, 3),          // Tb6 greift Springer und Laeufer an
  t('spiess', 'leicht', 'q7/8/2k5/8/8/3B4/5PPP/6K1 w - - 0 1', 2, 5),                // Le4+ und Lxa8
  t('turm-spiess', 'leicht', '8/8/8/2k4r/8/8/5PPP/R5K1 w - - 0 1', 2, 5),            // Ta5+ und Txh5
  t('fesselung', 'leicht', '6k1/6pp/8/8/2r5/8/5PPP/3B2K1 w - - 0 1', 2, 5),          // Lb3 fesselt den Turm
  t('figur-fangen', 'leicht', '6k1/6pp/8/8/8/8/bPP3PP/2K5 w - - 0 1', 3, 2),        // b3 sperrt den Laeufer ein, Kb2 holt ihn
  t('fesselung-dame', 'mittel', '4k3/8/8/4q3/8/8/5KPP/1R6 w - - 0 1', 2, 4),         // Te1, die Dame faellt gegen den Turm
  t('abzug', 'mittel', '3k3q/8/8/4N3/8/8/1B3PPP/6K1 w - - 0 1', 2, 5),               // Sc6+ (oder Sf7+) und Lxh8
  t('abzug-turm', 'mittel', '3qk3/8/8/4N3/8/8/5PPP/4R1K1 w - - 0 1', 2, 5),         // Sc6+ (Turm gibt Schach), Sxd8
  t('doppelschach', 'mittel', '2q1k3/8/8/8/4N3/8/5PPP/4R1K1 w - - 0 1', 2, 5),       // Sd6++, der Koenig muss weg, Sxc8
  t('doppeldrohung', 'mittel', 'r4rk1/pp3ppp/8/1n6/8/7P/PP3PP1/1B1Q2K1 w - - 0 1', 2, 3), // Dd3: Dxh7# (Lb1 dahinter) und Dxb5
  t('ueberlastung', 'mittel', '2bq2k1/pp3ppp/8/3n4/8/8/PP1Q1PPP/4R1K1 w - - 0 1', 2, 3), // Dxd5, Dxd5 Te8#
  t('zwischenzug', 'mittel', '3r4/5ppk/7p/8/8/5b2/5PPP/3R2K1 w - - 0 1', 2, 5),     // Txd8 statt gxf3 (sonst Txd1+)
  t('verteidiger', 'mittel', '6k1/5bp1/7p/3n2N1/8/8/5PPP/3R2K1 w - - 0 1', 2, 3),   // Sxf7, Kxf7 Txd5
  t('roentgen', 'mittel', '3r2k1/5ppp/8/3q4/8/8/3Q1PPP/3R2K1 w - - 0 1', 2, 5),     // Dxd5, Txd5 Txd5 (Turm d1 wirkt durch)
  t('linie-oeffnen', 'mittel', '6k1/5p1p/6pQ/4P3/8/8/6PP/B5K1 w - - 0 1', 3, 5),    // e6 oeffnet die Diagonale a1-g7, Dg7#
  t('ablenkung', 'schwer', '5qk1/5p1p/5PpQ/8/8/8/6PP/4R1K1 w - - 0 1', 2, 4),        // Te8, Dxe8 Dg7#
  t('hinlenkung', 'schwer', '6k1/6pp/1q6/4N3/8/8/6PP/5R1K w - - 0 1', 3, 4, 5),      // Tf8+ Kxf8, Sd7+ und Sxb6
]);

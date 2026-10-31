// Meisterschule, Bereich Taktik (Lehrplan im Vault Schach-App/Meisterschule.md, "Taktik": Gabel, Fesselung, Spiess, Abzug
// ...). Reine Daten, keine Importe. Eigene Stellungen, mit Stockfish nachgeprueft (Schluesselzug klar vorn, MultiPV 3).
//
//   art 'taktik'   Flo gewinnt Material: nach dem Gegenzug mindestens gewinn Punkte mehr als am Anfang (Bauer 1,
//                  Leichtfigur 3, Turm 5, Dame 9), oder Matt. ziel = Flos Zuege dafuer bei bester Verteidigung.
//   gewinn         Punkte, die nach der besten Verteidigung bleiben (z. B. Bauerngabel: Springer gegen Bauer = 2)
const t = (id, stufe, fen, ziel, gewinn) => Object.freeze({ id, art: 'taktik', stufe, fen, ziel, gewinn });

export const TAKTIK = Object.freeze([
  t('gabel-springer', 'leicht', '8/q3k3/8/8/3N4/8/5PPP/6K1 w - - 0 1', 2, 5),          // Sc6+ und Sxa7
  t('koenigsgabel', 'leicht', 'r3k3/8/8/1N6/8/8/5PPP/6K1 w - - 0 1', 2, 5),           // Sc7+ und Sxa8
  t('gabel-bauer', 'leicht', '4k3/8/2n1n3/8/3P4/8/1B3PPP/6K1 w - - 0 1', 2, 2),       // d5, ein Springer faellt
  t('gabel-dame', 'leicht', 'r5k1/6pp/8/8/8/8/5PPP/3Q2K1 w - - 0 1', 2, 5),           // Dd5+ und Dxa8
  t('turm-gabel', 'leicht', '7k/8/n6b/8/8/8/5PPP/1R4K1 w - - 0 1', 2, 3),            // Tb6 greift Springer und Laeufer an
  t('spiess', 'leicht', 'q7/8/2k5/8/8/3B4/5PPP/6K1 w - - 0 1', 2, 5),                // Le4+ und Lxa8
  t('turm-spiess', 'leicht', '8/8/8/2k4r/8/8/5PPP/R5K1 w - - 0 1', 2, 5),            // Ta5+ und Txh5
  t('fesselung', 'leicht', '6k1/6pp/8/8/2r5/8/5PPP/3B2K1 w - - 0 1', 2, 5),          // Lb3 fesselt den Turm
  t('fesselung-dame', 'mittel', '4k3/8/8/4q3/8/8/5KPP/1R6 w - - 0 1', 2, 4),         // Te1, die Dame faellt gegen den Turm
  t('abzug', 'mittel', '3k3q/8/8/4N3/8/8/1B3PPP/6K1 w - - 0 1', 2, 5),               // Sc6+ (oder Sf7+) und Lxh8
  t('abzug-turm', 'mittel', '3qk3/8/8/4N3/8/8/5PPP/4R1K1 w - - 0 1', 2, 5),         // Sc6+ (Turm gibt Schach), Sxd8
]);

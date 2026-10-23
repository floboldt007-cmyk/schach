// Paket serie: Siegeslauf (Win-Streak, SPIELKONZEPT 3.15). Rein, ohne DOM, in Node testbar. Kein Math.random.
//
// Zaehlt Siege in Folge gegen ungefaehr gleich starke oder staerkere Gegner. Was "ungefaehr gleich stark" heisst:
//   - mit Arena-Wertung (ab WERTUNG_AB wertenden Partien, Paket Wertung/Liga ueber liga:geaendert): Bot-Staerke
//     mindestens eigene Wertung minus ABSTAND (150, bewusst weiter als "Augenhoehe" mit 99) [E]
//   - davor (erste 10 Partien, und solange es keine Wertung gibt): Stufe des Bots mindestens hoechster freigeschalteter
//     Bot minus eine Stufe. Damit lohnt Benno-Farmen nicht.
// Pausieren (zaehlen nicht, brechen nicht): Partien mit Hinweis oder Zuruecknehmen, gegen schwaechere Gegner, Uebungen,
// freie Partien, Boss-Partien, Spielhalle, Gaeste und eigene Stellungen (alles, was nicht wertet).
// Remis oder Niederlage einer zaehlenden Partie beenden den Lauf still ("Siegeslauf beendet bei 4. Dein Rekord: 7.").
// Flamme ab FLAMME_AB Siegen, Meilensteine 3, 5, 10, 15 je Lauf einmal als Feier-Zeile. Keine Funken, kein Bonus in
// Wertung oder Liga, nichts kaufbar.
//
// API:
//   STAND, FLAMME_AB, MEILENSTEINE, ABSTAND, WERTUNG_AB
//   gleichStark({ botStufe, hoechsteStufe, botElo, wertung, wertungPartien }) -> boolean
//   einordnen(d, kontext) -> { art: 'zaehlt' | 'pause', grund }     d wie partie:beendet
//   buche(lauf, d, kontext) -> { wirkung: 'sieg' | 'ende' | 'pause' | 'nichts', n, best, meilenstein, endeBei, grund }
//       veraendert lauf ({ n, best, ms }) nur bei zaehlenden Partien
export const STAND = 1;
export const FLAMME_AB = 3;
export const MEILENSTEINE = Object.freeze([3, 5, 10, 15]);
export const ABSTAND = 150;
export const WERTUNG_AB = 10;

export function gleichStark({ botStufe = null, hoechsteStufe = 1, botElo = null, wertung = null, wertungPartien = 0 } = {}) {
  if (Number.isFinite(wertung) && Number(wertungPartien) >= WERTUNG_AB && Number.isFinite(botElo)) return botElo >= wertung - ABSTAND;
  if (!Number.isInteger(botStufe)) return false;
  return botStufe >= Math.max(1, Number(hoechsteStufe) || 1) - 1;
}

export function einordnen(d, kontext = {}) {
  if (!d || typeof d !== 'object') return { art: 'pause', grund: 'daten' };
  if ((d.modus || 'normal') !== 'normal') return { art: 'pause', grund: 'modus' };
  if (d.wertet !== true) return { art: 'pause', grund: 'wertet' };
  if (Number(d.hinweise) > 0 || Number(d.zuruecknahmen) > 0) return { art: 'pause', grund: 'hilfe' };
  if (!['sieg', 'remis', 'niederlage'].includes(d.ergebnis)) return { art: 'pause', grund: 'ergebnis' };
  if (!gleichStark({ ...kontext, botStufe: Number.isInteger(d.botStufe) ? d.botStufe : kontext.botStufe })) return { art: 'pause', grund: 'schwaecher' };
  return { art: 'zaehlt', grund: null };
}

export function buche(lauf, d, kontext = {}) {
  if (!Number.isInteger(lauf.n) || lauf.n < 0) lauf.n = 0;
  if (!Number.isInteger(lauf.best) || lauf.best < 0) lauf.best = 0;
  if (!Array.isArray(lauf.ms)) lauf.ms = [];
  const e = einordnen(d, kontext);
  if (e.art !== 'zaehlt') return { wirkung: 'pause', n: lauf.n, best: lauf.best, meilenstein: null, endeBei: null, grund: e.grund };
  if (d.ergebnis === 'sieg') {
    lauf.n++;
    lauf.best = Math.max(lauf.best, lauf.n);
    let meilenstein = null;
    if (MEILENSTEINE.includes(lauf.n) && !lauf.ms.includes(lauf.n)) {
      lauf.ms.push(lauf.n);
      meilenstein = lauf.n;
    }
    return { wirkung: 'sieg', n: lauf.n, best: lauf.best, meilenstein, endeBei: null, grund: null };
  }
  const endeBei = lauf.n;
  lauf.n = 0;
  lauf.ms = [];
  return { wirkung: endeBei > 0 ? 'ende' : 'nichts', n: 0, best: lauf.best, meilenstein: null, endeBei: endeBei > 0 ? endeBei : null, grund: null };
}

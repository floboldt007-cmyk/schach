// Vorzuege (Premoves), gemeinsam fuer die Bot-Partie (js/ui/partie.js) und die Online-Partie (js/ui/online.js), R28.
// Herausgezogen aus js/ui/partie.js (Vorzug-Kette, Flo 23.10.2026), damit sich ein Vorzug online genauso anfuehlt wie
// gegen den Bot (Flo 22.11.2026: "Premoves gehen?"). Ohne DOM und ohne Klang: die Oberflaechen zeichnen und klingen selbst.
//
//   VORZUG_MAX                       hoechstens 5 vorgemerkte Zuege; ein sechster springt leise zurueck
//   vorzugZiele(figurAuf, farbe)     Zielkarte { von: [nach, ...] } auf der GEDACHTEN Stellung (das Brett zeigt die
//       vorgemerkten Zuege schon ausgefuehrt): jede eigene Figur darf auf jedes Feld ihrer Gangart, das nicht von einer
//       eigenen Figur besetzt ist. Ob der Zug spaeter gilt, entscheidet erst die echte Stellung (naechsterVorzug).
//   merkeVorzug(kette, von, nach, umwandlung) -> true | false (voll)
//   naechsterVorzug(kette, chess) -> null (leer) | { zug } (in chess ausgefuehrt) | { verworfen: uci } (der erste ist
//       heraus; die uebrigen leert der Aufrufer)

export const VORZUG_MAX = 5;

export function vorzugZiele(figurAuf, farbe) {
  const karte = {};
  const code = (f) => figurAuf(f);
  const feld = (x, y) => x >= 0 && x < 8 && y >= 1 && y <= 8 ? String.fromCharCode(97 + x) + y : null;
  const fuege = (liste, x, y) => { const f = feld(x, y); if (f && (!code(f) || code(f)[0] !== farbe)) liste.push(f); return f; };
  for (let y = 1; y <= 8; y++) for (let x = 0; x < 8; x++) {
    const von = feld(x, y); const fig = code(von);
    if (!fig || fig[0] !== farbe) continue;
    const liste = [];
    if (fig[1] === 'P') {
      const dy = farbe === 'w' ? 1 : -1;
      const eins = feld(x, y + dy);
      if (eins && !code(eins)) {
        liste.push(eins);
        const zwei = feld(x, y + 2 * dy);
        if (y === (farbe === 'w' ? 2 : 7) && zwei && !code(zwei)) liste.push(zwei);
      }
      fuege(liste, x - 1, y + dy); fuege(liste, x + 1, y + dy);
    } else if (fig[1] === 'N') {
      for (const [dx, dy] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) fuege(liste, x + dx, y + dy);
    } else if (fig[1] === 'K') {
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) fuege(liste, x + dx, y + dy);
    } else {
      const gerade = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const diagonal = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
      const richtungen = fig[1] === 'B' ? diagonal : fig[1] === 'R' ? gerade : gerade.concat(diagonal);
      for (const [dx, dy] of richtungen) for (let n = 1; n < 8; n++) {
        const ziel = feld(x + dx * n, y + dy * n); if (!ziel) break;
        const dort = code(ziel);
        if (!dort || dort[0] !== farbe) liste.push(ziel);
        if (dort) break;
      }
    }
    if (liste.length) karte[von] = [...new Set(liste)];
  }
  return karte;
}

export function merkeVorzug(kette, von, nach, umwandlung) {
  if (kette.length >= VORZUG_MAX) return false;
  kette.push({ von, nach, umwandlung: umwandlung || 'q' });
  return true;
}

// Der erste Vorzug wird in der ECHTEN Stellung versucht. Gilt er nicht mehr (der Gegner hat etwas geaendert), fallen er
// und alle danach leise weg, wie in der Bot-Partie seit dem 23.10.
export function naechsterVorzug(kette, chess) {
  if (!kette.length) return null;
  const v = kette.shift();
  let zug = null;
  try { zug = chess.move({ from: v.von, to: v.nach, promotion: v.umwandlung || 'q' }); } catch (e) { zug = null; }
  // die Kette leert der Aufrufer (loescheVorzuege), damit er die gedachte Stellung dabei zuruecksetzt
  if (!zug) return { verworfen: v.von + v.nach };
  return { zug };
}

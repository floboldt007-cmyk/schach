// Die 65 Bretter als eine Liste fuer Vorschau und Auswahl-Liste (Flo 14.11.2026). Nur fuer Werkzeuge, nicht in der App:
// Browser (werkzeuge/bretter-vorschau.html) und Node (werkzeuge/bretter-vorschau.mjs) lesen dieselben Texte und Zahlen.
//   alleBretter() -> [{ id, hell, dunkel, rand, familie, seltenheit, weg, welt?, muster?, flaeche?, bewegung?, glanz?, alt }]
//                    alt: eines der 13 Bretter von vor dem 14.11.2026
//   wegText(weg, weltName) -> string     der geplante Weg in Worten (Schwellen wie js/pakete/sammlung/stufen.js)
//   brettMass(b) -> { feld, weissAufDunkel, schwarzAufDunkel, schwarzAufHell }   WCAG-Kontraste, schlechteste Stelle mit
//                    allen aufhellenden bzw. abdunkelnden Toenen der Zeichnung oder Oberflaeche und dem Glanz uebereinander
//                    (gleiche Regel wie tests/bretter-oberflaechen.test.mjs)
import { LABOR_BRETTER, FREIE_BRETTER_PLAN } from '../js/labor.js';
import { brettMuster } from '../js/brett-flaechen.js';

const FREI = Object.freeze({ nacht: ['#e4e8f6', '#7c87b6', '#2A3150'], gruen: ['#eeeed2', '#769656', '#3E5A2A'], holz: ['#f0d9b5', '#b58863', '#6E4420'] });
const ALT = new Set(['nacht', 'gruen', 'holz', 'kuerbis', 'frost', 'marmor', 'nussbaum', 'thron', 'acker', 'moos', 'pflaster', 'brandung', 'tiefsee']);

export function alleBretter() {
  const frei = Object.entries(FREI).map(([id, [hell, dunkel, rand]]) => ({ id, hell, dunkel, rand, ...FREIE_BRETTER_PLAN[id] }));
  return [...frei, ...LABOR_BRETTER].map((b) => ({ ...b, alt: ALT.has(b.id) }));
}

const STUFE = { bronze: 'Bronze', silber: 'Silber', gold: 'Gold' };
const FAMILIE = {
  siege: ['Siege', [1, 50, 100], 'Siege'], bots: ['Bots', [5, 15, 'alle'], 'Bots besiegt'], welten: ['Welten', [1, 3, 'alle'], 'Welten geschafft'],
  sterne: ['Sterne', [10, 45, 'alle'], 'Sterne'], endgegner: ['Endgegner', [1, 3, 'alle'], 'Endgegner besiegt'],
  siegesfolge: ['Siegesfolge', [3, 5, 10], 'Siege in Folge'], raetsel: ['Rätsel', [10, 50, 200], 'Rätsel gelöst'],
  serie: ['Serie', [7, 30, 100], 'Tage Serie'], level: ['Level', [10, 20, 30], 'Level'], liga: ['Kronen-Liga', ['Stufe 6', 'Stufe 9', 'Stufe 15'], ''],
};
export function wegText(w, weltName = (n) => 'Welt ' + n) {
  if (!w) return '';
  if (w.art === 'start') return 'von Anfang an';
  if (w.art === 'level') return `Level ${w.n}`;
  if (w.art === 'welt') return `alle Bots von ${weltName(w.welt)} besiegt`;
  if (w.art === 'endgegner') return `Endgegner von ${weltName(w.welt)} besiegt`;
  if (w.art === 'stufe') {
    const [name, ziele, einheit] = FAMILIE[w.familie] || [w.familie, [], ''];
    const z = ziele[['bronze', 'silber', 'gold'].indexOf(w.stufe)];
    return `Erfolg ${name} ${STUFE[w.stufe]}${z !== undefined ? ` (${z}${einheit ? ' ' + einheit : ''})` : ''}`;
  }
  return '';
}

const farbe = (s) => {
  const h = /^#([0-9a-f]{6})$/i.exec(s);
  if (h) { const n = parseInt(h[1], 16); return [n >> 16, (n >> 8) & 255, n & 255, 1]; }
  const r = /^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/.exec(s);
  return r ? [+r[1], +r[2], +r[3], +r[4]] : null;
};
const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
  .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const ueber = (u, o) => u.map((v, i) => (i < 3 ? v * (1 - o[3]) + o[i] * o[3] : 1));
// Oberflaechen: je Ebene eine Gruppe <g opacity> mit deckenden rgb()-Formen (js/brett-flaechen.js), jede Ebene zaehlt einmal
const ebenen = (s) => [...String(s || '').matchAll(/<g opacity="([\d.]+)">[\s\S]*?rgb\(([\d.]+),([\d.]+),([\d.]+)\)/g)]
  .map((m) => [+m[2], +m[3], +m[4], +m[1]]);
// schlechteste Stellen: alle aufhellenden bzw. alle abdunkelnden Toene uebereinander (Oberflaechen kreuzen sich)
const stellen = (grund, zeichnung, glanz) => {
  const g = farbe(grund);
  const z = String(zeichnung || '');
  const oben = /<g opacity=/.test(z) ? ebenen(z) : [...new Set(z.match(/rgba\([^)]*\)/g) || [])].map(farbe).filter(Boolean);
  if (glanz) oben.push(farbe(glanz));
  const hell = oben.filter((o) => lum(ueber(g, o)) > lum(g)), dunkel = oben.filter((o) => lum(ueber(g, o)) <= lum(g));
  return [g, hell.reduce(ueber, g), dunkel.reduce(ueber, g)];
};
export function brettMass(b) {
  const m = brettMuster(b) || b.muster;
  const H = stellen(b.hell, m && m.h, b.glanz), D = stellen(b.dunkel, m && m.d, b.glanz);
  const min = (l) => Math.min(...l);
  return {
    feld: min(H.flatMap((h) => D.map((d) => kontrast(h, d)))),
    weissAufDunkel: min(D.map((d) => kontrast([255, 255, 255], d))),
    schwarzAufDunkel: min(D.map((d) => kontrast([0, 0, 0], d))),
    schwarzAufHell: min(H.map((h) => kontrast([0, 0, 0], h))),
  };
}

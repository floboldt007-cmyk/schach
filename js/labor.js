// Labor (Flo 31.10.2026: "Mehr Bretter-Skins ... nur in meinem Account, ich sage, welche dann irgendwann erwerblich sind,
// denk dir was aus, z. B. Halloween-Skins, auch die Figuren ... bei den Klaengen genauso, markiere die, die andere nicht
// sehen koennen; ich kann die benutzen, die anderen nicht"). Was hier steht, sieht und benutzt nur das Erfinder-Konto
// (js/sonderstuecke.js istErfinder); fuer alle anderen gibt es diese Stuecke nicht. Flo entscheidet spaeter, was davon
// erspielbar oder kaeuflich wird: dann wandert es hier heraus.
//
//   LABOR_BRETTER   [{ id, hell, dunkel, rand }]   Farben wie css/tokens.css html[data-brett="<id>"], rand fuers Sammelbild
//   LABOR_FIGUREN   ['kuerbis', ...]          Saetze unter assets/pieces/<id>/ (werkzeuge/labor-figuren.mjs)
//   LABOR_KLAENGE   ['grusel', 'kristall']    Klangsets unter assets/klang/<id>/ (werkzeuge/labor-klaenge.mjs, js/sounds.js)
//   istLabor(art, id) -> boolean               art 'brett' | 'figuren' | 'klang'
//   laborFrei() -> boolean                     nur der Erfinder
//   brettWahl(id) -> id                        ein Labor-Brett ohne Erfinder faellt still auf 'nacht'
//   klangWahl(id) -> id                        ein Labor-Klangset ohne Erfinder faellt still auf '' (Standard der Ansicht)
import { istErfinder } from './sonderstuecke.js';

export const LABOR_BRETTER = Object.freeze([
  Object.freeze({ id: 'kuerbis', hell: '#f6c27e', dunkel: '#8a62b3', rand: '#2B1638' }),
  Object.freeze({ id: 'frost', hell: '#eef5fa', dunkel: '#86a9c6', rand: '#2D5B86' }),
  Object.freeze({ id: 'marmor', hell: '#edeae4', dunkel: '#8f8a84', rand: '#4A4642' }),
  Object.freeze({ id: 'nussbaum', hell: '#e6c49b', dunkel: '#7a4b2c', rand: '#3E2414' }),
  Object.freeze({ id: 'thron', hell: '#f2e2ae', dunkel: '#b0812a', rand: '#5C3D0A' }),
  // Welten-Bretter (31.10.2026): je Welt eines mit leichter Struktur je Feld (css/tokens.css --feld-muster-*); welt = Nummer
  Object.freeze({ id: 'acker', hell: '#eedcaa', dunkel: '#7f9a4e', rand: '#3d4a1f', welt: 1 }),
  Object.freeze({ id: 'moos', hell: '#dfe7c9', dunkel: '#567d4b', rand: '#24391f', welt: 2 }),
  Object.freeze({ id: 'pflaster', hell: '#e8dfcf', dunkel: '#7d8795', rand: '#2f3540', welt: 3 }),
  Object.freeze({ id: 'brandung', hell: '#f3e7cc', dunkel: '#4f93a6', rand: '#1d4a57', welt: 4 }),
  Object.freeze({ id: 'tiefsee', hell: '#d2e4ec', dunkel: '#3c6a8c', rand: '#14283a', welt: 5 }),
]);
export const LABOR_FIGUREN = Object.freeze(['kuerbis', 'frost', 'gold']);
export const LABOR_KLAENGE = Object.freeze(['grusel', 'kristall']);

export function istLabor(art, id) {
  if (art === 'brett') return LABOR_BRETTER.some((b) => b.id === id);
  if (art === 'figuren') return LABOR_FIGUREN.includes(id);
  if (art === 'klang') return LABOR_KLAENGE.includes(id);
  return false;
}
export const laborFrei = () => istErfinder();
export const brettWahl = (id) => (istLabor('brett', id) && !laborFrei() ? 'nacht' : id);
export const klangWahl = (id) => (istLabor('klang', id) && !laborFrei() ? '' : id);

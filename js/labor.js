// Labor (Flo 31.10.2026: "Mehr Bretter-Skins ... nur in meinem Account, ich sage, welche dann irgendwann erwerblich sind,
// denk dir was aus, z. B. Halloween-Skins, auch die Figuren ... bei den Klaengen genauso, markiere die, die andere nicht
// sehen koennen; ich kann die benutzen, die anderen nicht"). Was hier steht, sieht und benutzt nur das Erfinder-Konto
// (js/sonderstuecke.js istErfinder); fuer alle anderen gibt es diese Stuecke nicht. Flo entscheidet spaeter, was davon
// erspielbar oder kaeuflich wird: dann wandert es hier heraus.
//
//   LABOR_BRETTER   [{ id, hell, dunkel, rand, welt?, muster? }]   Farben wie css/tokens.css html[data-brett="<id>"], rand
//                   fuers Sammelbild; muster { h, d }: SVG-Inhalt je Feld (viewBox 100), gleich wie --feld-muster-* in tokens.css
//   LABOR_FIGUREN   ['kuerbis', ...]          Saetze unter assets/pieces/<id>/ (werkzeuge/figuren-3d.mjs, figuren-stile.mjs)
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
  Object.freeze({ id: 'acker', hell: '#eedcaa', dunkel: '#7f9a4e', rand: '#3d4a1f', welt: 1,
    muster: Object.freeze({ h: "<g stroke='rgba(150,112,40,.22)' stroke-width='2.2' stroke-linecap='round'><path d='M14 22l9 3M58 16l8 4M30 58l9-2M72 64l7 4M18 86l8-3M80 34l6 3'/></g>",
      d: "<g fill='none' stroke='rgba(40,56,12,.2)' stroke-width='3.2'><path d='M0 22q25-6 50 0t50 0M0 52q25-6 50 0t50 0M0 82q25-6 50 0t50 0'/></g>" }) }),
  Object.freeze({ id: 'moos', hell: '#dfe7c9', dunkel: '#567d4b', rand: '#24391f', welt: 2,
    muster: Object.freeze({ h: "<g fill='rgba(110,140,70,.14)'><circle cx='22' cy='26' r='5'/><circle cx='70' cy='18' r='3.5'/><circle cx='56' cy='70' r='6'/><circle cx='16' cy='78' r='3'/><circle cx='86' cy='56' r='4'/></g>",
      d: "<g fill='rgba(20,48,18,.2)'><circle cx='24' cy='30' r='14'/><circle cx='74' cy='66' r='17'/></g><g fill='rgba(180,214,140,.14)'><circle cx='70' cy='22' r='9'/><circle cx='22' cy='78' r='10'/></g>" }) }),
  Object.freeze({ id: 'pflaster', hell: '#e8dfcf', dunkel: '#7d8795', rand: '#2f3540', welt: 3,
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(130,108,72,.13)' stroke-width='2'><rect x='6' y='6' width='40' height='38' rx='12'/><rect x='54' y='8' width='40' height='36' rx='12'/><rect x='8' y='54' width='38' height='40' rx='12'/><rect x='54' y='54' width='40' height='40' rx='12'/></g>",
      d: "<g fill='none' stroke='rgba(24,30,42,.17)' stroke-width='2.2'><rect x='6' y='6' width='40' height='38' rx='12'/><rect x='54' y='8' width='40' height='36' rx='12'/><rect x='8' y='54' width='38' height='40' rx='12'/><rect x='54' y='54' width='40' height='40' rx='12'/></g>" }) }),
  Object.freeze({ id: 'brandung', hell: '#f3e7cc', dunkel: '#4f93a6', rand: '#1d4a57', welt: 4,
    muster: Object.freeze({ h: "<g fill='rgba(176,140,84,.22)'><circle cx='18' cy='20' r='1.8'/><circle cx='62' cy='14' r='1.4'/><circle cx='40' cy='46' r='1.6'/><circle cx='82' cy='40' r='1.8'/><circle cx='24' cy='74' r='1.4'/><circle cx='70' cy='80' r='1.8'/><circle cx='50' cy='90' r='1.2'/></g>",
      d: "<g fill='none' stroke='rgba(255,255,255,.2)' stroke-width='3' stroke-linecap='round'><path d='M8 34q10-8 20 0t20 0M52 70q10-8 20 0t20 0'/></g>" }) }),
  Object.freeze({ id: 'tiefsee', hell: '#d2e4ec', dunkel: '#3c6a8c', rand: '#14283a', welt: 5,
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(60,110,140,.18)' stroke-width='1.6'><circle cx='24' cy='70' r='5'/><circle cx='34' cy='54' r='3'/><circle cx='76' cy='28' r='4'/></g>",
      d: "<g fill='none' stroke='rgba(225,245,255,.2)' stroke-width='2'><circle cx='26' cy='74' r='7'/><circle cx='38' cy='52' r='4'/><circle cx='44' cy='36' r='2.5'/><circle cx='74' cy='30' r='5'/></g>" }) }),
]);
// Flo 31.10.2026 abends ("coole Figur-Designs ... in mein Konto", dann "Bessere Designs"): gedrechselte Formen mit Licht
// und Schatten (werkzeuge/figuren-3d.mjs: Elfenbein, Holz, Marmor, Gold, Glas, Neon, Frost, Kuerbis) und eigene Stile
// (werkzeuge/figuren-stile.mjs: Pixel, Geo)
// danach (Video: Figuren als kleine Wesen) Moosgeister und Tiefsee mit Gesichtern, eigene Gestaltung
// dann ("Du hast nur die Farben geaendert ... Feuer, Stein, Halloween, Christmas, Ostern"): Themen mit eigenen Koepfen und
// Kronen (werkzeuge/figuren-themen.mjs), vorn in der Sammlung; dazu Weltraum, Roboter und Naschwerk ("denk dir was aus"),
// ganz vorn Drachen, Zombies, Geister und Lava-Golem ("Musst kreativ werden: Zombies, Golems, Geister, Drachen"),
// danach Piraten, Aegypten, Wikinger und Dinos ("Denk dir mehr aus")
export const LABOR_FIGUREN = Object.freeze(['drachen', 'zombies', 'geister', 'lavagolem', 'piraten', 'aegypten', 'wikinger', 'dinos', 'feuer', 'stein', 'halloween', 'weihnachten', 'ostern', 'weltraum', 'roboter', 'naschwerk', 'moosgeister', 'tiefsee', 'elfenbein',
  'holz', 'marmor', 'gold', 'glas', 'neon', 'frost', 'kuerbis', 'pixel', 'geo']);
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

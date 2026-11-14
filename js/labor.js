// Labor (Flo 31.10.2026: "Mehr Bretter-Skins ... nur in meinem Account, ich sage, welche dann irgendwann erwerblich sind,
// denk dir was aus, z. B. Halloween-Skins, auch die Figuren ... bei den Klaengen genauso, markiere die, die andere nicht
// sehen koennen; ich kann die benutzen, die anderen nicht"). Was hier steht, sieht und benutzt nur das Erfinder-Konto
// (js/sonderstuecke.js istErfinder); fuer alle anderen gibt es diese Stuecke nicht. Flo entscheidet spaeter, was davon
// erspielbar oder kaeuflich wird: dann wandert es hier heraus.
//
//   LABOR_BRETTER   [{ id, hell, dunkel, rand, familie, seltenheit, weg, welt?, muster?, bewegung?, glanz? }]   Farben wie
//                   css/tokens.css html[data-brett="<id>"], rand fuers Sammelbild; muster { h, d }: SVG-Inhalt je Feld
//                   (viewBox 100), gleich wie --feld-muster-* in tokens.css. Die Bloecke der 52 Bretter vom 14.11.2026
//                   schreibt werkzeuge/bretter-css.mjs; bewegung 'glanz' (nur Legendaer): leiser Lichtstreif, glanz = Farbe
//                   weg (geplant, schaltet noch nichts frei): { art: 'start' | 'level', n | 'welt'|'endgegner', welt |
//                   'stufe', familie, stufe } aus vorhandenen Mechaniken (js/pakete/sammlung/stufen.js); nie ein Preis
//   BRETT_FAMILIEN  die sechs Familien in Reihenfolge; FREIE_BRETTER_PLAN dieselben Angaben fuer Nacht, Gruen, Holz
//   LABOR_FIGUREN   ['kuerbis', ...]          Saetze unter assets/pieces/<id>/ (werkzeuge/figuren-3d.mjs, figuren-stile.mjs)
//   LABOR_KLAENGE   ['juwel', 'grusel', 'kristall']  Klangsets unter assets/klang/<id>/ (werkzeuge/klang-juwel.mjs,
//                   werkzeuge/labor-klaenge.mjs, js/sounds.js)
//   istLabor(art, id) -> boolean               art 'brett' | 'figuren' | 'klang'
//   laborFrei() -> boolean                     nur der Erfinder
//   brettWahl(id) -> id                        ein Labor-Brett ohne Erfinder faellt still auf 'nacht'
//   klangWahl(id) -> id                        ein Labor-Klangset ohne Erfinder faellt still auf '' (Standard der Ansicht)
import { istErfinder } from './sonderstuecke.js';

export const BRETT_FAMILIEN = Object.freeze(['klassik', 'natur', 'edelstein', 'welten', 'nacht-neon', 'legendaer']);
const START = Object.freeze({ art: 'start' });
export const FREIE_BRETTER_PLAN = Object.freeze({
  nacht: Object.freeze({ familie: 'klassik', seltenheit: 'frei', weg: START }),
  gruen: Object.freeze({ familie: 'klassik', seltenheit: 'frei', weg: START }),
  holz: Object.freeze({ familie: 'klassik', seltenheit: 'frei', weg: START }),
});
export const LABOR_BRETTER = Object.freeze([
  Object.freeze({ id: 'kuerbis', hell: '#f6c27e', dunkel: '#8a62b3', rand: '#2B1638', familie: 'nacht-neon', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 13 }) }),
  Object.freeze({ id: 'frost', hell: '#eef5fa', dunkel: '#86a9c6', rand: '#2D5B86', familie: 'natur', seltenheit: 'selten', weg: Object.freeze({ art: 'stufe', familie: 'serie', stufe: 'bronze' }) }),
  Object.freeze({ id: 'marmor', hell: '#edeae4', dunkel: '#8f8a84', rand: '#4A4642', familie: 'klassik', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 8 }) }),
  Object.freeze({ id: 'nussbaum', hell: '#e6c49b', dunkel: '#7a4b2c', rand: '#3E2414', familie: 'klassik', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 16 }) }),
  Object.freeze({ id: 'thron', hell: '#f2e2ae', dunkel: '#b0812a', rand: '#5C3D0A', familie: 'edelstein', seltenheit: 'episch', weg: Object.freeze({ art: 'level', n: 35 }) }),
  // Welten-Bretter (31.10.2026): je Welt eines mit leichter Struktur je Feld (css/tokens.css --feld-muster-*); welt = Nummer
  Object.freeze({ id: 'acker', hell: '#eedcaa', dunkel: '#7f9a4e', rand: '#3d4a1f', familie: 'welten', seltenheit: 'selten', weg: Object.freeze({ art: 'endgegner', welt: 1 }), welt: 1,
    muster: Object.freeze({ h: "<g stroke='rgba(150,112,40,.22)' stroke-width='2.2' stroke-linecap='round'><path d='M14 22l9 3M58 16l8 4M30 58l9-2M72 64l7 4M18 86l8-3M80 34l6 3'/></g>",
      d: "<g fill='none' stroke='rgba(40,56,12,.2)' stroke-width='3.2'><path d='M0 22q25-6 50 0t50 0M0 52q25-6 50 0t50 0M0 82q25-6 50 0t50 0'/></g>" }) }),
  Object.freeze({ id: 'moos', hell: '#dfe7c9', dunkel: '#567d4b', rand: '#24391f', familie: 'welten', seltenheit: 'selten', weg: Object.freeze({ art: 'endgegner', welt: 2 }), welt: 2,
    muster: Object.freeze({ h: "<g fill='rgba(110,140,70,.14)'><circle cx='22' cy='26' r='5'/><circle cx='70' cy='18' r='3.5'/><circle cx='56' cy='70' r='6'/><circle cx='16' cy='78' r='3'/><circle cx='86' cy='56' r='4'/></g>",
      d: "<g fill='rgba(20,48,18,.2)'><circle cx='24' cy='30' r='14'/><circle cx='74' cy='66' r='17'/></g><g fill='rgba(180,214,140,.14)'><circle cx='70' cy='22' r='9'/><circle cx='22' cy='78' r='10'/></g>" }) }),
  Object.freeze({ id: 'pflaster', hell: '#e8dfcf', dunkel: '#7d8795', rand: '#2f3540', familie: 'welten', seltenheit: 'episch', weg: Object.freeze({ art: 'endgegner', welt: 3 }), welt: 3,
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(130,108,72,.13)' stroke-width='2'><rect x='6' y='6' width='40' height='38' rx='12'/><rect x='54' y='8' width='40' height='36' rx='12'/><rect x='8' y='54' width='38' height='40' rx='12'/><rect x='54' y='54' width='40' height='40' rx='12'/></g>",
      d: "<g fill='none' stroke='rgba(24,30,42,.17)' stroke-width='2.2'><rect x='6' y='6' width='40' height='38' rx='12'/><rect x='54' y='8' width='40' height='36' rx='12'/><rect x='8' y='54' width='38' height='40' rx='12'/><rect x='54' y='54' width='40' height='40' rx='12'/></g>" }) }),
  Object.freeze({ id: 'brandung', hell: '#f3e7cc', dunkel: '#4f93a6', rand: '#1d4a57', familie: 'welten', seltenheit: 'episch', weg: Object.freeze({ art: 'endgegner', welt: 4 }), welt: 4,
    muster: Object.freeze({ h: "<g fill='rgba(176,140,84,.22)'><circle cx='18' cy='20' r='1.8'/><circle cx='62' cy='14' r='1.4'/><circle cx='40' cy='46' r='1.6'/><circle cx='82' cy='40' r='1.8'/><circle cx='24' cy='74' r='1.4'/><circle cx='70' cy='80' r='1.8'/><circle cx='50' cy='90' r='1.2'/></g>",
      d: "<g fill='none' stroke='rgba(255,255,255,.2)' stroke-width='3' stroke-linecap='round'><path d='M8 34q10-8 20 0t20 0M52 70q10-8 20 0t20 0'/></g>" }) }),
  Object.freeze({ id: 'tiefsee', hell: '#d2e4ec', dunkel: '#3c6a8c', rand: '#14283a', familie: 'welten', seltenheit: 'episch', weg: Object.freeze({ art: 'endgegner', welt: 5 }), welt: 5,
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(60,110,140,.18)' stroke-width='1.6'><circle cx='24' cy='70' r='5'/><circle cx='34' cy='54' r='3'/><circle cx='76' cy='28' r='4'/></g>",
      d: "<g fill='none' stroke='rgba(225,245,255,.2)' stroke-width='2'><circle cx='26' cy='74' r='7'/><circle cx='38' cy='52' r='4'/><circle cx='44' cy='36' r='2.5'/><circle cx='74' cy='30' r='5'/></g>" }) }),
  // 65 Bretter (Flo 14.11.2026: "65 Bretter-Skins, schoene, ueberdenken"): 52 neue in sechs Familien, erst im Labor, damit
  // Flo streichen kann; weg ist nur geplant (vorhandene Mechanik), noch nichts schaltet sie frei
  Object.freeze({ id: 'ahorn', hell: '#f3e3c3', dunkel: '#a8814f', rand: '#5a3e1e', familie: 'klassik', seltenheit: 'frei', weg: Object.freeze({ art: 'level', n: 3 }) }),
  Object.freeze({ id: 'schiefer', hell: '#dfe3e6', dunkel: '#6f7f8c', rand: '#2c343b', familie: 'klassik', seltenheit: 'frei', weg: Object.freeze({ art: 'level', n: 5 }),
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(44,52,59,.12)' stroke-width='1.6'><path d='M0 34l100-12M0 70l100-14'/></g>",
      d: "<g fill='none' stroke='rgba(44,52,59,.16)' stroke-width='1.6'><path d='M0 34l100-12M0 70l100-14'/></g>" }) }),
  Object.freeze({ id: 'turnier', hell: '#e8edf2', dunkel: '#6b8bb0', rand: '#24364d', familie: 'klassik', seltenheit: 'frei', weg: Object.freeze({ art: 'stufe', familie: 'siege', stufe: 'bronze' }) }),
  Object.freeze({ id: 'elfenbein', hell: '#f8f1e0', dunkel: '#94795a', rand: '#4b3b26', familie: 'klassik', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 12 }),
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(75,59,38,.12)' stroke-width='2'><path d='M0 22q50 9 100 0M0 50q50-9 100 0M0 78q50 9 100 0'/></g>",
      d: "<g fill='none' stroke='rgba(75,59,38,.16)' stroke-width='2'><path d='M0 22q50 9 100 0M0 50q50-9 100 0M0 78q50 9 100 0'/></g>" }) }),
  Object.freeze({ id: 'ebenholz', hell: '#e9dcc6', dunkel: '#765a48', rand: '#2a1d15', familie: 'klassik', seltenheit: 'selten', weg: Object.freeze({ art: 'stufe', familie: 'siege', stufe: 'silber' }),
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(42,29,21,.12)' stroke-width='2'><path d='M0 22q50 9 100 0M0 50q50-9 100 0M0 78q50 9 100 0'/></g>",
      d: "<g fill='none' stroke='rgba(255,255,255,.12)' stroke-width='2'><path d='M0 22q50 9 100 0M0 50q50-9 100 0M0 78q50 9 100 0'/></g>" }) }),
  Object.freeze({ id: 'kirsche', hell: '#f1d3b9', dunkel: '#a0584a', rand: '#4a2218', familie: 'klassik', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 20 }),
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(74,34,24,.12)' stroke-width='2'><path d='M0 22q50 9 100 0M0 50q50-9 100 0M0 78q50 9 100 0'/></g>",
      d: "<g fill='none' stroke='rgba(255,255,255,.12)' stroke-width='2'><path d='M0 22q50 9 100 0M0 50q50-9 100 0M0 78q50 9 100 0'/></g>" }) }),
  Object.freeze({ id: 'wiese', hell: '#eef3cf', dunkel: '#6a9148', rand: '#34501f', familie: 'natur', seltenheit: 'frei', weg: Object.freeze({ art: 'level', n: 4 }),
    muster: Object.freeze({ h: "<g fill='rgba(52,80,31,.12)'><circle cx='22' cy='24' r='3'/><circle cx='70' cy='36' r='2.4'/><circle cx='40' cy='72' r='3.2'/><circle cx='82' cy='80' r='2'/></g>",
      d: "<g fill='rgba(52,80,31,.16)'><circle cx='22' cy='24' r='3'/><circle cx='70' cy='36' r='2.4'/><circle cx='40' cy='72' r='3.2'/><circle cx='82' cy='80' r='2'/></g>" }) }),
  Object.freeze({ id: 'duene', hell: '#f4e6c4', dunkel: '#ad8448', rand: '#5b4120', familie: 'natur', seltenheit: 'frei', weg: Object.freeze({ art: 'stufe', familie: 'raetsel', stufe: 'bronze' }),
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(91,65,32,.12)' stroke-width='2.4' stroke-linecap='round'><path d='M0 30q25-10 50 0t50 0M0 66q25-10 50 0t50 0'/></g>",
      d: "<g fill='none' stroke='rgba(91,65,32,.16)' stroke-width='2.4' stroke-linecap='round'><path d='M0 30q25-10 50 0t50 0M0 66q25-10 50 0t50 0'/></g>" }) }),
  Object.freeze({ id: 'birke', hell: '#f3f1ea', dunkel: '#80827a', rand: '#33342f', familie: 'natur', seltenheit: 'frei', weg: Object.freeze({ art: 'level', n: 7 }),
    muster: Object.freeze({ h: "<g stroke='rgba(51,52,47,.12)' stroke-width='3' stroke-linecap='round'><path d='M18 20h16M60 34h22M30 62h14M64 80h18'/></g>",
      d: "<g stroke='rgba(51,52,47,.16)' stroke-width='3' stroke-linecap='round'><path d='M18 20h16M60 34h22M30 62h14M64 80h18'/></g>" }) }),
  Object.freeze({ id: 'herbst', hell: '#f5dfb8', dunkel: '#b0663a', rand: '#52250f', familie: 'natur', seltenheit: 'selten', weg: Object.freeze({ art: 'stufe', familie: 'bots', stufe: 'bronze' }),
    muster: Object.freeze({ h: "<g fill='rgba(82,37,15,.12)'><ellipse cx='26' cy='30' rx='9' ry='4' transform='rotate(-30 26 30)'/><ellipse cx='72' cy='68' rx='10' ry='4.5' transform='rotate(25 72 68)'/></g>",
      d: "<g fill='rgba(82,37,15,.16)'><ellipse cx='26' cy='30' rx='9' ry='4' transform='rotate(-30 26 30)'/><ellipse cx='72' cy='68' rx='10' ry='4.5' transform='rotate(25 72 68)'/></g>" }) }),
  Object.freeze({ id: 'kirschbluete', hell: '#fbe6ec', dunkel: '#ad6680', rand: '#5a2a3a', familie: 'natur', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 15 }),
    muster: Object.freeze({ h: "<g fill='rgba(90,42,58,.12)'><circle cx='22' cy='24' r='3'/><circle cx='70' cy='36' r='2.4'/><circle cx='40' cy='72' r='3.2'/><circle cx='82' cy='80' r='2'/></g>",
      d: "<g fill='rgba(90,42,58,.16)'><circle cx='22' cy='24' r='3'/><circle cx='70' cy='36' r='2.4'/><circle cx='40' cy='72' r='3.2'/><circle cx='82' cy='80' r='2'/></g>" }) }),
  Object.freeze({ id: 'lavendel', hell: '#eee8f6', dunkel: '#8f7bb8', rand: '#3a2c5a', familie: 'natur', seltenheit: 'selten', weg: Object.freeze({ art: 'stufe', familie: 'sterne', stufe: 'bronze' }),
    muster: Object.freeze({ h: "<g stroke='rgba(58,44,90,.12)' stroke-width='2' stroke-linecap='round'><path d='M16 84l8-26M30 86l3-30M70 40l6-24M84 44l-2-26'/></g>",
      d: "<g stroke='rgba(58,44,90,.16)' stroke-width='2' stroke-linecap='round'><path d='M16 84l8-26M30 86l3-30M70 40l6-24M84 44l-2-26'/></g>" }) }),
  Object.freeze({ id: 'bambus', hell: '#eef0cf', dunkel: '#7a8a3c', rand: '#3a4418', familie: 'natur', seltenheit: 'selten', weg: Object.freeze({ art: 'stufe', familie: 'raetsel', stufe: 'silber' }),
    muster: Object.freeze({ h: "<g stroke='rgba(58,68,24,.12)' stroke-width='2' stroke-linecap='round'><path d='M16 84l8-26M30 86l3-30M70 40l6-24M84 44l-2-26'/></g>",
      d: "<g stroke='rgba(58,68,24,.16)' stroke-width='2' stroke-linecap='round'><path d='M16 84l8-26M30 86l3-30M70 40l6-24M84 44l-2-26'/></g>" }) }),
  Object.freeze({ id: 'sonnenblume', hell: '#fbefc0', dunkel: '#a87620', rand: '#5a3a08', familie: 'natur', seltenheit: 'selten', weg: Object.freeze({ art: 'stufe', familie: 'serie', stufe: 'silber' }),
    muster: Object.freeze({ h: "<g fill='rgba(90,58,8,.12)'><circle cx='22' cy='24' r='3'/><circle cx='70' cy='36' r='2.4'/><circle cx='40' cy='72' r='3.2'/><circle cx='82' cy='80' r='2'/></g>",
      d: "<g fill='rgba(90,58,8,.16)'><circle cx='22' cy='24' r='3'/><circle cx='70' cy='36' r='2.4'/><circle cx='40' cy='72' r='3.2'/><circle cx='82' cy='80' r='2'/></g>" }) }),
  Object.freeze({ id: 'gletscher', hell: '#e6f3f6', dunkel: '#5f93a8', rand: '#1c3f4c', familie: 'natur', seltenheit: 'episch', weg: Object.freeze({ art: 'stufe', familie: 'sterne', stufe: 'silber' }),
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(28,63,76,.12)' stroke-width='2' stroke-linecap='round'><path d='M10 30l18 10l10-6l20 14M56 74l14-10l20 8'/></g>",
      d: "<g fill='none' stroke='rgba(28,63,76,.16)' stroke-width='2' stroke-linecap='round'><path d='M10 30l18 10l10-6l20 14M56 74l14-10l20 8'/></g>" }) }),
  Object.freeze({ id: 'vulkan', hell: '#e8cdb6', dunkel: '#a2503a', rand: '#3a120a', familie: 'natur', seltenheit: 'episch', weg: Object.freeze({ art: 'stufe', familie: 'siegesfolge', stufe: 'silber' }),
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(58,18,10,.12)' stroke-width='2' stroke-linecap='round'><path d='M10 30l18 10l10-6l20 14M56 74l14-10l20 8'/></g>",
      d: "<g fill='none' stroke='rgba(255,255,255,.12)' stroke-width='2' stroke-linecap='round'><path d='M10 30l18 10l10-6l20 14M56 74l14-10l20 8'/></g>" }) }),
  Object.freeze({ id: 'topas', hell: '#fbeccc', dunkel: '#b87a2a', rand: '#5c3a08', familie: 'edelstein', seltenheit: 'selten', weg: Object.freeze({ art: 'stufe', familie: 'siegesfolge', stufe: 'bronze' }),
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(92,58,8,.12)' stroke-width='1.6'><path d='M50 8L92 50L50 92L8 50ZM50 8V92M8 50H92'/></g>",
      d: "<g fill='none' stroke='rgba(92,58,8,.16)' stroke-width='1.6'><path d='M50 8L92 50L50 92L8 50ZM50 8V92M8 50H92'/></g>" }) }),
  Object.freeze({ id: 'amethyst', hell: '#efe4f6', dunkel: '#8a5cb0', rand: '#3a1a52', familie: 'edelstein', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 25 }),
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(58,26,82,.12)' stroke-width='1.6'><path d='M50 8L92 50L50 92L8 50ZM50 8V92M8 50H92'/></g>",
      d: "<g fill='none' stroke='rgba(255,255,255,.12)' stroke-width='1.6'><path d='M50 8L92 50L50 92L8 50ZM50 8V92M8 50H92'/></g>" }) }),
  Object.freeze({ id: 'perlmutt', hell: '#f6f2ee', dunkel: '#7f8aa0', rand: '#3a4050', familie: 'edelstein', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 22 }),
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(58,64,80,.12)' stroke-width='2.4' stroke-linecap='round'><path d='M0 30q25-10 50 0t50 0M0 66q25-10 50 0t50 0'/></g>",
      d: "<g fill='none' stroke='rgba(58,64,80,.16)' stroke-width='2.4' stroke-linecap='round'><path d='M0 30q25-10 50 0t50 0M0 66q25-10 50 0t50 0'/></g>" }) }),
  Object.freeze({ id: 'jade', hell: '#e6f0dc', dunkel: '#5e8f6a', rand: '#1f3b26', familie: 'edelstein', seltenheit: 'selten', weg: Object.freeze({ art: 'stufe', familie: 'welten', stufe: 'silber' }),
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(31,59,38,.12)' stroke-width='1.6'><path d='M50 8L92 50L50 92L8 50ZM50 8V92M8 50H92'/></g>",
      d: "<g fill='none' stroke='rgba(31,59,38,.16)' stroke-width='1.6'><path d='M50 8L92 50L50 92L8 50ZM50 8V92M8 50H92'/></g>" }) }),
  Object.freeze({ id: 'bernstein', hell: '#f8e2b8', dunkel: '#b46a1e', rand: '#4f2a06', familie: 'edelstein', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 28 }),
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(79,42,6,.12)' stroke-width='1.6'><circle cx='26' cy='70' r='6'/><circle cx='40' cy='48' r='3.5'/><circle cx='72' cy='30' r='5'/></g>",
      d: "<g fill='none' stroke='rgba(79,42,6,.16)' stroke-width='1.6'><circle cx='26' cy='70' r='6'/><circle cx='40' cy='48' r='3.5'/><circle cx='72' cy='30' r='5'/></g>" }) }),
  Object.freeze({ id: 'smaragd', hell: '#e3f2e8', dunkel: '#3f8a62', rand: '#123a26', familie: 'edelstein', seltenheit: 'episch', weg: Object.freeze({ art: 'stufe', familie: 'bots', stufe: 'gold' }),
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(18,58,38,.12)' stroke-width='1.6'><path d='M50 8L92 50L50 92L8 50ZM50 8V92M8 50H92'/></g>",
      d: "<g fill='none' stroke='rgba(18,58,38,.16)' stroke-width='1.6'><path d='M50 8L92 50L50 92L8 50ZM50 8V92M8 50H92'/></g>" }) }),
  Object.freeze({ id: 'saphir', hell: '#e2e9f8', dunkel: '#4566b0', rand: '#142650', familie: 'edelstein', seltenheit: 'episch', weg: Object.freeze({ art: 'stufe', familie: 'bots', stufe: 'silber' }),
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(20,38,80,.12)' stroke-width='1.6'><path d='M50 8L92 50L50 92L8 50ZM50 8V92M8 50H92'/></g>",
      d: "<g fill='none' stroke='rgba(255,255,255,.12)' stroke-width='1.6'><path d='M50 8L92 50L50 92L8 50ZM50 8V92M8 50H92'/></g>" }) }),
  Object.freeze({ id: 'rubin', hell: '#f6e0e2', dunkel: '#b0414f', rand: '#4a0f18', familie: 'edelstein', seltenheit: 'episch', weg: Object.freeze({ art: 'level', n: 50 }),
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(74,15,24,.12)' stroke-width='1.6'><path d='M50 8L92 50L50 92L8 50ZM50 8V92M8 50H92'/></g>",
      d: "<g fill='none' stroke='rgba(255,255,255,.12)' stroke-width='1.6'><path d='M50 8L92 50L50 92L8 50ZM50 8V92M8 50H92'/></g>" }) }),
  Object.freeze({ id: 'opal', hell: '#eef3f4', dunkel: '#658c9a', rand: '#1e3a44', familie: 'edelstein', seltenheit: 'episch', weg: Object.freeze({ art: 'stufe', familie: 'raetsel', stufe: 'gold' }),
    muster: Object.freeze({ h: "<g fill='rgba(30,58,68,.12)'><circle cx='18' cy='22' r='1.6'/><circle cx='66' cy='14' r='1.2'/><circle cx='44' cy='52' r='1.8'/><circle cx='84' cy='62' r='1.3'/><circle cx='26' cy='82' r='1.4'/></g>",
      d: "<g fill='rgba(30,58,68,.16)'><circle cx='18' cy='22' r='1.6'/><circle cx='66' cy='14' r='1.2'/><circle cx='44' cy='52' r='1.8'/><circle cx='84' cy='62' r='1.3'/><circle cx='26' cy='82' r='1.4'/></g>" }) }),
  Object.freeze({ id: 'onyx', hell: '#dcdcdc', dunkel: '#63636c', rand: '#1a1a1e', familie: 'edelstein', seltenheit: 'episch', weg: Object.freeze({ art: 'stufe', familie: 'liga', stufe: 'silber' }),
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(26,26,30,.12)' stroke-width='1.6'><path d='M50 8L92 50L50 92L8 50ZM50 8V92M8 50H92'/></g>",
      d: "<g fill='none' stroke='rgba(255,255,255,.12)' stroke-width='1.6'><path d='M50 8L92 50L50 92L8 50ZM50 8V92M8 50H92'/></g>" }) }),
  Object.freeze({ id: 'scheune', hell: '#f1dcc0', dunkel: '#a35a3c', rand: '#4a2214', familie: 'welten', seltenheit: 'selten', weg: Object.freeze({ art: 'welt', welt: 1 }), welt: 1,
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(74,34,20,.12)' stroke-width='1.8'><path d='M0 33h100M0 66h100M50 0v33M25 33v33M75 33v33M50 66v34'/></g>",
      d: "<g fill='none' stroke='rgba(255,255,255,.12)' stroke-width='1.8'><path d='M0 33h100M0 66h100M50 0v33M25 33v33M75 33v33M50 66v34'/></g>" }) }),
  Object.freeze({ id: 'heuboden', hell: '#f6eab8', dunkel: '#9e7e2c', rand: '#50400e', familie: 'welten', seltenheit: 'frei', weg: Object.freeze({ art: 'level', n: 10 }), welt: 1,
    muster: Object.freeze({ h: "<g stroke='rgba(80,64,14,.12)' stroke-width='2' stroke-linecap='round'><path d='M16 84l8-26M30 86l3-30M70 40l6-24M84 44l-2-26'/></g>",
      d: "<g stroke='rgba(80,64,14,.16)' stroke-width='2' stroke-linecap='round'><path d='M16 84l8-26M30 86l3-30M70 40l6-24M84 44l-2-26'/></g>" }) }),
  Object.freeze({ id: 'lichtung', hell: '#ecf1d2', dunkel: '#6c8f4a', rand: '#2a3c1a', familie: 'welten', seltenheit: 'selten', weg: Object.freeze({ art: 'welt', welt: 2 }), welt: 2,
    muster: Object.freeze({ h: "<g fill='rgba(42,60,26,.12)'><ellipse cx='26' cy='30' rx='9' ry='4' transform='rotate(-30 26 30)'/><ellipse cx='72' cy='68' rx='10' ry='4.5' transform='rotate(25 72 68)'/></g>",
      d: "<g fill='rgba(42,60,26,.16)'><ellipse cx='26' cy='30' rx='9' ry='4' transform='rotate(-30 26 30)'/><ellipse cx='72' cy='68' rx='10' ry='4.5' transform='rotate(25 72 68)'/></g>" }) }),
  Object.freeze({ id: 'koehlerglut', hell: '#ead7c4', dunkel: '#7a5a48', rand: '#2a1a10', familie: 'welten', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 18 }), welt: 2,
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(42,26,16,.12)' stroke-width='2' stroke-linecap='round'><path d='M10 30l18 10l10-6l20 14M56 74l14-10l20 8'/></g>",
      d: "<g fill='none' stroke='rgba(255,255,255,.12)' stroke-width='2' stroke-linecap='round'><path d='M10 30l18 10l10-6l20 14M56 74l14-10l20 8'/></g>" }) }),
  Object.freeze({ id: 'rathausuhr', hell: '#efe6d6', dunkel: '#8a7a64', rand: '#3a3020', familie: 'welten', seltenheit: 'episch', weg: Object.freeze({ art: 'welt', welt: 3 }), welt: 3,
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(58,48,32,.12)' stroke-width='1.8'><path d='M0 33h100M0 66h100M50 0v33M25 33v33M75 33v33M50 66v34'/></g>",
      d: "<g fill='none' stroke='rgba(58,48,32,.16)' stroke-width='1.8'><path d='M0 33h100M0 66h100M50 0v33M25 33v33M75 33v33M50 66v34'/></g>" }) }),
  Object.freeze({ id: 'bibliothek', hell: '#ecdcc4', dunkel: '#5e6f8e', rand: '#1e2638', familie: 'welten', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 26 }), welt: 3,
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(30,38,56,.12)' stroke-width='2'><path d='M14 20v60M28 26v54M42 18v62M64 24v56M80 20v60'/></g>",
      d: "<g fill='none' stroke='rgba(255,255,255,.12)' stroke-width='2'><path d='M14 20v60M28 26v54M42 18v62M64 24v56M80 20v60'/></g>" }) }),
  Object.freeze({ id: 'leuchtturm', hell: '#f4ecdc', dunkel: '#b0505a', rand: '#4a1418', familie: 'welten', seltenheit: 'episch', weg: Object.freeze({ art: 'welt', welt: 4 }), welt: 4,
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(74,20,24,.12)' stroke-width='2.4' stroke-linecap='round'><path d='M0 30q25-10 50 0t50 0M0 66q25-10 50 0t50 0'/></g>",
      d: "<g fill='none' stroke='rgba(255,255,255,.12)' stroke-width='2.4' stroke-linecap='round'><path d='M0 30q25-10 50 0t50 0M0 66q25-10 50 0t50 0'/></g>" }) }),
  Object.freeze({ id: 'watt', hell: '#e6e2d4', dunkel: '#7f8a80', rand: '#2c322c', familie: 'welten', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 34 }), welt: 4,
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(44,50,44,.12)' stroke-width='2.4' stroke-linecap='round'><path d='M0 30q25-10 50 0t50 0M0 66q25-10 50 0t50 0'/></g>",
      d: "<g fill='none' stroke='rgba(44,50,44,.16)' stroke-width='2.4' stroke-linecap='round'><path d='M0 30q25-10 50 0t50 0M0 66q25-10 50 0t50 0'/></g>" }) }),
  Object.freeze({ id: 'leuchtqualle', hell: '#dcd8f0', dunkel: '#56639f', rand: '#141838', familie: 'welten', seltenheit: 'episch', weg: Object.freeze({ art: 'welt', welt: 5 }), welt: 5,
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(20,24,56,.12)' stroke-width='1.6'><circle cx='26' cy='70' r='6'/><circle cx='40' cy='48' r='3.5'/><circle cx='72' cy='30' r='5'/></g>",
      d: "<g fill='none' stroke='rgba(255,255,255,.12)' stroke-width='1.6'><circle cx='26' cy='70' r='6'/><circle cx='40' cy='48' r='3.5'/><circle cx='72' cy='30' r='5'/></g>" }) }),
  Object.freeze({ id: 'schatzkammer', hell: '#f0e0b0', dunkel: '#7a6a3a', rand: '#2a220a', familie: 'welten', seltenheit: 'episch', weg: Object.freeze({ art: 'level', n: 42 }), welt: 5,
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(42,34,10,.12)' stroke-width='1.8'><circle cx='30' cy='34' r='9'/><circle cx='68' cy='66' r='11'/></g>",
      d: "<g fill='none' stroke='rgba(255,255,255,.12)' stroke-width='1.8'><circle cx='30' cy='34' r='9'/><circle cx='68' cy='66' r='11'/></g>" }) }),
  Object.freeze({ id: 'sternennacht', hell: '#c3c8e6', dunkel: '#56609a', rand: '#161a36', familie: 'nacht-neon', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 30 }),
    muster: Object.freeze({ h: "<g fill='rgba(22,26,54,.12)'><circle cx='18' cy='22' r='1.6'/><circle cx='66' cy='14' r='1.2'/><circle cx='44' cy='52' r='1.8'/><circle cx='84' cy='62' r='1.3'/><circle cx='26' cy='82' r='1.4'/></g>",
      d: "<g fill='rgba(255,255,255,.12)'><circle cx='18' cy='22' r='1.6'/><circle cx='66' cy='14' r='1.2'/><circle cx='44' cy='52' r='1.8'/><circle cx='84' cy='62' r='1.3'/><circle cx='26' cy='82' r='1.4'/></g>" }) }),
  Object.freeze({ id: 'mondschein', hell: '#d8dde8', dunkel: '#5a6680', rand: '#1e2433', familie: 'nacht-neon', seltenheit: 'selten', weg: Object.freeze({ art: 'stufe', familie: 'endgegner', stufe: 'bronze' }),
    muster: Object.freeze({ h: "<g fill='rgba(30,36,51,.12)'><circle cx='18' cy='22' r='1.6'/><circle cx='66' cy='14' r='1.2'/><circle cx='44' cy='52' r='1.8'/><circle cx='84' cy='62' r='1.3'/><circle cx='26' cy='82' r='1.4'/></g>",
      d: "<g fill='rgba(255,255,255,.12)'><circle cx='18' cy='22' r='1.6'/><circle cx='66' cy='14' r='1.2'/><circle cx='44' cy='52' r='1.8'/><circle cx='84' cy='62' r='1.3'/><circle cx='26' cy='82' r='1.4'/></g>" }) }),
  Object.freeze({ id: 'daemmerung', hell: '#f0cdb8', dunkel: '#6a5a8a', rand: '#241d36', familie: 'nacht-neon', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 38 }),
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(36,29,54,.12)' stroke-width='2.4' stroke-linecap='round'><path d='M0 30q25-10 50 0t50 0M0 66q25-10 50 0t50 0'/></g>",
      d: "<g fill='none' stroke='rgba(255,255,255,.12)' stroke-width='2.4' stroke-linecap='round'><path d='M0 30q25-10 50 0t50 0M0 66q25-10 50 0t50 0'/></g>" }) }),
  Object.freeze({ id: 'nachtmarkt', hell: '#f2d8a8', dunkel: '#6e5e92', rand: '#221a36', familie: 'nacht-neon', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 40 }),
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(34,26,54,.12)' stroke-width='1.8'><circle cx='30' cy='34' r='9'/><circle cx='68' cy='66' r='11'/></g>",
      d: "<g fill='none' stroke='rgba(255,255,255,.12)' stroke-width='1.8'><circle cx='30' cy='34' r='9'/><circle cx='68' cy='66' r='11'/></g>" }) }),
  Object.freeze({ id: 'geisterstunde', hell: '#d6e6dc', dunkel: '#5a6a7a', rand: '#1e2630', familie: 'nacht-neon', seltenheit: 'selten', weg: Object.freeze({ art: 'stufe', familie: 'endgegner', stufe: 'silber' }),
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(30,38,48,.12)' stroke-width='1.6'><circle cx='26' cy='70' r='6'/><circle cx='40' cy='48' r='3.5'/><circle cx='72' cy='30' r='5'/></g>",
      d: "<g fill='none' stroke='rgba(255,255,255,.12)' stroke-width='1.6'><circle cx='26' cy='70' r='6'/><circle cx='40' cy='48' r='3.5'/><circle cx='72' cy='30' r='5'/></g>" }) }),
  Object.freeze({ id: 'gewitter', hell: '#d8dce6', dunkel: '#55627c', rand: '#1a2030', familie: 'nacht-neon', seltenheit: 'episch', weg: Object.freeze({ art: 'level', n: 45 }),
    muster: Object.freeze({ h: "<g fill='rgba(26,32,48,.12)'><path d='M58 10L36 54h14L40 90l26-48H52Z'/></g>",
      d: "<g fill='rgba(255,255,255,.12)'><path d='M58 10L36 54h14L40 90l26-48H52Z'/></g>" }) }),
  Object.freeze({ id: 'neon', hell: '#b8f0ea', dunkel: '#94469a', rand: '#2a0e30', familie: 'nacht-neon', seltenheit: 'episch', weg: Object.freeze({ art: 'stufe', familie: 'siegesfolge', stufe: 'gold' }),
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(42,14,48,.12)' stroke-width='1.8'><path d='M0 30h30v40h40v-20h30M50 0v20'/><circle cx='30' cy='30' r='3'/><circle cx='70' cy='50' r='3'/></g>",
      d: "<g fill='none' stroke='rgba(255,255,255,.12)' stroke-width='1.8'><path d='M0 30h30v40h40v-20h30M50 0v20'/><circle cx='30' cy='30' r='3'/><circle cx='70' cy='50' r='3'/></g>" }) }),
  Object.freeze({ id: 'synthwave', hell: '#f2c4e6', dunkel: '#7254b0', rand: '#1e1240', familie: 'nacht-neon', seltenheit: 'episch', weg: Object.freeze({ art: 'stufe', familie: 'liga', stufe: 'bronze' }),
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(30,18,64,.12)' stroke-width='1.6'><path d='M0 34l100-12M0 70l100-14'/></g>",
      d: "<g fill='none' stroke='rgba(255,255,255,.12)' stroke-width='1.6'><path d='M0 34l100-12M0 70l100-14'/></g>" }) }),
  Object.freeze({ id: 'cyber', hell: '#c8f0c8', dunkel: '#3a7a5a', rand: '#0e2a1e', familie: 'nacht-neon', seltenheit: 'episch', weg: Object.freeze({ art: 'stufe', familie: 'welten', stufe: 'gold' }),
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(14,42,30,.12)' stroke-width='1.8'><path d='M0 30h30v40h40v-20h30M50 0v20'/><circle cx='30' cy='30' r='3'/><circle cx='70' cy='50' r='3'/></g>",
      d: "<g fill='none' stroke='rgba(255,255,255,.12)' stroke-width='1.8'><path d='M0 30h30v40h40v-20h30M50 0v20'/><circle cx='30' cy='30' r='3'/><circle cx='70' cy='50' r='3'/></g>" }) }),
  Object.freeze({ id: 'nordlicht', hell: '#d8f0e6', dunkel: '#2f6f6a', rand: '#0e2a28', familie: 'legendaer', seltenheit: 'legende', weg: Object.freeze({ art: 'stufe', familie: 'serie', stufe: 'gold' }), bewegung: 'glanz', glanz: 'rgba(160,255,220,.12)',
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(14,42,40,.12)' stroke-width='2.4' stroke-linecap='round'><path d='M0 30q25-10 50 0t50 0M0 66q25-10 50 0t50 0'/></g>",
      d: "<g fill='none' stroke='rgba(255,255,255,.12)' stroke-width='2.4' stroke-linecap='round'><path d='M0 30q25-10 50 0t50 0M0 66q25-10 50 0t50 0'/></g>" }) }),
  Object.freeze({ id: 'sonnenkrone', hell: '#fbefc4', dunkel: '#a87818', rand: '#4a3006', familie: 'legendaer', seltenheit: 'legende', weg: Object.freeze({ art: 'level', n: 100 }), bewegung: 'glanz', glanz: 'rgba(255,236,170,.12)',
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(74,48,6,.12)' stroke-width='1.6'><path d='M50 8L92 50L50 92L8 50ZM50 8V92M8 50H92'/></g>",
      d: "<g fill='none' stroke='rgba(74,48,6,.16)' stroke-width='1.6'><path d='M50 8L92 50L50 92L8 50ZM50 8V92M8 50H92'/></g>" }) }),
  Object.freeze({ id: 'drachenglut', hell: '#f6d2b0', dunkel: '#a4402a', rand: '#3a120a', familie: 'legendaer', seltenheit: 'legende', weg: Object.freeze({ art: 'stufe', familie: 'endgegner', stufe: 'gold' }), bewegung: 'glanz', glanz: 'rgba(255,180,110,.12)',
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(58,18,10,.12)' stroke-width='2' stroke-linecap='round'><path d='M10 30l18 10l10-6l20 14M56 74l14-10l20 8'/></g>",
      d: "<g fill='none' stroke='rgba(255,255,255,.12)' stroke-width='2' stroke-linecap='round'><path d='M10 30l18 10l10-6l20 14M56 74l14-10l20 8'/></g>" }) }),
  Object.freeze({ id: 'sternenstaub', hell: '#dcd6f4', dunkel: '#6656aa', rand: '#1e1640', familie: 'legendaer', seltenheit: 'legende', weg: Object.freeze({ art: 'stufe', familie: 'sterne', stufe: 'gold' }), bewegung: 'glanz', glanz: 'rgba(220,210,255,.12)',
    muster: Object.freeze({ h: "<g fill='rgba(30,22,64,.12)'><circle cx='18' cy='22' r='1.6'/><circle cx='66' cy='14' r='1.2'/><circle cx='44' cy='52' r='1.8'/><circle cx='84' cy='62' r='1.3'/><circle cx='26' cy='82' r='1.4'/></g>",
      d: "<g fill='rgba(255,255,255,.12)'><circle cx='18' cy='22' r='1.6'/><circle cx='66' cy='14' r='1.2'/><circle cx='44' cy='52' r='1.8'/><circle cx='84' cy='62' r='1.3'/><circle cx='26' cy='82' r='1.4'/></g>" }) }),
  Object.freeze({ id: 'kronjuwel', hell: '#f4e4f0', dunkel: '#96447a', rand: '#3a0e2a', familie: 'legendaer', seltenheit: 'legende', weg: Object.freeze({ art: 'stufe', familie: 'liga', stufe: 'gold' }), bewegung: 'glanz', glanz: 'rgba(255,200,236,.12)',
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(58,14,42,.12)' stroke-width='1.6'><path d='M50 8L92 50L50 92L8 50ZM50 8V92M8 50H92'/></g>",
      d: "<g fill='none' stroke='rgba(255,255,255,.12)' stroke-width='1.6'><path d='M50 8L92 50L50 92L8 50ZM50 8V92M8 50H92'/></g>" }) }),
  Object.freeze({ id: 'phoenix', hell: '#fbe0c4', dunkel: '#b0482a', rand: '#4a1608', familie: 'legendaer', seltenheit: 'legende', weg: Object.freeze({ art: 'stufe', familie: 'siege', stufe: 'gold' }), bewegung: 'glanz', glanz: 'rgba(255,200,140,.12)',
    muster: Object.freeze({ h: "<g fill='rgba(74,22,8,.12)'><ellipse cx='26' cy='30' rx='9' ry='4' transform='rotate(-30 26 30)'/><ellipse cx='72' cy='68' rx='10' ry='4.5' transform='rotate(25 72 68)'/></g>",
      d: "<g fill='rgba(255,255,255,.12)'><ellipse cx='26' cy='30' rx='9' ry='4' transform='rotate(-30 26 30)'/><ellipse cx='72' cy='68' rx='10' ry='4.5' transform='rotate(25 72 68)'/></g>" }) }),
  Object.freeze({ id: 'tiefenleuchten', hell: '#cfe4ec', dunkel: '#36687f', rand: '#0e2430', familie: 'legendaer', seltenheit: 'legende', weg: Object.freeze({ art: 'stufe', familie: 'level', stufe: 'gold' }), bewegung: 'glanz', glanz: 'rgba(170,230,255,.12)',
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(14,36,48,.12)' stroke-width='1.6'><circle cx='26' cy='70' r='6'/><circle cx='40' cy='48' r='3.5'/><circle cx='72' cy='30' r='5'/></g>",
      d: "<g fill='none' stroke='rgba(255,255,255,.12)' stroke-width='1.6'><circle cx='26' cy='70' r='6'/><circle cx='40' cy='48' r='3.5'/><circle cx='72' cy='30' r='5'/></g>" }) }),
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
export const LABOR_KLAENGE = Object.freeze(['juwel', 'grusel', 'kristall']);

export function istLabor(art, id) {
  if (art === 'brett') return LABOR_BRETTER.some((b) => b.id === id);
  if (art === 'figuren') return LABOR_FIGUREN.includes(id);
  if (art === 'klang') return LABOR_KLAENGE.includes(id);
  return false;
}
export const laborFrei = () => istErfinder();
export const brettWahl = (id) => (istLabor('brett', id) && !laborFrei() ? 'nacht' : id);
export const klangWahl = (id) => (istLabor('klang', id) && !laborFrei() ? '' : id);

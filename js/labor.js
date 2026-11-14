// Labor (Flo 31.10.2026: "Mehr Bretter-Skins ... nur in meinem Account, ich sage, welche dann irgendwann erwerblich sind,
// denk dir was aus, z. B. Halloween-Skins, auch die Figuren ... bei den Klaengen genauso, markiere die, die andere nicht
// sehen koennen; ich kann die benutzen, die anderen nicht"). Was hier steht, sieht und benutzt nur das Erfinder-Konto
// (js/sonderstuecke.js istErfinder); fuer alle anderen gibt es diese Stuecke nicht. Flo entscheidet spaeter, was davon
// erspielbar oder kaeuflich wird: dann wandert es hier heraus.
//
//   LABOR_BRETTER   [{ id, hell, dunkel, rand, familie, seltenheit, weg, welt?, muster?, flaeche?, bewegung?, glanz? }]
//                   Farben wie css/tokens.css html[data-brett="<id>"] (die Bloecke schreibt werkzeuge/bretter-css.mjs), rand
//                   fuers Sammelbild und die Toene der Oberflaeche; seltenheit 'gewoehnlich' | 'selten' | 'episch' |
//                   'legende'. muster { h, d } (nur gewoehnliche): leichte Zeichnung je Feld (viewBox 100), gleich wie
//                   --feld-muster-* in tokens.css. flaeche { art } (selten bis legende, Flo 14.11.2026 "nur Farben"): eine
//                   Oberflaeche ueber das ganze Brett aus js/brett-flaechen.js, gesetzt von brettFlaeche.
//                   bewegung 'glanz' (nur Legendaer): leiser Lichtstreif, glanz = Farbe
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
//   brettFlaeche(html, id, frei?) -> Promise   setzt --feld-muster-hell/-dunkel/-groesse am html fuer ein Brett mit
//                                              flaeche (nur Erfinder), sonst raeumt es sie ab; laedt js/brett-flaechen.js
//                                              erst dann. Wechselt das Brett waehrend des Ladens, bleibt nichts stehen.
import { istErfinder } from './sonderstuecke.js';

export const BRETT_FAMILIEN = Object.freeze(['klassik', 'natur', 'edelstein', 'welten', 'nacht-neon', 'legendaer']);
const START = Object.freeze({ art: 'start' });
export const FREIE_BRETTER_PLAN = Object.freeze({
  nacht: Object.freeze({ familie: 'klassik', seltenheit: 'gewoehnlich', weg: START }),
  gruen: Object.freeze({ familie: 'klassik', seltenheit: 'gewoehnlich', weg: START }),
  holz: Object.freeze({ familie: 'klassik', seltenheit: 'gewoehnlich', weg: START }),
});
export const LABOR_BRETTER = Object.freeze([
  Object.freeze({ id: 'kuerbis', hell: '#f5d181', dunkel: '#3468cc', rand: '#0a214b', familie: 'nacht-neon', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 13 }), flaeche: Object.freeze({ art: 'spinne' }) }),
  Object.freeze({ id: 'frost', hell: '#c9d5cf', dunkel: '#5f6679', rand: '#181e2a', familie: 'natur', seltenheit: 'selten', weg: Object.freeze({ art: 'stufe', familie: 'serie', stufe: 'bronze' }), flaeche: Object.freeze({ art: 'eis' }) }),
  Object.freeze({ id: 'marmor', hell: '#ffffff', dunkel: '#686868', rand: '#202020', familie: 'klassik', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 8 }), flaeche: Object.freeze({ art: 'marmor' }) }),
  Object.freeze({ id: 'nussbaum', hell: '#ffc5a4', dunkel: '#736848', rand: '#262006', familie: 'klassik', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 16 }), flaeche: Object.freeze({ art: 'astholz' }) }),
  Object.freeze({ id: 'thron', hell: '#e1e7bc', dunkel: '#7c54c3', rand: '#270f5d', familie: 'edelstein', seltenheit: 'episch', weg: Object.freeze({ art: 'level', n: 35 }), flaeche: Object.freeze({ art: 'samt' }) }),
  // Welten-Bretter (31.10.2026): je Welt eines mit leichter Struktur je Feld (css/tokens.css --feld-muster-*); welt = Nummer
  Object.freeze({ id: 'acker', hell: '#f4f2b7', dunkel: '#988202', rand: '#403604', familie: 'welten', seltenheit: 'selten', weg: Object.freeze({ art: 'endgegner', welt: 1 }), welt: 1, flaeche: Object.freeze({ art: 'furchen' }) }),
  Object.freeze({ id: 'moos', hell: '#ced9b8', dunkel: '#4d7255', rand: '#0b2613', familie: 'welten', seltenheit: 'selten', weg: Object.freeze({ art: 'endgegner', welt: 2 }), welt: 2, flaeche: Object.freeze({ art: 'moos' }) }),
  Object.freeze({ id: 'pflaster', hell: '#dddcc5', dunkel: '#836367', rand: '#311c1f', familie: 'welten', seltenheit: 'episch', weg: Object.freeze({ art: 'endgegner', welt: 3 }), welt: 3, flaeche: Object.freeze({ art: 'stein' }) }),
  Object.freeze({ id: 'brandung', hell: '#edecc8', dunkel: '#157baf', rand: '#042c42', familie: 'welten', seltenheit: 'episch', weg: Object.freeze({ art: 'endgegner', welt: 4 }), welt: 4, flaeche: Object.freeze({ art: 'wellen' }) }),
  Object.freeze({ id: 'tiefsee', hell: '#cbf0f7', dunkel: '#3c67a7', rand: '#0b1f39', familie: 'welten', seltenheit: 'episch', weg: Object.freeze({ art: 'endgegner', welt: 5 }), welt: 5, flaeche: Object.freeze({ art: 'blasen' }) }),
  // 65 Bretter (Flo 14.11.2026: "65 Bretter-Skins, schoene, ueberdenken"): 52 neue in sechs Familien, erst im Labor, damit
  // Flo streichen kann; weg ist nur geplant (vorhandene Mechanik), noch nichts schaltet sie frei
  Object.freeze({ id: 'ahorn', hell: '#f0d6be', dunkel: '#596400', rand: '#5a3e1e', familie: 'klassik', seltenheit: 'gewoehnlich', weg: Object.freeze({ art: 'level', n: 3 }) }),
  Object.freeze({ id: 'schiefer', hell: '#e8f5fd', dunkel: '#7e9081', rand: '#2c343b', familie: 'klassik', seltenheit: 'gewoehnlich', weg: Object.freeze({ art: 'level', n: 5 }),
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(44,52,59,.12)' stroke-width='1.6'><path d='M0 34l100-12M0 70l100-14'/></g>",
      d: "<g fill='none' stroke='rgba(44,52,59,.16)' stroke-width='1.6'><path d='M0 34l100-12M0 70l100-14'/></g>" }) }),
  Object.freeze({ id: 'turnier', hell: '#fffff4', dunkel: '#109ec0', rand: '#24364d', familie: 'klassik', seltenheit: 'gewoehnlich', weg: Object.freeze({ art: 'stufe', familie: 'siege', stufe: 'bronze' }) }),
  Object.freeze({ id: 'elfenbein', hell: '#dce3e0', dunkel: '#a27052', rand: '#482813', familie: 'klassik', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 12 }), flaeche: Object.freeze({ art: 'schreger' }) }),
  Object.freeze({ id: 'ebenholz', hell: '#d5d3b9', dunkel: '#786639', rand: '#261f09', familie: 'klassik', seltenheit: 'selten', weg: Object.freeze({ art: 'stufe', familie: 'siege', stufe: 'silber' }), flaeche: Object.freeze({ art: 'feinholz' }) }),
  Object.freeze({ id: 'kirsche', hell: '#fdd1ba', dunkel: '#9a5a6b', rand: '#401422', familie: 'klassik', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 20 }), flaeche: Object.freeze({ art: 'maserung' }) }),
  Object.freeze({ id: 'wiese', hell: '#cdd4d4', dunkel: '#688707', rand: '#34501f', familie: 'natur', seltenheit: 'gewoehnlich', weg: Object.freeze({ art: 'level', n: 4 }),
    muster: Object.freeze({ h: "<g fill='rgba(52,80,31,.12)'><circle cx='22' cy='24' r='3'/><circle cx='70' cy='36' r='2.4'/><circle cx='40' cy='72' r='3.2'/><circle cx='82' cy='80' r='2'/></g>",
      d: "<g fill='rgba(52,80,31,.16)'><circle cx='22' cy='24' r='3'/><circle cx='70' cy='36' r='2.4'/><circle cx='40' cy='72' r='3.2'/><circle cx='82' cy='80' r='2'/></g>" }) }),
  Object.freeze({ id: 'duene', hell: '#fef8fc', dunkel: '#a78d68', rand: '#5b4120', familie: 'natur', seltenheit: 'gewoehnlich', weg: Object.freeze({ art: 'stufe', familie: 'raetsel', stufe: 'bronze' }),
    muster: Object.freeze({ h: "<g fill='none' stroke='rgba(91,65,32,.12)' stroke-width='2.4' stroke-linecap='round'><path d='M0 30q25-10 50 0t50 0M0 66q25-10 50 0t50 0'/></g>",
      d: "<g fill='none' stroke='rgba(91,65,32,.16)' stroke-width='2.4' stroke-linecap='round'><path d='M0 30q25-10 50 0t50 0M0 66q25-10 50 0t50 0'/></g>" }) }),
  Object.freeze({ id: 'birke', hell: '#e9e8de', dunkel: '#88888e', rand: '#33342f', familie: 'natur', seltenheit: 'gewoehnlich', weg: Object.freeze({ art: 'level', n: 7 }),
    muster: Object.freeze({ h: "<g stroke='rgba(51,52,47,.12)' stroke-width='3' stroke-linecap='round'><path d='M18 20h16M60 34h22M30 62h14M64 80h18'/></g>",
      d: "<g stroke='rgba(51,52,47,.16)' stroke-width='3' stroke-linecap='round'><path d='M18 20h16M60 34h22M30 62h14M64 80h18'/></g>" }) }),
  Object.freeze({ id: 'herbst', hell: '#dfdcab', dunkel: '#cc2840', rand: '#4a050f', familie: 'natur', seltenheit: 'selten', weg: Object.freeze({ art: 'stufe', familie: 'bots', stufe: 'bronze' }), flaeche: Object.freeze({ art: 'laub' }) }),
  Object.freeze({ id: 'kirschbluete', hell: '#fefefe', dunkel: '#a9768e', rand: '#502d3e', familie: 'natur', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 15 }), flaeche: Object.freeze({ art: 'bluete' }) }),
  Object.freeze({ id: 'lavendel', hell: '#ced0ea', dunkel: '#805f7c', rand: '#2f192d', familie: 'natur', seltenheit: 'selten', weg: Object.freeze({ art: 'stufe', familie: 'sterne', stufe: 'bronze' }), flaeche: Object.freeze({ art: 'halme' }) }),
  Object.freeze({ id: 'bambus', hell: '#fefffe', dunkel: '#816d0f', rand: '#202020', familie: 'natur', seltenheit: 'selten', weg: Object.freeze({ art: 'stufe', familie: 'raetsel', stufe: 'silber' }), flaeche: Object.freeze({ art: 'bambus' }) }),
  Object.freeze({ id: 'sonnenblume', hell: '#f9cf97', dunkel: '#01750f', rand: '#202020', familie: 'natur', seltenheit: 'selten', weg: Object.freeze({ art: 'stufe', familie: 'serie', stufe: 'silber' }), flaeche: Object.freeze({ art: 'sonnenblume' }) }),
  Object.freeze({ id: 'gletscher', hell: '#cfd3cf', dunkel: '#047187', rand: '#00232c', familie: 'natur', seltenheit: 'episch', weg: Object.freeze({ art: 'stufe', familie: 'sterne', stufe: 'silber' }), flaeche: Object.freeze({ art: 'gletscher' }) }),
  Object.freeze({ id: 'vulkan', hell: '#cecece', dunkel: '#964441', rand: '#3a0000', familie: 'natur', seltenheit: 'episch', weg: Object.freeze({ art: 'stufe', familie: 'siegesfolge', stufe: 'silber' }), flaeche: Object.freeze({ art: 'glut' }) }),
  Object.freeze({ id: 'topas', hell: '#d8eeff', dunkel: '#048dc9', rand: '#0e3b55', familie: 'edelstein', seltenheit: 'selten', weg: Object.freeze({ art: 'stufe', familie: 'siegesfolge', stufe: 'bronze' }), flaeche: Object.freeze({ art: 'schliff' }) }),
  Object.freeze({ id: 'amethyst', hell: '#e1d0e7', dunkel: '#a430b0', rand: '#37063c', familie: 'edelstein', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 25 }), flaeche: Object.freeze({ art: 'druse' }) }),
  Object.freeze({ id: 'perlmutt', hell: '#fff2f7', dunkel: '#698c9e', rand: '#233d4a', familie: 'edelstein', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 22 }), flaeche: Object.freeze({ art: 'perlmutt' }) }),
  Object.freeze({ id: 'jade', hell: '#eaffed', dunkel: '#05997b', rand: '#0d4235', familie: 'edelstein', seltenheit: 'selten', weg: Object.freeze({ art: 'stufe', familie: 'welten', stufe: 'silber' }), flaeche: Object.freeze({ art: 'jade' }) }),
  Object.freeze({ id: 'bernstein', hell: '#fde6ba', dunkel: '#bb4917', rand: '#202020', familie: 'edelstein', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 28 }), flaeche: Object.freeze({ art: 'einschluss' }) }),
  Object.freeze({ id: 'smaragd', hell: '#fcfdff', dunkel: '#2e974b', rand: '#15401f', familie: 'edelstein', seltenheit: 'episch', weg: Object.freeze({ art: 'stufe', familie: 'bots', stufe: 'gold' }), flaeche: Object.freeze({ art: 'stufenschliff' }) }),
  Object.freeze({ id: 'saphir', hell: '#fefefe', dunkel: '#595cc4', rand: '#181a45', familie: 'edelstein', seltenheit: 'episch', weg: Object.freeze({ art: 'stufe', familie: 'bots', stufe: 'silber' }), flaeche: Object.freeze({ art: 'brillant' }) }),
  Object.freeze({ id: 'rubin', hell: '#feeaf1', dunkel: '#ce5f6b', rand: '#671726', familie: 'edelstein', seltenheit: 'episch', weg: Object.freeze({ art: 'level', n: 50 }), flaeche: Object.freeze({ art: 'schliff' }) }),
  Object.freeze({ id: 'opal', hell: '#feeff4', dunkel: '#00686a', rand: '#202020', familie: 'edelstein', seltenheit: 'episch', weg: Object.freeze({ art: 'stufe', familie: 'raetsel', stufe: 'gold' }), flaeche: Object.freeze({ art: 'opal' }) }),
  Object.freeze({ id: 'onyx', hell: '#eae6f1', dunkel: '#7d605a', rand: '#2c1a16', familie: 'edelstein', seltenheit: 'episch', weg: Object.freeze({ art: 'stufe', familie: 'liga', stufe: 'silber' }), flaeche: Object.freeze({ art: 'onyx' }) }),
  Object.freeze({ id: 'scheune', hell: '#dcd4d4', dunkel: '#a35000', rand: '#202020', familie: 'welten', seltenheit: 'selten', weg: Object.freeze({ art: 'welt', welt: 1 }), welt: 1, flaeche: Object.freeze({ art: 'planken' }) }),
  Object.freeze({ id: 'heuboden', hell: '#f7f7e7', dunkel: '#c08604', rand: '#50400e', familie: 'welten', seltenheit: 'gewoehnlich', weg: Object.freeze({ art: 'level', n: 10 }), welt: 1,
    muster: Object.freeze({ h: "<g stroke='rgba(80,64,14,.12)' stroke-width='2' stroke-linecap='round'><path d='M16 84l8-26M30 86l3-30M70 40l6-24M84 44l-2-26'/></g>",
      d: "<g stroke='rgba(80,64,14,.16)' stroke-width='2' stroke-linecap='round'><path d='M16 84l8-26M30 86l3-30M70 40l6-24M84 44l-2-26'/></g>" }) }),
  Object.freeze({ id: 'lichtung', hell: '#bbdbb3', dunkel: '#5f7000', rand: '#202020', familie: 'welten', seltenheit: 'selten', weg: Object.freeze({ art: 'welt', welt: 2 }), welt: 2, flaeche: Object.freeze({ art: 'laub' }) }),
  Object.freeze({ id: 'koehlerglut', hell: '#e6ceb7', dunkel: '#7f5841', rand: '#2c1300', familie: 'welten', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 18 }), welt: 2, flaeche: Object.freeze({ art: 'glut' }) }),
  Object.freeze({ id: 'rathausuhr', hell: '#dbd6da', dunkel: '#686d4e', rand: '#1f230d', familie: 'welten', seltenheit: 'episch', weg: Object.freeze({ art: 'welt', welt: 3 }), welt: 3, flaeche: Object.freeze({ art: 'uhrwerk' }) }),
  Object.freeze({ id: 'bibliothek', hell: '#f8dcc8', dunkel: '#507080', rand: '#0b2530', familie: 'welten', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 26 }), welt: 3, flaeche: Object.freeze({ art: 'buecher' }) }),
  Object.freeze({ id: 'leuchtturm', hell: '#fbf1da', dunkel: '#d5529c', rand: '#6d0147', familie: 'welten', seltenheit: 'episch', weg: Object.freeze({ art: 'welt', welt: 4 }), welt: 4, flaeche: Object.freeze({ art: 'strahlen' }) }),
  Object.freeze({ id: 'watt', hell: '#f9e6cf', dunkel: '#6d677e', rand: '#231f2e', familie: 'welten', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 34 }), welt: 4, flaeche: Object.freeze({ art: 'rippel' }) }),
  Object.freeze({ id: 'leuchtqualle', hell: '#c7d2f1', dunkel: '#2a698e', rand: '#031e2d', familie: 'welten', seltenheit: 'episch', weg: Object.freeze({ art: 'welt', welt: 5 }), welt: 5, flaeche: Object.freeze({ art: 'blasen' }) }),
  Object.freeze({ id: 'schatzkammer', hell: '#fde5b0', dunkel: '#717759', rand: '#272c17', familie: 'welten', seltenheit: 'episch', weg: Object.freeze({ art: 'level', n: 42 }), welt: 5, flaeche: Object.freeze({ art: 'muenzen' }) }),
  Object.freeze({ id: 'sternennacht', hell: '#e7dbfe', dunkel: '#6764aa', rand: '#1a1d4c', familie: 'nacht-neon', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 30 }), flaeche: Object.freeze({ art: 'sterne' }) }),
  Object.freeze({ id: 'mondschein', hell: '#d0e7fe', dunkel: '#5c5785', rand: '#141432', familie: 'nacht-neon', seltenheit: 'selten', weg: Object.freeze({ art: 'stufe', familie: 'endgegner', stufe: 'bronze' }), flaeche: Object.freeze({ art: 'mondschein' }) }),
  Object.freeze({ id: 'daemmerung', hell: '#f6c4b7', dunkel: '#6c5f9d', rand: '#1f1943', familie: 'nacht-neon', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 38 }), flaeche: Object.freeze({ art: 'daemmerung' }) }),
  Object.freeze({ id: 'nachtmarkt', hell: '#e5d69e', dunkel: '#954f80', rand: '#3c092f', familie: 'nacht-neon', seltenheit: 'selten', weg: Object.freeze({ art: 'level', n: 40 }), flaeche: Object.freeze({ art: 'lichter' }) }),
  Object.freeze({ id: 'geisterstunde', hell: '#eefee9', dunkel: '#77779c', rand: '#2c2d46', familie: 'nacht-neon', seltenheit: 'selten', weg: Object.freeze({ art: 'stufe', familie: 'endgegner', stufe: 'silber' }), flaeche: Object.freeze({ art: 'nebel' }) }),
  Object.freeze({ id: 'gewitter', hell: '#d3d3d3', dunkel: '#865da1', rand: '#331747', familie: 'nacht-neon', seltenheit: 'episch', weg: Object.freeze({ art: 'level', n: 45 }), flaeche: Object.freeze({ art: 'blitz' }) }),
  Object.freeze({ id: 'neon', hell: '#b8f3e4', dunkel: '#ac4da0', rand: '#4d0147', familie: 'nacht-neon', seltenheit: 'episch', weg: Object.freeze({ art: 'stufe', familie: 'siegesfolge', stufe: 'gold' }), flaeche: Object.freeze({ art: 'neon' }) }),
  Object.freeze({ id: 'synthwave', hell: '#ffc7e7', dunkel: '#93537b', rand: '#3b0e2c', familie: 'nacht-neon', seltenheit: 'episch', weg: Object.freeze({ art: 'stufe', familie: 'liga', stufe: 'bronze' }), flaeche: Object.freeze({ art: 'synthwave' }) }),
  Object.freeze({ id: 'cyber', hell: '#c4fce0', dunkel: '#357770', rand: '#0c2825', familie: 'nacht-neon', seltenheit: 'episch', weg: Object.freeze({ art: 'stufe', familie: 'welten', stufe: 'gold' }), flaeche: Object.freeze({ art: 'schaltung' }) }),
  Object.freeze({ id: 'nordlicht', hell: '#d4d4d5', dunkel: '#0a806a', rand: '#012d24', familie: 'legendaer', seltenheit: 'legende', weg: Object.freeze({ art: 'stufe', familie: 'serie', stufe: 'gold' }), bewegung: 'glanz', glanz: 'rgba(160,255,220,.12)', flaeche: Object.freeze({ art: 'polarlicht' }) }),
  Object.freeze({ id: 'sonnenkrone', hell: '#f8ffce', dunkel: '#9e5c0a', rand: '#202020', familie: 'legendaer', seltenheit: 'legende', weg: Object.freeze({ art: 'level', n: 100 }), bewegung: 'glanz', glanz: 'rgba(255,236,170,.12)', flaeche: Object.freeze({ art: 'sonnenkrone' }) }),
  Object.freeze({ id: 'drachenglut', hell: '#fec6ac', dunkel: '#cf2028', rand: '#4b0200', familie: 'legendaer', seltenheit: 'legende', weg: Object.freeze({ art: 'stufe', familie: 'endgegner', stufe: 'gold' }), bewegung: 'glanz', glanz: 'rgba(255,180,110,.12)', flaeche: Object.freeze({ art: 'schuppen' }) }),
  Object.freeze({ id: 'sternenstaub', hell: '#edd8f5', dunkel: '#1f86dd', rand: '#13375d', familie: 'legendaer', seltenheit: 'legende', weg: Object.freeze({ art: 'stufe', familie: 'sterne', stufe: 'gold' }), bewegung: 'glanz', glanz: 'rgba(220,210,255,.12)', flaeche: Object.freeze({ art: 'sternenstaub' }) }),
  Object.freeze({ id: 'kronjuwel', hell: '#f4f3f7', dunkel: '#b62681', rand: '#3e0228', familie: 'legendaer', seltenheit: 'legende', weg: Object.freeze({ art: 'stufe', familie: 'liga', stufe: 'gold' }), bewegung: 'glanz', glanz: 'rgba(255,200,236,.12)', flaeche: Object.freeze({ art: 'kronjuwel' }) }),
  Object.freeze({ id: 'phoenix', hell: '#fafafa', dunkel: '#d52f16', rand: '#202020', familie: 'legendaer', seltenheit: 'legende', weg: Object.freeze({ art: 'stufe', familie: 'siege', stufe: 'gold' }), bewegung: 'glanz', glanz: 'rgba(255,200,140,.12)', flaeche: Object.freeze({ art: 'federn' }) }),
  Object.freeze({ id: 'tiefenleuchten', hell: '#c0ebf8', dunkel: '#486968', rand: '#061f1f', familie: 'legendaer', seltenheit: 'legende', weg: Object.freeze({ art: 'stufe', familie: 'level', stufe: 'gold' }), bewegung: 'glanz', glanz: 'rgba(170,230,255,.12)', flaeche: Object.freeze({ art: 'tiefenleuchten' }) }),
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
const FLAECHEN_VARS = ['--feld-muster-hell', '--feld-muster-dunkel', '--feld-muster-groesse'];
export function brettFlaeche(html, id, frei = laborFrei()) {
  const b = frei ? LABOR_BRETTER.find((x) => x.id === id && x.flaeche) : null;
  if (!b) { for (const v of FLAECHEN_VARS) html.style.removeProperty(v); return Promise.resolve(); }
  // offline und nicht im Cache: still bei den Farben bleiben; ein Fehler beim Zeichnen meldet sich weiter
  return import('./brett-flaechen.js').catch(() => null).then((mod) => {
    if (!mod || html.dataset.brett !== id) return;
    const { brettMuster, svgUrl, GROESSE } = mod;
    const m = brettMuster(b);
    html.style.setProperty('--feld-muster-hell', svgUrl(m.h));
    html.style.setProperty('--feld-muster-dunkel', svgUrl(m.d));
    html.style.setProperty('--feld-muster-groesse', GROESSE);
  }).catch((f) => console.error(f));
}

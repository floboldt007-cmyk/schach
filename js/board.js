// Brett-Komponente: DOM-Brett mit Tippen-Tippen und Ziehen (Pointer Events, iPad),
// Animation, Markierungen, Pfeilen, Zug-Klassen-Abzeichen und Umwandlungsauswahl.
// Kennt keine Schachregeln: welche Zuege gehen, sagt die App ueber erlaubeZuege().
//
// DOM (Klassennamen fuer css/app.css, Grundstil in css/board.css):
//   .brett[data-ausrichtung="w"|"b"][.koord-rand]        das uebergebene Element (ohne padding/border)
//     .brett-felder                                      8x8 Felder (absolut, je 12,5 %), abgerundet, schneidet ab
//       .feld.h | .feld.d [data-feld]                    Felder, darin .koord.zahl / .koord.buchst (Lage "ecke")
//       .brett-lagen > .lage.<art>[data-feld]            Ueberlagerungen: zuletzt, auswahl, vorschau, schach,
//                                                        ziel (Punkt), ziel.schlag (Ringecken), ziel.rochade, ueber, mark-<art>
//       svg.brett-nutzer.brett-marken > rect.marke[data-feld]   Flos Marken (faerben das Feld, nicht die Figur)
//     (.brett-felder ist ein eigener Stapelkontext: alles darin liegt UNTER den Figuren, wie in Entwurf A)
//     .brett-koord-rand > .koord.zahl / .koord.buchst    Koordinaten bei Lage "rand" (ausserhalb, im Sockel)
//     img.figur[data-feld][data-figur="wN"]              Figuren; Zustaende .angehoben .gleitet .gezogen .geht .kommt .vorschau
//     svg.brett-pfeile > g.pfeil[data-von][data-nach]    Coach-Pfeile (viewBox 0 0 8 8), pfeile(liste)
//     svg.brett-nutzer > g.pfeil[data-von][data-nach]    Flos eigene Pfeile ueber den Figuren (getrennt von den Coach-Pfeilen)
//     .abzeichen-ort.k-<klasse>[data-feld][data-klasse]  Klassen-Symbol oben rechts am Feld (bleibt in der Brett-Box)
//     .brett-umwandlung > .umwandlung-wahl > button.umwandlung-figur[data-figur="q"]
//     svg.brett-striche > g.strich[data-art][data-von][data-nach]   W0+a: Striche (im Brett oder in einer Effekt-Ebene)
// Alles, was auf einem Feld sitzt, traegt --x/--y (Spalte/Zeile am Bildschirm, 0..7) UND fertig berechnete
// Prozentwerte (left/top), damit kein Browser die Lage ueber calc(var(--x) * 12,5 %) selbst runden muss
// (WebKit rundete anders als Chromium). Animiert werden nur transform und opacity.
//
// Oeffentliche API (Vertrag, ARCHITEKTUR.md "Brett"):
//   new Brett(el, { ausrichtung, figurenPfad, beiZug, koordinaten, koordLage, animation (ms, Standard 150),
//                   fen, beiAbgelehnt, beiLeer, autoDame, bestaetigen, steuerung, turmRochade, pfeile })
//   beiZug(von, nach, umwandlung, { art: 'tippen' | 'ziehen', landung }) -> true | false | Promise
//       landung: ms, bis die gezogene Figur auf dem Ziel steht (0 = steht schon dort: gezogen, Vorschau bestaetigt,
//       Umwandlung gewaehlt, Bewegung aus). Die Partie legt den Zug-Klang darauf; das Brett spielt keinen Klang.
//   setzeStellung, setzeAusrichtung, dreheUm, erlaubeZuege, zeigeVorzuege, zeigeAbzeichen, entferneAbzeichen,
//   pfeile, markiere, koordinaten(an), setzeKoordLage('ecke' | 'rand'), setzeAutoDame, setzeBestaetigen(bool),
//   setzeSteuerung('beides' | 'ziehen' | 'tippen'), setzeTurmRochade(bool), setzeDauer(ms), gleitDauer() (ms, mit
//   Tempo; 0 = sofort), setzePfeileErlaubt(bool), nutzerPfeile() -> [{ art: 'pfeil', von, nach } | { art: 'marke', feld }],
//   loescheNutzerPfeile(), striche, kippeKoenig, richteAuf, figurAuf, zerstoere
//   zielKarte(chess, { turmRochade }) erlaubt mit turmRochade Koenig -> eigener Turm als Rochade.
//
// Komfort (Premium-Umbau U6, PLAN Abschnitt 4):
//   bestaetigen: Zug bestaetigen. Erster Tipp/Abwurf zeigt die Figur halb durchsichtig auf dem Ziel (Vorschau),
//       zweiter Tipp aufs Ziel macht fest (erst dann beiZug), Tipp anderswo nimmt zurueck. Ist das eine eigene ziehbare
//       Figur, wird sie gewaehlt; sonst tut der Tipp nichts weiter (kein beiLeer, Flos Zeichnungen bleiben).
//   autoDame: Umwandlung ohne Auswahl; Finger/Maus 450 ms auf dem Zielfeld halten zeigt D T L S. Verrutscht der Finger
//       dabei (8 px), gilt das Loslassen auf dem Zielfeld als Tipp (Dame), daneben passiert nichts (Auswahl bleibt).
//   steuerung: 'beides' | 'ziehen' (kein Tipp-Zug) | 'tippen' (kein Ziehen). Ein zweiter Zeiger bricht jede Geste ab,
//       zwei Finger ergeben nie einen Zug: deshalb zieht ein Finger-Tipp aufs Ziel erst beim Loslassen (die Maus beim
//       Druecken), ein zweiter Finger oder pointercancel bis dahin nimmt ihn zurueck. Zieh-Schwelle 8 px (Maus 4 px).
//   turmRochade: ein Zug Koenig -> eigener Turm (aus der Zielkarte) wird als Rochade ausgefuehrt. Mit setzeTurmRochade(true)
//       ergaenzt das Brett jede Zielkarte selbst um den Turm (auch zielKarte(chess) ohne Option); bei Zug bestaetigen
//       macht der zweite Tipp auf das Ziel (g1/c1) oder auf den Turm fest.
//   pfeile: Maus Rechtsklick ziehen = Pfeil, Rechtsklick auf ein Feld = Marke (erneut = weg), Linksklick ins Brett
//       ohne Auswahl loescht alles. Finger: 400 ms halten und ziehen = Pfeil, halten = Marke, Tipp ohne Auswahl loescht.
//       Nie aus einer eigenen Zug-Geste: ein Finger auf einer Figur, die gerade ziehen darf (auch ein Vorzug), bleibt
//       immer Tippen/Ziehen, auch wenn er lange liegt. Malen beginnt also auf leeren Feldern, gegnerischen Figuren und
//       eigenen Figuren ohne Zug (mit der Maus per Rechtsklick ueberall). Die Partie loescht Coach-Pfeile mit pfeile([]),
//       Flos Zeichnungen bleiben davon unberuehrt (auch ueber setzeStellung hinweg). Rechtsklick ziehen und ausserhalb des
//       Bretts loslassen bricht ab. Die Zeiger-Ereignisse einer Zeichen-Geste (Rechtsklick-Druck, Bewegen, Loslassen)
//       gibt das Brett nicht an die Umgebung weiter (stopPropagation), damit z. B. das Wischen der Analyse beim Malen
//       nicht springt; Lauscher in der Capture-Phase (Klang entsperren) bekommen sie weiter.
//   beiLeer(feld): Maus sofort beim Druecken; Finger (bei erlaubten Pfeilen) erst beim Loslassen und nur, wenn daraus
//       keine Marke wurde, damit Halten zum Markieren die Vorzuege der Partie stehen laesst.
//
// W0+a "Spiel-Fundament" (SPIELKONZEPT 6.2, 3.9, 3.18):
//   new Brett(el, { ..., beiAbgelehnt(von, nach, art) })   meldet einen Zugversuch, den die Zielkarte nicht
//       erlaubt (nur waehrend erlaubeZuege() gesetzt ist): Figur auf ein nicht erlaubtes Feld gezogen oder getippt
//       (nach = Feld, art 'ziehen' | 'tippen'), oder eine eigene Figur ohne erlaubten Zug angetippt oder gezogen
//       (nach = null beim Antippen). Am Bild aendert sich dabei nichts. partie.js sendet daraus zug:abgelehnt.
//   striche(liste, { ebene = null, animieren = true }) -> { el, entferne() }
//       liste: [{ von, nach, art = 'linie' | 'haken' | 'kreuz', farbe, breite = 0.07, verzoegerung = 0 (ms) }]
//       'linie' von Feldmitte zu Feldmitte (Mattnetz: die Figur, die ein Fluchtfeld deckt), 'haken' und 'kreuz'
//       auf dem Feld nach (bzw. von). Gezeichnet in ebene (z. B. buehne.effekte, gleiche Lage wie die Felder)
//       oder im Brett ueber den Figuren; folgt dem Drehen des Bretts. Nur transform und opacity werden animiert,
//       reduzierte Bewegung zeigt sofort das fertige Bild.
//   kippeKoenig(feld, { langsam = false }) -> boolean   der Koenig auf feld kippt (Matt, Finisher); setzeStellung
//       und richteAuf() stellen ihn wieder auf. false, wenn dort kein Koenig steht.

import { KLASSEN_NAME } from './zugklassen.js';
import { anim, tempo } from './bewegung.js';

const DATEIEN = 'abcdefgh';
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const SVG_NS = 'http://www.w3.org/2000/svg';

const FIGUR_NAMEN = { q: 'Dame', r: 'Turm', b: 'Läufer', n: 'Springer' };
const UMWANDLUNG_REIHE = ['q', 'r', 'b', 'n']; // Vertrag: D T L S

const SCHWELLE_FINGER = 8;     // px, ab hier zieht der Finger (PLAN 4: 8 statt 7)
const SCHWELLE_MAUS = 4;
const HALTEN_UMWANDLUNG = 450; // ms auf dem Zielfeld: Auswahl D T L S trotz autoDame
const HALTEN_MALEN = 400;      // ms Finger auf einem Feld: Pfeil oder Marke statt Zug
const STANDARD_DAUER = 150;    // ms Gleiten wie bisher (mal Tempo); die Partie setzt per setzeDauer() die 300 ms aus --d-zug
const ABZEICHEN = { groesse: 0.48, versatz: 0.17 }; // Anteil der Feldbreite; am Brettrand wird es hineingeschoben
const STEUERUNGEN = ['beides', 'ziehen', 'tippen'];
const KOORD_LAGEN = ['ecke', 'rand'];

export const KLASSEN_TITEL = KLASSEN_NAME;

// Ersatzfarben, falls die Design-Variablen --k-* fehlen
const KLASSEN_ERSATZ = {
  brillant: '#7A4FD6', stark: '#2F67D8', bester: '#14936A', exzellent: '#5E9C4E', gut: '#7F928A',
  buch: '#A07A52', ungenau: '#D6A21C', fehler: '#DD7A2A', verpasst: '#B4468F', patzer: '#BC2A4C',
  erzwungen: '#878E9E',
};

// Farbnamen fuer Pfeile, die auf Vertrags-Variablen zeigen
const VAR_FARBEN = new Set(['hinweis', 'akzent', 'gut', 'schlecht', 'auswahl', 'zuletzt', 'schach', 'punkt']);

// ---------- Klassen-Symbole (austauschbar ueber setzeSymbole) ----------

const STRICH = 'fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"';
const zeichen = (t, groesse = 19) =>
  `<text x="20" y="21" text-anchor="middle" dominant-baseline="central" fill="#fff" font-size="${groesse}" ` +
  `font-weight="900" font-family="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">${t}</text>`;

const PLATZHALTER_ZEICHEN = {
  brillant: zeichen('!!'),
  stark: zeichen('!', 22),
  bester: '<path d="M20 9.2l3.2 6.6 7.3.9-5.4 5 1.4 7.2L20 25.3l-6.5 3.6 1.4-7.2-5.4-5 7.3-.9z" fill="#fff"/>',
  exzellent: `<path d="M13 20.5l7-6.5 7 6.5M13 27l7-6.5 7 6.5" ${STRICH} stroke-width="3.2"/>`,
  gut: `<path d="M13 23.5l7-7 7 7" ${STRICH} stroke-width="3.4"/>`,
  buch: `<path d="M10.5 13.2c3.2-1.3 6.3-1.1 9.5 1 3.2-2.1 6.3-2.3 9.5-1v13.4c-3.2-1.3-6.3-1.1-9.5 1-3.2-2.1-6.3-2.3-9.5-1z" ${STRICH} stroke-width="2.4"/><path d="M20 14.2v13.4" ${STRICH} stroke-width="2.2"/>`,
  ungenau: zeichen('?!'),
  fehler: zeichen('?', 22),
  verpasst: `<path d="M14.2 14.2l11.6 11.6M25.8 14.2L14.2 25.8" ${STRICH} stroke-width="3.6"/>`,
  patzer: zeichen('??'),
  erzwungen: `<path d="M11 20h16.5M21.5 14l6 6-6 6" ${STRICH} stroke-width="3.4"/>`,
};

function platzhalterSymbol(klasse) {
  const farbe = `var(--k-${klasse}, ${KLASSEN_ERSATZ[klasse] || '#8a93a8'})`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" aria-hidden="true">` +
    `<circle cx="20" cy="20" r="17.8" style="fill:${farbe}" stroke="#fff" stroke-width="2.4"/>` +
    (PLATZHALTER_ZEICHEN[klasse] || zeichen('?')) + '</svg>';
}

const eigeneSymbole = {};
const alleBretter = new Set();

// Symbole tauschen: setzeSymbole({ brillant: '<svg ...>', ... }); null setzt auf den Platzhalter zurueck.
export function setzeSymbole(karte) {
  for (const [klasse, svg] of Object.entries(karte || {})) {
    if (svg == null) delete eigeneSymbole[klasse];
    else eigeneSymbole[klasse] = String(svg);
  }
  for (const b of alleBretter) b._zeichneAbzeichen(false);
}

// Aktuelles SVG einer Klasse (auch fuer Coach-Zeile und Zugliste nutzbar)
export function symbolSvg(klasse) {
  return eigeneSymbole[klasse] || platzhalterSymbol(klasse);
}

// Zielkarte fuer erlaubeZuege() aus einer chess.js-Instanz: { e2: ['e3','e4'], ... }
// turmRochade: zusaetzlich Koenig -> eigener Turm (h1/a1 bzw. h8/a8) fuer jede erlaubte Rochade; das Brett
// fuehrt daraus den Rochadezug (Koenig nach g/c) aus.
export function zielKarte(chess, { turmRochade = false } = {}) {
  const karte = {};
  for (const z of chess.moves({ verbose: true })) {
    const liste = karte[z.from] || (karte[z.from] = []);
    if (!liste.includes(z.to)) liste.push(z.to);
    if (turmRochade && z.piece === 'k' && /[kq]/.test(z.flags || '')) {
      const turm = (z.flags.includes('k') ? 'h' : 'a') + z.from[1];
      if (!liste.includes(turm)) liste.push(turm);
    }
  }
  return karte;
}

// ---------- Hilfen ----------

function gueltigesFeld(f) {
  return typeof f === 'string' && /^[a-h][1-8]$/.test(f);
}

function leseFen(fen) {
  const text = fen === 'start' || !fen ? START_FEN : String(fen).trim();
  const teile = text.split(/\s+/);
  const reihen = teile[0].split('/');
  if (reihen.length !== 8) throw new Error('Ungültige FEN: ' + fen);
  const figuren = new Map();
  reihen.forEach((reihe, i) => {
    let datei = 0;
    for (const z of reihe) {
      if (z >= '1' && z <= '8') datei += Number(z);
      else if ('pnbrqkPNBRQK'.includes(z)) {
        if (datei > 7) throw new Error('Ungültige FEN: ' + fen);
        figuren.set(DATEIEN[datei] + (8 - i), (z === z.toUpperCase() ? 'w' : 'b') + z.toUpperCase());
        datei++;
      } else throw new Error('Ungültige FEN: ' + fen);
    }
    if (datei !== 8) throw new Error('Ungültige FEN: ' + fen);
  });
  return { figuren, amZug: teile[1] === 'b' ? 'b' : 'w' };
}

function feldAbstand(a, b) {
  return Math.hypot(a.charCodeAt(0) - b.charCodeAt(0), Number(a[1]) - Number(b[1]));
}

// Bauer <-> umgewandelte Figur (vor- und rueckwaerts), fuer eine gleitende Umwandlung
function istUmwandlungsPaar(altFeld, altCode, neuFeld, neuCode) {
  if (altCode[0] !== neuCode[0] || altCode === neuCode) return false;
  const dx = Math.abs(altFeld.charCodeAt(0) - neuFeld.charCodeAt(0));
  const dy = Math.abs(Number(altFeld[1]) - Number(neuFeld[1]));
  if (dx > 1 || dy !== 1) return false;
  const grund = (f) => f[1] === '1' || f[1] === '8';
  if (altCode[1] === 'P' && neuCode[1] !== 'K' && grund(neuFeld)) return true;
  if (neuCode[1] === 'P' && altCode[1] !== 'K' && grund(altFeld)) return true;
  return false;
}

// Zug auf eine Figurenkarte anwenden (Rochade, en passant, Umwandlung)
function wendeZugAn(alt, von, nach, umwandlung) {
  const neu = new Map(alt);
  const fig = neu.get(von);
  if (!fig) return neu;
  neu.delete(von);
  const farbe = fig[0];
  const art = fig[1];
  const dd = nach.charCodeAt(0) - von.charCodeAt(0);
  if (art === 'K' && Math.abs(dd) === 2 && von[1] === nach[1]) {
    const [turmVon, turmNach] = dd > 0 ? ['h', 'f'] : ['a', 'd'];
    if (neu.get(turmVon + von[1]) === farbe + 'R') {
      neu.delete(turmVon + von[1]);
      neu.set(turmNach + von[1], farbe + 'R');
    }
  }
  if (art === 'P' && dd !== 0 && !neu.has(nach)) {
    const opfer = nach[0] + von[1];
    const o = neu.get(opfer);
    if (o && o[1] === 'P' && o[0] !== farbe) neu.delete(opfer);
  }
  let ergebnis = fig;
  if (art === 'P' && (nach[1] === '8' || nach[1] === '1')) {
    ergebnis = farbe + String(umwandlung || 'q').toUpperCase();
  }
  neu.set(nach, ergebnis);
  return neu;
}

function farbeAus(farbe) {
  if (!farbe) return 'var(--k-bester, #2db45d)';
  if (KLASSEN_ERSATZ[farbe]) return `var(--k-${farbe}, ${KLASSEN_ERSATZ[farbe]})`;
  if (VAR_FARBEN.has(farbe)) return `var(--${farbe})`;
  return farbe;
}

function svgEl(name, attr) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attr)) el.setAttribute(k, v);
  return el;
}

const prozent = (n) => Number((n * 12.5).toFixed(3)) + '%';

// Pfeil von Feldmitte zu Feldmitte im 8x8-Raster (Springer als L); von === nach zeichnet einen Kreis.
function pfeilElement(von, nach, [x1, y1], [x2, y2], breite) {
  const g = svgEl('g', { class: 'pfeil', 'data-von': von, 'data-nach': nach });
  const r = (n) => n.toFixed(3);
  if (nach === von) {
    g.append(svgEl('circle', {
      cx: x1, cy: y1, r: 0.44, fill: 'none', stroke: 'currentColor', 'stroke-width': Math.max(0.07, breite * 0.45),
    }));
    return g;
  }
  const punkte = [[x1, y1]];
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  if ((dx === 1 && dy === 2) || (dx === 2 && dy === 1)) {
    punkte.push(dx === 2 ? [x2, y1] : [x1, y2]); // Springer als L, langer Schenkel zuerst
  }
  const [ax, ay] = punkte[punkte.length - 1];
  const laenge = Math.hypot(x2 - ax, y2 - ay);
  const ux = (x2 - ax) / laenge;
  const uy = (y2 - ay) / laenge;
  const kopfL = breite * 2.2;
  const kopfB = breite * 1.4;
  const sx = x2 - ux * 0.08;
  const sy = y2 - uy * 0.08;
  const bx = sx - ux * kopfL;
  const by = sy - uy * kopfL;
  const d = 'M ' + punkte.map(([x, y]) => r(x) + ' ' + r(y)).join(' L ') + ` L ${r(bx + ux * 0.02)} ${r(by + uy * 0.02)}`;
  g.append(svgEl('path', {
    d, fill: 'none', stroke: 'currentColor', 'stroke-width': breite,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'pfeil-linie',
  }));
  g.append(svgEl('polygon', {
    points: `${r(sx)},${r(sy)} ${r(bx - uy * kopfB)},${r(by + ux * kopfB)} ${r(bx + uy * kopfB)},${r(by - ux * kopfB)}`,
    fill: 'currentColor', class: 'pfeil-kopf',
  }));
  return g;
}

// ---------- Brett ----------

export class Brett {
  constructor(element, { ausrichtung = 'w', figurenPfad = 'assets/pieces/', beiZug = null,
    koordinaten = true, koordLage = 'ecke', animation = STANDARD_DAUER, fen = null, beiAbgelehnt = null, beiLeer = null,
    autoDame = false, bestaetigen = false, steuerung = 'beides', turmRochade = false, pfeile = true } = {}) {
    if (!element) throw new Error('Brett braucht ein Element');
    this.el = element;
    this.figurenPfad = figurenPfad.endsWith('/') ? figurenPfad : figurenPfad + '/';
    this.beiZug = beiZug;
    this.beiAbgelehnt = typeof beiAbgelehnt === 'function' ? beiAbgelehnt : null;
    this.beiLeer = typeof beiLeer === 'function' ? beiLeer : null;
    this.autoDame = !!autoDame;
    this.bestaetigen = !!bestaetigen;
    this.steuerung = STEUERUNGEN.includes(steuerung) ? steuerung : 'beides';
    this.turmRochade = !!turmRochade;
    this.pfeileErlaubt = pfeile !== false;
    this._stumm = null;          // Geste auf einer eigenen Figur ohne erlaubten Zug (nur fuer beiAbgelehnt)
    this._striche = new Set();   // gezeichnete Striche (W0+a)
    this._gekippt = new Set();   // gekippte Koenige (img)
    this.ausrichtung = ausrichtung === 'b' ? 'b' : 'w';
    this.dauer = Number(animation) >= 0 ? Number(animation) : STANDARD_DAUER;

    this._figuren = new Map();   // feld -> img
    this._erlaubt = null;        // Map feld -> Set(ziele) oder null
    this._karte = null;          // Zielkarte, wie die App sie uebergeben hat (fuer setzeTurmRochade)
    this._leerOffen = null;      // Finger auf einem Feld ohne Zug: beiLeer erst beim Loslassen { id, feld }
    this._erlaubtVersion = 0;
    this._stellungVersion = 0;
    this._letzter = null;
    this._schach = null;
    this._auswahl = null;
    this._ueber = null;
    this._marken = new Map();    // art -> Set(felder)
    this._lagen = new Map();     // schluessel -> element
    this._pfeile = [];
    this._nutzer = { pfeile: [], marken: [] };   // Flos eigene Pfeile und Marken
    this._abzeichen = null;
    this._abzeichenEl = null;
    this._geste = null;          // laufende Tipp-/Zieh-Geste { id, von, x0, y0, typ, zieht, warSchon, el, ueberSeit }
    this._halten = null;         // Tipp aufs Ziel bis zum Loslassen (Finger; Umwandlung mit autoDame auch Maus) { id, von, nach, x0, y0, timer, bewegt }
    this._halteMal = null;       // Finger liegt auf einem Feld (400 ms -> malen) { id, feld, x0, y0, timer, geste }
    this._malen = null;          // laufende Zeichen-Geste { id, von, nach }
    this._vorschau = null;       // Zug bestaetigen: { von, nach, art, el }
    this._umwandlung = null;
    this._wartet = false;
    this._koord = !!koordinaten;
    this._koordLage = KOORD_LAGEN.includes(koordLage) ? koordLage : 'ecke';
    this._cursorFeld = null;

    this._baue();
    alleBretter.add(this);
    if (fen) this.setzeStellung(fen, { animieren: false });
  }

  // ----- oeffentliche API (Vertrag) -----

  setzeStellung(fen, { animieren = true, letzterZug = null, schach = null } = {}) {
    const { figuren, amZug } = leseFen(fen);
    this._stellungVersion++;
    if (this._gekippt.size) this.richteAuf();
    if (this._umwandlung) this._brichUmwandlungAb(false);
    if (this._vorschau) this._brichVorschauAb(false);
    if (this._geste) this._brichGesteAb(false);
    this._loescheHalten();
    this._auswahl = null;
    this._ueber = null;
    this._letzter = this._normiereLetzten(letzterZug);
    if (schach === true) {
      this._schach = [...figuren].find(([, c]) => c === amZug + 'K')?.[0] || null;
    } else this._schach = gueltigesFeld(schach) ? schach : null;
    this._zeigeFiguren(figuren, animieren && this._figuren.size > 0);
    this._zeichneLagen();
  }

  setzeAusrichtung(farbe) {
    const neu = farbe === 'b' ? 'b' : 'w';
    if (neu === this.ausrichtung) return;
    if (this._umwandlung) this._brichUmwandlungAb(false);
    if (this._vorschau) this._brichVorschauAb(false);
    if (this._geste) this._brichGesteAb(false);
    this._loescheHalten();
    this.ausrichtung = neu;
    this.el.dataset.ausrichtung = neu;
    this._beschrifte();
    for (const [feld, el] of this._figuren) { this._stoppeGleiten(el); this._platziere(el, feld); }
    for (const el of this._lagen.values()) this._platziere(el, el.dataset.feld);
    if (this._abzeichenEl) this._platziereAbzeichen(this._abzeichenEl, this._abzeichen.feld);
    this._zeichnePfeile();
    this._zeichneNutzer();
    for (const h of this._striche) this._zeichneStriche(h);
  }

  // Bequemlichkeit: Brett drehen
  dreheUm() {
    this.setzeAusrichtung(this.ausrichtung === 'w' ? 'b' : 'w');
  }

  erlaubeZuege(karte) {
    this._erlaubtVersion++;
    this._karte = karte || null;
    this._baueErlaubt();
    if (this._geste && !this._kannZiehen(this._geste.von)) this._brichGesteAb(true);
    const u = this._umwandlung;
    if (u && !this._zieleVon(u.von).has(u.nach)) this._brichUmwandlungAb(true);
    const v = this._vorschau;
    if (v && !this._zieleVon(v.von).has(v.eingabe)) this._brichVorschauAb(true);
    const h = this._halten;
    if (h && !this._zieleVon(h.von).has(h.nach)) this._loescheHalten();
    if (this._auswahl && !this._kannZiehen(this._auswahl)) this._auswahl = null;
    this._zeichneLagen();
  }

  // Zielkarte -> Map feld -> Set(ziele). Mit turmRochade kommt zu jeder erlaubten Rochade (Koenig zwei Felder seitwaerts)
  // der eigene Turm als Ziel dazu, auch wenn die App eine einfache zielKarte(chess) liefert.
  _baueErlaubt() {
    const karte = this._karte;
    if (!karte) { this._erlaubt = null; return; }
    this._erlaubt = new Map();
    const eintraege = karte instanceof Map ? [...karte] : Object.entries(karte);
    for (const [von, ziele] of eintraege) {
      const s = new Set([...(ziele || [])].map((z) => String(z).slice(0, 2)).filter(gueltigesFeld));
      if (!gueltigesFeld(von) || !s.size) continue;
      if (this.turmRochade) this._ergaenzeTurmRochade(von, s);
      this._erlaubt.set(von, s);
    }
  }

  _ergaenzeTurmRochade(von, ziele) {
    const fig = this.figurAuf(von);
    if (!fig || fig[1] !== 'K') return;
    for (const z of [...ziele]) {
      const dd = z.charCodeAt(0) - von.charCodeAt(0);
      if (z[1] !== von[1] || Math.abs(dd) !== 2) continue;
      const turm = (dd > 0 ? 'h' : 'a') + von[1];
      if (this.figurAuf(turm) === fig[0] + 'R') ziele.add(turm);
    }
  }

  // Zeigt eine Folge vorgemerkter Zuege, ohne beiZug aufzurufen. Die echte Stellung
  // bleibt Aufgabe der App und wird mit dem naechsten setzeStellung wiederhergestellt.
  zeigeVorzuege(liste) {
    if (this._vorschau) this._brichVorschauAb(false);
    let figuren = this._stellungKarte();
    for (const z of liste || []) {
      if (!z || !gueltigesFeld(z.von) || !gueltigesFeld(z.nach)) continue;
      figuren = wendeZugAn(figuren, z.von, z.nach, z.umwandlung || 'q');
    }
    this._zeigeFiguren(figuren, false);
    this._zeichneLagen();
  }

  zeigeAbzeichen(feld, klasse) {
    if (!gueltigesFeld(feld) || !klasse) { this.entferneAbzeichen(); return; }
    this._abzeichen = { feld, klasse };
    this._zeichneAbzeichen(true);
  }

  entferneAbzeichen() {
    this._abzeichen = null;
    if (this._abzeichenEl) this._abzeichenEl.remove();
    this._abzeichenEl = null;
  }

  // [{ von, nach, farbe?, breite?, deckkraft? }]; farbe = CSS-Farbe, Klassenname ('bester') oder
  // Vertragsname ('hinweis', 'akzent', 'gut', 'schlecht'). von === nach zeichnet einen Kreis.
  pfeile(liste) {
    this._pfeile = (liste || []).filter((p) => p && gueltigesFeld(p.von) && gueltigesFeld(p.nach || p.von));
    this._zeichnePfeile();
  }

  // markiere(['e4'], 'hinweis') setzt die Felder dieser Art (ersetzt die vorigen),
  // markiere([], art) / markiere(null, art) loescht die Art, markiere(null) loescht alle.
  // Arten mit Grundstil: hinweis, fehler, gut, auswahl, zuletzt, bewertung, k-<klasse>.
  markiere(felder, art) {
    const liste = felder == null ? [] : [].concat(felder).filter(gueltigesFeld);
    if (!liste.length) {
      if (art) this._marken.delete(art);
      else this._marken.clear();
    } else this._marken.set(art || 'hinweis', new Set(liste));
    this._zeichneLagen();
  }

  koordinaten(an = true) {
    this._koord = !!an;
    this.el.classList.toggle('ohne-koordinaten', !this._koord);
    this._beschrifte();
  }

  // Lage der Koordinaten: 'ecke' (klein in der Feldecke) oder 'rand' (aussen im Sockel; der Sockel bekommt links und
  // unten 12 px ueber .brett.koord-rand, siehe css/app.css)
  setzeKoordLage(lage) {
    this._koordLage = KOORD_LAGEN.includes(lage) ? lage : 'ecke';
    this._beschrifte();
  }

  koordLage() { return this._koordLage; }

  setzeAutoDame(an = true) { this.autoDame = !!an; }

  setzeBestaetigen(an = true) {
    this.bestaetigen = !!an;
    if (!this.bestaetigen && this._vorschau) this._brichVorschauAb(true);
  }

  setzeSteuerung(art) {
    this.steuerung = STEUERUNGEN.includes(art) ? art : 'beides';
    if (this.steuerung === 'tippen' && this._geste && this._geste.zieht) this._brichGesteAb(true);
  }

  // Koenig auf den eigenen Turm = Rochade; wirkt sofort auf die aktuelle Zielkarte (ohne neue Freigabe der App)
  setzeTurmRochade(an = true) {
    this.turmRochade = !!an;
    if (!this._erlaubt) return;
    this._baueErlaubt();
    if (this._auswahl && !this._kannZiehen(this._auswahl)) this._auswahl = null;
    this._zeichneLagen();
  }

  // Gleitdauer in ms (ohne Tempo); gleitDauer() liefert die wirksame Dauer mit Tempo (0 = das Brett setzt sofort)
  setzeDauer(ms) {
    const d = Number(ms);
    this.dauer = Number.isFinite(d) && d >= 0 ? d : STANDARD_DAUER;
  }

  gleitDauer() {
    return Math.round(this.dauer * tempo());
  }

  // ----- Flos eigene Pfeile und Marken -----

  setzePfeileErlaubt(an = true) {
    this.pfeileErlaubt = !!an;
    if (!this.pfeileErlaubt) {
      this._loescheHalteMal();
      this._malen = null;
      this.loescheNutzerPfeile();
    }
  }

  nutzerPfeile() {
    return [
      ...this._nutzer.pfeile.map((p) => ({ art: 'pfeil', von: p.von, nach: p.nach })),
      ...this._nutzer.marken.map((f) => ({ art: 'marke', feld: f })),
    ];
  }

  loescheNutzerPfeile() {
    this._nutzer = { pfeile: [], marken: [] };
    this._zeichneNutzer();
  }

  // ----- W0+a: Striche und Koenigsfall -----

  striche(liste, { ebene = null, animieren = true } = {}) {
    const gut = (liste || []).filter((x) => x && gueltigesFeld(x.nach || x.von) && (x.von == null || gueltigesFeld(x.von)));
    const svg = svgEl('svg', { class: 'brett-striche', viewBox: '0 0 8 8', 'aria-hidden': 'true' });
    if (!animieren) svg.classList.add('still');
    const h = { liste: gut, el: svg };
    if (ebene && typeof ebene.appendChild === 'function') ebene.appendChild(svg);
    else this.el.insertBefore(svg, this._umwandlungEl);
    this._zeichneStriche(h);
    this._striche.add(h);
    return {
      el: svg,
      entferne: () => {
        this._striche.delete(h);
        svg.remove();
      },
    };
  }

  _zeichneStriche(h) {
    h.el.replaceChildren();
    const mitte = (feld) => {
      const [x, y] = this._spalteZeile(feld);
      return [x + 0.5, y + 0.5];
    };
    const r = (n) => Number(n.toFixed(3));
    for (const s of h.liste) {
      const nach = s.nach || s.von;
      const von = s.von || nach;
      const art = ['linie', 'haken', 'kreuz'].includes(s.art) ? s.art : 'linie';
      const breite = Number(s.breite) > 0 ? Number(s.breite) : 0.07;
      const g = svgEl('g', { class: 'strich', 'data-art': art, 'data-von': von, 'data-nach': nach });
      g.style.color = farbeAus(s.farbe || 'akzent');
      g.style.setProperty('--v', Math.max(0, Number(s.verzoegerung) || 0) + 'ms');
      const strich = { fill: 'none', stroke: 'currentColor', 'stroke-width': breite, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
      if (art === 'linie' && von !== nach) {
        const [x1, y1] = mitte(von);
        const [x2, y2] = mitte(nach);
        const winkel = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        const laenge = Math.hypot(x2 - x1, y2 - y1);
        const lage = svgEl('g', { transform: `translate(${r(x1)} ${r(y1)}) rotate(${r(winkel)})` });
        lage.append(svgEl('line', { ...strich, x1: 0, y1: 0, x2: r(laenge), y2: 0, class: 'strich-zug' }));
        g.append(lage);
      } else {
        const [x, y] = mitte(nach);
        const lage = svgEl('g', { transform: `translate(${r(x)} ${r(y)})` });
        const d = art === 'kreuz' ? 'M -0.2 -0.2 L 0.2 0.2 M 0.2 -0.2 L -0.2 0.2' : 'M -0.22 0.02 L -0.07 0.17 L 0.23 -0.17';
        lage.append(svgEl('path', { ...strich, d, class: 'strich-marke' }));
        g.append(lage);
      }
      h.el.append(g);
    }
  }

  kippeKoenig(feld, { langsam = false } = {}) {
    const el = gueltigesFeld(feld) ? this._figuren.get(feld) : null;
    if (!el || !/K$/.test(el.dataset.figur || '')) return false;
    this._stoppeGleiten(el);
    el.classList.add('kippt');
    el.classList.toggle('langsam', !!langsam);
    this._gekippt.add(el);
    return true;
  }

  richteAuf() {
    for (const el of this._gekippt) el.classList.remove('kippt', 'langsam');
    this._gekippt.clear();
  }

  // ----- Zusatz -----

  figurAuf(feld) {
    const el = this._figuren.get(feld);
    return el ? el.dataset.figur : null;
  }

  zerstoere() {
    alleBretter.delete(this);
    this._loescheHalten();
    this._loescheHalteMal();
    for (const h of this._striche) h.el.remove();
    this._striche.clear();
    const el = this.el;
    el.removeEventListener('pointerdown', this._h.runter);
    el.removeEventListener('pointermove', this._h.bewege);
    el.removeEventListener('pointerup', this._h.hoch);
    el.removeEventListener('pointercancel', this._h.abbruch);
    el.removeEventListener('lostpointercapture', this._h.abbruch);
    el.removeEventListener('contextmenu', this._h.kontext);
    el.removeEventListener('pointerleave', this._h.verlassen);
    document.removeEventListener('keydown', this._h.taste);
    el.innerHTML = '';
    el.style.removeProperty('--brett-dauer');
    el.classList.remove('brett', 'zieht', 'greifbar', 'ohne-koordinaten', 'koord-rand', 'malt');
  }

  // ----- Aufbau -----

  _baue() {
    const el = this.el;
    el.classList.add('brett');
    el.innerHTML = '';
    el.dataset.ausrichtung = this.ausrichtung;
    el.style.setProperty('--brett-dauer', this.gleitDauer() + 'ms');
    if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', 'Schachbrett');

    this._felderEl = document.createElement('div');
    this._felderEl.className = 'brett-felder';
    this._feldEls = [];
    for (let i = 0; i < 64; i++) {
      const f = document.createElement('div');
      const zeile = Math.floor(i / 8);
      const spalte = i % 8;
      f.className = 'feld ' + ((zeile + spalte) % 2 === 0 ? 'h' : 'd');
      // Lage am Bildschirm fest in Prozent (keine Raster-Rundung des Browsers)
      f.style.left = prozent(spalte);
      f.style.top = prozent(zeile);
      this._feldEls.push(f);
      this._felderEl.append(f);
    }
    this._lagenEl = document.createElement('div');
    this._lagenEl.className = 'brett-lagen';
    // Flos Marken liegen wie die Ueberlagerungen unter den Figuren (Pfeile darueber, siehe _nutzerEl)
    this._markenEl = svgEl('svg', { class: 'brett-nutzer brett-marken', viewBox: '0 0 8 8', 'aria-hidden': 'true' });
    this._felderEl.append(this._lagenEl, this._markenEl);

    this._koordRandEl = document.createElement('div');
    this._koordRandEl.className = 'brett-koord-rand';
    this._koordRandEl.setAttribute('aria-hidden', 'true');

    this._pfeileEl = svgEl('svg', { class: 'brett-pfeile', viewBox: '0 0 8 8', 'aria-hidden': 'true' });
    this._nutzerEl = svgEl('svg', { class: 'brett-nutzer', viewBox: '0 0 8 8', 'aria-hidden': 'true' });

    this._umwandlungEl = document.createElement('div');
    this._umwandlungEl.className = 'brett-umwandlung';
    this._umwandlungEl.hidden = true;
    this._umwandlungEl.setAttribute('role', 'dialog');
    this._umwandlungEl.setAttribute('aria-label', 'Umwandlung wählen');

    el.append(this._felderEl, this._koordRandEl, this._pfeileEl, this._nutzerEl, this._umwandlungEl);
    el.classList.toggle('ohne-koordinaten', !this._koord);
    this._beschrifte();

    this._h = {
      runter: (e) => this._runter(e),
      bewege: (e) => this._bewege(e),
      hoch: (e) => this._hoch(e),
      abbruch: (e) => this._abbruch(e),
      kontext: (e) => e.preventDefault(),
      verlassen: () => this._setzeCursor(null),
      taste: (e) => { if (e.key === 'Escape' && this._umwandlung) this._brichUmwandlungAb(true); },
      wahlRunter: (e) => this._wahlRunter(e),
      wahlHoch: (e) => this._wahlHoch(e),
      wahlKlick: (e) => this._wahlKlick(e),
    };
    el.addEventListener('pointerdown', this._h.runter);
    el.addEventListener('pointermove', this._h.bewege);
    el.addEventListener('pointerup', this._h.hoch);
    el.addEventListener('pointercancel', this._h.abbruch);
    el.addEventListener('lostpointercapture', this._h.abbruch);
    el.addEventListener('contextmenu', this._h.kontext);
    el.addEventListener('pointerleave', this._h.verlassen);
    this._umwandlungEl.addEventListener('pointerdown', this._h.wahlRunter);
    this._umwandlungEl.addEventListener('pointerup', this._h.wahlHoch);
    this._umwandlungEl.addEventListener('click', this._h.wahlKlick);
  }

  // Feldnamen und Koordinaten je nach Ausrichtung und Lage
  _beschrifte() {
    const rand = this._koord && this._koordLage === 'rand';
    this.el.classList.toggle('koord-rand', rand);
    this._koordRandEl.replaceChildren();
    this._feldEls.forEach((f, i) => {
      const zeile = Math.floor(i / 8);
      const spalte = i % 8;
      const feld = this._feldAus(spalte, zeile);
      f.dataset.feld = feld;
      f.textContent = '';
      if (!this._koord) return;
      if (spalte === 0) {
        const s = document.createElement('span');
        s.className = 'koord zahl';
        s.textContent = feld[1];
        if (rand) { s.style.top = prozent(zeile); this._koordRandEl.append(s); } else f.append(s);
      }
      if (zeile === 7) {
        const s = document.createElement('span');
        s.className = 'koord buchst';
        s.textContent = feld[0];
        if (rand) { s.style.left = prozent(spalte); this._koordRandEl.append(s); } else f.append(s);
      }
    });
  }

  // ----- Koordinaten -----

  _spalteZeile(feld) {
    const d = feld.charCodeAt(0) - 97;
    const r = Number(feld[1]) - 1;
    return this.ausrichtung === 'w' ? [d, 7 - r] : [7 - d, r];
  }

  _feldAus(spalte, zeile) {
    if (spalte < 0 || spalte > 7 || zeile < 0 || zeile > 7) return null;
    return this.ausrichtung === 'w' ? DATEIEN[spalte] + (8 - zeile) : DATEIEN[7 - spalte] + (zeile + 1);
  }

  _feldAusPunkt(x, y) {
    const r = this._felderEl.getBoundingClientRect();
    if (!r.width) return null;
    return this._feldAus(Math.floor((x - r.left) / r.width * 8), Math.floor((y - r.top) / r.height * 8));
  }

  // Lage eines Feld-Elements (Figur, Ueberlagerung): --x/--y fuer Effekte, left/top fertig in Prozent
  _platziere(el, feld) {
    const [x, y] = this._spalteZeile(feld);
    el.style.setProperty('--x', x);
    el.style.setProperty('--y', y);
    el.style.left = prozent(x);
    el.style.top = prozent(y);
    el.dataset.feld = feld;
  }

  // Abzeichen oben rechts am Feld, ragt 17 % ins Nachbarfeld, am Brettrand wird es hineingeschoben
  _platziereAbzeichen(el, feld) {
    const [x, y] = this._spalteZeile(feld);
    const g = ABZEICHEN.groesse * 12.5;
    const v = ABZEICHEN.versatz * 12.5;
    el.style.setProperty('--x', x);
    el.style.setProperty('--y', y);
    el.dataset.feld = feld;
    el.style.width = g.toFixed(3) + '%';
    if (x >= 7) { el.style.left = 'auto'; el.style.right = '0'; } else { el.style.right = 'auto'; el.style.left = ((x + 1) * 12.5 + v - g).toFixed(3) + '%'; }
    el.style.top = Math.max(0, y * 12.5 - v).toFixed(3) + '%';
  }

  _normiereLetzten(z) {
    if (!z) return null;
    if (typeof z === 'string' && z.length >= 4) z = [z.slice(0, 2), z.slice(2, 4)];
    if (Array.isArray(z) && gueltigesFeld(z[0]) && gueltigesFeld(z[1])) return [z[0], z[1]];
    return null;
  }

  // ----- Figuren -----

  _bild(code) {
    return this.figurenPfad + code + '.svg';
  }

  _neueFigur(code, feld) {
    const img = document.createElement('img');
    img.className = 'figur';
    img.alt = '';
    img.draggable = false;
    img.dataset.figur = code;
    img.src = this._bild(code);
    this._platziere(img, feld);
    this.el.insertBefore(img, this._pfeileEl);
    return img;
  }

  _stellungKarte() {
    const k = new Map();
    for (const [feld, el] of this._figuren) k.set(feld, el.dataset.figur);
    return k;
  }

  _stoppeGleiten(el) {
    clearTimeout(el._gleitZeit);
    el.classList.remove('gleitet');
    if (el._gleit) { el._gleit.cancel(); el._gleit = null; }
  }

  // Figur gleitet von ihrer alten Lage (Feld oder transform-Text in px) in die neue (schon per _platziere gesetzt).
  // Nur transform wird animiert; bei Tempo 0 steht sie sofort.
  _gleiteVon(el, von, { kurve = 'gleiten', dauer = this.dauer } = {}) {
    this._stoppeGleiten(el);
    const ms = Math.round(dauer * tempo());
    let start;
    if (typeof von === 'string' && gueltigesFeld(von)) {
      const [x0, y0] = this._spalteZeile(von);
      const [x1, y1] = this._spalteZeile(el.dataset.feld);
      if (x0 === x1 && y0 === y1) return;
      start = `translate(${((x0 - x1) * 100).toFixed(2)}%, ${((y0 - y1) * 100).toFixed(2)}%)`;
    } else start = von;
    if (!ms || !start) return;
    el.classList.add('gleitet');
    const a = anim(el, [{ transform: start }, { transform: 'none' }], { d: dauer, k: kurve });
    el._gleit = a;
    // nur die eigene Animation beendet den Zustand (eine abgebrochene darf eine neuere nicht stoeren)
    const fertig = () => { if (el._gleit === a) { el._gleit = null; el.classList.remove('gleitet'); } };
    if (a && a.finished) a.finished.then(fertig, fertig);
    el._gleitZeit = setTimeout(fertig, ms + 60);
  }

  // Neue Stellung zeigen: gleiche Figuren gleiten (kuerzester Weg), geschlagene blenden aus.
  // sofortFeld: die Figur, die dort landet, springt ohne Gleiten (nach dem Ziehen mit dem Finger).
  _zeigeFiguren(neu, animieren, sofortFeld = null) {
    const ms = animieren ? this.gleitDauer() : 0;
    this.el.style.setProperty('--brett-dauer', ms + 'ms');
    const bleiben = new Map();
    const weg = [];
    const dazu = [];
    for (const [feld, el] of this._figuren) {
      if (neu.get(feld) === el.dataset.figur) bleiben.set(feld, el);
      else weg.push({ feld, el, code: el.dataset.figur });
    }
    for (const [feld, code] of neu) if (!bleiben.has(feld)) dazu.push({ feld, code });

    const paare = [];
    const wegFrei = new Set(weg.map((_, i) => i));
    const dazuFrei = new Set(dazu.map((_, i) => i));
    const kandidaten = [];
    weg.forEach((w, i) => dazu.forEach((d, j) => {
      if (w.code === d.code) kandidaten.push([feldAbstand(w.feld, d.feld), i, j]);
    }));
    kandidaten.sort((a, b) => a[0] - b[0]);
    for (const [, i, j] of kandidaten) {
      if (wegFrei.has(i) && dazuFrei.has(j)) { wegFrei.delete(i); dazuFrei.delete(j); paare.push([weg[i], dazu[j]]); }
    }
    for (const j of [...dazuFrei]) {
      for (const i of wegFrei) {
        if (istUmwandlungsPaar(weg[i].feld, weg[i].code, dazu[j].feld, dazu[j].code)) {
          wegFrei.delete(i); dazuFrei.delete(j); paare.push([weg[i], dazu[j]]);
          break;
        }
      }
    }

    // Abzeichen verschwindet, sobald sein Feld geschlagen oder verlassen wird
    const abz = this._abzeichen;
    if (abz && this._abzeichenEl) {
      const vorher = this._figuren.get(abz.feld);
      const nachher = neu.get(abz.feld);
      if (!vorher || vorher.dataset.figur !== nachher) this._blendeAbzeichenAus(ms);
    }

    const karte = new Map(bleiben);
    for (const [w, d] of paare) {
      const el = w.el;
      if (el.dataset.figur !== d.code) { el.dataset.figur = d.code; el.src = this._bild(d.code); }
      el.classList.remove('verdeckt', 'geht', 'vorschau');
      el.style.transform = '';
      this._stoppeGleiten(el);
      this._platziere(el, d.feld);
      if (ms && d.feld !== sofortFeld) this._gleiteVon(el, w.feld);
      karte.set(d.feld, el);
    }
    for (const i of wegFrei) {
      const el = weg[i].el;
      this._stoppeGleiten(el);
      if (ms) {
        el.classList.add('geht');
        el.dataset.feld = '';
        setTimeout(() => el.remove(), ms + 60);
      } else el.remove();
    }
    for (const j of dazuFrei) {
      const el = this._neueFigur(dazu[j].code, dazu[j].feld);
      if (ms) el.classList.add('kommt');
      karte.set(dazu[j].feld, el);
    }
    this._figuren = karte;
  }

  // ----- Zustand der Ueberlagerungen -----

  _kannZiehen(feld) {
    return !this._wartet && !!this._erlaubt && !!this._erlaubt.get(feld) && this._figuren.has(feld);
  }

  _zieleVon(feld) {
    return (this._erlaubt && this._erlaubt.get(feld)) || new Set();
  }

  _istUmwandlung(von, nach) {
    const fig = this.figurAuf(von);
    return !!fig && fig[1] === 'P' && ((fig[0] === 'w' && nach[1] === '8') || (fig[0] === 'b' && nach[1] === '1'));
  }

  // turmRochade: Koenig auf den eigenen Turm getippt -> das echte Rochadeziel (g/c)
  _echtesZiel(von, nach) {
    const fig = this.figurAuf(von);
    const dort = this.figurAuf(nach);
    if (fig && dort && fig[1] === 'K' && dort[1] === 'R' && fig[0] === dort[0] && von[1] === nach[1] && (nach[0] === 'h' || nach[0] === 'a')) {
      return (nach[0] === 'h' ? 'g' : 'c') + von[1];
    }
    return nach;
  }

  _zeichneLagen() {
    const soll = [];
    if (this._letzter) for (const f of this._letzter) soll.push(['zuletzt', f]);
    for (const [art, felder] of this._marken) for (const f of felder) soll.push(['mark-' + art, f]);
    if (this._schach) soll.push(['schach', this._schach]);
    const v = this._vorschau;
    if (v) {
      soll.push(['auswahl', v.von]);
      soll.push(['vorschau', v.nach]);
    } else if (this._auswahl) {
      soll.push(['auswahl', this._auswahl]);
      if (!this._umwandlung) {
        const eigene = this.figurAuf(this._auswahl);
        const [x0, y0] = this._spalteZeile(this._auswahl);
        const ziele = [...this._zieleVon(this._auswahl)].sort((a, b) => {
          const pa = this._spalteZeile(a);
          const pb = this._spalteZeile(b);
          return Math.hypot(pa[0] - x0, pa[1] - y0) - Math.hypot(pb[0] - x0, pb[1] - y0);
        });
        ziele.forEach((z, n) => {
          const dort = this.figurAuf(z);
          const art = !dort ? 'ziel' : eigene && dort[0] === eigene[0] ? 'ziel rochade' : 'ziel schlag';
          soll.push([art, z, n]);
        });
      }
    }
    if (this._ueber) soll.push(['ueber', this._ueber]);

    const neu = new Map();
    for (const [art, feld, n] of soll) {
      const schluessel = art + '@' + feld;
      if (neu.has(schluessel)) continue;
      let el = this._lagen.get(schluessel);
      if (!el) {
        el = document.createElement('div');
        el.className = 'lage ' + art;
        if (n != null) el.style.setProperty('--v', Math.round(n * 22 * tempo()) + 'ms');
        this._platziere(el, feld);
        this._lagenEl.append(el);
      }
      neu.set(schluessel, el);
    }
    for (const [schluessel, el] of this._lagen) if (!neu.has(schluessel)) el.remove();
    this._lagen = neu;

    // gewaehlte Figur steht leicht angehoben (nicht waehrend sie gezogen wird)
    const heben = !v && this._auswahl && !(this._geste && this._geste.zieht) ? this._figuren.get(this._auswahl) : null;
    for (const el of this._figuren.values()) el.classList.toggle('angehoben', el === heben);
  }

  _zeichneAbzeichen(plopp) {
    if (!this._abzeichen) return;
    const { feld, klasse } = this._abzeichen;
    let el = this._abzeichenEl;
    if (!el || plopp) {
      if (el) el.remove();
      el = document.createElement('div');
      this.el.insertBefore(el, this._umwandlungEl);
      this._abzeichenEl = el;
    }
    el.className = 'abzeichen-ort k-' + klasse + (plopp ? ' plopp' : '');
    el.dataset.klasse = klasse;
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', KLASSEN_TITEL[klasse] || klasse);
    el.innerHTML = symbolSvg(klasse);
    this._platziereAbzeichen(el, feld);
  }

  _blendeAbzeichenAus(ms) {
    const el = this._abzeichenEl;
    this._abzeichen = null;
    this._abzeichenEl = null;
    if (!el) return;
    if (!ms) { el.remove(); return; }
    el.classList.remove('plopp');
    el.classList.add('weg');
    // anim() rechnet das Tempo selbst ein, ms ist schon gleitDauer() (mit Tempo): deshalb die Grunddauer
    const a = anim(el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.6)' }], { d: Math.min(180, this.dauer), k: 'sanft', fill: 'forwards' });
    const raus = () => el.remove();
    if (a && a.finished) a.finished.then(raus, raus);
    setTimeout(raus, ms + 60);
  }

  _zeichnePfeile() {
    const svg = this._pfeileEl;
    svg.replaceChildren();
    const mitte = (feld) => {
      const [x, y] = this._spalteZeile(feld);
      return [x + 0.5, y + 0.5];
    };
    for (const p of this._pfeile) {
      const nach = p.nach || p.von;
      const breite = Number(p.breite) > 0 ? Number(p.breite) : 0.2;
      const g = pfeilElement(p.von, nach, mitte(p.von), mitte(nach), breite);
      g.style.color = farbeAus(p.farbe);
      if (p.deckkraft != null) g.style.opacity = String(p.deckkraft);
      svg.append(g);
    }
  }

  // Flos Pfeile und Marken (plus die Vorschau der laufenden Zeichen-Geste)
  _zeichneNutzer() {
    const svg = this._nutzerEl;
    svg.replaceChildren();
    this._markenEl.replaceChildren();
    const mitte = (feld) => {
      const [x, y] = this._spalteZeile(feld);
      return [x + 0.5, y + 0.5];
    };
    const marke = (feld, vorschau) => {
      const [x, y] = this._spalteZeile(feld);
      const r = svgEl('rect', { class: 'marke' + (vorschau ? ' vorschau' : ''), 'data-feld': feld, x, y, width: 1, height: 1 });
      this._markenEl.append(r);
    };
    const pfeil = (von, nach, vorschau) => {
      const g = pfeilElement(von, nach, mitte(von), mitte(nach), 0.2);
      if (vorschau) g.classList.add('vorschau');
      svg.append(g);
    };
    for (const f of this._nutzer.marken) marke(f, false);
    for (const p of this._nutzer.pfeile) pfeil(p.von, p.nach, false);
    const m = this._malen;
    if (m) {
      if (!m.nach || m.nach === m.von) marke(m.von, true);
      else pfeil(m.von, m.nach, true);
    }
    this.el.classList.toggle('malt', !!m);
  }

  _schaltePfeil(von, nach) {
    const p = this._nutzer.pfeile;
    const i = p.findIndex((x) => x.von === von && x.nach === nach);
    if (i >= 0) p.splice(i, 1);
    else p.push({ von, nach });
  }

  _schalteMarke(feld) {
    const m = this._nutzer.marken;
    const i = m.indexOf(feld);
    if (i >= 0) m.splice(i, 1);
    else m.push(feld);
  }

  // ----- Bedienung -----

  _runter(e) {
    if (this._umwandlung) return;
    const maus = e.pointerType === 'mouse';
    const aktiv = this._geste || this._halten || this._halteMal || this._malen;
    if (aktiv) {
      // zweiter Zeiger (zweiter Finger, zweite Maustaste): jede laufende Geste bricht ab, es entsteht nie ein Zug
      if (e.pointerId !== aktiv.id) this._zweiterZeiger();
      return;
    }
    if (maus && e.button === 2) {
      // Rechtsklick: Pfeil malen oder Feld markieren
      const feld = this._feldAusPunkt(e.clientX, e.clientY);
      if (!feld || !this.pfeileErlaubt) return;
      e.preventDefault();
      e.stopPropagation();   // Zeichen-Geste: die Umgebung (Wischen der Analyse) bekommt sie nicht
      this._starteMalen(e.pointerId, feld);
      return;
    }
    if (maus && e.button !== 0) return;
    this._stumm = null;
    const feld = this._feldAusPunkt(e.clientX, e.clientY);
    if (!feld) return;
    e.preventDefault();
    if (this._wartet) return;
    const v = this._vorschau;
    if (v) {
      if (feld === v.nach || feld === v.eingabe) { this._tippAufZiel(v.von, v.nach, e); return; }
      // Tipp anderswo nimmt zurueck. Auf einer eigenen ziehbaren Figur wirkt er danach normal (waehlt sie), sonst tut er
      // nichts weiter: kein beiLeer (die Partie bricht damit Vorzuege ab), Flos Zeichnungen bleiben stehen
      this._brichVorschauAb(true);
      if (!this._kannZiehen(feld)) return;
    }
    if (this._auswahl && this._auswahl !== feld && this._zieleVon(this._auswahl).has(feld)) {
      if (this.steuerung === 'ziehen') {
        // nur Ziehen: ein Tipp aufs Ziel zieht nicht, er hebt die Auswahl auf
        this._auswahl = null;
        this._zeichneLagen();
        return;
      }
      this._tippAufZiel(this._auswahl, feld, e);
      return;
    }
    if (this._kannZiehen(feld)) {
      const warSchon = this._auswahl === feld;
      this._auswahl = feld;
      this._zeichneLagen();
      this._geste = {
        id: e.pointerId, von: feld, x0: e.clientX, y0: e.clientY, typ: e.pointerType,
        zieht: false, warSchon, el: this._figuren.get(feld), ueberSeit: 0,
      };
      try { this.el.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
      // kein Halte-Malen: eine Figur, die ziehen darf (auch als Vorzug), bleibt immer eine Zug-Geste, auch wenn der
      // Finger lange liegt (Figur antippen, nachdenken, ziehen ergibt einen Zug, nie einen Pfeil)
      return;
    }
    // W0+a: nicht erlaubter Zugversuch (am Bild aendert sich nichts)
    if (this.beiAbgelehnt && this._erlaubt) {
      if (this._eigeneFigur(feld)) this._stumm = { id: e.pointerId, von: feld };
      else if (this._auswahl) this._meldeAbgelehnt(this._auswahl, feld, 'tippen');
    }
    const hatteAuswahl = !!this._auswahl;
    if (this._auswahl) {
      this._auswahl = null;
      this._zeichneLagen();
    }
    // Tipp ins Brett ohne Auswahl loescht Flos Pfeile und Marken (Maus sofort, Finger beim Loslassen ohne Halten)
    let spaeter = false;
    if (!hatteAuswahl) {
      if (maus) this.loescheNutzerPfeile();
      else {
        this._starteHalteMal(e, feld, { loeschtBeimTipp: true });
        // Ob der Finger tippt (beiLeer, z. B. Vorzuege abbrechen) oder haelt (Marke malen), zeigt erst das Loslassen:
        // eine Marke laesst die Vorzuege stehen
        spaeter = this.pfeileErlaubt;
      }
    }
    if (spaeter) this._leerOffen = { id: e.pointerId, feld };
    else this._meldeLeer(feld);
  }

  _meldeLeer(feld) {
    if (!this.beiLeer) return;
    try { this.beiLeer(feld); } catch (err) { console.error(err); }
  }

  // Tipp auf ein Zielfeld: bei Umwandlung mit autoDame erst 450 ms warten (Halten zeigt D T L S). Ein Finger zieht erst
  // beim Loslassen (ein zweiter Finger bis dahin bricht ab: zwei Finger ergeben nie einen Zug), die Maus sofort.
  _tippAufZiel(von, nach, e) {
    const fuehrtAus = !this.bestaetigen || (this._vorschau && this._vorschau.von === von && this._vorschau.nach === nach);
    const umwandlung = fuehrtAus && this.autoDame && this._istUmwandlung(von, this._echtesZiel(von, nach));
    if (umwandlung || e.pointerType !== 'mouse') {
      const timer = umwandlung ? setTimeout(() => {
        this._halten = null;
        this._eingabe(von, nach, 'tippen', { gehalten: true });
      }, HALTEN_UMWANDLUNG) : null;
      this._halten = { id: e.pointerId, von, nach, x0: e.clientX, y0: e.clientY, timer };
      try { this.el.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
      return;
    }
    this._eingabe(von, nach, 'tippen');
  }

  _loescheHalten() {
    if (this._halten) clearTimeout(this._halten.timer);
    this._halten = null;
  }

  // Finger liegt auf einem Feld ohne eigene Zug-Geste: nach 400 ms wird daraus Malen (Pfeil oder Marke), sonst war es ein Tipp
  _starteHalteMal(e, feld, { loeschtBeimTipp = false } = {}) {
    this._loescheHalteMal();
    if (!this.pfeileErlaubt && !loeschtBeimTipp) return;
    const id = e.pointerId;
    const timer = this.pfeileErlaubt ? setTimeout(() => {
      const h = this._halteMal;
      this._halteMal = null;
      if (!h || this._malen || this._halten) return;
      if (this._geste) return;                   // laufende Zug-Geste: nie malen
      if (this._stumm && this._stumm.id === id) this._stumm = null;
      if (this._leerOffen && this._leerOffen.id === id) this._leerOffen = null;
      this._starteMalen(id, feld);
    }, HALTEN_MALEN) : null;
    this._halteMal = { id, feld, x0: e.clientX, y0: e.clientY, timer, loeschtBeimTipp };
    try { this.el.setPointerCapture(id); } catch (err) { /* egal */ }
  }

  _loescheHalteMal() {
    if (this._halteMal && this._halteMal.timer) clearTimeout(this._halteMal.timer);
    this._halteMal = null;
  }

  _starteMalen(id, feld) {
    this._malen = { id, von: feld, nach: feld };
    try { this.el.setPointerCapture(id); } catch (err) { /* egal */ }
    this._zeichneNutzer();
  }

  _beendeMalen(e) {
    const m = this._malen;
    this._malen = null;
    if (!m) return;
    try { this.el.releasePointerCapture(m.id); } catch (err) { /* egal */ }
    // ausserhalb des Bretts losgelassen: nichts (so bricht man eine Zeichnung ab)
    const nach = e ? this._feldAusPunkt(e.clientX, e.clientY) : null;
    if (nach && nach !== m.von) this._schaltePfeil(m.von, nach);
    else if (nach) this._schalteMarke(m.von);
    this._zeichneNutzer();
  }

  _zweiterZeiger() {
    this._loescheHalten();
    this._loescheHalteMal();
    this._stumm = null;
    this._leerOffen = null;
    if (this._malen) { this._malen = null; this._zeichneNutzer(); }
    if (this._geste) this._brichGesteAb(true);
    if (this._auswahl) {
      this._auswahl = null;
      this._zeichneLagen();
    }
  }

  // Figur der Seite am Zug (Farbe aus der Zielkarte), die selbst keinen erlaubten Zug hat
  _eigeneFigur(feld) {
    const code = this.figurAuf(feld);
    if (!code || !this._erlaubt) return false;
    for (const von of this._erlaubt.keys()) {
      const f = this.figurAuf(von);
      if (f) return f[0] === code[0];
    }
    return false;
  }

  _meldeAbgelehnt(von, nach, art) {
    if (!this.beiAbgelehnt) return;
    try { this.beiAbgelehnt(von, nach, art); } catch (err) { console.error(err); }
  }

  _bewege(e) {
    const m = this._malen;
    if (m) {
      if (e.pointerId !== m.id) return;
      e.preventDefault();
      e.stopPropagation();
      const nach = this._feldAusPunkt(e.clientX, e.clientY);
      if (nach !== m.nach) { m.nach = nach; this._zeichneNutzer(); }
      return;
    }
    const hm = this._halteMal;
    if (hm && e.pointerId === hm.id && Math.hypot(e.clientX - hm.x0, e.clientY - hm.y0) >= SCHWELLE_FINGER) this._loescheHalteMal();
    const h = this._halten;
    if (h && e.pointerId === h.id && !h.bewegt && Math.hypot(e.clientX - h.x0, e.clientY - h.y0) >= SCHWELLE_FINGER) {
      // verrutscht: kein Halten mehr (keine Auswahl D T L S), das Loslassen auf dem Zielfeld bleibt ein Tipp
      clearTimeout(h.timer);
      h.bewegt = true;
    }
    const g = this._geste;
    if (!g) {
      if (e.pointerType === 'mouse') this._setzeCursor(this._feldAusPunkt(e.clientX, e.clientY));
      return;
    }
    if (e.pointerId !== g.id) return;
    if (!g.zieht) {
      if (this.steuerung === 'tippen') return;
      const schwelle = g.typ === 'mouse' ? SCHWELLE_MAUS : SCHWELLE_FINGER;
      if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < schwelle || !g.el) return;
      g.zieht = true;
      this._loescheHalteMal();
      this._stoppeGleiten(g.el);
      g.el.classList.remove('angehoben');
      g.el.classList.add('gezogen');
      g.el.classList.toggle('beruehrung', g.typ !== 'mouse');
      this.el.classList.add('zieht');
      g.ursprung = this._spalteZeile(g.von);
      // Vergroesserung als Zahl (ein var() im transform liesse sich beim Zurueckfedern nicht animieren)
      const wunsch = parseFloat(getComputedStyle(this.el).getPropertyValue(g.typ === 'mouse' ? '--brett-zieh-maus' : '--brett-zieh-finger'));
      g.skala = Number.isFinite(wunsch) && wunsch > 0 ? wunsch : (g.typ === 'mouse' ? 1 : 1.35);
    }
    e.preventDefault();
    const r = this._felderEl.getBoundingClientRect();
    const s = r.width / 8;
    const f = this._feldAusPunkt(e.clientX, e.clientY);
    const ueber = f && f !== g.von && this._zieleVon(g.von).has(f) ? f : null;
    // Touchmove-Ereignisse koennen auf iPadOS bei schneller Bewegung einen Frame hinterherhinken.
    // Ueber einem gueltigen Ziel bleibt die Vorschau deshalb mittig unter diesem Feld statt sichtbar nachzulaufen.
    const [spalte, zeile] = ueber && g.typ !== 'mouse' ? this._spalteZeile(ueber) : [null, null];
    const x = spalte == null ? e.clientX : r.left + (spalte + 0.5) * s;
    const y = zeile == null ? e.clientY : r.top + (zeile + 0.5) * s;
    // Versatz zur Ruhelage der Figur (ihr Startfeld); Vergroesserung im selben transform (die CSS-Eigenschaft
    // scale wuerde den Versatz mitskalieren)
    const tx = x - r.left - s / 2 - g.ursprung[0] * s;
    const ty = y - r.top - s / 2 - g.ursprung[1] * s;
    g.el.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${g.skala})`;
    if (ueber !== this._ueber) {
      this._ueber = ueber;
      g.ueberSeit = ueber ? Date.now() : 0;
      this._zeichneLagen();
    }
  }

  _hoch(e) {
    if (this._malen) {
      if (e.pointerId === this._malen.id) {
        e.stopPropagation();   // Ende einer Zeichen-Geste: kein Wischen in der Umgebung
        this._beendeMalen(e);
      }
      return;
    }
    const hm = this._halteMal;
    if (hm && e.pointerId === hm.id) {
      this._loescheHalteMal();
      // kurzer Tipp (kein Halten) ohne Auswahl: Flos Pfeile und Marken weg
      if (hm.loeschtBeimTipp && !this._geste) this.loescheNutzerPfeile();
    }
    const leer = this._leerOffen;
    if (leer && e.pointerId === leer.id) {
      this._leerOffen = null;
      this._meldeLeer(leer.feld);
    }
    const h = this._halten;
    if (h && e.pointerId === h.id) {
      this._loescheHalten();
      // Finger-Tipp aufs Ziel losgelassen (bei Umwandlung vor 450 ms: Dame). Ist der Finger verrutscht, zaehlt das nur auf
      // dem Zielfeld (sonst bleibt die Auswahl, kein Zug)
      if (!h.bewegt || this._feldAusPunkt(e.clientX, e.clientY) === h.nach) this._eingabe(h.von, h.nach, 'tippen');
      return;
    }
    const st = this._stumm;
    if (st && e.pointerId === st.id) {
      this._stumm = null;
      const ziel = this._feldAusPunkt(e.clientX, e.clientY);
      if (ziel && this._erlaubt && !this._wartet) this._meldeAbgelehnt(st.von, ziel === st.von ? null : ziel, ziel === st.von ? 'tippen' : 'ziehen');
      return;
    }
    const g = this._geste;
    if (!g || e.pointerId !== g.id) return;
    this._geste = null;
    this._ueber = null;
    this.el.classList.remove('zieht');
    if (g.zieht) {
      g.el.classList.remove('gezogen', 'beruehrung');
      const ziel = this._feldAusPunkt(e.clientX, e.clientY);
      if (ziel && ziel !== g.von && this._zieleVon(g.von).has(ziel)) {
        this._eingabe(g.von, ziel, 'ziehen', { gehalten: g.ueberSeit > 0 && Date.now() - g.ueberSeit >= HALTEN_UMWANDLUNG });
      } else {
        this._schnappeZurueck(g.el, g.von);
        this._zeichneLagen();
        if (ziel && ziel !== g.von) this._meldeAbgelehnt(g.von, ziel, 'ziehen');
      }
    } else if (g.warSchon) {
      this._auswahl = null; // zweites Tippen auf dieselbe Figur hebt die Auswahl auf
      this._zeichneLagen();
    }
  }

  _abbruch(e) {
    if (this._malen && e.pointerId === this._malen.id) { this._malen = null; this._zeichneNutzer(); }
    if (this._halteMal && e.pointerId === this._halteMal.id) this._loescheHalteMal();
    if (this._leerOffen && e.pointerId === this._leerOffen.id) this._leerOffen = null;
    if (this._halten && e.pointerId === this._halten.id) this._loescheHalten();
    const g = this._geste;
    if (!g || e.pointerId !== g.id) return;
    this._brichGesteAb(true);
  }

  _brichGesteAb(animieren) {
    const g = this._geste;
    this._geste = null;
    this._ueber = null;
    this.el.classList.remove('zieht');
    if (!g) return;
    try { this.el.releasePointerCapture(g.id); } catch (err) { /* egal */ }
    if (g.zieht && g.el) {
      g.el.classList.remove('gezogen', 'beruehrung');
      if (animieren) this._schnappeZurueck(g.el, g.von);
      else { this._stoppeGleiten(g.el); g.el.style.transform = ''; this._platziere(g.el, g.von); }
    }
    this._zeichneLagen();
  }

  // Figur federt aus der Zieh-Lage auf ihr Feld zurueck
  _schnappeZurueck(el, feld) {
    const alt = el.style.transform;
    el.style.transform = '';
    this._platziere(el, feld);
    this._gleiteVon(el, alt || null, { kurve: 'feder', dauer: Math.min(this.dauer, 260) });
  }

  _setzeCursor(feld) {
    if (feld === this._cursorFeld) return;
    this._cursorFeld = feld;
    this.el.classList.toggle('greifbar', !!feld && this._kannZiehen(feld));
  }

  // Ein eingegebener Zug (Tipp aufs Ziel oder Abwurf): Vorschau (bestaetigen), Umwandlung oder sofort ausfuehren
  _eingabe(von, nach, art, { gehalten = false } = {}) {
    const ziel = this._echtesZiel(von, nach);
    const v = this._vorschau;
    if (this.bestaetigen && !(v && v.von === von && v.nach === ziel)) {
      this._zeigeVorschau(von, ziel, nach, art);
      return;
    }
    const sofort = !!v || art === 'ziehen';   // die Figur steht schon dort
    if (v) this._loeseVorschau();
    if (this._istUmwandlung(von, ziel)) {
      if (this.autoDame && !gehalten) this._fuehreAus(von, ziel, 'q', art, sofort);
      else this._oeffneUmwandlung(von, ziel, art, sofort);
      return;
    }
    this._fuehreAus(von, ziel, undefined, art, sofort);
  }

  // ----- Zug bestaetigen: Vorschau -----

  _zeigeVorschau(von, nach, eingabe, art) {
    const el = this._figuren.get(von);
    if (!el) return;
    this._auswahl = null;
    this._ueber = null;
    this._stoppeGleiten(el);
    el.style.transform = '';
    el.classList.remove('angehoben');
    el.classList.add('vorschau');
    this._platziere(el, nach);
    if (art === 'tippen') this._gleiteVon(el, von);
    this._vorschau = { von, nach, eingabe, art, el };
    this._zeichneLagen();
  }

  // Vorschau fest machen: die Figur bleibt auf dem Ziel, der Zug laeuft weiter wie ein normaler
  _loeseVorschau() {
    const v = this._vorschau;
    this._vorschau = null;
    if (v) v.el.classList.remove('vorschau');
  }

  _brichVorschauAb(animieren) {
    const v = this._vorschau;
    this._vorschau = null;
    if (!v) return;
    v.el.classList.remove('vorschau');
    this._stoppeGleiten(v.el);
    v.el.style.transform = '';
    this._platziere(v.el, v.von);
    if (animieren) this._gleiteVon(v.el, v.nach);
    this._zeichneLagen();
  }

  // Zug sofort zeigen (inkl. Rochade/en passant), dann die App fragen; bei Nein zuruecknehmen.
  // sofort: die Figur steht schon auf dem Ziel (gezogen oder Vorschau), sie gleitet nicht noch einmal.
  _fuehreAus(von, nach, umwandlung, art, sofort = art === 'ziehen') {
    const vorher = { figuren: this._stellungKarte(), letzter: this._letzter, schach: this._schach };
    const neu = wendeZugAn(vorher.figuren, von, nach, umwandlung);
    this._auswahl = null;
    this._ueber = null;
    this._letzter = [von, nach];
    this._schach = null;
    this._zeigeFiguren(neu, true, sofort ? nach : null);
    this._zeichneLagen();

    const stellungVersion = ++this._stellungVersion;
    const erlaubtVersion = this._erlaubtVersion;
    const fertig = (ok) => {
      if (!ok) {
        if (this._stellungVersion === stellungVersion) {
          this._letzter = vorher.letzter;
          this._schach = vorher.schach;
          this._zeigeFiguren(vorher.figuren, true);
          this._zeichneLagen();
        }
      } else if (this._erlaubtVersion === erlaubtVersion) {
        this._erlaubt = null; // alte Zielkarte gilt nicht mehr; die App gibt die naechste frei
        this._karte = null;
        this._zeichneLagen();
      }
    };
    const info = { art: art === 'ziehen' ? 'ziehen' : 'tippen', landung: sofort ? 0 : this.gleitDauer() };
    let antwort = false;
    try {
      antwort = this.beiZug ? this.beiZug(von, nach, umwandlung, info) : false;
    } catch (err) {
      console.error(err);
      antwort = false;
    }
    if (antwort && typeof antwort.then === 'function') {
      this._wartet = true;
      antwort.then(
        (ok) => { this._wartet = false; fertig(!!ok); },
        (err) => { console.error(err); this._wartet = false; fertig(false); },
      );
    } else fertig(!!antwort);
  }

  // ----- Umwandlung -----

  _oeffneUmwandlung(von, nach, art, sofort = art === 'ziehen') {
    const bauer = this._figuren.get(von);
    const farbe = bauer.dataset.figur[0];
    const verdeckt = this._figuren.get(nach) || null;
    if (verdeckt) verdeckt.classList.add('verdeckt');
    bauer.classList.add('wartet');
    bauer.classList.remove('angehoben');
    this._stoppeGleiten(bauer);
    bauer.style.transform = '';
    this._platziere(bauer, nach);
    if (!sofort) this._gleiteVon(bauer, von);

    const [spalte, zeile] = this._spalteZeile(nach);
    const nachUnten = zeile < 4;
    const wahl = document.createElement('div');
    wahl.className = 'umwandlung-wahl ' + (nachUnten ? 'nach-unten' : 'nach-oben');
    wahl.style.setProperty('--x', spalte);
    wahl.style.setProperty('--y', nachUnten ? zeile : zeile - 3);
    wahl.style.left = prozent(spalte);
    wahl.style.top = prozent(nachUnten ? zeile : zeile - 3);
    const knoepfe = UMWANDLUNG_REIHE.map((f) => {
      const k = document.createElement('button');
      k.type = 'button';
      k.className = 'umwandlung-figur';
      k.dataset.figur = f;
      k.setAttribute('aria-label', FIGUR_NAMEN[f]);
      k.title = FIGUR_NAMEN[f];
      const img = document.createElement('img');
      img.alt = '';
      img.draggable = false;
      img.src = this._bild(farbe + f.toUpperCase());
      k.append(img);
      return k;
    });
    if (!nachUnten) knoepfe.reverse(); // Dame steht immer direkt am Zielfeld
    wahl.append(...knoepfe);
    this._umwandlungEl.replaceChildren(wahl);
    this._umwandlungEl.hidden = false;
    this._umwandlung = { von, nach, art, verdeckt, bauer, knopf: null, seit: Date.now() };
    this._auswahl = von;
    this._zeichneLagen();
    document.addEventListener('keydown', this._h.taste);
  }

  _schliesseUmwandlung() {
    this._umwandlungEl.hidden = true;
    this._umwandlungEl.replaceChildren();
    document.removeEventListener('keydown', this._h.taste);
    const u = this._umwandlung;
    this._umwandlung = null;
    if (u) u.bauer.classList.remove('wartet');
    return u;
  }

  _brichUmwandlungAb(animieren) {
    const u = this._schliesseUmwandlung();
    if (!u) return;
    if (u.verdeckt) u.verdeckt.classList.remove('verdeckt');
    this._stoppeGleiten(u.bauer);
    this._platziere(u.bauer, u.von);
    if (animieren) this._gleiteVon(u.bauer, u.nach);
    this._auswahl = null;
    this._zeichneLagen();
  }

  _waehleUmwandlung(figur) {
    const u = this._schliesseUmwandlung();
    if (!u) return;
    this._fuehreAus(u.von, u.nach, figur, u.art, true);   // der Bauer steht schon auf dem Ziel
  }

  _wahlRunter(e) {
    e.stopPropagation();
    e.preventDefault();
    if (this._umwandlung) this._umwandlung.knopf = e.target.closest('.umwandlung-figur');
  }

  _wahlHoch(e) {
    e.stopPropagation();
    const u = this._umwandlung;
    if (!u) return;
    const knopf = e.target.closest('.umwandlung-figur');
    // Touch faengt den Zeiger am Startelement ein: dann zaehlt der Knopf vom Herunterdruecken
    const unter = document.elementFromPoint(e.clientX, e.clientY);
    const ziel = (unter && unter.closest && unter.closest('.umwandlung-figur')) || knopf;
    if (ziel && ziel === u.knopf) this._waehleUmwandlung(ziel.dataset.figur);
    else if (!ziel && !u.knopf) this._brichUmwandlungAb(true);
    else u.knopf = null;
  }

  _wahlKlick(e) {
    e.stopPropagation();
    if (e.detail !== 0 || !this._umwandlung) return; // nur Tastatur (Enter/Leertaste)
    // Der Klick des Tipps, der die Auswahl geoeffnet hat, landet auf der Dame unter dem Finger
    // (manche Touch-Browser melden ihn mit detail 0): kurz nach dem Oeffnen nicht als Wahl werten
    if (Date.now() - this._umwandlung.seit < 500) return;
    const knopf = e.target.closest('.umwandlung-figur');
    if (knopf) this._waehleUmwandlung(knopf.dataset.figur);
  }
}

Brett.setzeSymbole = setzeSymbole;
Brett.symbolSvg = symbolSvg;
